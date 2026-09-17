/* --------------------------------------------------------------
   Parallax night-garden background.
   Five depth planes, each panning at its own rate, plus ambient
   petals and lanterns so the scene is never still. Everything is
   vector; the only cached bitmap is the flat sky gradient.
   -------------------------------------------------------------- */
import { TAU, rand, lerp, clamp } from '../../engine/util.js';

const RIDGES = [
  { depth: 0.06, y: 0.56, amp: 0.10, col: '#241a5c' },
  { depth: 0.12, y: 0.68, amp: 0.09, col: '#1c1548' },
  { depth: 0.22, y: 0.80, amp: 0.08, col: '#141035' }
];

export class Background {
  constructor() {
    this.sky = document.createElement('canvas');
    this.pan = 0;
    this.tilt = 0; this.tiltTarget = 0;
    this.t = 0;
    this.lanterns = [];
    this.petals = [];
    this.paths = [];

    // subtle tilt parallax on devices that report orientation
    addEventListener('deviceorientation', e => {
      if (e.gamma == null) return;
      this.tiltTarget = clamp(e.gamma / 45, -1, 1);
    }, true);
  }

  resize(view) {
    const { pw, ph, w, h } = view;
    this.w = w; this.h = h;

    const c = this.sky.getContext('2d');
    this.sky.width = pw; this.sky.height = ph;
    const g = c.createLinearGradient(0, 0, 0, ph);
    g.addColorStop(0, '#120a35');
    g.addColorStop(.42, '#2b1a6e');
    g.addColorStop(.72, '#3b2a7d');
    g.addColorStop(1, '#0e1338');
    c.fillStyle = g; c.fillRect(0, 0, pw, ph);

    // moon + haze
    const mx = pw * .78, my = ph * .20, mr = Math.min(pw, ph) * .09;
    const halo = c.createRadialGradient(mx, my, mr * .4, mx, my, mr * 6);
    halo.addColorStop(0, 'rgba(255,240,200,.30)');
    halo.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(mx, my, mr * 6, 0, TAU); c.fill();
    const moon = c.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr);
    moon.addColorStop(0, '#fffdf2'); moon.addColorStop(1, '#ffe9a8');
    c.fillStyle = moon; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();

    // stars
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * pw, y = Math.random() * ph * .6;
      c.globalAlpha = rand(.15, .75);
      c.beginPath(); c.arc(x, y, rand(.6, 1.7) * view.dpr, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;

    // ridge silhouettes, generated once per size
    this.paths = RIDGES.map(r => {
      const pts = [];
      const span = w * 1.6, n = 26;
      let phase = rand(0, TAU);
      for (let i = 0; i <= n; i++) {
        const x = -w * .3 + (span * i) / n;
        const y = h * r.y - Math.sin(phase + i * .55) * h * r.amp * .5
                          - Math.sin(phase * 1.7 + i * .22) * h * r.amp * .5;
        pts.push([x, y]);
      }
      return pts;
    });

    this.lanterns = Array.from({ length: 7 }, () => ({
      x: rand(0, w), y: rand(0, h), r: rand(1.1, 2.4),
      sp: rand(1.2, 3.0), ph: rand(0, TAU), depth: rand(.3, .6)
    }));

    this.petals = Array.from({ length: 26 }, () => ({
      x: rand(0, w), y: rand(0, h), r: rand(.5, 1.15),
      vy: rand(2.2, 5.5), vx: rand(-2.2, -.4),
      rot: rand(0, TAU), vr: rand(-1.6, 1.6), ph: rand(0, TAU)
    }));
  }

  update(dt) {
    this.t += dt;
    this.pan = Math.sin(this.t * .09) * 1.0;
    this.tilt = lerp(this.tilt, this.tiltTarget, 1 - Math.pow(.001, dt));

    const { w, h } = this;
    for (const l of this.lanterns) {
      l.y -= l.sp * dt;
      l.x += Math.sin(this.t * .5 + l.ph) * dt * 1.6;
      if (l.y < -4) { l.y = h + 4; l.x = rand(0, w); }
    }
    for (const p of this.petals) {
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(this.t * 1.1 + p.ph) * 2.4) * dt;
      p.rot += p.vr * dt;
      if (p.y > h + 3) { p.y = -3; p.x = rand(-5, w + 5); }
      if (p.x < -5) p.x = w + 4;
    }
  }

  /** offset in units for a plane at the given depth */
  shift(depth) { return (this.pan + this.tilt * 4) * depth * 6; }

  draw(ctx, view) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.sky, 0, 0);
    ctx.restore();

    const { w, h } = this;

    // ridges
    RIDGES.forEach((r, i) => {
      const pts = this.paths[i];
      if (!pts) return;
      const dx = this.shift(r.depth);
      ctx.fillStyle = r.col;
      ctx.beginPath();
      ctx.moveTo(pts[0][0] + dx, pts[0][1]);
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k];
        ctx.quadraticCurveTo(a[0] + dx, a[1], (a[0] + b[0]) / 2 + dx, (a[1] + b[1]) / 2);
      }
      ctx.lineTo(w + 20, h + 20); ctx.lineTo(-20, h + 20);
      ctx.closePath(); ctx.fill();
    });

    // lanterns
    for (const l of this.lanterns) {
      const x = l.x + this.shift(l.depth), y = l.y;
      const g = ctx.createRadialGradient(x, y, 0, x, y, l.r * 5);
      g.addColorStop(0, 'rgba(255,196,110,.28)');
      g.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, l.r * 5, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,226,170,.55)';
      ctx.beginPath(); ctx.arc(x, y, l.r, 0, TAU); ctx.fill();
    }

    // petals drift closest to the player
    ctx.fillStyle = 'rgba(255,190,215,.55)';
    for (const p of this.petals) {
      ctx.save();
      ctx.translate(p.x + this.shift(.9), p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * .5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // a soft scrim so fruit always reads louder than the scenery
    ctx.fillStyle = 'rgba(8,10,30,.20)';
    ctx.fillRect(0, 0, w, h);

    // foreground foliage frames the play area without covering it
    const dxf = this.shift(1.2);
    ctx.fillStyle = 'rgba(6,8,24,.85)';
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s < 0 ? dxf : w - dxf, h);
      ctx.scale(s, 1);
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.quadraticCurveTo(w * .10, -h * .10, w * .22, -h * .04);
      ctx.quadraticCurveTo(w * .12, h * .02, 0, 6);
      ctx.fill();
      ctx.restore();
    }
  }
}
