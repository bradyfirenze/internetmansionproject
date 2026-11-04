// Every car on the property: drivable, one shared handling model, plus the racetrack and three rival drivers.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/utils/BufferGeometryUtils.js';
import { litProp } from './voxels.js';

const part = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const BODY = mergeGeometries([part(2.1, 0.6, 4.6, 0, 0.65, 0), part(2.1, 0.3, 1.4, 0, 1.05, -1.5), part(2.1, 0.22, 0.9, 0, 1.0, 1.7)]);
const wheel = (x, z) => new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12).rotateZ(Math.PI / 2).translate(x, 0.42, z);
const DARK = mergeGeometries([part(1.85, 0.7, 1.9, 0, 1.25, 0.25), part(1.75, 0.12, 1.5, 0, 1.65, 0.3), wheel(-1.05, -1.5), wheel(1.05, -1.5), wheel(-1.05, 1.5), wheel(1.05, 1.5)].map((g) => g.index ? g.toNonIndexed() : g));
const SPOILER = mergeGeometries([part(2.2, 0.12, 0.45, 0, 1.42, 2.15), part(0.14, 0.45, 0.14, -0.8, 1.2, 2.15), part(0.14, 0.45, 0.14, 0.8, 1.2, 2.15)]);
const HEAD = mergeGeometries([part(0.4, 0.18, 0.05, -0.7, 0.75, -2.32), part(0.4, 0.18, 0.05, 0.7, 0.75, -2.32)]);
const TAIL = mergeGeometries([part(0.5, 0.18, 0.05, -0.7, 0.8, 2.32), part(0.5, 0.18, 0.05, 0.7, 0.8, 2.32)]);
const headM = new THREE.MeshBasicMaterial({ color: 0xfff4c0 }), tailM = new THREE.MeshBasicMaterial({ color: 0xff2030 });

export function buildCars(game, data, H) {
  const { scene, V, player, sound } = game, { spots, W, G } = data, { P3, addE, tick, textCanvas, DISPLAY, label } = H;
  const cars = [];
  // Blueprint direction to game yaw (cars face -z at yaw 0)
  const yawOf = (dx, dy) => Math.atan2(-dx, dy);

  function makeCar(color, x, y, h, yaw, opts = {}) {
    const g = new THREE.Group(), bodyM = litProp(color), darkM = litProp(0x15161b);
    g.add(new THREE.Mesh(BODY, bodyM), new THREE.Mesh(DARK, darkM), new THREE.Mesh(HEAD, headM), new THREE.Mesh(TAIL, tailM));
    if (opts.spoiler !== false) g.add(new THREE.Mesh(SPOILER, darkM));
    g.position.copy(P3(x, y, h)); g.rotation.y = yaw; scene.add(g);
    const car = { g, yaw, v: 0, steer: 0, camYaw: yaw, mats: [bodyM, darkM], name: opts.name || 'car', ai: false };
    car.setEnv = () => { const L = V.lightW(g.position.x, g.position.y + 1.5, g.position.z); car.mats.forEach((m) => m.setEnv(L)); };
    car.setEnv(); cars.push(car);
    if (!opts.noDrive) addE({ dyn: true, get pos() { return g.position; }, r: 4.2, any: true, priority: 1, active: () => !race.running || race.player !== car, prompt: () => `Drive the ${opts.name || 'car'}`, use: () => enter(car) });
    return car;
  }

  // Footprint test with the car's rotation
  const free = (car, x, y, z, yaw) => {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (const [a, b] of [[0, -2.2], [0, 2.2], [-0.9, -1.8], [0.9, -1.8], [-0.9, 1.8], [0.9, 1.8], [-1, 0], [1, 0], [0, 0]]) {
      const px = x + a * cs + b * sn, pz = z - a * sn + b * cs;
      for (let h = 0.25; h < 1.6; h += 0.65) if (V.solidW(px, y + h, pz)) return false;
    }
    return true;
  };
  let crashT = 0;
  function enter(car) {
    game.achieve('drive'); sound.fx('horn'); car.camYaw = car.yaw;
    player.locked = {
      label: 'car', hud: 'car', car,
      get exitLabel() { return race.running ? 'Quit the race' : nearStart(car) ? 'START THE RACE' : 'Get out of the car'; },
      use() { if (race.running) { endRace(null); return true; } if (nearStart(car)) { startRace(car); return true; } return false; },
      camera(cam) {
        car.camYaw += (car.yaw - car.camYaw) * 0.08;
        const d = 8.2 + Math.abs(car.v) * 0.05, cx = car.g.position.x + Math.sin(car.camYaw) * d, cz = car.g.position.z + Math.cos(car.camYaw) * d;
        let cy = car.g.position.y + 3.4; while (V.solidW(cx, cy, cz) && cy < car.g.position.y + 16) cy += 1;
        cam.rotation.set(0, 0, 0); cam.position.set(cx, cy, cz); cam.lookAt(car.g.position.x, car.g.position.y + 1.2, car.g.position.z);
      },
      update(dt, input) { driveStep(car, dt, input); },
      exit() {
        const s = Math.sin(car.yaw), c = Math.cos(car.yaw), y = Math.floor(car.g.position.y);
        for (const side of [1, -1]) { const x = car.g.position.x + c * 2.2 * side, z = car.g.position.z - s * 2.2 * side; for (let h = 0; h < 8; h++) if (!player.hit(x, y + h, z)) { player.teleport(x, y + h, z); player.yaw = car.yaw; game.carSpeed = 0; return; } }
        player.teleport(car.g.position.x, y + 2.5, car.g.position.z); game.carSpeed = 0;
      },
    };
  }
  function driveStep(car, dt, input) {
    const g = car.g, frozen = race.running && race.count > 0;
    car.bounce = Math.max(0, (car.bounce || 0) - dt);
    const thr = frozen || car.bounce > 0 ? 0 : input.fwd, st = -input.side;
    // In a race, a car bouncing off the wall swings back toward the racing line
    if (car.bounce > 0 && race.running) { let bi = 0, bd2 = 1e9; for (let i = 0; i < N; i += 3) { const d = (path[i].x - g.position.x) ** 2 + (path[i].y + g.position.z) ** 2; if (d < bd2) { bd2 = d; bi = i; } } const q = path[(bi + 8) % N], want = yawOf(q.x - g.position.x, q.y + g.position.z); let dy = want - car.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; const ny = car.yaw + dy * Math.min(1, dt * 5); if (free(car, g.position.x, g.position.y, g.position.z, ny)) car.yaw = ny; }
    car.v += thr * (thr * car.v < 0 ? 44 : 22) * dt; car.v *= 1 - 0.28 * dt; if (!thr) car.v *= 1 - 0.7 * dt;
    car.v = Math.max(-12, Math.min(input.sprint ? 44 : 34, car.v));
    car.steer += (st - car.steer) * Math.min(1, dt * 6);
    // Never let a turn swing the car's corners into a wall
    const turned = car.yaw + car.steer * dt * Math.min(1.5, Math.abs(car.v) / 7) * Math.sign(car.v || 1) * 1.1;
    if (free(car, g.position.x, g.position.y, g.position.z, turned)) car.yaw = turned;
    // If it is wedged anyway, ease it out toward open space
    if (!free(car, g.position.x, g.position.y, g.position.z, car.yaw)) {
      for (let a = 0; a < 6.283; a += 0.785) { const ox = g.position.x + Math.cos(a) * 0.7, oz = g.position.z + Math.sin(a) * 0.7; if (free(car, ox, g.position.y, oz, car.yaw)) { g.position.x = ox; g.position.z = oz; break; } }
    }
    const dx = -Math.sin(car.yaw) * car.v * dt, dz = -Math.cos(car.yaw) * car.v * dt, y = g.position.y;
    const nx = g.position.x + dx, nz = g.position.z + dz;
    if (free(car, nx, y, nz, car.yaw)) { g.position.x = nx; g.position.z = nz; }
    else if (free(car, nx, y + 1, nz, car.yaw)) { g.position.x = nx; g.position.z = nz; g.position.y = y + 1; }
    else {
      // Scrape along walls instead of stopping dead
      const canX = free(car, nx, y, g.position.z, car.yaw), canZ = free(car, g.position.x, y, nz, car.yaw);
      if (canX || canZ) { if (canX) g.position.x = nx; if (canZ) g.position.z = nz; car.v *= 1 - 1.6 * dt; const tx = canX ? dx : 0, tz = canZ ? dz : 0, want = Math.atan2(-tx, -tz), sign = car.v >= 0 ? 0 : Math.PI; let dy = want + sign - car.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; const ny2 = car.yaw + dy * Math.min(1, dt * 3); if (free(car, g.position.x, g.position.y, g.position.z, ny2)) car.yaw = ny2; if (Math.abs(car.v) > 12 && crashT <= 0) { sound.fx('rim'); crashT = 0.4; } }
      else { if (Math.abs(car.v) > 7 && crashT <= 0) { sound.fx('crash'); crashT = 0.5; } car.v = -Math.sign(car.v || 1) * Math.max(4, Math.abs(car.v) * 0.45); car.bounce = 0.45; }
    }
    crashT -= dt;
    // Other cars are solid too
    for (const o of cars) {
      if (o === car) continue;
      const ax = g.position.x - o.g.position.x, az = g.position.z - o.g.position.z, d = Math.hypot(ax, az);
      if (d < 3.3 && d > 0.01 && Math.abs(g.position.y - o.g.position.y) < 2) { g.position.x += ax / d * (3.3 - d) * 0.6; g.position.z += az / d * (3.3 - d) * 0.6; car.v *= 0.97; if (crashT <= 0 && Math.abs(car.v) > 6) { sound.fx('land'); crashT = 0.3; } }
    }
    let fy = Math.floor(g.position.y + 0.5); while (fy > 0 && !V.solidW(g.position.x, fy - 1, g.position.z)) fy--;
    g.position.y += (fy - g.position.y) * Math.min(1, dt * 10);
    if (Math.abs(car.v) > 32) game.achieve('speed');
    g.rotation.y = car.yaw;
    player.pos.copy(g.position); game.carSpeed = Math.abs(car.v);
    car.envT = (car.envT || 0) + dt; if (car.envT > 0.25) { car.envT = 0; car.setEnv(); }
    // Garage door opens for you
    if (garage && !garage.open && g.position.distanceTo(garage.pos) < 14) garage.toggle();
  }

  // ---------- Garage ----------
  const garage = (() => {
    const S = spots.garage, w = W[1], a = w.P(S.u, (S.v0 + S.v1) / 2), width = S.v1 - S.v0;
    // Rollup door texture: ribs, not a blank box
    const t = textCanvas(256, 256, (c, W2, H2) => { c.fillStyle = '#d7dbe2'; c.fillRect(0, 0, W2, H2); for (let y = 0; y < H2; y += 16) { c.fillStyle = '#aeb4be'; c.fillRect(0, y, W2, 3); } c.fillStyle = '#c8252f'; c.fillRect(0, 96, W2, 62); c.fillStyle = '#fff'; c.font = `40px ${DISPLAY}`; c.textAlign = 'center'; c.fillText('RACETRACK', W2 / 2, 142); });
    const mat = litProp(0xffffff, { map: t }), door = new THREE.Mesh(new THREE.BoxGeometry(width, S.h, 0.3), mat), base = P3(a[0], a[1], S.h / 2);
    door.position.copy(base); door.rotation.y = Math.atan2(-w.n[0], w.n[1]); scene.add(door); mat.setEnv(V.lightW(base.x, G + 3, base.z + 2));
    const cells = [];
    for (let x = Math.floor(a[0] - 9); x < a[0] + 9; x++) for (let y = Math.floor(a[1] - 9); y < a[1] + 9; y++) {
      const [u, v] = w.local(x + 0.5, y + 0.5);
      if (u > S.u - 1.2 && u < S.u + 1.4 && v > S.v0 && v < S.v1) for (let h = 0; h < S.h; h++) if (!V.solidW(x, G + h, -y - 1)) cells.push([x + 0.5, G + h + 0.5, -y - 0.5]);
    }
    V.setBarrier(cells, true);
    const st = { open: false, t: 0, pos: base.clone(), toggle() { st.open = !st.open; V.setBarrier(cells, !st.open); sound.fx('door'); } };
    const btn = w.P(S.u - 4, S.v1 + 2.5);
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), new THREE.MeshBasicMaterial({ color: 0x48f08c })); sw.position.copy(P3(btn[0], btn[1], 1.6)); scene.add(sw);
    addE({ pos: P3(btn[0], btn[1], 1.6), r: 3.2, prompt: () => `${st.open ? 'Close' : 'Open'} the garage door`, use: () => { st.toggle(); sw.material.color.set(st.open ? 0xff5a72 : 0x48f08c); } });
    tick((dt) => { st.t += ((st.open ? 1 : 0) - st.t) * Math.min(1, dt * 2.5); door.position.y = G + S.h / 2 + st.t * (S.h - 0.4); });
    return st;
  })();
  // Driveable lineup: yellow out front, three on each side at an angle
  {
    const w = W[1], colors = [0xc8252f, 0x1f6bff, 0xf4f4f6, 0x1a1c22, 0x2cc48a, 0xe85d9a];
    const yel = w.P(5, 9.9); makeCar(0xf5c518, yel[0], yel[1], 0, yawOf(w.n[0], w.n[1]), { name: 'yellow car' });
    spots.garageCars.forEach(([u, v, side], i) => {
      const p = w.P(u, v), a = 0.5; // nose toward the lane and the exit
      const dx = w.n[0] * Math.cos(a) + w.t[0] * Math.sin(a) * side, dy = w.n[1] * Math.cos(a) + w.t[1] * Math.sin(a) * side;
      makeCar(colors[i], p[0], p[1], 0, yawOf(dx, dy), { name: ['red car', 'blue car', 'white car', 'black car', 'green car', 'pink car'][i] });
    });
    // One up on the lift
    const L = w.P(spots.lift.u, spots.lift.v); makeCar(0xe86a28, L[0], L[1], 3.4, yawOf(w.t[0], w.t[1]), { noDrive: true, spoiler: false });
    cars.pop();
  }
  // The cars out front
  {
    const palette = [0xc8252f, 0x1f4fa8, 0xf0b81a, 0xf4f4f6, 0x20c0a0, 0x7a3fd0]; let i = 0;
    for (const cx of [-30.5, -24.5, -18.5, 7.5, 13.5, 19.5]) makeCar(palette[i++], cx, 3, 0, yawOf(0, -1), { name: 'driveway car' });
  }
  for (const [x, y, t] of spots.roadSigns) label(P3(x, y, 5), 0, `${t} →`, 9);

  // ---------- Racetrack ----------
  const path = spots.track.path, N = path.length;
  const atS = (s) => { s = ((s % path.total) + path.total) % path.total; let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (path[m].s <= s) lo = m; else hi = m - 1; } const a = path[lo], b = path[(lo + 1) % N], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, t = Math.min(1, (s - a.s) / L); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: (b.x - a.x) / L, dy: (b.y - a.y) / L }; };
  // Speed limit per point, from how sharply the track bends just ahead
  const limit = path.map((_, i) => { const a = path[i], b = path[(i + 16) % N], c = path[(i + 32) % N]; const a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - b.y, c.x - b.x); let d = Math.abs(a2 - a1); if (d > Math.PI) d = 6.283 - d; return Math.max(15, 33 - d * 26); });
  let startI = 0, bd = 1e9; path.forEach((p, i) => { const d = Math.hypot(p.x - spots.track.start.x, p.y - spots.track.start.y); if (d < bd) { bd = d; startI = i; } });
  const S0 = path[startI].s;
  const gridAt = (slot) => { const row = Math.floor(slot / 2), side = slot % 2 ? -3 : 3; const p = atS(S0 - 7 - row * 8); return { x: p.x + -p.dy * side, y: p.y + p.dx * side, yaw: yawOf(p.dx, p.dy), s: S0 - 7 - row * 8, off: side }; };
  const rivalColors = [0xe0347a, 0x2ea6e0, 0x34e070], rivalNames = ['MAX', 'DZZY', 'XEN'];
  const rivals = rivalColors.map((c, i) => { const g = gridAt(i); const car = makeCar(c, g.x, g.y, 0, g.yaw, { noDrive: true }); return { car, slot: i, s: g.s, off: g.off, v: 0, name: rivalNames[i], skill: [0.97, 0.93, 0.89][i], laps: 0 }; });
  const race = { running: false, count: 0, player: null, laps: 5, lap: 0, ps: 0, t: 0, lastI: 0, half: false, best: +(localStorage.getItem('imp_race_best') || 0) };
  const nearStart = (car) => car.g.position.distanceTo(P3(spots.track.start.x, spots.track.start.y, 0)) < 18 && !race.running;
  const placeRivals = () => rivals.forEach((r) => { const g = gridAt(r.slot); r.s = g.s; r.off = g.off; r.v = 0; r.laps = 0; r.car.g.position.copy(P3(g.x, g.y, 0)); r.car.yaw = g.yaw; r.car.g.rotation.y = g.yaw; });
  function startRace(car) {
    placeRivals();
    const g = gridAt(3); car.g.position.copy(P3(g.x, g.y, 0)); car.yaw = g.yaw; car.camYaw = g.yaw; car.g.rotation.y = g.yaw; car.v = 0;
    Object.assign(race, { running: true, count: 3.5, player: car, lap: 1, t: 0, ps: g.s, half: false, cross: 0 });
    game.raceHud({ show: true, big: '3', lap: `LAP 1/${race.laps}`, pos: 'P4' }); sound.fx('blip');
  }
  function endRace(place) {
    race.running = false; game.raceHud({ show: false });
    if (place) {
      const time = race.t.toFixed(2); game.achieve('race'); if (place === 1) game.achieve('racewin');
      if (!race.best || race.t < race.best) { race.best = race.t; localStorage.setItem('imp_race_best', race.t); }
      game.notice(`You finished P${place} in ${time}s. Best time ${race.best.toFixed(2)}s. Press E to go again.`); sound.fx(place === 1 ? 'achieve' : 'horn');
    } else game.notice('Race cancelled.');
    placeRivals();
  }
  tick((dt) => {
    if (!race.running) return;
    const car = race.player;
    if (player.locked?.car !== car) { endRace(null); return; }
    if (race.count > 0) {
      const before = Math.ceil(race.count); race.count -= dt; const now = Math.ceil(race.count);
      if (now !== before) sound.fx(now > 0 ? 'blip' : 'gold');
      game.raceHud({ show: true, big: race.count <= 0 ? 'GO' : String(Math.max(1, now)) });
      return;
    }
    race.t += dt;
    // Player's progress: nearest point, moving forward only
    let bi = 0, bdd = 1e9; const px = car.g.position.x, py = -car.g.position.z;
    for (let i = 0; i < N; i += 2) { const d = (path[i].x - px) ** 2 + (path[i].y - py) ** 2; if (d < bdd) { bdd = d; bi = i; } }
    const raw = path[bi].s; let fwd = raw - (race.ps % path.total); if (fwd < -path.total / 2) fwd += path.total; if (fwd > path.total / 2) fwd -= path.total;
    if (Math.abs(fwd) < 40) race.ps += fwd;
    const pl = (race.ps - S0) / path.total;
    race.lap = Math.max(1, Math.floor(pl) + 1);
    // Rivals drive the line, a bit of rubber band keeps it close
    rivals.forEach((r) => {
      const i = Math.floor((((r.s % path.total) + path.total) % path.total) / path.total * N) % N;
      const gap = r.s - race.ps, band = gap > 40 ? 0.86 : gap < -40 ? 1.12 : 1;
      const target = limit[i] * r.skill * band;
      r.v += Math.max(-18, Math.min(13, target - r.v)) * dt * 1.4; r.s += r.v * dt;
      const p = atS(r.s), o = Math.sin(r.s * 0.02 + r.slot * 2) * 2.4 + r.off * 0.2;
      r.car.g.position.set(p.x - p.dy * o, G, -(p.y + p.dx * o)); r.car.yaw = yawOf(p.dx, p.dy); r.car.g.rotation.y = r.car.yaw;
    });
    const order = [...rivals.map((r) => r.s), race.ps].sort((a, b) => b - a), place = order.indexOf(race.ps) + 1;
    game.raceHud({ show: true, big: race.t < 1 ? 'GO' : '', lap: `LAP ${Math.min(race.lap, race.laps)}/${race.laps}`, pos: `P${place}`, time: race.t.toFixed(1) });
    if (pl >= race.laps) endRace(place);
  });
  // Foot entrance: a race car waits on the grid
  {
    const g = gridAt(3); const blue = makeCar(0x1f6bff, g.x, g.y, 0, g.yaw, { name: 'race car' });
    addE({ pos: P3(spots.track.start.x - 9, spots.track.start.y + 8, 2), r: 12, any: true, prompt: () => race.running ? null : 'Hop in the race car', use: () => { enter(blue); } });
    const B2 = spots.track.board;
    const t = textCanvas(800, 128, (c, w2, h2) => { c.fillStyle = '#1d2a4e'; c.fillRect(0, 0, w2, h2); c.fillStyle = '#f5c518'; c.font = `76px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('INTERNET MANSION SPEEDWAY', w2 / 2, h2 / 2 + 4); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(B2.w, B2.h2), new THREE.MeshBasicMaterial({ map: t })); m.position.copy(P3(B2.x, B2.y, B2.h)); m.rotation.y = Math.PI; scene.add(m);
  }
  return { cars, race };
}
