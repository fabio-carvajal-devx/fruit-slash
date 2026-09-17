/* --------------------------------------------------------------
   Blade input.
   - Pointer Events, so finger / stylus / mouse are all the same path.
   - Multi-touch: every finger gets its own blade (kids use two hands).
   - Coalesced events are read so a fast swipe across a 120 Hz tablet
     still produces every intermediate segment, not a straight chord.
   -------------------------------------------------------------- */
import { TAU, clamp } from './util.js';

const TRAIL_MS   = 130;   // how long a trail point lives
const MIN_SEG    = 0.9;   // world units a move must cover to cut
const MAX_POINTS = 48;
const SUBDIVIDE  = 3.5;   // world units between interpolated trail points

export class Blades {
  /**
   * @param {HTMLElement} el   element to listen on
   * @param {() => {u:number}} viewRef  supplies the current unit scale
   */
  constructor(el, toWorld) {
    this.toWorld = toWorld;
    this.pointers = new Map();
    this.segments = [];          // consumed once per frame by the game
    this.enabled = false;
    this.onStrokeEnd = null;

    const down = e => {
      if (!this.enabled) return;
      el.setPointerCapture?.(e.pointerId);
      const p = this.toWorld(e.clientX, e.clientY);
      this.pointers.set(e.pointerId, { pts: [{ ...p, t: performance.now() }], hits: 0, sliced: [] });
    };

    const move = e => {
      if (!this.enabled) return;
      const s = this.pointers.get(e.pointerId);
      if (!s) return;
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      const t = performance.now();
      for (const ev of (events.length ? events : [e])) {
        const p = this.toWorld(ev.clientX, ev.clientY);
        const last = s.pts[s.pts.length - 1];
        const d = Math.hypot(p.x - last.x, p.y - last.y);
        if (d < 0.05) continue;
        if (d >= MIN_SEG * 0.35) {
          this.segments.push({ x0: last.x, y0: last.y, x1: p.x, y1: p.y, len: d, id: e.pointerId });
        }
        // A very fast flick can jump half the screen between two samples.
        // Subdivide it so the ribbon curves instead of snapping to a bar.
        const steps = Math.min(8, Math.floor(d / SUBDIVIDE));
        for (let i = 1; i <= steps; i++) {
          const k = i / (steps + 1);
          s.pts.push({ x: last.x + (p.x - last.x) * k, y: last.y + (p.y - last.y) * k, t });
        }
        s.pts.push({ x: p.x, y: p.y, t });
        while (s.pts.length > MAX_POINTS) s.pts.shift();
      }
    };

    const up = e => {
      const s = this.pointers.get(e.pointerId);
      if (s) {
        if (this.onStrokeEnd && s.hits) this.onStrokeEnd(s);
        s.dead = performance.now();
      }
    };

    el.addEventListener('pointerdown', down, { passive: true });
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerup', up, { passive: true });
    el.addEventListener('pointercancel', up, { passive: true });
    el.addEventListener('pointerleave', up, { passive: true });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  reset() { this.pointers.clear(); this.segments.length = 0; }

  /** Segments produced since the last call; pass them to the slicer. */
  takeSegments() { const s = this.segments; this.segments = []; return s; }

  registerHit(id, entity) {
    const s = this.pointers.get(id);
    if (s) { s.hits++; s.sliced.push(entity); }
  }

  update() {
    const t = performance.now();
    for (const [id, s] of this.pointers) {
      while (s.pts.length && t - s.pts[0].t > TRAIL_MS) s.pts.shift();
      if (s.dead && !s.pts.length) this.pointers.delete(id);
    }
  }

  draw(ctx) {
    const t = performance.now();
    for (const s of this.pointers.values()) {
      const pts = s.pts;
      if (pts.length < 2) continue;
      const n = pts.length;

      // width + normal per point: thin at the tail, full width at the finger
      const w = [], nx = [], ny = [];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let dx = b.x - a.x, dy = b.y - a.y;
        const m = Math.hypot(dx, dy) || 1;
        dx /= m; dy /= m;
        const age = clamp(1 - (t - pts[i].t) / TRAIL_MS, 0, 1);
        w.push(1.9 * Math.pow(i / (n - 1), .7) * age);
        nx.push(-dy); ny.push(dx);
      }

      // Each segment is its own quad (plus a round join) so a folded-back
      // swipe can never punch a hole through the ribbon.
      const strip = (mul, style, comp) => {
        ctx.globalCompositeOperation = comp;
        ctx.fillStyle = style;
        for (let i = 0; i < n - 1; i++) {
          const w0 = w[i] * mul, w1 = w[i + 1] * mul;
          if (w0 < .02 && w1 < .02) continue;
          ctx.beginPath();
          ctx.moveTo(pts[i].x + nx[i] * w0, pts[i].y + ny[i] * w0);
          ctx.lineTo(pts[i + 1].x + nx[i + 1] * w1, pts[i + 1].y + ny[i + 1] * w1);
          ctx.lineTo(pts[i + 1].x - nx[i + 1] * w1, pts[i + 1].y - ny[i + 1] * w1);
          ctx.lineTo(pts[i].x - nx[i] * w0, pts[i].y - ny[i] * w0);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.arc(pts[i + 1].x, pts[i + 1].y, w1, 0, TAU);
          ctx.fill();
        }
      };

      ctx.save();
      strip(2.4, 'rgba(110,190,255,.16)', 'lighter');
      strip(1.35, 'rgba(200,235,255,.30)', 'lighter');
      strip(0.62, 'rgba(255,255,255,.95)', 'source-over');
      const head = pts[n - 1];
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(head.x, head.y, 1.3, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
}
