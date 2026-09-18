/* --------------------------------------------------------------
   The Director: WHAT gets thrown, and WHEN.

   Pace comes from a beat grid, not from a random timer. The tempo
   ramps across the round and every bar follows a rhythm pattern, so
   two rounds at the same difficulty always *feel* the same even
   though the fruit, the lane and the arc are random every time.
   A density governor then caps how much can be in the air at once,
   which is what actually keeps difficulty honest: without it, a run
   of lucky rolls turns an easy round into chaos.
   -------------------------------------------------------------- */
import { rand, randInt, chance, weighted } from '../../engine/util.js';
import { Rhythm } from '../../engine/rhythm.js';
import { FRUITS } from './fruits.js';

const FRUIT_TABLE = FRUITS.map(f => [f, f.weight]);
const BEATS = 8;                  // one bar

/* spawns per beat, by intensity tier. Strong beats are 0 and 4. */
const PATTERNS = [
  [1, 0, 1, 0, 1, 0, 1, 1],
  [1, 0, 1, 1, 1, 0, 1, 0],
  [2, 0, 1, 1, 1, 1, 1, 0],
  [2, 0, 2, 1, 2, 0, 1, 1]
];
const FRENZY_PATTERN = [2, 2, 2, 2, 2, 2, 2, 2];

const LANES = 5;

export class Director {
  constructor(world, opts) {
    this.world = world;
    this.opts = opts;               // { bombs, speed, duration }
    this.rhythm = new Rhythm({ bpm0: 80, bpm1: 136, steps: BEATS });
    this.reset();
  }

  reset() {
    this.rhythm.reset();
    this.bombGrace = 6;
    this.frenzy = 0;
    this.carry = 0;                 // throws pushed to the next beat
    this.bombThisBar = false;
    this.barsSincePower = 2;
  }

  setFrenzy(sec) { this.frenzy = sec; }

  /** 0..1, and never dead-slow at the start */
  intensity(progress) { return 0.15 + 0.85 * Math.pow(progress, 0.85); }

  update(dt, progress) {
    this.bombGrace -= dt;
    this.frenzy = Math.max(0, this.frenzy - dt);
    this.rhythm.speed = this.opts.speed;
    this.rhythm.tempoMul = this.frenzy > 0 ? 1.5 : 1;
    this.rhythm.update(dt, this.intensity(progress), (beat, bar, intensity) => {
      if (beat === 0 && bar > 0) { this.bombThisBar = false; this.barsSincePower++; }
      this.beat = beat;
      this.onBeat(intensity);
    });
  }

  onBeat(intensity) {
    const inFrenzy = this.frenzy > 0;
    const tier = Math.min(3, Math.floor(intensity * 4));
    const pattern = inFrenzy ? FRENZY_PATTERN : PATTERNS[tier];

    let count = pattern[this.beat] + this.carry;
    this.carry = 0;

    // power-ups ride the downbeat so they always arrive on the pulse
    if (!inFrenzy && this.beat === 0 && this.barsSincePower >= 3 && chance(.75)) {
      this.barsSincePower = 0;
      this.world.throwPower(weighted([
        ['freeze', 26], ['double', 26], ['time', 22], ['frenzy', 18]
      ]), this.lane());
      count = Math.max(0, count - 1);
    }

    // a little syncopation so the grid never feels mechanical
    if (count > 1 && chance(.2)) { count--; this.carry++; }

    // density governor: the real difficulty dial
    const live = this.world.liveCount();
    const cap = inFrenzy ? 12 : Math.round(3 + intensity * 3);
    if (live >= cap) return;
    count = Math.min(count, cap - live);
    if (count === 0 && live === 0) count = 1;            // never a dead screen
    if (count === 0) return;

    const lanes = this.pickLanes(count);
    for (let i = 0; i < count; i++) {
      const bombBeat = this.beat === 3 || this.beat === 7;
      const bombOk = this.opts.bombs && !inFrenzy && this.bombGrace <= 0
                     && !this.bombThisBar && bombBeat && count <= 2;
      if (bombOk && chance(.18 + intensity * .30)) {
        this.bombThisBar = true;
        this.world.throwBomb(lanes[i]);
      } else {
        this.world.throwFruit(weighted(FRUIT_TABLE), lanes[i]);
      }
    }
  }

  lane() { return randInt(0, LANES - 1); }

  /** distinct lanes so a beat's fruit never stack on top of each other */
  pickLanes(n) {
    const pool = [...Array(LANES).keys()];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const out = [];
    for (let i = 0; i < n; i++) out.push(pool[i % LANES]);
    return out;
  }

  static get LANES() { return LANES; }
}
