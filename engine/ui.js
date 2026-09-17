/* Screens, HUD and settings. The canvas never draws a single letter of
   chrome — text lives in the DOM so it stays sharp and accessible. */
import * as audio from './audio.js';
import { sfx } from './audio.js';

const $ = id => document.getElementById(id);
const KEY = 'fruit-slash/v1';

const DEFAULTS = { duration: 90, bombs: 1, sound: 1, speed: 1, best: 0 };

export class UI {
  constructor() {
    this.save = this.load();
    audio.setEnabled(!!this.save.sound);

    this.el = {
      hud: $('hud'), pause: $('pauseBtn'),
      clockBar: $('clockBar'), clockFill: $('clockBar').firstElementChild, clockText: $('clockText'),
      score: $('scoreVal'), banner: $('banner'),
      screens: [...document.querySelectorAll('.screen')],
      bestStart: $('bestStart'), bestEnd: $('bestEnd'), newBest: $('newBest'),
      endScore: $('endScore'), endStats: $('endStats'), stars: $('stars'),
      countNum: $('countNum'),
      tint: {
        freeze: $('tint-freeze'), double: $('tint-double'),
        frenzy: $('tint-frenzy'), bomb: $('tint-bomb')
      }
    };
    this.el.bestStart.textContent = this.save.best;
    this.bindSegments();
  }

  load() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  }
  persist() { try { localStorage.setItem(KEY, JSON.stringify(this.save)); } catch {} }

  bindSegments() {
    const map = { optTime: 'duration', optBombs: 'bombs', optSound: 'sound', optSpeed: 'speed' };
    for (const [id, key] of Object.entries(map)) {
      const box = $(id);
      const paint = () => [...box.children].forEach(b =>
        b.classList.toggle('on', Number(b.dataset.v) === Number(this.save[key])));
      box.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        this.save[key] = Number(b.dataset.v);
        if (key === 'sound') { audio.setEnabled(!!this.save.sound); }
        this.persist(); paint(); sfx.tap();
      });
      paint();
    }
  }

  show(id) {
    this.el.screens.forEach(s => s.classList.toggle('show', s.id === id));
  }
  hideScreens() { this.el.screens.forEach(s => s.classList.remove('show')); }

  setHud(on) { this.el.hud.hidden = !on; }

  score(v) {
    this.el.score.textContent = v;
    this.el.score.classList.remove('bump');
    void this.el.score.offsetWidth;
    this.el.score.classList.add('bump');
  }

  clock(left, total) {
    const s = Math.ceil(Math.max(0, left));
    this.el.clockText.textContent = s;
    this.el.clockFill.style.width = `${Math.max(0, Math.min(1, left / total)) * 100}%`;
    this.el.clockBar.classList.toggle('low', s <= 10);
  }

  banner(text, color) {
    const b = this.el.banner;
    b.textContent = text;
    b.style.color = color || '#fff';
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  effect(fx) {
    this.el.tint.freeze.classList.toggle('on', fx.freeze > 0);
    this.el.tint.double.classList.toggle('on', fx.double > 0);
    this.el.tint.frenzy.classList.toggle('on', fx.frenzy > 0);
  }

  flashBomb() {
    const t = this.el.tint.bomb;
    t.style.transition = 'none'; t.classList.add('on');
    requestAnimationFrame(() => {
      t.style.transition = 'opacity .5s ease';
      t.classList.remove('on');
    });
  }

  /** 3 - 2 - 1 - GO, resolves when the round may begin. */
  countdown() {
    return new Promise(resolve => {
      const steps = ['3', '2', '1', 'GO!'];
      let i = 0;
      this.show('s-count');
      const tick = () => {
        const n = this.el.countNum;
        n.textContent = steps[i];
        n.style.animation = 'none'; void n.offsetWidth; n.style.animation = '';
        if (i === 3) sfx.go(); else sfx.tap();
        i++;
        if (i < steps.length) setTimeout(tick, 700);
        else setTimeout(() => { this.hideScreens(); resolve(); }, 520);
      };
      tick();
    });
  }

  end(r) {
    const isBest = r.score > this.save.best;
    if (isBest) { this.save.best = r.score; this.persist(); }
    this.el.bestStart.textContent = this.save.best;
    this.el.bestEnd.textContent = this.save.best;
    this.el.newBest.hidden = !isBest;
    this.el.endScore.textContent = r.score;

    const per = r.duration / 60;
    const tiers = [180 * per, 420 * per, 720 * per];
    [...this.el.stars.children].forEach((s, i) => {
      s.classList.remove('lit');
      if (r.score >= tiers[i]) setTimeout(() => s.classList.add('lit'), 120 + i * 140);
    });

    this.el.endStats.innerHTML = `
      <li>FRUIT<b>${r.sliced}</b></li>
      <li>EXTRA CHOPS<b>${r.chops || 0}</b></li>
      <li>BEST COMBO<b>x${r.combo || 0}</b></li>
      <li>BOMBS<b>${r.bombs}</b></li>`;
    this.effect({ freeze: 0, double: 0, frenzy: 0 });
    this.setHud(false);
    this.show('s-end');
  }
}
