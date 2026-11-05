// Every follower we have a picture of, standing somewhere on the property. Reuses the crowd from tools/world_capture/residents.js.
// People are merged into a mesh per patch of ground, so the whole crowd costs a few draw calls and no collision: nobody can ever block the player.
// Nobody goes in the owners' rooms, and nobody stands on roads, tracks, carpets or right next to something you can use.
import * as THREE from 'three';

const SHIRTS = [0xe0347a, 0x2ea6e0, 0x34e070, 0xf5c518, 0xff7a30, 0x9c5cff, 0xf4f4f6, 0x1f6bff, 0xc8252f, 0x20c0a0];
const PANTS = [0x1d2a4e, 0x20222a, 0x4a3320, 0x3a3f4a];
const HAIR = [0x20140c, 0x3a2412, 0x6b4a22, 0x111111, 0xb08a3c];
const LEG = 0.55, BODY = 0.62, HEAD = 0.78, PATCH = 70, PHONE_RANGE = 240;
const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function placeEveryone(game, data, total) {
  const { V } = game, { spots, W, G } = data, S = spots.pyramids, rand = rng(1000), out = [], grid = new Set();
  const BLK = game.blocks, NO_STAND = new Set(['asphalt', 'roadline', 'ballast', 'gravel', 'rail', 'railGold', 'redCarpet', 'hazard', 'water', 'barrier', 'bounce', 'turf', 'turf2', 'courtWood', 'courtLine', 'courtBlue', 'seat', 'sofa', 'black', 'red', 'lumber', 'stone', 'concrete', 'walnut', 'steel']);
  const solid = (x, y, h) => V.solidW(x, G + h, -y);
  const floorAt = (x, y, top = 2.5) => { for (let h = top; h > -3; h -= 0.25) if (solid(x, y, h - 0.01)) return h; return 0; };
  const open = (x, y) => { for (let h = 3; h < 45; h += 1) if (solid(x, y, h)) return false; return true; };
  const clear = (x, y, h) => !solid(x, y, h + 0.5) && !solid(x, y, h + 1.5);
  const okFloor = (x, y, h) => !NO_STAND.has(BLK[V.getW(x, G + h - 0.01, -y)]?.name);
  const fixed = game.entities.filter((e) => !e.dyn).map((e) => e.pos.clone());
  const doors = [...spots.roomDoors, spots.frontDoor, spots.partyDoor].filter(Boolean).map((d) => [d.x + (d.w || 0) / 2, d.y]);
  const inTheWay = (x, y, h) => fixed.some((p) => Math.hypot(p.x - x, p.z + y) < 3 && Math.abs(p.y - G - h) < 5) || doors.some(([a, b]) => Math.hypot(a - x, b - y) < 4);
  const roomy = (x, y, h) => { for (const [a, b] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) if (solid(x + a, y + b, h + 0.3) || solid(x + a, y + b, h + 1.2)) return false; return true; }; // Shoulders clear of walls
  const forSale = (x, y) => { const [u, v] = W[7].local(x, y); return u > 14 && u < 47 && v > -1 && v < 28; }; // The open rooms stay empty, and nobody stands in front of their signs
  const blocksPaidWall = (x, y) => y > 12 && y < 22 && (Math.abs(x + 21) < 9 || Math.abs(x - 8) < 9); // Keeps the Supporter and Forever Walls readable
  const take = (x, y, h, yaw, onSteps) => { if (forSale(x, y) || blocksPaidWall(x, y)) return false; if (!onSteps && !roomy(x, y, h)) return false; const k = `${Math.round(x / 1.3)},${Math.round(y / 1.3)},${Math.round(h / 2)}`; if (grid.has(k) || !okFloor(x, y, h) || inTheWay(x, y, h)) return false; grid.add(k); out.push({ x, y, h, yaw }); return true; };
  const facing = (x, y, tx, ty, wob = 0.7) => Math.atan2(tx - x, ty - y) + (rand() - 0.5) * wob;
  const fill = (n, gen) => { let got = 0, tries = 0; while (got < n && out.length < total && tries++ < n * 300) { const s = gen(); if (s && take(s[0], s[1], s[2], s[3], s[4])) got++; } return got; };
  const gauss = () => (rand() + rand() + rand() + rand() - 2) * 1.2;
  const outdoors = (x, y) => { const h = floorAt(x, y); return Math.abs(h) > 0.6 || !clear(x, y, h) || !open(x, y) ? null : h; };

  // Groups, not an even sprinkle: the property is huge, so people read as a crowd only when they gather.
  const lawn = [[-22, -40], [12, -40], [-30, -60], [18, -62], [-16, -80], [8, -82], [-50, -48], [42, -50], [-44, -76], [36, -78]];
  const onLawn = (x, y) => { if (Math.abs(x + 5) < 4.5 || Math.hypot(x + 6, y + 19) < 13) return null; const h = outdoors(x, y); return h === null ? null : [x, y, h, facing(x, y, -6, -100, 1.6)]; };
  fill(285, () => { const c = lawn[Math.floor(rand() * rand() * lawn.length)]; return onLawn(c[0] + gauss() * 11, c[1] + gauss() * 9); });
  const house = [[-50, -6], [38, -6], [-80, 14], [66, 14], [-34, 96], [30, 96]];
  fill(85, () => { const c = house[Math.floor(rand() * house.length)], x = c[0] + gauss() * 12, y = c[1] + gauss() * 8; if (y < 9 && x > -36 && x < 26) return null; const h = outdoors(x, y); return h === null ? null : [x, y, h, facing(x, y, x, -40, 1.8)]; });
  // Along the Speedway, and watching the festival stage
  const path = spots.track.path;
  fill(45, () => { const i = Math.floor(rand() * path.length), a = path[i], b = path[(i + 4) % path.length], l = Math.hypot(b.x - a.x, b.y - a.y) || 1, side = rand() < 0.5 ? 1 : -1, off = 9 + rand() * 7; const x = a.x - (b.y - a.y) / l * off * side, y = a.y + (b.x - a.x) / l * off * side, h = outdoors(x, y); return h === null ? null : [x, y, h, facing(x, y, a.x, a.y, 0.8)]; });
  fill(80, () => { const x = 121 + gauss() * 20, y = 74 + gauss() * 12, h = outdoors(x, y); return h === null ? null : [x, y, h, facing(x, y, 121, 110, 0.5)]; });
  // Dancing in the Party Room
  fill(35, () => { const t = rand() * 6.28, q = 2 + rand() * 12, x = -6 + Math.cos(t) * q, y = 112 + Math.sin(t) * q, h = floorAt(x, y, 3); return h < -0.6 || h > 1.2 || !clear(x, y, h) ? null : [x, y, h, rand() * 6.28]; });
  // At Giza, then up the pyramids
  fill(70, () => { const P = S.khufu, x = P.x + gauss() * 42, y = P.y - P.half - 4 - rand() * 18, h = outdoors(x, y); return h === null ? null : [x, y, h, facing(x, y, P.x, P.y - 200, 1.2)]; });
  fill(175, () => {
    const roll = rand(), P = roll < 0.78 ? S.khufu : roll < 0.93 ? S.khafre : S.menkaure, top = rand() < 0.14, m = P.half - 3, along = (rand() * 2 - 1) * m, depth = top ? 6 * rand() : rand() * m;
    const x = Math.floor(P.x + (top ? (rand() * 2 - 1) * 6 : along)) + 0.5, y = Math.floor(P.y - depth) + 0.5, h = floorAt(x, y, 60);
    return h < 1 || !clear(x, y, h) ? null : [x, y, h, Math.PI + (rand() - 0.5) * 0.8, true];
  });
  // Indoors: edges of the foyer and the public rooms in the wings, ground floor only
  const wings = [[3, 2, 14], [5, 18, 32], [7, 2, 14], [3, 34, 55]]; // Wing 7 is the kitchen only: its other two rooms are for sale and stay empty
  fill(126, () => {
    let x, y;
    if (rand() < 0.32) { x = -20 + rand() * 28; y = 14 + rand() * 30; if (x > -11 && x < -2) return null; if (y > 22 && y < 29) return null; } // Keep the main aisles open
    else { const R = wings[Math.floor(rand() * wings.length)], w = W[R[0]], p = w.P(R[1] + rand() * (R[2] - R[1]), 2 + rand() * (w.width - 4)); x = p[0]; y = p[1]; }
    if (open(x, y)) return null;
    const h = floorAt(x, y, 6); return h < -0.6 || h > 1 || !clear(x, y, h) ? null : [x, y, h, rand() * 6.28];
  });
  // Everyone else finds a spot on the lawns. Nobody gets left out.
  for (let spread = 16; out.length < total && spread < 200; spread += 8) fill(total - out.length, () => { const c = lawn[Math.floor(rand() * lawn.length)]; return onLawn(c[0] + gauss() * spread, c[1] + gauss() * spread); });
  return out;
}

const buildCell = (people, cols, rows) => {
  const body = { p: [], c: [], ph: [] }, face = { p: [], uv: [], ph: [] }, tmp = new THREE.Color();
  const quad = (A, a, b, c, d) => A.push(...a, ...b, ...c, ...a, ...c, ...d);
  const box = (o, hex, cx, cy, cz, w, h, dp) => {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy, y1 = cy + h, z0 = cz - dp / 2, z1 = cz + dp / 2;
    const put = (shade, a, b, c, d) => { const n = o.place([a, b, c, d]); quad(body.p, n[0], n[1], n[2], n[3]); tmp.setHex(hex); for (let i = 0; i < 6; i++) { body.c.push(tmp.r * shade, tmp.g * shade, tmp.b * shade); body.ph.push(o.ph); } };
    put(0.95, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); put(0.68, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    put(0.8, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); put(0.8, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    put(1, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
  };
  for (const s of people) {
    const i = s.i, cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), ph = i * 2.399;
    const place = (pts) => pts.map(([x, y, z]) => [s.x + x * cy + z * sy, s.h + y, -s.y - x * sy + z * cy]);
    const o = { place, ph }, shirt = SHIRTS[i % 10], pants = PANTS[(i * 7) % 4], hair = HAIR[(i * 3) % 5];
    box(o, pants, -0.15, 0, 0, 0.24, LEG, 0.28); box(o, pants, 0.15, 0, 0, 0.24, LEG, 0.28);
    box(o, shirt, 0, LEG, 0, 0.62, BODY, 0.34); box(o, shirt, -0.42, LEG + 0.08, 0, 0.18, BODY - 0.1, 0.22); box(o, shirt, 0.42, LEG + 0.08, 0, 0.18, BODY - 0.1, 0.22);
    const hy = LEG + BODY, H = HEAD / 2; box(o, hair, 0, hy + HEAD - 0.001, 0, HEAD, 0.04, HEAD);
    const col = i % cols, row = Math.floor(i / cols), u0 = col / cols + 0.002, u1 = (col + 1) / cols - 0.002, v1 = 1 - row / rows - 0.002, v0 = 1 - (row + 1) / rows + 0.002;
    const side = (a, b, c, d) => { const n = place([a, b, c, d]); quad(face.p, n[0], n[1], n[2], n[3]); face.uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1); for (let k = 0; k < 6; k++) face.ph.push(ph); };
    const y0 = hy, y1 = hy + HEAD;
    side([-H, y0, H], [H, y0, H], [H, y1, H], [-H, y1, H]); side([H, y0, -H], [-H, y0, -H], [-H, y1, -H], [H, y1, -H]);
    side([H, y0, H], [H, y0, -H], [H, y1, -H], [H, y1, H]); side([-H, y0, -H], [-H, y0, H], [-H, y1, H], [-H, y1, -H]);
  }
  return { body, face };
};

export function buildResidents(game, data, H) {
  const { scene, player } = game, { G } = data, { faces, facesData, tick } = H, { cols, rows, names } = facesData;
  const started = performance.now();
  const spots = placeEveryone(game, data, names.length);
  spots.forEach((s, i) => { s.i = i; });

  const uT = { value: 0 };
  const hop = (m) => { m.onBeforeCompile = (sh) => { sh.uniforms.uT = uT; sh.vertexShader = 'attribute float aPh; uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.y += abs(sin(uT * 4.5 + aPh)) * 0.16;'); }; return m; };
  const bodyMat = hop(new THREE.MeshBasicMaterial({ vertexColors: true })), faceMat = hop(new THREE.MeshBasicMaterial({ map: faces }));

  const cells = new Map();
  for (const s of spots) { const k = `${Math.floor(s.x / PATCH)},${Math.floor(s.y / PATCH)}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(s); }
  const meshes = [], low = game.lowPower;
  for (const people of cells.values()) {
    const b = buildCell(people, cols, rows);
    const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(b.body.p, 3)); g1.setAttribute('color', new THREE.Float32BufferAttribute(b.body.c, 3)); g1.setAttribute('aPh', new THREE.Float32BufferAttribute(b.body.ph, 1));
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(b.face.p, 3)); g2.setAttribute('uv', new THREE.Float32BufferAttribute(b.face.uv, 2)); g2.setAttribute('aPh', new THREE.Float32BufferAttribute(b.face.ph, 1));
    for (const [g, mat] of [[g1, bodyMat], [g2, faceMat]]) { g.computeBoundingSphere(); g.boundingSphere.radius += 1; const m = new THREE.Mesh(g, mat); m.position.y = G; m.castShadow = !low; scene.add(m); meshes.push(m); }
  }

  // Night dims the crowd with everything else. Phones skip drawing far-away patches: everyone's still there when you get close.
  let cullT = 0;
  tick((dt, t) => {
    uT.value = t;
    const n = game.skyU ? game.skyU.night.value : 0, shade = 1 - 0.68 * n; bodyMat.color.setScalar(shade); faceMat.color.setScalar(shade);
    if (low) { cullT -= dt; if (cullT <= 0) { cullT = 0.5; for (const m of meshes) { const c = m.geometry.boundingSphere; m.visible = Math.hypot(c.center.x - player.pos.x, c.center.z - player.pos.z) < PHONE_RANGE + c.radius; } } }
  });

  // Look right at someone to see who they are
  let nameT = 0, shown = null; const dir = new THREE.Vector3();
  game.residentLabel = (dt) => {
    nameT -= dt; if (nameT > 0) return shown; nameT = 0.15; shown = null;
    const cam = game.camera; cam.getWorldDirection(dir); let best = 0.992;
    for (const s of spots) {
      const dx = s.x - cam.position.x, dy = G + s.h + 1.5 - cam.position.y, dz = -s.y - cam.position.z, L = Math.hypot(dx, dy, dz);
      if (L > 9 || L < 0.01) continue; const d = (dx * dir.x + dy * dir.y + dz * dir.z) / L;
      if (d > best) { best = d; shown = '@' + game.displayName(names[s.i]); }
    }
    return shown;
  };

  game.residentReport = { placed: spots.length, wanted: names.length, patches: cells.size, buildMs: Math.round(performance.now() - started), triangles: spots.length * 68 };
  game.residentSpots = spots; game.residentMeshes = meshes;
  game.shadowDirty = true;
  console.log('residents', JSON.stringify(game.residentReport));
}
