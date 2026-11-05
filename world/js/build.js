// The Internet Mansion, built block by block from the real blueprint used in the videos:
//   blender/day1_layout.py (X-shaped house) and blender/day2_rail.py (railroad, station, bridge, pyramid tunnel).
// All coordinates in this file are blueprint coordinates (bx, by, h): h = 0 is the first block above the lawn.
// Game space is x = bx, y = GROUND + h, z = -by.
import { B } from './blocks.js';
import { WORLD } from './voxels.js';

const G = WORLD.GROUND;
const FX = [-6, -19];
export const RAIL_PTS = [[105, 8], [98, -38], [58, -62], [-58, -62], [-112, -44], [-138, 22], [-132, 95], [-126, 139], [-104, 183], [-78, 183], [-28, 183], [22, 183],
  [58, 171], [112, 203], [138, 285], [168, 341], [196, 285], [186, 173], [178, 110], [166, 52], [132, 26]];

const R2 = Math.SQRT1_2;
export const CORE = [[-32, 10], [20, 10], [34, 24], [34, 26], [20, 40], [-32, 40], [-46, 26], [-46, 24]];
const WING_LEN = { 1: 40, 3: 60, 5: 50, 7: 45 };
export const WING_ROOMS = { 1: 2, 3: 4, 5: 3, 7: 3 };

export function wing(i) {
  const p = CORE[i], q = CORE[(i + 1) % 8];
  const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
  const n = [dy / L, -dx / L], t = [dx / L, dy / L], len = WING_LEN[i];
  return { i, p, q, n, t, len, width: L, P: (u, v) => [p[0] + n[0] * u + t[0] * v, p[1] + n[1] * u + t[1] * v],
    local: (x, y) => { const a = x - p[0], b = y - p[1]; return [a * n[0] + b * n[1], a * t[0] + b * t[1]]; },
    poly: [p, q, [q[0] + n[0] * len, q[1] + n[1] * len], [p[0] + n[0] * len, p[1] + n[1] * len]] };
}
const inPoly = (poly, x, y) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};

// Catmull-Rom path, same math as the Blender track
export function buildRailPath(step = 0.5) {
  const n = RAIL_PTS.length, pts = [];
  for (let i = 0; i < n; i++) {
    const p0 = RAIL_PTS[(i - 1 + n) % n], p1 = RAIL_PTS[i], p2 = RAIL_PTS[(i + 1) % n], p3 = RAIL_PTS[(i + 2) % n];
    const steps = Math.max(4, Math.floor(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
      pts.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  for (const p of pts) p.h = railHeight(p);
  let s = 0; pts[0].s = 0;
  for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].h - pts[i - 1].h); pts[i].s = s; }
  const a = pts[pts.length - 1], b = pts[0];
  return { pts, total: s + Math.hypot(a.x - b.x, a.y - b.y) };
}
function railHeight(p) {
  const d = Math.abs(p.x - FX[0]);
  if (p.y > -45 || d > 62) return 0;
  const u = Math.max(0, Math.min(1, (62 - d) / 46));
  return 7 * u * u * (3 - 2 * u);
}

export function buildWorld(V) {
  const put = (x, y, h, id) => V.setW(x, G + h, -Math.floor(y) - 1, id);
  const get = (x, y, h) => V.getW(x, G + h, -Math.floor(y) - 1);
  const fill = (x0, x1, y0, y1, h0, h1, id) => {
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let h = h0; h < h1; h++) put(x, y, h, id);
  };
  const shell = (x0, x1, y0, y1, h0, h1, id) => {
    for (let h = h0; h < h1; h++) {
      for (let x = x0; x < x1; x++) { put(x, y0, h, id); put(x, y1 - 1, h, id); }
      for (let y = y0; y < y1; y++) { put(x0, y, h, id); put(x1 - 1, y, h, id); }
    }
  };
  const disc = (cx, cy, r, h0, h1, id, r0 = -1) => {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r && d >= r0) for (let h = h0; h < h1; h++) put(x, y, h, id);
    }
  };
  const W = {}; [1, 3, 5, 7].forEach((i) => { W[i] = wing(i); });
  // Rotated box inside a wing, in wing-local coordinates
  const wf = (i, u0, u1, v0, v1, h0, h1, id) => {
    const w = W[i], c = [w.P(u0, v0), w.P(u1, v0), w.P(u1, v1), w.P(u0, v1)];
    const xs = c.map((a) => a[0]), ys = c.map((a) => a[1]);
    for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
      const [u, v] = w.local(x + 0.5, y + 0.5);
      if (u >= u0 && u <= u1 && v >= v0 && v <= v1) for (let h = h0; h < h1; h++) put(x, y, h, id);
    }
  };

  // ---------- Ground ----------
  for (let x = WORLD.X0; x < WORLD.X0 + WORLD.W; x++) for (let y = -112; y < 378; y++) {
    fill(x, x + 1, y, y + 1, -G, -2, B.dirt);
    put(x, y, -2, B.dirt);
    put(x, y, -1, Math.floor((y + x * 0.0) / 6) % 2 === 0 ? B.grass : B.grass2);
  }
  // Giza sand, with a soft edge
  for (let x = -112; x < 142; x++) for (let y = 124; y < 331; y++) {
    const ex = Math.min(x + 105, 135 - x), ey = Math.min(y - 133, 323 - y);
    const wob = Math.sin(x * 0.17) * 2 + Math.cos(y * 0.13) * 2;
    if (Math.min(ex, ey) + wob > 0) put(x, y, -1, B.sand);
  }

  // ---------- Driveway, round court, fountain ----------
  fill(-8.5, -3.5, -112, -36, -1, 0, B.gravel);
  disc(FX[0], FX[1], 19, -1, 0, B.gravel);
  disc(FX[0], FX[1], 19.8, -1, 0, B.roadline, 19);
  disc(FX[0], FX[1], 8.5, -1, 0, B.roadline);
  disc(FX[0], FX[1], 8, -1, 0, B.grass);
  fill(-35, 23, -3, 10, -1, 0, B.asphalt);
  for (let x = -34; x < 22; x += 6) if (x < -14 || x > 2) fill(x, x + 0.5, 0, 8, -1, 0, B.roadline);
  // Service road from the garage to the court
  fill(13, 68, -25, -20, -1, 0, B.gravel);
  // Parked cars from Day 2 are drivable props now, see cars.js
  // Fountain
  disc(FX[0], FX[1], 4.5, 0, 1, B.stone); disc(FX[0], FX[1], 3.6, -1, 1, B.water); disc(FX[0], FX[1], 3.6, -2, -1, B.poolLight);
  fill(-7, -5, -20, -18, 0, 3, B.stone); fill(-8, -4, -21, -17, 3, 4, B.stone); fill(-7, -5, -20, -18, 4, 5, B.water);

  const spots = {}, spots_el = spots;
  // ---------- The house ----------
  // The foyer is the whole front of the house, 51 blocks from the door to the first stair. Rooms floor sits behind it.
  const U = 6, DY = 50;
  const EXT = [[-32, 40], [20, 40], [34, 54], [34, 90], [-46, 90], [-46, 54]];
  const wingPolys = [1, 3, 5, 7].map((i) => W[i].poly);
  const inCore = (x, y) => inPoly(CORE, x, y);
  const inHouse = (x, y) => inCore(x, y) || inPoly(EXT, x, y) || wingPolys.some((p) => inPoly(p, x, y));
  const wx0 = -90, wx1 = 85, wy0 = -30, wy1 = 95;
  const full = new Set(), core = new Set(), hall = new Set(), upper = new Set(); const key = (x, y) => x * 1000 + y;
  for (let x = wx0; x < wx1; x++) for (let y = wy0; y < wy1; y++) {
    if (inHouse(x + 0.5, y + 0.5)) full.add(key(x, y));
    if (inCore(x + 0.5, y + 0.5)) { core.add(key(x, y)); hall.add(key(x, y)); upper.add(key(x, y + DY)); }
    if (inPoly(EXT, x + 0.5, y + 0.5)) hall.add(key(x, y));
  }
  const perimeter = (set, x, y) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!set.has(key(x + a, y + b))) return true; return false; };
  const windows = (x, y, h, baseId, band0, band1) => {
    if (h < band0 || h >= band1) return baseId;
    const t = Math.abs(x) + Math.abs(y);
    return (t % 6) < 3 ? B.glass : baseId;
  };
  for (let x = wx0; x < wx1; x++) for (let y = wy0; y < wy1; y++) {
    const k = key(x, y);
    if (!full.has(k)) continue;
    const isHall = hall.has(k);
    fill(x, x + 1, y, y + 1, -1, 0, isHall ? B.marble : B.oak);
    if (perimeter(full, x, y)) {
      for (let h = 0; h < 14; h++) {
        let id;
        if (h === 0) id = B.stone;
        else if (h === 1 && isHall) id = B.marbleW;
        else if (h >= 12) id = B.trim;
        else id = windows(x, y, h, B.brick, 2, 11);
        put(x, y, h, id);
      }
    }
    if (isHall) {
      fill(x, x + 1, y, y + 1, 17, 18, B.trim); // the foyer ceiling is way up here
      fill(x, x + 1, y, y + 1, 18, 19, B.roofDeck);
      if (perimeter(hall, x, y)) for (let h = 12; h < 20; h++) put(x, y, h, h === 12 || h >= 18 ? B.trim : windows(x, y, h, B.brick, 13, 17));
      if (upper.has(k)) { fill(x, x + 1, y, y + 1, 11, 12, B.trim); fill(x, x + 1, y, y + 1, 12, 13, B.trim); if (perimeter(upper, x, y)) for (let h = 13; h < 18; h++) put(x, y, h, windows(x, y, h, B.marbleW, 14, 17)); }
    } else {
      fill(x, x + 1, y, y + 1, 11, 12, B.trim);
      fill(x, x + 1, y, y + 1, 12, 13, B.roofDeck);
    }
  }
  // Tall arches into each wing. Room dividers inside the wings get arches too.
  for (const i of [1, 3, 5, 7]) {
    const w = W[i], mid = w.width / 2;
    wf(i, -0.8, 0.8, 0, mid - 5, 0, 11, B.marbleW); wf(i, -0.8, 0.8, mid + 5, w.width, 0, 11, B.marbleW);
    wf(i, -0.8, 0.8, 0, w.width, 9, 11, B.marbleW);
    if (i === 1) continue; // the garage is one big bay
    for (let j = 1; j < WING_ROOMS[i]; j++) {
      const u = w.len * j / WING_ROOMS[i];
      wf(i, u - 0.8, u + 0.8, 0.4, mid - 4, 0, 11, B.stucco); wf(i, u - 0.8, u + 0.8, mid + 4, w.width - 0.4, 0, 11, B.stucco);
      wf(i, u - 0.8, u + 0.8, 0.4, w.width - 0.4, 8, 11, B.stucco);
    }
  }
  // The back wings share a wall with the foyer where it widens
  wf(3, 0, 20.5, W[3].width - 0.9, W[3].width + 0.9, 0, 19, B.brick); wf(5, 0, 20.5, -0.9, 0.9, 0, 19, B.brick);
  // Grand foyer. Marble, red carpet cross, columns kept to the edges so the middle stays wide open.
  fill(-46, 34, 24, 27, -1, 0, B.redCarpet); fill(-9, -4, 10, 89, -1, 0, B.redCarpet);
  const column = (cx, cy, top) => { fill(cx - 1, cx + 3, cy - 1, cy + 3, 0, 1, B.stone); fill(cx, cx + 2, cy, cy + 2, 1, top - 1, B.marbleW); fill(cx - 1, cx + 3, cy - 1, cy + 3, top - 1, top, B.gold); };
  for (const cy of [14, 34, 48, 58]) for (const cx of [-30, 18]) column(cx, cy, 17);
  for (const cx of [-44, 32]) column(cx, 58, 17);
  for (const cx of [-30, 18]) for (const cy of [66, 80]) column(cx, cy, 11);
  // Wall lights all the way round
  for (let x = -30; x < 20; x += 5) { if (Math.abs(x + 6.5) > 7) put(x, 11, 9, B.lamp); }
  for (let y = 56; y < 88; y += 6) { put(-45, y, 8, B.lamp); put(32, y, 8, B.lamp); }
  const chandelier = (cx, cy, top, r = 3.4) => {
    fill(cx, cx + 1, cy, cy + 1, top - 2, top + 1, B.gold); disc(cx + 0.5, cy + 0.5, r, top - 2, top - 1, B.gold, r - 1.2); disc(cx + 0.5, cy + 0.5, r - 1.1, top - 3, top - 2, B.lamp);
  };
  for (const [cx, cy] of [[-7, 25], [-7, 45], [-26, 25], [13, 25], [-26, 45], [13, 45]]) chandelier(cx, cy, 16, cx === -7 ? 5 : 3.6);
  for (const [cx, cy] of [[-26, 75], [13, 75], [-38, 75], [25, 75], [-6, 84]]) chandelier(cx, cy, 10);
  // A long skylight down the middle of the foyer
  fill(-20, 8, 16, 54, 18, 19, B.glass); fill(-20, 8, 16, 54, 17, 18, B.air);
  // Open the middle up to the roof at the stairs
  fill(-13, 1, 10 + DY, 23 + DY, 11, 13, B.air);
  fill(-13, -12, 10 + DY, 23 + DY, 12, 18, B.stucco); fill(0, 1, 10 + DY, 23 + DY, 12, 18, B.stucco);
  fill(-13, 1, 60, 61, 13, 18, B.air); fill(-13, 1, 61, 62, 13, 18, B.air);
  fill(-12, 0, 12 + DY, 22 + DY, 18, 19, B.glass);
  chandelier(-7, 15 + DY, 17);
  // Twin staircases up to the Rooms floor, with the aisle between them. First step is 51 blocks in from the door.
  for (let j = 0; j < 13; j++) {
    const row = 11 + DY + j;
    for (const [a, b] of [[-12, -8], [-4, 0]]) { fill(a, b, row, row + 1, j, j + 1, B.redCarpet); if (j > 0) fill(a, b, row, row + 1, j - 1, j, B.trim); }
    if (j > 0) { put(-8, row, j + 1, B.railGold); put(-5, row, j + 1, B.railGold); } // Rails sit beside the steps, so the full 4 blocks are walkable
  }
  // Glass elevator between the stairs
  shell(-8, -4, 18 + DY, 24 + DY, 0, 22, B.glass); fill(-8, -4, 18 + DY, 24 + DY, 22, 23, B.gold); fill(-7, -5, 19 + DY, 23 + DY, 12, 19, B.air); fill(-8, -4, 18 + DY, 24 + DY, -1, 0, B.gold);
  for (const [a, b] of [[-8, 18], [-5, 18], [-8, 23], [-5, 23]]) fill(a, a + 1, b + DY, b + DY + 1, 0, 22, B.gold);
  spots_el.elevator = { x: -6, y: 21 + DY };

  // Everything in this block is written at first-draft height and lifted U blocks.
  const roomDoors = [], tvSpots = [], beds = [], arcadeR3 = [], roomArt = [], secret = {}, ger = {}; let dungeon;
  const base = { fill, put, get, disc, shell };
  {
    const fill = (a, b, c, d, h0, h1, id) => base.fill(a, b, c + DY, d + DY, h0 + U, h1 + U, id);
    const put = (x, y, h, id) => base.put(x, y + DY, h + U, id);
    const get = (x, y, h) => base.get(x, y + DY, h + U);
    const disc = (cx, cy, r, h0, h1, id, r0) => base.disc(cx, cy + DY, r, h0 + U, h1 + U, id, r0);
    const shell = (a, b, c, d, h0, h1, id) => base.shell(a, b, c + DY, d + DY, h0 + U, h1 + U, id);

  // Second floor: hallway, five rooms north, four south, room 10 at the east end
  const HALL0 = -39, HALL1 = 26;
  fill(HALL0, HALL1, 23, 24, 7, 12, B.stucco); fill(HALL0, HALL1, 27, 28, 7, 12, B.stucco);
  fill(-13, 1, 23, 24, 7, 12, B.air);
  fill(HALL0, HALL1, 24, 27, 6, 7, B.redCarpet);
  for (let x = HALL0 + 4; x < HALL1; x += 8) fill(x, x + 2, 25, 26, 11, 12, B.lamp);
  const cols = [0, 1, 2, 3, 4].map((k) => HALL0 + 13 * k);
  cols.forEach((x) => { fill(x, x + 1, 27, 40, 7, 12, B.stucco); });
  [cols[0], cols[1], cols[3], cols[4]].forEach((x) => { fill(x, x + 1, 10, 23, 7, 12, B.stucco); });
  fill(26, 27, 10, 40, 7, 12, B.stucco); fill(HALL0, HALL0 + 1, 10, 40, 7, 12, B.stucco);

  // [room, x0, y0, y1 (room extent), side]
  const ROOMS = {
    1: { x: cols[0], y0: 12, y1: 23, doorY: 23 }, 3: { x: cols[1], y0: 12, y1: 23, doorY: 23 }, 5: { x: cols[3], y0: 12, y1: 23, doorY: 23 }, 7: { x: cols[4], y0: 12, y1: 23, doorY: 23 },
    2: { x: cols[0], y0: 28, y1: 38, doorY: 27 }, 4: { x: cols[1], y0: 28, y1: 38, doorY: 27 }, 6: { x: cols[2], y0: 28, y1: 38, doorY: 27 }, 8: { x: cols[3], y0: 28, y1: 38, doorY: 27 }, 9: { x: cols[4], y0: 28, y1: 38, doorY: 27 },
  };
  for (const r of Object.keys(ROOMS)) {
    const R = ROOMS[r], dx = R.x + 6;
    fill(dx, dx + 2, R.doorY, R.doorY + 1, 7, 10, B.air);
    roomDoors.push({ room: +r, x: dx, y: R.doorY === 23 ? 23 : 27, w: 2, h: 3, h0: 7, axis: 'x' });
  }

  const wallsIn = (R, id, floorId, ceilId, light) => {
    const x0 = R.x + 1, x1 = R.x + 13;
    fill(x0, x1, R.y0, R.y1, 6, 7, floorId);
    if (ceilId) fill(x0, x1, R.y0, R.y1, 11, 12, ceilId);
    // paint interior faces by swapping the wall blocks of this room (keep windows)
    for (let h = 7; h < 11; h++) {
      for (let x = R.x; x < x1 + 1; x++) for (const y of [R.y0 - 1, R.y1]) {
        const cur = get(x, y, h);
        if (cur === B.stucco) put(x, y, h, id);
      }
      for (let y = R.y0; y < R.y1; y++) for (const x of [R.x, x1]) { if (get(x, y, h) === B.stucco) put(x, y, h, id); }
      // Line the outside wall so the room's color wraps all the way around. Windows stay clear.
      const row = R.y0 > 25 ? 38 : 11, outer = R.y0 > 25 ? 39 : 10;
      for (let x = x0; x < x1; x++) if (core.has(key(x, row)) && get(x, outer, h) !== B.glass) put(x, row, h, id);
      if (R.y0 > 25) fill(x0, x1, 38, 39, 6, 7, floorId); else fill(x0, x1, 11, 12, 6, 7, floorId);
    }
    // Ceiling light
    fill(R.x + 5, R.x + 9, Math.floor((R.y0 + R.y1) / 2) - 1, Math.floor((R.y0 + R.y1) / 2) + 1, 11, 12, light || B.panel);
  };
  // Default kit every room gets: bed, nightlight, wall TV (see episodes/rooms.json)
  const bed = (x, y, blanket, facing = 1) => {
    fill(x, x + 3, y, y + 5, 7, 8, B.walnut); fill(x, x + 3, y, y + 5, 8, 9, blanket);
    if (facing > 0) { fill(x, x + 3, y + 4, y + 5, 8, 9, B.pillow); fill(x, x + 3, y + 5, y + 6, 7, 10, B.walnut); }
    else { fill(x, x + 3, y, y + 1, 8, 9, B.pillow); fill(x, x + 3, y - 1, y, 7, 10, B.walnut); }
  };
  const kit = (R, opts) => {
    const by = R.y0 > 25 ? R.y1 - 7 : R.y0 + 1;
    const bx = R.x + 2;
    bed(bx, by + (R.y0 > 25 ? 0 : 0), opts.blanket || B.teal, R.y0 > 25 ? 1 : -1);
    fill(bx + 3, bx + 4, R.y0 > 25 ? R.y1 - 2 : R.y0, (R.y0 > 25 ? R.y1 - 1 : R.y0 + 1), 7, 8, B.walnut); // nightstand
    put(bx + 3, R.y0 > 25 ? R.y1 - 2 : R.y0, 8, B.lamp);
    beds.push({ x: bx + 1.5, y: by + 2.5, h: 9, room: opts.room });
    tvSpots.push({ x: R.x + 12.9, y: opts.tvY || (R.y0 + R.y1) / 2, h: 9, w: opts.tvW || 5, h2: 3, face: 'west', room: opts.room });
  };
  // Room 1, @maxgregerson_22: spacious. It runs out over the foyer to twice the depth of the other rooms, so the angled corner wall comes out too.
  {
    const R = ROOMS[1], N = 1, x0 = R.x + 1, x1 = R.x + 13; // N: the new far wall's inside edge
    wallsIn(R, B.blueWall, B.charcoal);
    for (let x = x0; x < x1; x++) for (let y = N; y < R.y1; y++) upper.add(key(x, y + DY)); // So the game knows this is Room 1
    // Clear the angled wall and the old back wall, then build the extension's shell
    for (let x = R.x + 1; x < x1; x++) for (let y = N; y < R.y1; y++) for (let h = 7; h < 11; h++) { const c = get(x, y, h); if (c === B.marbleW || c === B.marble || c === B.glass || c === B.stucco || c === B.blueWall || c === B.trim || c === B.gold) put(x, y, h, B.air); }
    fill(x0, x1, N, R.y0, 6, 7, B.charcoal); fill(x0, x1, N, R.y0, 11, 12, B.panel); fill(x0, x1, N - 1, N, 6, 12, B.blueWall);
    fill(R.x, R.x + 1, N - 1, R.y1, 7, 12, B.blueWall); fill(x1, x1 + 1, N - 1, R.y1, 7, 12, B.blueWall);
    fill(R.x + 5, x1 - 1, N - 1, N, 8, 10, B.glass); // A long window looking out over the foyer
    fill(x0, x1, R.y0 - 2, R.y0, 11, 12, B.panel);
    fill(x0 + 1, x1 - 1, 4, 18, 11, 12, B.panel);
    // LED strip all the way around the top of the walls
    for (let x = x0; x < x1; x++) { put(x, N, 10, B.ledBlue); put(x, R.y1 - 1, 10, B.ledBlue); }
    for (let y = N; y < R.y1; y++) { put(x0, y, 10, B.ledBlue); put(x1 - 1, y, 10, B.ledBlue); }
    // Far end, left: the bed, with LEDs around it and the bass mounted above it
    const by = N + 1, bx = R.x + 2;
    bed(bx, by, B.blueWall, -1); beds.push({ x: bx + 1.5, y: by + 2, h: 9, room: 1 });
    for (let x = bx - 1; x < bx + 4; x++) put(x, by + 5, 6, B.ledBlue);
    for (let y = by; y < by + 5; y++) { put(bx - 1, y, 6, B.ledBlue); put(bx + 3, y, 6, B.ledBlue); }
    put(bx + 3, by, 7, B.walnut); put(bx + 3, by, 8, B.lamp); // Nightlight
    roomArt.push({ art: 'bass', x: bx + 1.5, y: by + 0.02, h: 9.5, w: 2.2, h2: 1, face: 'north' });
    // Far end, right: the battlestation under the window
    fill(R.x + 7, x1, N, N + 1, 7, 8, B.walnut); fill(x1 - 1, x1, N, N + 1, 8, 10, B.black); put(x1 - 1, N, 10, B.ledPurple);
    roomArt.push({ art: 'curved', x: R.x + 8.6, y: N + 0.9, h: 9.3, w: 2.4, h2: 1.3, face: 'north' });
    roomArt.push({ art: 'stocks', x: R.x + 10.8, y: N + 1.02, h: 9.2, w: 1.3, h2: 1, face: 'north' });
    fill(R.x + 9, R.x + 10, N + 2, N + 3, 7, 8, B.seat);
    // The middle is open floor: a big rug, a couch, and the racing sim facing the TV
    fill(R.x + 3, R.x + 9, 9, 16, 6, 7, B.rug);
    fill(R.x + 1, R.x + 2, 10, 15, 7, 8, B.sofa); fill(R.x + 1, R.x + 2, 10, 15, 8, 9, B.sofa);
    tvSpots.push({ x: R.x + 12.9, y: 13, h: 9, w: 5, h2: 2.6, face: 'west', room: 1 });
    fill(R.x + 8, x1 - 1, 12, 14, 6, 7, B.black); fill(R.x + 8, R.x + 9, 12, 14, 7, 9, B.seat); put(R.x + 10, 12, 7, B.steel); put(R.x + 10, 13, 7, B.steel); put(R.x + 10, 12, 8, B.black); put(R.x + 10, 13, 8, B.black);
    // By the door: walk-in closet on the left, big all-glass shower on the right
    const c0 = 17;
    fill(R.x + 1, R.x + 6, c0, c0 + 1, 7, 11, B.blueWall); fill(R.x + 3, R.x + 5, c0, c0 + 1, 7, 10, B.air); fill(R.x + 5, R.x + 6, c0, R.y1, 7, 11, B.blueWall);
    fill(R.x + 1, R.x + 5, c0 + 1, R.y1, 6, 7, B.rug);
    { const clothes = [B.red, B.teal, B.pink, B.navy, B.cream, B.charcoal, B.orange]; let c = 0;
      for (let y = c0 + 1; y < R.y1; y++) fill(R.x + 1, R.x + 2, y, y + 1, 8, 10, clothes[c++ % 7]);
      for (let x = R.x + 2; x < R.x + 5; x++) fill(x, x + 1, R.y1 - 1, R.y1, 8, 10, clothes[c++ % 7]); }
    fill(R.x + 8, x1, 17, 18, 7, 10, B.glass); fill(R.x + 8, R.x + 9, 17, R.y1, 7, 10, B.glass); fill(R.x + 9, x1, 18, R.y1, 6, 7, B.marbleW); put(R.x + 12, R.y1 - 1, 10, B.steel); fill(R.x + 8, R.x + 9, 19, 21, 7, 10, B.air); // Way into the shower
  }
  // Room 2, @certifieddxzzy: dark red LED EDM dungeon, DJ stage, speakers, fog, lasers
  dungeon = ROOMS[2];
  {
    const R = dungeon; wallsIn(R, B.dungeon, B.charcoal, B.black, B.ledRed);
    fill(R.x + 2, R.x + 12, R.y1 - 4, R.y1 - 1, 6, 8, B.dungeon);
    fill(R.x + 4, R.x + 10, R.y1 - 3, R.y1 - 2, 8, 9, B.black); fill(R.x + 5, R.x + 9, R.y1 - 3, R.y1 - 2, 9, 10, B.ledRed);
    for (const x of [R.x + 5, R.x + 11]) { fill(x, x + 2, R.y1 - 2, R.y1 - 1, 7, 11, B.speaker); } // The left stack stays inside the angled corner
    for (let x = R.x + 2; x < R.x + 12; x += 3) { put(x, R.y0, 10, B.ledRed); put(x, R.y1 - 1, 10, B.ledRed); }
    disc(R.x + 3.5, R.y0 + 3, 2.2, 7, 8, B.stone); disc(R.x + 3.5, R.y0 + 3, 1.3, 7, 8, B.water); disc(R.x + 3.5, R.y0 + 3, 1.3, 6, 7, B.ledRed); // the NOT TEQUILA fountain
    fill(R.x + 5, R.x + 9, R.y0 - 1, R.y0, 10, 11, B.steel); // chains over the door
    bed(R.x + 9, R.y0 + 1, B.red, -1);
    beds.push({ x: R.x + 10.5, y: R.y0 + 3, h: 9, room: 2 });
    put(R.x + 8, R.y0, 7, B.walnut); put(R.x + 8, R.y0, 8, B.ledRed); // Nightlight
    tvSpots.push({ x: R.x + 12.9, y: R.y0 + 3, h: 9.4, w: 3.4, h2: 2, face: 'west', room: 2 });
    roomArt.push({ art: 'chains', x: R.x + 10, y: R.y0 - 1.05, h: 9.1, w: 2.6, h2: 1.7, face: 'south' }); // Out in the hallway, next to the door
  }
  // Room 3, @rudrapratap.singhchauhan_: old arcade with the latest games
  {
    const R = ROOMS[3]; wallsIn(R, B.navy, B.arcadeRug, B.starCeil, B.ledPurple);
    for (let x = R.x + 1; x < R.x + 13; x += 2) put(x, R.y1 - 1, 10, x % 4 ? B.ledPink : B.ledBlue);
    const games = ['demolition', 'cord', 'stack'];
    games.forEach((g, i) => {
      const cx = R.x + 2 + i * 4;
      fill(cx, cx + 2, R.y0, R.y0 + 2, 7, 10, B.black); fill(cx, cx + 2, R.y0, R.y0 + 1, 10, 11, B.ledPink);
      arcadeR3.push({ x: cx + 1, y: R.y0 + 2, h: 8.6, game: g, face: 'north' });
    });
    bed(R.x + 2, R.y1 - 6, B.pink, 1); beds.push({ x: R.x + 3.5, y: R.y1 - 4, h: 9, room: 3 }); put(R.x + 5, R.y1 - 2, 7, B.walnut); put(R.x + 5, R.y1 - 2, 8, B.ledPink);
    tvSpots.push({ x: R.x + 12.9, y: R.y0 + 7, h: 9, w: 4, h2: 2.4, face: 'west', room: 3 });
  }
  // Room 4, @xentitled: the pyramid guy, sandstone room with a window at Khufu
  {
    const R = ROOMS[4]; wallsIn(R, B.pyr1, B.sand);
    kit(R, { room: 4, blanket: B.blueStone }); fill(R.x + 5, R.x + 9, 38, 40, 8, 11, B.glass);
    fill(R.x + 9, R.x + 11, R.y0 + 7, R.y0 + 8, 7, 8, B.pyr2); put(R.x + 9, R.y0 + 7, 8, B.gold);
  }
  // Room 5, @ricky3156_coffman: default kit
  { const R = ROOMS[5]; wallsIn(R, B.skyWall, B.oak); kit(R, { room: 5, blanket: B.sofa }); fill(R.x + 8, R.x + 12, R.y1 - 3, R.y1 - 1, 6, 7, B.rug); }
  // Room 6, @aabhishekmisal: 221B Baker Street study in velvet purple, bookcase hides a dim red room
  {
    const R = ROOMS[6], split = 35;
    wallsIn(R, B.velvet, B.walnut, null, B.lamp);
    fill(R.x + 1, R.x + 13, split, split + 1, 7, 11, B.shelf);
    fill(R.x + 6, R.x + 8, split, split + 1, 7, 10, B.air);
    secret.door = { x: R.x + 6, y: split, w: 2, h: 3, h0: 7 };
    fill(R.x + 1, R.x + 13, split + 1, 39, 6, 7, B.dungeon); fill(R.x + 1, R.x + 13, split + 1, 39, 7, 11, B.air); fill(R.x + 1, R.x + 13, split + 1, 39, 11, 12, B.dungeon);
    for (let x = R.x + 1; x < R.x + 13; x++) fill(x, x + 1, split + 3, split + 4, 10, 11, x % 3 === 0 ? B.ledRed : B.dungeon);
    fill(R.x + 2, R.x + 6, 37, 39, 7, 8, B.walnut); put(R.x + 10, 38, 9, B.ledRed);
        fill(R.x + 2, R.x + 6, 29, 31, 7, 8, B.walnut); fill(R.x + 3, R.x + 5, 29, 30, 8, 9, B.black);
    fill(R.x + 9, R.x + 12, 31, 34, 6, 7, B.rug); fill(R.x + 10, R.x + 12, 32, 34, 7, 8, B.seat); put(R.x + 7, 32, 7, B.torch);
    fill(R.x + 1, R.x + 2, 29, 35, 7, 11, B.shelf);
    bed(R.x + 11, 28.5, B.velvet, -1); beds.push({ x: R.x + 12, y: 31, h: 9, room: 6 });
    // The middle of the house has no outside walls here, so two walls get painted windows onto the street
    roomArt.push({ art: 'london', x: R.x + 3, y: 28.03, h: 9.2, w: 2.6, h2: 2.4, face: 'north' });
    roomArt.push({ art: 'london', x: R.x + 9.6, y: 28.03, h: 9.2, w: 1.6, h2: 2.4, face: 'north' });
    roomArt.push({ art: 'london', x: R.x + 12.95, y: 34.1, h: 9.9, w: 1.2, h2: 1.7, face: 'west' });
    tvSpots.push({ x: R.x + 12.9, y: 31, h: 9.95, w: 2.8, h2: 1.7, face: 'west', room: 6 });
    put(R.x + 8, 29, 7, B.walnut); put(R.x + 8, 29, 8, B.lamp); // Nightlight
  }
  // Room 7, @milllehouse: Mongolian ger with orange door, lattice, stove, rugs, stars through the roof ring
  {
    const R = ROOMS[7], cx = R.x + 6.5, cy = 17;
    wallsIn(R, B.felt, B.rug, null, B.lamp);
    disc(cx, cy, 5.8, 7, 11, B.felt, 5); disc(cx, cy, 5, 6, 7, B.rug);
    // Wooden lattice showing through the felt on the lower wall, then rugs layered on the floor
    for (let x = R.x; x < R.x + 14; x++) for (let y = 11; y < 24; y++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d > 5 && d <= 5.8) for (let h = 7; h < 9; h++) if ((x + y + h) % 2 === 0) put(x, y, h, B.oak); }
    disc(cx, cy, 3.6, 6, 7, B.arcadeRug); disc(cx - 2, cy - 1.5, 1.8, 6, 7, B.teal); disc(cx + 2, cy + 1.8, 1.6, 6, 7, B.red); disc(cx, cy, 1.4, 6, 7, B.orange);
    Object.assign(ger, { x: cx, y: cy, h: 11 });
    fill(cx - 1, cx + 1, cy + 4.2, cy + 6, 7, 10, B.air);
    disc(cx, cy, 5.8, 11, 12, B.felt); disc(cx, cy, 1.8, 11, 12, B.starCeil); fill(R.x + 5, R.x + 9, cy - 1, cy + 1, 10, 11, B.air);
    fill(cx - 0.5, cx + 0.5, cy - 0.5, cy + 0.5, 7, 8, B.black); put(Math.floor(cx), Math.floor(cy), 8, B.torch);
    bed(R.x + 3, cy - 3, B.rug, -1); beds.push({ x: R.x + 4.5, y: cy - 1, h: 9, room: 7 });
    put(R.x + 6, cy - 3, 7, B.walnut); put(R.x + 6, cy - 3, 8, B.lamp); // Nightlight
    tvSpots.push({ x: R.x + 2.2, y: cy, h: 9.4, w: 2.6, h2: 1.6, face: 'east', room: 7 });
  }
  // Room 8, @jaydon_houle: wanted a portrait. Gets a giant one.
  { const R = ROOMS[8]; wallsIn(R, B.cream, B.oak); kit(R, { room: 8, blanket: B.seat }); fill(R.x + 7, R.x + 13, 37, 38, 7, 11, B.gold); roomArt.push({ art: 'portrait', handle: 'jaydon_houle', x: R.x + 10, y: 36.97, h: 9, w: 3.7, h2: 3.7, face: 'south' }); }
  // Room 9, @xoxoluvkurt1: default kit
  { const R = ROOMS[9]; wallsIn(R, B.pink, B.cream); kit(R, { room: 9, blanket: B.pink, tvY: 30.2, tvW: 4 }); } // TV stays clear of the angled corner
  // Room 10, @dhee._ven: soooo luxurious, racing rig, private balcony facing the pool
  {
    const x0 = 27, x1 = 33;
    for (let x = x0; x < x1 + 1; x++) for (let y = 12; y < 38; y++) if (core.has(key(x, y)) && !perimeter(core, x, y)) put(x, y, 6, B.marble);
    fill(26, 27, 24, 26, 7, 10, B.air);
    fill(34, 35, 24, 26, 7, 10, B.air); fill(33, 34, 24, 26, 7, 10, B.air);
    fill(34, 39, 22, 28, 6, 7, B.trim); shell(34, 39, 22, 28, 7, 8, B.railGold); fill(34, 35, 24, 26, 7, 8, B.air);
    for (let x = 27; x < 34; x++) for (let y = 12; y < 38; y++) if (core.has(key(x, y)) && !perimeter(core, x, y) && (perimeter(core, x + 1, y) || perimeter(core, x, y + 1) || perimeter(core, x, y - 1))) for (let h = 7; h < 11; h++) { if (y !== 24 && y !== 25) put(x, y, h, B.marbleW); }
    put(29, 20, 11, B.panel); put(29, 30, 11, B.panel); fill(30, 32, 24, 26, 11, 12, B.panel);
    // Bed and rig sit in the square ends of this room, clear of the angled walls in the middle
    fill(27, 30, 32, 37, 7, 8, B.gold); fill(27, 30, 32, 36, 8, 9, B.white); fill(27, 30, 36, 37, 8, 9, B.pillow); fill(27, 30, 37, 38, 7, 10, B.gold);
    beds.push({ x: 28.5, y: 34, h: 9, room: 10 });
    // Racing rig facing the TV, with the console on its own stand
    fill(28, 32, 13, 15, 6, 7, B.black); fill(31, 32, 13, 15, 7, 9, B.seat); put(29, 13, 7, B.steel); put(29, 13, 8, B.black); put(29, 14, 7, B.steel); put(29, 14, 8, B.black);
    fill(27, 28, 16, 17, 7, 8, B.black); put(27, 16, 8, B.white); // The console
    // Soooo luxurious: velvet, gold, a chandelier and a lamp by the bed
    fill(28, 33, 22, 28, 6, 7, B.velvet); fill(28, 33, 22, 23, 6, 7, B.gold); fill(28, 33, 27, 28, 6, 7, B.gold);
    put(30, 36, 7, B.gold); put(30, 36, 8, B.lamp);
    tvSpots.push({ x: 27.1, y: 14, h: 9.3, w: 4, h2: 2.3, face: 'east', room: 10 });
  }
  }
  roomDoors.forEach((d) => { d.h0 += U; d.y += DY; });
  [...tvSpots, ...beds, ...arcadeR3, ...roomArt, ger].forEach((s) => { s.h += U; s.y += DY; }); secret.door.h0 += U; secret.door.y += DY;
  // Stair landings reach the hallway
  fill(-12, -8, 23 + DY, 24 + DY, 13, 18, B.air); fill(-4, 1, 23 + DY, 24 + DY, 13, 18, B.air);
  // Ladder to the roof from the west end of the hallway
  fill(-38, -37, 25 + DY, 26 + DY, 13, 20, B.ladder); fill(-38, -37, 25 + DY, 26 + DY, 20, 21, B.air);

  // Portico: tall columns, steps, pediment
  fill(-17, 4, 3.5, 10, 0, 1, B.trim); fill(-18, 5, 2.5, 3.5, -1, 0, B.trim);
  fill(-9, -4, 3.5, 10, 0, 1, B.redCarpet);
  [-16, -12, -2, 2].forEach((x) => { fill(x, x + 2, 5, 7, 1, 2, B.stone); fill(x, x + 2, 5, 7, 2, 15, B.trim); fill(x - 1, x + 3, 4, 8, 15, 16, B.gold); });
  fill(-18, 5, 3.5, 11, 16, 17, B.trim);
  for (let k = 0; k < 11; k++) { fill(-18 + k, 5 - k, 3.5, 11, 17 + k, 18 + k, B.brick); fill(-18 + k, -17 + k, 3.5, 11, 17 + k, 18 + k, B.roof); fill(4 - k, 5 - k, 3.5, 11, 17 + k, 18 + k, B.roof); }
  // Two really tall front doors (the leaves are props)
  fill(-9, -4, 9.5, 11, 1, 9, B.air); fill(-9, -4, 9.5, 11, 0, 1, B.redCarpet); fill(-10, -3, 9.5, 11, 9, 10, B.gold); fill(-10, -9, 9.5, 11, 0, 9, B.gold); fill(-4, -3, 9.5, 11, 0, 9, B.gold);
  const frontDoor = { x: -9, y: 10, w: 5, h: 8, h0: 1, tag: 'front' };
  // Way out to the Hall of Fame, way out to the pool, back door to the party dome
  fill(-47, -45, 24, 26, 1, 6, B.air); fill(33, 35, 24, 26, 1, 6, B.air);
  fill(-8, -4, 88, 95, 0, 5, B.air);
  fill(-9, -8, 90, 94, 0, 6, B.trim); fill(-4, -3, 90, 94, 0, 6, B.trim); fill(-9, -3, 90, 94, 5, 6, B.trim);
  const partyDoor = { x: -8, y: 89, w: 4, h: 5, h0: 0, axis: 'x', tag: 'party' };
  // Hall of Fame guard post (@5star.battle wants this job)
  fill(-40, -38, 19, 21, 0, 1, B.stone); fill(-40, -38, 19, 21, 1, 3, B.gold);

  // ---------- Wing rooms ----------
  const lampRow = (i, u0, u1, id = B.panel) => { for (let u = u0 + 2; u < u1 - 1; u += 4) { wf(i, u, u + 1.6, 4, 6, 10, 11, id); wf(i, u, u + 1.6, 13.8, 15.8, 10, 11, id); } };
  Object.assign(spots, { arcade: [...arcadeR3], tv: tvSpots, roomArt, ger, beds, roomDoors, frontDoor, partyDoor, secret });

  // Wing 1: Hot Rod Garage. One long bay, cars parked at an angle down both sides, exit door at the far end.
  {
    lampRow(1, 0, 40, B.panel);
    wf(1, 1, 39, 1, 18.8, -1, 0, B.concrete);
    // Tires on the wall
    for (let u = 3; u < 37; u += 3) { wf(1, u, u + 2, 0.9, 1.5, 4, 6, B.tire); wf(1, u, u + 2, 18.3, 18.9, 4, 6, B.tire); }
    // Pegboard with tools above the benches
    wf(1, 2, 16, 0.9, 1.5, 7, 9, B.pegboard); wf(1, 22, 37, 18.3, 18.9, 7, 9, B.pegboard);
    // Stacked tires, tool chests, oil drums
    wf(1, 35, 37, 1.6, 3.6, 0, 3, B.tire); wf(1, 32.5, 34.5, 1.6, 3.6, 0, 2, B.tire); wf(1, 1.5, 3.5, 16, 18.4, 0, 3, B.red); wf(1, 1.5, 3.5, 16, 18.4, 3, 4, B.steel);
    wf(1, 4.5, 7, 16.8, 18.4, 0, 2, B.red); wf(1, 36, 38, 16.4, 18.4, 0, 2, B.blueStone); wf(1, 8, 9.5, 16.8, 18.2, 0, 2, B.catYellow);
    // Car lift: posts and arms. The car on it is a prop.
    wf(1, 20, 21, 1.4, 2.6, 0, 7, B.steel); wf(1, 27, 28, 1.4, 2.6, 0, 7, B.steel); wf(1, 20, 28, 1.6, 6.5, 3, 3.5, B.hazard);
    spots.lift = { wing: 1, u: 24, v: 4 };
    spots.garageCars = [[9, 3.8, 1], [17, 3.8, 1], [32, 3.8, 1], [9, 16, -1], [18, 16, -1], [27, 16, -1]];
    // Exit: a real roll-up door opening out to the road
    wf(1, 38.4, 41, 5.4, 14.4, 0, 8, B.air);
    wf(1, 38.4, 40.6, 4.4, 5.4, 0, 9, B.red); wf(1, 38.4, 40.6, 14.4, 15.4, 0, 9, B.red); wf(1, 38.4, 40.6, 4.4, 15.4, 8, 9, B.red);
    spots.garage = { u: 39.6, v0: 5.4, v1: 14.4, h: 8, wing: 1 };
    wf(1, 39, 49, 5.4, 14.4, -1, 0, B.asphalt);
  }
  // Wing 3: Gaming Room, Music Studio, Movie Theater
  {
    const w = W[3]; const u = (j) => w.len * j / 4;
    // Gaming Room
    wf(3, 1, u(1) - 1, 1, 18.8, -1, 0, B.arcadeRug); lampRow(3, 0, u(1), B.ledPurple);
    for (let k = 0; k < 3; k++) {
      const v = 3 + k * 5;
      wf(3, u(1) - 4, u(1) - 1, v, v + 3, 0, 3, B.black); wf(3, u(1) - 4, u(1) - 1, v, v + 3, 3, 4, k === 1 ? B.ledPink : B.ledBlue);
      const [x, y] = w.P(u(1) - 4.9, v + 1.5); spots.arcade.push({ x, y, h: 1.6, game: ['demolition', 'cord', 'stack'][k], face: 'wing3', wing: 3 });
    }
    wf(3, 4, 8, 2, 4, 0, 1, B.black); wf(3, 4, 6, 2, 4, 1, 2, B.sofa); // racing sim corner
    wf(3, 4, 8, 15, 18, 0, 1, B.sofa); wf(3, 7, 8, 15, 18, 1, 2, B.sofa);
    // Music Studio: second room, so you walk through it to reach the theater. Gear is along the side wall to keep the way clear.
    const s0 = u(1) + 1, s1 = u(2) - 1;
    wf(3, s0, s1, 1, 18.8, -1, 0, B.walnut); lampRow(3, u(1), u(2), B.lamp);
    wf(3, s0 + 2, s0 + 3.5, 2, 4, 0, 5, B.speaker); wf(3, s0 + 10, s0 + 11.5, 2, 4, 0, 5, B.speaker);
    wf(3, s0 + 4, s0 + 9.5, 2, 3.5, 0, 1, B.walnut); wf(3, s0 + 4, s0 + 9.5, 2, 3.5, 1, 2, B.black);
    wf(3, s0 + 1, s0 + 5, 13, 18, 0, 1, B.teal); wf(3, s0 + 1, s0 + 5, 13, 14, 1, 3, B.glass);
    const [px, py] = w.P(s0 + 6.7, 5.4); spots.studio = { x: px, y: py, h: 1.6 };
    // Movie Theater: the rest of the wing, raked seats with an aisle up the middle and the screen on the end wall
    const t0 = u(2) + 1, t1 = w.len - 1;
    wf(3, u(3) - 1, u(3) + 1, 0.4, w.width - 0.4, 0, 11, B.air); // No divider inside the theater
    wf(3, t0, t1, 1, 18.8, -1, 0, B.charcoal); lampRow(3, u(2), w.len, B.starCeil);
    wf(3, u(2), t1, 0.5, 19.3, 10, 11, B.starCeil);
    for (let r = 0; r < 7; r++) {
      const a = t0 + 2 + r * 3, rise = Math.floor((6 - r) / 3);
      for (const [v0, v1] of [[2, 8], [12, 18]]) { if (rise) wf(3, a, a + 2, v0, v1, 0, rise, B.charcoal); wf(3, a, a + 2, v0, v1, rise, rise + 1, B.seat); }
    }
    const [mx, my] = w.P(w.len - 2.7, 9.9); spots.movie = { x: mx, y: my, h: 3, n: w.n };
  }
  // Wing 5: Chill Lounge, Art Gallery, Designer Closet
  {
    const w = W[5]; const u = (j) => w.len * j / 3;
    wf(5, 1, u(1) - 1, 1, 18.8, -1, 0, B.cream); lampRow(5, 0, u(1), B.lamp);
    wf(5, 3, 7, 2, 12, 0, 1, B.sofa); wf(5, 3, 4.5, 2, 12, 1, 2, B.sofa); wf(5, 6, 7, 2, 3.5, 1, 2, B.sofa);
    wf(5, 9, 13, 5, 9, 0, 1, B.walnut); wf(5, 10, 12, 6, 8, 1, 2, B.lamp); wf(5, 2, 3, 15, 18, 0, 5, B.shelf);
    const g0 = u(1) + 1, g1 = u(2) - 1;
    wf(5, g0, g1, 1, 18.8, -1, 0, B.marbleW); lampRow(5, u(1), u(2), B.panel);
    wf(5, g0 + 4, g0 + 6, 8, 12, 0, 1, B.black); wf(5, g0 + 4.5, g0 + 5.5, 9.5, 10.5, 1, 3, B.gold);
    const c0 = u(2) + 1, c1 = w.len - 1;
    wf(5, c0, c1, 1, 18.8, -1, 0, B.pink); lampRow(5, u(2), w.len, B.panel);
    for (const v of [2, 16.8]) { wf(5, c0 + 1, c1 - 1, v, v + 1.2, 0, 5, B.walnut); wf(5, c0 + 1, c1 - 1, v - 0.1, v + 1.2, 2, 3, B.gold); }
    const palette = [B.red, B.blueWall, B.catYellow, B.teal, B.white, B.black, B.velvet, B.pink];
    for (let k = 0; k < 14; k++) { wf(5, c0 + 1.4 + k, c0 + 2.2 + k, 3.4, 4.6, 0, 3, palette[k % 8]); if (k < 13) wf(5, c0 + 1.4 + k, c0 + 2.2 + k, 15.4, 16.6, 0, 3, palette[(k + 3) % 8]); }
    wf(5, c0 + 6, c0 + 9, 8.5, 11.5, 0, 1, B.gold);
    spots.gallery = { wing: 5, u0: g0, u1: g1 };
  }
  // Wing 7: three empty rooms waiting for residents
  {
    const w = W[7];
    wf(7, 1, 44, 1, 18.8, -1, 0, B.oak);
    lampRow(7, 0, 15); lampRow(7, 15, 30); lampRow(7, 30, 45);
    // First room is the kitchen, the other two wait for residents
    wf(7, 1, 14, 1, 18.8, -1, 0, B.marbleW);
    wf(7, 4, 11, 8, 12, 0, 1, B.walnut); wf(7, 4, 11, 8, 12, 1, 2, B.marbleW);
    wf(7, 1.5, 13, 1, 3, 0, 2, B.walnut); wf(7, 1.5, 13, 1, 3, 2, 3, B.marbleW); wf(7, 10, 13, 1, 3, 3, 7, B.steel); wf(7, 3, 6, 1, 1.8, 4, 6, B.walnut);
    // The other two are for sale as someone's own room: solid walls, and each has its own door on the driveway side. openrooms.js adds the doors and signs.
    spots.openRooms = [{ id: 'open-a', doorU: 18, signU: 24.5, owner: null }, { id: 'open-b', doorU: 34, signU: 39.5, owner: null }];
    for (const u of [15, 30]) wf(7, u - 0.8, u + 0.8, 4.9, 14.9, 0, 9, B.stucco); // Closes the arches
    for (const R of spots.openRooms) wf(7, R.doorU - 1.7, R.doorU + 1.7, 17.6, 21, 0, 4, B.air);
    wf(7, 20, 24, 15, 18, 0, 2, B.lumber); wf(7, 36, 40, 3, 6, 0, 1, B.lumber);
  }
  // Roof: helipad, launch pad
  disc(-28, 75, 8, 18, 19, B.black, 7); disc(-28, 75, 7, 18, 19, B.roofDeck); fill(-30, -29, 71, 79, 18, 19, B.catYellow); fill(-27, -26, 71, 79, 18, 19, B.catYellow); fill(-30, -26, 74.5, 75.5, 18, 19, B.catYellow);
  fill(14, 18, 23, 27, 18, 19, B.bounce);

  // ---------- Party dome (R = 20 keeps it between the back wings) ----------
  const DC = [-6, 112], DR = 20;
  for (let x = DC[0] - DR - 1; x <= DC[0] + DR + 1; x++) for (let y = DC[1] - DR - 1; y <= DC[1] + DR + 1; y++) {
    const d = Math.hypot(x + 0.5 - DC[0], y + 0.5 - DC[1]);
    if (d <= DR) {
      put(x, y, -1, B['disco' + (Math.abs(Math.floor(x / 4) * 7 + Math.floor(y / 4) * 13) % 6)]);
    }
    if (d <= DR && d > DR - 1.6) for (let h = 0; h < 10; h++) put(x, y, h, B.navy);
    if (d <= DR) {
      for (let h = 10; h < 30; h++) {
        const rr = Math.sqrt(Math.max(0, 1 - ((h - 10) / 15) ** 2)) * DR;
        if (h <= 25 && d <= rr && d > rr - 1.8) put(x, y, h, (x + h) % 7 === 0 ? B.starCeil : B.glassDark);
      }
    }
  }
  disc(DC[0], DC[1], 2, 25, 26, B.gold);
  fill(-8, -4, 90, 96, 0, 5, B.air); fill(-8.5, -3.5, 90, 95, -1, 0, B.redCarpet);
  fill(-11, -1, 126, 130, 0, 2, B.black); fill(-9, -3, 128, 129, 2, 3, B.black); fill(-8, -4, 128, 129, 3, 4, B.ledPink);
  for (const x of [-13, 0]) fill(x, x + 2, 126, 128, 0, 7, B.speaker);
  for (let a = 0; a < 16; a++) { const px = DC[0] + Math.cos(a / 16 * 6.283) * (DR - 2.4), py = DC[1] + Math.sin(a / 16 * 6.283) * (DR - 2.4); if (py > 96) put(px, py, 8, [B.ledPink, B.ledBlue, B.ledPurple, B.ledGreen][a % 4]); }
  spots.party = { x: DC[0], y: DC[1], r: DR };
  spots.partyButton = { x: -6, y: 127, h: 2 };

  // ---------- Hall of Fame rotunda ----------
  const RC = [-63, 25], RR = 13, RH = 30;
  disc(RC[0], RC[1], RR + 1, -1, 0, B.marble);
  for (let h = 0; h < RH; h++) disc(RC[0], RC[1], RR + 1, h, h + 1, h === 0 ? B.stone : B.trim, RR);
  for (let h = 0; h < 7; h++) disc(RC[0], RC[1], RR + 1 - h * 2, RH + h, RH + h + 1, B.gold, RR - 1 - h * 2);
  disc(RC[0], RC[1], 1, RH + 7, RH + 9, B.gold);
  disc(RC[0], RC[1], RR - 1.6 - 6, RH + 6, RH + 7, B.glass);
  fill(-50, -46, 24, 26, 0, 4, B.air); fill(-50, -47, 23, 24, 0, 5, B.trim); fill(-50, -47, 26, 27, 0, 5, B.trim); fill(-50, -47, 23, 27, 4, 5, B.trim); fill(-50, -46, 24, 26, -1, 0, B.redCarpet);
  // Free-standing spiral stair in the middle of the room, so nothing ever sits in front of the wall of faces
  const SPIN = 6.283 * 2.9, RISE = 1.55;
  disc(RC[0], RC[1], 2, 1, Math.floor(SPIN * RISE) + 4, B.gold);
  for (let a = 0; a < SPIN; a += 0.01) {
    const hh = Math.floor(a * RISE);
    for (let r = 2; r < 5.6; r += 0.4) {
      const x = RC[0] + Math.cos(a) * r, y = RC[1] + Math.sin(a) * r;
      fill(x, x + 0.01, y, y + 0.01, hh, hh + 1, B.walnut);
    }
    const x = RC[0] + Math.cos(a) * 5.7, y = RC[1] + Math.sin(a) * 5.7;
    if (hh >= 1) fill(x, x + 0.01, y, y + 0.01, hh + 1, hh + 2, B.railGold);
    if (hh >= 1 && Math.floor(a * 100) % 110 === 0) fill(x, x + 0.01, y, y + 0.01, hh + 2, hh + 3, B.lamp);
  }
  for (let a = 0; a < 6.283; a += 0.8) { const x = RC[0] + Math.cos(a) * (RR - 0.5), y = RC[1] + Math.sin(a) * (RR - 0.5); fill(x, x + 0.01, y, y + 0.01, 0, 1, B.lamp); }
  disc(RC[0], RC[1], 3, 0, 1, B.gold);
  spots.rotunda = { x: RC[0], y: RC[1], r: RR, h: RH };

  // ---------- Backyard Party: pool, deck, grill, speakers, crane ----------
  const PX0 = 52, PX1 = 90, PY0 = 13, PY1 = 37, DEPTH = 5;
  for (let x = 42; x < 96; x++) for (let y = 6; y < 44; y++) { if (!full.has(key(x, y))) put(x, y, -1, B.deck); }
  fill(34, 42, 23, 27, -1, 0, B.deck);
  // ---------- Wide foyer exits: 8 across, no step, flat wall above so the signs read in full ----------
  // East, out to the pool and festival. Runs through the corner where the two wings meet.
  fill(30, 38, 21, 29, 0, 10, B.air); fill(30, 34, 21, 29, -1, 0, B.marble); fill(34, 42, 21, 29, -1, 0, B.deck); fill(30, 38, 24, 27, -1, 0, B.redCarpet);
  fill(30, 38, 20, 21, 0, 11, B.marbleW); fill(30, 38, 29, 30, 0, 11, B.marbleW);
  fill(30, 38, 20, 30, 10, 11, B.trim); fill(30, 31, 20, 30, 10, 11, B.gold); fill(30, 31, 20, 30, 11, 17, B.marbleW);
  // West, into the Hall of Fame.
  fill(-53, -42, 21, 29, 0, 10, B.air); fill(-53, -42, 21, 29, -1, 0, B.marble); fill(-53, -42, 24, 27, -1, 0, B.redCarpet);
  fill(-50, -42, 20, 21, 0, 11, B.marbleW); fill(-50, -42, 29, 30, 0, 11, B.marbleW);
  fill(-50, -42, 20, 30, 10, 11, B.trim); fill(-43, -42, 20, 30, 10, 11, B.gold); fill(-43, -42, 20, 30, 11, 17, B.marbleW);
  fill(PX0 - 1, PX1 + 1, PY0 - 1, PY1 + 1, -DEPTH - 2, 0, B.blueStone);
  fill(PX0, PX1, PY0, PY1, -DEPTH, 0, B.water);
  fill(PX0 - 1, PX1 + 1, PY0 - 1, PY0, -1, 0, B.trim); fill(PX0 - 1, PX1 + 1, PY1, PY1 + 1, -1, 0, B.trim); fill(PX0 - 1, PX0, PY0 - 1, PY1 + 1, -1, 0, B.trim); fill(PX1, PX1 + 1, PY0 - 1, PY1 + 1, -1, 0, B.trim);
  for (let x = PX0 + 3; x < PX1; x += 6) { fill(x, x + 2, PY0 - 1, PY0, -3, -2, B.poolLight); fill(x, x + 2, PY1, PY1 + 1, -3, -2, B.poolLight); }
  for (let y = PY0 + 3; y < PY1; y += 6) { fill(PX1, PX1 + 1, y, y + 2, -3, -2, B.poolLight); fill(PX0 - 1, PX0, y, y + 2, -3, -2, B.poolLight); }
  // Steps out of the pool
  for (let k = 0; k < 4; k++) fill(PX1 - 4 + k, PX1 - 3 + k, PY0, PY0 + 6, -5, -3 + k, B.trim);
  // Diving board
  fill(66, 70, PY1 + 1, PY1 + 3, 0, 1, B.stone); fill(67, 69, PY1 - 3, PY1 + 2, 2, 3, B.bounce); fill(67, 69, PY1 + 1, PY1 + 3, 0, 3, B.stone);
  // Loungers, grill, speakers, tiki lights
  for (let x = 54; x < 66; x += 4) { fill(x, x + 2, 9, 12, 0, 1, B.white); put(x, 9, 1, B.white); put(x + 1, 9, 1, B.white); }
  fill(76, 80, 40, 42, 0, 1, B.black); fill(76, 80, 40, 42, 1, 2, B.steel); put(77, 41, 2, B.torch); put(79, 41, 2, B.torch);
  fill(92, 94, 18, 20, 0, 5, B.speaker); fill(92, 94, 30, 32, 0, 5, B.speaker);
  for (const [x, y] of [[50, 9], [92, 9], [92, 40], [58, 41], [72, 9], [84, 42]]) { fill(x, x + 1, y, y + 1, 0, 3, B.bark); put(x, y, 3, B.torch); }
  spots.grill = { x: 78, y: 39.6, h: 1.5 }; spots.yardSpeakers = { x: 91.4, y: 25, h: 1.5 };
  spots.pool = { x0: PX0, x1: PX1, y0: PY0, y1: PY1, depth: DEPTH };
  // Crane from the Day 0 lot: climb the ladder, walk the jib, jump in the pool
  const CX = 46, CY = 25;
  fill(CX - 1, CX + 2, CY - 1, CY + 2, 0, 1, B.concrete);
  for (let h = 1; h < 25; h++) {
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(CX + a, CY + b, h, B.catYellow);
    if (h % 3 === 0) { put(CX, CY - 1, h, B.catYellow); put(CX, CY + 1, h, B.catYellow); put(CX - 1, CY, h, B.catYellow); }
  }
  fill(CX - 8, CX + 36, CY - 1, CY + 2, 25, 26, B.catYellow);
  fill(CX - 8, CX + 36, CY - 2, CY - 1, 26, 27, B.rail); fill(CX - 8, CX + 36, CY + 2, CY + 3, 26, 27, B.rail); fill(CX + 35, CX + 36, CY - 2, CY + 3, 26, 27, B.rail);
  for (let h = 1; h < 26; h++) put(CX + 2, CY, h, B.ladder);
  fill(CX + 2, CX + 3, CY, CY + 1, 26, 27, B.air);
  fill(CX - 8, CX - 3, CY - 1, CY + 2, 26, 28, B.concrete); fill(CX - 2, CX + 1, CY - 1, CY + 2, 26, 29, B.white); fill(CX - 1, CX, CY, CY + 1, 26, 28, B.glass);
  fill(CX + 20, CX + 23, CY - 2, CY + 3, 26, 27, B.air); fill(CX + 21, CX + 22, CY - 2, CY + 3, 25, 26, B.bounce);
  spots.crane = { x: CX, y: CY };
  // Slide tower platform on the roof
  fill(26, 30, 23, 27, 18, 19, B.hazard); fill(32, 35, 23, 27, 19, 21, B.air); spots.slideTop = { x: 28, y: 25, h: 19 };

  // ---------- Basketball court (the big stadium is out past the railroad now) ----------
  const CT = { x0: -120, x1: -84, y0: 8, y1: 42 };
  fill(CT.x0 - 3, CT.x1 + 3, CT.y0 - 3, CT.y1 + 3, -1, 0, B.concrete);
  fill(CT.x0, CT.x1, CT.y0, CT.y1, -1, 0, B.courtWood);
  fill(CT.x0, CT.x1, CT.y0, CT.y0 + 1, -1, 0, B.courtLine); fill(CT.x0, CT.x1, CT.y1 - 1, CT.y1, -1, 0, B.courtLine); fill(CT.x0, CT.x0 + 1, CT.y0, CT.y1, -1, 0, B.courtLine); fill(CT.x1 - 1, CT.x1, CT.y0, CT.y1, -1, 0, B.courtLine);
  fill(-102.4, -101.6, CT.y0, CT.y1, -1, 0, B.courtLine); disc(-102, 25, 6, -1, 0, B.courtBlue, 0); disc(-102, 25, 6.8, -1, 0, B.courtLine, 6);
  for (const s of [1, -1]) {
    const hx = s > 0 ? CT.x0 + 3 : CT.x1 - 3;
    disc(hx, 25, 12, -1, 0, B.courtBlue); 
    fill(hx - s * 1.4, hx - s * 0.4, 24, 26, 0, 5, B.steel); fill(hx - s * 0.6, hx + s * 0.4, 22, 28, 4, 7, B.white);
  }
  // keep the floor inside the lines
  for (let x = CT.x0 - 12; x < CT.x1 + 12; x++) for (let y = 8; y < 42; y++) { if (x < CT.x0 - 3 || x >= CT.x1 + 3) { if (get(x, y, -1) === B.courtBlue) put(x, y, -1, B.grass); } }
  spots.court = { x0: CT.x0, x1: CT.x1, y0: CT.y0, y1: CT.y1, hoops: [{ x: CT.x0 + 4.4, y: 25, h: 4.7 }, { x: CT.x1 - 4.4, y: 25, h: 4.7 }] };

  // ---------- Railroad ----------
  const rail = buildRailPath(0.5);
  const near = (x, y, r) => { for (let i = 0; i < rail.pts.length; i += 6) { const p = rail.pts[i]; if (Math.hypot(p.x - x, p.y - y) < r) return true; } return false; };
  for (const p of rail.pts) {
    const top = Math.floor(p.h + 0.001);
    const onBridge = Math.abs(p.x - FX[0]) < 62 && p.y < -45;
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
      if (Math.hypot(dx, dy) > 2.8) continue;
      const x = Math.floor(p.x + dx), y = Math.floor(p.y + dy);
      const gapDrive = onBridge && Math.abs(p.x - FX[0]) < 22;
      if (gapDrive) { fill(x, x + 1, y, y + 1, top, top + 1, B.stone); }
      else if (onBridge && top > 0) { fill(x, x + 1, y, y + 1, 0, top + 1, B.stone); put(x, y, top, B.ballast); }
      else { fill(x, x + 1, y, y + 1, top, top + 1, B.ballast); }
    }
    if (onBridge && top > 1) for (const off of [-3.8, 3.8]) { put(Math.floor(p.x), Math.floor(p.y + off), top + 1, B.stone); put(Math.floor(p.x), Math.floor(p.y + off), top, B.stone); }
  }
  // Bridge piers either side of the driveway
  for (const px of [-24, -16, 3, 11]) fill(px, px + 3, -66, -58, 0, 7, B.stone);
  for (const px of [-22, 4]) fill(px, px + 1, -67, -57, 5, 7, B.stone);
  // Giza sits 53 blocks further back than the first draft, to make room for the foyer and the party dome
  const GZ = 53;
  const gizaBase = { fill, put, shell };
  {
    const fill = (a, b, c, d, h0, h1, id) => gizaBase.fill(a, b, c + GZ, d + GZ, h0, h1, id);
    const put = (x, y, h, id) => gizaBase.put(x, y + GZ, h, id);
    const shell = (a, b, c, d, h0, h1, id) => gizaBase.shell(a, b, c + GZ, d + GZ, h0, h1, id);
  // Pyramids: every course is one block up, one block in, so you can walk to the top
  const pyramid = (cx, cy, half, cap) => {
    for (let h = 0; h < half; h++) {
      const r = half - h;
      fill(cx - r, cx + r, cy - r, cy + r, h, h + 1, h % 4 === 3 ? B.pyr2 : B.pyr1);
    }
    fill(cx - 2, cx + 2, cy - 2, cy + 2, half - 1, half, B.gold); fill(cx - 1, cx + 1, cy - 1, cy + 1, half, half + 1, B.gold);
    return { x: cx, y: cy + GZ, h: half + 1, half };
  };
  const khufu = pyramid(-28, 130, 49), khafre = pyramid(46, 190, 44), menkaure = pyramid(92, 240, 25);
  // Tunnel straight through Khufu along the track
  fill(-80, 24, 125, 135, 0, 8, B.air);
  fill(-81, 25, 124, 125, 0, 9, B.stone); fill(-81, 25, 135, 136, 0, 9, B.stone); fill(-81, 25, 125, 135, 8, 9, B.stone);
  fill(-80, 24, 125, 135, -1, 0, B.ballast);
  for (let x = -74; x < 20; x += 12) { put(x, 125, 5, B.torch); put(x, 134, 5, B.torch); }
  fill(-80.5, -78.5, 124, 136, 9, 11, B.stone); fill(22.5, 24.5, 124, 136, 9, 11, B.stone);
  fill(-79, -78, 124.5, 126, 0, 9, B.stone); fill(-79, -78, 134, 135.5, 0, 9, B.stone);
  fill(22, 23, 124.5, 126, 0, 9, B.stone); fill(22, 23, 134, 135.5, 0, 9, B.stone);
  // Secret King's Chamber, off the tunnel
  fill(-30, -27, 112, 125, 0, 4, B.air); fill(-30, -27, 112, 125, -1, 0, B.stone);
  fill(-36, -21, 100, 112, 0, 9, B.air); fill(-36, -21, 100, 112, -1, 0, B.gold); shell(-37, -20, 99, 113, 0, 10, B.pyr2); fill(-36, -21, 100, 112, 9, 10, B.pyr2);
  fill(-30, -27, 112, 114, 0, 4, B.air);
  fill(-31, -26, 104, 108, 0, 2, B.pyr2); fill(-30, -27, 105, 107, 2, 3, B.gold);
  for (const [x, y] of [[-35, 101], [-22, 101], [-35, 110], [-22, 110]]) put(x, y, 6, B.torch);
  put(-31, 118, 2, B.torch); put(-26, 118, 2, B.torch);
  spots.chamber = { x: -28.5, y: 106 + GZ, h: 3.2 };
  // Sphinx, facing the house
  const SX = 32;
  fill(SX - 4, SX + 4, 80, 100, 0, 5, B.pyr1); fill(SX - 4, SX - 2, 72, 84, 0, 2, B.pyr1); fill(SX + 2, SX + 4, 72, 84, 0, 2, B.pyr1);
  fill(SX - 3, SX + 3, 76, 84, 5, 10, B.pyr1); fill(SX - 4, SX + 4, 77, 84, 7, 11, B.blueStone); fill(SX - 3, SX + 3, 76, 80, 6, 10, B.pyr1); put(SX - 2, 76, 8, B.black); put(SX + 1, 76, 8, B.black);
  spots.sphinx = { x: SX, y: 71 + GZ, h: 1.2 };
  spots.pyramids = { khufu, khafre, menkaure };

  }

  // Stations: one at the mansion, one at Giza
  const stationAt = (cx, cy, side, name) => {
    const pts = rail.pts; let bi = 0, bd = 1e9;
    for (let i = 0; i < pts.length; i += 2) { const d = Math.hypot(pts[i].x - cx, pts[i].y - cy); if (d < bd) { bd = d; bi = i; } }
    const n = pts.length, list = [];
    for (let k = -44; k <= 44; k += 1) {
      const a = pts[(bi + k * 2 + n) % n], b = pts[(bi + k * 2 + 2 + n) % n];
      const tx = b.x - a.x, ty = b.y - a.y, L = Math.hypot(tx, ty); const nx = -ty / L * side, ny = tx / L * side;
      for (let off = 3.4; off < 9.5; off += 0.5) { const X = a.x + nx * off, Y = a.y + ny * off; fill(X, X + 0.01, Y, Y + 0.01, 0, 1, off > 8.6 || off < 3.9 ? B.hazard : B.deck); list.push([X, Y]); }
      if (k % 12 === 0) { const X = a.x + nx * 6.5, Y = a.y + ny * 6.5; fill(X, X + 1, Y, Y + 1, 1, 7, B.white); }
      if (Math.abs(k) < 40) for (let off = 3.6; off < 10; off += 0.5) { const X = a.x + nx * off, Y = a.y + ny * off; fill(X, X + 0.01, Y, Y + 0.01, 7, 8, B.red); if (Math.abs(off - 6.5) < 1) fill(X, X + 0.01, Y, Y + 0.01, 8, 9, B.red); }
    }
    const m = pts[bi], m2 = pts[(bi + 2) % n]; const tx = m2.x - m.x, ty = m2.y - m.y, L = Math.hypot(tx, ty); const nx = -ty / L * side, ny = tx / L * side;
    return { x: m.x + nx * 6, y: m.y + ny * 6, s: m.s, name, nx, ny };
  };
  spots.stations = [stationAt(105, 8, -1, 'Mansion Station'), stationAt(-136, 40, 1, 'Stadium Station'), stationAt(-112, 183, -1, 'Giza Station')];

  // ---------- Construction yard from Day 0, trailer, lot sign ----------
  fill(-46, -36, -48, -44, 0, 3, B.white); fill(-46, -36, -48, -44, 2, 3, B.catYellow); put(-40, -44, 1, B.glass); put(-43, -44, 1, B.glass);
  fill(20, 26, -46, -42, 0, 1, B.lumber); fill(20, 26, -46, -42, 1, 2, B.lumber); fill(30, 34, -48, -44, 0, 1, B.lumber);
  // The giant sign: a gateway arch over the driveway you can see from the street, plus letters on the roof
  for (const px of [-42, 28]) { fill(px, px + 3, -75, -72, 0, 11, B.navy); fill(px - 1, px + 4, -76, -71, 0, 2, B.stone); }
  fill(-44, 32, -74.5, -72.5, 11, 28, B.navy); fill(-45, 33, -74.5, -72.5, 10, 11, B.gold); fill(-45, 33, -74.5, -72.5, 28, 29, B.gold); fill(-45, -44, -74.5, -72.5, 10, 29, B.gold); fill(32, 33, -74.5, -72.5, 10, 29, B.gold);
  // fill() rounds half blocks outward, so the wall really runs -75.0 to -72.0. Panels sit just outside it.
  spots.sign = { x: -6, y: -75.1, back: -71.9, h: 19.5, w: 76, h2: 17 };
  // On the roof, huge, so the driveway always has it in view
  for (const px of [-60, 44]) fill(px, px + 2, 40, 42, 13, 30, B.steel);
  for (const px of [-28, 12]) fill(px, px + 2, 40, 42, 19, 30, B.steel);
  fill(-66, 54, 40, 42, 30, 54, B.navy); fill(-67, 55, 40, 42, 29, 30, B.gold); fill(-67, 55, 40, 42, 54, 55, B.gold); fill(-67, -66, 40, 42, 29, 55, B.gold); fill(54, 55, 40, 42, 29, 55, B.gold);
  spots.roofSign = { x: -6, y: 39.9, h: 42, w: 120, h2: 24 };
  // Lot-line hedge
  for (let x = -378; x < 236; x++) { fill(x, x + 1, -109, -107, 0, 4, B.hedge); fill(x, x + 1, 372, 374, 0, 4, B.hedge); }
  for (let y = -109; y < 374; y++) { fill(-378, -376, y, y + 1, 0, 4, B.hedge); fill(234, 236, y, y + 1, 0, 4, B.hedge); }
  fill(-8.5, -3.5, -109, -107, 0, 4, B.air);
  fill(-11, -8.5, -109, -107, 0, 8, B.trim); fill(-3.5, -1, -109, -107, 0, 8, B.trim);

  // ---------- Festival stage behind the pool, facing the house ----------
  {
    const X0 = 96, X1 = 146, Y0 = 92, Y1 = 112;
    for (let x = 84; x < 158; x++) for (let y = 48; y < 92; y++) { const r = Math.hypot((x - 121) / 37, (y - 92) / 44); if (r < 1) put(x, y, -1, (x + y) % 11 ? B.grass2 : B.grass); }
    fill(X0, X1, Y0, Y1, 0, 3, B.black); fill(X0 + 1, X1 - 1, Y0, Y1 - 3, 3, 3, B.black); fill(X0, X1, Y0, Y0 + 1, 2, 3, B.gold);
    for (let k = 0; k < 3; k++) fill(112 + k * 0, 130, Y0 - 3 + k, Y0 - 2 + k, 0, k + 1, B.black);
    // Truss towers and roof
    for (const x of [X0, X1 - 2]) for (const y of [Y0 + 1, Y1 - 3]) { fill(x, x + 2, y, y + 2, 3, 28, B.steel); }
    fill(X0 - 2, X1 + 2, Y0, Y1, 28, 30, B.black); fill(X0 - 2, X1 + 2, Y0, Y0 + 1, 27, 28, B.steel);
    for (let x = X0 + 2; x < X1; x += 5) put(x, Y0 + 2, 27, [B.ledPink, B.ledBlue, B.ledPurple, B.ledGreen][(x >> 2) % 4]);
    // Speaker stacks either side
    for (const x of [X0 - 8, X1 + 3]) { fill(x, x + 5, Y0, Y0 + 5, 0, 22, B.speaker); fill(x + 1, x + 4, Y0 + 1, Y0 + 4, 22, 23, B.ledRed); }
    // Back wall for the LED screen, DJ riser
    fill(X0, X1, Y1 - 2, Y1 - 1, 3, 28, B.black);
    fill(112, 130, Y1 - 7, Y1 - 3, 3, 5, B.steel); fill(116, 126, Y1 - 6, Y1 - 5, 5, 6, B.black);
    // Lighting towers in the crowd, and a path from the pool deck
    for (const [x, y] of [[100, 62], [142, 62]]) { fill(x, x + 2, y, y + 2, 0, 16, B.steel); fill(x - 1, x + 3, y - 1, y + 3, 16, 17, B.lamp); }
    for (let t = 0; t <= 1; t += 0.01) { const x = 88 + 30 * t, y = 44 + 44 * t; fill(x - 2, x + 2, y - 2, y + 2, -1, 0, B.gravel); }
    spots.stage = { x: 121, y: 102, h: 6.4, screen: { x: 121, y: Y1 - 2.05, h: 16, w: 46, h2: 22 }, crowd: { x: 121, y: 78 }, beams: { x: 121, y: Y0 + 3, h: 26 } };
  }

  // ---------- Road from the garage to the racetrack ----------
  const roadPts = [[61, -17], [72, -38], [88, -50], [112, -50], [121, -50]];
  for (let i = 0; i < roadPts.length - 1; i++) { const a = roadPts[i], b = roadPts[i + 1], n = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let t = 0; t <= n; t += 0.5) { const x = a[0] + (b[0] - a[0]) * t / n, y = a[1] + (b[1] - a[1]) * t / n; for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 5; dy++) if (dx * dx + dy * dy <= 25 && get(x + dx, y + dy, 0) === 0) put(x + dx, y + dy, -1, Math.abs(dx) + Math.abs(dy) < 1 && Math.floor(t) % 4 < 2 ? B.roadline : B.asphalt); } }

  // ---------- Racetrack ----------
  const TRACK_PTS = [[140, -30], [168, -30], [196, -30], [218, -50], [212, -80], [180, -74], [150, -93], [124, -74]];
  const trackPath = []; {
    const P = TRACK_PTS, n = P.length;
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n], steps = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.75);
      for (let s = 0; s < steps; s++) { const t = s / steps, f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t); trackPath.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) }); }
    }
    let S = 0; trackPath.forEach((p, i) => { if (i) S += Math.hypot(p.x - trackPath[i - 1].x, p.y - trackPath[i - 1].y); p.s = S; });
    trackPath.total = S + Math.hypot(trackPath[0].x - trackPath[trackPath.length - 1].x, trackPath[0].y - trackPath[trackPath.length - 1].y);
    const HW = 7;
    for (let x = 108; x < 232; x++) for (let y = -106; y < -14; y++) {
      let d = 1e9; for (let i = 0; i < trackPath.length; i += 2) { const q = trackPath[i], dd = (q.x - x - 0.5) ** 2 + (q.y - y - 0.5) ** 2; if (dd < d) d = dd; }
      d = Math.sqrt(d);
      if (d <= HW) { put(x, y, -1, d > HW - 1 ? ((x + y) >> 1) % 2 ? B.red : B.white : B.asphalt); }
      else if (d <= HW + 1.5) {
        const inGap = x < 124 && y > -58 && y < -42; // the road comes in here
        if (!inGap) { put(x, y, -1, B.concrete); const c = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 ? B.red : B.white; fill(x, x + 1, y, y + 1, 0, 3, c); }
      }
    }
    // Start line and grandstand along the main straight
    for (let y = -37; y < -23; y++) for (let k = 0; k < 2; k++) put(170 + k, y, -1, (y + k) % 2 ? B.black : B.white);
    for (let k = 0; k < 6; k++) fill(146, 196, -21 + k, -20 + k, 0, k + 1, k % 2 ? B.red : B.white);
    fill(146, 196, -15, -14, 6, 14, B.navy); fill(146, 196, -15, -14, 14, 15, B.gold);
    spots.track = { path: trackPath, start: { x: 170, y: -30 }, board: { x: 171, y: -15.1, h: 10, w: 50, h2: 8 } };
  }
  spots.roadSigns = [[63, -9, 'RACETRACK', 0], [100, -43, 'RACETRACK', 0]];

  // ---------- Sports Stadium: full college football stadium past the railroad ----------
  {
    const CX = -262, CY = 30, BX = 36, BY = 70, RR = 28, LOW = 24, UP0 = 33, UPR = 28, TOP = UP0 + UPR, OUT = TOP + 3;
    const sdf = (x, y) => { const qx = Math.abs(x - CX) - BX + RR, qy = Math.abs(y - CY) - BY + RR; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - RR; };
    const FX0 = CX - 26.5, FX1 = CX + 26.5, FY0 = CY - 60, FY1 = CY + 60;
    const sideBox = (y) => Math.abs(y - CY) < 56;
    let seats = 0, boxSeats = 0;
    for (let x = CX - BX - OUT - 1; x < CX + BX + OUT + 1; x++) for (let y = CY - BY - OUT - 1; y < CY + BY + OUT + 1; y++) {
      const cx = x + 0.5, cy = y + 0.5, d = sdf(cx, cy); if (d >= OUT) continue;
      if (d < 0) {
        const inField = cx > FX0 && cx < FX1 && cy > FY0 && cy < FY1;
        put(x, y, -1, inField ? (Math.floor((y - FY0) / 10) % 2 ? B.turf : B.turf2) : (d > -4 ? B.courtLine : B.red));
        continue;
      }
      const th = Math.atan2(cy - CY, cx - CX), perim = 376 + 6.283 * d, sec = ((th + Math.PI) / 6.2832 * 40) % 1, aisle = sec * perim / 40 < 2.2;
      const gold = Math.floor((th + Math.PI) / 6.2832 * 40) % 5 === 0;
      let T;
      if (d < LOW) T = Math.floor(d);
      else if (d < UP0) T = LOW;
      else if (d < TOP) T = LOW + 8 + Math.floor(d - UP0);
      else T = LOW + 8 + UPR;
      fill(x, x + 1, y, y + 1, 0, T + 1, B.concrete);
      if (d < LOW) { if (aisle) put(x, y, T, B.concrete); else { put(x, y, T, gold ? B.seatGold : B.seatBlue); seats += 2; } }
      else if (d >= UP0 && d < TOP) { if (aisle) put(x, y, T, B.concrete); else { put(x, y, T, gold ? B.seatGold : B.seatBlue); seats += 2; } }
      else if (d < UP0) {
        // Boxes on the two long sides, an open concourse at the corners with stairs up to the upper deck
        if (sideBox(cy)) {
          put(x, y, T, B.marbleW); fill(x, x + 1, y, y + 1, T + 1, T + 7, B.air); fill(x, x + 1, y, y + 1, T + 7, T + 9, B.concrete);
          if (d < LOW + 1) fill(x, x + 1, y, y + 1, T + 1, T + 7, B.glass);
          else if (d < LOW + 2.2 && Math.floor(cy) % 8 !== 0) { put(x, y, T + 1, B.seat); boxSeats += 2; }
          if (Math.floor(cy) % 8 === 0 && d < UP0 - 2.5) fill(x, x + 1, y, y + 1, T + 1, T + 7, B.stucco);
          if (d >= UP0 - 3.5 && d < UP0 - 2.5 && Math.floor(cy) % 8 !== 4 && Math.floor(cy) % 8 !== 5) fill(x, x + 1, y, y + 1, T + 1, T + 7, B.stucco);
          if (Math.floor(cy) % 8 === 4 && d >= LOW + 3 && d < LOW + 5 ) put(x, y, T + 6, B.panel);
          if (d >= UP0 - 2.5 && Math.floor(cy) % 8 === 2) put(x, y, T + 6, B.lamp);
        } else {
          put(x, y, T, B.concrete);
          if (aisle) { const st = Math.min(LOW + 8, Math.floor(d)); fill(x, x + 1, y, y + 1, T, st + 1, B.concrete); }
        }
      }
      // Rim walkway, back wall and the outside of the stadium
      if (d >= TOP + 2) { fill(x, x + 1, y, y + 1, 0, T + 4, B.concrete); put(x, y, T + 3, B.gold); put(x, y, T + 4, B.gold); for (let h = 3; h < T - 1; h++) if (h % 9 < 5 && (Math.abs(x) + Math.abs(y)) % 10 < 5) put(x, y, h, B.glassDark); if (Math.floor(T / 2) > 0) { put(x, y, 2, B.navy); } }
      else if (d >= TOP + 1.2) put(x, y, T + 1, B.rail);
    }
    // Ring corridor under the lower deck, gate, side tunnels onto the field
    const TX0 = CX - 6, TX1 = CX + 6; // team tunnel at the north end
    for (let x = CX - BX - OUT; x < CX + BX + OUT; x++) for (let y = CY - BY - OUT; y < CY + BY + OUT; y++) {
      const d = sdf(x + 0.5, y + 0.5), inTeam = x >= TX0 - 1 && x < TX1 + 1 && y > CY + 40;
      if (d >= 10 && d < 20 && !inTeam) { fill(x, x + 1, y, y + 1, -1, 0, B.concrete); fill(x, x + 1, y, y + 1, 0, 6, B.air); if (d > 14 && d < 15 && (x + y) % 14 === 0) put(x, y, 5, B.panel); }
      if (d >= 0 && d < OUT + 1 && Math.abs(y + 0.5 - CY) < 7 && x > CX) { fill(x, x + 1, y, y + 1, -1, 0, B.concrete); fill(x, x + 1, y, y + 1, 0, 9, B.air); if ((x % 10 === 0) && Math.abs(y + 0.5 - CY) < 1) put(x, y, 8, B.panel); } // main gate, east
      if (d >= 0 && d < 21 && Math.abs(y + 0.5 - CY) < 4 && x < CX) { fill(x, x + 1, y, y + 1, -1, 0, B.concrete); fill(x, x + 1, y, y + 1, 0, 6, B.air); }
      if (d >= 0 && d < OUT + 1 && Math.abs(x + 0.5 - CX) < 5 && y < CY) { fill(x, x + 1, y, y + 1, -1, 0, B.concrete); fill(x, x + 1, y, y + 1, 0, 6, B.air); }
    }
    // Team tunnel from the end zone to the locker room
    const TY0 = CY + 70, TY1 = TY0 + 24, LY0 = TY1, LY1 = LY0 + 25, LX0 = CX - 24, LX1 = CX + 24;
    fill(TX0 - 1, TX1 + 1, TY0, TY1, -1, 8, B.navy); fill(TX0, TX1, TY0, TY1, 0, 7, B.air); fill(TX0, TX1, TY0, TY1, -1, 0, B.turf);
    for (let y = TY0 + 2; y < TY1; y += 4) { fill(TX0, TX1, y, y + 1, 6, 7, B.panel); put(TX0 - 1, y, 3, B.ledBlue); put(TX1, y, 3, B.ledBlue); }
    // Locker room
    fill(LX0 - 1, LX1 + 1, LY0 - 1, LY1 + 1, -1, 10, B.navy); fill(LX0, LX1, LY0, LY1, 0, 9, B.air); fill(LX0, LX1, LY0, LY1, -1, 0, B.charcoal);
    fill(TX0, TX1, LY0 - 1, LY0, 0, 7, B.air);
    for (let x = LX0 + 3; x < LX1 - 2; x += 6) for (let y = LY0 + 4; y < LY1 - 2; y += 6) fill(x, x + 2, y, y + 2, 8, 9, B.panel);
    for (let x = LX0; x < LX1; x += 2) { fill(x, x + 2, LY1 - 2, LY1, 0, 6, B.locker); put(x, LY1 - 2, 6, B.gold); }
    for (let y = LY0 + 2; y < LY1 - 3; y += 2) { fill(LX0, LX0 + 2, y, y + 2, 0, 6, B.locker); fill(LX1 - 2, LX1, y, y + 2, 0, 6, B.locker); }
    for (let x = LX0; x < LX1; x += 3) { put(x, LY0 - 1, 7, B.lamp); put(x, LY1, 7, B.lamp); } for (let y = LY0; y < LY1; y += 3) { put(LX0 - 1, y, 7, B.lamp); put(LX1, y, 7, B.lamp); }
    for (const x of [LX0 + 6, LX1 - 12]) { fill(x, x + 6, LY0 + 8, LY0 + 10, 0, 1, B.walnut); fill(x, x + 6, LY0 + 15, LY0 + 17, 0, 1, B.walnut); }
    disc(CX, LY0 + 12, 6, -1, 0, B.courtBlue); disc(CX, LY0 + 12, 3, -1, 0, B.gold);
    fill(LX0 + 3, LX0 + 10, LY0, LY0 + 1, 2, 7, B.white); fill(LX1 - 10, LX1 - 3, LY0, LY0 + 4, 0, 1, B.marbleW); fill(LX1 - 10, LX1 - 9, LY0, LY0 + 4, 0, 6, B.glass); put(LX1 - 6, LY0, 6, B.steel); put(LX1 - 4, LY0, 6, B.steel);
    // Back door out to the lawn
    fill(CX - 3, CX + 3, LY1 - 2, CY + BY + OUT + 2, -1, 0, B.concrete); fill(CX - 3, CX + 3, LY1 - 2, CY + BY + OUT + 2, 0, 5, B.air);
    // Field lights: four towers, a lit canopy of invisible glow over the field so it is bright at night
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const tx = CX + sx * (BX + 18), ty = CY + sy * (BY + 44);
      fill(tx - 1, tx + 2, ty - 1, ty + 2, 0, 74, B.steel); fill(tx - 7, tx + 8, ty - 3, ty + 4, 74, 81, B.black);
      for (let a = -6; a < 7; a += 2) for (let h = 75; h < 81; h += 2) { put(tx + a, ty - sy * 4 + (sy > 0 ? 0 : 0), h, B.panel); put(tx + a, ty + 4 * -sy, h, B.panel); }
    }
    for (let x = CX - 30; x < CX + 31; x += 8) for (let y = CY - 64; y < CY + 65; y += 8) put(x, y, 11, B.glow);
    // Scoreboard at the south end
    fill(CX - 26, CX + 26, CY - BY - TOP + 1, CY - BY - TOP + 3, TOP - 6, TOP + 14, B.black); fill(CX - 27, CX + 27, CY - BY - TOP + 1, CY - BY - TOP + 3, TOP + 14, TOP + 15, B.gold);
    // Plaza, path over the tracks, and a practice lawn
    fill(CX + BX + OUT, -146, CY - 12, CY + 12, -1, 0, B.concrete); fill(-146, -122, CY - 4, CY + 4, -1, 0, B.gravel);
    spots.stadium = { cx: CX, cy: CY, bx: BX, by: BY, rr: RR, out: OUT, top: TOP, seats, boxSeats, field: { x0: FX0, x1: FX1, y0: FY0, y1: FY1 },
      tunnel: { x0: TX0, x1: TX1, y0: TY0, y1: TY1 }, locker: { x0: LX0, x1: LX1, y0: LY0, y1: LY1 }, board: { x: CX, y: CY - BY - TOP + 3.05, h: TOP + 11, w: 50, h2: 20 }, gate: { x: CX + BX + OUT + 0.2, y: CY, h: 14, w: 70, h2: 9 }, lift: { x: CX + BX + 33, y: CY + 12 } };
    // Elevator shaft by the main gate, up to the boxes and the upper deck
    const lx = spots.stadium.lift.x, ly = spots.stadium.lift.y; fill(lx - 2, lx + 2, ly - 2, ly + 2, 0, LOW + 11, B.air); fill(lx - 2, lx + 2, ly - 2, ly + 2, -1, 0, B.gold);
  }

  // ---------- Trees ----------
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const clear = (x, y, r) => {
    for (let a = -r; a <= r; a += 2) for (let b = -r; b <= r; b += 2) {
      const id = get(x + a, y + b, -1);
      if (id !== B.grass && id !== B.grass2) return false;
      if (get(x + a, y + b, 0) || get(x + a, y + b, 2)) return false;
    }
    return !near(x, y, r + 5);
  };
  const tree = (x, y) => {
    const t = 5 + Math.floor(rnd() * 4), leaf = rnd() > 0.5 ? B.leaf : B.leaf2;
    for (let h = 0; h < t; h++) put(x, y, h, B.bark);
    const r = 3 + Math.floor(rnd() * 2);
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -2; c <= 3; c++) {
      const d = Math.hypot(a, b, c * 1.1);
      if (d <= r + (rnd() - 0.5) * 0.7 && !get(x + a, y + b, t + c)) put(x + a, y + b, t + c, leaf);
    }
  };
  const palm = (x, y) => {
    const t = 8 + Math.floor(rnd() * 3);
    for (let h = 0; h < t; h++) put(x, y, h, B.bark);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 1; k < 5; k++) { put(x + a * k, y + b * k, t - Math.floor(k / 3), B.palm); }
    put(x, y, t, B.palm);
  };
  for (let n = 0; n < 1500; n++) {
    const x = Math.floor(-372 + rnd() * 602), y = Math.floor(-102 + rnd() * 470);
    if (Math.abs(x + 6) < 22 && y < -30) continue;
    if (x > 80 && x < 165 && y > 44 && y < 118) continue; // festival lawn
    if (x > 110 && y < -10 && y > -110) continue; // racetrack
    if (clear(x, y, 4)) tree(x, y);
  }
  for (const [x, y] of [[-40, -24], [28, -30], [97, 42], [97, 6], [-30, -36], [18, -36], [-52, -12], [40, -12]]) if (get(x, y, 0) === 0) palm(x, y);
  return { spots, rail, W, full, core, hall, upper, G, get, U, DY, GZ };
}
