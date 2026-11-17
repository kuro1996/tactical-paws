// Nusantara Strike — suara prosedural (WebAudio, tanpa file eksternal).
// Semua bunyi disintesis: tembakan, isi ulang, hit, kill, ronde, langkah.

let ctx = null;
let master = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() { ac(); }

function tone(freq, dur, type = 'square', vol = 0.08, slideTo = 0, delay = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur, vol = 0.12, freq = 1200, delay = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
}

// idx senjata: 0 M4, 1 MP5, 2 SPAS, 3 AWP
export function sShoot(idx, dist = 1) {
  const v = Math.max(0.04, 0.14 / Math.max(1, dist * 0.4));
  if (idx === 2) { noise(0.22, 0.22, 900); tone(140, 0.18, 'sawtooth', 0.14, 60); return; }
  if (idx === 3) { noise(0.3, 0.24, 700); tone(110, 0.3, 'sawtooth', 0.16, 45); return; }
  if (idx === 1) { noise(0.07, v, 2400); tone(520, 0.05, 'square', 0.05, 300); return; }
  noise(0.09, v + 0.04, 1800);
  tone(340, 0.07, 'square', 0.07, 180);
}

export function sReload() {
  tone(300, 0.07, 'square', 0.08);
  tone(420, 0.07, 'square', 0.08, 0, 0.14);
  tone(560, 0.09, 'square', 0.09, 0, 0.3);
}

export function sHit(head = false) {
  tone(head ? 1250 : 950, 0.06, 'sine', 0.12);
}

export function sKill() {
  tone(660, 0.09, 'sine', 0.12);
  tone(990, 0.12, 'sine', 0.12, 0, 0.09);
}

export function sHurt() {
  tone(160, 0.15, 'sawtooth', 0.1, 90);
  noise(0.1, 0.08, 500);
}

export function sClick() { tone(700, 0.04, 'sine', 0.06); }
export function sBuy() {
  tone(520, 0.08, 'sine', 0.1);
  tone(780, 0.1, 'sine', 0.1, 0, 0.08);
}
export function sDeny() { tone(180, 0.16, 'square', 0.09, 120); }
export function sRoundStart() {
  tone(440, 0.12, 'sine', 0.1);
  tone(660, 0.12, 'sine', 0.1, 0, 0.12);
  tone(880, 0.2, 'sine', 0.12, 0, 0.24);
}
export function sRoundWin() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'sine', 0.11, 0, i * 0.11));
}
export function sRoundLose() {
  [392, 330, 262].forEach((f, i) => tone(f, 0.2, 'sine', 0.1, 0, i * 0.14));
}
export function sStep(run = false) {
  noise(0.05, run ? 0.05 : 0.03, 400);
}
export function sSmoke() { noise(0.5, 0.1, 900); }
export function sTarget() {
  tone(880, 0.08, 'sine', 0.12);
  tone(1320, 0.12, 'sine', 0.12, 0, 0.07);
}
