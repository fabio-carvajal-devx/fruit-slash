/* ---------------------------------------------------------------
   Vector fruit renderer.
   Every fruit is drawn with canvas paths + gradients, never a bitmap,
   so it stays crisp at any density and any tablet size.
   Sizes are in "units" (100 units = the short edge of the screen).
   --------------------------------------------------------------- */
import { TAU } from '../../engine/util.js';

const CUT_RY = 0.30;           // how open the cut face looks (perspective)
const gradCache = new Map();   // gradients are rebuilt only when the ctx changes

export function resetGradients() { gradCache.clear(); }

function grad(ctx, key, make) {
  let g = gradCache.get(key);
  if (!g) { g = make(ctx); gradCache.set(key, g); }
  return g;
}

function makeBall(ctx, id, r, c0, c1) {
  return grad(ctx, id + '|ball', c => {
    const g = c.createRadialGradient(-r * .34, -r * .40, r * .06, 0, 0, r * 1.06);
    g.addColorStop(0, c0); g.addColorStop(1, c1); return g;
  });
}

function makeFlesh(ctx, id, r, ry, c0, c1) {
  return grad(ctx, id + '|flesh', c => {
    const g = c.createRadialGradient(0, -ry * .2, r * .05, 0, 0, r);
    g.addColorStop(0, c0); g.addColorStop(1, c1); return g;
  });
}

function dots(ctx, n, rmax, size, color, seed) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i * 2.39996 + seed) % TAU;
    const d = Math.sqrt((i + .5) / n) * rmax;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, size, size * .78, a, 0, TAU);
    ctx.fill();
  }
}

/* ------------------------- definitions ------------------------- */
export const FRUITS = [
  {
    id: 'watermelon', r: 8.4, weight: 14, points: 10, juice: '#ff5d78',
    skin: ['#3fa34d', '#14532d'],
    flesh: ['#ff7a90', '#d92b47'],
    drawSkin(ctx, r) {
      ctx.strokeStyle = 'rgba(20,70,30,.75)'; ctx.lineWidth = r * .13; ctx.lineCap = 'round';
      for (let i = -3; i <= 3; i++) {
        const x = i * r * .27;
        ctx.beginPath();
        ctx.moveTo(x, -r); ctx.quadraticCurveTo(x * 1.55, 0, x, r);
        ctx.stroke();
      }
    },
    drawFlesh(ctx, r, ry) {
      ctx.fillStyle = '#f7f6d8';
      ctx.beginPath(); ctx.ellipse(0, 0, r * .93, ry * .93, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = makeFlesh(ctx, 'watermelon', r, ry, '#ff8fa3', '#d92b47');
      ctx.save(); ctx.scale(1, ry / r);
      ctx.beginPath(); ctx.arc(0, 0, r * .82, 0, TAU); ctx.fill();
      dots(ctx, 9, r * .62, r * .085, '#2a1a0c', 1.2);
      ctx.restore();
    }
  },
  {
    id: 'orange', r: 6.9, weight: 14, points: 10, juice: '#ffa32e',
    skin: ['#ffc247', '#e26a09'],
    flesh: ['#ffd88a', '#ff9f1c'],
    drawSkin(ctx, r) { ctx.globalAlpha = .18; dots(ctx, 34, r * .92, r * .05, '#7a3a00', .4); ctx.globalAlpha = 1; },
    drawFlesh(ctx, r, ry) {
      ctx.fillStyle = '#fff3d1';
      ctx.beginPath(); ctx.ellipse(0, 0, r * .94, ry * .94, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.scale(1, ry / r);
      ctx.fillStyle = makeFlesh(ctx, 'orange', r, ry, '#ffe0a3', '#ff9f1c');
      ctx.beginPath(); ctx.arc(0, 0, r * .84, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = r * .055;
      for (let i = 0; i < 9; i++) {
        const a = i * TAU / 9;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * .84, Math.sin(a) * r * .84); ctx.stroke();
      }
      ctx.restore();
    }
  },
  {
    id: 'apple', r: 6.6, weight: 13, points: 10, juice: '#ff6b6b',
    skin: ['#ff6b6b', '#98172b'],
    drawSkin(ctx, r) {
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      ctx.beginPath(); ctx.ellipse(-r * .1, r * .1, r * .62, r * .9, .3, 0, TAU); ctx.fill();
    },
    drawDeco(ctx, r) {
      ctx.strokeStyle = '#6b3f1d'; ctx.lineWidth = r * .1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -r * .82); ctx.quadraticCurveTo(r * .1, -r * 1.16, r * .3, -r * 1.2); ctx.stroke();
      ctx.fillStyle = '#4caf50';
      ctx.beginPath(); ctx.ellipse(r * .55, -r * 1.06, r * .32, r * .16, -.5, 0, TAU); ctx.fill();
    },
    drawFlesh(ctx, r, ry) {
      ctx.save(); ctx.scale(1, ry / r);
      ctx.fillStyle = makeFlesh(ctx, 'apple', r, ry, '#fffaf0', '#f0dcae');
      ctx.beginPath(); ctx.arc(0, 0, r * .92, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(190,150,80,.5)';
      ctx.beginPath(); ctx.ellipse(0, 0, r * .2, r * .3, 0, 0, TAU); ctx.fill();
      dots(ctx, 3, r * .18, r * .1, '#5b3a1a', .8);
      ctx.restore();
    }
  },
  {
    id: 'kiwi', r: 6.0, weight: 11, points: 10, juice: '#a8d94a',
    skin: ['#a0795a', '#4e3524'],
    drawSkin(ctx, r) { ctx.globalAlpha = .3; dots(ctx, 44, r * .95, r * .045, '#2d1d11', 2.1); ctx.globalAlpha = 1; },
    drawFlesh(ctx, r, ry) {
      ctx.fillStyle = '#7b5a3c';
      ctx.beginPath(); ctx.ellipse(0, 0, r * .96, ry * .96, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.scale(1, ry / r);
      ctx.fillStyle = makeFlesh(ctx, 'kiwi', r, ry, '#e6f7b8', '#7fb929');
      ctx.beginPath(); ctx.arc(0, 0, r * .86, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f6ffe0';
      ctx.beginPath(); ctx.arc(0, 0, r * .26, 0, TAU); ctx.fill();
      dots(ctx, 16, r * .64, r * .055, '#22301a', 1.7);
      ctx.restore();
    }
  },
  {
    id: 'lemon', r: 6.2, weight: 10, points: 10, juice: '#ffe04a',
    skin: ['#fff07a', '#e0a90b'],
    drawSkin(ctx, r) { ctx.globalAlpha = .2; dots(ctx, 26, r * .9, r * .05, '#8a6200', 3.3); ctx.globalAlpha = 1; },
    drawFlesh(ctx, r, ry) {
      ctx.fillStyle = '#fffbe0';
      ctx.beginPath(); ctx.ellipse(0, 0, r * .95, ry * .95, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.scale(1, ry / r);
      ctx.fillStyle = makeFlesh(ctx, 'lemon', r, ry, '#fff5b0', '#f2ce3a');
      ctx.beginPath(); ctx.arc(0, 0, r * .8, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = r * .06;
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * .8, Math.sin(a) * r * .8); ctx.stroke();
      }
      ctx.restore();
    }
  },
  {
    id: 'plum', r: 5.8, weight: 9, points: 10, juice: '#b567d6',
    skin: ['#b06ae0', '#4a1f63'],
    drawSkin(ctx, r) {
      ctx.strokeStyle = 'rgba(40,10,60,.5)'; ctx.lineWidth = r * .1;
      ctx.beginPath(); ctx.moveTo(-r * .1, -r); ctx.quadraticCurveTo(r * .22, 0, -r * .1, r); ctx.stroke();
    },
    drawFlesh(ctx, r, ry) {
      ctx.save(); ctx.scale(1, ry / r);
      ctx.fillStyle = makeFlesh(ctx, 'plum', r, ry, '#ffd36e', '#e0704f');
      ctx.beginPath(); ctx.arc(0, 0, r * .92, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6b3a20';
      ctx.beginPath(); ctx.ellipse(0, 0, r * .24, r * .34, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  },
  {
    id: 'strawberry', r: 5.6, weight: 10, points: 10, juice: '#ff4f6d',
    skin: ['#ff5f77', '#b3122f'],
    drawSkin(ctx, r) {
      ctx.globalAlpha = .85; dots(ctx, 18, r * .78, r * .055, '#ffe9a8', 1.9); ctx.globalAlpha = 1;
    },
    drawDeco(ctx, r) {
      ctx.fillStyle = '#38a34a';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * .42;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * .55, Math.sin(a) * r * .72, r * .34, r * .15, a, 0, TAU); ctx.fill();
      }
    },
    drawFlesh(ctx, r, ry) {
      ctx.save(); ctx.scale(1, ry / r);
      ctx.fillStyle = makeFlesh(ctx, 'strawberry', r, ry, '#fff0f2', '#ff8a9e');
      ctx.beginPath(); ctx.arc(0, 0, r * .92, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = r * .07;
      for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * .7, Math.sin(a) * r * .7); ctx.stroke();
      }
      ctx.restore();
    }
  },
  {
    id: 'dragon', r: 6.4, weight: 6, points: 15, juice: '#ff6fae',
    skin: ['#ff77b0', '#c01f6a'],
    drawDeco(ctx, r) {
      ctx.fillStyle = '#7fd14a';
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + .4;
        ctx.save(); ctx.rotate(a); ctx.translate(0, -r * .78);
        ctx.beginPath(); ctx.moveTo(0, -r * .35); ctx.quadraticCurveTo(r * .3, r * .1, 0, r * .3);
        ctx.quadraticCurveTo(-r * .3, r * .1, 0, -r * .35); ctx.fill(); ctx.restore();
      }
    },
    drawFlesh(ctx, r, ry) {
      ctx.save(); ctx.scale(1, ry / r);
      ctx.fillStyle = makeFlesh(ctx, 'dragon', r, ry, '#ffffff', '#f0e6ee');
      ctx.beginPath(); ctx.arc(0, 0, r * .9, 0, TAU); ctx.fill();
      dots(ctx, 26, r * .78, r * .055, '#2b2b2b', 2.7);
      ctx.restore();
    }
  }
];

export const FRUIT_BY_ID = Object.fromEntries(FRUITS.map(f => [f.id, f]));

/* ------------------------- power-ups ------------------------- */
export const POWERS = {
  freeze: { id: 'freeze', r: 6.0, tint: '#8fe4ff', label: 'FREEZE!',  juice: '#9fe8ff' },
  frenzy: { id: 'frenzy', r: 6.2, tint: '#ff7ad1', label: 'FRENZY!',  juice: '#ff8ad6' },
  double: { id: 'double', r: 6.0, tint: '#ffd447', label: 'DOUBLE!',  juice: '#ffd447' },
  time:   { id: 'time',   r: 5.8, tint: '#7dffb0', label: '+10 SEC!', juice: '#8cffbe' }
};

/* ------------------------- drawing ------------------------- */

function specular(ctx, r) {
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.ellipse(-r * .36, -r * .42, r * .26, r * .17, -.7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath();
  ctx.ellipse(r * .3, r * .38, r * .16, r * .1, -.7, 0, TAU);
  ctx.fill();
}

function rim(ctx, r) {
  ctx.strokeStyle = 'rgba(0,0,0,.22)';
  ctx.lineWidth = r * .07;
  ctx.beginPath(); ctx.arc(0, 0, r - r * .035, 0, TAU); ctx.stroke();
}

/** Whole fruit, centred at the current origin. */
export function drawFruit(ctx, def, r) {
  body(ctx, def, r);
  if (def.drawDeco) { ctx.save(); def.drawDeco(ctx, r); ctx.restore(); }
}

/** Skin + pattern + shading, clipped so no pattern ever leaks past the rind. */
function body(ctx, def, r) {
  ctx.fillStyle = makeBall(ctx, def.id, def.r, def.skin[0], def.skin[1]);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  if (def.drawSkin) {
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    def.drawSkin(ctx, r);
    ctx.restore();
  }
  rim(ctx, r);
  specular(ctx, r);
}

/** One half of a sliced fruit. Local frame: the cut runs along y = 0. */
export function drawHalf(ctx, def, r, side) {
  const ry = r * CUT_RY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-r * 1.3, side > 0 ? 0 : -r * 1.3, r * 2.6, r * 1.3);
  ctx.clip();

  body(ctx, def, r);
  if (def.drawDeco) { ctx.save(); def.drawDeco(ctx, r); ctx.restore(); }
  ctx.restore();

  // the cut surface itself — only the half inside the clip is visible
  ctx.save();
  ctx.beginPath();
  ctx.rect(-r * 1.3, side > 0 ? 0 : -r * 1.3, r * 2.6, r * 1.3);
  ctx.clip();
  if (def.drawFlesh) def.drawFlesh(ctx, r, ry);
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.lineWidth = r * .05;
  ctx.beginPath(); ctx.ellipse(0, 0, r * .97, ry * .97, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}

/** Bomb: matte sphere, red band, lit fuse. */
export function drawBomb(ctx, r, t) {
  ctx.fillStyle = grad(ctx, 'bomb|ball', c => {
    const g = c.createRadialGradient(-r * .35, -r * .42, r * .05, 0, 0, r * 1.1);
    g.addColorStop(0, '#5a5f70'); g.addColorStop(.55, '#22262f'); g.addColorStop(1, '#0a0c12');
    return g;
  });
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

  ctx.strokeStyle = '#e03131'; ctx.lineWidth = r * .2;
  ctx.beginPath(); ctx.arc(0, 0, r * .72, -.5, 2.2); ctx.stroke();

  ctx.fillStyle = '#3a3f4d';
  ctx.beginPath(); ctx.rect(-r * .17, -r * 1.16, r * .34, r * .34); ctx.fill();

  ctx.strokeStyle = '#c8a06a'; ctx.lineWidth = r * .1; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.1);
  ctx.quadraticCurveTo(r * .42, -r * 1.5, r * .16, -r * 1.78);
  ctx.stroke();

  const flick = .75 + Math.sin(t * 28) * .25;
  ctx.fillStyle = 'rgba(255,190,60,.95)';
  ctx.beginPath(); ctx.arc(r * .16, -r * 1.8, r * .22 * flick, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,220,.95)';
  ctx.beginPath(); ctx.arc(r * .16, -r * 1.82, r * .1 * flick, 0, TAU); ctx.fill();

  specular(ctx, r);
}

/** Power-up orbs: a glowing capsule with a vector glyph inside. */
export function drawPower(ctx, kind, r, t) {
  const p = POWERS[kind];
  const pulse = 1 + Math.sin(t * 6) * .04;

  ctx.save();
  ctx.scale(pulse, pulse);

  ctx.fillStyle = grad(ctx, 'halo|' + kind, c => {
    const g = c.createRadialGradient(0, 0, r * .6, 0, 0, r * 1.7);
    g.addColorStop(0, p.tint + 'aa'); g.addColorStop(1, p.tint + '00'); return g;
  });
  ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, TAU); ctx.fill();

  ctx.fillStyle = grad(ctx, 'orb|' + kind, c => {
    const g = c.createRadialGradient(-r * .3, -r * .38, r * .06, 0, 0, r * 1.05);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.35, p.tint); g.addColorStop(1, '#10203a');
    return g;
  });
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();

  ctx.save();
  ctx.rotate(Math.sin(t * 2) * .12);
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.strokeStyle = 'rgba(255,255,255,.95)';
  ctx.lineWidth = r * .14; ctx.lineCap = 'round';
  const s = r * .62;
  if (kind === 'freeze') {
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 3);
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * .55); ctx.lineTo(-s * .3, -s * .85); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * .55); ctx.lineTo(s * .3, -s * .85); ctx.stroke();
      ctx.restore();
    }
  } else if (kind === 'double') {
    ctx.font = `900 ${r * 1.05}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('x2', 0, r * .06);
  } else if (kind === 'time') {
    ctx.beginPath(); ctx.arc(0, 0, s * .82, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * .48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * .38, s * .14); ctx.stroke();
  } else { // frenzy — a star burst
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 ? s * .45 : s;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  specular(ctx, r);
  ctx.restore();
}
