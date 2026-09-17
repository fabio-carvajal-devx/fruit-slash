/* --------------------------------------------------------------
   App: the shared runtime every game in this project sits on.
   Owns the view, the blade input, the particle systems, the screen
   shake and the fixed-timestep loop — a game only writes rules.
   -------------------------------------------------------------- */
import { View } from './view.js';
import { Blades } from './input.js';
import { Particles, Splatter } from './particles.js';
import { rand } from './util.js';

const FIXED_DT = 1 / 120;

export class App {
  constructor(canvas) {
    this.view = new View(canvas);
    this.particles = new Particles();
    this.splat = new Splatter();
    this.blades = new Blades(canvas, (x, y) => this.view.toWorld(x, y));
    this.shake = 0;
    this.scene = null;
    this.paused = true;

    this.view.onResize(v => this.splat.resize(v.cssW, v.cssH, v.u));

    this.acc = 0;
    this.last = performance.now();
    const loop = now => {
      requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;               // returned from a background tab

      if (!this.paused && this.scene) {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= FIXED_DT && steps < 8) {
          this.scene.step(FIXED_DT);
          this.shake = Math.max(0, this.shake - FIXED_DT * 3.2);
          this.acc -= FIXED_DT;
          steps++;
        }
        if (steps === 8) this.acc = 0;
      } else if (this.scene) {
        this.scene.ambient?.(dt);        // menus keep breathing
      }
      this.blades.update();
      this.render(now / 1000);
    };
    requestAnimationFrame(loop);
  }

  setScene(scene, opts) {
    this.scene?.leave();
    this.scene = scene;
    scene.mount(this);
    scene.enter(opts);
  }

  play()  { this.paused = false; this.last = performance.now(); this.blades.enabled = true; }
  hold()  { this.paused = true; this.blades.enabled = false; }

  render(t) {
    if (!this.scene) return;
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      const m = this.shake * this.shake * 3.2;
      sx = rand(-m, m); sy = rand(-m, m);
    }
    const ctx = this.view.begin(sx, sy);
    this.scene.draw(ctx, t);
    this.particles.draw(ctx);
    this.blades.draw(ctx);
    this.scene.overlay(ctx, t);
  }
}
