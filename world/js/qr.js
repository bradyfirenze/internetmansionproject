// Small QR code maker for one link: byte mode, medium error correction, versions 1 to 10 (up to 213 bytes).

const BLOCKS = [null, [10, 1, 16], [16, 1, 28], [26, 1, 44], [18, 2, 32], [24, 2, 43], [16, 4, 27], [18, 4, 31], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]]; // Error words per block, then count and data words per group
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const capacity = (v) => { const b = BLOCKS[v]; return b[1] * b[2] + (b[3] || 0) * (b[4] || 0); };

const gfMul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 255; };
const rsDivisor = (n) => { const r = new Array(n).fill(0); r[n - 1] = 1; let root = 1; for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) { r[j] = gfMul(r[j], root); if (j + 1 < n) r[j] ^= r[j + 1]; } root = gfMul(root, 2); } return r; };
const rsRemainder = (data, div) => { const r = new Array(div.length).fill(0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((d, i) => { r[i] ^= gfMul(d, f); }); } return r; };

const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0, (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];

export function makeQR(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let v = 1; while (v <= 10 && bytes.length > capacity(v) - (v < 10 ? 2 : 3)) v++;
  if (v > 10) return null;

  // Data words: mode, length, the bytes, end marker, padding
  const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
  const cap = capacity(v) * 8; put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
  for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8);
  const words = []; for (let i = 0; i < bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));

  // Split into blocks, add error correction, interleave
  const [ec, n1, d1, n2 = 0, d2 = 0] = BLOCKS[v], div = rsDivisor(ec), data = [], ecc = []; let at = 0;
  for (let i = 0; i < n1 + n2; i++) { const d = words.slice(at, at + (i < n1 ? d1 : d2)); at += d.length; data.push(d); ecc.push(rsRemainder(d, div)); }
  const out = [], longest = Math.max(d1, d2);
  for (let i = 0; i < longest; i++) data.forEach((d) => { if (i < d.length) out.push(d[i]); });
  for (let i = 0; i < ec; i++) ecc.forEach((e) => out.push(e[i]));

  // The fixed patterns
  const size = 17 + v * 4, grid = Array.from({ length: size }, () => new Array(size).fill(false)), fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, on) => { grid[y][x] = on; fixed[y][x] = true; };
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < size && y < size) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); } } };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = ALIGN[v]; al.forEach((a, i) => al.forEach((b, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const format = (mask) => {
    let rem = mask; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); // Medium error correction is 00 in the top bits
    const f = ((mask << 10) | rem) ^ 0x5412, bit = (i) => ((f >>> i) & 1) === 1;
    for (let i = 0; i < 6; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  if (v >= 7) {
    let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const f = (v << 12) | rem;
    for (let i = 0; i < 18; i++) { const on = ((f >>> i) & 1) === 1, a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, on); set(b, a, on); }
  }

  // The words, snaking up and down from the bottom right
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (fixed[y][x]) continue;
      grid[y][x] = i < out.length * 8 && ((out[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++;
    }
  }

  // Try all eight masks and keep the one that's easiest to scan
  const flip = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[m](x, y)) grid[y][x] = !grid[y][x]; };
  const penalty = () => {
    let p = 0, dark = 0;
    for (let a = 0; a < size; a++) {
      let runR = 1, runC = 1;
      for (let b = 0; b < size; b++) {
        if (grid[a][b]) dark++;
        if (b > 0) { if (grid[a][b] === grid[a][b - 1]) { runR++; if (runR === 5) p += 3; else if (runR > 5) p++; } else runR = 1; if (grid[b][a] === grid[b - 1][a]) { runC++; if (runC === 5) p += 3; else if (runC > 5) p++; } else runC = 1; }
        if (a > 0 && b > 0 && grid[a][b] === grid[a - 1][b] && grid[a][b] === grid[a][b - 1] && grid[a][b] === grid[a - 1][b - 1]) p += 3;
      }
    }
    return p + Math.floor(Math.abs(dark * 20 / (size * size) - 10)) * 10;
  };
  let best = 0, low = Infinity;
  for (let m = 0; m < 8; m++) { flip(m); format(m); const p = penalty(); if (p < low) { low = p; best = m; } flip(m); }
  flip(best); format(best);
  return { size, dark: (x, y) => grid[y][x] };
}

// Draws the code with its white border. Returns how wide it came out.
export function drawQR(c, qr, x, y, most) {
  const cell = Math.max(1, Math.floor(most / (qr.size + 8))), full = cell * (qr.size + 8);
  c.fillStyle = '#fff'; c.fillRect(x, y, full, full); c.fillStyle = '#000';
  for (let b = 0; b < qr.size; b++) for (let a = 0; a < qr.size; a++) if (qr.dark(a, b)) c.fillRect(x + (a + 4) * cell, y + (b + 4) * cell, cell, cell);
  return full;
}
