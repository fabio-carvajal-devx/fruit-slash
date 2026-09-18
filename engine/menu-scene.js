/* --------------------------------------------------------------
   The cabinet backdrop: a synthwave horizon behind the catalogue.
   Purely ambient — it has no rules and never reads input.
   -------------------------------------------------------------- */
import { Scene } from './scene.js';
import { TAU, rand } from './util.js';

export class MenuScene extends Scene {
  constructor() {
    super();
    this.t = 0;
    this.wantsBlades = false;
    this.stars = Array.from({ length: 70 }, () => ({
      x: rand(0, 1), y: rand(0, 1), r: rand(.18, .55), tw: rand(0, TAU)
    }));
  }

  ambient(dt) { this.t += dt; }
  step(dt) { this.t += dt; }

  draw(ctx) {
    const { w, h } = this.view;
    const horizon = h * 0.62;

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#120a35');
    sky.addColorStop(.45, '#3b1a63');
    sky.addColorStop(.62, '#7a2b6d');
    sky.addColorStop(.63, '#120b2e');
    sky.addColorStop(1, '#05060f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // stars, above the horizon only
    for (const s of this.stars) {
      const y = s.y * horizon * .92;
      ctx.globalAlpha = .35 + Math.sin(this.t * 1.6 + s.tw) * .3;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x * w, y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // sun, banded by the classic scanline gaps
    const cx = w / 2, cy = horizon - h * .04, r = h * .17;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    sun.addColorStop(0, '#ffe45e'); sun.addColorStop(.5, '#ff8a5c'); sun.addColorStop(1, '#ff2e8a');
    ctx.fillStyle = sun; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#120b2e';
    for (let i = 0; i < 7; i++) {
      const y = cy + r * (i / 7) * .95;
      ctx.fillRect(cx - r, y, r * 2, r * (0.012 + i * 0.012));
    }
    ctx.restore();

    const halo = ctx.createRadialGradient(cx, cy, r * .7, cx, cy, r * 2.6);
    halo.addColorStop(0, 'rgba(255,90,150,.28)'); halo.addColorStop(1, 'rgba(255,90,150,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, r * 2.6, 0, TAU); ctx.fill();

    // perspective grid rolling toward the viewer
    ctx.strokeStyle = 'rgba(120,235,255,.42)';
    ctx.lineWidth = .22;
    for (let i = -9; i <= 9; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * (w * .055), horizon);
      ctx.lineTo(cx + i * (w * .52), h + 2);
      ctx.stroke();
    }
    const scroll = (this.t * .38) % 1;
    for (let i = 0; i < 16; i++) {
      const k = (i + scroll) / 16;
      const y = horizon + (h - horizon) * (k * k);
      if (y > h) continue;
      ctx.globalAlpha = .18 + k * .5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(6,8,24,.28)';
    ctx.fillRect(0, 0, w, h);
  }

  overlay() {}
}
