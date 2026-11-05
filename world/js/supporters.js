// The Supporter Wall and the Forever Wall: two panels either side of the front door, inside the foyer. Separate from the free Hall of Fame.
// Supporter Wall = small handles. Forever Wall = big names, like a business that wants to stay up for good.
// To add a name once it sells: put it in assets/supporters.json, then publish. "names" is the Supporter Wall, "big" is the Forever Wall. Each one is reviewed by Brady first.
// With no names, a wall shows YOUR NAME HERE. The walls fill and resize themselves.
import * as THREE from 'three';

const FONT = 'Anton, Impact, "Arial Narrow", sans-serif';
const CW = 2048, CH = 1100, HEAD = 270, PAD = 70, FOOT = 120;

function draw(x, panel, names) {
  x.fillStyle = '#0b0d12'; x.fillRect(0, 0, CW, CH);
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.fillStyle = '#f5c518'; x.font = `150px ${FONT}`; x.fillText(panel.title, CW / 2, 160);
  x.fillStyle = '#fff'; x.font = `56px ${FONT}`; x.fillText(panel.line, CW / 2, 238);
  x.fillStyle = '#f5c518'; x.fillRect(PAD, HEAD, CW - PAD * 2, 5);
  x.fillStyle = '#f5c518'; x.font = '700 76px Inter, sans-serif'; x.fillText(`${names.length ? 'WANT YOUR NAME UP?' : 'WANT IT?'} DM @internetmansionproject. 18+.`, CW / 2, CH - 42, CW - PAD * 2);
  const top = HEAD + 30, h = CH - top - FOOT, w = CW - PAD * 2;
  if (!names.length) { x.fillStyle = '#fff'; x.font = `230px ${FONT}`; x.fillText('YOUR NAME HERE', CW / 2, top + h / 2 + 80, w); return; }
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
  const { scene } = game, { G } = data;
  const pos = (px, py, h) => new THREE.Vector3(px, G + h, -py);
  const makePanel = (cx, panel) => {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 8.5), new THREE.MeshBasicMaterial({ color: 0xc9a227 }));
    trim.position.copy(pos(cx, 12.06, 4.9)); trim.rotation.y = Math.PI; scene.add(trim);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(15, 8.06), new THREE.MeshBasicMaterial({ map: tex }));
    wall.position.copy(pos(cx, 12.1, 4.9)); wall.rotation.y = Math.PI; scene.add(wall);
    return { names: [], paint() { draw(c.getContext('2d'), panel, this.names); tex.needsUpdate = true; } };
  };
  // The door is between these. Facing the door from inside, the Forever Wall is on your left and the Supporter Wall on your right.
  const small = makePanel(-21, { title: 'THE SUPPORTER WALL', line: 'THEY HELP BUILD THE BIGGEST HOUSE ON THE INTERNET', format: (n) => '@' + n.replace(/^@/, ''), maxCols: 10, maxSize: 100, color: '#f4f6fb' });
  const big = makePanel(8, { title: 'THE FOREVER WALL', line: 'THESE NAMES STAY UP FOR GOOD', format: (n) => n.toUpperCase(), maxCols: 3, maxSize: 210, color: '#f5c518' });

  const paint = () => { small.paint(); big.paint(); };
  paint();
  document.fonts?.ready.then(paint);
  const list = (a) => (Array.isArray(a) ? a : []).filter((n) => typeof n === 'string' && n);
  fetch('assets/supporters.json', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => { small.names = list(d.names); big.names = list(d.big); paint(); })
    .catch(() => {}); // No list means the walls just stay open
  game.supporterWalls = { small, big, paint };
}
