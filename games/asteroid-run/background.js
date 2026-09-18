/* Deep-space parallax: three star layers streaming past, a nebula and
   a distant planet. Same contract as the fruit-slash background. */
import { TAU, rand } from '../../engine/util.js';

const LAYERS = [
  { n: 46, speed: 3.5,  r: [.14, .30], alpha: .40 },
  { n: 30, speed: 9.0,  r: [.22, .45], alpha: .65 },
  { n: 16, speed: 20.0, r: [.30, .62], alpha: .95 }
];

export class Background {
  constructor() { this.t = 0; this.layers = []; this.drift = 0; }

  resize(view) {
    const { w, h, pw, ph, dpr } = view;
    this.w = w; this.h = h;
    this.layers = LAYERS.map(L => ({
      ...L,
      stars: Array.from({ length: L.n }, () => ({ x: rand(0, w), y: rand(0, h), r: rand(L.r[0], L.r[1]) }))
    }));

    // the static part of the sky is painted once
    this.sky = this.sky || document.createElement('canvas');
    this.sky.width = pw; this.sky.height = ph;
    const c = this.sky.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, ph);
    g.addColorStop(0, '#05060f'); g.addColorStop(.5, '#0b0b28'); g.addColorStop(1, '#140a2e');
    c.fillStyle = g; c.fillRect(0, 0, pw, ph);

    for (const [x, y, rad, col] of [
      [.22, .30, .42, 'rgba(120,80,255,.20)'],
      [.80, .62, .38, 'rgba(255,60,150,.16)'],
      [.52, .12, .30, 'rgba(60,200,255,.14)']
    ]) {
      const n = c.createRadialGradient(x * pw, y * ph, 0, x * pw, y * ph, rad * Math.max(pw, ph));
      n.addColorStop(0, col); n.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = n; c.fillRect(0, 0, pw, ph);
    }

    // a planet on the horizon, purely scenery
    const px = pw * .80, py = ph * .22, pr = Math.min(pw, ph) * .13;
    const pg = c.createRadialGradient(px - pr * .35, py - pr * .35, pr * .1, px, py, pr);
    pg.addColorStop(0, '#6f7bd6'); pg.addColorStop(.7, '#3a3f8c'); pg.addColorStop(1, '#151833');
    c.fillStyle = pg; c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(180,200,255,.28)';
    c.lineWidth = Math.max(1, pr * .05);
    c.beginPath(); c.ellipse(px, py, pr * 1.6, pr * .42, -.35, 0, TAU); c.stroke();
    c.save();
    c.beginPath(); c.arc(px, py, pr, 0, TAU); c.clip();
    c.fillStyle = 'rgba(255,255,255,.07)';
    for (let i = 0; i < 4; i++) c.fillRect(px - pr, py - pr + i * pr * .5, pr * 2, pr * .16);
    c.restore();
    this.dpr = dpr;
  }

  update(dt, speed = 1) {
    this.t += dt;
    for (const L of this.layers) {
      for (const s of L.stars) {
        s.y += L.speed * speed * dt;
        if (s.y > this.h + 1) { s.y = -1; s.x = rand(0, this.w); }
      }
    }
  }

  draw(ctx, view) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.sky, 0, 0);
    ctx.restore();

    for (const L of this.layers) {
      ctx.fillStyle = `rgba(255,255,255,${L.alpha})`;
      for (const s of L.stars) {
        // the fastest layer streaks rather than dots, to sell the speed
        if (L.speed > 12) ctx.fillRect(s.x - s.r / 2, s.y, s.r, s.r * 5);
        else { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
      }
    }
  }
}
