/* --------------------------------------------------------------
   Deep space, in zones.

   Three star layers that look like stars — small, dim, round, with
   only a handful bright enough to twinkle. No streaks: a field of
   moving dashes reads as rain, not distance, and it fights the
   gameplay for attention.

   Every twenty-odd seconds the ship flies into a new region. The
   region's landmark drifts down through the parallax while the sky
   cross-fades behind it, so the change is something you fly past
   rather than something that cuts.
   -------------------------------------------------------------- */
import { TAU, rand, randInt, clamp } from '../../engine/util.js';

const LAYERS = [
  { n: 54, speed: 2.4, r: [.09, .17], alpha: .30 },
  { n: 30, speed: 6.0, r: [.14, .24], alpha: .50 },
  { n: 14, speed: 13.0, r: [.20, .34], alpha: .78, shinyEvery: 4 }
];

/* Each zone is a sky and one landmark. */
export const ZONES = [
  { id: 'sun',    sky: ['#1a1030', '#3c2050', '#5e2c3e'], haze: ['rgba(255,150,80,.16)', 'rgba(255,90,140,.10)'], feature: 'sun' },
  { id: 'dark',   sky: ['#04050d', '#080a18', '#0b0d1f'], haze: ['rgba(40,60,120,.10)'], feature: 'none' },
  { id: 'fluo',   sky: ['#03181a', '#0a3142', '#06222e'], haze: ['rgba(40,255,210,.16)', 'rgba(60,200,255,.12)'], feature: 'fluo' },
  { id: 'nebula', sky: ['#14082a', '#35124d', '#1a0b30'], haze: ['rgba(255,70,180,.16)', 'rgba(140,60,255,.14)'], feature: 'nebula' },
  { id: 'hole',   sky: ['#050510', '#0b0820', '#05050e'], haze: ['rgba(120,80,255,.12)'], feature: 'hole' }
];

const ZONE_EVERY = [19, 27];    // seconds between regions
const FADE_TIME = 6;            // seconds of sky cross-fade

function paintSky(cv, zone, view) {
  const { pw, ph } = view;
  cv.width = pw; cv.height = ph;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, ph);
  g.addColorStop(0, zone.sky[0]);
  g.addColorStop(.55, zone.sky[1]);
  g.addColorStop(1, zone.sky[2]);
  c.fillStyle = g; c.fillRect(0, 0, pw, ph);

  zone.haze.forEach((col, i) => {
    const x = (i ? .78 : .24) * pw, y = (i ? .66 : .28) * ph;
    const rad = c.createRadialGradient(x, y, 0, x, y, (i ? .44 : .52) * Math.max(pw, ph));
    rad.addColorStop(0, col); rad.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rad; c.fillRect(0, 0, pw, ph);
  });
}

export class Background {
  constructor() {
    this.t = 0;
    this.layers = [];
    this.features = [];
    this.zone = randInt(0, ZONES.length - 1);
    this.pending = null;
    this.fade = 1;
    this.nextZoneIn = 12;
    this.skyA = document.createElement('canvas');
    this.skyB = document.createElement('canvas');
  }

  resize(view) {
    const { w, h } = view;
    this.w = w; this.h = h; this.view = view;

    this.layers = LAYERS.map(L => ({
      ...L,
      stars: Array.from({ length: L.n }, (_, i) => ({
        x: rand(0, w), y: rand(0, h), r: rand(L.r[0], L.r[1]),
        shiny: L.shinyEvery ? i % L.shinyEvery === 0 : false,
        tw: rand(0, TAU)
      }))
    }));

    paintSky(this.skyA, ZONES[this.zone], view);
    if (this.pending !== null) paintSky(this.skyB, ZONES[this.pending], view);
  }

  /** Send in the next region's landmark, and start the sky cross-fade. */
  beginZone() {
    let next = this.zone;
    while (next === this.zone) next = randInt(0, ZONES.length - 1);
    this.pending = next;
    this.fade = 0;
    if (this.view) paintSky(this.skyB, ZONES[next], this.view);

    const kind = ZONES[next].feature;
    if (kind !== 'none') {
      this.features.push({
        kind,
        x: rand(this.w * .18, this.w * .82),
        y: -this.h * .42,
        r: this.h * rand(.17, .26),
        depth: rand(.22, .42),          // slower than the stars: it is far away
        spin: rand(0, TAU),
        vr: rand(-.05, .05)
      });
    }
  }

  update(dt, speed = 1) {
    this.t += dt;

    this.nextZoneIn -= dt;
    if (this.nextZoneIn <= 0 && this.pending === null) {
      this.beginZone();
      this.nextZoneIn = rand(ZONE_EVERY[0], ZONE_EVERY[1]);
    }

    if (this.pending !== null) {
      this.fade = Math.min(1, this.fade + dt / FADE_TIME);
      if (this.fade >= 1) {
        this.zone = this.pending;
        this.pending = null;
        const tmp = this.skyA; this.skyA = this.skyB; this.skyB = tmp;
      }
    }

    for (const L of this.layers) {
      for (const s of L.stars) {
        s.y += L.speed * speed * dt;
        if (s.y > this.h + 1) { s.y = -1; s.x = rand(0, this.w); }
      }
    }

    for (let i = this.features.length - 1; i >= 0; i--) {
      const f = this.features[i];
      f.y += 9 * f.depth * speed * dt;
      f.spin += f.vr * dt;
      if (f.y - f.r > this.h + this.h * .5) this.features.splice(i, 1);
    }
  }

  draw(ctx, view) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.skyA, 0, 0);
    if (this.pending !== null) {
      ctx.globalAlpha = this.fade;
      ctx.drawImage(this.skyB, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    for (const f of this.features) this.drawFeature(ctx, f);

    for (const L of this.layers) {
      for (const s of L.stars) {
        if (s.shiny) {
          const tw = .65 + Math.sin(this.t * 2.2 + s.tw) * .35;
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 7);
          g.addColorStop(0, `rgba(255,255,255,${.55 * tw})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 7, 0, TAU); ctx.fill();

          ctx.strokeStyle = `rgba(255,255,255,${.45 * tw})`;
          ctx.lineWidth = s.r * .5;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r * 3.4, s.y); ctx.lineTo(s.x + s.r * 3.4, s.y);
          ctx.moveTo(s.x, s.y - s.r * 3.4); ctx.lineTo(s.x, s.y + s.r * 3.4);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(255,255,255,${L.alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }
    }
  }

  /* ---------------------- landmarks ---------------------- */
  drawFeature(ctx, f) {
    const edge = clamp(1 - Math.abs(f.y) / (this.h * 1.3), 0, 1);   // fade in and out
    ctx.save();
    ctx.globalAlpha = edge;
    ctx.translate(f.x, f.y);

    if (f.kind === 'sun') {
      const halo = ctx.createRadialGradient(0, 0, f.r * .5, 0, 0, f.r * 3);
      halo.addColorStop(0, 'rgba(255,190,110,.34)');
      halo.addColorStop(.5, 'rgba(255,110,70,.14)');
      halo.addColorStop(1, 'rgba(255,90,60,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, f.r * 3, 0, TAU); ctx.fill();

      const disc = ctx.createRadialGradient(-f.r * .25, -f.r * .3, f.r * .05, 0, 0, f.r);
      disc.addColorStop(0, '#fffbe8'); disc.addColorStop(.55, '#ffd166'); disc.addColorStop(1, '#ff7a3d');
      ctx.fillStyle = disc;
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, TAU); ctx.fill();

      ctx.globalAlpha = edge * .5;
      ctx.strokeStyle = 'rgba(255,200,120,.5)';
      ctx.lineWidth = f.r * .04;
      for (let i = 0; i < 12; i++) {
        const a = f.spin + i * TAU / 12;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * f.r * 1.15, Math.sin(a) * f.r * 1.15);
        ctx.lineTo(Math.cos(a) * f.r * 1.7, Math.sin(a) * f.r * 1.7);
        ctx.stroke();
      }

    } else if (f.kind === 'fluo') {
      for (let i = 0; i < 4; i++) {
        const a = f.spin + i * 1.9;
        const cx = Math.cos(a) * f.r * .5, cy = Math.sin(a) * f.r * .35;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, f.r * (1.1 + i * .2));
        g.addColorStop(0, i % 2 ? 'rgba(70,255,210,.30)' : 'rgba(90,200,255,.26)');
        g.addColorStop(1, 'rgba(20,120,140,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, f.r * (1.1 + i * .2), 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(210,255,245,.5)';
      for (let i = 0; i < 9; i++) {
        const a = f.spin * 2 + i * .7, d = f.r * (.25 + (i % 4) * .22);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d * .7, f.r * .022, 0, TAU);
        ctx.fill();
      }

    } else if (f.kind === 'nebula') {
      for (let i = 0; i < 5; i++) {
        const a = f.spin + i * 1.3;
        const cx = Math.cos(a) * f.r * .6, cy = Math.sin(a) * f.r * .45;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, f.r * (1.2 + i * .22));
        g.addColorStop(0, i % 2 ? 'rgba(255,80,190,.22)' : 'rgba(150,70,255,.20)');
        g.addColorStop(1, 'rgba(60,20,90,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, f.r * (1.2 + i * .22), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = edge * .5;          // dust lanes
      ctx.fillStyle = 'rgba(20,6,34,.7)';
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(f.spin + i * 1.1);
        ctx.beginPath();
        ctx.ellipse(0, f.r * .2 * i, f.r * 1.2, f.r * .10, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

    } else if (f.kind === 'hole') {
      // the void swallows the light around it before anything else reads
      const dark = ctx.createRadialGradient(0, 0, f.r * .8, 0, 0, f.r * 3.4);
      dark.addColorStop(0, 'rgba(0,0,0,.92)');
      dark.addColorStop(.45, 'rgba(0,0,0,.55)');
      dark.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(0, 0, f.r * 3.4, 0, TAU); ctx.fill();

      ctx.save();
      ctx.rotate(f.spin * 3);
      for (const [k, col, wdt] of [[2.05, 'rgba(255,150,60,.34)', .30],
                                   [1.70, 'rgba(255,90,170,.40)', .20],
                                   [1.45, 'rgba(180,140,255,.45)', .12]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = f.r * wdt;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.r * k, f.r * k * .30, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(0, 0, f.r * .72, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,180,.75)';
      ctx.lineWidth = f.r * .05;
      ctx.beginPath(); ctx.arc(0, 0, f.r * .76, 0, TAU); ctx.stroke();
    }

    ctx.restore();
  }
}
