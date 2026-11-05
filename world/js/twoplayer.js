// Two players by room code. Browsers talk directly to each other over WebRTC.
// A free public service (PeerJS, library in vendor/peerjs.min.js) only introduces them: it sees the code and connection details, never names or movement.
// Public lobbies will need a real server. Both players' browsers can see each other's IP address, so this is for friends.
import * as THREE from 'three';

const PREFIX = 'impmansion-';
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', CODE_LEN = 5;
const SEND_EVERY = 1 / 12, JOIN_TIMEOUT = 20000;

const randomCode = (n = CODE_LEN) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => LETTERS[b % LETTERS.length]).join('');
const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
const cleanName = (s) => String(s || '').replace(/[^\w. -]/g, '').slice(0, 30) || 'Friend';

export function buildTwoPlayer(game) {
  const $ = (id) => document.getElementById(id), { scene, player } = game;
  let role = null, code = '', peer = null, chan = null, joinTimer = null, sendT = 0;
  let peerName = '', time = 0;

  // ---------- The other player ----------
  const body = new THREE.Group(); body.visible = false; scene.add(body);
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0b48c }), shirt = new THREE.MeshLambertMaterial({ color: 0xff3f9a }), pants = new THREE.MeshLambertMaterial({ color: 0x1d2a4e }), hat = new THREE.MeshLambertMaterial({ color: 0x34e0a0 });
  const part = (w, h, d, m, x, y, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; body.add(o); return o; };
  part(0.5, 0.5, 0.5, skin, 0, 1.55); part(0.54, 0.16, 0.54, hat, 0, 1.78); part(0.3, 0.06, 0.2, hat, 0, 1.72, -0.34); part(0.55, 0.65, 0.3, shirt, 0, 1.0);
  const limbs = [part(0.2, 0.65, 0.22, shirt, -0.38, 1.0), part(0.2, 0.65, 0.22, shirt, 0.38, 1.0), part(0.24, 0.7, 0.26, pants, -0.14, 0.35), part(0.24, 0.7, 0.26, pants, 0.14, 0.35)];
  const target = new THREE.Vector3(); let targetYaw = 0, heard = false, tag = null, speed = 0;
  const setTag = (name) => { if (tag) { body.remove(tag); tag.material.map.dispose(); tag.material.dispose(); } tag = game.nameTag(name); body.add(tag); };

  // ---------- Screens ----------
  const show = (which) => { for (const id of ['tpIdle', 'tpHost', 'tpOn']) $(id).hidden = id !== which; };
  const say = (text) => { $('tpErr').textContent = text || ''; $('tpErr').hidden = !text; };
  const inviteLink = () => `${location.origin}${location.pathname}?room=${code}`;
  const render = () => {
    if (chan && chan.open && peerName) { show('tpOn'); $('tpWith').textContent = `Playing with ${peerName}`; return; }
    if (role === 'host') { show('tpHost'); $('tpCode').textContent = code; $('tpLink').textContent = inviteLink(); return; }
    show('tpIdle'); $('tpJoinBtn').disabled = role === 'guest'; $('tpStart').disabled = role !== null; $('tpJoinBtn').textContent = role === 'guest' ? 'Connecting...' : 'Join';
  };

  // ---------- The connection ----------
  const stopPeer = () => { if (peer) { const p = peer; peer = null; p.removeAllListeners(); p.destroy(); } };
  const dropPeer = () => {
    if (chan) { const c = chan; chan = null; c.removeAllListeners(); c.close(); }
    body.visible = false; heard = false; peerName = ''; // The room itself stays open for the host
  };
  const peerLeft = () => {
    const was = peerName; dropPeer();
    if (was) game.notice(`${was} left.`);
    if (role === 'guest') { role = null; stopPeer(); }
    render();
  };
  const fail = (message) => { clearTimeout(joinTimer); dropPeer(); role = null; stopPeer(); say(message); render(); };
  const wireChannel = (c) => {
    chan = c;
    c.on('open', () => { clearTimeout(joinTimer); say(''); sendPosition(); render(); });
    c.on('data', receive);
    c.on('close', peerLeft);
    c.on('error', () => { if (role === 'guest' && !peerName) fail("Couldn't connect. Some networks block this, like school or office Wi-Fi."); });
  };
  const serviceTrouble = "Couldn't reach the connection service. Try again in a minute.";
  const openRoom = () => {
    stopPeer();
    const p = peer = new window.Peer(PREFIX + code, { config: { iceServers: ICE } });
    p.on('connection', (c) => { if (chan) { c.on('open', () => c.close()); return; } wireChannel(c); }); // Two players only: anyone else just doesn't get in
    p.on('disconnected', () => { if (p === peer && !p.destroyed) setTimeout(() => { if (p === peer && !p.destroyed) p.reconnect(); }, 3000); }); // Stay findable
    p.on('error', (e) => {
      if (e.type === 'unavailable-id') { code = randomCode(); render(); openRoom(); }
      else if (!['network', 'disconnected', 'socket-error', 'socket-closed'].includes(e.type)) fail(serviceTrouble);
    });
  };
  const start = () => {
    if (role) return; say(''); role = 'host'; code = randomCode(); render();
    openRoom();
  };
  const join = (raw) => {
    const c = cleanCode(raw);
    if (role) return;
    if (c.length !== CODE_LEN) { say(`Room codes have ${CODE_LEN} letters and numbers.`); return; }
    say(''); role = 'guest'; code = c; render();
    joinTimer = setTimeout(() => fail("Couldn't connect. Check the code, and make sure your friend's room is open."), JOIN_TIMEOUT);
    const p = peer = new window.Peer({ config: { iceServers: ICE } });
    p.on('open', () => wireChannel(p.connect(PREFIX + code, { reliable: false, serialization: 'json' })));
    p.on('error', (e) => { if (p !== peer) return; fail(e.type === 'peer-unavailable' ? "Couldn't find that room. Check the code, and make sure your friend's room is open." : serviceTrouble); });
  };
  const leave = () => { clearTimeout(joinTimer); dropPeer(); role = null; code = ''; stopPeer(); say(''); render(); };

  // ---------- Moves ----------
  function sendPosition() {
    if (!chan || !chan.open) return;
    const p = player.pos;
    chan.send(JSON.stringify({ n: game.name, p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], y: +player.yaw.toFixed(2) }));
  }
  // Whatever arrives could be anything, so only numbers in range and a cleaned name get used.
  function receive(raw) {
    if (typeof raw !== 'string' || raw.length > 300) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || !Array.isArray(m.p) || m.p.length !== 3 || !m.p.every((v) => Number.isFinite(v) && Math.abs(v) < 2000) || !Number.isFinite(m.y)) return;
    const name = cleanName(m.n);
    if (name !== peerName) { const first = !peerName; peerName = name; setTag(name); if (first) game.notice(`${name} is here. Open Play with a friend to go to them.`); render(); }
    target.set(m.p[0], m.p[1], m.p[2]); targetYaw = m.y;
    if (!heard) { heard = true; body.position.copy(target); body.rotation.y = targetYaw; body.visible = true; }
  }
  game.twoPlayerUpdate = (dt) => {
    time += dt;
    if (chan && chan.open) { sendT += dt; if (sendT >= SEND_EVERY) { sendT = 0; sendPosition(); } }
    if (!heard) return;
    const before = body.position.clone();
    if (body.position.distanceTo(target) > 25) body.position.copy(target); else body.position.lerp(target, 1 - Math.exp(-dt * 12));
    let turn = (targetYaw - body.rotation.y) % (Math.PI * 2); if (turn > Math.PI) turn -= Math.PI * 2; if (turn < -Math.PI) turn += Math.PI * 2;
    body.rotation.y += turn * Math.min(1, dt * 12);
    if (dt > 0) speed += (Math.hypot(body.position.x - before.x, body.position.z - before.z) / dt - speed) * Math.min(1, dt * 8);
    const sw = Math.sin(time * 11) * Math.min(0.9, speed * 0.12);
    limbs[0].rotation.x = sw; limbs[1].rotation.x = -sw; limbs[2].rotation.x = -sw; limbs[3].rotation.x = sw;
  };

  // ---------- Buttons ----------
  $('tpStart').onclick = start;
  $('tpJoinBtn').onclick = () => join($('tpInput').value);
  $('tpInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); join($('tpInput').value); } });
  $('tpInput').addEventListener('input', () => { $('tpInput').value = cleanCode($('tpInput').value); });
  $('tpLeaveHost').onclick = $('tpLeaveOn').onclick = leave;
  $('tpCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(inviteLink()); $('tpCopy').textContent = 'Copied'; }
    catch { $('tpCopy').textContent = 'Copy it from above'; }
    setTimeout(() => { $('tpCopy').textContent = 'Copy invite link'; }, 2000);
  };
  $('tpGo').onclick = () => {
    if (!heard) return;
    if (player.locked) game.exitLocked();
    player.flying = false; player.teleport(target.x + 1.5, target.y + 0.5, target.z + 1.5);
    game.closeTwoPlayer();
  };
  addEventListener('pagehide', () => { dropPeer(); stopPeer(); });
  render();

  // A friend's invite link joins as soon as they walk in
  game.twoPlayerAutoJoin = () => {
    const c = cleanCode(new URLSearchParams(location.search).get('room'));
    if (c.length === CODE_LEN) { game.notice('Joining your friend...'); join(c); }
  };
  game.twoPlayer = { start, join, leave, get code() { return code; }, get role() { return role; }, get peer() { return peerName; }, get open() { return !!chan && chan.open; }, body };
}
