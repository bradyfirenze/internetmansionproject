// Keeps signs readable. Runs once after everything is built: any flat sign that a block cuts through or covers
// gets slid out into open air, and any sign facing a wall gets turned around. New signs are covered automatically.
import * as THREE from 'three';

const MAX_SLIDE = 4, STEP = 0.1, CLEAR_AHEAD = 1.0, GAP = 0.06, LOOK = 3;

export function seatSigns(scene, V) {
  const solid = (p) => V.solidW(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
  const signs = [];
  scene.children.forEach((o) => {
    if (o.isMesh && o.geometry.type === 'PlaneGeometry' && o.material.map?.isCanvasTexture && !o.material.transparent && !o.userData.fixed) signs.push(o); // TVs and room art are placed by hand
  });

  const report = [], P = new THREE.Vector3(), N = new THREE.Vector3(), Q = new THREE.Vector3();
  for (const m of signs) {
    m.updateMatrixWorld(true);
    const { width: w, height: h } = m.geometry.parameters;
    const cols = Math.max(4, Math.ceil(w * 2)), rows = Math.max(2, Math.ceil(h * 2)), pts = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      pts.push(new THREE.Vector3(((i + 0.5) / cols - 0.5) * w, ((j + 0.5) / rows - 0.5) * h, 0).applyMatrix4(m.matrixWorld));
    }
    m.getWorldDirection(N);

    // Share of the sign with open air in a direction
    const openShare = (dir) => {
      let open = 0;
      for (const p of pts) { let blocked = false; for (let d = 0.2; d <= LOOK; d += 0.4) { Q.copy(p).addScaledVector(dir, d); if (solid(Q)) { blocked = true; break; } } if (!blocked) open++; }
      return open / pts.length;
    };
    // How far along a direction before every point is clear, with a little room ahead of it
    const slideFor = (dir) => {
      for (let d = 0; d <= MAX_SLIDE; d += STEP) {
        let ok = true;
        for (const p of pts) {
          for (let a = 0; a <= CLEAR_AHEAD; a += 0.25) { Q.copy(p).addScaledVector(dir, d + a); if (solid(Q)) { ok = false; break; } }
          if (!ok) break;
        }
        if (ok) return d;
      }
      return -1;
    };

    const front = openShare(N), back = openShare(Q.copy(N).negate().clone());
    let flipped = false;
    if (front < 0.5 && back > front) { m.rotation.y += Math.PI; N.negate(); flipped = true; }
    const slide = slideFor(N);
    if (slide > 0) m.position.addScaledVector(N, slide + GAP);
    if (slide !== 0 || flipped) report.push({ x: +m.position.x.toFixed(1), y: +m.position.y.toFixed(1), z: +m.position.z.toFixed(1), w, h, slide: +slide.toFixed(1), flipped });
    m.updateMatrixWorld(true);
  }
  return { checked: signs.length, moved: report };
}
