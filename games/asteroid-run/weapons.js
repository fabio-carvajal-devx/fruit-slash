/* --------------------------------------------------------------
   Weapons. Picked up exactly like the other items, held for a while,
   then the ship falls back to its default bolt. Each one changes how
   firing behaves AND how it looks, so the swap is obvious mid-fight
   without reading anything.
   -------------------------------------------------------------- */
import { TAU } from '../../engine/util.js';

export const WEAPONS = {
  bolt: {
    id: 'bolt', name: 'BOLT', color: '#bffcff', core: '#ffffff',
    cd: 0.20, width: 1.2, pierce: false,
    shots: [{ a: 0, ox: 0 }]
  },
  twin: {
    id: 'twin', name: 'TWIN', color: '#9dff8a', core: '#f2ffe8',
    cd: 0.17, width: 1.0, pierce: false,
    shots: [{ a: 0, ox: -1.7 }, { a: 0, ox: 1.7 }]
  },
  spread: {
    id: 'spread', name: 'SPREAD', color: '#ffd447', core: '#fff6d0',
    cd: 0.28, width: 1.1, pierce: false,
    shots: [{ a: -0.30, ox: -1.2 }, { a: 0, ox: 0 }, { a: 0.30, ox: 1.2 }]
  },
  beam: {
    id: 'beam', name: 'BEAM', color: '#ff7ad1', core: '#ffe6f7',
    cd: 0.06, width: 0.8, pierce: true,
    shots: [{ a: 0, ox: 0 }]
  }
};

export const DEFAULT_WEAPON = 'bolt';
export const WEAPON_TIME = 14;          // seconds before it reverts

/** The projectile itself, drawn in its weapon's colours. */
export function drawShot(ctx, w, r) {
  const g = ctx.createLinearGradient(0, -r * 3, 0, r * 1.5);
  g.addColorStop(0, w.color + '00');
  g.addColorStop(.45, w.color);
  g.addColorStop(1, w.color + 'cc');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -r * .8, r * .55, r * (w.pierce ? 3.4 : 2.2), 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = w.core;
  ctx.beginPath(); ctx.arc(0, -r * 1.2, r * .34, 0, TAU); ctx.fill();
}

/** The floating pickup, with a glyph that mirrors the firing pattern. */
export function drawWeaponOrb(ctx, key, r, t) {
  const w = WEAPONS[key];
  const pulse = 1 + Math.sin(t * 6) * .05;
  ctx.save();
  ctx.scale(pulse, pulse);

  const halo = ctx.createRadialGradient(0, 0, r * .6, 0, 0, r * 2);
  halo.addColorStop(0, w.color + 'aa'); halo.addColorStop(1, w.color + '00');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, TAU); ctx.fill();

  const orb = ctx.createRadialGradient(-r * .3, -r * .38, r * .06, 0, 0, r * 1.05);
  orb.addColorStop(0, '#ffffff'); orb.addColorStop(.35, w.color); orb.addColorStop(1, '#101a3a');
  ctx.fillStyle = orb;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

  // glyph: one arrow per barrel, angled the way that barrel fires
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
  ctx.lineWidth = r * (w.pierce ? .26 : .15); ctx.lineCap = 'round';
  const s = r * .56;
  for (const shot of w.shots) {
    ctx.save();
    ctx.rotate(shot.a);
    ctx.translate(shot.ox * r * .18, 0);
    ctx.beginPath(); ctx.moveTo(0, s * .8); ctx.lineTo(0, -s * .55); ctx.stroke();
    if (!w.pierce) {
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * .30, -s * .5); ctx.lineTo(-s * .30, -s * .5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Bottom-left readout: which gun is loaded and how long it lasts. */
export function drawWeaponHud(ctx, key, left, total, view) {
  const w = WEAPONS[key];
  const x = 3, y = view.h - 9, bw = 26, bh = 5.4;

  ctx.fillStyle = 'rgba(0,0,0,.42)';
  ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.fill();
  ctx.strokeStyle = w.color + '99'; ctx.lineWidth = .35;
  ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.stroke();

  ctx.font = '900 3px ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = w.color;
  ctx.fillText(w.name, x + 2.6, y + bh * .42);

  if (key !== DEFAULT_WEAPON) {
    const k = Math.max(0, Math.min(1, left / total));
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.roundRect(x + 2.4, y + bh - 1.5, bw - 4.8, .8, .4); ctx.fill();
    ctx.fillStyle = w.color;
    ctx.beginPath(); ctx.roundRect(x + 2.4, y + bh - 1.5, (bw - 4.8) * k, .8, .4); ctx.fill();
  }
}
