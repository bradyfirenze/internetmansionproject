// Real estate you can buy: Guest Houses, the Bedroom Wing and the names on the front of the house.
// To add a sold name: put it in assets/estate.json, in order, after Brady reviews it, then publish that one file. Never reorder a list: position is the spot.
//   guestHouses = lot 1, 2, 3... / bedrooms = room 1, 2, 3... / frontNames = plates on the front of the house.
// Every plate in a group shares one picture and one draw call, so hundreds of names cost about the same as ten.
import * as THREE from 'three';

const DM = 'DM @internetmansionproject. 18+.';

// ---------- Where everything goes ----------
const STREET = { x0: 114, x1: 228, y0: 8, y1: 14 };
const LOT_XS = [146, 162, 178, 194, 210], HOUSE = { w: 9, d: 8, wall: 5 }, SOUTH_Y = -4, NORTH_Y = 18;
// Stays at 0 until the 2 open Wing 7 rooms sell. Add a floor when a floor sells out: 9 rooms a floor. One spot on every floor stays saved for the stairs, so adding a floor never moves anyone's room. 0 builds nothing.
const WING = { floors: 0, x0: -115, x1: -84, y0: -26, y1: -2, hall0: -16, hall1: -12, rooms: 5, roomW: 6, floorH: 6 };
const PIERS = [-11.5, 1.5, -17.5, 7.5, -23.5, 13.5, -29.5], FRONT_ROWS = 10; // Brick between the windows, nearest the door first, so the windows stay clear

export const estateSites = { guest: { x0: 140, x1: 232, y0: -11, y1: 34 }, wing: WING.floors ? { x0: WING.x0 - 3, x1: WING.x1 + 3, y0: WING.y0 - 3, y1: WING.y1 + 3 } : null }; // No wing, no trees pulled
export const inSite = (s, x, y) => !!s && x >= s.x0 && x < s.x1 && y >= s.y0 && y < s.y1;

const wingBase = (floor) => floor * WING.floorH;
const hasStairs = () => WING.floors > 1;
const colX = (i) => WING.x0 + i * WING.roomW;
// Room 1 is nearest the entrance, on the north side. New floors only add numbers at the end.
function wingRooms() {
  const out = [];
  for (let f = 0; f < WING.floors; f++) for (const north of [true, false]) for (let i = WING.rooms - 1; i >= 0; i--) {
    if (north && i === 0) continue; // Saved for the stairs
    out.push({ f, i, north });
  }
  return out;
}

// ---------- Blocks. Runs after the trees are planted, so every other tree on the property stays exactly where it was. ----------
export function buildEstateBlocks({ fill, put, get, shell, B }, spots) {
  const COLORS = [B.cream, B.skyWall, B.pink, B.white, B.teal];
  // Street, from the rail by Mansion Station to the far lots
  for (let x = STREET.x0; x < STREET.x1; x++) for (let y = STREET.y0; y < STREET.y1; y++) if (get(x, y, -1) === B.grass || get(x, y, -1) === B.grass2) put(x, y, -1, B.gravel);

  const lots = [];
  const house = (x0, y0, faceNorth, wall) => {
    const { w, d, wall: H } = HOUSE, front = faceNorth ? y0 + d - 1 : y0;
    fill(x0, x0 + w, y0, y0 + d, -1, 0, B.oak);
    shell(x0, x0 + w, y0, y0 + d, 0, 1, B.stone); shell(x0, x0 + w, y0, y0 + d, 1, H, wall);
    for (let k = 0; k < 3; k++) fill(x0 - 1, x0 + w + 1, y0 - 1 + k, y0 + d + 1 - k, H + k, H + k + 1, B.roof);
    fill(x0 + 3, x0 + 6, front, front + 1, 0, 3, B.air); fill(x0 + 3, x0 + 6, front, front + 1, 3, 4, B.trim); // Door
    for (const a of [x0 + 1, x0 + 6]) fill(a, a + 2, front, front + 1, 1, 3, B.glass);
    const back = faceNorth ? y0 : y0 + d - 1; fill(x0 + 3, x0 + 6, back, back + 1, 1, 3, B.glass);
    put(x0 + 4, y0 + 3, H - 1, B.lamp);
    // Walk from the door to the street
    const y1 = faceNorth ? STREET.y0 : y0, y2 = faceNorth ? y0 + d : STREET.y1;
    fill(x0 + 3, x0 + 6, Math.min(y1, y2), Math.max(y1, y2), -1, 0, B.gravel);
    lots.push({ x: x0 + 4.5, faceY: faceNorth ? y0 + d + 0.05 : y0 - 0.05, rot: faceNorth ? Math.PI : 0 });
  };
  LOT_XS.forEach((x, i) => { house(x, SOUTH_Y, true, COLORS[i % COLORS.length]); house(x, NORTH_Y, false, COLORS[(i + 2) % COLORS.length]); });
  const postX = LOT_XS[0] - 5;
  for (const y of [STREET.y0 - 2, STREET.y1 + 1]) fill(postX, postX + 1, y, y + 1, 0, 7, B.navy); // Sign posts at the street's entrance
  fill(postX, postX + 1, STREET.y0 - 2, STREET.y1 + 2, 7, 10, B.navy);

  // Bedroom Wing
  const { floors, x0, x1, y0, y1, hall0, hall1, rooms, roomW, floorH } = WING;
  for (let f = 0; f < floors; f++) {
    const b = wingBase(f), top = b + floorH - 1;
    if (f === 0) fill(x0, x1, y0, y1, -1, 0, B.oak);
    shell(x0, x1, y0, y1, b, b + 1, B.stone); shell(x0, x1, y0, y1, b + 1, top, B.brick);
    fill(x0, x1, y0, y1, top, top + 1, B.trim);
    for (const wy of [hall0 - 1, hall1]) fill(x0 + 1, x1 - 1, wy, wy + 1, b, top, B.stucco); // Hall walls
    for (let i = 1; i < rooms; i++) { fill(colX(i), colX(i) + 1, y0 + 1, hall0 - 1, b, top, B.stucco); fill(colX(i), colX(i) + 1, hall1 + 1, y1 - 1, b, top, B.stucco); }
    fill(x0 + 1, x1 - 1, hall0, hall1, b, top, B.air); // Keeps the hall open at both ends
    for (let x = x0 + 4; x < x1 - 1; x += 6) put(x, -14, top - 1, B.lamp);
    for (let i = 0; i < rooms; i++) {
      const cx = colX(i);
      for (const north of [true, false]) {
        const stairs = north && i === 0;
        const doorY = north ? hall1 : hall0 - 1, outer = north ? y1 - 1 : y0;
        if (stairs) { if (hasStairs()) { fill(cx + 4, cx + 6, doorY, doorY + 1, b, b + 3, B.air); if (f === 0) fill(cx + 3, cx + 5, doorY, doorY + 1, b, b + 3, B.air); } continue; }
        fill(cx + 3, cx + 5, doorY, doorY + 1, b, b + 3, B.air); // Door
        fill(cx + 2, cx + 5, outer, outer + 1, b + 1, b + 3, B.glass); // Window
        const bedY = north ? y1 - 5 : y0 + 1; // Bed under the window, then a light
        fill(cx + 1, cx + 3, bedY, bedY + 4, b, b + 1, B.white); fill(cx + 1, cx + 3, north ? bedY + 3 : bedY, (north ? bedY + 3 : bedY) + 1, b + 1, b + 2, B.pillow);
        put(cx + 3, north ? y1 - 5 : y0 + 4, top - 1, B.lamp);
      }
    }
    if (hasStairs() && f < floors - 1) { // One block up, one block in, like the pyramids
      const cx = colX(0), yS = hall1 + 1;
      for (let s = 0; s < floorH; s++) fill(cx + 1, cx + 4, yS + s, yS + s + 1, b, b + s + 1, B.trim);
      fill(cx + 1, cx + 4, yS, yS + floorH, top, top + 1, B.air);
      for (let s = 0; s < floorH - 1; s++) fill(cx + 1, cx + 4, yS + s, yS + s + 1, b + s + 1, top, B.air);
    }
    // Entrance on the end facing Wing 7, and a window at the far end upstairs
    if (f === 0) fill(x1 - 1, x1, hall0, hall1, b, b + 4, B.air);
    else fill(x1 - 1, x1, hall0 + 1, hall1 - 1, b + 1, b + 3, B.glass);
  }
  const wingH = floors * floorH;
  if (floors) fill(x0 - 1, x1 + 1, y0 - 1, y1 + 1, wingH, wingH + 1, B.gold);

  spots.estate = { lots, wingTop: wingH };
}

// ---------- Plates ----------
const CELL = { w: 256, h: 64, cols: 4, rows: 16 }; // One picture holds up to 64 names and is only as tall as it needs to be

function plateGroup(scene, slots, paintCell) {
  const pages = [];
  const page = (n) => {
    if (pages[n]) return pages[n];
    const c = document.createElement('canvas'); c.width = 1024; c.height = CELL.h;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: tex }));
    mesh.userData.fixed = true; scene.add(mesh);
    return (pages[n] = { c, x: c.getContext('2d'), tex, mesh, items: [] });
  };
  const perPage = CELL.cols * CELL.rows, right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  // show: [{ slot, text, sold }]
  const set = (show) => {
    pages.forEach((p) => { p.items.length = 0; });
    show.forEach((it, i) => page(Math.floor(i / perPage)).items.push(it));
    for (const p of pages) {
      const pos = [], uv = [];
      const used = Math.max(1, Math.ceil(p.items.length / CELL.cols)); let rows = 1; while (rows < used) rows *= 2;
      if (p.c.height !== rows * CELL.h) { p.c.height = rows * CELL.h; p.tex.dispose(); }
      p.x.clearRect(0, 0, p.c.width, p.c.height);
      p.items.forEach((it, k) => {
        const col = k % CELL.cols, row = Math.floor(k / CELL.cols), s = slots[it.slot];
        p.x.save(); p.x.translate(col * CELL.w, row * CELL.h); paintCell(p.x, CELL.w, CELL.h, it); p.x.restore();
        right.set(Math.cos(s.rot), 0, -Math.sin(s.rot)).multiplyScalar(s.w / 2);
        const top = up.clone().multiplyScalar(s.h / 2), P = (a, b) => [s.pos.x + right.x * a + top.x * b, s.pos.y + top.y * b, s.pos.z + right.z * a + top.z * b];
        const a = P(-1, -1), b = P(1, -1), c = P(1, 1), d = P(-1, 1);
        pos.push(...a, ...b, ...c, ...a, ...c, ...d);
        const u0 = col / CELL.cols, u1 = (col + 1) / CELL.cols, v1 = 1 - row / rows, v0 = 1 - (row + 1) / rows;
        uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      });
      const g = p.mesh.geometry;
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeBoundingSphere(); p.mesh.visible = p.items.length > 0; p.tex.needsUpdate = true;
    }
  };
  return { set, pages };
}

const fitText = (x, text, w, h, size, font) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${size}px ${font}`; x.fillText(text, w / 2, h / 2 + 2, w - 18); };
const handle = (n) => '@' + String(n).replace(/^@/, '');

export function buildEstate(game, data, H) {
  const { scene } = game, { spots } = data, { P3, addE, textCanvas, DISPLAY } = H, S = spots.estate;
  const flat = (w, h, pos, rot, tex) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex })); m.position.copy(pos); m.rotation.y = rot; m.userData.fixed = true; scene.add(m); return m; };
  const paintDark = (x, w, h, it) => {
    x.fillStyle = '#10131c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f5c518'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4);
    x.fillStyle = it.sold ? '#fff' : '#f5c518'; fitText(x, it.text, w, h, 34, DISPLAY);
  };
  const paintBrass = (x, w, h, it) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e6c35a'); g.addColorStop(1, '#b98f25'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#6d5210'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4);
    x.fillStyle = it.sold ? '#1a1408' : 'rgba(26,20,8,.72)'; fitText(x, it.text, w, h, 32, DISPLAY);
  };

  // Guest Houses
  const lotSlots = S.lots.map((l) => ({ pos: P3(l.x, l.faceY, 4.4), rot: l.rot, w: 4.2, h: 1.05 }));
  const lotPlates = plateGroup(scene, lotSlots, paintDark);

  // Bedroom Wing: plate over each door, in the hall
  const roomSlots = wingRooms().map((r) => ({ pos: P3(colX(r.i) + 4, r.north ? WING.hall1 - 0.05 : WING.hall0 + 0.05, wingBase(r.f) + 3.65), rot: r.north ? 0 : Math.PI, w: 3.4, h: 0.85 }));
  const roomPlates = plateGroup(scene, roomSlots, paintDark);

  // Names on the front of the house: lowest row first, one row at a time, door outward
  const frontSlots = [];
  for (let row = 0; row < FRONT_ROWS; row++) for (const x of PIERS) frontSlots.push({ pos: P3(x, 9.95, 2.5 + row * 0.8), rot: 0, w: 2.7, h: 0.66 });
  const frontPlates = plateGroup(scene, frontSlots, paintBrass);

  const setNames = (d = {}) => {
    const list = (a) => (Array.isArray(a) ? a : []).filter((n) => typeof n === 'string' && n);
    const guests = list(d.guestHouses), rooms = list(d.bedrooms), front = list(d.frontNames);
    lotPlates.set(lotSlots.map((_, i) => ({ slot: i, text: guests[i] ? handle(guests[i]) : 'YOUR NAME HERE', sold: !!guests[i] })));
    roomPlates.set(roomSlots.map((_, i) => ({ slot: i, text: rooms[i] ? handle(rooms[i]) : `ROOM ${i + 1}: YOUR NAME HERE`, sold: !!rooms[i] })));
    const shown = front.slice(0, frontSlots.length).map((n, i) => ({ slot: i, text: handle(n), sold: true })); // Only sold plates show, so the front stays clean
    if (front.length < frontSlots.length) shown.push({ slot: front.length, text: 'YOUR NAME HERE', sold: false }); // One open plate shows what's for sale
    frontPlates.set(shown);
  };
  setNames();
  document.fonts?.ready.then(() => setNames(game.estate.current));
  game.estate = { current: {}, set(d) { this.current = d; setNames(d); }, slots: { lots: lotSlots.length, rooms: roomSlots.length, front: frontSlots.length } };
  fetch('assets/estate.json', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => game.estate.set(d)).catch(() => {}); // No list means everything stays open

  // Signs
  const banner = (lines) => textCanvas(1024, 256, (c, W, Hh) => {
    c.fillStyle = '#10131c'; c.fillRect(0, 0, W, Hh); c.strokeStyle = '#f5c518'; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, Hh - 10); c.textAlign = 'center';
    c.fillStyle = '#f5c518'; c.font = `104px ${DISPLAY}`; c.fillText(lines[0], W / 2, 118, W - 50);
    c.fillStyle = '#fff'; c.font = `50px ${DISPLAY}`; c.fillText(lines[1], W / 2, 205, W - 50);
  });
  const read = (pos, prompt, msg) => addE({ pos, r: 5, any: true, prompt: () => prompt, use: () => { game.notice(msg); game.sound.fx('click'); } });

  const px = LOT_XS[0] - 5 - 0.06;
  flat(9.6, 2.9, P3(px, (STREET.y0 + STREET.y1) / 2, 8.5), -Math.PI / 2, banner(['GUEST HOUSES', `WANT ONE? ${DM}`]));
  read(P3(px, 11, 1.5), 'Read the sign', `A guest house with your name on it. Want one? ${DM}`);

  if (WING.floors) {
    const tex = banner(['THE BEDROOM WING', `WANT A ROOM? ${DM}`]);
    flat(6.6, 1.9, P3(WING.x1 + 0.06, -14, 5), Math.PI / 2, tex); // Over the entrance
    flat(14, 4.2, P3(-99.5, WING.y0 - 0.06, 3.1), Math.PI * 0, tex); // Toward the driveway
    read(P3(WING.x1 + 1.5, -14, 1.5), 'Read the sign', `A bedroom with your name on the door. Want one? ${DM}`);
  }

  // Above the ground floor windows, either side of the entrance columns: parked cars can't block it from the driveway
  const band = (w, text, gold) => textCanvas(w * 64, 115, (c, W, Hh) => { c.fillStyle = '#10131c'; c.fillRect(0, 0, W, Hh); c.fillStyle = gold ? '#f5c518' : '#fff'; c.font = `84px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, Hh / 2 + 3, W - 30); });
  flat(14, 1.8, P3(-25, 9.95, 11.95), 0, band(14, 'THESE NAMES ARE ON THE HOUSE', true));
  flat(14, 1.8, P3(12.5, 9.95, 11.95), 0, band(14, `WANT YOURS UP? ${DM}`, false));
}
