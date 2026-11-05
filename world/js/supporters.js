// The Supporter Wall and the Forever Wall: two panels either side of the front door, inside the foyer. Separate from the free Hall of Fame.
// Supporter Wall = small handles. Forever Wall = big names, like a business that wants to stay up for good.
// DRAFT: only local copies build them, using made-up test names. Set LIVE to true only after Brady approves publishing.
// Real names go in assets/supporters.json as { "names": ["handle", ...], "big": ["Business Name", ...] }, each one reviewed by Brady first.
import * as THREE from 'three';

const LIVE = false;
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const FONT = 'Anton, Impact, "Arial Narrow", sans-serif';
const CW = 2048, CH = 1100, HEAD = 270, PAD = 70;

function draw(x, panel, names, isTest) {
  x.fillStyle = '#0b0d12'; x.fillRect(0, 0, CW, CH);
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.fillStyle = '#f5c518'; x.font = `150px ${FONT}`; x.fillText(panel.title, CW / 2, 160);
  x.fillStyle = '#fff'; x.font = `56px ${FONT}`; x.fillText(panel.line, CW / 2, 238);
  x.fillStyle = '#f5c518'; x.fillRect(PAD, HEAD, CW - PAD * 2, 5);
  if (isTest) { x.fillStyle = '#ff6a4d'; x.font = `38px ${FONT}`; x.fillText('TEST NAMES, NOT REAL', CW / 2, CH - 24); }
  const top = HEAD + 30, h = CH - top - (isTest ? 70 : 30), w = CW - PAD * 2;
  if (!names.length) { x.fillStyle = '#a4aec4'; x.font = `110px ${FONT}`; x.fillText('YOUR NAME COULD BE FIRST', CW / 2, top + h / 2 + 40); return; }
  // Picks the column count that gives the largest text, so a short list reads big and a long one still fits
  const shown = names.map(panel.format), longest = Math.max(...shown.map((n) => n.length));
  let best = { size: 0, cols: 1 };
  for (let cols = 1; cols <= panel.maxCols; cols++) {
    const rows = Math.ceil(shown.length / cols), size = Math.min(panel.maxSize, (h / rows) * 0.72, (w / cols) / (longest * 0.5));
    if (size > best.size) best = { size, cols };
  }
  const rows = Math.ceil(shown.length / best.cols), cellW = w / best.cols, cellH = h / rows;
  x.font = `${Math.floor(best.size)}px ${FONT}`; x.fillStyle = panel.color; x.textBaseline = 'middle';
  shown.forEach((n, i) => { x.fillText(n, PAD + cellW * (i % best.cols + 0.5), top + cellH * (Math.floor(i / best.cols) + 0.5)); });
}

export function buildSupporters(game, data) {
  if (!LIVE && !LOCAL) return;
  const { scene } = game, { G } = data;
  const pos = (px, py, h) => new THREE.Vector3(px, G + h, -py);
  const makePanel = (cx, panel) => {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 8.5), new THREE.MeshBasicMaterial({ color: 0xc9a227 }));
    trim.position.copy(pos(cx, 12.06, 4.9)); trim.rotation.y = Math.PI; scene.add(trim);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(15, 8.06), new THREE.MeshBasicMaterial({ map: tex }));
    wall.position.copy(pos(cx, 12.1, 4.9)); wall.rotation.y = Math.PI; scene.add(wall);
    return { names: [], paint(isTest) { draw(c.getContext('2d'), panel, this.names, isTest); tex.needsUpdate = true; } };
  };
  // The door is between these. Facing the door from inside, the Forever Wall is on your left and the Supporter Wall on your right.
  const small = makePanel(-21, { title: 'THE SUPPORTER WALL', line: 'THEY HELP BUILD THE BIGGEST HOUSE ON THE INTERNET', format: (n) => '@' + n, maxCols: 10, maxSize: 100, color: '#f4f6fb' });
  const big = makePanel(8, { title: 'THE FOREVER WALL', line: 'THESE NAMES STAY UP FOR GOOD', format: (n) => n.toUpperCase(), maxCols: 3, maxSize: 210, color: '#f5c518' });

  let isTest = false;
  const paint = () => { small.paint(isTest); big.paint(isTest); };
  paint();
  document.fonts?.ready.then(paint);
  const load = (file) => fetch(file, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const list = (a) => (Array.isArray(a) ? a : []).filter((n) => typeof n === 'string' && n);
  (LOCAL ? load('assets/supporters_test.json').then((d) => { isTest = true; return d; }) : load('assets/supporters.json'))
    .then((d) => { small.names = list(d.names); big.names = list(d.big); paint(); })
    .catch(() => {});
}
