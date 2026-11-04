// The football stadium's props: field paint, goal posts, scoreboard, signs, whiteboard, elevator.
import * as THREE from 'three';

export function buildStadium(game, data, H) {
  const { scene } = game, { spots, G } = data, { P3, addE, textCanvas, DISPLAY, label, tick } = H, S = spots.stadium, F = S.field;
  const fmt = (n) => n.toLocaleString('en-US');
  // Field paint: real yard lines, hash marks, numbers, end zones
  const w = F.x1 - F.x0, L = F.y1 - F.y0, px = 8;
  const paint = textCanvas(w * px, L * px, (c, W, H2) => {
    c.clearRect(0, 0, W, H2); const yd = (n) => (10 + n) * px; // n yards from the south goal line
    c.fillStyle = '#1f6bff'; c.fillRect(0, 0, W, 10 * px); c.fillStyle = '#c8252f'; c.fillRect(0, H2 - 10 * px, W, 10 * px);
    c.save(); c.fillStyle = '#fff'; c.font = `${7.5 * px}px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('INTERNET', W / 2, 5 * px + 2); c.translate(W / 2, H2 - 5 * px); c.fillText('MANSION', 0, 2); c.restore();
    c.strokeStyle = '#fff'; c.lineWidth = 0.35 * px; c.strokeRect(0.5, 0.5, W - 1, H2 - 1);
    for (let n = 0; n <= 100; n += 5) { c.beginPath(); c.moveTo(0, yd(n)); c.lineTo(W, yd(n)); c.lineWidth = (n % 10 ? 0.2 : 0.3) * px; c.stroke(); }
    c.fillStyle = '#fff';
    for (let n = 1; n < 100; n++) { if (n % 5 === 0) continue; for (const x of [0.5, W / px / 2 - 3.1, W / px / 2 + 3.1, W / px - 0.5]) c.fillRect(x * px - 1, yd(n) - 0.6, 0.7 * px, 1.2); }
    c.font = `${4 * px}px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let n = 10; n <= 90; n += 10) { const v = n <= 50 ? n : 100 - n; for (const [x, r] of [[8, Math.PI / 2], [W / px - 8, -Math.PI / 2]]) { c.save(); c.translate(x * px, yd(n)); c.rotate(r); c.fillText(String(v), 0, 0); c.restore(); } }
    c.fillStyle = '#f5c518'; c.beginPath(); c.arc(W / 2, H2 / 2, 8 * px, 0, 7); c.fill(); c.fillStyle = '#0b0d12'; c.font = `${8 * px}px ${DISPLAY}`; c.fillText('IMP', W / 2, H2 / 2 + 2);
  });
  paint.anisotropy = 8;
  const field = new THREE.Mesh(new THREE.PlaneGeometry(w, L), new THREE.MeshBasicMaterial({ map: paint, transparent: true, depthWrite: false }));
  field.rotation.x = -Math.PI / 2; field.position.copy(P3(S.cx, S.cy, 0.03)); field.renderOrder = 1; scene.add(field);
  // Goal posts
  const yellow = new THREE.MeshLambertMaterial({ color: 0xf5c518 });
  const bar = (rx, ry, h, px2, py, pz, rz) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rx, ry, h, 8), yellow); m.position.set(px2, py, pz); if (rz) m.rotation.z = rz; scene.add(m); };
  for (const y of [F.y0 - 1, F.y1 + 1]) { const z = -y; bar(0.25, 0.25, 5, S.cx, G + 2.5, z); bar(0.16, 0.16, 8, S.cx, G + 5, z, Math.PI / 2); for (const s of [-4, 4]) bar(0.13, 0.13, 10, S.cx + s, G + 10, z); }
  // Scoreboard
  const B = S.board, seats = fmt(S.seats);
  const sb = textCanvas(1024, 450, (c, W, H2) => { c.fillStyle = '#05060a'; c.fillRect(0, 0, W, H2); c.textAlign = 'center'; c.fillStyle = '#f5c518'; c.font = `92px ${DISPLAY}`; c.fillText('INTERNET MANSION', W / 2, 96); c.fillStyle = '#fff'; c.font = `50px ${DISPLAY}`; c.fillText('HOME', 230, 180); c.fillText('GUEST', 794, 180); c.fillStyle = '#ff5a72'; c.font = `150px ${DISPLAY}`; c.fillText('00', 230, 318); c.fillText('00', 794, 318); c.fillStyle = '#fff'; c.font = `50px ${DISPLAY}`; c.fillText('1ST + 10', W / 2, 200); c.font = `80px ${DISPLAY}`; c.fillStyle = '#f5c518'; c.fillText('15:00', W / 2, 300); c.fillStyle = '#9aa3b5'; c.font = `34px ${DISPLAY}`; c.fillText(`${seats} SEATS. NOBODY'S HERE YET.`, W / 2, 415); });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.h2), new THREE.MeshBasicMaterial({ map: sb })); board.position.copy(P3(B.x, B.y, B.h)); board.rotation.y = Math.PI; scene.add(board);
  // Signs: over the gate, in the tunnel, in the locker room
  const sign = (pos, rot, text, wid, hei, gold) => label(pos, rot, text, wid, hei, gold);
  const gate = textCanvas(1400, 180, (c, W, H2) => { c.fillStyle = '#0b0d12'; c.fillRect(0, 0, W, H2); c.fillStyle = '#f5c518'; c.font = `130px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('INTERNET MANSION STADIUM', W / 2, H2 / 2 + 6); });
  const g2 = new THREE.Mesh(new THREE.PlaneGeometry(S.gate.w, S.gate.h2), new THREE.MeshBasicMaterial({ map: gate })); g2.position.copy(P3(S.gate.x, S.gate.y, S.gate.h)); g2.rotation.y = Math.PI / 2; scene.add(g2);
  const T = S.tunnel, Lk = S.locker;
  sign(P3(S.cx, T.y0 - 0.2, 8.6), Math.PI, 'THE TUNNEL', 12, 1.2, true);
  sign(P3(S.cx, Lk.y0 + 0.05, 8.3), Math.PI * 0, 'TO THE FIELD', 8, 0.9);
  sign(P3(S.cx, Lk.y1 - 2.05, 7.6), Math.PI * 0, 'INTERNET MANSION FOOTBALL', 20, 1.6, true);
  const wb = textCanvas(512, 320, (c, W, H2) => { c.fillStyle = '#f7f7f4'; c.fillRect(0, 0, W, H2); c.strokeStyle = '#1f3c88'; c.lineWidth = 5; c.fillStyle = '#1f3c88'; c.font = `34px ${DISPLAY}`; c.fillText('TODAY: 4TH AND COMMENT', 26, 44); for (const [x, y] of [[120, 120], [200, 120], [280, 120], [360, 120], [240, 220]]) { c.beginPath(); c.arc(x, y, 18, 0, 7); c.stroke(); } c.strokeStyle = '#c8252f'; c.beginPath(); c.moveTo(240, 200); c.quadraticCurveTo(160, 40, 410, 60); c.stroke(); });
  const wbm = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.4), new THREE.MeshBasicMaterial({ map: wb })); wbm.position.copy(P3(Lk.x0 + 6.5, Lk.y0 + 1.05, 4.5)); wbm.rotation.y = Math.PI; scene.add(wbm);
  addE({ pos: P3(S.cx, Lk.y0 + 12, 1), r: 6, any: true, prompt: () => 'Read the locker room sign', use: () => { game.notice(`${seats} seats out there. Run through the tunnel.`); game.sound.fx('horn'); } });
  // Elevator up to the boxes and upper deck
  game.makeElevator({ x: S.lift.x, y: S.lift.y, title: 'STADIUM ELEVATOR', floors: [
    { n: 'Main Gate', h: 0, exit: [S.lift.x, S.cy + 5] }, { n: 'Luxury Boxes', h: 25, exit: [S.lift.x - 2.5, S.lift.y - 3] }, { n: 'Upper Deck', h: 34, exit: [S.lift.x + 3.5, S.lift.y - 3] },
  ] });
  console.info(`Stadium: ${S.seats} seats, ${S.boxSeats} box seats`);
  void tick;
}
