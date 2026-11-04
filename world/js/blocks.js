// Block table and procedurally painted textures. Everything is drawn in code, no outside art.
import * as THREE from 'three';

const T = 32;
const layers = [];
const layerIndex = new Map();

function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const seedOf = (name) => { let s = 7; for (const c of name) s = (s * 31 + c.charCodeAt(0)) | 0; return s; };
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const shade = (rgb, f) => [rgb[0] * f, rgb[1] * f, rgb[2] * f];

// Pattern painters: (x, y, seed) => [r, g, b, a?]
const P = {
  noise: (c, amp = 0.08) => { const b = hex(c); return (x, y, s) => shade(b, 1 + (hash(x, y, s) - 0.5) * amp * 2); },
  speck: (c, d, amt = 0.12) => { const b = hex(c), e = hex(d); return (x, y, s) => { const r = hash(x, y, s); return shade(r < amt ? e : b, 1 + (hash(y, x, s) - 0.5) * 0.08); }; },
  brick: (c, mortar, w = 16, h = 8) => {
    const b = hex(c), m = hex(mortar);
    return (x, y, s) => {
      const row = Math.floor(y / h), off = row % 2 ? w / 2 : 0, xx = (x + off) % w;
      if (y % h === h - 1 || xx === w - 1) return m;
      const id = Math.floor((x + off) / w) + row * 17;
      return shade(b, 0.93 + hash(id, row, s) * 0.14 + (hash(x, y, s) - 0.5) * 0.05);
    };
  },
  block: (c, line, n = 16) => {
    const b = hex(c), l = hex(line);
    return (x, y, s) => (x % n === 0 || y % n === 0) ? l : shade(b, 0.96 + hash(Math.floor(x / n), Math.floor(y / n), s) * 0.08 + (hash(x, y, s) - 0.5) * 0.06);
  },
  plank: (c, n = 8) => {
    const b = hex(c);
    return (x, y, s) => {
      const r = Math.floor(y / n);
      if (y % n === n - 1) return shade(b, 0.62);
      return shade(b, 0.9 + hash(r, 3, s) * 0.2 + Math.sin((x + r * 13) * 0.45 + hash(r, 9, s) * 6) * 0.03);
    };
  },
  checker: (a, c, n = 16) => { const A = hex(a), C = hex(c); return (x, y, s) => shade(((x >> 0) / n | 0) % 2 === ((y / n | 0) % 2) ? A : C, 1 + (hash(x, y, s) - 0.5) * 0.03); },
  flat: (c) => { const b = hex(c); return () => b; },
  carpet: (c, d) => { const b = hex(c), e = hex(d); return (x, y, s) => hash(x, y, s) < 0.45 ? shade(b, 0.96 + hash(y, x, s) * 0.1) : shade(e, 0.96 + hash(y, x, s) * 0.1); },
  leaves: (c, d) => { const b = hex(c), e = hex(d); return (x, y, s) => { const r = hash(Math.floor(x / 2), Math.floor(y / 2), s); return shade(r < 0.3 ? e : b, 0.85 + r * 0.3); }; },
  led: (c) => { const b = hex(c); return (x, y) => { const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)) / 16; return shade(b, 1 - d * d * 0.35); }; },
  glass: (c, a = 90) => { const b = hex(c); return (x, y) => { const e = x < 1 || y < 1 || x > 30 || y > 30; const g = (x + y) % 22 < 2 && (x + y) > 8; return e ? [...shade(b, 0.8), 170] : [...shade(b, g ? 1.25 : 1), g ? a + 50 : a]; }; },
  water: () => (x, y, s) => { const n = hash(x >> 1, y >> 1, s); return [36 + n * 16, 150 + n * 26, 225 + n * 20, 170]; },
  ladder: (c) => { const b = hex(c); return (x, y) => (x < 5 || x > 26) ? shade(b, 0.8) : (y % 10 < 3 ? b : [0, 0, 0, 0]); },
  rail: (c) => { const b = hex(c); return (x, y) => (y < 4) ? b : (x % 16 < 3 ? shade(b, 0.9) : [0, 0, 0, 0]); },
  chain: (c) => { const b = hex(c); return (x, y) => ((x + y) % 8 < 1 || (x - y + 64) % 8 < 1) ? b : [0, 0, 0, 0]; },
  grassSide: (g, d) => { const G = hex(g), D = hex(d); return (x, y, s) => (y < 5 + hash(x, 1, s) * 4) ? shade(G, 0.92 + hash(x, y, s) * 0.14) : shade(D, 0.92 + hash(x, y, s) * 0.14); },
  grass: (c) => { const b = hex(c); return (x, y, s) => { const r = hash(x, y, s); return shade(b, 0.93 + r * 0.14 + (hash(x >> 2, y >> 2, s) - 0.5) * 0.06); }; },
  stripe: (a, b2, n = 8) => { const A = hex(a), C = hex(b2); return (x, y) => (((x + y) / n | 0) % 2 ? A : C); },
  shelf: () => (x, y, s) => {
    if (y % 16 < 2 || x < 2 || x > 29) return [70, 44, 26];
    const k = Math.floor(x / 3), r = Math.floor(y / 16);
    const c = [[148, 40, 48], [44, 72, 140], [50, 110, 70], [178, 138, 50], [90, 50, 120]][Math.floor(hash(k, r, s) * 5)];
    return (y % 16) < 4 + hash(k, r + 3, s) * 5 ? [34, 22, 14] : shade(c, 0.85 + (x % 3 === 0 ? -0.3 : 0.15));
  },
  stars: () => (x, y, s) => hash(x, y, s) > 0.985 ? [255, 255, 240] : [8, 10, 26],
  speaker: () => (x, y) => { const d = Math.hypot(x - 15.5, y - 15.5); if (d < 4) return [90, 90, 96]; if (d < 11) return [14, 14, 16]; if (d < 12.5) return [150, 150, 158]; return [36, 36, 42]; },
  gold: () => (x, y, s) => { const n = hash(x >> 1, y >> 1, s); const e = x < 1 || y < 1; return e ? [176, 118, 20] : [240 + n * 15, 188 + n * 30, 44 + n * 30]; },
};

const defs = [];
export const B = { air: 0 };
defs[0] = { name: 'air', solid: false, kind: 'air', opaque: false };

function tex(name, painter) {
  if (layerIndex.has(name)) return layerIndex.get(name);
  const s = seedOf(name), data = new Uint8Array(T * T * 4);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = painter(x, y, s), i = ((T - 1 - y) * T + x) * 4;
    data[i] = Math.min(255, Math.max(0, v[0])); data[i + 1] = Math.min(255, Math.max(0, v[1])); data[i + 2] = Math.min(255, Math.max(0, v[2])); data[i + 3] = v.length > 3 ? v[3] : 255;
  }
  layers.push(data); layerIndex.set(name, layers.length - 1); return layers.length - 1;
}

// kinds: opaque, cutout (alpha holes, still solid unless solid:false), glass, water, barrier
function def(name, painter, o = {}) {
  const id = defs.length; const kind = o.kind || 'opaque';
  const main = tex(name, painter);
  defs[id] = {
    name, kind, solid: o.solid !== undefined ? o.solid : (kind !== 'water'), opaque: kind === 'opaque',
    top: o.top ? tex(name + '_top', o.top) : main, side: main, bottom: o.bottom ? tex(name + '_bot', o.bottom) : main,
    emit: o.emit || 0, light: o.light || null, climb: !!o.climb, map: o.map,
  };
  B[name] = id; return id;
}

// Ground
def('grass', P.grassSide(0x6fc05a, 0x7a5a3c), { top: P.grass(0x6fc05a), bottom: P.speck(0x7a5a3c, 0x634830), map: 0x6fc05a });
def('grass2', P.grassSide(0x62b250, 0x7a5a3c), { top: P.grass(0x62b250), bottom: P.speck(0x7a5a3c, 0x634830), map: 0x62b250 });
def('dirt', P.speck(0x7a5a3c, 0x634830), { map: 0x7a5a3c });
def('sand', P.speck(0xe6d3a0, 0xd6c088, 0.25), { map: 0xe6d3a0 });
def('gravel', P.speck(0xb6b0a4, 0x8e887c, 0.3), { map: 0xb6b0a4 });
def('asphalt', P.speck(0x34363c, 0x2a2c30, 0.3), { map: 0x34363c });
def('roadline', P.noise(0xf0efe8, 0.03), { map: 0xf0efe8 });
def('ballast', P.speck(0x6e665e, 0x4e4842, 0.35), { map: 0x6e665e });
def('concrete', P.noise(0xb4b4b0, 0.05), { map: 0xb4b4b0 });
def('deck', P.block(0xd8d2c2, 0xc2bcac, 16), { map: 0xd8d2c2 });
// Stone
def('pyr1', P.brick(0xd7bf8c, 0xb39a68, 32, 16), { map: 0xd7bf8c });
def('pyr2', P.brick(0xc8ae7a, 0xa78e5c, 32, 16), { map: 0xc8ae7a });
def('stone', P.block(0xa79f8e, 0x8c8474, 16), { map: 0xa79f8e });
def('blueStone', P.block(0x2a56a8, 0x1e3e80, 16), { map: 0x2a56a8 });
// House
def('brick', P.brick(0xf2eadb, 0xd8ceba), { map: 0xf2eadb });
def('stucco', P.noise(0xeef1f6, 0.025), { map: 0xeef1f6 });
def('trim', P.block(0xffffff, 0xe6e8ee, 32), { map: 0xffffff });
def('roof', P.brick(0x5a6c8e, 0x4a5a78, 16, 8), { map: 0x5a6c8e });
def('roofDeck', P.block(0x7f8ba2, 0x6c788e, 16), { map: 0x7f8ba2 });
def('oak', P.plank(0xb98a56), { map: 0xb98a56 });
def('walnut', P.plank(0x5a3a24), { map: 0x5a3a24 });
def('marble', P.checker(0xf3f0ea, 0x262a34, 16), { map: 0xe0dcd4 });
def('marbleW', P.block(0xf2efe8, 0xdcd8d0, 16), { map: 0xf2efe8 });
def('redCarpet', P.carpet(0xb3202e, 0x9c1a26), { map: 0xb3202e });
def('gold', P.gold(), { map: 0xf5c518 });
def('steel', P.noise(0xaab0ba, 0.04), { map: 0xaab0ba });
def('black', P.noise(0x16171c, 0.05), { map: 0x16171c });
def('navy', P.noise(0x1d2a4e, 0.05), { map: 0x1d2a4e });
def('catYellow', P.noise(0xf0b81a, 0.04), { map: 0xf0b81a });
def('hazard', P.stripe(0xf0b81a, 0x1a1a1a), { map: 0xf0b81a });
def('red', P.noise(0xc8252f, 0.04), { map: 0xc8252f });
def('white', P.noise(0xf4f4f6, 0.02), { map: 0xf4f4f6 });
def('lumber', P.plank(0xd6ae72, 16), { map: 0xd6ae72 });
// Fabrics and room themes
def('blueWall', P.noise(0x1f4fa8, 0.03), { map: 0x1f4fa8 });
def('skyWall', P.noise(0x8fc4e8, 0.03), { map: 0x8fc4e8 });
def('dungeon', P.brick(0x3a0e12, 0x220608), { map: 0x3a0e12 });
def('velvet', P.carpet(0x4b2178, 0x421c6a), { map: 0x4b2178 });
def('felt', P.carpet(0xe2d6bd, 0xd4c8ae), { map: 0xe2d6bd });
def('orange', P.plank(0xe8701c), { map: 0xe8701c });
def('rug', P.stripe(0x9c2c28, 0xd9a441, 6), { map: 0x9c2c28 });
def('arcadeRug', P.speck(0x14122a, 0xe6339a, 0.08), { map: 0x14122a });
def('teal', P.carpet(0x1f8a86, 0x1a7a76), { map: 0x1f8a86 });
def('pink', P.carpet(0xe85d9a, 0xd8508c), { map: 0xe85d9a });
def('cream', P.carpet(0xece2cc, 0xe2d8c2), { map: 0xece2cc });
def('charcoal', P.carpet(0x2b2d36, 0x24262e), { map: 0x2b2d36 });
def('sofa', P.carpet(0x4a6a8e, 0x406084), { map: 0x4a6a8e });
def('seat', P.carpet(0x9e1c2a, 0x861622), { map: 0x9e1c2a });
def('pillow', P.noise(0xf6f2ea, 0.02), { map: 0xf6f2ea });
def('shelf', P.shelf(), { map: 0x5a3a24 });
def('speaker', P.speaker(), { map: 0x1a1a1a });
def('tire', (x, y) => { const d = Math.hypot(x - 15.5, y - 15.5); if (d < 6) return [70, 72, 78]; if (d < 15) return [20 + (Math.floor(Math.atan2(y - 15.5, x - 15.5) * 6) % 2) * 9, 20, 22]; return [34, 34, 38]; }, { map: 0x202024 });
def('pegboard', (x, y) => { const tool = (x > 4 && x < 8 && y > 4 && y < 26) ? [190, 40, 40] : (x > 13 && x < 17 && y > 6 && y < 24) ? [170, 175, 185] : (x > 22 && x < 27 && y > 8 && y < 16) ? [235, 180, 30] : null; if (tool) return tool; return (x % 4 === 1 && y % 4 === 1) ? [120, 96, 70] : [186, 158, 120]; }, { map: 0xba9e78 });
const seatTex = (c, back) => { const C = hex(c), K = hex(back); return (x, y) => { const m = x % 16; if (m < 1 || m > 14) return [24, 26, 32]; return y < 14 ? shade(K, 0.9 + (y / 14) * 0.2) : y < 26 ? shade(C, 1.05) : [34, 36, 42]; }; };
def('seatBlue', seatTex(0x1f6bff, 0x1a52c2), { map: 0x1f6bff });
def('seatGold', seatTex(0xf5c518, 0xc99f10), { map: 0xf5c518 });
def('turf', P.grass(0x3fa34a), { map: 0x3fa34a });
def('turf2', P.grass(0x38953f), { map: 0x38953f });
def('locker', (x, y) => { if (x < 1 || x > 30) return [14, 22, 50]; const v = y > 4 && y < 12 && y % 2 === 0 && x > 8 && x < 24; const h = x > 25 && x < 28 && y > 14 && y < 20; if (h) return [230, 190, 40]; return v ? [20, 34, 80] : [34, 72, 170]; }, { map: 0x2248aa });
def('courtWood', P.plank(0xd8a868, 16), { map: 0xd8a868 });
def('courtLine', P.noise(0xfafafa, 0.01), { map: 0xfafafa });
def('courtBlue', P.plank(0x2a62c4, 16), { map: 0x2a62c4 });
// Plants
def('bark', P.plank(0x6a4a30, 5), { map: 0x6a4a30 });
def('leaf', P.leaves(0x4fa04a, 0x3c8a3c), { map: 0x4fa04a });
def('leaf2', P.leaves(0x63b34e, 0x4f9f42), { map: 0x63b34e });
def('hedge', P.leaves(0x2f7a3c, 0x266a32), { map: 0x2f7a3c });
def('palm', P.leaves(0x3ea85a, 0x2e8e4a), { map: 0x3ea85a });
// See-through
def('glass', P.glass(0x6fa8dc, 175), { kind: 'glass', map: 0x6fa8dc });
def('glassDark', P.glass(0x20304c, 150), { kind: 'glass', map: 0x304060 });
def('water', P.water(), { kind: 'water', solid: false, map: 0x35a3e0 });
def('rail', P.rail(0xf4f4f6), { kind: 'cutout', map: 0xdddddd });
def('railGold', P.rail(0xf5c518), { kind: 'cutout', map: 0xf5c518 });
def('fence', P.chain(0x9aa0aa), { kind: 'cutout', map: 0x9aa0aa });
def('ladder', P.ladder(0xf0b81a), { kind: 'cutout', solid: false, climb: true, map: 0xf0b81a });
def('barrier', P.flat(0xffffff), { kind: 'barrier', map: null });
def('glow', P.flat(0xffffff), { kind: 'barrier', solid: false, light: [9, 9, 8], map: null });
// Glowing
def('ledBlue', P.led(0x4aa8ff), { emit: 1.5, light: [3, 7, 15], map: 0x4aa8ff });
def('ledRed', P.led(0xff3044), { emit: 1.6, light: [15, 2, 3], map: 0xff3044 });
def('ledPurple', P.led(0xb45cff), { emit: 1.5, light: [10, 4, 15], map: 0xb45cff });
def('ledPink', P.led(0xff4fb0), { emit: 1.5, light: [15, 4, 10], map: 0xff4fb0 });
def('ledGreen', P.led(0x48f08c), { emit: 1.5, light: [3, 15, 8], map: 0x48f08c });
def('lamp', P.led(0xfff0d8), { emit: 1.2, light: [14, 13, 11], map: 0xffe2a8 });
def('panel', P.led(0xf4f8ff), { emit: 1.2, light: [14, 14, 15], map: 0xf4f8ff });
def('torch', P.led(0xff9a30), { emit: 1.6, light: [15, 9, 3], map: 0xff9a30 });
def('poolLight', P.led(0x70e0ff), { emit: 1.4, light: [4, 13, 15], map: 0x70e0ff });
def('starCeil', P.stars(), { emit: 1.2, map: 0x0a0c20 });
def('bounce', P.stripe(0x76f03c, 0x2a8a14, 8), { emit: 0.6, light: [3, 10, 2], map: 0x76f03c });
def('screen', P.flat(0x0a0a10), { map: 0x0a0a10 });
const disco = [0xe0347a, 0x2ea6e0, 0xf0c028, 0x8a4ce0, 0x2cc48a, 0xe86a28];
disco.forEach((c, i) => def('disco' + i, P.block(c, 0x101018, 32), { emit: 0.55, map: c }));

export const BLOCKS = defs;

export function isSolid(id) { return defs[id].solid; }

export function buildTextureArray() {
  const n = layers.length, all = new Uint8Array(T * T * 4 * n);
  layers.forEach((d, i) => all.set(d, i * T * T * 4));
  const t = new THREE.DataArrayTexture(all, T, T, n);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
