/* Juice, sparkles, smoke and confetti — all vector, all pooled. */
import { TAU, rand, randInt } from './util.js';

const GRAVITY = 90;

export class Particles {
  constructor() { this.list = []; }
  clear() { this.list.length = 0; }

  spawn(o) { this.list.push(o); }

  juice(x, y, color, n = 14, power = 26) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(.25, 1) * power;
      this.spawn({
        k: 'juice', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - rand(4, 16),
        r: rand(.35, 1.25), life: rand(.5, 1.0), age: 0, color, grav: GRAVITY
      });
    }
  }

  sparkle(x, y, color, n = 10, power = 30) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(.3, 1) * power;
      this.spawn({
        k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: rand(.3, .9), life: rand(.28, .6), age: 0, color, grav: 10
      });
    }
  }

  smoke(x, y, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(.1, 1) * 22;
      this.spawn({
        k: 'smoke', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6,
        r: rand(2, 5), life: rand(.6, 1.2), age: 0, color: '#2b2b2b', grav: -6
      });
    }
  }

  confetti(x, y, n = 24) {
    const cols = ['#ffe45e', '#ff5c8a', '#7bf5a0', '#8fe4ff', '#ffa94d'];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(.4, 1) * 46;
      this.spawn({
        k: 'confetti', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 18,
        r: rand(.7, 1.5), rot: rand(0, TAU), vr: rand(-12, 12),
        life: rand(.9, 1.7), age: 0, color: cols[randInt(0, cols.length - 1)], grav: GRAVITY * .7
      });
    }
  }

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.age += dt;
      if (p.age >= p.life) { l.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'confetti') p.rot += p.vr * dt;
      if (p.k === 'smoke') p.r += dt * 3;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const t = p.age / p.life;
      ctx.globalAlpha = p.k === 'smoke' ? (1 - t) * .35 : 1 - t * t;
      ctx.fillStyle = p.color;
      if (p.k === 'confetti') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.r, -p.r * .45, p.r * 2, p.r * .9);
        ctx.restore();
      } else if (p.k === 'spark') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - t), 0, TAU);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * (p.k === 'juice' ? 1.35 : 1), 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/* --------------------------------------------------------------
   Splatter layer: juice that sticks to the "screen" and fades.
   Kept on its own low-resolution canvas so it costs almost nothing.
   -------------------------------------------------------------- */
export class Splatter {
  constructor() {
    this.cv = document.createElement('canvas');
    this.ctx = this.cv.getContext('2d');
    this.scale = 1;
  }
  resize(w, h, unit) {
    this.cv.width = Math.max(2, Math.round(w * .4));
    this.cv.height = Math.max(2, Math.round(h * .4));
    this.scale = .4 * unit;      // world-units -> splatter pixels
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
  }
  clear() { this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); }
  blob(x, y, color, size = 3) {
    const c = this.ctx, s = this.scale;
    c.globalAlpha = .28; c.fillStyle = color;
    for (let i = 0; i < 6; i++) {
      const a = rand(0, TAU), d = rand(0, size * 1.1);
      c.beginPath();
      c.ellipse((x + Math.cos(a) * d) * s, (y + Math.sin(a) * d) * s,
        rand(.25, .7) * size * s, rand(.25, .7) * size * s, a, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  fade(dt) {
    const c = this.ctx;
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = `rgba(0,0,0,${Math.min(.08, dt * 1.15)})`;
    c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.globalCompositeOperation = 'source-over';
  }
  draw(ctx, wUnits, hUnits) {
    ctx.globalAlpha = .55;
    ctx.drawImage(this.cv, 0, 0, wUnits, hUnits);
    ctx.globalAlpha = 1;
  }
}
