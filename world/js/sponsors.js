// "Presented by" banners on the front sign, the racetrack and the main stage. One switch: "on" in assets/sponsors.json. Off, or no file, adds nothing to the world.
// All the banners share one picture.
import * as THREE from 'three';

const W = 1408, H = 128; // Every banner keeps this shape, 11 wide to 1 tall

export function buildSponsors(game, data, helpers) {
  const { scene } = game, { spots } = data, { P3, textCanvas, DISPLAY } = helpers;
  const show = (name) => {
    const tex = textCanvas(W, H, (c) => {
      c.fillStyle = '#0b0d12'; c.fillRect(0, 0, W, H); c.strokeStyle = '#f5c518'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
      c.textBaseline = 'middle'; c.font = `88px ${DISPLAY}`; c.textAlign = 'left';
      const a = 'PRESENTED BY ', b = name.toUpperCase(), aw = c.measureText(a).width, bw = c.measureText(b).width, scale = Math.min(1, (W - 60) / (aw + bw));
      c.save(); c.translate(W / 2, H / 2 + 4); c.scale(scale, scale); c.translate(-(aw + bw) / 2, 0);
      c.fillStyle = '#fff'; c.fillText(a, 0, 0); c.fillStyle = '#f5c518'; c.fillText(b, aw, 0); c.restore();
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const banner = (width, x, y, h, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * H / W), mat); m.position.copy(P3(x, y, h)); m.rotation.y = rot; m.userData.fixed = true; scene.add(m); };
    const S = spots.sign, stage = spots.stage, track = spots.track.board;
    banner(46, S.x, S.y - 0.05, 8.3, 0); // Hangs under the giant front sign, seen coming up the driveway
    banner(46, S.x, S.back + 0.05, 8.3, Math.PI); // Same on the side you see leaving
    banner(38, track.x, track.y - 0.05, 16.6, 0); // On top of the wall behind the grandstand, facing the track
    banner(40, stage.x, 91.9, 29, 0); // Across the stage roof, facing the crowd
  };
  game.sponsors = { on: false };
  Promise.all([fetch('assets/sponsors.json', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }), document.fonts?.ready])
    .then(([d]) => { if (d.on === true && typeof d.name === 'string' && d.name) { game.sponsors.on = true; show(d.name); } })
    .catch(() => {}); // No file means no banners
}
