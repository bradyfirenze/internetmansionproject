// Playable arcade cabinets. Original games, all on-brand for a house being built brick by brick.
export const GAMES = {
  demolition: { title: 'DEMOLITION CREW', help: 'Move to swing the wrecking ball. Clear the wall.' },
  cord: { title: 'EXTENSION CORD', help: 'Swipe or arrow keys. Plug into the outlets. Do not cross your own cord.' },
  stack: { title: 'BRICK STACK', help: 'Tap or press Space to drop the brick. Stack as high as you can.' },
};

export function runGame(name, canvas, sound, onScore, player = 'Guest') {
  const ctx = canvas.getContext('2d'), W = canvas.width = 480, H = canvas.height = 640;
  const input = { x: null, left: false, right: false, tap: false, dir: null };
  let stop = false, raf = 0, last = performance.now(), score = 0, over = false, mine = -1;
  // High scores stay on this device for now. The multiplayer server will make this one shared board.
  const boardKey = 'imp_board_' + name; let board = JSON.parse(localStorage.getItem(boardKey) || '[]'); let best = board.length ? board[0].s : 0;
  const bg = '#090b14', gold = '#f5c518', blue = '#1f6bff', red = '#ff5a72', cream = '#f2eadb';
  const txt = (s, x, y, size = 24, c = '#fff', a = 'center') => { ctx.font = `${size}px Anton, Impact, sans-serif`; ctx.fillStyle = c; ctx.textAlign = a; ctx.fillText(s, x, y); };
  const finish = () => {
    if (over) return; over = true; sound.fx('lose');
    if (score > 0) { const row = { n: player, s: score }; board.push(row); board.sort((a, b) => b.s - a.s); board = board.slice(0, 8); mine = board.indexOf(row); localStorage.setItem(boardKey, JSON.stringify(board)); best = board[0].s; } else mine = -1;
    onScore && onScore(score);
  };
  const G = { demolition, cord, stack }[name];
  let state = G();
  function frame(now) {
    if (stop) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (!over) state.update(dt);
    state.draw();
    txt(`SCORE ${score}`, 16, 34, 24, gold, 'left'); txt(`BEST ${best}`, W - 16, 34, 24, '#9aa3b5', 'right');
    if (over) {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
      txt('GAME OVER', W / 2, 120, 52, gold); txt(`SCORE ${score}`, W / 2, 164, 28);
      txt('HIGH SCORES', W / 2, 224, 24, '#fff');
      board.forEach((r, i) => { const y = 260 + i * 32, c = i === mine ? gold : '#c8cdd8'; txt(`${i + 1}`, 110, y, 22, c, 'left'); txt(r.n, 146, y, 22, c, 'left'); txt(String(r.s), W - 110, y, 22, c, 'right'); });
      if (!board.length) txt('NOBODY YET', W / 2, 260, 22, '#9aa3b5');
      txt('TAP TO PLAY AGAIN', W / 2, H - 40, 22, '#9aa3b5');
      if (input.tap) { input.tap = false; over = false; score = 0; state = G(); }
    }
    input.tap = false; input.dir = null;
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // ---- Wrecking ball breaks a brick wall ----
  function demolition() {
    const pad = { x: W / 2, w: 96 }, ball = { x: W / 2, y: H - 80, vx: 170, vy: -300, r: 9 };
    let bricks = [], lives = 3, level = 1;
    const wall = () => { bricks = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) bricks.push({ x: 8 + c * 58 + (r % 2 ? 14 : 0), y: 70 + r * 26, w: 52, h: 20, gold: Math.random() < 0.08 }); bricks = bricks.filter((b) => b.x + b.w < W); };
    wall();
    return {
      update(dt) {
        if (input.x !== null) pad.x += (input.x - pad.x) * Math.min(1, dt * 22);
        if (input.left) pad.x -= 460 * dt; if (input.right) pad.x += 460 * dt;
        pad.x = Math.max(pad.w / 2, Math.min(W - pad.w / 2, pad.x));
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.x < ball.r || ball.x > W - ball.r) { ball.vx *= -1; ball.x = Math.max(ball.r, Math.min(W - ball.r, ball.x)); sound.fx('blip'); }
        if (ball.y < 48) { ball.vy = Math.abs(ball.vy); sound.fx('blip'); }
        if (ball.vy > 0 && ball.y > H - 50 && ball.y < H - 30 && Math.abs(ball.x - pad.x) < pad.w / 2 + ball.r) { ball.vy = -Math.abs(ball.vy) * 1.015; ball.vx = (ball.x - pad.x) * 6; sound.fx('blip'); }
        if (ball.y > H + 20) { lives--; sound.fx('boom'); if (lives <= 0) finish(); else { ball.x = pad.x; ball.y = H - 80; ball.vy = -320 - level * 20; ball.vx = 150; } }
        for (let i = bricks.length - 1; i >= 0; i--) {
          const b = bricks[i];
          if (ball.x > b.x - ball.r && ball.x < b.x + b.w + ball.r && ball.y > b.y - ball.r && ball.y < b.y + b.h + ball.r) {
            const hz = Math.min(ball.x - b.x, b.x + b.w - ball.x) < Math.min(ball.y - b.y, b.y + b.h - ball.y);
            if (hz) ball.vx *= -1; else ball.vy *= -1;
            score += b.gold ? 50 : 10; bricks.splice(i, 1); sound.fx(b.gold ? 'gold' : 'boom'); break;
          }
        }
        if (!bricks.length) { level++; wall(); ball.vy = -Math.abs(ball.vy) * 1.1; }
      },
      draw() {
        for (const b of bricks) { ctx.fillStyle = b.gold ? gold : cream; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4); }
        ctx.fillStyle = blue; ctx.fillRect(pad.x - pad.w / 2, H - 40, pad.w, 12);
        ctx.strokeStyle = '#8a93a8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad.x, H - 40); ctx.lineTo(ball.x, ball.y); ctx.stroke();
        ctx.fillStyle = red; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, 7); ctx.fill();
        txt(`${lives} LIVES`, W / 2, 34, 20, '#fff');
      },
    };
  }

  // ---- Extension cord: grow your cord, reach the outlets ----
  function cord() {
    const S = 24, cols = 20, rows = 24, oy = 48;
    let body = [{ x: 10, y: 12 }, { x: 9, y: 12 }, { x: 8, y: 12 }], d = { x: 1, y: 0 }, nd = d, t = 0, speed = 0.13;
    const place = () => { let p; do { p = { x: 1 + Math.floor(Math.random() * (cols - 2)), y: 1 + Math.floor(Math.random() * (rows - 2)) }; } while (body.some((b) => b.x === p.x && b.y === p.y)); return p; };
    let outlet = place();
    return {
      update(dt) {
        if (input.dir) { const q = input.dir; if (q.x !== -d.x || q.y !== -d.y) nd = q; }
        t += dt;
        if (t >= speed) {
          t = 0; d = nd; const head = { x: body[0].x + d.x, y: body[0].y + d.y };
          if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows || body.some((b) => b.x === head.x && b.y === head.y)) return finish();
          body.unshift(head);
          if (head.x === outlet.x && head.y === outlet.y) { score += 10; sound.fx('gold'); outlet = place(); speed = Math.max(0.06, speed - 0.003); } else body.pop();
        }
      },
      draw() {
        ctx.strokeStyle = '#1b2030'; ctx.strokeRect(0, oy, cols * S, rows * S);
        ctx.fillStyle = gold; ctx.fillRect(outlet.x * S + 4, oy + outlet.y * S + 4, S - 8, S - 8);
        ctx.fillStyle = '#000'; ctx.fillRect(outlet.x * S + 8, oy + outlet.y * S + 8, 3, 7); ctx.fillRect(outlet.x * S + 13, oy + outlet.y * S + 8, 3, 7);
        body.forEach((b, i) => { ctx.fillStyle = i ? '#ff7a18' : '#ffd8a8'; ctx.fillRect(b.x * S + 2, oy + b.y * S + 2, S - 4, S - 4); });
      },
    };
  }

  // ---- Brick stack: timing drops, the overhang falls off ----
  function stack() {
    const h = 28; let tower = [{ x: W / 2 - 110, w: 220 }], cur = { x: 0, w: 220, dir: 1 }, spd = 240, cam = 0, falling = [];
    return {
      update(dt) {
        cur.x += cur.dir * spd * dt;
        if (cur.x < -40 || cur.x + cur.w > W + 40) cur.dir *= -1;
        if (input.tap) {
          const top = tower[tower.length - 1], l = Math.max(cur.x, top.x), r = Math.min(cur.x + cur.w, top.x + top.w);
          if (r <= l) { falling.push({ x: cur.x, w: cur.w, y: 0, v: 0 }); return finish(); }
          if (cur.x < l) falling.push({ x: cur.x, w: l - cur.x, y: 0, v: 0 });
          if (cur.x + cur.w > r) falling.push({ x: r, w: cur.x + cur.w - r, y: 0, v: 0 });
          tower.push({ x: l, w: r - l }); score += 1; sound.fx(r - l === top.w ? 'gold' : 'boom');
          cur = { x: tower.length % 2 ? -40 : W - (r - l) + 40, w: r - l, dir: tower.length % 2 ? 1 : -1 }; spd = Math.min(620, spd + 16);
        }
        cam += (Math.max(0, (tower.length - 10)) * h - cam) * Math.min(1, dt * 6);
        for (const f of falling) { f.v += 900 * dt; f.y += f.v * dt; }
      },
      draw() {
        const base = H - 30 + cam;
        tower.forEach((b, i) => { ctx.fillStyle = i % 2 ? cream : '#e8dcc2'; ctx.fillRect(b.x, base - i * h - h, b.w, h - 2); });
        ctx.fillStyle = gold; ctx.fillRect(cur.x, base - tower.length * h - h, cur.w, h - 2);
        ctx.fillStyle = '#aa8f60'; for (const f of falling) ctx.fillRect(f.x, base - tower.length * h + f.y, f.w, h - 2);
      },
    };
  }

  // Input
  const rect = () => canvas.getBoundingClientRect();
  const side = () => document.body.classList.contains('sideways'); // Game turned on a phone that won't rotate: screen down is game right
  const across = (e, r) => (side() ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width) * W;
  const ptX = (e) => side() ? e.clientY : e.clientX, ptY = (e) => side() ? -e.clientX : e.clientY;
  let sx = 0, sy = 0;
  const down = (e) => { const r = rect(); input.x = across(e, r); sx = ptX(e); sy = ptY(e); input.tap = true; e.preventDefault(); };
  const move = (e) => {
    if (e.buttons === 0 && e.pointerType !== 'mouse') return;
    const r = rect(); input.x = across(e, r);
    const dx = ptX(e) - sx, dy = ptY(e) - sy;
    if (e.buttons && Math.hypot(dx, dy) > 24) { input.dir = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) }; sx = ptX(e); sy = ptY(e); }
  };
  const key = (e) => {
    const on = e.type === 'keydown';
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { input.left = on; input.x = null; if (on) input.dir = { x: -1, y: 0 }; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { input.right = on; input.x = null; if (on) input.dir = { x: 1, y: 0 }; }
    if ((e.code === 'ArrowUp' || e.code === 'KeyW') && on) input.dir = { x: 0, y: -1 };
    if ((e.code === 'ArrowDown' || e.code === 'KeyS') && on) input.dir = { x: 0, y: 1 };
    if (e.code === 'Space' && on && !e.repeat) { input.tap = true; e.preventDefault(); }
  };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  addEventListener('keydown', key); addEventListener('keyup', key);
  return () => {
    stop = true; cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
    removeEventListener('keydown', key); removeEventListener('keyup', key);
  };
}
