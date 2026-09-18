/* --------------------------------------------------------------
   Procedural synthwave / retro-techno soundtrack.

   Nothing is sampled or downloaded: every note is generated at run
   time from a pattern table, which is why the whole soundtrack costs
   zero bytes and works in aeroplane mode. Each game supplies its own
   track config (tempo, key, progression, patterns) and drives
   `intensity`, which opens the filters and brings in the hats, the
   clap and the lead as the round heats up.

   A track may instead name an audio `file`, in which case that is
   streamed and looped — the hook for dropping in a licensed record.
   -------------------------------------------------------------- */
import { bus, unlock } from './audio.js';

const LOOKAHEAD = 0.12;    // seconds of notes queued ahead of the clock
const TICK = 25;           // scheduler wake-up, ms
const STEPS = 16;          // sixteenths per bar

const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const hit = (pat, step) => pat[step % pat.length] !== '.';

/* Patterns are 16 characters: one bar of sixteenths. 'x' hits, '.' rests. */
const P = {
  kick2:  'x.......x.......',
  kick4:  'x...x...x...x...',
  kick4b: 'x...x...x...x..x',
  clap:   '....x.......x...',
  hat8:   '..x...x...x...x.',
  hat16:  'x.xxx.xxx.xxx.xx',
  bassA:  'x.......x.......',
  bassB:  'x...x...x...x...',
  bassC:  'x.xx..x.x.xx..x.',
  arp8:   'x.x.x.x.x.x.x.x.',
  arp16:  'xxxxxxxxxxxxxxxx'
};

/* Every track is layered by intensity rather than fixed: the round opens
   with pad and a half-time kick, and the bass, hats, clap, sixteenth arp
   and lead each arrive at their own threshold as the game speeds up. */
export const TRACKS = {
  menu: {
    bpm: 102, root: 45, fixed: 0.18,
    prog: [[0, 'min'], [-4, 'maj'], [3, 'maj'], [-2, 'maj']],
    padGain: 0.30, arpGain: 0.10, bassGain: 0.16
  },
  slash: {
    bpm: 122, root: 45,
    prog: [[0, 'min'], [-4, 'maj'], [3, 'maj'], [-2, 'maj']],
    padGain: 0.15, arpGain: 0.11, bassGain: 0.22
  },
  space: {
    bpm: 128, root: 41,
    prog: [[0, 'min'], [0, 'min'], [5, 'min'], [3, 'maj']],
    padGain: 0.18, arpGain: 0.12, bassGain: 0.22
  },
  /* the boss: same key, half the air, twice the menace */
  boss: {
    bpm: 140, root: 38, fixed: 0.95, heavy: true,
    prog: [[0, 'min'], [1, 'maj'], [0, 'min'], [-2, 'maj']],
    padGain: 0.22, arpGain: 0.14, bassGain: 0.28
  }
};

const TRIAD = { min: [0, 3, 7], maj: [0, 4, 7] };

export class Music {
  constructor() {
    this.enabled = true;
    this.track = null;
    this.timer = null;
    this.intensity = 0.5;
    this.step = 0;
    this.nextTime = 0;
    this.el = null;            // <audio>, only for file-backed tracks
  }

  setEnabled(v) {
    this.enabled = v;
    if (this.gain) this.rampTo(v ? 1 : 0, 0.25);
    if (this.el) this.el.muted = !v;
  }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }

  _nodes() {
    const b = bus();
    if (!b) return null;
    if (!this.gain || this.ctx !== b.ctx) {
      this.ctx = b.ctx;
      this.gain = b.ctx.createGain();
      this.gain.gain.value = this.enabled ? 1 : 0;
      this.gain.connect(b.master);
      // one shared reverb-ish delay keeps the arp wide without extra cost
      this.delay = b.ctx.createDelay(1);
      this.delay.delayTime.value = 60 / 124 * 0.5;
      this.fb = b.ctx.createGain(); this.fb.gain.value = 0.18;
      this.wet = b.ctx.createGain(); this.wet.gain.value = 0.20;
      this.delay.connect(this.fb); this.fb.connect(this.delay);
      this.delay.connect(this.wet); this.wet.connect(this.gain);
    }
    return this.ctx;
  }

  rampTo(v, t) {
    if (!this.gain) return;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(v, now + t);
  }

  /** @param {string|object} track a key of TRACKS, or a config object */
  play(track) {
    unlock();
    const cfg = typeof track === 'string' ? TRACKS[track] : track;
    if (!cfg || cfg === this.track) { if (cfg === this.track) this.rampTo(this.enabled ? 1 : 0, .4); return; }
    this.stop();
    this.track = cfg;

    if (cfg.file) {                       // licensed recording, if you add one
      this.el = new Audio(cfg.file);
      this.el.loop = true; this.el.volume = cfg.volume ?? 0.5;
      this.el.muted = !this.enabled;
      this.el.play().catch(() => {});
      return;
    }

    if (!this._nodes()) return;
    this.delay.delayTime.value = (60 / cfg.bpm) * 0.5;   // straight eighth, on the grid
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.rampTo(this.enabled ? 1 : 0, 0.6);
    this.timer = setInterval(() => this.schedule(), TICK);
  }

  stop(fade = 0.3) {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.el) { this.el.pause(); this.el = null; }
    if (this.gain) this.rampTo(0, fade);
    this.track = null;
  }

  schedule() {
    const t = this.track;
    if (!t || !this.ctx) return;
    const stepDur = 60 / t.bpm / 4;
    const now = this.ctx.currentTime;

    // A throttled tab starves this callback. Without a resync the backlog
    // fires all at once and the bar lands in a heap; jump to the next
    // downbeat instead and stay in time.
    if (this.nextTime < now - stepDur) {
      const missed = Math.ceil((now - this.nextTime) / stepDur);
      this.step += missed;
      const toBar = (STEPS - (this.step % STEPS)) % STEPS;
      this.step += toBar;
      this.nextTime = now + 0.02 + toBar * 0;
    }

    while (this.nextTime < now + LOOKAHEAD) {
      this.voice(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  /** Which layers are audible at this intensity. */
  layers(i, heavy) {
    return {
      kick: i < 0.20 ? P.kick2 : (heavy || i > 0.8 ? P.kick4b : P.kick4),
      clap: i >= 0.30 ? P.clap : null,
      hat:  i < 0.42 ? null : (i < 0.70 ? P.hat8 : P.hat16),
      bass: i < 0.22 ? P.bassA : (i < 0.55 ? P.bassB : P.bassC),
      arp:  i < 0.50 ? P.arp8 : P.arp16,
      arpGain: i < 0.16 ? 0 : (0.45 + i * 0.75),
      lead: i >= 0.78 || heavy
    };
  }

  voice(step, time, dur) {
    const t = this.track;
    const i = t.fixed ?? this.intensity;
    const s = step % STEPS;
    const bar = Math.floor(step / STEPS);
    const [offset, quality] = t.prog[bar % t.prog.length];
    const chord = TRIAD[quality].map(n => t.root + offset + n);
    const L = this.layers(i, t.heavy);

    if (hit(L.kick, s)) this.kick(time, 0.95);
    if (L.clap && hit(L.clap, s)) this.clap(time, 0.30 + i * 0.22);
    if (L.hat && hit(L.hat, s)) this.hat(time, 0.09 + i * 0.13);

    if (hit(L.bass, s)) {
      const oct = (i > 0.55 && s % 8 === 6) ? 12 : 0;
      this.bass(time, midi(chord[0] + oct - 12), dur * 1.7, t.bassGain);
    }

    // a four-step cycle, so the arp always lands with the beat
    if (L.arpGain > 0 && hit(L.arp, s)) {
      const note = chord[[0, 1, 2, 1][s % 4]] + 24;
      this.arp(time, midi(note), dur * 1.5, 460 + i * 3400, t.arpGain * L.arpGain);
    }

    if (L.lead && s === 12) {
      this.arp(time, midi(chord[2] + 36), dur * 3, 2600, t.arpGain * 1.1);
    }

    if (s === 0) this.pad(time, chord.map(n => midi(n + 12)), (60 / t.bpm) * 4, t.padGain);
  }

  /* ---------------------------- voices ---------------------------- */
  kick(time, gain) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(155, time);
    o.frequency.exponentialRampToValueAtTime(44, time + 0.11);
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
    o.connect(g); g.connect(this.gain);
    o.start(time); o.stop(time + 0.26);
  }

  noise(time, dur, freq, q, gain, type = 'bandpass', send = 0) {
    const c = this.ctx;
    const src = c.createBufferSource();
    const len = Math.ceil(c.sampleRate * dur) + 1;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(f); f.connect(g); g.connect(this.gain);
    if (send) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(this.delay); }
    src.start(time); src.stop(time + dur + 0.01);
  }

  clap(time, gain) { this.noise(time, 0.15, 1750, 1.3, gain, 'bandpass', 0.14); }
  hat(time, gain)  { this.noise(time, 0.045, 9000, 0.8, gain, 'highpass'); }

  bass(time, freq, dur, gain) {
    const c = this.ctx;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(240 + this.intensity * 420, time);
    f.frequency.exponentialRampToValueAtTime(140, time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(f); f.connect(g); g.connect(this.gain);
    o.start(time); o.stop(time + dur + 0.02);
  }

  arp(time, freq, dur, cutoff, gain) {
    const c = this.ctx;
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 9;
    f.frequency.setValueAtTime(cutoff, time);
    f.frequency.exponentialRampToValueAtTime(Math.max(300, cutoff * 0.35), time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    for (const detune of [-7, 7]) {           // two saws, slightly apart
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = detune;
      o.connect(f); o.start(time); o.stop(time + dur + 0.02);
    }
    f.connect(g); g.connect(this.gain);
    const send = c.createGain(); send.gain.value = 0.28;
    g.connect(send); send.connect(this.delay);
  }

  pad(time, freqs, dur, gain) {
    const c = this.ctx;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(420 + this.intensity * 900, time);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, time + dur);
    for (const fr of freqs) {
      for (const detune of [-5, 6]) {
        const o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = detune;
        o.connect(f); o.start(time); o.stop(time + dur + 0.05);
      }
    }
    f.connect(g); g.connect(this.gain);
  }
}

export const music = new Music();
