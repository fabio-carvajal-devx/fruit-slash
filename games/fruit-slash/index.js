/* --------------------------------------------------------------
   Fruit Slash — the rules.
   Physics, slicing, scoring and power-ups. Everything generic
   (canvas, units, blades, particles, loop) lives in ../../engine.
   -------------------------------------------------------------- */
import { Scene } from '../../engine/scene.js';
import { TAU, clamp, rand, segDist, vibrate } from '../../engine/util.js';
import { sfx } from '../../engine/audio.js';
import { POWERS, drawFruit, drawHalf, drawBomb, drawPower } from './fruits.js';
import { Director } from './director.js';
import { Background } from './background.js';

const G            = 132;    // gravity, units / s²
const COMBO_WINDOW = 0.55;   // seconds
const PIECE_LIFE   = 2.6;
const MAX_CUT      = 2;      // fruit -> halves -> chunks
const RECUT_DELAY  = 0.10;   // stops one stroke shredding its own debris
const LANES        = 5;

export const meta = { id: 'fruit-slash', title: 'Fruit Slash' };

export default class FruitSlash extends Scene {
  constructor(hooks) {
    super();
    this.hooks = hooks;
    this.bg = new Background();
    this.entities = [];
    this.pops = [];
    this.state = 'idle';
    this.wantsBlades = true;
    this.opts = { duration: 90, bombs: true, speed: 1 };
    this.director = new Director(this, this.opts);
  }

  mount(app) {
    super.mount(app);
    if (!this.mounted) {                 // setScene re-mounts; only hook resize once
      this.mounted = true;
      this.view.onResize(v => this.bg.resize(v));
    }
  }

  /* ------------------------------ round ------------------------------ */
  enter(opts) {
    Object.assign(this.opts, opts);
    this.entities.length = 0;
    this.pops.length = 0;
    this.app.particles.clear();
    this.app.splat.clear();
    this.app.blades.reset();
    this.director.reset();

    this.score = 0;
    this.sliced = 0;
    this.chops = 0;
    this.bestCombo = 0;
    this.bombsHit = 0;
    this.timeLeft = this.opts.duration;
    this.recent = [];
    this.comboShown = 0;
    this.fx = { freeze: 0, double: 0, frenzy: 0 };
    this.lastTick = Math.ceil(this.timeLeft);
    this.state = 'running';

    this.hooks.score(0);
    this.hooks.clock(this.timeLeft, this.opts.duration);
    this.hooks.effect(this.fx);
  }

  ambient(dt) { this.bg.update(dt); }

  leave() { this.state = 'idle'; this.entities.length = 0; this.pops.length = 0; }

  /* ------------------------------ throwing ------------------------------ */
  _throw(o, lane) {
    const { w, h } = this.view;
    const laneW = w / LANES;
    const x = clamp(laneW * ((lane ?? rand(0, LANES)) + .5) + rand(-.34, .34) * laneW,
                    o.r * 1.2, w - o.r * 1.2);
    const apex = rand(.62, .92) * h;
    const vy = -Math.sqrt(2 * G * apex);
    const flight = (2 * Math.abs(vy)) / G;
    const tx = clamp(x + rand(-.22, .22) * w, o.r, w - o.r);
    this.entities.push({
      ...o, x, y: h + o.r * 1.2,
      vx: (tx - x) / flight, vy,
      rot: rand(0, TAU), vr: rand(-2.4, 2.4),
      alive: true, pop: 0, depth: 0, cutAt: 0
    });
  }

  throwFruit(def, lane) { this._throw({ kind: 'fruit', def, r: def.r }, lane); }
  throwBomb(lane)       { this._throw({ kind: 'bomb', r: 6.2 }, lane); }
  throwPower(k, lane)   { this._throw({ kind: 'power', power: k, r: POWERS[k].r }, lane); }

  /** what the director's density governor counts */
  liveCount() {
    let n = 0;
    for (const e of this.entities)
      if (e.kind !== 'piece' && e.alive && e.y < this.view.h + e.r) n++;
    return n;
  }

  /* ------------------------------ simulation ------------------------------ */
  step(dt) {
    const wdt = dt * (this.fx.freeze > 0 ? 0.34 : 1);
    this.now = (this.now || 0) + dt;
    this.bg.update(wdt);

    if (this.state === 'running') {
      this.timeLeft -= dt;                       // the clock ignores freeze
      for (const k of ['freeze', 'double', 'frenzy']) {
        if (this.fx[k] > 0) {
          this.fx[k] = Math.max(0, this.fx[k] - dt);
          if (!this.fx[k]) this.hooks.effect(this.fx);
        }
      }
      const sec = Math.ceil(Math.max(0, this.timeLeft));
      if (sec !== this.lastTick) {
        this.lastTick = sec;
        this.hooks.clock(Math.max(0, this.timeLeft), this.opts.duration);
        if (sec <= 5 && sec > 0) sfx.tick();
      }
      if (this.timeLeft <= 0) return this.finish();
      const progress = 1 - clamp(this.timeLeft / this.opts.duration, 0, 1);
      this.director.update(wdt, progress);
      this.hooks.intensity?.(this.director.intensity(progress));
    }

    this.slice();

    const { w, h } = this.view;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.vy += G * wdt;
      e.x += e.vx * wdt; e.y += e.vy * wdt;
      e.rot += e.vr * wdt;
      if (e.pop < 1) e.pop = Math.min(1, e.pop + dt * 7);
      if (e.kind === 'piece') { e.life -= wdt; if (e.life <= 0) { this.entities.splice(i, 1); continue; } }
      if (e.y > h + e.r * 4 || e.x < -w * .4 || e.x > w * 1.4) this.entities.splice(i, 1);
    }

    this.app.particles.update(wdt);
    this.app.splat.fade(dt);

    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.age += dt; p.y -= dt * 12;
      if (p.age > p.life) this.pops.splice(i, 1);
    }

    const t = performance.now() / 1000;
    while (this.recent.length && t - this.recent[0] > COMBO_WINDOW) this.recent.shift();
    if (!this.recent.length) this.comboShown = 0;
  }

  /* ------------------------------ slicing ------------------------------ */
  slice() {
    const segs = this.app.blades.takeSegments();
    if (!segs.length) return;
    for (const s of segs) {
      for (let i = this.entities.length - 1; i >= 0; i--) {
        const e = this.entities[i];
        if (!e.alive) continue;
        if (e.kind === 'piece' && (e.depth >= MAX_CUT || this.now < e.cutAt)) continue;
        if (e.y > this.view.h + e.r) continue;
        const pad = e.kind === 'bomb' ? e.r * .82
                  : e.kind === 'piece' ? e.r * .8
                  : e.r * 1.05;
        if (segDist(s.x0, s.y0, s.x1, s.y1, e.x, e.y) <= pad) {
          e.alive = false;
          this.hit(e, Math.atan2(s.y1 - s.y0, s.x1 - s.x0), i, s.id);
        }
      }
    }
  }

  hit(e, ang, index, pointerId) {
    this.app.blades.registerHit(pointerId, e);

    if (e.kind === 'bomb') {
      this.entities.splice(index, 1);
      this.bombsHit++;
      this.addScore(-20, e.x, e.y, '#ff6b6b');
      this.app.particles.smoke(e.x, e.y, 18);
      this.app.particles.sparkle(e.x, e.y, '#ffd166', 22, 55);
      this.app.shake = 1;
      sfx.thud(); sfx.blast(.9); vibrate([40, 30, 60]);
      this.hooks.banner('OOPS!', '#ff6b6b');
      this.hooks.flashBomb();
      this.recent.length = 0; this.comboShown = 0;
      return;
    }

    if (e.kind === 'power') {
      this.entities.splice(index, 1);
      this.applyPower(e.power, e.x, e.y);
      return;
    }

    this.entities.splice(index, 1);
    const def = e.def;
    const depth = e.depth + 1;

    this.app.particles.juice(e.x, e.y, def.juice, depth === 1 ? 16 : 9, 30 / depth);
    this.app.particles.sparkle(e.x, e.y, '#ffffff', 6, 22);
    this.app.splat.blob(e.x, e.y, def.juice, e.r * .30);
    sfx.slice(rand(.85, 1.2) * (1 + depth * .25));
    vibrate(depth === 1 ? 12 : 8);

    if (depth <= MAX_CUT) {
      const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
      const kick = rand(9, 16) / depth;
      const r = depth === 1 ? e.r : e.r * .70;
      for (const side of [1, -1]) {
        this.entities.push({
          kind: 'piece', def, side, r, depth,
          x: e.x + nx * side * .4, y: e.y + ny * side * .4,
          vx: e.vx * .82 + nx * side * kick, vy: e.vy * .82 + ny * side * kick - 4,
          rot: ang, vr: e.vr * .7 + side * rand(.6, 2.4),
          life: PIECE_LIFE, pop: 1, alive: true,
          cutAt: this.now + RECUT_DELAY
        });
      }
    } else {
      this.app.particles.juice(e.x, e.y, def.juice, 14, 34);
    }

    const first = e.kind === 'fruit';
    if (first) this.sliced++; else this.chops++;
    const base = first ? (def.points || 10) : 5;
    const pts = Math.round(base * (this.fx.double > 0 ? 2 : 1));
    this.addScore(pts, e.x, e.y, this.fx.double > 0 ? '#ffd447' : '#ffffff');
    if (!first) this.hooks.banner2?.('CHOP!');

    this.combo(e);
  }

  combo(e) {
    const t = performance.now() / 1000;
    this.recent.push(t);
    const n = this.recent.length;
    if (n < 3 || n <= this.comboShown) return;
    this.comboShown = n;
    this.bestCombo = Math.max(this.bestCombo, n);
    const bonus = n * 10 * (this.fx.double > 0 ? 2 : 1);
    this.addScore(bonus, this.view.w / 2, this.view.h * .34, '#ffe45e', `COMBO +${bonus}`);
    this.hooks.banner(`COMBO x${n}`, '#ffe45e');
    this.app.particles.confetti(e.x, e.y, 18 + n * 3);
    sfx.combo(n); vibrate([10, 20, 10]);
  }

  applyPower(kind, x, y) {
    const p = POWERS[kind];
    this.app.particles.sparkle(x, y, p.tint, 30, 60);
    this.app.particles.confetti(x, y, 18);
    this.app.splat.blob(x, y, p.juice, 2.2);
    sfx.power(kind); vibrate([15, 25, 15]);
    this.hooks.banner(p.label, p.tint);

    if (kind === 'freeze') this.fx.freeze = 5.5;
    if (kind === 'double') this.fx.double = 8;
    if (kind === 'frenzy') { this.fx.frenzy = 6; this.director.setFrenzy(6); }
    if (kind === 'time') {
      this.timeLeft += 10;
      this.addScore(0, x, y, p.tint, '+10s');
      this.hooks.clock(this.timeLeft, Math.max(this.opts.duration, this.timeLeft));
    }
    this.hooks.effect(this.fx);
  }

  addScore(pts, x, y, color, label) {
    if (pts) { this.score = Math.max(0, this.score + pts); this.hooks.score(this.score); }
    this.pops.push({ x, y, text: label || (pts > 0 ? '+' + pts : String(pts)), color, age: 0, life: .9 });
  }

  finish() {
    if (this.state !== 'running') return;
    this.state = 'ending';
    this.app.blades.enabled = false;
    this.timeLeft = 0;
    this.hooks.clock(0, this.opts.duration);
    sfx.end();
    setTimeout(() => {
      this.state = 'idle';
      this.hooks.end({
        score: this.score, duration: this.opts.duration,
        stats: [['FRUIT', this.sliced], ['EXTRA CHOPS', this.chops],
                ['BEST COMBO', 'x' + this.bestCombo], ['BOMBS', this.bombsHit]]
      });
    }, 1300);
  }

  /* ------------------------------ render ------------------------------ */
  draw(ctx, tSec) {
    this.bg.draw(ctx, this.view);
    this.app.splat.draw(ctx, this.view.w, this.view.h);
    for (const e of this.entities) if (e.kind === 'piece') this.drawEntity(ctx, e, tSec);
    for (const e of this.entities) if (e.kind !== 'piece') this.drawEntity(ctx, e, tSec);
  }

  overlay(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of this.pops) {
      const t = p.age / p.life;
      ctx.globalAlpha = 1 - t * t;
      const size = 5.5 * (1 + (1 - t) * .25);
      ctx.font = `900 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
      ctx.lineWidth = size * .22; ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  drawEntity(ctx, e, tSec) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    const s = 0.55 + 0.45 * (e.pop < 1 ? 1 - Math.pow(1 - e.pop, 3) : 1);
    if (s !== 1) ctx.scale(s, s);
    if (e.kind === 'piece') {
      ctx.globalAlpha = clamp(e.life / .6, 0, 1);
      drawHalf(ctx, e.def, e.r, e.side);
      ctx.globalAlpha = 1;
    } else if (e.kind === 'fruit') {
      drawFruit(ctx, e.def, e.r);
    } else if (e.kind === 'bomb') {
      drawBomb(ctx, e.r, tSec);
    } else {
      ctx.rotate(-e.rot);
      drawPower(ctx, e.power, e.r, tSec);
    }
    ctx.restore();
  }
}
