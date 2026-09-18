export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp  = (a, b, t) => a + (b - a) * t;
export const rand  = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick  = arr => arr[(Math.random() * arr.length) | 0];
export const chance = p => Math.random() < p;

/** Shortest distance from point p to segment ab. */
export function segDist(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Weighted pick: table is [[item, weight], ...] */
export function weighted(table) {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = Math.random() * total;
  for (const [item, w] of table) { r -= w; if (r <= 0) return item; }
  return table[table.length - 1][0];
}

export const now = () => performance.now();

/* Chrome rejects vibrate() before the first tap and logs an error each time,
   which floods the console and buries real ones. Arm on the first gesture. */
let hapticsArmed = false;
if (typeof addEventListener === 'function') {
  addEventListener('pointerdown', () => { hapticsArmed = true; }, { once: true, capture: true });
}

export function vibrate(pattern) {
  if (!hapticsArmed || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (_) {}
}
