/* --------------------------------------------------------------
   Asteroid Run — tilt the tablet to fly the rocket.

   Steering reads device orientation, mapped through the current
   screen angle so "lean left" means left whichever way the tablet is
   held, and calibrated to whatever angle the player is already
   holding it at. Dragging a finger works too, for desks, laptops and
   any device without a gyroscope.
   -------------------------------------------------------------- */
import { Scene } from '../../engine/scene.js';
import { TAU, clamp, lerp, rand, randInt, chance, weighted, vibrate } from '../../engine/util.js';
import { sfx } from '../../engine/audio.js';
import { Rhythm } from '../../engine/rhythm.js';
import { Background } from './background.js';
import { POWERS, rockShape, drawRock, drawShip, drawShield, drawCell, drawPower,
         drawEnemyShot, drawAlien, drawBoss } from './art.js';
import { WEAPONS, DEFAULT_WEAPON, WEAPON_TIME, drawShot, drawWeaponOrb, drawWeaponHud } from './weapons.js';

const SHIP_R      = 4.2;
const SHIP_Y      = 0.80;    // fraction of screen height
const MAX_SPEED   = 58;      // units / second at full lean
const TILT_RANGE  = 20;      // degrees of lean for full speed
const DEAD_ZONE   = 1.6;     // degrees ignored around neutral
const LANES       = 7;
const HURT_TIME   = 1.3;     // invulnerable seconds after a hit
const BEATS       = 8;
const FIRE_CD     = 0.20;    // seconds between shots while held
const SHOT_SPEED  = 96;
const BOSS_EVERY  = 180;     // seconds of play between bosses

export const meta = { id: 'asteroid-run', title: 'Asteroid Run' };

export default class AsteroidRun extends Scene {
  constructor(hooks) {
    super();
    this.hooks = hooks;
    this.bg = new Background();
    this.things = [];
    this.pops = [];
    this.state = 'idle';
    this.wantsBlades = false;
    this.opts = { duration: 90, speed: 1 };
    this.rhythm = new Rhythm({ bpm0: 84, bpm1: 140, steps: BEATS });

    this.shots = [];
    this.boss = null;
    this.bossIndex = 0;
    this.firing = false;
    this.fireCd = 0;
    this.weapon = DEFAULT_WEAPON;
    this.weaponLeft = 0;
    this.raw = { beta: 0, gamma: 0 };
    this.neutral = null;
    this.tilt = 0;
    this.touch = null;
    this.dragId = null;
  }

  mount(app) {
    super.mount(app);
    if (this.mounted) return;
    this.mounted = true;
    this.view.onResize(v => this.bg.resize(v));

    addEventListener('deviceorientation', e => {
      if (e.beta == null && e.gamma == null) return;
      this.raw.beta = e.beta || 0;
      this.raw.gamma = e.gamma || 0;
      this.hasTilt = true;
    }, true);

    // Finger fallback, for desks and anything without a gyroscope.
    // One tracked pointer id only: a stray or stuck pointer that the game
    // never saw press must not be able to take the controls.
    const cv = this.view.cv;
    const set = e => { this.touch = this.view.toWorld(e.clientX, e.clientY).x; };
    cv.addEventListener('pointerdown', e => {
      if (this.state !== 'running' || this.dragId !== null) return;
      this.dragId = e.pointerId;
      set(e);
      this.firing = true;
      this.shoot();                      // first shot is instant, not on the next tick
    }, { passive: true });
    cv.addEventListener('pointermove', e => {
      if (e.pointerId === this.dragId) set(e);
    }, { passive: true });
    const end = e => {
      if (e.pointerId !== this.dragId) return;
      this.dragId = null;
      this.touch = null;
      this.firing = false;
    };
    cv.addEventListener('pointerup', end, { passive: true });
    cv.addEventListener('pointercancel', end, { passive: true });
    cv.addEventListener('lostpointercapture', end, { passive: true });
  }

  /** Lean, in degrees, in screen space rather than device space. */
  leanDegrees() {
    const a = (screen.orientation?.angle ?? window.orientation ?? 0 + 360) % 360;
    const { beta, gamma } = this.raw;
    if (a === 90) return -beta;
    if (a === 180) return -gamma;
    if (a === 270) return beta;
    return gamma;
  }

  /* ------------------------------ round ------------------------------ */
  enter(opts) {
    Object.assign(this.opts, opts);
    this.things.length = 0;
    this.pops.length = 0;
    this.app.particles.clear();
    this.rhythm.reset();

    this.shots.length = 0;
    this.boss = null;
    this.bossIndex = 0;
    this.firing = false;
    this.fireCd = 0;
    this.weapon = DEFAULT_WEAPON;
    this.weaponLeft = 0;
    this.pickups = 0;
    this.elapsed = 0;
    this.nextBossAt = Math.min(BOSS_EVERY, this.opts.duration * 0.70);

    this.score = 0;
    this.cells = 0;
    this.dodged = 0;
    this.shot = 0;
    this.aliens = 0;
    this.bosses = 0;
    this.hits = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.timeLeft = this.opts.duration;
    this.lastTick = Math.ceil(this.timeLeft);
    this.fx = { freeze: 0, double: 0, shield: 0 };
    this.hurt = 0;
    this.now = 0;
    this.barsSincePower = 2;

    this.x = this.view.w / 2;
    this.vx = 0;
    this.neutral = null;          // recalibrated to however they hold it now
    this.touch = null;
    this.dragId = null;
    this.state = 'running';

    this.hooks.score(0);
    this.hooks.clock(this.timeLeft, this.opts.duration);
    this.hooks.effect(this.fx);
    this.hooks.banner(this.hasTilt ? 'TILT TO FLY' : 'DRAG TO FLY', '#8fd4ff');
  }

  ambient(dt) { this.bg.update(dt, 0.35); }
  leave() {
    this.state = 'idle';
    this.things.length = 0;
    this.shots.length = 0;
    this.pops.length = 0;
    this.boss = null;
    this.firing = false;
  }

  /* ------------------------------ spawning ------------------------------ */
  laneX(lane, r) {
    const w = this.view.w, lw = w / LANES;
    return clamp(lw * (lane + .5) + rand(-.22, .22) * lw, r * 1.2, w - r * 1.2);
  }

  fallSpeed(intensity) { return 25 + intensity * 30; }

  spawnRock(lane, intensity) {
    const r = rand(3.4, 6.6);
    this.things.push({
      kind: 'rock', r, x: this.laneX(lane, r), y: -r * 2,
      vx: rand(-4, 4), vy: this.fallSpeed(intensity) * rand(.92, 1.12),
      rot: rand(0, TAU), vr: rand(-1.8, 1.8), alive: true, scored: false,
      shape: rockShape(randInt(9, 13)),
      craters: Array.from({ length: randInt(2, 4) }, () => [rand(-.4, .4), rand(-.4, .4), rand(.1, .22)])
    });
  }

  spawnCell(lane, intensity) {
    const r = 3.0;
    this.things.push({
      kind: 'cell', r, x: this.laneX(lane, r), y: -r * 2,
      vx: 0, vy: this.fallSpeed(intensity) * .82,
      rot: 0, vr: 0, alive: true
    });
  }

  spawnWeapon(key, lane, intensity) {
    const r = 4.6;
    this.things.push({
      kind: 'weapon', weapon: key, r, x: this.laneX(lane, r), y: -r * 2,
      vx: 0, vy: this.fallSpeed(intensity) * .7, rot: 0, vr: 0, alive: true
    });
  }

  spawnPower(kind, lane, intensity) {
    const r = POWERS[kind].r;
    this.things.push({
      kind: 'power', power: kind, r, x: this.laneX(lane, r), y: -r * 2,
      vx: 0, vy: this.fallSpeed(intensity) * .7, rot: 0, vr: 0, alive: true
    });
  }

  spawnAlien(intensity) {
    const r = 4.0;
    const w = this.view.w;
    this.things.push({
      kind: 'alien', r, x: rand(r * 2, w - r * 2), y: -r * 2,
      vx: rand(6, 11) * (chance(.5) ? 1 : -1),
      vy: 14, hoverY: this.view.h * rand(.18, .38),
      rot: 0, vr: 0, alive: true,
      fireCd: rand(.8, 1.8) , speedK: 0.9 + intensity * 0.5
    });
  }

  spawnBoss() {
    this.bossIndex++;
    const hp = 14 + this.bossIndex * 8;
    this.boss = {
      kind: 'boss', r: 13, x: this.view.w / 2, y: this.view.h * 0.19,
      vx: 13, hp, maxHp: hp, hurt: 0, fireCd: 1.6, dropCd: 3.2, alive: true
    };
    this.hooks.banner('BOSS!', '#ff7ad1');
    this.hooks.music?.('boss');
    sfx.alarm();
    this.app.shake = .8;
  }

  killBoss() {
    const b = this.boss;
    this.boss = null;
    this.bosses++;
    this.app.particles.explode(b.x, b.y, '#ff7ad1', 2.6);
    this.app.particles.explode(b.x - b.r * .6, b.y + 2, '#ffd166', 1.8);
    this.app.particles.explode(b.x + b.r * .6, b.y - 2, '#fff3c4', 1.6);
    this.app.particles.confetti(b.x, b.y, 44);
    this.app.shake = 1;
    sfx.blast(1.7);
    setTimeout(() => sfx.blast(1.1), 220);
    setTimeout(() => sfx.record(), 620);
    vibrate([60, 50, 90]);
    this.hooks.banner('BOSS DOWN!', '#ffe45e');
    this.hooks.music?.(null);            // back to the game's own track
    const pts = 200 * (this.fx.double > 0 ? 2 : 1);
    this.addScore(pts, b.x, b.y, '#ffe45e', `BOSS +${pts}`);
  }

  enemyShot(x, y, tx, ty, speed) {
    const d = Math.hypot(tx - x, ty - y) || 1;
    this.things.push({
      kind: 'eshot', r: 1.7, x, y,
      vx: (tx - x) / d * speed, vy: (ty - y) / d * speed,
      rot: 0, vr: 0, alive: true
    });
  }

  shoot() {
    if (this.state !== 'running' || this.fireCd > 0) return;
    const w = WEAPONS[this.weapon];
    this.fireCd = w.cd;
    const y = this.view.h * SHIP_Y - SHIP_R * 1.15;
    for (const shot of w.shots) {
      this.shots.push({
        x: this.x + shot.ox, y,
        vx: Math.sin(shot.a) * SHOT_SPEED,
        vy: -Math.cos(shot.a) * SHOT_SPEED,
        r: w.width, weapon: this.weapon, pierce: w.pierce, hitCd: 0
      });
    }
    this.app.particles.spawn({
      k: 'spark', x: this.x, y: y + 1, vx: rand(-6, 6), vy: rand(4, 12),
      r: .55, life: .16, age: 0, color: w.core, grav: 0
    });
    sfx.laser();
  }

  giveWeapon(key, x, y) {
    const w = WEAPONS[key];
    this.weapon = key;
    this.weaponLeft = WEAPON_TIME;
    this.pickups++;
    this.app.particles.explode(x, y, w.color, 0.9);
    this.hooks.banner(w.name + '!', w.color);
    sfx.power('double'); vibrate([12, 20, 12]);
  }

  liveRocks() {
    let n = 0;
    for (const t of this.things) if (t.kind === 'rock' && t.y < this.view.h) n++;
    return n;
  }

  onBeat(beat, bar, intensity) {
    if (beat === 0 && bar > 0) this.barsSincePower++;

    // the boss owns the screen: only pickups keep coming
    if (this.boss) {
      if (beat === 2 || beat === 6) this.spawnCell(randInt(0, LANES - 1), intensity);
      if (beat === 0 && this.barsSincePower >= 3 && chance(.8)) {
        this.barsSincePower = 0;
        this.spawnPower(weighted([['shield', 44], ['double', 28], ['slow', 28]]),
                        randInt(0, LANES - 1), intensity);
      }
      return;
    }

    let aliensUp = 0;
    for (const t of this.things) if (t.kind === 'alien') aliensUp++;
    if (beat === 4 && intensity > 0.30 && aliensUp < 2 && chance(.25 + intensity * .35)) {
      this.spawnAlien(intensity);
      return;
    }

    // a wall with a gap: the clearest "steer NOW" shape there is
    if (beat === 0 && bar % 4 === 3 && intensity > 0.34) {
      const gap = randInt(0, LANES - 1);
      for (let l = 0; l < LANES; l++) {
        if (l === gap || l === gap + (chance(.5) ? 1 : -1)) continue;
        this.spawnRock(l, intensity);
      }
      this.spawnCell(gap, intensity);
      return;
    }

    if (beat === 0 && this.barsSincePower >= 3 && chance(.7)) {
      this.barsSincePower = 0;
      const lane = randInt(0, LANES - 1);
      if (chance(.45)) this.spawnWeapon(weighted([['twin', 34], ['spread', 34], ['beam', 32]]), lane, intensity);
      else this.spawnPower(weighted([['shield', 30], ['slow', 24], ['double', 24], ['time', 22]]),
                           lane, intensity);
      return;
    }

    // a drifting ribbon of cells, so there is always something to chase
    if (beat === 2 || beat === 6) {
      const l = randInt(0, LANES - 1);
      this.spawnCell(l, intensity);
      if (intensity > .5 && chance(.5)) this.spawnCell(clamp(l + 1, 0, LANES - 1), intensity);
      return;
    }

    const cap = Math.round(2 + intensity * 4);
    if (this.liveRocks() >= cap) return;
    const n = beat % 4 === 0 ? randInt(1, 2) : (chance(.45 + intensity * .3) ? 1 : 0);
    const lanes = [...Array(LANES).keys()].sort(() => Math.random() - .5);
    for (let i = 0; i < n; i++) this.spawnRock(lanes[i], intensity);
  }

  /* ------------------------------ simulation ------------------------------ */
  step(dt) {
    const slow = this.fx.freeze > 0 ? 0.42 : 1;
    const wdt = dt * slow;
    this.now += dt;

    const progress = 1 - clamp(this.timeLeft / this.opts.duration, 0, 1);
    const intensity = 0.15 + 0.85 * Math.pow(progress, 0.85);
    this.bg.update(wdt, 0.6 + intensity * 1.6);

    if (this.state === 'running') {
      this.timeLeft -= dt;
      for (const k of ['freeze', 'double', 'shield']) {
        if (this.fx[k] > 0) {
          this.fx[k] = Math.max(0, this.fx[k] - dt);
          if (!this.fx[k]) this.hooks.effect(this.fx);
        }
      }
      const sec = Math.ceil(Math.max(0, this.timeLeft));
      if (sec !== this.lastTick) {
        this.lastTick = sec;
        this.hooks.clock(Math.max(0, this.timeLeft), this.opts.duration);
        if (sec <= 5 && sec > 0) sfx.tick();
      }
      if (this.timeLeft <= 0) return this.finish();

      this.rhythm.speed = this.opts.speed;
      this.rhythm.update(wdt, intensity, (b, bar, i) => this.onBeat(b, bar, i));
      this.hooks.intensity?.(intensity);
    }

    this.steer(dt);
    this.hurt = Math.max(0, this.hurt - dt);

    const { w, h } = this.view;
    const shipY = h * SHIP_Y;

    if (this.state === 'running') {
      this.elapsed += dt;
      if (!this.boss && this.nextBossAt !== null && this.elapsed >= this.nextBossAt) {
        this.spawnBoss();
        this.nextBossAt = this.elapsed + BOSS_EVERY;
      }
      this.fireCd = Math.max(0, this.fireCd - dt);
      if (this.firing) this.shoot();

      if (this.weaponLeft > 0) {
        this.weaponLeft -= dt;
        if (this.weaponLeft <= 0) {
          this.weapon = DEFAULT_WEAPON;
          this.hooks.banner('BOLT', WEAPONS.bolt.color);
        }
      }
    }

    this.updateShots(wdt);

    for (let i = this.things.length - 1; i >= 0; i--) {
      const t = this.things[i];

      if (t.kind === 'alien') {
        if (t.y < t.hoverY) t.y += t.vy * wdt;
        t.x += t.vx * wdt * t.speedK;
        if (t.x < t.r * 1.3 || t.x > w - t.r * 1.3) t.vx *= -1;
        t.fireCd -= wdt;
        if (t.fireCd <= 0 && t.y > 2 && this.state === 'running') {
          t.fireCd = rand(1.6, 3.2) / t.speedK;
          this.enemyShot(t.x, t.y + t.r * .5, this.x, shipY, 26 + 12 * t.speedK);
        }
      } else {
        t.x += t.vx * wdt;
        t.y += t.vy * wdt;
        t.rot += t.vr * wdt;
        if (t.kind === 'rock' && (t.x < t.r || t.x > w - t.r)) t.vx *= -1;
      }

      if (t.alive && this.state === 'running' && this.collides(t, shipY)) {
        this.impact(t, i, shipY);
        continue;
      }
      if (t.y > h + t.r * 3 || t.y < -h * .6 || t.x < -20 || t.x > w + 20) {
        if (t.kind === 'rock' && t.alive) this.dodged++;
        this.things.splice(i, 1);
      }
    }

    if (this.boss) this.updateBoss(wdt, dt, shipY, intensity);

    // thruster
    if (this.state === 'running' && chance(0.6)) {
      this.app.particles.spawn({
        k: 'spark', x: this.x + rand(-1, 1), y: shipY + SHIP_R * .8,
        vx: -this.vx * .2 + rand(-4, 4), vy: rand(18, 34),
        r: rand(.3, .8), life: rand(.18, .38), age: 0,
        color: chance(.5) ? '#ffd07a' : '#ff8a5c', grav: 0
      });
    }

    this.app.particles.update(wdt);
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.age += dt; p.y -= dt * 12;
      if (p.age > p.life) this.pops.splice(i, 1);
    }
  }

  updateShots(wdt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const b = this.shots[i];
      b.x += (b.vx || 0) * wdt;
      b.y += b.vy * wdt;
      b.hitCd = Math.max(0, b.hitCd - wdt);
      if (b.y < -4 || b.x < -6 || b.x > this.view.w + 6) { this.shots.splice(i, 1); continue; }

      if (this.boss && b.hitCd <= 0 &&
          Math.hypot(b.x - this.boss.x, (b.y - this.boss.y) * 2.2) <= this.boss.r) {
        if (b.pierce) b.hitCd = 0.12; else this.shots.splice(i, 1);
        this.boss.hp--;
        this.boss.hurt = 0.1;
        this.app.particles.shock(b.x, b.y, '#ffd9f4', 5, .22);
        this.app.particles.sparkle(b.x, b.y, '#ffd9f4', 8, 30);
        sfx.slice(1.8);
        if (this.boss.hp <= 0) this.killBoss();
        if (!b.pierce) continue;
      }

      let done = false;
      for (let j = this.things.length - 1; j >= 0 && !done; j--) {
        const t = this.things[j];
        if (!t.alive || (t.kind !== 'rock' && t.kind !== 'alien')) continue;
        if (Math.hypot(b.x - t.x, b.y - t.y) > t.r + b.r) continue;

        if (b.pierce) done = false; else { this.shots.splice(i, 1); done = true; }

        if (t.kind === 'alien') {
          this.things.splice(j, 1);
          this.aliens++;
          this.app.particles.explode(t.x, t.y, '#9dff8a', 1.1);
          this.app.shake = Math.max(this.app.shake, .35);
          sfx.blast(.85); vibrate(15);
          this.addScore(25 * (this.fx.double > 0 ? 2 : 1), t.x, t.y, '#9dff8a');
        } else {
          this.things.splice(j, 1);
          this.shot++;
          this.app.particles.explode(t.x, t.y, '#c9d2e4', t.r > 4.6 ? .9 : .55);
          sfx.crash(t.r > 4.6 ? 1.2 : .75);
          this.addScore(5 * (this.fx.double > 0 ? 2 : 1), t.x, t.y, '#c9d2e4');
          if (t.r > 4.6) {                       // big rocks break in two
            for (const dir of [-1, 1]) {
              this.things.push({
                kind: 'rock', r: t.r * .58, x: t.x + dir * t.r * .5, y: t.y,
                vx: t.vx + dir * rand(6, 13), vy: t.vy * .9,
                rot: t.rot, vr: rand(-3, 3), alive: true,
                shape: rockShape(randInt(8, 11)),
                craters: [[rand(-.3, .3), rand(-.3, .3), .16]]
              });
            }
          }
        }
      }
    }
  }

  updateBoss(wdt, dt, shipY, intensity) {
    const b = this.boss, w = this.view.w;
    b.hurt = Math.max(0, b.hurt - dt);
    b.x += b.vx * wdt;
    if (b.x < b.r * 1.2) { b.x = b.r * 1.2; b.vx *= -1; }
    if (b.x > w - b.r * 1.2) { b.x = w - b.r * 1.2; b.vx *= -1; }

    if (this.state !== 'running') return;

    b.fireCd -= wdt;
    if (b.fireCd <= 0) {
      b.fireCd = 2.0 - intensity * 0.7;
      for (const spread of [-0.34, 0, 0.34]) {     // slow, wide, readable
        this.enemyShot(b.x + spread * b.r, b.y + b.r * .4,
                       this.x + spread * 30, shipY, 27);
      }
      sfx.tap();
    }

    b.dropCd -= wdt;
    if (b.dropCd <= 0) {
      b.dropCd = 3.4;
      this.spawnRock(randInt(0, LANES - 1), intensity);
      this.spawnRock(randInt(0, LANES - 1), intensity);
    }

    if (this.hurt <= 0 && Math.hypot(b.x - this.x, (b.y - shipY) * 1.2) < b.r + SHIP_R) {
      this.damage(b.x, shipY);
    }
  }

  steer(dt) {
    const w = this.view.w;
    let target = null;

    if (this.touch !== null) {
      target = this.touch;
    } else if (this.hasTilt) {
      const lean = this.leanDegrees();
      if (this.neutral === null) this.neutral = lean;
      const d = lean - this.neutral;
      const mag = Math.abs(d) < DEAD_ZONE ? 0 : (d - Math.sign(d) * DEAD_ZONE);
      this.tilt = clamp(mag / TILT_RANGE, -1, 1);
      this.vx = lerp(this.vx, this.tilt * MAX_SPEED, 1 - Math.pow(0.002, dt));
    }

    if (target !== null) {
      const want = clamp((target - this.x) * 7, -MAX_SPEED, MAX_SPEED);
      this.vx = lerp(this.vx, want, 1 - Math.pow(0.0005, dt));
      this.tilt = clamp(this.vx / MAX_SPEED, -1, 1);
    } else if (!this.hasTilt) {
      this.vx = lerp(this.vx, 0, 1 - Math.pow(0.02, dt));
    }

    this.x = clamp(this.x + this.vx * dt, SHIP_R, w - SHIP_R);
    if (this.x <= SHIP_R || this.x >= w - SHIP_R) this.vx *= 0.3;
  }

  collides(t, shipY) {
    const pad = (t.kind === 'rock' || t.kind === 'alien') ? t.r * .82 + SHIP_R * .68
              : t.kind === 'eshot' ? t.r + SHIP_R * .62
              : t.r * 1.5 + SHIP_R * .9;                 // pickups are generous
    const dx = t.x - this.x, dy = t.y - shipY;
    return dx * dx + dy * dy <= pad * pad;
  }

  impact(t, index, shipY) {
    if (t.kind === 'cell') {
      this.things.splice(index, 1);
      this.cells++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const pts = 10 * (this.fx.double > 0 ? 2 : 1);
      this.addScore(pts, t.x, t.y, this.fx.double > 0 ? '#ffd447' : '#7dffb0');
      this.app.particles.sparkle(t.x, t.y, '#7dffb0', 14, 34);
      sfx.slice(1.5); vibrate(8);
      if (this.streak > 0 && this.streak % 5 === 0) {
        const bonus = this.streak * 5 * (this.fx.double > 0 ? 2 : 1);
        this.addScore(bonus, this.view.w / 2, this.view.h * .34, '#ffe45e', `STREAK +${bonus}`);
        this.hooks.banner(`${this.streak} IN A ROW`, '#ffe45e');
        this.app.particles.confetti(t.x, t.y, 20);
        sfx.combo(4);
      }
      return;
    }

    if (t.kind === 'power') {
      this.things.splice(index, 1);
      this.applyPower(t.power, t.x, t.y);
      return;
    }

    if (t.kind === 'weapon') {
      this.things.splice(index, 1);
      this.giveWeapon(t.weapon, t.x, t.y);
      return;
    }

    // rock, alien or enemy fire — all hurt the same way
    if (this.hurt > 0) return;
    this.things.splice(index, 1);
    this.app.particles.smoke(t.x, t.y, t.kind === 'eshot' ? 5 : 12);
    this.damage(t.x, t.y);
  }

  damage(x, y) {
    const shipY = this.view.h * SHIP_Y;

    if (this.fx.shield > 0) {
      this.fx.shield = 0;
      this.hooks.effect(this.fx);
      this.hooks.banner('SHIELD GONE', '#8fd4ff');
      this.app.particles.sparkle(this.x, shipY, '#8fd4ff', 26, 48);
      this.app.shake = .6;
      this.hurt = HURT_TIME * .6;
      sfx.thud(); sfx.power('freeze'); vibrate([20, 20, 20]);
      return;
    }
    void x; void y;

    this.hits++;
    this.streak = 0;
    this.hurt = HURT_TIME;
    this.weapon = DEFAULT_WEAPON;            // a hit knocks the gun loose
    this.weaponLeft = 0;
    this.addScore(-20, this.x, shipY, '#ff6b6b');
    this.app.particles.explode(this.x, shipY, '#ff8a5c', 1.4);
    this.app.shake = 1;
    this.hooks.banner('OUCH!', '#ff6b6b');
    this.hooks.flashBomb();
    sfx.thud(); vibrate([40, 30, 60]);
  }

  applyPower(kind, x, y) {
    const p = POWERS[kind];
    this.app.particles.sparkle(x, y, p.tint, 28, 55);
    this.app.particles.confetti(x, y, 16);
    sfx.power(kind === 'slow' ? 'freeze' : kind); vibrate([15, 25, 15]);
    this.hooks.banner(p.label, p.tint);

    if (kind === 'shield') this.fx.shield = 9;
    if (kind === 'slow') this.fx.freeze = 5.5;
    if (kind === 'double') this.fx.double = 8;
    if (kind === 'time') {
      this.timeLeft += 10;
      this.addScore(0, x, y, p.tint, '+10s');
      this.hooks.clock(this.timeLeft, Math.max(this.opts.duration, this.timeLeft));
    }
    this.hooks.effect(this.fx);
  }

  addScore(pts, x, y, color, label) {
    if (pts) { this.score = Math.max(0, this.score + pts); this.hooks.score(this.score); }
    this.pops.push({ x, y, text: label || (pts > 0 ? '+' + pts : String(pts)), color, age: 0, life: .9 });
  }

  finish() {
    if (this.state !== 'running') return;
    this.state = 'ending';
    this.timeLeft = 0;
    this.hooks.clock(0, this.opts.duration);
    sfx.end();
    setTimeout(() => {
      this.state = 'idle';
      this.hooks.music?.(null);
      this.hooks.end({
        score: this.score, duration: this.opts.duration,
        stats: [['CELLS', this.cells], ['ROCKS SHOT', this.shot], ['GUNS', this.pickups],
                ['ALIENS', this.aliens], ['BOSSES', this.bosses],
                ['BEST RUN', this.bestStreak], ['HITS', this.hits]]
      });
    }, 1300);
  }

  /* ------------------------------ render ------------------------------ */
  draw(ctx, tSec) {
    this.bg.draw(ctx, this.view);
    const shipY = this.view.h * SHIP_Y;

    for (const b of this.shots) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vx || 0, -b.vy));
      drawShot(ctx, WEAPONS[b.weapon] || WEAPONS[DEFAULT_WEAPON], b.r);
      ctx.restore();
    }

    for (const t of this.things) {
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.kind === 'rock') { ctx.rotate(t.rot); drawRock(ctx, t.r, t.shape, t.craters); }
      else if (t.kind === 'cell') drawCell(ctx, t.r, tSec);
      else if (t.kind === 'alien') {
        drawAlien(ctx, t.r, tSec, '#9dff8a', 1 - clamp(t.fireCd / 0.45, 0, 1));
      } else if (t.kind === 'eshot') {
        ctx.rotate(Math.atan2(-t.vx, t.vy));      // tail trails behind the shot
        drawEnemyShot(ctx, t.r, tSec);
      }
      else if (t.kind === 'weapon') drawWeaponOrb(ctx, t.weapon, t.r, tSec);
      else drawPower(ctx, t.power, t.r, tSec);
      ctx.restore();
    }

    if (this.boss) {
      ctx.save();
      ctx.translate(this.boss.x, this.boss.y);
      drawBoss(ctx, this.boss.r, tSec, this.boss.hurt,
               1 - clamp(this.boss.fireCd / 0.5, 0, 1));
      ctx.restore();
    }

    if (this.state !== 'idle') {
      ctx.save();
      ctx.translate(this.x, shipY);
      if (this.fx.shield > 0) drawShield(ctx, SHIP_R, tSec, Math.min(1, this.fx.shield / 1.5));
      // blink while the hull is still hot
      const blink = this.hurt > 0 ? (Math.sin(this.now * 34) > -.2 ? 1 : .25) : 1;
      ctx.globalAlpha = blink;
      drawShip(ctx, SHIP_R, Math.abs(this.tilt), tSec, this.tilt);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  overlay(ctx) {
    if (this.boss) this.drawBossBar(ctx);
    if (this.state !== 'idle') drawWeaponHud(ctx, this.weapon, this.weaponLeft, WEAPON_TIME, this.view);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of this.pops) {
      const t = p.age / p.life;
      ctx.globalAlpha = 1 - t * t;
      const size = 5.5 * (1 + (1 - t) * .25);
      ctx.font = `900 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
      ctx.lineWidth = size * .22; ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  /** Boss health, under the HUD so it never fights the clock. */
  drawBossBar(ctx) {
    const w = this.view.w;
    const bw = Math.min(56, w * .6), bh = 2.2;
    const x = (w - bw) / 2, y = 11;
    const k = Math.max(0, this.boss.hp / this.boss.maxHp);

    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + bw, 0);
    g.addColorStop(0, '#ff7ad1'); g.addColorStop(1, '#ffd447');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(bh, bw * k), bh, bh / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = .3;
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.stroke();

    ctx.font = `900 2.6px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd9f4';
    ctx.fillText('MOTHERSHIP', w / 2, y - 2.2);
  }
}
