/* Procedural sound. No audio files ship with the game — everything
   below is synthesised, which keeps the install tiny and offline-safe. */

let ctx = null, master = null, noiseBuf = null;
let enabled = true;

export function setEnabled(v) {
  enabled = v;
  if (master) master.gain.value = v ? 0.9 : 0;
}

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.9 : 0;
  master.connect(ctx.destination);

  const len = ctx.sampleRate * 0.6;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

const t0 = () => ctx.currentTime;

function noise(dur, { type = 'bandpass', freq = 1200, q = 1, gain = .5, sweep = 0 } = {}) {
  if (!ctx || !enabled) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0());
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t0() + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0());
  g.gain.exponentialRampToValueAtTime(0.0001, t0() + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(); src.stop(t0() + dur + .02);
}

function tone(freq, dur, { type = 'sine', gain = .3, to = null, delay = 0 } = {}) {
  if (!ctx || !enabled) return;
  const o = ctx.createOscillator(); o.type = type;
  const g = ctx.createGain();
  const s = t0() + delay;
  o.frequency.setValueAtTime(freq, s);
  if (to) o.frequency.exponentialRampToValueAtTime(to, s + dur);
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(gain, s + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  o.connect(g); g.connect(master);
  o.start(s); o.stop(s + dur + .02);
}

export const sfx = {
  slice(pitch = 1) {
    noise(.18, { freq: 2600 * pitch, q: .8, gain: .38, sweep: .25 });
    tone(520 * pitch, .12, { type: 'triangle', gain: .12, to: 240 * pitch });
  },
  combo(n) {
    const base = 523.25;
    for (let i = 0; i < Math.min(n, 5); i++)
      tone(base * Math.pow(1.26, i), .3, { type: 'sine', gain: .22, delay: i * .06 });
  },
  bomb() {
    noise(.55, { type: 'lowpass', freq: 900, gain: .8, sweep: .12 });
    tone(90, .5, { type: 'sawtooth', gain: .3, to: 34 });
  },
  power(kind) {
    const seq = kind === 'freeze' ? [880, 740, 620, 520]
      : kind === 'time' ? [523, 659, 784, 1046]
      : kind === 'double' ? [659, 784, 988, 1318]
      : [440, 660, 880, 1320, 1760];
    seq.forEach((f, i) => tone(f, .28, { type: 'triangle', gain: .2, delay: i * .055 }));
  },
  tick() { tone(1400, .06, { type: 'square', gain: .12 }); },
  go() { [523, 659, 880].forEach((f, i) => tone(f, .22, { gain: .2, delay: i * .1 })); },
  end() { [784, 659, 523, 392].forEach((f, i) => tone(f, .45, { type: 'triangle', gain: .22, delay: i * .13 })); },
  tap() { tone(700, .07, { type: 'triangle', gain: .18, to: 1100 }); }
};
