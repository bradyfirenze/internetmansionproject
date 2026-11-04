// Voxel storage, baked lighting (sky + colored block light) and greedy chunk meshing.
import * as THREE from 'three';
import { BLOCKS, B } from './blocks.js';

export const WORLD = { X0: -385, Z0: -380, W: 625, D: 495, H: 90, GROUND: 8, CHUNK: 32 };
const { W, D, H, CHUNK } = WORLD;
const STRIDE_Y = W * D;
const idx = (x, y, z) => x + z * W + y * STRIDE_Y;

export class Voxels {
  constructor() {
    this.b = new Uint8Array(W * D * H);
    this.l = new Uint16Array(W * D * H); // sky<<12 | r<<8 | g<<4 | b
    this.dirtyLight = true;
  }
  // World-space cell helpers (game coords: x, y up, z)
  getW(x, y, z) {
    const ix = Math.floor(x) - WORLD.X0, iy = Math.floor(y), iz = Math.floor(z) - WORLD.Z0;
    if (ix < 0 || iz < 0 || ix >= W || iz >= D || iy < 0 || iy >= H) return 0;
    return this.b[idx(ix, iy, iz)];
  }
  setW(x, y, z, id) {
    const ix = Math.floor(x) - WORLD.X0, iy = Math.floor(y), iz = Math.floor(z) - WORLD.Z0;
    if (ix < 0 || iz < 0 || ix >= W || iz >= D || iy < 0 || iy >= H) return;
    this.b[idx(ix, iy, iz)] = id;
  }
  solidW(x, y, z) { return BLOCKS[this.getW(x, y, z)].solid; }
  lightW(x, y, z) {
    const ix = Math.floor(x) - WORLD.X0, iy = Math.floor(y), iz = Math.floor(z) - WORLD.Z0;
    if (ix < 0 || iz < 0 || ix >= W || iz >= D || iy < 0 || iy >= H) return { sky: 1, r: 0, g: 0, b: 0 };
    const v = this.l[idx(ix, iy, iz)];
    return { sky: (v >> 12) / 15, r: ((v >> 8) & 15) / 15, g: ((v >> 4) & 15) / 15, b: (v & 15) / 15 };
  }
  // Barriers open and close doors without touching any mesh or lighting.
  setBarrier(cells, on) { for (const c of cells) this.setW(c[0], c[1], c[2], on ? B.barrier : 0); }

  bakeLight(onProgress) {
    const { b, l } = this, n = W * D;
    const blocksLight = new Uint8Array(BLOCKS.length);
    BLOCKS.forEach((d, i) => { blocksLight[i] = d.opaque ? 1 : 0; });
    const tops = new Int16Array(n);
    // Sky columns
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      let y = H - 1, lvl = 15;
      const col = x + z * W;
      for (; y >= 0; y--) {
        const id = b[col + y * STRIDE_Y];
        if (blocksLight[id]) break;
        l[col + y * STRIDE_Y] = lvl << 12;
      }
      tops[col] = y;
    }
    // Sky flood into overhangs and rooms
    const cap = 1 << 23; let Q = new Int32Array(cap), head = 0, tail = 0;
    const push = (i) => { Q[tail] = i; tail = (tail + 1) % cap; };
    for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) {
      const col = x + z * W, t = tops[col];
      const mx = Math.max(tops[col - 1], tops[col + 1], tops[col - W], tops[col + W]);
      for (let y = t + 1; y <= mx && y < H; y++) push(col + y * STRIDE_Y);
    }
    const flood = (shift, mask) => {
      while (head !== tail) {
        const i = Q[head]; head = (head + 1) % cap;
        const lv = (l[i] >> shift) & 15; if (lv <= 1) continue;
        const y = Math.floor(i / STRIDE_Y), rest = i - y * STRIDE_Y, z = Math.floor(rest / W), x = rest - z * W;
        const nb = (j) => {
          if (blocksLight[b[j]]) return;
          if (((l[j] >> shift) & 15) < lv - 1) { l[j] = (l[j] & ~mask) | ((lv - 1) << shift); push(j); }
        };
        if (x > 0) nb(i - 1); if (x < W - 1) nb(i + 1);
        if (z > 0) nb(i - W); if (z < D - 1) nb(i + W);
        if (y > 0) nb(i - STRIDE_Y); if (y < H - 1) nb(i + STRIDE_Y);
      }
    };
    flood(12, 0xF000);
    if (onProgress) onProgress();
    // Colored block light, one channel at a time
    const emitters = [];
    for (let i = 0; i < b.length; i++) { const d = b[i]; if (d && BLOCKS[d].light) emitters.push(i); }
    [[8, 0xF00, 0], [4, 0x0F0, 1], [0, 0x00F, 2]].forEach(([shift, mask, ch]) => {
      head = tail = 0;
      for (const i of emitters) {
        const v = BLOCKS[b[i]].light[ch]; if (!v) continue;
        l[i] = (l[i] & ~mask) | (v << shift); push(i);
      }
      flood(shift, mask);
    });
    Q = null;
    this.dirtyLight = false;
  }
}

// Greedy mesher. Faces merge only when block, AO and light match on all four corners.
const DIRS = [
  { d: 0, s: 1, n: [1, 0, 0], u: 2, v: 1 }, { d: 0, s: -1, n: [-1, 0, 0], u: 2, v: 1 },
  { d: 1, s: 1, n: [0, 1, 0], u: 0, v: 2 }, { d: 1, s: -1, n: [0, -1, 0], u: 0, v: 2 },
  { d: 2, s: 1, n: [0, 0, 1], u: 0, v: 1 }, { d: 2, s: -1, n: [0, 0, -1], u: 0, v: 1 },
];

class Buf {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.lit = []; this.ao = []; this.tex = []; this.ind = []; this.n = 0; }
  quad(p, nor, du, dv, lit, ao, layer, emit) {
    const s = this.n;
    for (let k = 0; k < 4; k++) {
      this.pos.push(p[k][0], p[k][1], p[k][2]);
      this.nor.push(nor[0] * 127, nor[1] * 127, nor[2] * 127);
      this.lit.push(lit[k * 4], lit[k * 4 + 1], lit[k * 4 + 2], lit[k * 4 + 3]);
      this.ao.push(ao[k]); this.tex.push(layer, emit);
    }
    this.uv.push(0, 0, du, 0, du, dv, 0, dv);
    // Flip the diagonal so AO gradients do not crease
    if (ao[0] + ao[2] > ao[1] + ao[3]) this.ind.push(s, s + 1, s + 2, s, s + 2, s + 3);
    else this.ind.push(s + 1, s + 2, s + 3, s + 1, s + 3, s);
    this.n += 4;
  }
  geometry() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Int8BufferAttribute(new Int8Array(this.nor), 3, true));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aL', new THREE.Uint8BufferAttribute(new Uint8Array(this.lit), 4, true));
    g.setAttribute('aAO', new THREE.Uint8BufferAttribute(new Uint8Array(this.ao), 1, true));
    g.setAttribute('aTex', new THREE.Float32BufferAttribute(this.tex, 2));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.ind, 1) : new THREE.Uint16BufferAttribute(this.ind, 1));
    return g;
  }
}

const AO_LEVEL = [255, 200, 150, 105];

export function meshChunk(v, cx, cz) {
  const { b, l } = v;
  const x0 = cx * CHUNK, z0 = cz * CHUNK, x1 = Math.min(W, x0 + CHUNK), z1 = Math.min(D, z0 + CHUNK);
  const opq = BLOCKS.map((d) => d.opaque);
  const kind = BLOCKS.map((d) => d.kind);

  // Vertical extent worth meshing
  let yLo = H, yHi = 0;
  for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
    const col = x + z * W;
    let y = H - 1; while (y > 0 && !b[col + y * STRIDE_Y]) y--;
    if (y > yHi) yHi = y;
    let lo = 0; while (lo < y && opq[b[col + lo * STRIDE_Y]]) lo++;
    if (lo < yLo) yLo = lo;
  }
  yLo = Math.max(0, yLo - 1); yHi = Math.min(H - 1, yHi + 1);
  if (yLo > yHi) return {};

  const buffers = { opaque: new Buf(), glass: new Buf(), water: new Buf() };
  const get = (x, y, z) => (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= H) ? 0 : b[idx(x, y, z)];
  const lit = (x, y, z) => {
    if (x < 0 || z < 0 || x >= W || z >= D || y >= H) return 0xF000;
    if (y < 0) return 0;
    return l[idx(x, y, z)];
  };
  const lo = [x0, yLo, z0], hi = [x1, yHi + 1, z1];

  const ta = new Int32Array(3);
  for (const D_ of DIRS) {
    const { d, s, n, u, v: vv } = D_;
    const su = hi[u] - lo[u], sv = hi[vv] - lo[vv];
    const mId = new Uint8Array(su * sv), mA = new Float64Array(su * sv), mB = new Float64Array(su * sv);
    const vL = new Uint8Array(su * sv * 16), vAO = new Uint8Array(su * sv * 4);
    for (let q = lo[d]; q < hi[d]; q++) {
      mId.fill(0);
      for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
        ta[d] = q; ta[u] = lo[u] + i; ta[vv] = lo[vv] + j;
        const x = ta[0], y = ta[1], z = ta[2];
        const id = b[idx(x, y, z)];
        if (!id) continue;
        const kd = kind[id]; if (kd === 'barrier') continue;
        const nx = x + n[0], ny = y + n[1], nz = z + n[2];
        if (ny < 0) continue;
        const nid = get(nx, ny, nz);
        if (opq[nid]) continue;
        if (kd !== 'opaque' && nid === id) continue;
        if (kd === 'water' && kind[nid] === 'glass') continue;
        if (kd === 'glass' && kind[nid] === 'water') continue;
        // Corner values
        let keyA = 0, keyB = 0; const m = i + j * su;
        for (let c = 0; c < 4; c++) {
          const du = c === 1 || c === 2 ? 1 : -1, dv = c >= 2 ? 1 : -1;
          const o = [nx, ny, nz], o1 = [nx, ny, nz], o2 = [nx, ny, nz], oc = [nx, ny, nz];
          o1[u] += du; o2[vv] += dv; oc[u] += du; oc[vv] += dv;
          const s1 = opq[get(o1[0], o1[1], o1[2])] ? 1 : 0, s2 = opq[get(o2[0], o2[1], o2[2])] ? 1 : 0;
          const sc = opq[get(oc[0], oc[1], oc[2])] ? 1 : 0;
          const ao = (s1 && s2) ? 3 : s1 + s2 + sc;
          // Smooth light across the four cells touching this corner
          let S = 0, R = 0, G = 0, Bl = 0, cnt = 0;
          const add = (a, on) => { if (on) return; const w = lit(a[0], a[1], a[2]); S += w >> 12; R += (w >> 8) & 15; G += (w >> 4) & 15; Bl += w & 15; cnt++; };
          add(o, 0); add(o1, s1); add(o2, s2); add(oc, s1 && s2 ? 1 : sc);
          const k = m * 16 + c * 4;
          const q4 = (val) => Math.round(val / cnt);
          const sv4 = q4(S), rv = q4(R), gv = q4(G), bv = q4(Bl);
          vL[k] = sv4 * 17; vL[k + 1] = rv * 17; vL[k + 2] = gv * 17; vL[k + 3] = bv * 17;
          vAO[m * 4 + c] = AO_LEVEL[ao];
          const packed = (ao | (sv4 << 2) | (rv << 6) | (gv << 10) | (bv << 14));
          if (c < 2) keyA = keyA * 262144 + packed; else keyB = keyB * 262144 + packed;
        }
        mId[m] = id; mA[m] = keyA; mB[m] = keyB;
      }
      // Greedy merge
      for (let j = 0; j < sv; j++) for (let i = 0; i < su;) {
        const m = i + j * su, id = mId[m];
        if (!id) { i++; continue; }
        const kA = mA[m], kB = mB[m];
        let w = 1; while (i + w < su && mId[m + w] === id && mA[m + w] === kA && mB[m + w] === kB) w++;
        let h = 1;
        outer: for (; j + h < sv; h++) for (let k = 0; k < w; k++) {
          const t = m + k + h * su;
          if (mId[t] !== id || mA[t] !== kA || mB[t] !== kB) break outer;
        }
        for (let a = 0; a < h; a++) for (let c = 0; c < w; c++) mId[m + c + a * su] = 0;
        const depth = s > 0 ? q + 1 : q;
        const uA = lo[u] + i, vA = lo[vv] + j;
        const corner = (cu, cv) => {
          const p = [0, 0, 0]; p[d] = depth; p[u] = cu; p[vv] = cv;
          return [p[0] + WORLD.X0, p[1], p[2] + WORLD.Z0];
        };
        let P = [corner(uA, vA), corner(uA + w, vA), corner(uA + w, vA + h), corner(uA, vA + h)];
        const li = vL.subarray(m * 16, m * 16 + 16); const a4 = vAO.subarray(m * 4, m * 4 + 4);
        const def = BLOCKS[id];
        const layer = n[1] > 0 ? def.top : n[1] < 0 ? def.bottom : def.side;
        // Keep winding facing outward
        const ax = [0, 0, 0], ay = [0, 0, 0]; ax[u] = 1; ay[vv] = 1;
        const cross = [ax[1] * ay[2] - ax[2] * ay[1], ax[2] * ay[0] - ax[0] * ay[2], ax[0] * ay[1] - ax[1] * ay[0]];
        const flip = cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] < 0;
        const bufs = kind[id] === 'water' ? buffers.water : kind[id] === 'glass' ? buffers.glass : buffers.opaque;
        const tileV = (d === 1) ? h : h;
        if (flip) {
          const R = [P[1], P[0], P[3], P[2]];
          const L = [li[4], li[5], li[6], li[7], li[0], li[1], li[2], li[3], li[12], li[13], li[14], li[15], li[8], li[9], li[10], li[11]];
          bufs.quad(R, n, w, tileV, L, [a4[1], a4[0], a4[3], a4[2]], layer, def.emit);
        } else bufs.quad(P, n, w, tileV, li, a4, layer, def.emit);
        i += w;
      }
    }
  }
  return { opaque: buffers.opaque.geometry(), glass: buffers.glass.geometry(), water: buffers.water.geometry() };
}

// Materials: three's Lambert with baked sky and colored light mixed in.
export function makeVoxelMaterials(texture, shared) {
  const patch = (mat, opts = {}) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uBlocks = { value: texture };
      sh.uniforms.uTime = shared.uTime;
      sh.uniforms.uBlockGain = shared.uBlockGain;
      sh.vertexShader = `attribute vec4 aL; attribute float aAO; attribute vec2 aTex; varying vec4 vL; varying float vAO; varying vec2 vTex; varying vec2 vTUv; uniform float uTime;\n` + sh.vertexShader
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vL = aL; vAO = aAO; vTex = aTex; vTUv = uv;${opts.water ? `
          transformed.y += (normal.y > 0.5 ? sin(position.x * 0.9 + uTime * 1.7) * 0.035 + cos(position.z * 1.1 + uTime * 1.3) * 0.035 - 0.1 : 0.0);` : ''}`);
      sh.fragmentShader = `precision highp sampler2DArray; uniform sampler2DArray uBlocks; uniform float uTime; uniform float uBlockGain; varying vec4 vL; varying float vAO; varying vec2 vTex; varying vec2 vTUv;\n` + sh.fragmentShader
        .replace('#include <map_fragment>', `
          vec2 tuv = vTUv;${opts.water ? ' tuv += vec2(sin(uTime * 0.35 + vTUv.y * 2.0) * 0.08, uTime * 0.05);' : ''}
          vec4 tx = texture(uBlocks, vec3(tuv, floor(vTex.x + 0.5)));
          ${opts.alpha ? '' : 'if (tx.a < 0.5) discard;'}
          diffuseColor.rgb *= tx.rgb; ${opts.alpha ? 'diffuseColor.a *= tx.a;' : ''}`)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
          float skyL = vL.x;
          float skyB = pow(skyL, 1.7);
          reflectedLight.directDiffuse *= smoothstep(0.55, 0.95, skyL);
          reflectedLight.indirectDiffuse *= (0.09 + 0.91 * skyB) * vAO;
          reflectedLight.directDiffuse *= mix(1.0, vAO, 0.6);
          vec3 blockL = pow(vL.yzw, vec3(1.6)) * uBlockGain;
          reflectedLight.indirectDiffuse += diffuseColor.rgb * blockL * vAO;
          totalEmissiveRadiance += diffuseColor.rgb * vTex.y;`);
    };
    mat.customProgramCacheKey = () => 'vox' + (opts.water ? 'W' : '') + (opts.alpha ? 'A' : '');
    return mat;
  };
  return {
    opaque: patch(new THREE.MeshLambertMaterial({ color: 0xffffff })),
    glass: patch(new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide }), { alpha: true }),
    water: patch(new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide }), { alpha: true, water: true }),
  };
}

// Props (doors, trains, screens) get the same baked light, sampled at their position.
export function litProp(color, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ color, ...opts });
  mat.userData.env = { uEnvSky: { value: 1 }, uEnvBlock: { value: new THREE.Vector3() } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uEnvSky = mat.userData.env.uEnvSky; sh.uniforms.uEnvBlock = mat.userData.env.uEnvBlock;
    sh.fragmentShader = `uniform float uEnvSky; uniform vec3 uEnvBlock;\n` + sh.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
      reflectedLight.directDiffuse *= smoothstep(0.55, 0.95, uEnvSky);
      reflectedLight.indirectDiffuse *= 0.3 + 0.7 * pow(uEnvSky, 1.7);
      reflectedLight.indirectDiffuse += diffuseColor.rgb * pow(uEnvBlock, vec3(1.6)) * 1.5;`);
  };
  mat.customProgramCacheKey = () => 'propLit';
  mat.setEnv = (L) => { mat.userData.env.uEnvSky.value = L.sky; mat.userData.env.uEnvBlock.value.set(L.r, L.g, L.b); };
  return mat;
}
