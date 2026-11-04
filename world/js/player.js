// First-person walker: voxel collision, auto-step, swimming, ladders, bounce pads.
import * as THREE from 'three';
import { B, BLOCKS } from './blocks.js';
import { WORLD } from './voxels.js';

const HW = 0.3, HEIGHT = 1.75, EYE = 1.6;
const LIMIT = { x0: -375.5, x1: 233.5, z0: -371.5, z1: 107 };

export class Player {
  constructor(game) {
    this.g = game;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.inWater = false; this.headUnder = false; this.climbing = false;
    this.eyeLag = 0; this.bob = 0; this.stepT = 0; this.fallFrom = 0; this.jumpHeld = false;
    this.locked = null; // set when a ride or vehicle is in control
    this.third = false;
  }
  hit(x, y, z) {
    const V = this.g.V;
    for (let ix = Math.floor(x - HW); ix <= Math.floor(x + HW); ix++)
      for (let iy = Math.floor(y); iy <= Math.floor(y + HEIGHT); iy++)
        for (let iz = Math.floor(z - HW); iz <= Math.floor(z + HW); iz++)
          if (V.solidW(ix, iy, iz)) return true;
    return false;
  }
  bodyHas(test) {
    const V = this.g.V, p = this.pos;
    for (let iy = Math.floor(p.y + 0.2); iy <= Math.floor(p.y + HEIGHT - 0.1); iy++)
      for (let ix = Math.floor(p.x - HW); ix <= Math.floor(p.x + HW); ix++)
        for (let iz = Math.floor(p.z - HW); iz <= Math.floor(p.z + HW); iz++)
          if (test(BLOCKS[V.getW(ix, iy, iz)])) return true;
    return false;
  }
  teleport(x, y, z, yaw) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); if (yaw !== undefined) this.yaw = yaw; this.fallFrom = y; }

  update(dt, input) {
    if (this.locked) return;
    const p = this.pos, v = this.vel, V = this.g.V, snd = this.g.sound;
    const wasWater = this.inWater, fell = this.fallFrom - p.y;
    this.inWater = BLOCKS[V.getW(p.x, p.y + 0.5, p.z)].kind === 'water';
    this.headUnder = BLOCKS[V.getW(p.x, p.y + EYE, p.z)].kind === 'water';
    this.climbing = this.bodyHas((d) => d.climb);

    // Flying: go where you look. Walls still stop you.
    if (this.flying) {
      const sp = input.sprint ? 48 : 20, cp = Math.cos(this.pitch), sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const dx = -sy * cp * input.fwd + cy * input.side, dy = Math.sin(this.pitch) * input.fwd + (input.jump ? 1 : 0) - (input.down ? 1 : 0), dz = -cy * cp * input.fwd - sy * input.side;
      const k2 = Math.min(1, dt * 7); v.x += (dx * sp - v.x) * k2; v.y += (dy * sp - v.y) * k2; v.z += (dz * sp - v.z) * k2;
      if (!this.hit(p.x + v.x * dt, p.y, p.z)) p.x += v.x * dt; if (!this.hit(p.x, p.y + v.y * dt, p.z)) p.y += v.y * dt; if (!this.hit(p.x, p.y, p.z + v.z * dt)) p.z += v.z * dt;
      p.y = Math.min(p.y, 130);
      this.onGround = false; this.fallFrom = p.y;
      p.x = Math.max(LIMIT.x0, Math.min(LIMIT.x1, p.x)); p.z = Math.max(LIMIT.z0, Math.min(LIMIT.z1, p.z));
      this.eyeLag = 0; return;
    }
    // Wish direction from input
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const fx = -s, fz = -c, rx = c, rz = -s;
    let wx = fx * input.fwd + rx * input.side, wz = fz * input.fwd + rz * input.side;
    const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    const sprint = input.sprint && !this.inWater;
    const max = this.inWater ? 4.5 : sprint ? 15 : 7;
    const accel = this.inWater ? 7 : this.onGround ? 40 : 14;
    const tx = wx * max, tz = wz * max;
    const k = Math.min(1, accel * dt / Math.max(0.01, max));
    v.x += (tx - v.x) * k * 2; v.z += (tz - v.z) * k * 2;

    if (this.climbing) {
      const up = input.jump || input.fwd > 0.2;
      v.y = up ? 5 : input.fwd < -0.2 ? -5 : -0.6;
      this.fallFrom = p.y;
      // Stay on the ladder until the top, then you can step off
      if (BLOCKS[V.getW(p.x, p.y + 1.6, p.z)].climb && input.fwd >= 0) {
        v.x = (Math.floor(p.x) + 0.5 - p.x) * 6; v.z = (Math.floor(p.z) + 0.5 - p.z) * 6;
      }
    } else if (this.inWater) {
      // You float back up on your own. Look down and swim forward to dive.
      const dive = Math.sin(this.pitch) * Math.max(0, input.fwd) * 4.5;
      const tv = input.jump ? 4.6 : dive < -0.6 ? dive : dive > 0.6 ? dive : (this.headUnder ? 1.6 : -0.4);
      v.y += (tv - v.y) * Math.min(1, 3.5 * dt);
      this.fallFrom = p.y;
    } else {
      v.y -= 26 * dt;
      if (v.y < -46) v.y = -46;
    }
    if (input.jump && this.onGround && !this.inWater && !this.jumpHeld) { v.y = 9.2; this.onGround = false; snd.fx('jump'); }
    this.jumpHeld = input.jump;

    // Axis moves with auto-step
    let nx = p.x + v.x * dt, nz = p.z + v.z * dt;
    const canStep = this.onGround || this.inWater;
    const moveAxis = (ax, val) => {
      const x = ax === 0 ? val : p.x, z = ax === 2 ? val : p.z;
      if (!this.hit(x, p.y, z)) { if (ax === 0) p.x = val; else p.z = val; return; }
      // Walk up one block. Swimmers can haul themselves out over a pool edge.
      const fence = BLOCKS[this.g.V.getW(x, p.y + 0.5, z)].kind === 'cutout' || BLOCKS[this.g.V.getW(x + HW, p.y + 0.5, z)].kind === 'cutout' || BLOCKS[this.g.V.getW(x - HW, p.y + 0.5, z)].kind === 'cutout' || BLOCKS[this.g.V.getW(x, p.y + 0.5, z + HW)].kind === 'cutout' || BLOCKS[this.g.V.getW(x, p.y + 0.5, z - HW)].kind === 'cutout';
      for (const rise of this.inWater ? [1.02, 2.1] : [1.02]) {
        if (canStep && !fence && !this.hit(x, p.y + rise + 0.03, z) && !this.hit(p.x, p.y + rise + 0.03, p.z)) {
          p.y += rise; this.eyeLag -= rise; if (ax === 0) p.x = val; else p.z = val; if (this.inWater) v.y = Math.max(v.y, 0); return;
        }
      }
      if (ax === 0) v.x = 0; else v.z = 0;
    };
    moveAxis(0, nx); moveAxis(2, nz);

    // Vertical
    const ny = p.y + v.y * dt;
    if (this.hit(p.x, ny, p.z)) {
      if (v.y < 0) {
        const under = this.blockUnder(ny);
        const impact = -v.y;
        p.y = Math.floor(ny) + 1 + 0.001; if (this.hit(p.x, p.y, p.z)) p.y = Math.ceil(ny) + 0.001;
        if (under === B.bounce) {
          v.y = Math.max(19, impact * 0.92); snd.fx('bounce'); this.g.achieve('bounce');
        } else {
          if (!this.onGround && impact > 6) snd.fx('land');
          v.y = 0; this.onGround = true; this.fallFrom = p.y;
        }
      } else { v.y = 0; }
    } else { p.y = ny; if (v.y < -0.1 || v.y > 0.1) this.onGround = false; }
    if (this.onGround && this.hit(p.x, p.y - 0.04, p.z) === false) this.onGround = false;

    if (this.inWater && !wasWater) {
      if (fell > 2) { snd.fx('splash'); this.g.splash(p.x, p.y + 0.6, p.z, Math.min(2.4, 0.8 + fell / 14)); }
      if (fell > 14) this.g.achieve('dive');
    }
    if (!this.inWater && !this.onGround && v.y > 0) this.fallFrom = Math.max(this.fallFrom, p.y);
    if (!this.inWater && !this.onGround) this.fallFrom = Math.max(this.fallFrom, p.y);

    // Stay on the lot
    if (p.x < LIMIT.x0 || p.x > LIMIT.x1 || p.z < LIMIT.z0 || p.z > LIMIT.z1) {
      p.x = Math.max(LIMIT.x0, Math.min(LIMIT.x1, p.x)); p.z = Math.max(LIMIT.z0, Math.min(LIMIT.z1, p.z));
      this.g.notice('Lot line. Comment if you want us to buy the neighbors out.');
    }
    if (p.y < -5) this.teleport(-6, WORLD.GROUND + 1, 48);

    // Footsteps and bob
    const speed = Math.hypot(v.x, v.z);
    if (this.onGround && speed > 1) {
      this.bob += speed * dt * 1.5; this.stepT += speed * dt;
      if (this.stepT > 2.6) { this.stepT = 0; snd.fx('step'); }
    }
    if (this.inWater && speed > 1) { this.stepT += speed * dt; if (this.stepT > 4) { this.stepT = 0; snd.fx('swim'); } }
    this.eyeLag += (0 - this.eyeLag) * Math.min(1, dt * 12);
  }
  blockUnder(y) {
    const V = this.g.V, p = this.pos, b = Math.floor(y);
    for (const [a, c] of [[0, 0], [-HW, -HW], [HW, -HW], [-HW, HW], [HW, HW]]) {
      const id = V.getW(p.x + a, b, p.z + c);
      if (id === B.bounce) return id;
    }
    return V.getW(p.x, b, p.z);
  }
  eyePos(out) {
    const bobY = this.onGround ? Math.sin(this.bob * 2) * 0.035 : 0;
    return out.set(this.pos.x, this.pos.y + EYE + this.eyeLag + bobY, this.pos.z);
  }
  applyCamera(cam) {
    if (this.locked && this.locked.camera) { this.locked.camera(cam); return; }
    const eye = this.eyePos(new THREE.Vector3());
    cam.rotation.order = 'YXZ'; cam.rotation.set(this.pitch, this.yaw, 0);
    if (this.third) {
      const dir = new THREE.Vector3(0, 0, 1).applyEuler(cam.rotation);
      let d = 4.5; const V = this.g.V;
      for (let t = 0.3; t < 4.5; t += 0.2) if (BLOCKS[V.getW(eye.x + dir.x * t, eye.y + dir.y * t, eye.z + dir.z * t)].opaque) { d = t - 0.3; break; }
      eye.addScaledVector(dir, Math.max(0.2, d));
    }
    cam.position.copy(eye);
  }
}
