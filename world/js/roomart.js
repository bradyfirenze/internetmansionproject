// Things in the owners' rooms that blocks can't draw: monitors, the mounted bass, Room 8's portrait, Room 6's painted windows, Room 7's poles.
import * as THREE from 'three';

const TURN = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };

const stocks = (c, w, h) => {
  c.fillStyle = '#071018'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#17324a'; c.lineWidth = 1; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(0, h * i / 6); c.lineTo(w, h * i / 6); c.stroke(); }
  c.strokeStyle = '#48f08c'; c.lineWidth = 4; c.beginPath();
  let y = h * 0.78; for (let x = 0; x <= w; x += 12) { y += Math.sin(x * 0.11) * 12 - 3.2; if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
  c.fillStyle = '#48f08c'; c.font = 'bold 26px sans-serif'; c.textAlign = 'left'; c.fillText('MANSION INDEX  +4.20%', 12, 34);
};
const battlestation = (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#12236b'); g.addColorStop(1, '#7a1fa8'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#0b0d12'; c.fillRect(0, h * 0.72, w, h * 0.28);
  c.strokeStyle = '#38b6ff'; c.lineWidth = 6; for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(w / 2, h * 0.72); c.lineTo(w / 2 + i * w * 0.14, h); c.stroke(); }
  c.fillStyle = '#fff'; c.font = 'bold 46px sans-serif'; c.textAlign = 'center'; c.fillText('PRESS START', w / 2, h * 0.42);
};
const bass = (c, w, h) => {
  c.fillStyle = '#4a2c16'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c9a227'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = '#4f7a3a'; c.beginPath(); c.ellipse(w * 0.46, h * 0.42, w * 0.3, h * 0.24, 0, 0, 7); c.fill();
  c.beginPath(); c.moveTo(w * 0.73, h * 0.42); c.lineTo(w * 0.92, h * 0.2); c.lineTo(w * 0.92, h * 0.64); c.fill();
  c.fillStyle = '#d8e6b8'; c.beginPath(); c.ellipse(w * 0.44, h * 0.53, w * 0.22, h * 0.09, 0, 0, 7); c.fill();
  c.fillStyle = '#16210f'; c.beginPath(); c.arc(w * 0.24, h * 0.36, h * 0.035, 0, 7); c.fill();
  c.fillStyle = '#f5c518'; c.font = `bold ${Math.round(h * 0.15)}px sans-serif`; c.textAlign = 'center'; c.fillText('10 LB BASS', w / 2, h * 0.9);
};
const chains = (c, w, h) => {
  c.fillStyle = '#17090b'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8b929c'; c.lineWidth = 9;
  for (let i = 0; i < 10; i++) { c.beginPath(); c.ellipse(16 + i * (w - 32) / 9, h * 0.3 + (i % 2) * 14, 19, 11, i % 2 ? 0.6 : -0.6, 0, 7); c.stroke(); }
  c.fillStyle = '#c9a227'; c.fillRect(w / 2 - 34, h * 0.47, 68, 54); c.strokeStyle = '#c9a227'; c.beginPath(); c.arc(w / 2, h * 0.47, 22, Math.PI, 0); c.stroke();
  c.fillStyle = '#17090b'; c.beginPath(); c.arc(w / 2, h * 0.47 + 24, 8, 0, 7); c.fill();
  c.fillStyle = '#ff5a72'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('LOCKED, FOR NOW', w / 2, h - 12);
};
const london = (c, w, h) => { // A painted window onto a foggy street, for a room in the middle of the house
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1c2438'); g.addColorStop(1, '#a58a5c'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#10131c'; for (let i = 0; i < 5; i++) { const bw = w / 5, bh = h * (0.34 + (i * 7 % 4) * 0.08); c.fillRect(i * bw, h - bh, bw - 3, bh); c.fillStyle = '#f0c869'; c.fillRect(i * bw + bw * 0.3, h - bh * 0.7, bw * 0.2, bh * 0.14); c.fillStyle = '#10131c'; }
  c.fillStyle = '#2a1636'; const f = Math.max(10, w * 0.06); c.fillRect(0, 0, w, f); c.fillRect(0, h - f, w, f); c.fillRect(0, 0, f, h); c.fillRect(w - f, 0, f, h); c.fillRect(w / 2 - f / 2, 0, f, h); c.fillRect(0, h / 2 - f / 2, w, f);
};

export function buildRoomArt(game, data, H) {
  const { scene } = game, { spots, G } = data, { P3, textCanvas, faces, facesData } = H;
  const plane = (A, tex) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(A.w, A.h2), new THREE.MeshBasicMaterial({ map: tex })); m.position.copy(P3(A.x, A.y, A.h)); m.rotation.y = TURN[A.face]; m.userData.fixed = true; scene.add(m); };
  const px = (A, n = 160) => [Math.round(A.w * n), Math.round(A.h2 * n)];
  const drawers = { stocks, bass, chains, london };

  for (const A of spots.roomArt) {
    if (A.art === 'curved') { // Wraps toward the chair, so it needs a real curve
      const R = 2.6, arc = A.w / R, tex = textCanvas(512, 256, battlestation); tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, A.h2, 18, 1, true, -arc / 2, arc), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }));
      m.position.copy(P3(A.x, A.y + R, A.h)); scene.add(m); continue;
    }
    if (A.art === 'portrait') { // The owner's own picture from the follower sheet
      const i = facesData.names.indexOf(A.handle), img = faces.image, cell = img.width / facesData.cols;
      const tex = textCanvas(512, 512, (c, w, h) => {
        c.fillStyle = '#c9a227'; c.fillRect(0, 0, w, h); c.fillStyle = '#0b0d12'; c.fillRect(22, 22, w - 44, h - 44);
        if (i >= 0) { c.imageSmoothingEnabled = true; c.drawImage(img, (i % facesData.cols) * cell + 1, Math.floor(i / facesData.cols) * cell + 1, cell - 2, cell - 2, 22, 22, w - 44, h - 112); }
        c.fillStyle = '#f5c518'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.fillText('@' + A.handle, w / 2, h - 40);
      });
      plane(A, tex); continue;
    }
    const [w, h] = px(A); plane(A, textCanvas(w, h, drawers[A.art]));
  }

  // Room 7: painted poles from the wall up to the roof ring
  { const { x, y, h } = spots.ger, mat = new THREE.MeshLambertMaterial({ color: 0xe8701c }), low = P3(0, 0, h - 1.4), top = P3(0, 0, h - 0.1);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const p0 = new THREE.Vector3(x + c * 1.9, top.y, -y - s * 1.9), p1 = new THREE.Vector3(x + c * 4.8, low.y, -y - s * 4.8);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, p0.distanceTo(p1)), mat); pole.position.copy(p0).add(p1).multiplyScalar(0.5); pole.lookAt(p1); scene.add(pole);
    }
  }
}
