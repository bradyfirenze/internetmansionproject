// Signage, the glass elevator, the festival stage and the Movie Theater library.
import * as THREE from 'three';
import { FRIENDS_LINK } from './settings.js';
import { makeQR, drawQR } from './qr.js';

export function buildExtras(game, data, H) {
  const { scene, player, sound } = game, { spots, W, G } = data, { P3, addE, tick, textCanvas, DISPLAY, label, button, musicAt } = H;

  // ---------- Signs over every way out of the foyer ----------
  const wingSign = (i, text) => { const w = W[i], [x, y] = w.P(-1.0, w.width / 2); label(P3(x, y, 10.1), Math.atan2(-w.n[0], w.n[1]), text, 11, 0.95); };
  wingSign(1, 'HOT ROD GARAGE + RACETRACK');
  wingSign(3, 'GAMING + STUDIO + MOVIES');
  wingSign(5, 'LOUNGE + GALLERY + CLOSET');
  wingSign(7, 'KITCHEN + OPEN ROOMS');
  label(P3(-41.9, 25, 12), Math.PI / 2, 'HALL OF FAME + STADIUM', 9.6, 1.6);
  label(P3(29.9, 25, 12), -Math.PI / 2, 'POOL + FESTIVAL STAGE', 9.6, 1.6);
  label(P3(-6, 88.9, 7), Math.PI, 'PARTY ROOM', 8, 1.1);
  label(P3(-6.5, 59.9, 15), 0 + Math.PI * 0, 'ROOMS FLOOR + ELEVATOR', 12, 1);
  label(P3(-6.5, 11.4, 10), Math.PI, 'THE GRAND FOYER', 12, 1.2, true);
  // Room names inside the wings, over each arch
  const archSign = (i, u, text, back) => { const w = W[i], [x, y] = w.P(u + (back ? 0.95 : -0.95), w.width / 2); const a = Math.atan2(-w.n[0], w.n[1]); label(P3(x, y, 9.4), back ? a + Math.PI : a, text, 9, 0.8); };
  archSign(3, 0.95, 'GAMING ROOM', true); archSign(3, 15, 'MUSIC STUDIO'); archSign(3, 30, 'MOVIE THEATER');
  archSign(5, 0.95, 'CHILL LOUNGE', true); archSign(5, 16.67, 'ART GALLERY'); archSign(5, 33.33, 'DESIGNER CLOSET');
  archSign(7, 0.95, 'KITCHEN', true); archSign(7, 15, 'OPEN ROOM'); archSign(7, 30, 'OPEN ROOM');
  label(P3(-20, 74.1, 16.2), 0, 'ROOMS 1 TO 10', 8, 0.9);
  // Coming soon signs. Nothing here promises a date or the party.
  const soonWidth = (text) => text.length * 0.42 + 1.2;
  const soonOnWall = (i, u, h, text) => { const w = W[i], [x, y] = w.P(u, 1.6); label(P3(x, y, h), Math.atan2(w.t[0], -w.t[1]), text, soonWidth(text), 1.2, true); };
  soonOnWall(3, 8, 7, 'MORE GAMES COMING SOON');
  soonOnWall(3, 22.5, 7, 'COLLABORATION COMING SOON');
  soonOnWall(3, 45, 7, 'MORE MOVIES COMING SOON');
  soonOnWall(5, 8, 7, 'ROOM CHAT COMING SOON');
  soonOnWall(5, 25, 7, 'SUBMIT YOUR ART COMING SOON');
  { const text = 'SUBMIT YOUR DESIGNS COMING SOON', w = W[5], [x, y] = w.P(41.7, w.width - 1.6); label(P3(x, y, 7), Math.atan2(-w.t[0], w.t[1]), text, soonWidth(text), 1.2, true); } // The other wall: this one's got the clothes racks
  soonOnWall(1, 31, 8, 'CUSTOM CARS COMING SOON');
  label(P3(-6, 125, 9), 0, 'MORE COMING SOON', soonWidth('MORE COMING SOON'), 1.2, true); // Party Room, over the DJ booth
  label(P3(spots.stadium.gate.x + 0.2, spots.stadium.gate.y, 6.5), Math.PI / 2, 'GAME DAY COMING SOON', soonWidth('GAME DAY COMING SOON'), 1.2, true);
  { // Backyard: its own post on the pool deck, facing the way people walk out of the house
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), new THREE.MeshBasicMaterial({ color: 0xc9a227 })); post.position.copy(P3(44, 20, 2.5)); scene.add(post);
    label(P3(44, 20, 5.2), -Math.PI / 2, 'POOL GAMES COMING SOON', soonWidth('POOL GAMES COMING SOON'), 1.2, true);
  }

  // ---------- Elevators ----------
  const $ = (id) => document.getElementById(id);
  const makeElevator = ({ x, y, floors, title = 'ELEVATOR' }) => {
    const cabin = new THREE.Group(), gold = new THREE.MeshBasicMaterial({ color: 0xc9a227 });
    const bar = (w, h, d, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gold); m.position.set(px, py, pz); cabin.add(m); };
    bar(3, 0.25, 4, 0, 0, 0); bar(3, 0.25, 4, 0, 3.4, 0); [[-1.4, -1.9], [1.4, -1.9], [-1.4, 1.9], [1.4, 1.9]].forEach(([a, c]) => bar(0.15, 3.4, 0.15, a, 1.7, c));
    cabin.position.copy(P3(x, y, floors[0].h)); scene.add(cabin);
    let moving = false;
    const go = (f) => {
      $('elevator').hidden = true; game.lock(true);
      if (moving) return; moving = true;
      const y1 = G + f.h, from = cabin.position.y, D = Math.max(1.6, Math.abs(y1 - from) * 0.16), px = x, pz = -y; let t = 0;
      sound.fx('door'); player.vel.set(0, 0, 0);
      player.locked = {
        label: 'elevator', noExit: true,
        camera(cam) { cam.rotation.order = 'YXZ'; cam.rotation.set(player.pitch, player.yaw, 0); cam.position.set(px, cabin.position.y + 1.6, pz); },
        update(dt) {
          t = Math.min(1, t + dt / D); const k = t * t * (3 - 2 * t); cabin.position.y = from + (y1 - from) * k;
          if (t >= 1) {
            player.locked = null; moving = false; sound.fx('gold'); game.achieve('elevator');
            const ex = f.exit ? f.exit[0] : x, ey = f.exit ? f.exit[1] : f.out; let h = f.h + 0.02; while (player.hit(ex, G + h, -ey) && h < f.h + 30) h += 1; player.teleport(ex, G + h, -ey);
          }
        },
      };
    };
    const open = () => {
      $('elevatorTitle').textContent = title;
      $('elevatorBtns').innerHTML = floors.map((f, i) => `<button data-f="${i}">${f.n.toUpperCase()}</button>`).join('');
      $('elevatorBtns').querySelectorAll('button').forEach((b) => { b.onclick = () => go(floors[+b.dataset.f]); });
      $('elevator').hidden = false; game.lock(false);
    };
    floors.forEach((f) => { const ex = f.exit ? f.exit[0] : x, ey = f.exit ? f.exit[1] : f.out; addE({ pos: P3(ex, ey, f.h + 1.2), r: 4, any: true, priority: 2, prompt: () => 'Call the elevator', use: open }); });
  };
  $('elevatorClose').onclick = () => { $('elevator').hidden = true; game.lock(true); };
  game.makeElevator = makeElevator;
  makeElevator({ x: spots.elevator.x, y: spots.elevator.y, floors: [{ n: 'Foyer', h: 0, out: spots.elevator.y - 4 }, { n: 'Rooms', h: 13, out: spots.elevator.y + 3.6 }, { n: 'Roof', h: 19, out: spots.elevator.y + 3.6 }] });

  // ---------- Festival stage ----------
  {
    const S = spots.stage, canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const c = canvas.getContext('2d'), tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(S.screen.w, S.screen.h2), new THREE.MeshBasicMaterial({ map: tex })); scr.position.copy(P3(S.screen.x, S.screen.y, S.screen.h)); scene.add(scr);
    const pos = P3(S.beams.x, S.beams.y, S.beams.h), beams = new THREE.Group(); beams.position.copy(pos); scene.add(beams); beams.visible = false; const list = [];
    const cols = [0xff3f9a, 0x38b6ff, 0xf5c518, 0x9c5cff, 0x34e0a0];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.MeshBasicMaterial({ color: cols[i % 5], transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(4, 42, 12, 1, true), m); cone.geometry.translate(0, -21, 0);
      const pv = new THREE.Group(); pv.position.x = (i - 6.5) * 3.2; pv.add(cone); beams.add(pv); list.push(pv);
    }
    // Strobes across the top of the stage, lasers out over the crowd, confetti when the song is on
    const strobes = [], lasers = [], rig = new THREE.Group(); rig.position.copy(pos); rig.visible = false; scene.add(rig);
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff })); s.position.set((i - 7.5) * 3.1, 2, 0); rig.add(s); strobes.push(s);
    }
    for (let i = 0; i < 18; i++) {
      const m = new THREE.MeshBasicMaterial({ color: cols[i % 5], transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 130, 5), m); beam.geometry.translate(0, -65, 0);
      const pv = new THREE.Group(); pv.position.x = (i - 8.5) * 2.7; pv.add(beam); rig.add(pv); lasers.push(pv);
    }
    const CONFETTI = 500, cPos = new Float32Array(CONFETTI * 3), cCol = new Float32Array(CONFETTI * 3), hue = new THREE.Color();
    const seedBit = (i) => { cPos[i * 3] = pos.x + (Math.random() - 0.5) * 70; cPos[i * 3 + 1] = pos.y + Math.random() * 18; cPos[i * 3 + 2] = pos.z + 4 + Math.random() * 50; };
    for (let i = 0; i < CONFETTI; i++) { seedBit(i); hue.setHSL(Math.random(), 0.95, 0.6); cCol.set([hue.r, hue.g, hue.b], i * 3); }
    const cGeo = new THREE.BufferGeometry(); cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3)); cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
    const confetti = new THREE.Points(cGeo, new THREE.PointsMaterial({ size: 0.55, vertexColors: true })); confetti.visible = false; confetti.frustumCulled = false; scene.add(confetti);

    // FRIENDS, played through the game's sound so Mute works and the lights can follow the music
    const song = new Audio('assets/music/friends.m4a'); song.preload = 'none';
    let songGain = null, analyser = null, freq = null, songOK = true, beat = 0, slowE = 0;
    song.addEventListener('error', () => { songOK = false; });
    const stagePos = P3(S.x, 90, 6);
    const wireSong = () => {
      if (analyser || !sound.ctx) return;
      const src = sound.ctx.createMediaElementSource(song); analyser = sound.ctx.createAnalyser(); analyser.fftSize = 256; freq = new Uint8Array(analyser.frequencyBinCount);
      songGain = sound.ctx.createGain(); songGain.gain.value = 0; src.connect(analyser); analyser.connect(songGain); songGain.connect(sound.master);
    };
    // The song's page, once FRIENDS_LINK is set. Local copies can try one with ?friendslink=
    const testLink = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('friendslink');
    const link = [testLink, FRIENDS_LINK].find((u) => u && /^https:\/\//.test(u)) || '', qr = link ? makeQR(link) : null;
    const tx = qr ? 165 : 256; // With a code on the right, the words move over and shrink to fit
    let on = false, lastDraw = 0;
    const draw = (t) => {
      const flash = on ? beat : 0;
      c.fillStyle = on ? `hsl(${(t * 90) % 360},80%,${6 + flash * 45}%)` : '#0b0d12'; c.fillRect(0, 0, 512, 256);
      if (on) { for (let i = 0; i < 16; i++) { const v = freq ? freq[2 + i * 3] / 255 : Math.abs(Math.sin(t * 3 + i * 0.7)), h = 20 + v * 225; c.fillStyle = `hsl(${(i * 24 + t * 120) % 360},95%,62%)`; c.fillRect(8 + i * 31, 256 - h, 24, h); } }
      c.textAlign = 'center';
      if (on) { c.fillStyle = '#fff'; c.font = `${(qr ? 66 : 92) + flash * 16}px ${DISPLAY}`; c.fillText('FRIENDS', tx, 110); c.font = `${qr ? 19 : 30}px ${DISPLAY}`; c.fillStyle = '#f5c518'; c.fillText('LIVE AT THE INTERNET MANSION', tx, 150); }
      else { c.fillStyle = '#f5c518'; c.font = `${qr ? 37 : 58}px ${DISPLAY}`; c.fillText('INTERNET MANSION', tx, 92); c.font = `${qr ? 26 : 34}px ${DISPLAY}`; c.fillStyle = '#fff'; c.fillText('MAIN STAGE', tx, 140); }
      if (qr) { c.fillStyle = '#000'; c.fillRect(316, 8, 188, 240); const full = drawQR(c, qr, 322, 14, 176); c.fillStyle = '#fff'; c.font = `22px ${DISPLAY}`; c.fillText('SCAN TO LISTEN', 410, 14 + full + 28); }
      tex.needsUpdate = true;
    };
    draw(0);
    if (link) {
      $('friendsGo').href = link;
      const big = $('friendsQR'); big.width = big.height = 400; if (qr) drawQR(big.getContext('2d'), qr, 0, 0, 400); else big.hidden = true;
      button(P3(S.x + 5, S.y - 1, S.h), 0x38b6ff, () => 'Listen to FRIENDS', () => { sound.fx('click'); $('friendsSheet').hidden = false; game.lock(false); });
    }
    const stopShow = () => {
      on = false; beams.visible = false; rig.visible = false; confetti.visible = false; song.pause(); beat = 0; draw(0);
      if (game.musicSource?.style === 'party') { sound.stopMusic(); game.musicSource = null; }
    };
    song.addEventListener('ended', () => { if (on) { stopShow(); song.currentTime = 0; game.notice('That was FRIENDS. Press the button to run it back.'); } });
    button(P3(S.x, S.y - 1, S.h), 0xff3f9a, () => on ? 'Stop the song' : 'Play FRIENDS', () => {
      sound.fx('click');
      if (on) { stopShow(); return; }
      on = true; beams.visible = true; rig.visible = true; confetti.visible = true; game.achieve('stage');
      sound.init(); sound.stopMusic(); game.musicSource = null; wireSong();
      if (songOK) { song.currentTime = song.ended ? 0 : song.currentTime; const p = song.play(); if (p) p.catch(() => { songOK = false; musicAt('party', 4, stagePos.clone(), 110); }); }
      else musicAt('party', 4, stagePos.clone(), 110);
    });
    tick((dt, t) => {
      if (!on) return;
      // Follow the kick drum: compare the low end right now with the last second or so
      let e = 0.5 + Math.sin(t * 13) * 0.5;
      if (analyser && !song.paused) { analyser.getByteFrequencyData(freq); e = (freq[1] + freq[2] + freq[3] + freq[4]) / 1020; }
      slowE += (e - slowE) * Math.min(1, dt * 2.5);
      if (e > slowE * 1.12 && e > 0.35) beat = 1; else beat = Math.max(0, beat - dt * 5);
      if (songGain) songGain.gain.value = Math.max(0, Math.min(1, 1.15 - player.pos.distanceTo(stagePos) / 170));
      const pace = 1 + beat * 3;
      list.forEach((p, i) => {
        p.rotation.z = Math.sin(t * 2.4 * pace * 0.5 + i) * 0.8; p.rotation.x = 0.55 + Math.sin(t * 1.8 + i * 1.7) * 0.45;
        const m = p.children[0].material; m.opacity = 0.05 + beat * 0.3 + (Math.random() < 0.12 ? 0.18 : 0); if (Math.random() < 0.03) m.color.setHex(cols[Math.floor(Math.random() * 5)]);
      });
      strobes.forEach((s, i) => { s.visible = beat > 0.55 ? (i + Math.floor(t * 18)) % 2 === 0 : Math.random() < 0.06; });
      lasers.forEach((p, i) => { p.rotation.x = 1.15 + Math.sin(t * 1.4 + i * 0.5) * 0.3; p.rotation.z = Math.sin(t * 2.1 + i) * 0.75; p.visible = beat > 0.25 || i % 3 === Math.floor(t * 4) % 3; });
      for (let i = 0; i < CONFETTI; i++) { cPos[i * 3 + 1] -= dt * (2 + (i % 5)); cPos[i * 3] += Math.sin(t * 2 + i) * dt * 1.4; if (cPos[i * 3 + 1] < G) seedBit(i); }
      cGeo.attributes.position.needsUpdate = true;
      if (t - lastDraw > 0.07) { lastDraw = t; draw(t); }
    });
  }

  // ---------- Movie Theater ----------
  {
    const M = spots.movie, w = W[3], rot = Math.atan2(-w.n[0], w.n[1]), c = P3(M.x, M.y, 4.6);
    const video = document.createElement('video'); video.crossOrigin = 'anonymous'; video.playsInline = true; video.loop = true; video.preload = 'none';
    const vt = new THREE.VideoTexture(video); vt.colorSpace = THREE.SRGBColorSpace;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(15, 8.6), new THREE.MeshBasicMaterial({ color: 0x050508 })); back.position.copy(c); back.rotation.y = rot; scene.add(back);
    const idle = textCanvas(180, 320, (x, W2, H2) => { x.fillStyle = '#0b0d12'; x.fillRect(0, 0, W2, H2); x.fillStyle = '#f5c518'; x.font = `38px ${DISPLAY}`; x.textAlign = 'center'; x.fillText('NOW', W2 / 2, 140); x.fillText('SHOWING', W2 / 2, 182); x.fillStyle = '#fff'; x.font = `22px ${DISPLAY}`; x.fillText('PICK A MOVIE', W2 / 2, 216); });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(4.75, 8.45), new THREE.MeshBasicMaterial({ map: idle })); scr.position.copy(c); scr.position.x -= w.n[0] * 0.05; scr.position.z += w.n[1] * 0.05; scr.rotation.y = rot; scene.add(scr);
    let playing = null;
    const stop = () => { video.pause(); playing = null; scr.material.map = idle; scr.material.needsUpdate = true; render(); };
    const play = (m) => { playing = m.id; video.src = `assets/movies/${m.id}.mp4`; video.muted = sound.muted; video.volume = 0.85; video.play().catch(() => {}); scr.material.map = vt; scr.material.needsUpdate = true; game.achieve('movie'); $('movies').hidden = true; game.lock(true); };
    const card = (m) => `<button class="mv" data-id="${m.id}"><img src="assets/movies/${m.id}.jpg" alt=""><b>${m.title}</b>${playing === m.id ? '<small>Playing</small>' : ''}</button>`;
    const soon = (t, s) => `<div class="mv soon"><div class="ph">IN-MANSION ONLY</div><b>${t}</b><small>${s}</small></div>`;
    function render() {
      $('moviesList').innerHTML = `<div class="shelf">ON THE FEED</div><div class="row">${assets.movies.map(card).join('')}</div>
        <div class="shelf gold">MANSION EXCLUSIVES</div><div class="row">${soon('Room Tours', 'Coming soon')}${soon('Mansion News', 'Coming soon')}${soon('Behind the Bricks', 'Coming soon')}</div>${playing ? '<button id="movieStop" class="close wideBtn">Stop the movie</button>' : ''}`;
      $('moviesList').querySelectorAll('button.mv').forEach((b) => { b.onclick = () => play(assets.movies.find((m) => m.id === b.dataset.id)); });
      const st = $('movieStop'); if (st) st.onclick = () => { stop(); };
    }
    $('moviesClose').onclick = () => { $('movies').hidden = true; game.lock(true); };
    const seat = w.P(w.len * 0.75, 9.9);
    addE({ pos: P3(seat[0], seat[1], 1.5), r: 15, any: true, prompt: () => 'Pick a movie', use: () => { render(); $('movies').hidden = false; game.lock(false); } });
    tick(() => { if (playing) { const d = player.pos.distanceTo(c); video.volume = Math.max(0, 0.85 - d / 34); if (d > 36) stop(); } });
  }
}

const assets = { movies: [
  { id: 'day0', title: 'Day 0' }, { id: 'day1', title: 'Day 1: The Pyramids' }, { id: 'day2', title: 'Day 2: Railroad + Party' },
  { id: 'hof-announce', title: 'Hall of Fame Announcement' }, { id: 'hof-vid', title: 'The Hall of Fame' },
  { id: 'planet', title: 'The Size of Earth' }, { id: 'hollywood', title: 'Hollywood Party' },
] };
