/* A game is a Scene. Implement these four and the engine drives it. */
export class Scene {
  mount(app) { this.app = app; this.view = app.view; }
  enter(_opts) {}
  step(_dt) {}                 // fixed timestep, seconds
  draw(_ctx, _tSec) {}         // unit space; background + entities
  overlay(_ctx, _tSec) {}      // drawn above blades
  leave() {}
}
