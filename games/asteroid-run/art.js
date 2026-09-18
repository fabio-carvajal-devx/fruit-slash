/* Vector art for Asteroid Run. Same rules as the rest of the cabinet:
   canvas paths only, sized in units, nothing sampled. */
import { TAU, rand } from '../../engine/util.js';

const cache = new Map();
const grad = (ctx, key, make) => {
  let g = cache.get(key);
  if (!g) { g = make(ctx); cache.set(key, g); }
  return g;
};

/** A lumpy silhouette, generated once per rock so each looks different. */
export function rockShape(points = 11) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * TAU;
    pts.push([a, rand(.74, 1.06)]);
  }
  return pts;
}

export function drawRock(ctx, r, shape, craters) {
  ctx.fillStyle = grad(ctx, 'rock', c => {
    const g = c.createRadialGradient(-.35, -.4, .05, 0, 0, 1.05);
    g.addColorStop(0, '#9aa0b4'); g.addColorStop(.55, '#5d6274'); g.addColorStop(1, '#2b2f3d');
    return g;
  });
  ctx.save();
  ctx.scale(r, r);
  ctx.beginPath();
  shape.forEach(([a, k], i) => {
    const x = Math.cos(a) * k, y = Math.sin(a) * k;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  for (const [cx, cy, cr] of craters) {
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.beginPath(); ctx.ellipse(-.34, -.4, .34, .22, -.7, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = r * .06;
  ctx.beginPath();
  shape.forEach(([a, k], i) => {
    const x = Math.cos(a) * k * r, y = Math.sin(a) * k * r;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
}

/** Nose points up (-y). `thrust` 0..1 drives the flame. */
export function drawShip(ctx, r, thrust, t, tilt) {
  ctx.save();
  ctx.rotate(tilt * 0.34);

  // flame first, so the hull sits on top of it
  const flick = 0.75 + Math.sin(t * 34) * 0.25;
  const len = r * (1.1 + thrust * 0.9) * flick;
  const flame = ctx.createLinearGradient(0, r * .6, 0, r * .6 + len);
  flame.addColorStop(0, 'rgba(255,240,180,.95)');
  flame.addColorStop(.45, 'rgba(255,150,60,.75)');
  flame.addColorStop(1, 'rgba(255,60,120,0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-r * .30, r * .6);
  ctx.quadraticCurveTo(0, r * .6 + len * 1.15, r * .30, r * .6);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#ff5c8a';                         // fins
  ctx.beginPath();
  ctx.moveTo(-r * .34, r * .05); ctx.lineTo(-r * 1.02, r * .78); ctx.lineTo(-r * .30, r * .70);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * .34, r * .05); ctx.lineTo(r * 1.02, r * .78); ctx.lineTo(r * .30, r * .70);
  ctx.closePath(); ctx.fill();

  const hull = ctx.createLinearGradient(-r * .5, 0, r * .5, 0);
  hull.addColorStop(0, '#c9d6ea'); hull.addColorStop(.42, '#ffffff'); hull.addColorStop(1, '#8ea4c4');
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.15);
  ctx.quadraticCurveTo(r * .52, -r * .2, r * .44, r * .72);
  ctx.lineTo(-r * .44, r * .72);
  ctx.quadraticCurveTo(-r * .52, -r * .2, 0, -r * 1.15);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#16264f';
  ctx.beginPath(); ctx.arc(0, -r * .3, r * .28, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#bfe3ff'; ctx.lineWidth = r * .09;
  ctx.beginPath(); ctx.arc(0, -r * .3, r * .28, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(-r * .1, -r * .4, r * .1, r * .06, -.6, 0, TAU); ctx.fill();

  ctx.restore();
}

export function drawShield(ctx, r, t, strength) {
  const pulse = 1 + Math.sin(t * 7) * .04;
  const g = ctx.createRadialGradient(0, 0, r * 1.1, 0, 0, r * 1.75 * pulse);
  g.addColorStop(0, 'rgba(120,230,255,0)');
  g.addColorStop(.75, `rgba(120,230,255,${.20 * strength})`);
  g.addColorStop(1, `rgba(160,120,255,${.42 * strength})`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.75 * pulse, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(190,240,255,${.7 * strength})`;
  ctx.lineWidth = r * .07;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.7 * pulse, 0, TAU); ctx.stroke();
}

/** Collectible energy cell. */
export function drawCell(ctx, r, t) {
  const pulse = 1 + Math.sin(t * 5) * .07;
  ctx.save(); ctx.scale(pulse, pulse);
  const halo = ctx.createRadialGradient(0, 0, r * .4, 0, 0, r * 2.4);
  halo.addColorStop(0, 'rgba(125,255,190,.5)'); halo.addColorStop(1, 'rgba(125,255,190,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, TAU); ctx.fill();

  ctx.fillStyle = '#7dffb0';
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.25); ctx.lineTo(r * .8, 0); ctx.lineTo(0, r * 1.25); ctx.lineTo(-r * .8, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  ctx.moveTo(0, -r * .7); ctx.lineTo(r * .34, 0); ctx.lineTo(0, r * .7); ctx.lineTo(-r * .34, 0);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export const POWERS = {
  shield: { id: 'shield', r: 4.6, tint: '#8fd4ff', label: 'SHIELD!', glyph: 'shield' },
  slow:   { id: 'slow',   r: 4.6, tint: '#a8f0ff', label: 'SLOW-MO!', glyph: 'slow' },
  double: { id: 'double', r: 4.6, tint: '#ffd447', label: 'DOUBLE!', glyph: 'x2' },
  time:   { id: 'time',   r: 4.4, tint: '#7dffb0', label: '+10 SEC!', glyph: 'clock' }
};

export function drawPower(ctx, kind, r, t) {
  const p = POWERS[kind];
  const pulse = 1 + Math.sin(t * 6) * .05;
  ctx.save(); ctx.scale(pulse, pulse);

  const halo = ctx.createRadialGradient(0, 0, r * .6, 0, 0, r * 2);
  halo.addColorStop(0, p.tint + 'aa'); halo.addColorStop(1, p.tint + '00');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, TAU); ctx.fill();

  const orb = ctx.createRadialGradient(-r * .3, -r * .38, r * .06, 0, 0, r * 1.05);
  orb.addColorStop(0, '#ffffff'); orb.addColorStop(.35, p.tint); orb.addColorStop(1, '#101a3a');
  ctx.fillStyle = orb;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  ctx.lineWidth = r * .15; ctx.lineCap = 'round';
  const s = r * .58;
  if (p.glyph === 'shield') {
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * .8, -s * .45); ctx.lineTo(s * .8, s * .2);
    ctx.quadraticCurveTo(s * .8, s, 0, s * 1.1);
    ctx.quadraticCurveTo(-s * .8, s, -s * .8, s * .2);
    ctx.lineTo(-s * .8, -s * .45); ctx.closePath(); ctx.fill();
  } else if (p.glyph === 'slow') {
    ctx.beginPath(); ctx.arc(0, 0, s * .8, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * .35, -s * .35); ctx.lineTo(-s * .35, s * .35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * .35, -s * .35); ctx.lineTo(s * .35, s * .35); ctx.stroke();
  } else if (p.glyph === 'clock') {
    ctx.beginPath(); ctx.arc(0, 0, s * .8, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * .45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * .36, s * .12); ctx.stroke();
  } else {
    ctx.font = `900 ${r * 1.05}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('x2', 0, r * .06);
  }
  ctx.restore();
}

/* ---------------- combat ---------------- */

export function drawBullet(ctx, r) {
  const g = ctx.createLinearGradient(0, -r * 3, 0, r * 1.5);
  g.addColorStop(0, 'rgba(180,255,255,0)');
  g.addColorStop(.45, '#bffcff');
  g.addColorStop(1, '#4fd8ff');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -r * .8, r * .55, r * 2.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.beginPath(); ctx.arc(0, -r * 1.2, r * .34, 0, TAU); ctx.fill();
}

/** Enemy fire. Drawn with a tail along its own heading so a glance tells
    you both that it is incoming and exactly where it is going. */
export function drawEnemyShot(ctx, r, t) {
  const pulse = 1 + Math.sin(t * 16) * .14;

  const tail = ctx.createLinearGradient(0, -r * 5.5, 0, r * .5);
  tail.addColorStop(0, 'rgba(255,90,200,0)');
  tail.addColorStop(.65, 'rgba(255,90,200,.28)');
  tail.addColorStop(1, 'rgba(255,150,225,.55)');
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(-r * .55, 0);
  ctx.quadraticCurveTo(0, -r * 6.5, r * .55, 0);
  ctx.closePath(); ctx.fill();

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2 * pulse);
  g.addColorStop(0, 'rgba(255,140,220,.9)');
  g.addColorStop(.5, 'rgba(220,60,200,.55)');
  g.addColorStop(1, 'rgba(160,20,180,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r * 2.2 * pulse, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd9f4';
  ctx.beginPath(); ctx.arc(0, 0, r * .6, 0, TAU); ctx.fill();
}

/** A saucer. Original shape — dome, hull, running lights. */
export function drawAlien(ctx, r, t, tint = '#9dff8a', charge = 0) {
  const blink = (Math.sin(t * 5) + 1) / 2;

  const glow = ctx.createRadialGradient(0, r * .3, r * .2, 0, r * .3, r * 2.2);
  glow.addColorStop(0, `${tint}55`); glow.addColorStop(1, `${tint}00`);
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(0, r * .3, r * 2.2, r * 1.3, 0, 0, TAU); ctx.fill();

  const dome = ctx.createRadialGradient(-r * .2, -r * .5, r * .05, 0, -r * .2, r * .8);
  dome.addColorStop(0, '#ffffff'); dome.addColorStop(.5, tint); dome.addColorStop(1, '#1d4a32');
  ctx.fillStyle = dome;
  ctx.beginPath(); ctx.ellipse(0, -r * .18, r * .56, r * .56, 0, Math.PI, TAU); ctx.fill();

  const hull = ctx.createLinearGradient(0, -r * .2, 0, r * .5);
  hull.addColorStop(0, '#dfe6f2'); hull.addColorStop(.5, '#8d98ad'); hull.addColorStop(1, '#414a5e');
  ctx.fillStyle = hull;
  ctx.beginPath(); ctx.ellipse(0, r * .05, r, r * .36, 0, 0, TAU); ctx.fill();

  ctx.fillStyle = `rgba(255,120,200,${.4 + blink * .6})`;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.arc(i * r * .34, r * .16, r * .09, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = r * .06;
  ctx.beginPath(); ctx.ellipse(0, r * .05, r, r * .36, 0, 0, TAU); ctx.stroke();

  // charging telegraph: the shot is always announced before it exists
  if (charge > 0) {
    const k = charge * charge;
    const g = ctx.createRadialGradient(0, r * .45, 0, 0, r * .45, r * (.35 + k * .9));
    g.addColorStop(0, `rgba(255,190,240,${.5 + k * .5})`);
    g.addColorStop(1, 'rgba(255,90,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, r * .45, r * (.35 + k * .9), 0, TAU); ctx.fill();
  }
}

/** The mothership. Same language as the saucer, four times the mass. */
export function drawBoss(ctx, r, t, hurt, charge = 0) {
  const blink = (Math.sin(t * 3) + 1) / 2;

  const glow = ctx.createRadialGradient(0, r * .2, r * .3, 0, r * .2, r * 2);
  glow.addColorStop(0, 'rgba(255,80,190,.35)'); glow.addColorStop(1, 'rgba(255,80,190,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(0, r * .2, r * 2, r * 1.1, 0, 0, TAU); ctx.fill();

  const hull = ctx.createLinearGradient(0, -r * .5, 0, r * .6);
  hull.addColorStop(0, hurt > 0 ? '#ffd9e6' : '#cfd8ea');
  hull.addColorStop(.45, hurt > 0 ? '#ff9ec2' : '#6d76a0');
  hull.addColorStop(1, '#2c3348');
  ctx.fillStyle = hull;
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * .42, 0, 0, TAU); ctx.fill();

  ctx.fillStyle = '#39406090';
  ctx.beginPath(); ctx.ellipse(0, r * .12, r * .8, r * .2, 0, 0, TAU); ctx.fill();

  const dome = ctx.createRadialGradient(-r * .15, -r * .45, r * .04, 0, -r * .2, r * .7);
  dome.addColorStop(0, '#fff'); dome.addColorStop(.45, '#ff7ad1'); dome.addColorStop(1, '#4a1350');
  ctx.fillStyle = dome;
  ctx.beginPath(); ctx.ellipse(0, -r * .12, r * .48, r * .5, 0, Math.PI, TAU); ctx.fill();

  ctx.fillStyle = `rgba(255,220,120,${.35 + blink * .5})`;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.arc(i * r * .26, r * .2, r * .07, 0, TAU); ctx.fill();
  }

  // the gun port, so the player can read where shots come from — and it
  // lights up before it fires, so the spread is never a surprise
  ctx.fillStyle = '#ff5c8a';
  ctx.beginPath(); ctx.ellipse(0, r * .38, r * .18, r * .12, 0, 0, TAU); ctx.fill();
  if (charge > 0) {
    const k = charge * charge;
    const g = ctx.createRadialGradient(0, r * .42, 0, 0, r * .42, r * (.2 + k * .75));
    g.addColorStop(0, `rgba(255,210,245,${.55 + k * .45})`);
    g.addColorStop(1, 'rgba(255,90,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, r * .42, r * (.2 + k * .75), 0, TAU); ctx.fill();
  }

  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = r * .04;
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * .42, 0, 0, TAU); ctx.stroke();
}
