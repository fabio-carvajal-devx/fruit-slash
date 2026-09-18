/* --------------------------------------------------------------
   The shared cabinet shell: screens, HUD, settings and the arcade
   leaderboard. Every game in this project uses this same shell, so
   the theme, the record flow and the name entry stay identical.
   -------------------------------------------------------------- */
import * as audio from './audio.js';
import { sfx } from './audio.js';
import { Scores } from './scores.js';
import { music } from './music.js';

const $ = id => document.getElementById(id);
const DEFAULTS = { duration: 90, bombs: 1, sound: 1, music: 1, speed: 1 };
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export class UI {
  constructor() {
    this.game = null;
    this.key = 'arcade/settings/_';
    this.save = { ...DEFAULTS };

    this.el = {
      hud: $('hud'),
      clockBar: $('clockBar'), clockFill: $('clockBar').firstElementChild, clockText: $('clockText'),
      score: $('scoreVal'), banner: $('banner'),
      screens: [...document.querySelectorAll('.screen')],
      bestStart: $('bestStart'), bestName: $('bestName'),
      endScore: $('endScore'), endStats: $('endStats'), endBoard: $('endBoard'),
      endRank: $('endRank'), stars: $('stars'),
      scoreBoard: $('scoreBoard'), lifetime: $('lifetime'),
      nameSlots: $('nameSlots'), nameTitle: $('nameTitle'),
      countNum: $('countNum'),
      catalog: $('catalog'), kicker: $('gameKicker'), gameName: $('gameName'),
      optRows: [...document.querySelectorAll('.opt[data-opt]')],
      tint: {
        freeze: $('tint-freeze'), double: $('tint-double'),
        frenzy: $('tint-frenzy'), bomb: $('tint-bomb')
      }
    };

    this.repaint = [];
    this.buildNameEntry();
    this.bindSegments();
  }

  /** Point the whole shell at one game: title, accent, settings, records. */
  setGame(meta) {
    this.meta = meta;
    this.game = meta.id;
    this.key = `arcade/settings/${meta.id}`;   // per game, one store shape
    this.save = this.load();
    audio.setEnabled(!!this.save.sound);
    music.setEnabled(!!this.save.music);
    document.documentElement.style.setProperty('--accent', meta.accent);
    this.el.kicker.textContent = meta.kicker;
    this.el.gameName.textContent = meta.name;
    this.el.optRows.forEach(r => { r.hidden = !meta.options.includes(r.dataset.opt); });
    this.repaint.forEach(fn => fn());
    this.refreshBest();
  }

  renderCatalog(games, onPick) {
    this.el.catalog.innerHTML = '';
    for (const g of games) {
      const best = Scores.best(g.id);
      const card = document.createElement('button');
      card.className = 'card';
      card.style.setProperty('--accent', g.accent);
      card.innerHTML = `${g.art}
        <span class="t">${g.kicker} ${g.name}</span>
        <span class="s">${g.tagline}</span>
        <span class="b">${best ? `BEST <em>${best.score}</em> ${best.name}` : 'NOT PLAYED YET'}</span>`;
      card.addEventListener('click', () => { sfx.tap(); onPick(g); });
      this.el.catalog.appendChild(card);
    }
  }

  /* ------------------------------ settings ------------------------------ */
  load() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(this.key) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  }
  persist() { try { localStorage.setItem(this.key, JSON.stringify(this.save)); } catch {} }

  bindSegments() {
    const map = { optTime: 'duration', optBombs: 'bombs', optSound: 'sound',
                  optMusic: 'music', optSpeed: 'speed' };
    for (const [id, key] of Object.entries(map)) {
      const box = $(id);
      const paint = () => [...box.children].forEach(b =>
        b.classList.toggle('on', Number(b.dataset.v) === Number(this.save[key])));
      box.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        this.save[key] = Number(b.dataset.v);
        if (key === 'sound') audio.setEnabled(!!this.save.sound);
        if (key === 'music') music.setEnabled(!!this.save.music);
        this.persist(); paint(); sfx.tap();
      });
      this.repaint.push(paint);
      paint();
    }
  }

  /* ------------------------------ screens ------------------------------ */
  show(id) { this.el.screens.forEach(s => s.classList.toggle('show', s.id === id)); }
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
    requestAnimationFrame(() => { t.style.transition = 'opacity .5s ease'; t.classList.remove('on'); });
  }

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

  /* ------------------------------ leaderboard ------------------------------ */
  refreshBest() {
    const b = Scores.best(this.game);
    this.el.bestStart.textContent = b ? b.score : 0;
    this.el.bestName.textContent = b ? b.name : '';
  }

  renderBoard(el, list, highlight = -1) {
    if (!list.length) { el.innerHTML = '<li class="empty">NO SCORES YET</li>'; return; }
    el.innerHTML = list.map((e, i) =>
      `<li class="${i === highlight ? 'you' : ''}"><span>${e.name}</span><b>${e.score}</b></li>`
    ).join('');
  }

  showScores() {
    this.renderBoard(this.el.scoreBoard, Scores.top(this.game, 10));
    const s = Scores.stats(this.game);
    const mins = Math.round(s.seconds / 60);
    this.el.lifetime.textContent = s.plays
      ? `${s.plays} GAMES · ${s.points} POINTS · ${mins} MIN PLAYED`
      : 'NO GAMES YET';
    this.show('s-scores');
  }

  /** Arcade three-character entry. Resolves with the chosen name. */
  buildNameEntry() {
    this.letters = ['A', 'A', 'A'];
    this.el.nameSlots.innerHTML = '';
    this.slotEls = [0, 1, 2].map(i => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML = '<button aria-label="up">▲</button><b>A</b><button aria-label="down">▼</button>';
      const [up, chr, down] = slot.children;
      const move = d => {
        const k = (ALPHABET.indexOf(this.letters[i]) + d + ALPHABET.length) % ALPHABET.length;
        this.letters[i] = ALPHABET[k];
        chr.textContent = this.letters[i];
        chr.classList.remove('roll'); void chr.offsetWidth; chr.classList.add('roll');
        sfx.tap();
      };
      up.addEventListener('click', () => move(1));
      down.addEventListener('click', () => move(-1));
      chr.addEventListener('click', () => move(1));
      this.el.nameSlots.appendChild(slot);
      return chr;
    });

    this.onKeyName = e => {
      if (!this.pendingName) return;
      const c = e.key.toUpperCase();
      if (ALPHABET.includes(c) && c.length === 1) {
        this.letters[this.cursor % 3] = c;
        this.slotEls[this.cursor % 3].textContent = c;
        this.cursor++;
      } else if (e.key === 'Enter') $('nameOk').click();
      else if (e.key === 'Backspace') this.cursor = Math.max(0, this.cursor - 1);
    };
    addEventListener('keydown', this.onKeyName);

    $('nameOk').addEventListener('click', () => {
      if (!this.pendingName) return;
      sfx.tap();
      const done = this.pendingName;
      this.pendingName = null;
      done(this.letters.join(''));
    });
  }

  askName(initial, title) {
    this.letters = (initial || 'AAA').padEnd(3, 'A').slice(0, 3).toUpperCase().split('');
    this.slotEls.forEach((el, i) => { el.textContent = this.letters[i]; });
    this.cursor = 0;
    this.el.nameTitle.textContent = title;
    this.show('s-name');
    return new Promise(res => { this.pendingName = res; });
  }

  /* ------------------------------ round over ------------------------------ */
  async end(r) {
    this.setHud(false);
    this.effect({ freeze: 0, double: 0, frenzy: 0 });

    this.el.endScore.textContent = r.score;
    const per = r.duration / 60;
    const tiers = [180 * per, 420 * per, 720 * per];
    [...this.el.stars.children].forEach((s, i) => {
      s.classList.remove('lit');
      if (r.score >= tiers[i]) setTimeout(() => s.classList.add('lit'), 120 + i * 140);
    });
    this.el.endStats.innerHTML = (r.stats || [])
      .map(([label, value]) => `<li>${label}<b>${value}</b></li>`).join('');

    Scores.logPlay(this.game, r.score, r.duration);
    const rank = Scores.rank(this.game, r.score);
    this.el.endRank.hidden = true;
    this.renderBoard(this.el.endBoard, Scores.top(this.game, 5));
    this.show('s-end');

    if (rank === null) return;

    // made the board — let the score land, then take their name
    sfx.record();
    await new Promise(res => setTimeout(res, 900));
    const name = await this.askName(Scores.lastName(),
      rank === 1 ? 'NEW RECORD!' : `TOP ${rank}!`);
    const res = Scores.add(this.game, name, r.score);

    this.el.endRank.hidden = false;
    this.el.endRank.textContent = res.isRecord ? '★ NEW RECORD ★' : `#${res.rank} ON THE BOARD`;
    this.renderBoard(this.el.endBoard, res.list.slice(0, 5), res.rank <= 5 ? res.rank - 1 : -1);
    this.refreshBest();
    this.show('s-end');
    sfx.combo(5);
  }
}
