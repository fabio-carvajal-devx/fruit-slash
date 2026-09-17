/* --------------------------------------------------------------
   View: owns the canvas and the unit system.
   The short edge of the screen is ALWAYS 100 units, on every device,
   so a game is authored once and never thinks about pixels.
   -------------------------------------------------------------- */
export class View {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.listeners = [];
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
  }

  onResize(fn) { this.listeners.push(fn); fn(this); }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2.5);
    const cw = this.cv.clientWidth || innerWidth;
    const ch = this.cv.clientHeight || innerHeight;
    this.dpr = dpr;
    this.pw = Math.round(cw * dpr);
    this.ph = Math.round(ch * dpr);
    if (this.cv.width !== this.pw) this.cv.width = this.pw;
    if (this.cv.height !== this.ph) this.cv.height = this.ph;
    this.u = Math.min(cw, ch) / 100;     // one unit, in CSS pixels
    this.w = cw / this.u;                // world width, in units
    this.h = ch / this.u;
    this.cssW = cw; this.cssH = ch;
    this.listeners.forEach(fn => fn(this));
  }

  toWorld(clientX, clientY) {
    const r = this.cv.getBoundingClientRect();
    return { x: (clientX - r.left) / this.u, y: (clientY - r.top) / this.u };
  }

  /** Enter unit space, optionally shaken. */
  begin(sx = 0, sy = 0) {
    const k = this.dpr * this.u;
    this.ctx.setTransform(k, 0, 0, k, sx * k, sy * k);
    return this.ctx;
  }
}
