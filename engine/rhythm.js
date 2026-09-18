/* --------------------------------------------------------------
   A beat grid with a tempo ramp.

   Every game in this cabinet paces itself from this rather than from
   a random timer, which is what makes difficulty comparable between
   them: randomness decides WHAT arrives, the grid decides WHEN.
   The same tempo curve also drives the soundtrack's intensity, so
   the music tightens as the round does.
   -------------------------------------------------------------- */
export class Rhythm {
  constructor(opts = {}) {
    this.bpm0 = opts.bpm0 ?? 80;         // tempo at the start of a round
    this.bpm1 = opts.bpm1 ?? 136;        // tempo at the end
    this.steps = opts.steps ?? 8;        // beats per bar
    this.lead = opts.lead ?? 0.6;        // silence before the first beat
    this.speedMul = opts.speedMul ?? [0.80, 1.0, 1.18];   // easy / normal / fast
    this.speed = 1;
    this.tempoMul = 1;                   // transient boosts, e.g. frenzy
    this.reset();
  }

  reset() { this.beat = 0; this.bar = 0; this.clock = this.lead; }

  bpm(intensity) {
    return (this.bpm0 + intensity * (this.bpm1 - this.bpm0))
         * this.speedMul[this.speed] * this.tempoMul;
  }

  /** @param {(beat:number, bar:number, intensity:number) => void} onBeat */
  update(dt, intensity, onBeat) {
    this.clock -= dt;
    let guard = 0;
    while (this.clock <= 0 && guard++ < 4) {
      this.clock += 60 / this.bpm(intensity);
      onBeat(this.beat, this.bar, intensity);
      if (++this.beat >= this.steps) { this.beat = 0; this.bar++; }
    }
  }
}
