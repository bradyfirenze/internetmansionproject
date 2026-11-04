// The Internet Mansion: boot, rendering, sky, input, HUD.
import * as THREE from 'three';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/postprocessing/ShaderPass.js';
import { BLOCKS, B, buildTextureArray } from './blocks.js';
import { Voxels, WORLD, meshChunk, makeVoxelMaterials } from './voxels.js';
import { buildWorld } from './build.js';
import { Player } from './player.js';
import { buildFeatures } from './features.js';
import { runGame, GAMES } from './arcade.js';
import { Sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window && innerWidth < 900;
const params = new URLSearchParams(location.search);
const G = WORLD.GROUND;
const setLoad = (p, t) => { $('loadBar').style.width = p + '%'; if (t) $('loadText').textContent = t; return new Promise((r) => setTimeout(r, 0)); };

const CHECKLIST = [
  ['enter', 'Walk through the front door', 'Up the driveway, under the bridge.'],
  ['train', 'Ride the private railroad', 'Mansion Station is east of the pool. There is a button to call it.'],
  ['summit', 'Climb Khufu', 'Every course is one step. Do not look down.'],
  ['zip', 'Take the zipline from the top', 'It ends somewhere wet.'],
  ['dive', 'Jump off something tall into the pool', 'The crane has a ladder.'],
  ['slide', 'Ride the water slide', 'Starts on the roof. Take the elevator.'],
  ['bounce', 'Find a bounce pad', 'They are bright green.'],
  ['party', 'Start the party', 'Giant disco ball. Button on the stage.'],
  ['hall', 'Stand in the Hall of Fame', 'First 1,000 followers. Look at a picture to read the name.'],
  ['secret', 'Find the secret room', 'Someone in Room 6 asked for a bookcase.'],
  ['chamber', "Find the King's Chamber", 'There is a side door somewhere in the pyramid tunnel.'],
  ['dj', 'Drop the beat in the dungeon', 'Room 2. It is water, not tequila.'],
  ['arcade', 'Set a high score', 'Room 3 or the Gaming Room.'],
  ['studio', 'Build a full track', 'Music Studio, back right wing.'],
  ['movie', 'Watch the movie', 'Movie Theater, back right wing.'],
  ['drive', 'Drive the yellow car', 'Hot Rod Garage, front right wing.'],
  ['speed', 'Top out the car', 'Hold Shift. Stay off the pyramids.'],
  ['hoops', 'Hit a shot', 'Basketball Court, past the Hall of Fame.'],
  ['stadium', 'Run out of the tunnel', 'Sports Stadium, past the railroad. Start in the locker room.'],
  ['trainhit', 'Get hit by the train', 'Worth it once.'],
  ['race', 'Finish a race', 'Out the garage door and follow the road to the Speedway.'],
  ['racewin', 'Win a race', 'Three rivals, five laps.'],
  ['stage', 'Start the show', 'Festival Stage, past the pool.'],
  ['elevator', 'Ride the glass elevator', 'Middle of the foyer.'],
  ['fly', 'Fly', 'Press F, or the FLY button on a phone.'],
  ['allgold', 'Find every gold brick', 'They are everywhere. Some are mean.'],
];

const game = {
  entities: [], tickers: [], sound: new Sound(), carSpeed: 0, musicSource: null,
  achieved: new Set(JSON.parse(localStorage.getItem('imp_done') || '[]')),
};

async function boot() {
  const canvas = $('c');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH, powerPreference: 'high-performance' }); } catch (e) { $('noGL').hidden = false; $('loadWrap').hidden = true; $('loadText').hidden = true; return; }
  const low = IS_TOUCH || params.has('low');
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene(); game.scene = scene;
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 2200); game.camera = camera;
  camera.rotation.order = 'YXZ'; scene.add(camera);

  // ---------- Lights and sky ----------
  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x8a7a5c, 2.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 3.0); sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  const SR = low ? 70 : 110; Object.assign(sun.shadow.camera, { left: -SR, right: SR, top: SR, bottom: -SR, near: 1, far: 500 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5; scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(0xcfe6fa, 280, 1250);
  const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunC: { value: new THREE.Color() }, night: { value: 0 }, t: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 top, hor, sunDir, sunC; uniform float night, t;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){ vec3 d = normalize(vD); float y = max(d.y, 0.0); vec3 c = mix(hor, top, pow(y, 0.55));
        float s = max(dot(d, sunDir), 0.0); c += sunC * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.28);
        if (night > 0.01) { vec3 g = floor(d * 240.0); float st = step(0.9975, h(g)); c += vec3(st) * night * (0.55 + 0.45 * sin(t * 2.0 + h(g + 3.0) * 40.0)) * smoothstep(0.0, 0.14, d.y); }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` }));
  sky.renderOrder = -10; scene.add(sky);
  // "The Internet Mansion Project" hangs in the sky in the YouTube banner lettering. One faces the house side, one faces
  // the street side, and both ride along with the camera like the sky does, so you can't fly up to them.
  const skyWords = new THREE.Group(); scene.add(skyWords);
  new THREE.TextureLoader().load('assets/sky_words.png', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(1150, 1150 * 522 / 1789), mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
    const DIST = 1500, UP = 52 * Math.PI / 180;
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(geo, mat); m.position.set(0, DIST * Math.sin(UP), side * DIST * Math.cos(UP)); m.lookAt(0, 0, 0); m.frustumCulled = false; skyWords.add(m);
    }
  });
  // Far land so the lot sits in a world
  const land = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x5fae4e })); land.rotation.x = -Math.PI / 2; land.position.y = G - 1.4; scene.add(land);
  // Distant forest and block clouds
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), rnd = (a, b) => a + Math.random() * (b - a);
    const treeN = 800, trees = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x3f8a42 }), treeN);
    for (let i = 0; i < treeN; i++) {
      let x, z; do { x = rnd(-900, 760); z = rnd(-900, 560); } while (x > -400 && x < 255 && z > -395 && z < 122);
      const s = rnd(9, 22), h = rnd(14, 36); m.compose(new THREE.Vector3(x, G + h / 2 - 1, z), q, new THREE.Vector3(s, h, s)); trees.setMatrixAt(i, m);
      trees.setColorAt(i, new THREE.Color().setHSL(rnd(0.27, 0.36), 0.5, rnd(0.25, 0.4)));
    }
    scene.add(trees);
    const cloudN = 170, clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 }), cloudN);
    const centers = []; for (let i = 0; i < 26; i++) centers.push([rnd(-900, 900), rnd(150, 200), rnd(-900, 900)]);
    for (let i = 0; i < cloudN; i++) { const c = centers[i % 26]; m.compose(new THREE.Vector3(c[0] + rnd(-44, 44), c[1] + rnd(-3, 3), c[2] + rnd(-30, 30)), q, new THREE.Vector3(rnd(20, 56), rnd(5, 9), rnd(16, 40))); clouds.setMatrixAt(i, m); }
    clouds.frustumCulled = false; clouds.material.fog = false; scene.add(clouds); game.clouds = clouds;
  }

  // Time of day. Beds and the switch step through these.
  const TIMES = [
    { name: 'day', sun: [0.55, 0.78, 0.32], sunI: 2.5, sunC: 0xfff0d8, hemi: 1.45, sky: 0xcfe4ff, gnd: 0x8a7a5c, top: 0x2d7fe0, hor: 0xbcdcf6, fog: 0xc4e0f6, far: 1250, gain: 0.85, night: 0, exp: 0.92, bloom: 0.1 },
    { name: 'sunset', sun: [0.72, 0.2, -0.3], sunI: 2.8, sunC: 0xffa860, hemi: 1.2, sky: 0xf0b4a8, gnd: 0x6a5048, top: 0x3a3c86, hor: 0xffa66e, fog: 0xf0a078, far: 900, gain: 1.4, night: 0.1, exp: 0.95, bloom: 0.2 },
    { name: 'night', sun: [-0.4, 0.8, 0.45], sunI: 0.42, sunC: 0x9fb8ff, hemi: 0.5, sky: 0x5070b0, gnd: 0x181c2a, top: 0x050818, hor: 0x121a38, fog: 0x0e1430, far: 650, gain: 2.2, night: 1, exp: 1.1, bloom: 0.42 },
  ];
  const clock = { i: 0, from: null, k: 1 };
  const uShared = { uTime: { value: 0 }, uBlockGain: { value: 0.85 } };
  const lerp = (a, b, t) => a + (b - a) * t;
  const CA = new THREE.Color(), CB = new THREE.Color();
  const mix = (target, a, b, t) => target.copy(CA.set(a)).lerp(CB.set(b), t);
  let bloomPass = null;
  const applyTime = (t) => {
    const a = TIMES[clock.from === null ? clock.i : clock.from], b = TIMES[clock.i];
    mix(hemi.color, a.sky, b.sky, t); mix(hemi.groundColor, a.gnd, b.gnd, t); hemi.intensity = lerp(a.hemi, b.hemi, t);
    mix(sun.color, a.sunC, b.sunC, t); sun.intensity = lerp(a.sunI, b.sunI, t);
    const dir = new THREE.Vector3(lerp(a.sun[0], b.sun[0], t), lerp(a.sun[1], b.sun[1], t), lerp(a.sun[2], b.sun[2], t)).normalize();
    game.sunDir = dir; skyU.sunDir.value.copy(dir); mix(skyU.sunC.value, a.sunC, b.sunC, t); mix(skyU.top.value, a.top, b.top, t); mix(skyU.hor.value, a.hor, b.hor, t);
    skyU.night.value = lerp(a.night, b.night, t); mix(scene.fog.color, a.fog, b.fog, t); scene.fog.far = lerp(a.far, b.far, t);
    uShared.uBlockGain.value = lerp(a.gain, b.gain, t); renderer.toneMappingExposure = lerp(a.exp, b.exp, t);
    if (bloomPass) bloomPass.strength = lerp(a.bloom, b.bloom, t);
    land.material.color.set(0x5fae4e).multiplyScalar(lerp(a.night ? 0.2 : 1, b.night ? 0.2 : 1, t));
    game.clouds.material.color.copy(CA.set(0xffffff)).multiplyScalar(lerp(1 - a.night * 0.85, 1 - b.night * 0.85, t));
    game.shadowDirty = true;
  };
  applyTime(1);

  // ---------- Build the world ----------
  await setLoad(5, 'Pouring the foundation...');
  const V = new Voxels(); game.V = V;
  const data = buildWorld(V); game.data = data;
  await setLoad(30, 'Laying 2,000 bricks...');
  const [facesImg, facesData, rooms] = await Promise.all([
    new THREE.TextureLoader().loadAsync('assets/faces.jpg'), fetch('assets/faces.json').then((r) => r.json()), fetch('assets/rooms.json').then((r) => r.json()),
  ]);
  facesImg.colorSpace = THREE.SRGBColorSpace; facesImg.anisotropy = 4;
  game.player = new Player(game);
  const player = game.player;
  game.camera.position.set(0, 60, 80);

  await setLoad(38, 'Wiring the lights...');
  V.bakeLight();
  await setLoad(48, 'Hanging 1,000 pictures...');
  buildFeatures(game, data, { rooms, faces: facesImg, facesData });
  await setLoad(55, 'Building rooms...');

  const tex = buildTextureArray(), mats = makeVoxelMaterials(tex, uShared);
  const chunks = []; const CX = Math.ceil(WORLD.W / WORLD.CHUNK), CZ = Math.ceil(WORLD.D / WORLD.CHUNK);
  const t0 = performance.now(); let tris = 0, done = 0;
  for (let cz = 0; cz < CZ; cz++) {
    for (let cx = 0; cx < CX; cx++) {
      const g = meshChunk(V, cx, cz);
      const add = (geo, mat, opts = {}) => {
        if (!geo) return; const m = new THREE.Mesh(geo, mat); m.receiveShadow = !opts.noShadow; m.castShadow = !!opts.cast; m.renderOrder = opts.order || 0; scene.add(m); tris += geo.index.count / 3; chunks.push(m);
      };
      add(g.opaque, mats.opaque, { cast: true }); add(g.water, mats.water, { order: 1 }); add(g.glass, mats.glass, { order: 2 });
      done++;
    }
    await setLoad(55 + 44 * (cz / CZ));
  }
  game.stats = { chunks: chunks.length, tris: Math.round(tris), meshMs: Math.round(performance.now() - t0) };

  // ---------- Bloom on real computers ----------
  let composer = null;
  if (!low) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    // One bad pixel (NaN or Inf) would otherwise blow up into a giant black box in the bloom blur.
    composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(clamp(c.rgb, 0.0, 40.0), 1.0); }',
    }));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.1, 0.45, 0.92); composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    applyTime(1);
  }

  // ---------- Splashes ----------
  const SPL = 120, splPos = new Float32Array(SPL * 3), splVel = new Float32Array(SPL * 3), splLife = new Float32Array(SPL);
  const splG = new THREE.BufferGeometry(); splG.setAttribute('position', new THREE.BufferAttribute(splPos, 3));
  const splash = new THREE.Points(splG, new THREE.PointsMaterial({ size: 0.25, color: 0xdff4ff, transparent: true, opacity: 0.95 })); splash.frustumCulled = false; scene.add(splash);
  splPos.fill(-999);
  game.splash = (x, y, z, s = 1) => { let n = 0; for (let i = 0; i < SPL && n < 70; i++) { if (splLife[i] <= 0) { splLife[i] = 1; splPos.set([x, y, z], i * 3); const a = Math.random() * 6.283, r = Math.random() * 3 * s; splVel.set([Math.cos(a) * r, (3 + Math.random() * 7) * s, Math.sin(a) * r], i * 3); n++; } } };

  // ---------- HUD helpers ----------
  let noticeT = 0, toastT = 0;
  game.notice = (msg) => { $('notice').textContent = msg; $('notice').hidden = false; noticeT = 4.5; };
  game.raceHud = (o) => { $('race').hidden = !o.show; if (!o.show) return; if (o.big !== undefined) { $('raceBig').textContent = o.big; $('raceBig').hidden = !o.big; } if (o.lap) $('raceLap').textContent = o.lap; if (o.pos) $('racePos').textContent = o.pos; if (o.time) $('raceTime').textContent = o.time; };
  game.setPower = (p) => { $('power').hidden = p <= 0; $('powerFill').style.width = p * 100 + '%'; };
  game.updateGold = () => { $('goldN').textContent = `${game.goldFound} / ${game.goldTotal}`; };
  game.updateGold();
  game.achieve = (id) => {
    if (game.achieved.has(id)) return;
    game.achieved.add(id); localStorage.setItem('imp_done', JSON.stringify([...game.achieved]));
    const c = CHECKLIST.find((x) => x[0] === id); if (!c) return;
    $('toastText').textContent = c[1]; $('toast').hidden = false; $('toast').style.animation = 'none'; void $('toast').offsetWidth; $('toast').style.animation = ''; toastT = 3.6; game.sound.fx('achieve'); renderList();
  };
  const renderList = () => {
    const n = CHECKLIST.filter((c) => game.achieved.has(c[0])).length;
    $('listItems').innerHTML = `<div class="hint">${n} of ${CHECKLIST.length} done</div>` + CHECKLIST.map((c) => `<div class="item ${game.achieved.has(c[0]) ? 'done' : ''}"><i></i><div><b>${c[1]}</b><small>${c[2]}</small></div></div>`).join('');
  };
  renderList();
  game.sleep = () => {
    const f = $('fade'); f.style.opacity = 1;
    setTimeout(() => { clock.from = clock.i; clock.i = (clock.i + 1) % TIMES.length; applyTime(1); clock.from = null; f.style.opacity = 0; game.notice(`Good ${TIMES[clock.i].name === 'day' ? 'morning' : TIMES[clock.i].name === 'sunset' ? 'evening' : 'night'}. The mansion is different at night.`); }, 520);
  };

  // ---------- Minimap and full map ----------
  const mapBase = document.createElement('canvas'); mapBase.width = WORLD.W; mapBase.height = WORLD.D;
  {
    const c = mapBase.getContext('2d'), img = c.createImageData(WORLD.W, WORLD.D), col = new THREE.Color();
    for (let z = 0; z < WORLD.D; z++) for (let x = 0; x < WORLD.W; x++) {
      let y = WORLD.H - 1, id = 0; for (; y > 0; y--) { id = V.b[x + z * WORLD.W + y * WORLD.W * WORLD.D]; if (id && BLOCKS[id].map != null) break; }
      col.setHex(BLOCKS[id].map ?? 0x000000, THREE.LinearSRGBColorSpace); const sh = 0.82 + Math.min(0.3, (y - G) * 0.008);
      const i = (x + z * WORLD.W) * 4; img.data[i] = col.r * 255 * sh; img.data[i + 1] = col.g * 255 * sh; img.data[i + 2] = col.b * 255 * sh; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }
  const miniC = $('mini').getContext('2d');
  const drawMini = () => {
    const R = 66, S = 1.0, px = player.pos.x - WORLD.X0, pz = player.pos.z - WORLD.Z0;
    miniC.imageSmoothingEnabled = false; miniC.save();
    miniC.fillStyle = '#0b0d12'; miniC.fillRect(0, 0, 132, 132);
    miniC.drawImage(mapBase, px - R / S, pz - R / S, 132 / S, 132 / S, 0, 0, 132, 132);
    miniC.translate(66, 66); miniC.rotate(-player.yaw);
    miniC.fillStyle = '#ff5a72'; miniC.strokeStyle = '#fff'; miniC.lineWidth = 1.5; miniC.beginPath(); miniC.moveTo(0, -8); miniC.lineTo(5.5, 6); miniC.lineTo(-5.5, 6); miniC.closePath(); miniC.fill(); miniC.stroke(); miniC.restore();
  };
  $('mapC').width = WORLD.W; $('mapC').height = WORLD.D; $('mapC').getContext('2d').drawImage(mapBase, 0, 0); $('mapWrap').style.aspectRatio = `${WORLD.W}/${WORLD.D}`; $('mapWrap').style.maxWidth = `calc((92vh - 92px)*${(WORLD.W / WORLD.D).toFixed(3)})`;
  const PINS = [
    ['Front Gate', -6, -104, 0], ['Driveway', -6, -48, 0], ['Foyer', -24, 25, 0], ['Rooms Floor', -20, 75, 13], ['Roof', 6, 25, 19], ['Pool', 70, 7, 0], ['Crane', 49, 22, 0], ['Festival Stage', 121, 75, 0], ['Speedway', 152, -40, 0],
    ['Mansion Station', data.spots.stations[0].x, data.spots.stations[0].y, 1], ['Giza Station', data.spots.stations[1].x, data.spots.stations[1].y, 1], ['Party Room', -6, 96, 0], ['Hall of Fame', -52, 25, 0], ['Basketball', -102, 16, 0], ['Stadium Gate', -150, 30, 0], ['The Field', -262, 30, 0], ['Locker Room', -262, 138, 0],
    ['Garage', data.W[1].P(26, 15)[0], data.W[1].P(26, 15)[1], 0], ['Khufu', -28, 129, 0], ['Sphinx', 32, 119, 0], ['Gaming Room', data.W[3].P(8, 10)[0], data.W[3].P(8, 10)[1], 0], ['Lounge', data.W[5].P(9, 14)[0], data.W[5].P(9, 14)[1], 0],
  ];
  const pinWrap = $('mapPins');
  const toggleSheet = (id, on) => {
    const el = $(id); const show = on === undefined ? el.hidden : on; el.hidden = !show;
    if (show) { releaseLock(); if (id === 'map') updateMePin(); } else tryLock();
  };
  const toPct = (x, y) => [(x - WORLD.X0) / WORLD.W * 100, (-y - WORLD.Z0) / WORLD.D * 100];
  PINS.forEach(([name, x, y, h]) => {
    const b = document.createElement('button'); b.className = 'pin'; b.textContent = name;
    const [l, t] = toPct(x, y); b.style.left = l + '%'; b.style.top = t + '%';
    b.addEventListener('click', () => { if (player.locked) exitLocked(); player.teleport(x, G + h + 0.5, -y); toggleSheet('map', false); });
    pinWrap.appendChild(b);
  });
  const mePin = document.createElement('div'); mePin.className = 'pin me'; mePin.textContent = 'YOU'; pinWrap.appendChild(mePin);
  const updateMePin = () => { const [l, t] = toPct(player.pos.x, -player.pos.z); mePin.style.left = l + '%'; mePin.style.top = t + '%'; };

  // ---------- Input ----------
  const keys = {}; const look = { dx: 0, dy: 0 };
  const stick = { x: 0, y: 0, id: null };
  let started = false, usePressed = false, useHeld = null, lastSpace = 0, lastW = 0, sprintLatch = false;
  const toggleFly = () => { if (player.locked) return; player.flying = !player.flying; player.vel.set(0, 0, 0); $('tFly').classList.toggle('on', player.flying); game.notice(player.flying ? 'Flying. Look where you want to go. Space up, C down. F to land.' : 'Landing.'); if (player.flying) game.achieve('fly'); };
  game.lock = (on) => { if (on) tryLock(); else releaseLock(); };
  const anySheetOpen = () => !$('list').hidden || !$('map').hidden || !$('arcade').hidden || !$('paused').hidden || !$('movies').hidden || !$('elevator').hidden;
  const tryLock = () => { if (!started || IS_TOUCH || anySheetOpen() || params.has('nolock')) return; const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); };
  const releaseLock = () => { if (document.pointerLockElement) document.exitPointerLock(); };
  game.isLocked = () => document.pointerLockElement === canvas;
  document.addEventListener('pointerlockchange', () => {
    if (!started || IS_TOUCH) return;
    // Esc drops the lock: show pause, unless a panel opened on purpose
    if (!document.pointerLockElement && !anySheetOpen() && !game.dragLook) $('paused').hidden = false;
  });
  document.addEventListener('pointerlockerror', () => { game.dragLook = true; });
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) { look.dx += e.movementX; look.dy += e.movementY; } });
  // No pointer lock available (some embedded browsers): click and drag to look
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!started || e.pointerType === 'touch') return;
    if (!document.pointerLockElement) { tryLock(); drag = [e.clientX, e.clientY]; }
  });
  addEventListener('pointermove', (e) => { if (drag && !document.pointerLockElement) { look.dx += e.clientX - drag[0]; look.dy += e.clientY - drag[1]; drag = [e.clientX, e.clientY]; } });
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('keydown', (e) => {
    if (!$('title').hidden) return; // Typing in the signup form shouldn't move the player.
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    if (!started || !$('arcade').hidden) return;
    if (e.code === 'Escape') { $('movies').hidden = true; $('elevator').hidden = true; }
    if (anySheetOpen() && e.code !== 'KeyM' && e.code !== 'Tab') return;
    if (e.code === 'KeyE') pressUse();
    if (e.code === 'KeyF') toggleFly();
    if (e.code === 'Space') { const n = performance.now(); if (n - lastSpace < 280) toggleFly(); lastSpace = n; }
    if (e.code === 'KeyW') { const n = performance.now(); if (n - lastW < 280) sprintLatch = true; lastW = n; }
    if (e.code === 'KeyV') toggleCam();
    if (e.code === 'KeyM') toggleSheet('map');
    if (e.code === 'KeyN') toggleDayNight();
    if (e.code === 'Tab') toggleSheet('list');
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyE') releaseUse(); if (e.code === 'KeyW') sprintLatch = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; releaseUse(); });
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => toggleSheet(b.dataset.close, false)));
  $('btnList').onclick = () => toggleSheet('list'); $('btnMap').onclick = () => toggleSheet('map');
  const toggleCam = () => { player.third = !player.third; avatar.visible = player.third;  };
  $('btnCam').onclick = toggleCam;
  $('btnMute').onclick = () => { game.sound.setMuted(!game.sound.muted); $('btnMute').classList.toggle('off', game.sound.muted); };
  $('resume').onclick = () => { $('paused').hidden = true; tryLock(); };
  // Pause menu: Esc frees the mouse, and these do what the corner buttons do
  const leavePause = () => { $('paused').hidden = true; };
  $('pMap').onclick = () => { leavePause(); toggleSheet('map', true); };
  $('pList').onclick = () => { leavePause(); toggleSheet('list', true); };
  $('pCam').onclick = () => { toggleCam(); leavePause(); tryLock(); };
  const syncMute = () => { $('btnMute').classList.toggle('off', game.sound.muted); $('pMute').textContent = game.sound.muted ? 'Sound on' : 'Sound off'; };
  $('btnMute').onclick = $('pMute').onclick = () => { game.sound.setMuted(!game.sound.muted); syncMute(); };
  // Day or night, your choice, any time
  const setDayNight = (name) => {
    clock.from = null; clock.i = TIMES.findIndex((T) => T.name === name); applyTime(1);
    const next = name === 'night' ? 'Day' : 'Night'; $('btnTime').textContent = next; $('pTime').textContent = `Make it ${next.toLowerCase()}`;
  };
  const toggleDayNight = () => setDayNight(TIMES[clock.i].name === 'night' ? 'day' : 'night');
  game.toggleDayNight = toggleDayNight;
  setInterval(() => { const next = TIMES[clock.i].name === 'night' ? 'Day' : 'Night'; if ($('btnTime').textContent !== next) { $('btnTime').textContent = next; $('pTime').textContent = `Make it ${next.toLowerCase()}`; } }, 1000); // Sleeping in a bed changes the time too
  $('btnTime').onclick = $('pTime').onclick = toggleDayNight;

  // Phone controls
  const stickEl = $('stick'), nub = $('nub');
  const moveStick = (e) => { const r = stickEl.getBoundingClientRect(), R = r.width / 2; let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R; const L = Math.hypot(x, y); if (L > 1) { x /= L; y /= L; } stick.x = x; stick.y = y; nub.style.transform = `translate(${x * 36}px,${y * 36}px)`; };
  stickEl.addEventListener('pointerdown', (e) => { stick.id = e.pointerId; stickEl.setPointerCapture(e.pointerId); moveStick(e); });
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) moveStick(e); });
  const endStick = () => { stick.id = null; stick.x = stick.y = 0; nub.style.transform = ''; };
  stickEl.addEventListener('pointerup', endStick); stickEl.addEventListener('pointercancel', endStick);
  const touchLook = new Map();
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { touchLook.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', (e) => { const p = touchLook.get(e.pointerId); if (p) { look.dx += (e.clientX - p[0]) * 2.1; look.dy += (e.clientY - p[1]) * 2.1; touchLook.set(e.pointerId, [e.clientX, e.clientY]); } });
  const endL = (e) => touchLook.delete(e.pointerId); canvas.addEventListener('pointerup', endL); canvas.addEventListener('pointercancel', endL);
  let tJump = false;
  const jb = $('tJump'); jb.addEventListener('pointerdown', (e) => { e.preventDefault(); tJump = true; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => jb.addEventListener(n, () => { tJump = false; }));
  $('tFly').addEventListener('pointerdown', (e) => { e.preventDefault(); toggleFly(); });
  const ub = $('tUse'); ub.addEventListener('pointerdown', (e) => { e.preventDefault(); pressUse(); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => ub.addEventListener(n, () => releaseUse()));

  // ---------- Interaction ----------
  let focus = null;
  const pickEntity = () => {
    if (player.locked) return null;
    const eye = camera.position, dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    let best = null, bestS = -1e9; const to = new THREE.Vector3();
    for (const e of game.entities) {
      const p = e.pos; const d = player.pos.distanceTo(p); const reach = e.r;
      if (d > reach + 1.2) continue;
      if (e.active && !e.active()) continue;
      to.copy(p).sub(eye); const L = to.length() || 1; const dot = to.dot(dir) / L;
      if (!e.any && d > 1.8 && dot < 0.45) continue;
      const label = e.prompt(); if (!label) continue;
      const score = dot * 2 - d * 0.25 + (e.priority || 0);
      if (score > bestS) { bestS = score; best = e; }
    }
    return best;
  };
  const exitLocked = () => { const L = player.locked; if (L && L.exit) { player.locked = null; L.exit(); game.camera.rotation.z = 0; } };
  const pressUse = () => {
    if (usePressed) return; usePressed = true; if (!started) return;
    game.sound.init();
    if (player.locked) { if (player.locked.use && player.locked.use()) return; if (!player.locked.noExit) exitLocked(); return; }
    if (focus) { if (focus.press) { focus.press(); useHeld = focus; } else focus.use(); }
  };
  const releaseUse = () => { usePressed = false; if (useHeld) { useHeld.release(); useHeld = null; } };

  // ---------- Arcade ----------
  let stopArcade = null;
  game.openArcade = (name) => {
    $('arcade').hidden = false; releaseLock(); $('arcadeTitle').textContent = GAMES[name].title; $('arcadeHelp').textContent = GAMES[name].help;
    stopArcade = runGame(name, $('arcadeC'), game.sound, () => game.achieve('arcade'), game.name || 'Guest');
  };
  const closeArcade = () => { if (stopArcade) stopArcade(); stopArcade = null; $('arcade').hidden = true; tryLock(); };
  $('arcadeClose').onclick = closeArcade;
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !$('arcade').hidden) closeArcade(); });

  // ---------- Your avatar (shows in third person; other players use this later) ----------
  const avatar = new THREE.Group(); avatar.visible = false; scene.add(avatar);
  const nameTag = (txt) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d'); x.fillStyle = 'rgba(11,13,18,.85)'; x.fillRect(0, 0, 256, 48); x.fillStyle = '#f5c518'; x.font = '26px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, 26);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.scale.set(2.4, 0.45, 1); s.position.y = 2.25; return s;
  };
  {
    const skin = new THREE.MeshLambertMaterial({ color: 0xe0b48c }), shirt = new THREE.MeshLambertMaterial({ color: 0x1f6bff }), pants = new THREE.MeshLambertMaterial({ color: 0x1d2a4e }), hat = new THREE.MeshLambertMaterial({ color: 0xf5c518 });
    const part = (w, h, d, m, x, y, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; avatar.add(o); return o; };
    part(0.5, 0.5, 0.5, skin, 0, 1.55); part(0.54, 0.16, 0.54, hat, 0, 1.78); part(0.3, 0.06, 0.2, hat, 0, 1.72, -0.34);
    part(0.55, 0.65, 0.3, shirt, 0, 1.0);
    avatar.userData.limbs = [part(0.2, 0.65, 0.22, shirt, -0.38, 1.0), part(0.2, 0.65, 0.22, shirt, 0.38, 1.0), part(0.24, 0.7, 0.26, pants, -0.14, 0.35), part(0.24, 0.7, 0.26, pants, 0.14, 0.35)];
  }

  // ---------- Title flow ----------
  $('loadWrap').hidden = true; $('loadText').hidden = true; $('enterWrap').hidden = false;
  if (IS_TOUCH) { $('keysDesk').hidden = true; $('keysTouch').hidden = false; }
  $('name').value = localStorage.getItem('imp_name') || '';
  player.teleport(-6, G + 0.01, 104, 0);
  player.pitch = 0.4; // Start looking up a little so the first view has the sign and the sky words in it.
  $('enter').onclick = () => {
    const name = ($('name').value.trim().replace(/[^\w. -]/g, '') || 'Guest').slice(0, 30); localStorage.setItem('imp_name', name); game.name = name;
    avatar.add(nameTag(name));
    game.sound.init();
    $('title').hidden = true; $('hud').hidden = false; document.body.classList.add('playing');
    if (IS_TOUCH) { $('touch').hidden = false; document.documentElement.requestFullscreen?.().catch(() => {}); }
    started = true; tryLock();
    game.notice(IS_TOUCH ? 'Welcome to the lot. Everything you see was picked in the comments. Tap List for things to try.' : 'Welcome to the lot. Press Esc any time to free your mouse for the map, view and day or night buttons.');
  };

  // ---------- Debug hook for testing ----------
  if (params.has('debug')) window.__imp = { game, player, V, B, data, keys, TIMES, clock, applyTime, pressUse, releaseUse, exitLocked, start: () => $('enter').click(), renderer, toggleFly, sim: (sec) => { for (let i = 0; i < sec * 30; i++) { time += 1 / 30; step(1 / 30); } } };

  // ---------- Main loop ----------
  const clockT = new THREE.Clock(); let cullT = 0, roomPrev = '', time = 0, shadowT = 0, lastPos = new THREE.Vector3(1e9, 0, 0), roomId = '', miniT = 0, frames = 0, fpsT = 0;
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (composer) composer.setSize(innerWidth, innerHeight); });

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clockT.getDelta()); time += dt; uShared.uTime.value = time; skyU.t.value = time;
    frames++; fpsT += dt; if (fpsT > 1) { game.fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
    step(dt);
    // Sky follows the camera, sun shadow follows the player
    sky.position.copy(camera.position); skyWords.position.copy(camera.position);
    const focusP = started ? player.pos : new THREE.Vector3(-6, G, -20);
    shadowT -= dt;
    if (shadowT <= 0 || game.shadowDirty) {
      shadowT = low ? 0.35 : 0.14; game.shadowDirty = false;
      const snap = 4, sx = Math.round(focusP.x / snap) * snap, sz = Math.round(focusP.z / snap) * snap;
      sun.target.position.set(sx, G, sz); sun.position.set(sx, G, sz).addScaledVector(game.sunDir, 240); sun.target.updateMatrixWorld();
      sun.shadow.needsUpdate = true;
    }
    // Phones skip far-away chunks so the bigger world still runs
    if (low) { cullT -= dt; if (cullT <= 0) { cullT = 0.5; for (const m of chunks) { const c = m.geometry.boundingSphere || (m.geometry.computeBoundingSphere(), m.geometry.boundingSphere); m.visible = c.center.distanceToSquared(camera.position) < 420 * 420; } } }
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function step(dt) {
    const paused = anySheetOpen();

    if (!started) {
      // Title screen: slow flyover of the property
      const a = time * 0.06 + 0.4;
      camera.position.set(-6 + Math.sin(a) * 150, G + 62, 15 - 40 + Math.cos(a) * 150);
      camera.lookAt(-6, G + 10, -35);
      for (const fn of game.tickers) fn(dt, time);
    } else {
      // Look
      const sens = 0.0022;
      player.yaw -= look.dx * sens; player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - look.dy * sens)); look.dx = look.dy = 0;
      // Move
      const input = {
        fwd: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - stick.y,
        side: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.x,
        jump: !!keys.Space || tJump, down: !!keys.KeyC, sprint: !!(keys.ShiftLeft || keys.ShiftRight) || sprintLatch || Math.hypot(stick.x, stick.y) > 0.92,
      };
      if (paused) { input.fwd = input.side = 0; input.jump = false; }
      if (!paused) {
        if (player.locked) player.locked.update && player.locked.update(dt, input); else player.update(dt, input);
        for (const fn of game.tickers) fn(dt, time);
        // Splash particles
        for (let i = 0; i < SPL; i++) if (splLife[i] > 0) { splLife[i] -= dt * 1.2; splVel[i * 3 + 1] -= 16 * dt; splPos[i * 3] += splVel[i * 3] * dt; splPos[i * 3 + 1] += splVel[i * 3 + 1] * dt; splPos[i * 3 + 2] += splVel[i * 3 + 2] * dt; if (splLife[i] <= 0) splPos[i * 3 + 1] = -999; }
        splG.attributes.position.needsUpdate = true;
      }
      player.applyCamera(camera);
      if (!player.locked) camera.rotation.z = 0;
      // FOV punches up when running or on a ride
      const fovT = player.locked && player.locked.label !== 'train' ? 86 : (input.sprint && Math.hypot(player.vel.x, player.vel.z) > 8 ? 82 : 75);
      if (Math.abs(camera.fov - fovT) > 0.1) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); }

      // Avatar
      if (avatar.visible) {
        avatar.position.copy(player.pos); avatar.rotation.y = player.yaw;
        const sp = Math.hypot(player.vel.x, player.vel.z), sw = Math.sin(time * 11) * Math.min(0.9, sp * 0.12), L = avatar.userData.limbs;
        L[0].rotation.x = sw; L[1].rotation.x = -sw; L[2].rotation.x = -sw; L[3].rotation.x = sw;
      }

      // Interaction prompt
      focus = pickEntity();
      let label = null;
      if (player.locked) label = player.locked.noExit ? null : player.locked.exitLabel;
      else if (focus) label = focus.prompt();
      const pEl = $('prompt');
      if (label) { pEl.hidden = false; $('promptText').textContent = label; if (IS_TOUCH) { $('promptKey').hidden = true; ub.hidden = false; } }
      else { pEl.hidden = true; ub.hidden = true; }

      // Room name, the hook for room chats later
      const room = game.roomAt();
      if (room && room.id !== roomId) {
        roomId = room.id; $('room').textContent = room.name; $('owner').textContent = room.owner ? '@' + room.owner : '';
        if (room.id === 'hall') game.achieve('hall');
        if (room.id === 'chamber') game.achieve('chamber');
        if (room.id === 'field' && roomPrev === 'team-tunnel') game.achieve('stadium');
        roomPrev = room.id;
      }
      game.room = room;
      const P = data.spots.pyramids.khufu;
      if (Math.hypot(player.pos.x - P.x, -player.pos.z - P.y) < 4 && player.pos.y > G + 44) game.achieve('summit');
      const lbl = game.hallLabel && game.hallLabel(); const fe = $('face');
      if (lbl) { fe.hidden = false; fe.textContent = lbl; } else fe.hidden = true;

      // Music fades with distance from its source
      if (game.musicSource) { const d = camera.position.distanceTo(game.musicSource.pos); game.sound.setMusicVolume(Math.max(0, 1 - d / game.musicSource.range)); }

      // Underwater tint
      $('water').style.opacity = BLOCKS[V.getW(camera.position.x, camera.position.y, camera.position.z)].kind === 'water' ? 1 : 0;

      // Car HUD
      const showSpeed = player.locked && player.locked.hud === 'car'; $('speed').hidden = !showSpeed; if (showSpeed) $('speedN').textContent = Math.round(game.carSpeed * 2.6);

      // Timers
      if (noticeT > 0) { noticeT -= dt; if (noticeT <= 0) $('notice').hidden = true; }
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').hidden = true; }
      miniT -= dt; if (miniT <= 0) { miniT = 0.08; drawMini(); }
    }
  }
  sun.shadow.autoUpdate = false;
  frame();
  if (params.has('auto')) $('enter').click();
}

boot().catch((e) => { console.error(e); $('loadText').textContent = 'Something broke: ' + e.message; });
