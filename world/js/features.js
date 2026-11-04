// Everything you can touch: doors, train, zipline, slide, car, party dome, Hall of Fame, TVs, hoops, gold bricks.
import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';
import { litProp } from './voxels.js';
import { GAMES } from './arcade.js';
import { buildCars } from './cars.js';
import { buildExtras } from './extras.js';
import { buildStadium } from './stadium.js';
import { seatSigns } from './signs.js';

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

function textCanvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const DISPLAY = 'Anton, Impact, "Arial Narrow", sans-serif';

export function buildFeatures(game, data, assets) {
  const { scene, V, player, sound } = game, { spots, rail, G, W } = data;
  const P3 = (x, y, h) => new THREE.Vector3(x, G + h, -y);
  const ents = game.entities;
  const addE = (e) => { ents.push(e); return e; };
  const envAt = (mat, pos) => mat.setEnv(V.lightW(pos.x, pos.y, pos.z));
  const tick = (fn) => game.tickers.push(fn);

  // ---------- Doors ----------
  const makeDoor = ({ x, y, w, h, h0, color = 0x2a3a6a, label, prompt, cells, style, onOpen, startOpen }) => {
    const hinge = new THREE.Group(); hinge.position.copy(P3(x, y + 0.5, h0));
    const mat = litProp(color); const knob = litProp(0xf5c518);
    const leaf = box(w, h, 0.22, mat); leaf.position.set(w / 2, h / 2, 0); hinge.add(leaf);
    const k = box(0.16, 0.16, 0.4, knob); k.position.set(w - 0.3, 1.25, 0); hinge.add(k);
    if (style === 'shelf') { const t = textCanvas(128, 192, (c, W2, H2) => { c.fillStyle = '#46291a'; c.fillRect(0, 0, W2, H2); for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) { c.fillStyle = ['#942830', '#2c488c', '#326e46', '#b28a32', '#5a3278'][(r * 3 + i * 7) % 5]; c.fillRect(6 + i * 10, 8 + r * 46, 8, 34 - ((i * r) % 3) * 4); } c.fillStyle = '#2a170d'; for (let r = 0; r < 5; r++) c.fillRect(0, r * 46, W2, 6); }); leaf.material = litProp(0xffffff, { map: t }); hinge.remove(k); }
    scene.add(hinge);
    const center = P3(x + w / 2, y + 0.5, h0 + 1.2);
    envAt(leaf.material, center); envAt(knob, center);
    const list = cells || []; if (!cells) for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) list.push([x + a + 0.5, G + h0 + b + 0.5, -y - 0.5]);
    V.setBarrier(list, true);
    const d = { open: false, a: 0, hinge, slide: style === 'shelf' };
    const toggle = () => { d.open = !d.open; V.setBarrier(list, !d.open); sound.fx(d.open ? 'door' : 'slam'); if (d.open && onOpen) onOpen(); };
    addE({ pos: center, r: 3.4, prompt: () => (d.open ? 'Close' : (prompt || 'Open')) + (label ? ` ${label}` : ''), use: toggle });
    tick((dt) => { const tgt = d.open ? 1 : 0; d.a += (tgt - d.a) * Math.min(1, dt * 7); if (d.slide) hinge.position.x = x + d.a * (w - 0.1); else hinge.rotation.y = d.a * 1.7; });
    if (startOpen) toggle();
    return d;
  };

  // Two really tall front doors, one leaf each way
  {
    const F = spots.frontDoor, mats = litProp(0x8a5a2c), trim = litProp(0xf5c518), hw = F.w / 2, cen = P3(F.x + hw, F.y + 0.5, F.h0 + 3), L = new THREE.Group(), Rr = new THREE.Group();
    L.position.copy(P3(F.x, F.y + 0.5, F.h0)); Rr.position.copy(P3(F.x + F.w, F.y + 0.5, F.h0));
    const leaf = (g, s) => { const m = box(hw, F.h, 0.3, mats); m.position.set(s * hw / 2, F.h / 2, 0); g.add(m); for (const y of [2, 4.2, 6.4]) { const r = box(hw - 0.5, 0.14, 0.34, trim); r.position.set(s * hw / 2, y, 0); g.add(r); } const k = box(0.2, 0.9, 0.5, trim); k.position.set(s * (hw - 0.3), 2.6, 0); g.add(k); };
    leaf(L, 1); leaf(Rr, -1); scene.add(L, Rr); envAt(mats, cen.clone().setZ(cen.z + 3)); envAt(trim, cen.clone().setZ(cen.z + 3));
    const cells = []; for (let a = 0; a < F.w; a++) for (let b = 0; b < F.h; b++) cells.push([F.x + a + 0.5, G + F.h0 + b + 0.5, -F.y - 0.5]);
    V.setBarrier(cells, true);
    let open = false, t = 0;
    addE({ pos: cen, r: 5, any: true, prompt: () => `${open ? 'Close' : 'Open'} the front doors`, use: () => { open = !open; V.setBarrier(cells, !open); sound.fx(open ? 'door' : 'slam'); if (open) game.achieve('enter'); } });
    tick((dt) => { t += ((open ? 1 : 0) - t) * Math.min(1, dt * 3.5); L.rotation.y = t * 1.75; Rr.rotation.y = -t * 1.75; });
  }
  makeDoor({ x: spots.partyDoor.x, y: spots.partyDoor.y, w: 4, h: 5, h0: 0, color: 0x14162a, label: 'the Party Room' });
  // Winner rooms upstairs, with name plates on the hall wall
  for (const R of spots.roomDoors) {
    const info = assets.rooms.find((r) => r.room === R.room);
    const colors = { 1: 0x1f4fa8, 2: 0x330a0e, 3: 0x1a1640, 4: 0xa98a52, 5: 0x4a78a8, 6: 0x4b2178, 7: 0xe8701c, 8: 0x8a6d3a, 9: 0xc84a80 };
    makeDoor({ x: R.x, y: R.y, w: R.w, h: R.h, h0: R.h0, color: colors[R.room] || 0x444444, label: `Room ${R.room}` });
    const t = textCanvas(320, 96, (c, w, h) => { c.fillStyle = '#10131c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f5c518'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); c.fillStyle = '#f5c518'; c.font = `34px ${DISPLAY}`; c.textAlign = 'center'; c.fillText(`ROOM ${R.room}`, w / 2, 42); c.fillStyle = '#fff'; c.font = '20px Inter, sans-serif'; let s = '@' + info.handle; if (s.length > 24) s = s.slice(0, 23) + '.'; c.fillText(s, w / 2, 76); });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.72), new THREE.MeshBasicMaterial({ map: t }));
    const north = R.y === 77; // hall is south of north-row doors
    plate.position.copy(P3(R.x + 1, R.y + (north ? -0.03 : 1.03), R.h0 + 3.5));
    plate.rotation.y = north ? 0 : Math.PI;
    scene.add(plate);
  }
  // Room 10 door, the secret bookcase, the garage door
  {
    const mat = litProp(0xc9a227), hinge = new THREE.Group(); hinge.position.set(26.5, G + 13, -74);
    const leaf = box(2, 3, 0.22, mat); leaf.position.set(1, 1.5, 0); hinge.add(leaf); hinge.rotation.y = Math.PI / 2; scene.add(hinge);
    const cells = []; for (const z of [-74.5, -75.5]) for (let h = 13; h < 16; h++) cells.push([26.5, G + h + 0.5, z]);
    V.setBarrier(cells, true); envAt(mat, P3(26.5, 75, 14));
    let open = false, a = 0;
    addE({ pos: P3(26.5, 75, 14), r: 3.4, prompt: () => `${open ? 'Close' : 'Open'} Room 10`, use: () => { open = !open; V.setBarrier(cells, !open); sound.fx(open ? 'door' : 'slam'); } });
    tick((dt) => { a += ((open ? 1 : 0) - a) * Math.min(1, dt * 7); hinge.rotation.y = Math.PI / 2 - a * 1.7; });
  }
  makeDoor({ ...spots.secret.door, color: 0x46291a, style: 'shelf', prompt: 'Pull the odd book on', label: 'the bookcase', onOpen: () => game.achieve('secret') });

  // ---------- Railroad ----------
  const pts = rail.pts, N = pts.length;
  const pAt = (s) => {
    s = ((s % rail.total) + rail.total) % rail.total; let lo = 0, hi = N - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m].s <= s) lo = m; else hi = m - 1; }
    const a = pts[lo], b = pts[(lo + 1) % N], segL = (lo + 1 < N ? b.s : rail.total) - a.s, t = (s - a.s) / Math.max(segL, 1e-6);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: a.h + (b.h - a.h) * t, dx: b.x - a.x, dy: b.y - a.y, dh: b.h - a.h };
  };
  // Rails and ties
  {
    const steelM = litProp(0xc4c8d0), tieM = litProp(0x4a3220);
    const ribbon = (off) => {
      const pos = [], idx = []; const STEP = 6;
      for (let i = 0; i <= N; i += STEP) {
        const p = pts[i % N], q = pts[(i + STEP) % N], dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        const y = G + 1.32 + p.h; const cx = p.x + nx * off, cz = -(p.y + ny * off), w = 0.12;
        pos.push(cx - nx * w, y, cz + ny * w, cx + nx * w, y, cz - ny * w);
        if (i + STEP <= N) { const b = pos.length / 3 - 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, steelM); steelM.side = THREE.DoubleSide; scene.add(m);
    };
    ribbon(-1.15); ribbon(1.15);
    const count = Math.floor(rail.total / 2), ties = new THREE.InstancedMesh(new THREE.BoxGeometry(3.6, 0.22, 0.6), tieM, count);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), S1 = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) { const p = pAt(i * 2), a = Math.atan2(p.dy, p.dx); Q.setFromAxisAngle(Y, a + Math.PI / 2); M.compose(new THREE.Vector3(p.x, G + 1.12 + p.h, -p.y), Q, S1); ties.setMatrixAt(i, M); }
    scene.add(ties);
  }
  // Train, using the Day 2 colors
  const stations = spots.stations.map((s) => ({ ...s }));
  const makeCar = (kind) => {
    const g = new THREE.Group(), shell = new THREE.Group(); g.add(shell);
    const navy = litProp(0x1d2a4e), red = litProp(0xc8252f), cream = litProp(0xf0e6d0), glass = litProp(0x7fb6d8), goldM = litProp(0xf5c518);
    const mats = [navy, red, cream, glass, goldM];
    const base = box(4.2, 1.0, kind === 'loco' ? 10.4 : 9.4, navy); base.position.y = 1.0; g.add(base);
    if (kind === 'loco') {
      const boil = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 6.8, 16), red); boil.rotation.x = Math.PI / 2; boil.position.set(0, 3.0, -1.4); shell.add(boil);
      const cab = box(3.9, 3.6, 3.6, red); cab.position.set(0, 3.2, 3.3); shell.add(cab);
      const top = box(4.4, 0.4, 4.4, navy); top.position.set(0, 5.2, 3.3); shell.add(top);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 2.2, 10), navy); st.position.set(0, 5.1, -3.3); shell.add(st);
      const nose = box(4.0, 1.6, 0.8, goldM); nose.position.set(0, 1.2, -5.4); shell.add(nose);
      [-1, 1].forEach((s) => { const w = box(0.1, 1.2, 2.2, glass); w.position.set(s * 1.97, 3.9, 3.3); shell.add(w); });
      g.scale.set(1.3, 1.2, 1.2);
    } else {
      // Hollow passenger car you can walk into: open doors on both sides, open windows, benches, ceiling light.
      base.visible = false;
      const parts = carParts();
      [[parts.navy, navy], [parts.cream, cream], [parts.red, red]].forEach(([geo, mat]) => shell.add(new THREE.Mesh(geo, mat)));
      shell.add(new THREE.Mesh(parts.glass, carGlass)); shell.add(new THREE.Mesh(parts.lamp, carLamp));
    }
    const wheelR = kind === 'loco' ? 0.55 : 0.42, wheelX = kind === 'loco' ? 2 : 1.15;
    [-3.6, 3.6].forEach((z) => [-wheelX, wheelX].forEach((x) => { const wh = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.3, 12), litProp(0x20222a)); wh.rotation.z = Math.PI / 2; wh.position.set(x, wheelR, z); g.add(wh); mats.push(wh.material); }));
    scene.add(g); g.userData = { shell, mats, envT: Math.random() }; return g;
  };
  // Passenger car shape, built once and shared. Local y: floor top at CAR.floor, x is across, z is along the car.
  const CAR = { len: 12, half: 3.1, floor: 0.85, door: 1.8, doorTop: 4.6, top: 5.25 };
  const carGlass = new THREE.MeshBasicMaterial({ color: 0xbfe0f4, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const carLamp = new THREE.MeshBasicMaterial({ color: 0xfff1cf });
  let carPartsCache = null;
  function carParts() {
    if (carPartsCache) return carPartsCache;
    const sets = { navy: [], cream: [], red: [], glass: [], lamp: [] };
    const add = (set, w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); sets[set].push(b); };
    const { len: L, half: X, floor: F, door: D, doorTop: DT, top: T } = CAR, wallX = X - 0.08, sill = F + 1.45, head = DT - 0.65;
    add('navy', X * 2, 0.45, L, 0, F - 0.225, 0); add('red', 1.7, 0.03, L - 0.6, 0, F + 0.015, 0);
    add('red', X * 2 + 0.5, 0.36, L + 0.3, 0, T + 0.18, 0); add('lamp', 0.6, 0.05, L - 2.4, 0, T - 0.03, 0);
    for (const z of [-L / 2 + 0.08, L / 2 - 0.08]) add('cream', X * 2, T - F, 0.16, 0, (T + F) / 2, z);
    for (const s of [-1, 1]) {
      add('cream', 0.16, T - DT, L, s * wallX, (T + DT) / 2, 0); // Band over the windows and doors
      for (const dir of [-1, 1]) {
        const a = D, b = L / 2, mid = dir * (a + b) / 2, len = b - a;
        add('cream', 0.16, sill - F, len, s * wallX, (sill + F) / 2, mid); // Under the window
        add('cream', 0.16, DT - head, len, s * wallX, (DT + head) / 2, mid); // Over the window
        add('glass', 0.04, head - sill, len, s * wallX, (head + sill) / 2, mid);
        for (const z of [a + 0.1, (a + b) / 2, b - 0.1]) add('cream', 0.2, head - sill, 0.2, s * wallX, (head + sill) / 2, dir * z); // Window posts
        add('navy', 0.95, 0.5, len - 0.5, s * (X - 0.62), F + 0.25, mid); // Bench
        add('navy', 0.16, 0.9, len - 0.5, s * (X - 0.24), F + 0.95, mid); // Bench back
      }
    }
    const merged = {};
    for (const k in sets) {
      const pos = [], nor = [], idx = []; let base = 0;
      for (const b of sets[k]) { pos.push(...b.attributes.position.array); nor.push(...b.attributes.normal.array); for (const i of b.index.array) idx.push(i + base); base += b.attributes.position.count; b.dispose(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); merged[k] = g;
    }
    return (carPartsCache = merged);
  }
  const train = { cars: [makeCar('loco'), makeCar('car'), makeCar('car'), makeCar('car'), makeCar('car')], s: stations[0].s - 140, v: 0, wait: 0, nextStop: 0, rider: null, cool: 0 };
  const SPACING = 13.6, TOP = 22, STOP_TIME = 14;
  const stopS = (i) => stations[i].s + SPACING * 2 + 2;
  const distTo = (i) => ((stopS(i) - train.s) % rail.total + rail.total) % rail.total;
  // Pick the next stop from where the train actually is, not a fixed start
  train.nextStop = distTo(0) < distTo(1) ? 0 : 1;
  const placeCars = (dt) => {
    train.cars.forEach((car, k) => {
      const p = pAt(train.s - k * SPACING - 0.5), py = G + 1.15 + p.h;
      const yaw = Math.atan2(p.dx, -p.dy) + Math.PI;
      car.position.set(p.x, py, -p.y);
      const pitch = Math.atan2(p.dh, Math.hypot(p.dx, p.dy));
      car.rotation.order = 'YXZ'; car.rotation.set(-pitch * -1, yaw, 0);
      car.userData.heading = yaw;
      car.userData.envT += dt;
      if (car.userData.envT > 0.3) { car.userData.envT = 0; const L = V.lightW(p.x, py + 3, -p.y); car.userData.mats.forEach((m) => m.setEnv(L)); }
    });
  };
  tick((dt) => {
    const d = distTo(train.nextStop);
    if (train.wait > 0) {
      train.wait -= dt; train.v = 0;
      if (train.wait <= 0) { train.nextStop = (train.nextStop + 1) % stations.length; sound.fx('whistle'); }
    } else {
      const target = Math.min(TOP, Math.sqrt(2 * 5 * Math.max(0, d)) + 0.6);
      train.v += Math.max(-9, Math.min(5, target - train.v)) * dt * 2;
      train.s += train.v * dt;
      if (d < 0.4 || d > rail.total - 2) {
        train.wait = STOP_TIME; train.v = 0; const st = stations[train.nextStop];
        if (train.rider !== null) game.notice(`${st.name}. Walk out a door to get off.`);
        else if (Math.hypot(player.pos.x - st.x, player.pos.z + st.y) < 60) { game.notice(`Train's in at ${st.name}. Walk through a door to get on.`); sound.fx('whistle'); }
      }
    }
    train.s = ((train.s % rail.total) + rail.total) % rail.total;
    placeCars(dt);
    // Walking into a stopped car puts you on board
    train.cool = Math.max(0, train.cool - dt);
    if (train.wait > 0 && !player.locked && train.rider === null && train.cool === 0) {
      for (let k = 1; k < train.cars.length; k++) {
        const car = train.cars[k]; car.updateMatrixWorld(true); carLocal.copy(player.pos); car.worldToLocal(carLocal);
        if (Math.abs(carLocal.x) < CAR.half && Math.abs(carLocal.z) < CAR.len / 2 && carLocal.y > -1.5 && carLocal.y < CAR.top) { boardCar(k, carLocal.x, carLocal.z); break; }
      }
    }
    // Standing on the track is a bad idea
    if (!player.locked && train.v > 6) {
      const c = train.cars[0], dx = player.pos.x - c.position.x, dz = player.pos.z - c.position.z, dy = player.pos.y - c.position.y;
      if (Math.hypot(dx, dz) < 5 && dy < 4 && dy > -2) {
        const L = Math.hypot(dx, dz) || 1; player.vel.set(dx / L * 22, 18, dz / L * 22); player.onGround = false; sound.fx('crash'); sound.fx('horn');
        game.notice('You got hit by the train. It has the right of way.'); game.achieve('trainhit');
      }
    }
  });
  const carLocal = new THREE.Vector3(), carMove = new THREE.Vector3(), UP_AXIS = new THREE.Vector3(0, 1, 0);
  const boardCar = (k, startX = 0, startZ = 0) => {
    const car = train.cars[k]; train.rider = k; sound.fx('door');
    const edgeX = CAR.half - 0.55, edgeZ = CAR.len / 2 - 0.6, WALK = 5.2;
    let rx = Math.max(-edgeX, Math.min(edgeX, startX)), rz = Math.max(-edgeZ, Math.min(edgeZ, startZ));
    let last = car.userData.heading, lapped = 0, prevS = train.s, off = rx >= 0 ? 1 : -1;
    const standAt = (out) => { car.updateMatrixWorld(true); out.set(rx, CAR.floor, rz); car.localToWorld(out); return out; };
    const leave = () => {
      train.rider = null; train.cool = 1.2;
      for (const side of [off, -off]) {
        carLocal.set(side * (CAR.half + 2.2), 0, Math.max(-CAR.door, Math.min(CAR.door, rz))); car.updateMatrixWorld(true); car.localToWorld(carLocal);
        for (let h = -3; h < 12; h++) if (!player.hit(carLocal.x, carLocal.y + h, carLocal.z) && player.hit(carLocal.x, carLocal.y + h - 1, carLocal.z)) { player.teleport(carLocal.x, carLocal.y + h, carLocal.z); return; }
      }
      player.teleport(carLocal.x, carLocal.y + 2, carLocal.z); // Bridge or no ground beside the track: drop from here
    };
    player.vel.set(0, 0, 0);
    if (train.wait > 0) game.notice('All aboard. Walk around, then walk out a door when it stops. E hops off any time.');
    player.locked = {
      label: 'train', exitLabel: 'Hop off the train',
      camera(cam) {
        const a = car.userData.heading - last; last = car.userData.heading;
        player.yaw += a; cam.rotation.order = 'YXZ'; cam.rotation.set(player.pitch, player.yaw, 0);
        standAt(cam.position); cam.position.y += 1.62;
      },
      update(dt, input) {
        let ds = train.s - prevS; if (ds < -rail.total / 2) ds += rail.total; prevS = train.s; lapped += ds;
        if (lapped > 150) game.achieve('train');
        // Walk inside the car, in its own coordinates so it doesn't matter where the track is heading
        const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
        carMove.set(-sy * input.fwd + cy * input.side, 0, -cy * input.fwd - sy * input.side).applyAxisAngle(UP_AXIS, -car.userData.heading);
        rx += carMove.x * WALK * dt; rz += carMove.z * WALK * dt;
        rz = Math.max(-edgeX * 2, Math.min(edgeX * 2, rz)); rz = Math.max(-edgeZ, Math.min(edgeZ, rz));
        if (Math.abs(rx) > edgeX) {
          off = rx > 0 ? 1 : -1;
          if (train.wait > 0 && Math.abs(rz) < CAR.door) { player.locked = null; leave(); return; } // Out the door onto the platform
          rx = off * edgeX;
        }
        standAt(player.pos);
      },
      exit() { leave(); },
    };
  };
  addE({
    dyn: true, r: 7.5, any: true, priority: 4,
    get pos() { let best = train.cars[1], bd = 1e9; for (const c of train.cars) { const d = c.position.distanceToSquared(player.pos); if (d < bd) { bd = d; best = c; } } return best.position; },
    prompt: () => (train.v < 3 ? 'Board the train' : null),
    use: () => { let bk = 1, bd = 1e9; for (let k = 1; k < train.cars.length; k++) { const d = train.cars[k].position.distanceToSquared(player.pos); if (d < bd) { bd = d; bk = k; } } boardCar(bk); },
  });
  stations.forEach((st, i) => {
    const b = new THREE.Group(); const pole = box(0.3, 1.6, 0.3, litProp(0x20222a)); pole.position.y = 0.8; b.add(pole);
    const head = box(0.9, 0.7, 0.9, new THREE.MeshBasicMaterial({ color: 0xff5a72 })); head.position.y = 1.9; b.add(head);
    const tx = st.ny, ty = -st.nx; b.position.copy(P3(st.x + tx * 3, st.y + ty * 3, 1)); scene.add(b); envAt(pole.material, b.position);
    addE({ pos: P3(st.x + tx * 3, st.y + ty * 3, 2.5), r: 3.6, prompt: () => `Call the train to ${st.name}`, use: () => {
      if (train.rider !== null) return;
      train.nextStop = i; train.wait = 0; train.s = ((stopS(i) - 130) % rail.total + rail.total) % rail.total; train.v = 20; sound.fx('whistle'); game.notice('Train called. About ten seconds out.');
    } });
    // Station name board
    const t = textCanvas(512, 96, (c, w, h) => { c.fillStyle = '#1d2a4e'; c.fillRect(0, 0, w, h); c.fillStyle = '#f5c518'; c.font = `56px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(st.name.toUpperCase(), w / 2, h / 2 + 3); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
    sign.position.copy(P3(st.x + st.nx * 0.5 + tx * 6, st.y + st.ny * 0.5 + ty * 6, 4.7)); sign.rotation.y = Math.atan2(st.nx, -st.ny); scene.add(sign);
  });

  // ---------- Rides on a path: zipline and water slide ----------
  const ride = ({ curve, label, speed, accel = 0, hang = 0, onEnd, sfx, achieve, tilt = 0.25 }) => {
    let t = 0, v = speed; const L = curve.getLength(), tmp = new THREE.Vector3();
    sound.fx(sfx); player.vel.set(0, 0, 0);
    player.locked = {
      label, noExit: true,
      camera(cam) {
        const pos = curve.getPointAt(Math.min(1, t)); const tan = curve.getTangentAt(Math.min(1, t));
        const yaw = Math.atan2(-tan.x, -tan.z), pitch = Math.asin(tan.y) * 0.8;
        let dy = yaw - player.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283;
        player.yaw += dy * 0.12; player.pitch += (pitch - player.pitch) * 0.1;
        cam.rotation.order = 'YXZ'; cam.rotation.set(player.pitch, player.yaw, -dy * tilt);
        cam.position.copy(pos); cam.position.y += hang;
      },
      update(dt) {
        const tan = curve.getTangentAt(Math.min(1, t)); v += (-tan.y * 16 + accel) * dt; v = Math.max(speed * 0.6, v);
        t += v * dt / L; curve.getPointAt(Math.min(1, t), tmp); player.pos.copy(tmp); player.pos.y += hang - 1.6;
        if (t >= 1) {
          const e = curve.getTangentAt(1);
          player.locked = null; player.vel.set(e.x * v * 0.6, -4, e.z * v * 0.6); player.fallFrom = player.pos.y + 3; player.pitch = 0;
          camera_reset(); game.achieve(achieve); if (onEnd) onEnd();
        }
      },
    };
  };
  const camera_reset = () => { game.camera.rotation.z = 0; };
  // Zipline: top of Khufu all the way to the pool
  {
    // Runs high over the dome and the back wing to a tower on the pool deck, then drops steeply into the water.
    const K = spots.pyramids.khufu, a = P3(K.x, K.y, K.h + 3.5), tower = P3(58, 44, 21), b = P3(64, 32, 2.5);
    const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(tower, 0.5), tower, b], false, 'centripetal');
    game.zipCurve = curve;
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.07, 6), new THREE.MeshBasicMaterial({ color: 0x20222a })));
    const postM = litProp(0xf5c518); const post = box(0.5, 4.4, 0.5, postM); post.position.copy(P3(K.x, K.y, K.h + 1.3)); scene.add(post);
    const towerPole = box(1, 21.5, 1, postM); towerPole.position.copy(P3(58, 44, 10.75)); scene.add(towerPole);
    const towerArm = box(4, 0.5, 0.5, postM); towerArm.position.copy(P3(58, 44, 21.2)); towerArm.rotation.y = 0.65; scene.add(towerArm);
    addE({ pos: P3(K.x, K.y, K.h + 1), r: 4, any: true, prompt: () => 'Ride the zipline to the pool', use: () => {
      ride({ curve, label: 'zip', speed: 30, accel: 6, hang: -1.5, sfx: 'zip', achieve: 'zip', tilt: 0 });
    } });
  }
  // Water slide: core roof down into the pool
  {
    const S = spots.slideTop;
    const pts3 = [P3(S.x, S.y, 19.6), P3(37, 25, 18.2), P3(42, 28, 15), P3(44, 33, 12), P3(50, 36, 9.2), P3(56, 32, 6.8), P3(55, 22, 4.8), P3(49.5, 15, 3.2), P3(58, 11.8, 1.8), P3(66, 16, 0.4), P3(70, 21, -0.5)];
    const curve = new THREE.CatmullRomCurve3(pts3, false, 'catmullrom', 0.5);
    const seg = 180, geo = new THREE.TubeGeometry(curve, seg, 1.15, 12, false);
    const tube = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x2fb6ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); scene.add(tube);
    addE({ pos: P3(S.x, S.y, S.h + 1), r: 4, prompt: () => 'Go down the water slide', use: () => {
      const c = new THREE.CatmullRomCurve3(pts3.map((p) => p.clone().add(new THREE.Vector3(0, 0.9, 0))));
      ride({ curve: c, label: 'slide', speed: 13, sfx: 'splash', achieve: 'slide', tilt: 0.3, onEnd: () => sound.fx('splash') });
    } });
    // Supports
    for (const i of [1, 3, 5, 7]) { const p = pts3[i], h = p.y - G, m = litProp(0xe8e8ee), post = box(0.4, h, 0.4, m); post.position.set(p.x, G + h / 2, p.z); scene.add(post); m.setEnv({ sky: 1, r: 0, g: 0, b: 0 }); }
  }

  // ---------- Hall of Fame faces (real followers, real pictures) ----------
  const atlas = assets.faces; const FG = assets.facesData;
  const faceMat = (frame) => {
    const m = new THREE.MeshBasicMaterial({ map: atlas, color: 0xffffff });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uG = { value: new THREE.Vector2(FG.cols, FG.rows) };
      sh.vertexShader = `attribute float aFace; varying float vF; varying vec2 vQ;\n` + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n vF = aFace; vQ = uv;`);
      sh.fragmentShader = `uniform vec2 uG; varying float vF; varying vec2 vQ;\n` + sh.fragmentShader.replace('#include <map_fragment>', `
        float ci = mod(vF, uG.x), ri = floor(vF / uG.x);
        vec2 u2 = (vQ * 0.94 + 0.03 + vec2(ci, uG.y - 1.0 - ri)) / uG;
        vec4 tc = texture2D(map, u2);
        float e = min(min(vQ.x, 1.0 - vQ.x), min(vQ.y, 1.0 - vQ.y));
        diffuseColor.rgb = e < ${frame.toFixed(3)} ? vec3(0.96, 0.72, 0.12) : tc.rgb;`);
    };
    m.customProgramCacheKey = () => 'face' + frame;
    return m;
  };
  const instFaces = (count, placer, size, frame) => {
    const g = new THREE.PlaneGeometry(size, size); const arr = new Float32Array(count);
    const im = new THREE.InstancedMesh(g, faceMat(frame), count);
    const O = new THREE.Object3D();
    for (let i = 0; i < count; i++) { placer(i, O); O.updateMatrix(); im.setMatrixAt(i, O.matrix); arr[i] = i % FG.names.length; }
    g.setAttribute('aFace', new THREE.InstancedBufferAttribute(arr, 1));
    im.frustumCulled = false; return im;
  };
  const RT = spots.rotunda, faceCols = 58, rowH = 1.4, FACE_R = RT.r - 0.8; // Just inside the corners of the blocky wall
  const rC = P3(RT.x, RT.y, 0);
  // Every follower gets their own open spot on the wall. The doorway stays clear, so those faces go up a row instead.
  const hofSlots = [], hofIndex = new Map();
  for (let row = 0; hofSlots.length < FG.names.length; row++) for (let col = 0; col < faceCols && hofSlots.length < FG.names.length; col++) {
    const a = col / faceCols * 6.283 + 0.25 + row * 0.03, h = 1.6 + row * rowH;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.42 && h < 11.4) continue;
    hofIndex.set(row * faceCols + col, hofSlots.length); hofSlots.push({ a, h });
  }
  const faceRows = Math.ceil(hofSlots[hofSlots.length - 1].h / rowH);
  const hof = instFaces(FG.names.length, (i, O) => {
    const { a, h } = hofSlots[i];
    O.position.set(rC.x + Math.cos(a) * FACE_R, G + h, rC.z - Math.sin(a) * FACE_R);
    O.lookAt(rC.x, O.position.y, rC.z);
  }, 1.22, 0.05);
  game.hofSlots = hofSlots;
  scene.add(hof);
  game.hallLabel = () => {
    // Which face is the crosshair on?
    if (Math.hypot(player.pos.x - rC.x, player.pos.z - rC.z) > RT.r) return null;
    const cam = game.camera, dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const ox = cam.position.x - rC.x, oz = cam.position.z - rC.z, A = dir.x * dir.x + dir.z * dir.z, Bq = 2 * (ox * dir.x + oz * dir.z), Cq = ox * ox + oz * oz - FACE_R * FACE_R;
    const disc = Bq * Bq - 4 * A * Cq; if (disc < 0 || A < 1e-4) return null;
    const t = (-Bq + Math.sqrt(disc)) / (2 * A); if (t > 16) return null;
    const hx = ox + dir.x * t, hz = oz + dir.z * t, hy = cam.position.y + dir.y * t;
    const row = Math.round((hy - G - 1.6) / rowH); if (row < 0 || row > faceRows) return null;
    let a = Math.atan2(-hz, hx) - 0.25 - row * 0.03; while (a < 0) a += 6.283; while (a >= 6.283) a -= 6.283;
    const col = Math.round(a / 6.283 * faceCols) % faceCols, i = hofIndex.get(row * faceCols + col);
    return i !== undefined && FG.names[i] ? '@' + FG.names[i] : null;
  };
  // Rotunda sign and the guard joke
  sign(P3(-49.5, 25, 3), 'HALL OF FAME. First 1,000 followers. Look at a picture to read the name.');
  sign(P3(-39, 21.5, 1.2), 'Hall of Fame guard post. @5star.battle applied for this job in the comments.');

  function sign(pos, text) { addE({ pos, r: 3.2, prompt: () => 'Read the sign', use: () => { game.notice(text); sound.fx('click'); } }); }

  // ---------- Party dome ----------
  const PT = spots.party, cen = P3(PT.x, PT.y, 13.5);
  const ballG = new THREE.Group(); ballG.position.copy(cen); scene.add(ballG);
  const ballBase = new THREE.Mesh(new THREE.SphereGeometry(5.95, 24, 18), new THREE.MeshBasicMaterial({ color: 0x0a0a12 })); ballG.add(ballBase);
  const ballN = 620;
  const ball = instFaces(ballN, (i, O) => {
    const y = 1 - (i + 0.5) / ballN * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    O.position.set(Math.cos(th) * r * 6, y * 6, Math.sin(th) * r * 6); O.lookAt(O.position.x * 2, O.position.y * 2, O.position.z * 2);
  }, 0.72, 0.02);
  ballG.add(ball);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xc8c8d0 })); chain.position.copy(cen); chain.position.y += 8.5; scene.add(chain);
  // Light beams
  const beamG = new THREE.Group(); beamG.position.copy(cen); scene.add(beamG); const beams = [];
  const beamColors = [0xff3f9a, 0x38b6ff, 0xf5c518, 0x9c5cff, 0x34e0a0, 0xff7a30];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.MeshBasicMaterial({ color: beamColors[i % 6], transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const c = new THREE.Mesh(new THREE.ConeGeometry(2.4, 22, 16, 1, true), m); c.geometry.translate(0, -11, 0);
    const pv = new THREE.Group(); pv.add(c); pv.rotation.set(Math.random() * 1.2 - 0.6, 0, Math.random() * 1.2 - 0.6); pv.userData.sp = (Math.random() + 0.5) * (i % 2 ? 1 : -1); pv.userData.ph = Math.random() * 6; beamG.add(pv); beams.push(pv);
  }
  // Confetti
  const CN = 500, cfPos = new Float32Array(CN * 3), cfCol = new Float32Array(CN * 3), col = new THREE.Color();
  for (let i = 0; i < CN; i++) { cfPos[i * 3] = cen.x + (Math.random() - 0.5) * 34; cfPos[i * 3 + 1] = G + Math.random() * 24; cfPos[i * 3 + 2] = cen.z + (Math.random() - 0.5) * 34; col.set(beamColors[i % 6]); cfCol.set([col.r, col.g, col.b], i * 3); }
  const cfG = new THREE.BufferGeometry(); cfG.setAttribute('position', new THREE.BufferAttribute(cfPos, 3)); cfG.setAttribute('color', new THREE.BufferAttribute(cfCol, 3));
  const confetti = new THREE.Points(cfG, new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true })); confetti.visible = false; confetti.frustumCulled = false; scene.add(confetti);
  const party = { on: false, t: 0, fade: 0 };
  const button = (pos, color, prompt, use, r = 3.2) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.25, 16), new THREE.MeshBasicMaterial({ color })); m.position.copy(pos); scene.add(m);
    addE({ pos: pos.clone(), r, prompt, use }); return m;
  };
  const musicAt = (style, layers, pos, range = 60) => { sound.playMusic(style, layers); game.musicSource = { pos, range, style }; };
  button(P3(spots.partyButton.x, spots.partyButton.y - 1.2, spots.partyButton.h + 0.1), 0xff3f9a, () => party.on ? 'Kill the party' : 'START THE PARTY', () => {
    party.on = !party.on; sound.fx('click');
    if (party.on) { musicAt('party', 4, cen.clone(), 55); game.achieve('party'); game.notice('Your name goes on this ball at 10,000. Then we throw the real one in Hollywood.'); }
    else if (game.musicSource && game.musicSource.style === 'party') { sound.stopMusic(); game.musicSource = null; }
  });
  tick((dt, t) => {
    party.fade += ((party.on ? 1 : 0) - party.fade) * Math.min(1, dt * 2);
    ballG.rotation.y += dt * (0.12 + party.fade * 0.7);
    if (Math.hypot(player.pos.x - cen.x, player.pos.z - cen.z) > 70 && !party.on) { beamG.visible = false; return; }
    beamG.visible = party.fade > 0.01;
    beams.forEach((b, i) => {
      b.rotation.z = Math.sin(t * b.userData.sp + b.userData.ph) * 1.1; b.rotation.x = Math.cos(t * b.userData.sp * 0.8 + i) * 1.1; b.rotation.y = 0;
      b.children[0].material.opacity = (0.1 + 0.08 * Math.sin(t * 8 + i)) * party.fade;
    });
    confetti.visible = party.fade > 0.05;
    if (confetti.visible) { for (let i = 0; i < CN; i++) { cfPos[i * 3 + 1] -= dt * (1.2 + (i % 5) * 0.4); cfPos[i * 3] += Math.sin(t * 2 + i) * dt * 0.8; if (cfPos[i * 3 + 1] < G + 0.1) cfPos[i * 3 + 1] = G + 22; } cfG.attributes.position.needsUpdate = true; }
  });

  // ---------- Room 2 dungeon: lasers, fog, DJ booth ----------
  {
    const R2 = { x: -39 + 7, y: 86 }, pos = P3(R2.x, R2.y - 1.5, 15.2), source = P3(R2.x, 83, 15);
    let on = false, lasers = [];
    const g = new THREE.Group(); g.position.copy(P3(R2.x, 87, 16.2)); g.visible = false; scene.add(g);
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 11), new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); m.geometry.translate(0, 0, 5.5); m.userData.ph = i; g.add(m); lasers.push(m); }
    const fogS = []; const tex = textCanvas(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,150,150,.55)'); gr.addColorStop(1, 'rgba(255,70,70,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
    for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5 })); s.scale.setScalar(4); s.position.copy(P3(R2.x - 5 + Math.random() * 10, 79 + Math.random() * 8, 13.4 + Math.random() * 0.6)); s.visible = false; scene.add(s); fogS.push(s); }
    button(pos, 0xff3044, () => on ? 'Cut the music' : 'Drop the beat', () => {
      on = !on; g.visible = on; fogS.forEach((s) => { s.visible = on; }); sound.fx('click');
      if (on) { musicAt('dungeon', 4, source, 34); game.achieve('dj'); } else if (game.musicSource && game.musicSource.style === 'dungeon') { sound.stopMusic(); game.musicSource = null; }
    });
    sign(P3(R2.x - 3.5, 81, 14.4), 'This fountain is water. Legal made us put up a sign that says NOT TEQUILA.');
    tick((dt, t) => { if (!on) return; lasers.forEach((m) => { m.rotation.set(Math.sin(t * 1.3 + m.userData.ph) * 0.5 + 0.2, 2.4 + Math.sin(t * 0.9 + m.userData.ph * 1.7) * 1.1, 0); }); fogS.forEach((s, i) => { s.position.x += Math.sin(t + i) * dt * 0.3; s.material.opacity = 0.35 + Math.sin(t * 0.7 + i) * 0.12; }); });
  }

  // ---------- Music Studio: build a beat one layer at a time ----------
  {
    const p = P3(spots.studio.x, spots.studio.y, spots.studio.h); let layer = 0;
    button(p, 0x48f08c, () => ['Start the kick', 'Add drums', 'Add bass', 'Add lead', 'Stop the track'][layer], () => {
      layer = (layer + 1) % 5; sound.fx('click');
      if (layer === 0) { if (game.musicSource && game.musicSource.style === 'studio') { sound.stopMusic(); game.musicSource = null; } } else { musicAt('studio', layer, p.clone(), 34); if (layer === 4) game.achieve('studio'); }
    });
  }
  // Backyard speakers
  {
    const p = P3(spots.yardSpeakers.x, spots.yardSpeakers.y, spots.yardSpeakers.h); let on = false;
    button(p, 0xf5c518, () => on ? 'Turn the speakers off' : 'Turn the speakers on', () => { on = !on; sound.fx('click'); if (on) musicAt('chill', 4, P3(72, 25, 2), 70); else if (game.musicSource && game.musicSource.style === 'chill') { sound.stopMusic(); game.musicSource = null; } });
  }
  sign(P3(spots.grill.x, spots.grill.y, spots.grill.h), 'Grill is on. Nobody knows who turned it on.');
  sign(P3(spots.sphinx.x, spots.sphinx.y, spots.sphinx.h), 'The Sphinx asks: what has a thousand followers and no legs? It already knows. It is watching you read this.');
  { const [x, y] = W[7].P(22, 9.9); sign(P3(x, y, 1.5), 'Empty room. Soon you can claim one of these and put your name on it.'); }

  // ---------- Arcade cabinets ----------
  const screenTex = {};
  for (const k of Object.keys(GAMES)) screenTex[k] = textCanvas(256, 200, (c, w, h) => { c.fillStyle = '#090b14'; c.fillRect(0, 0, w, h); c.fillStyle = '#f5c518'; c.font = `36px ${DISPLAY}`; c.textAlign = 'center'; const parts = GAMES[k].title.split(' '); parts.forEach((p, i) => c.fillText(p, w / 2, 70 + i * 44)); c.fillStyle = '#ff4fb0'; c.font = '16px Inter, sans-serif'; c.fillText('INSERT NOTHING', w / 2, 178); });
  for (const A of spots.arcade) {
    const p = P3(A.x, A.y, A.h);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), new THREE.MeshBasicMaterial({ map: screenTex[A.game] }));
    s.position.copy(p); s.position.y += 0.55;
    if (A.face === 'north') { s.position.z -= 0.02; s.rotation.y = Math.PI; } else { const w = W[A.wing]; s.position.x -= w.n[0] * 0.04; s.position.z += w.n[1] * 0.04; s.rotation.y = Math.atan2(-w.n[0], w.n[1]); }
    scene.add(s);
    addE({ pos: p, r: 3, prompt: () => `Play ${GAMES[A.game].title}`, use: () => game.openArcade(A.game) });
  }

  // ---------- TVs ----------
  const channels = [
    textCanvas(320, 180, (c, w, h) => { c.fillStyle = '#0b0d12'; c.fillRect(0, 0, w, h); c.fillStyle = '#f5c518'; c.font = `64px ${DISPLAY}`; c.textAlign = 'center'; c.fillText('IMP', w / 2, 88); c.fillStyle = '#fff'; c.font = `20px ${DISPLAY}`; c.fillText('THE INTERNET MANSION PROJECT', w / 2, 124); }),
    textCanvas(320, 180, (c, w, h) => { ['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f'].forEach((col2, i) => { c.fillStyle = col2; c.fillRect(i * w / 7, 0, w / 7 + 1, h); }); }),
    textCanvas(320, 180, (c, w, h) => { c.fillStyle = '#10131c'; c.fillRect(0, 0, w, h); c.fillStyle = '#f5c518'; c.font = `26px ${DISPLAY}`; c.fillText('TOP COMMENT', 18, 42); c.fillStyle = '#fff'; c.font = `34px ${DISPLAY}`; c.fillText('A PRIVATE RAILROAD', 18, 90); c.fillText('AROUND THE WHOLE', 18, 128); c.fillText('PROPERTY', 18, 166); }),
    textCanvas(320, 180, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4aa8ff'); g.addColorStop(1, '#d7f0ff'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#d7bf8c'; c.beginPath(); c.moveTo(60, 170); c.lineTo(160, 50); c.lineTo(260, 170); c.fill(); c.fillStyle = '#fff'; c.font = `22px ${DISPLAY}`; c.fillText('WEATHER: GIZA, SOMEHOW', 20, 32); }),
  ];
  for (const T of spots.tv) {
    const face = T.face === 'west' ? -1 : 1;
    const pos = P3(T.x + face * 0.03, T.y, T.h);
    const frame = box(0.1, T.h2 + 0.2, T.w + 0.2, new THREE.MeshBasicMaterial({ color: 0x0a0a0e })); frame.position.copy(pos); frame.position.x -= face * 0.04; scene.add(frame);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(T.w, T.h2), new THREE.MeshBasicMaterial({ map: channels[0] }));
    scr.position.copy(pos); scr.position.x += face * 0.04; scr.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(scr);
    let ch = 0;
    addE({ pos: pos.clone(), r: 6, prompt: () => 'Change the channel', use: () => { ch = (ch + 1) % channels.length; scr.material.map = channels[ch]; scr.material.needsUpdate = true; sound.fx('click'); } });
  }
  // Beds: sleep to change the time of day
  for (const Bd of spots.beds) addE({ pos: P3(Bd.x, Bd.y, Bd.h), r: 3.2, any: true, prompt: () => 'Sleep (changes the time of day)', use: () => game.sleep() });
  // Bass mounted above Max's bed, because he asked
  {
    const m = litProp(0x5a7a48); const fish = box(1.6, 0.5, 0.15, m); fish.position.copy(P3(-39 + 3.5, 62.05, 15.8)); scene.add(fish); envAt(m, fish.position);
    const tail = box(0.4, 0.6, 0.1, m); tail.position.set(fish.position.x + 0.9, fish.position.y, fish.position.z); scene.add(tail);
    sign(P3(-39 + 3.5, 63, 15), 'A 10 lb bass, mounted, as requested by @maxgregerson_22.');
  }
  // Racing rigs: Max's and Dhee's
  sign(P3(-39 + 10, 63.5, 14.2), 'Curved monitor, stocks on the second screen. Racing sim is warming up.');
  sign(P3(28.5, 69, 14.5), 'PlayStation and a Forza rig, as ordered by @dhee._ven. Balcony is through the east door.');

  // ---------- Art Gallery: the first followers, framed big ----------
  {
    const S = spots.gallery, w = W[5];
    const n = 8, picks = [];
    for (let i = 0; i < n; i++) picks.push(i * 37 % FG.names.length);
    const grid = instFaces(n, (i, O) => {
      const side = i % 2, u = S.u0 + 2 + Math.floor(i / 2) * 3.4;
      const [x, y] = w.P(u, side ? w.width - 0.95 : 0.95);
      O.position.set(x, G + 3, -y); const [tx, ty] = w.P(u, 9.9); O.lookAt(tx, G + 3, -ty);
    }, 2.4, 0.04);
    grid.geometry.attributes.aFace.array.set(picks); scene.add(grid);
  }

  // ---------- The giant sign, both sides, plus letters on the roof ----------
  {
    const S = spots.sign;
    const t = textCanvas(2048, 540, (c, w, h) => { c.fillStyle = '#0b0d12'; c.fillRect(0, 0, w, h); c.fillStyle = '#f5c518'; c.font = `250px ${DISPLAY}`; c.textAlign = 'center'; c.fillText('THE INTERNET MANSION', w / 2, 270); c.fillStyle = '#fff'; c.font = `110px ${DISPLAY}`; c.fillText('THE BIGGEST HOUSE ON THE INTERNET', w / 2, 410); c.fillStyle = '#4a8bff'; c.font = `66px ${DISPLAY}`; c.fillText('BUILT BY THE COMMENTS. EVERY DAY.', w / 2, 500); });
    const mat = new THREE.MeshBasicMaterial({ map: t });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(S.w, S.h2), mat); m.position.copy(P3(S.x, S.y, S.h)); scene.add(m);
    const mb = new THREE.Mesh(m.geometry, mat); mb.rotation.y = Math.PI; mb.position.copy(P3(S.x, S.back, S.h)); scene.add(mb);
    const RS = spots.roofSign;
    const t2 = textCanvas(2048, 410, (c, w, h) => { c.fillStyle = '#0b0d12'; c.fillRect(0, 0, w, h); c.fillStyle = '#f5c518'; c.font = `235px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('THE INTERNET MANSION', w / 2, h / 2 + 8); });
    const rs = new THREE.Mesh(new THREE.PlaneGeometry(RS.w, RS.h2), new THREE.MeshBasicMaterial({ map: t2 })); rs.position.copy(P3(RS.x, RS.y, RS.h)); scene.add(rs);
  }

  // ---------- Hoops ----------
  {
    const C = spots.court, rings = C.hoops.map((H) => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.06, 8, 24), new THREE.MeshBasicMaterial({ color: 0xff5a20 })); r.rotation.x = Math.PI / 2; r.position.copy(P3(H.x, H.y, H.h)); scene.add(r); return r.position.clone();
    });
    const ballM = litProp(0xe8782a); const bb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), ballM); bb.visible = false; scene.add(bb); ballM.setEnv({ sky: 1, r: 0, g: 0, b: 0 });
    const S = { charging: false, power: 0, active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, scored: false, streak: 0, total: 0, prevY: 0, dist: 0 };
    const cen2 = P3((C.x0 + C.x1) / 2, (C.y0 + C.y1) / 2, 1);
    const inCourt = () => player.pos.x > C.x0 && player.pos.x < C.x1 && -player.pos.z > C.y0 && -player.pos.z < C.y1 && player.pos.y < G + 3;
    addE({
      pos: cen2, r: 24, any: true, priority: -1, hold: true, active: inCourt,
      prompt: () => 'Hold to shoot',
      use: () => {}, press: () => { S.charging = true; S.power = 0; }, release: () => {
        if (!S.charging) return; S.charging = false; game.setPower(0);
        const dir = new THREE.Vector3(); game.camera.getWorldDirection(dir); dir.y += 0.28; dir.normalize();
        S.pos.copy(player.pos); S.pos.y += 1.5; S.pos.addScaledVector(dir, 0.6); S.vel.copy(dir).multiplyScalar(7 + S.power * 15);
        // A shot close to the right power and aimed at the rim drops in. It should feel good, on a phone too.
        const hoop = rings.slice().sort((a, b) => a.distanceToSquared(S.pos) - b.distanceToSquared(S.pos))[0];
        const dx = hoop.x - S.pos.x, dz = hoop.z - S.pos.z, dH = Math.hypot(dx, dz), dY = hoop.y - S.pos.y, th = Math.max(0.95, Math.asin(dir.y)), den = 2 * Math.cos(th) ** 2 * (dH * Math.tan(th) - dY);
        const aim = (dir.x * dx + dir.z * dz) / (Math.hypot(dir.x, dir.z) * dH);
        if (den > 0 && aim > 0.95) {
          const ideal = Math.sqrt(15 * dH * dH / den), sp = 7 + S.power * 15;
          if (Math.abs(sp - ideal) / ideal < 0.2) { S.vel.set(dx / dH * Math.cos(th) * ideal, Math.sin(th) * ideal, dz / dH * Math.cos(th) * ideal); }
        }
        S.dist = Math.min(...rings.map((r) => Math.hypot(r.x - S.pos.x, r.z - S.pos.z)));
        S.active = true; S.scored = false; S.life = 4; bb.visible = true; sound.fx('jump');
      },
    });
    tick((dt) => {
      if (S.charging) { S.power = Math.min(1, S.power + dt * 0.9); game.setPower(S.power); if (!inCourt()) { S.charging = false; game.setPower(0); } }
      if (!S.active) return;
      S.life -= dt; if (S.life <= 0) { S.active = false; bb.visible = false; if (!S.scored) S.streak = 0; return; }
      S.vel.y -= 15 * dt; S.prevY = S.pos.y; const n = S.pos.clone().addScaledVector(S.vel, dt);
      if (V.solidW(n.x, n.y - 0.3, n.z) && !V.solidW(S.pos.x, n.y - 0.3, S.pos.z) && !V.solidW(S.pos.x, S.pos.y - 0.3, n.z)) { S.vel.x *= -0.6; S.vel.z *= -0.6; sound.fx('rim'); }
      else if (V.solidW(n.x, n.y - 0.34, n.z)) { S.vel.y = Math.abs(S.vel.y) * 0.62; S.vel.x *= 0.82; S.vel.z *= 0.82; n.y = S.pos.y; sound.fx('land'); }
      S.pos.copy(n); bb.position.copy(S.pos);
      for (const r of rings) {
        if (!S.scored && S.prevY > r.y && S.pos.y <= r.y && Math.hypot(S.pos.x - r.x, S.pos.z - r.z) < 0.68) {
          S.scored = true; S.streak++; S.total += S.dist > 13 ? 3 : 2; sound.fx('swish');
          game.notice(`${S.dist > 13 ? 'THREE' : 'BUCKET'}. ${S.total} points. Streak ${S.streak}.`); game.achieve('hoops');
          S.vel.x *= 0.2; S.vel.z *= 0.2;
        }
      }
    });
  }

  // ---------- Pool: laser shark, because a comment asked for one ----------
  {
    const Q = spots.pool, g = new THREE.Group(), m = litProp(0x6e7c8c), w = litProp(0xdfe6ee);
    const b = box(1.0, 0.9, 4.0, m); g.add(b); const be = box(0.85, 0.2, 3.4, w); be.position.y = -0.5; g.add(be);
    const fin = box(0.14, 1.0, 0.9, m); fin.position.set(0, 0.9, 0.2); g.add(fin); const tail = box(0.14, 1.0, 0.8, m); tail.position.set(0, 0.1, 2.2); g.add(tail);
    const eye = box(0.1, 0.2, 0.2, new THREE.MeshBasicMaterial({ color: 0xff2030 })); [-0.51, 0.51].forEach((x) => { const e = eye.clone(); e.position.set(x, 0.2, -1.4); g.add(e); });
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 14), new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); l.geometry.translate(0, 0, -7); l.position.set(0, 0.2, -1.8); g.add(l);
    scene.add(g); m.setEnv({ sky: 0.8, r: 0.3, g: 0.8, b: 1 }); w.setEnv({ sky: 0.8, r: 0.3, g: 0.8, b: 1 });
    const cx = (Q.x0 + Q.x1) / 2, cy = (Q.y0 + Q.y1) / 2;
    tick((dt, t) => { const a = t * 0.22, x = cx + Math.cos(a) * 12, y = cy + Math.sin(a) * 6; g.position.copy(P3(x, y, -3)); g.rotation.y = -a + Math.PI; l.rotation.y = Math.sin(t * 1.4) * 0.5; });
  }

  // ---------- Gold bricks to hunt ----------
  const K = spots.pyramids;
  const GOLD = [
    ['the fountain', -6, -19, -0.2, 1.8], ['the front porch roof', -6.5, 7, 28.6], ['the top of the stairs', -11.5, 75, 14],
    ['the kitchen island', W[7].P(7.5, 10)[0], W[7].P(7.5, 10)[1], 2.7], ['under the lift', W[1].P(24, 8.5)[0], W[1].P(24, 8.5)[1], 0.6],
    ['the tool chest', W[1].P(2.5, 17)[0], W[1].P(2.5, 17)[1], 4.6], ['the racing corner', W[3].P(6, 16)[0], W[3].P(6, 16)[1], 2.4],
    ['under the movie screen', W[3].P(28.4, 9.9)[0], W[3].P(28.4, 9.9)[1], 0.6], ['the back of the studio', W[3].P(44, 4)[0], W[3].P(44, 4)[1], 5.4],
    ['the unfinished wing', W[3].P(58, 3)[0], W[3].P(58, 3)[1], 0.6], ['the lounge bookcase', W[5].P(2.5, 16.5)[0], W[5].P(2.5, 16.5)[1], 5.4],
    ['the gallery pedestal', W[5].P(21.8, 10)[0], W[5].P(21.8, 10)[1], 3.6], ['the closet island', W[5].P(41.5, 10)[0], W[5].P(41.5, 10)[1], 1.6],
    ['the empty bedroom', W[7].P(42, 16)[0], W[7].P(42, 16)[1], 0.6], ['the roof helipad', -28, 75, 20], ['a wing roof', W[3].P(50, 9.9)[0], W[3].P(50, 9.9)[1], 13.8],
    ['the party dome roof', -6, 112, 26.8], ['the DJ stage', -6, 127.5, 4.8], ['the top of the rotunda', -63, 25, 33.5], ['the rotunda ramp', -63 + Math.cos(10.4) * 11, 25 + Math.sin(10.4) * 11, 17.2],
    ['the crane jib', 78, 25, 26.8], ['the bottom of the pool', 62, 34, -4.2], ['the slide tower', 28, 24, 20.4], ['the top of Khafre', K.khafre.x, K.khafre.y, K.khafre.h + 0.6],
    ['the top of Menkaure', K.menkaure.x, K.menkaure.y, K.menkaure.h + 0.6], ["the King's Chamber", -28.5, 159, 3.6], ['the tunnel', -60, 179.5, 0.6],
    ['the Sphinx', 32, 132, 11.6], ['the station roof', spots.stations[0].x, spots.stations[0].y, 8.8], ['the top of the giant sign', -6, 41, 56],
    ['the secret room', -9, 88, 14.6], ['the bass', -36, 63, 15.6], ['the 50 yard line', -262, 30, 0.8], ['the top row of the stadium', -262, 160.5, 62], ['the locker room', -262, 150, 1], ['a luxury box', -194, 30, 26.5], ['the scoreboard', -262, -100, 77], ['the yurt stove', 6.5, 66.2, 15.6], ['the speedway grandstand', 170, -16, 6.6], ['the festival stage', 104, 104, 4], ['the top of the stage', 121, 100, 31], ['the bridge', -6, -62, 9],
  ];
  const goldBricks = [];
  const gMat = new THREE.MeshBasicMaterial({ color: 0xffc41f }), gGeo = new THREE.BoxGeometry(0.9, 0.42, 0.45);
  const edges = new THREE.LineBasicMaterial({ color: 0xfff3b0 });
  const found = JSON.parse(localStorage.getItem('imp_gold') || '[]');
  GOLD.forEach((g2, i) => {
    if (found.includes(i)) return;
    const m = new THREE.Mesh(gGeo, gMat); m.add(new THREE.LineSegments(new THREE.EdgesGeometry(gGeo), edges));
    m.position.copy(P3(g2[1], g2[2], g2[3])); scene.add(m); goldBricks.push({ m, i, name: g2[0] });
  });
  game.goldTotal = GOLD.length; game.goldFound = found.length;
  game.goldBricks = goldBricks; game.goldList = GOLD;
  tick((dt, t) => {
    for (let i = goldBricks.length - 1; i >= 0; i--) {
      const g2 = goldBricks[i]; g2.m.rotation.y = t * 1.6 + i; g2.m.position.y += Math.sin(t * 2 + i) * 0.002;
      const dx = player.pos.x - g2.m.position.x, dy = player.pos.y + 0.9 - g2.m.position.y, dz = player.pos.z - g2.m.position.z;
      if (dx * dx + dy * dy + dz * dz < 3.2) {
        scene.remove(g2.m); goldBricks.splice(i, 1); found.push(g2.i); localStorage.setItem('imp_gold', JSON.stringify(found));
        game.goldFound = found.length; game.updateGold(); sound.fx('gold'); game.notice(`Gold brick ${found.length} of ${GOLD.length}. Found at ${g2.name}.`);
        if (found.length === GOLD.length) game.achieve('allgold');
      }
    }
  });

  // ---------- Fountain spray ----------
  {
    const n = 60, pos = new Float32Array(n * 3), vel = []; const c = P3(-6, -19, 5.2);
    for (let i = 0; i < n; i++) { vel.push(new THREE.Vector3()); pos.set([c.x, c.y - 2 - Math.random() * 3, c.z], i * 3); }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts2 = new THREE.Points(g2, new THREE.PointsMaterial({ size: 0.28, color: 0xbfe6ff, transparent: true, opacity: 0.85 })); pts2.frustumCulled = false; scene.add(pts2);
    tick((dt) => {
      if (Math.hypot(player.pos.x - c.x, player.pos.z - c.z) > 120) return;
      for (let i = 0; i < n; i++) {
        const v = vel[i]; v.y -= 12 * dt; pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt;
        if (pos[i * 3 + 1] < G + 0.6) { pos.set([c.x, c.y, c.z], i * 3); v.set((Math.random() - 0.5) * 3.4, 6 + Math.random() * 2.5, (Math.random() - 0.5) * 3.4); }
      }
      g2.attributes.position.needsUpdate = true;
    });
  }

  // Signs you can read from across the room
  const labelCache = new Map();
  const label = (pos, rotY, text, w = 10, h = 1.1, gold = false) => {
    const k = text + gold; if (!labelCache.has(k)) labelCache.set(k, textCanvas(Math.round(w * 64), Math.round(h * 64), (c, W2, H2) => { c.fillStyle = gold ? '#f5c518' : '#10131c'; c.fillRect(0, 0, W2, H2); c.strokeStyle = '#f5c518'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, W2 - 3, H2 - 3); c.fillStyle = gold ? '#1c1200' : '#f5c518'; let fs = H2 * 0.68; c.font = `${fs}px ${DISPLAY}`; while (c.measureText(text).width > W2 - 14 && fs > 10) { fs -= 1; c.font = `${fs}px ${DISPLAY}`; } c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W2 / 2, H2 / 2 + 2); }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: labelCache.get(k) })); m.position.copy(pos); m.rotation.y = rotY; scene.add(m); return m;
  };
  const H = { P3, addE, tick, textCanvas, DISPLAY, label, button, musicAt };
  game.carsData = buildCars(game, data, H);
  buildExtras(game, data, H);
  buildStadium(game, data, H);
  game.signReport = seatSigns(scene, V); // Last, so it sees every sign that was built above.

  // ---------- Which room are you in? Chat and claiming hang off this later. ----------
  const roomsDir = assets.rooms.reduce((a, r) => { a[r.room] = r.handle; return a; }, {});
  const winnerAt = (x, y0) => {
    const y = y0 - data.DY;
    if (x >= 27 && x < 34 && y > 15 && y < 35) return 10;
    const k = Math.floor((x + 39) / 13); if (k < 0 || k > 4) return null;
    if (y >= 28 && y < 40) return [2, 4, 6, 8, 9][k];
    if (y >= 10 && y < 23) return { 0: 1, 1: 3, 3: 5, 4: 7 }[k] || null;
    return null;
  };
  game.roomAt = () => {
    const x = player.pos.x, y = -player.pos.z, h = player.pos.y - G;
    const wingRooms = { 1: ['Hot Rod Garage', 'Hot Rod Garage'], 3: ['Gaming Room', 'Music Studio', 'Movie Theater', 'Movie Theater'], 5: ['Chill Lounge', 'Art Gallery', 'Designer Closet'], 7: ['The Kitchen', 'Open Room', 'Open Room'] };
    if (Math.hypot(x + 6, y - 112) < 20 && h < 24 && h >= 0) return { id: 'party', name: 'Party Room' };
    { const St = spots.stadium, qx = Math.abs(x - St.cx) - St.bx + St.rr, qy = Math.abs(y - St.cy) - St.by + St.rr, d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - St.rr;
      const L = St.locker, T = St.tunnel;
      if (x >= L.x0 && x < L.x1 && y >= L.y0 && y < L.y1 && h < 9) return { id: 'locker', name: 'Locker Room' };
      if (x >= T.x0 && x < T.x1 && y >= T.y0 && y < T.y1 && h < 7) return { id: 'team-tunnel', name: 'Team Tunnel' };
      if (d < 0) return { id: 'field', name: 'The Field' };
      if (d < St.out + 2) return { id: 'stadium', name: h >= 24 && h < 32 && d < 33 && Math.abs(y - St.cy) < 56 ? 'Luxury Boxes' : 'Sports Stadium' };
    }
    if (Math.hypot(x + 63, y - 25) < 13 && h < 26) return { id: 'hall', name: 'Hall of Fame' };
    if (data.hall.has(Math.floor(x) * 1000 + Math.floor(y))) {
      if (h >= 19) return { id: 'roof', name: 'The Roof' };
      if (h >= 12.5 && data.upper.has(Math.floor(x) * 1000 + Math.floor(y))) { const r = winnerAt(x, y); if (r) return { id: 'room' + r, name: `Room ${r}`, owner: roomsDir[r] }; return { id: 'hallway', name: 'Rooms Floor' }; }
      return { id: 'foyer', name: 'Grand Foyer' };
    }
    if (data.full.has(Math.floor(x) * 1000 + Math.floor(y))) {
      if (h > 12) return { id: 'roof', name: 'The Roof' };
      for (const i of [1, 3, 5, 7]) { const [u, v] = W[i].local(x, y); if (u >= 0 && u <= W[i].len && v >= 0 && v <= W[i].width) { const n = wingRooms[i], idx = Math.min(n.length - 1, Math.floor(u / (W[i].len / n.length))); const name = n[idx]; return { id: name.toLowerCase().replace(/ /g, '-'), name }; } }
    }
    if (x > 42 && x < 96 && y > 6 && y < 44) return { id: 'backyard', name: h > 18 ? 'The Crane' : 'Backyard Party' };
    if (x > 84 && x < 158 && y > 44 && y < 114) return { id: 'stage', name: 'Festival Stage' };
    if (x > 110 && y < -10 && y > -108) return { id: 'speedway', name: 'Mansion Speedway' };
    if (x > -124 && x < -80 && y > 0 && y < 50) return { id: 'court', name: 'Basketball Court' };
    if (x > -82 && x < 26 && y > 176 && y < 190 && h < 9) return { id: 'tunnel', name: 'Pyramid Tunnel' };
    if (x > -40 && x < -18 && y > 151 && y < 178 && h < 11) return { id: 'chamber', name: "The King's Chamber" };
    if (x > -105 && x < 135 && y > 133 && y < 323) return { id: 'giza', name: 'Giza' };
    return { id: 'grounds', name: 'The Grounds' };
  };
}
