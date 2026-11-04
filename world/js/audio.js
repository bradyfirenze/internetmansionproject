// All sound is synthesized live with WebAudio, so there are no audio files to license or load.
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.musicOn = null; this.step = 0; }
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(this.master);
    const n = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, n, n);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.nextT = 0;
    setInterval(() => this.schedule(), 40);
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7; }
  tone(f, t = 0.1, type = 'square', vol = 0.15, slide = 0, out) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain(), now = this.at || c.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, now); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), now + t);
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0008, now + t);
    o.connect(g); g.connect(out || this.master); o.start(now); o.stop(now + t + 0.02);
  }
  noise(t = 0.2, vol = 0.2, freq = 1200, type = 'lowpass', out) {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), now = this.at || c.currentTime;
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0008, now + t);
    s.connect(f); f.connect(g); g.connect(out || this.master); s.start(now, Math.random()); s.stop(now + t + 0.02);
  }
  fx(name) {
    if (!this.ctx) return;
    const F = {
      door: () => { this.noise(0.25, 0.12, 500); this.tone(110, 0.2, 'triangle', 0.15, -40); },
      slam: () => { this.noise(0.15, 0.2, 300); this.tone(70, 0.15, 'sine', 0.3); },
      jump: () => this.tone(240, 0.1, 'triangle', 0.06, 200),
      land: () => this.noise(0.08, 0.1, 500),
      step: () => this.noise(0.05, 0.03, 900),
      splash: () => { this.noise(0.6, 0.35, 1800); this.noise(0.25, 0.25, 500); },
      swim: () => this.noise(0.25, 0.05, 1500),
      bounce: () => this.tone(180, 0.3, 'sine', 0.2, 500),
      gold: () => { [880, 1175, 1760].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.12), i * 70)); },
      achieve: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'triangle', 0.13), i * 90)); },
      whistle: () => { this.tone(620, 0.9, 'sawtooth', 0.05, 0); this.tone(780, 0.9, 'sawtooth', 0.04, 0); },
      click: () => this.tone(900, 0.04, 'square', 0.06),
      zip: () => this.noise(1.2, 0.12, 2500, 'highpass'),
      crash: () => { this.noise(0.5, 0.35, 700); this.tone(80, 0.3, 'sawtooth', 0.2, -40); },
      swish: () => this.noise(0.3, 0.15, 3000, 'highpass'),
      rim: () => this.tone(320, 0.2, 'square', 0.08, -100),
      blip: () => this.tone(660, 0.05, 'square', 0.08),
      boom: () => this.tone(120, 0.15, 'square', 0.12, -60),
      lose: () => this.tone(330, 0.5, 'square', 0.1, -240),
      horn: () => { this.tone(349, 0.4, 'sawtooth', 0.08); this.tone(440, 0.4, 'sawtooth', 0.08); },
    };
    if (F[name]) F[name]();
  }
  // Tiny step sequencer. style picks the song, layers how much of it plays.
  playMusic(style = 'party', layers = 4) { this.init(); this.musicOn = { style, layers }; }
  stopMusic() { this.musicOn = null; if (this.musicGain) this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); }
  setMusicVolume(v) { if (this.musicGain && this.musicOn) this.musicGain.gain.setTargetAtTime(v * 0.75, this.ctx.currentTime, 0.1); }
  schedule() {
    if (!this.ctx || !this.musicOn || this.muted) return;
    const c = this.ctx, bpm = { party: 124, dungeon: 138, chill: 96, studio: 110 }[this.musicOn.style] || 120, dur = 60 / bpm / 4;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.14) { this.at = this.nextT; this.seq(this.step++, dur); this.nextT += dur; }
    this.at = 0;
  }
  seq(i, dur) {
    const { style, layers } = this.musicOn, out = this.musicGain, s = i % 16, bar = Math.floor(i / 16) % 4;
    const roots = style === 'dungeon' ? [41, 41, 44, 39] : style === 'chill' ? [45, 41, 48, 43] : [45, 41, 36, 43];
    const midi = (n) => 440 * 2 ** ((n - 69) / 12), root = roots[bar];
    if (layers >= 1 && s % 4 === 0) { this.tone(150, 0.16, 'sine', style === 'chill' ? 0.3 : 0.55, -110, out); }
    if (layers >= 2) {
      if (s % 4 === 2) this.noise(0.05, 0.12, 8000, 'highpass', out);
      if (s === 4 || s === 12) { this.noise(0.14, 0.18, 2200, 'bandpass', out); }
    }
    if (layers >= 3) {
      const pat = style === 'dungeon' ? [0, 0, 12, 0, 0, 12, 0, 0, 3, 0, 15, 0, 0, 12, 0, 10] : [0, -1, 0, 12, -1, 0, 7, -1, 0, -1, 0, 12, -1, 7, 10, -1];
      if (pat[s] >= 0) this.tone(midi(root + pat[s]), dur * 1.6, 'sawtooth', 0.08, 0, out);
    }
    if (layers >= 4 && s % 2 === 0) {
      const scale = [0, 3, 7, 10, 12, 15, 19, 22], k = scale[(s / 2 + bar * 3) % 8];
      this.tone(midi(root + 24 + k), dur * 1.4, style === 'chill' ? 'sine' : 'square', 0.035, 0, out);
    }
  }
}
