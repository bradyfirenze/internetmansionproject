// The two open Wing 7 rooms, sold as someone's own room. Each gets its own outside door, a name plate over it and a wall sign beside it.
// Positions live in spots.openRooms (build.js). Set a room's owner there when it sells and the plate shows their name.
import * as THREE from 'three';

const SIGN_TEXT = 'This room is open. Want it? DM @internetmansionproject. 18+.';
const DOOR = { half: 1.4, h: 3.6, v: 19.6 }, FACE_V = 20.7; // FACE_V clears the wall's stepped outer edge
const ALONG_WING = -3 * Math.PI / 4, FACING_OUT = Math.PI / 4; // Wing 7 runs at 45 degrees

const drawSign = (c, w, h, font) => {
  c.fillStyle = '#10131c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f5c518'; c.lineWidth = 16; c.strokeRect(8, 8, w - 16, h - 16);
  c.textAlign = 'center';
  c.fillStyle = '#f5c518'; c.font = `128px ${font}`; c.fillText('THIS ROOM IS OPEN.', w / 2, 170);
  c.fillStyle = '#fff'; c.font = `92px ${font}`; c.fillText('WANT IT?', w / 2, 300);
  c.fillStyle = '#fff'; c.font = '700 66px Inter, sans-serif'; c.fillText('DM @internetmansionproject', w / 2, 420);
  c.fillStyle = '#f5c518'; c.font = `92px ${font}`; c.fillText('18+', w / 2, 550);
};
const drawPlate = (owner) => (c, w, h, font) => {
  c.fillStyle = '#10131c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f5c518'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = owner ? '#fff' : '#f5c518';
  c.font = `64px ${font}`; c.fillText(owner ? `@${owner}` : 'YOUR NAME HERE', w / 2, h / 2 + 4, w - 40);
};

export function buildOpenRooms(game, data, H) {
  const { scene, V, sound } = game, { spots, W, G } = data, { P3, addE, tick, textCanvas, DISPLAY, litProp, envAt } = H, w = W[7];
  const flat = (width, height, u, hMid, tex) => {
    const [x, y] = w.P(u, FACE_V), m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.copy(P3(x, y, hMid)); m.rotation.y = FACING_OUT; m.userData.fixed = true; scene.add(m); return m;
  };
  const signTex = textCanvas(1040, 620, (c, a, b) => drawSign(c, a, b, DISPLAY));

  for (const R of spots.openRooms || []) { // A browser can hold an old build.js for a few minutes after a publish: skip the rooms for that visit, don't crash
    const [dx, dy] = w.P(R.doorU, DOOR.v), outside = P3(...w.P(R.doorU, 22), 1.5);
    const frameMat = litProp(0xc9a227), leafMat = litProp(0x2c3a4a), knobMat = litProp(0xf5c518);
    envAt(frameMat, outside); envAt(leafMat, outside); envAt(knobMat, outside);
    const part = (parent, sx, sy, sz, mat, x, y, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); o.position.set(x, y, z); parent.add(o); return o; };

    // The opening in the wall is stepped, so a deep frame hides the steps on both sides
    const door = new THREE.Group(); door.position.copy(P3(dx, dy, 0)); door.rotation.y = ALONG_WING; scene.add(door);
    part(door, 0.3, DOOR.h + 0.4, 2.4, frameMat, -DOOR.half - 0.15, (DOOR.h + 0.4) / 2); part(door, 0.3, DOOR.h + 0.4, 2.4, frameMat, DOOR.half + 0.15, (DOOR.h + 0.4) / 2);
    part(door, DOOR.half * 2 + 0.6, 0.4, 2.4, frameMat, 0, DOOR.h + 0.2);
    const hinge = new THREE.Group(); hinge.position.x = -DOOR.half; door.add(hinge);
    part(hinge, DOOR.half * 2, DOOR.h, 0.2, leafMat, DOOR.half, DOOR.h / 2); part(hinge, 0.18, 0.18, 0.5, knobMat, DOOR.half * 2 - 0.3, 1.25);

    // Locks every carved cell in the wall until the door opens
    const cells = [], [cu, cv] = w.P(R.doorU, DOOR.v);
    for (let x = Math.floor(cu) - 4; x <= cu + 4; x++) for (let y = Math.floor(cv) - 4; y <= cv + 4; y++) {
      const [u, v] = w.local(x + 0.5, y + 0.5);
      if (Math.abs(u - R.doorU) <= 1.75 && v >= 18.7 && v <= 20.5) for (let h = 0; h < 4; h++) if (!V.getW(x + 0.5, G + h + 0.5, -y - 0.5)) cells.push([x + 0.5, G + h + 0.5, -y - 0.5]);
    }
    V.setBarrier(cells, true);
    let open = false, a = 0;
    addE({ pos: P3(dx, dy, 1.3), r: 3.6, any: true, prompt: () => `${open ? 'Close' : 'Open'} the open room`, use: () => { open = !open; V.setBarrier(cells, !open); sound.fx(open ? 'door' : 'slam'); } });
    tick((dt) => { a += ((open ? 1 : 0) - a) * Math.min(1, dt * 7); hinge.rotation.y = a * 1.45; });

    flat(3.4, 0.9, R.doorU, DOOR.h + 1.05, textCanvas(640, 170, (c, a2, b2) => drawPlate(R.owner)(c, a2, b2, DISPLAY)));
    flat(5.2, 3.1, R.signU, 3.4, signTex);
    const [sx, sy] = w.P(R.signU, 21.5);
    addE({ pos: P3(sx, sy, 1.5), r: 3.6, any: true, prompt: () => 'Read the sign', use: () => { game.notice(SIGN_TEXT); sound.fx('click'); } });
  }
}
