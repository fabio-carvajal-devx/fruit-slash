/* --------------------------------------------------------------
   The cabinet. Routes between the catalogue and whichever game the
   player picked, and keeps the soundtrack in step with both.
   -------------------------------------------------------------- */
import { App } from './engine/app.js';
import { UI } from './engine/ui.js';
import { MenuScene } from './engine/menu-scene.js';
import * as audio from './engine/audio.js';
import { sfx } from './engine/audio.js';
import { music } from './engine/music.js';
import { GAMES } from './games/registry.js';
import { goImmersive, releaseWake, guardGestures, registerSW } from './engine/pwa.js';

const ui = new UI();
const app = new App(document.getElementById('game'));
const menu = new MenuScene();

let meta = null;      // the chosen game's registry entry
let scene = null;     // its live Scene instance

const hooks = {
  score: v => ui.score(v),
  clock: (l, t) => ui.clock(l, t),
  banner: (t, c) => ui.banner(t, c),
  effect: fx => ui.effect(fx),
  flashBomb: () => ui.flashBomb(),
  intensity: v => music.setIntensity(0.25 + v * 0.75),
  music: name => music.play(name || (meta ? meta.track : 'menu')),
  end: r => { releaseWake(); app.hold(); music.setIntensity(0.35); ui.end(r); }
};

/* ------------------------------ routing ------------------------------ */
function showCatalog() {
  app.hold();
  if (scene) { scene.leave(); scene = null; }
  meta = null;
  app.attach(menu);
  ui.setHud(false);
  ui.effect({});
  ui.renderCatalog(GAMES, pickGame);
  music.play('menu');
  music.setIntensity(0.35);
  ui.show('s-home');
}

async function pickGame(g) {
  audio.unlock();
  meta = g;
  const mod = await g.load();
  scene = new mod.default(hooks);
  app.attach(scene);
  ui.setGame(g);
  music.play(g.track);
  music.setIntensity(0.35);
  ui.show('s-start');
}

async function play() {
  if (!scene) return;
  audio.unlock();
  sfx.tap();
  goImmersive();            // never awaited: a browser that stalls or refuses
                            // fullscreen must not be able to block the round
  ui.hideScreens();
  ui.setHud(true);
  ui.score(0);
  ui.clock(ui.save.duration, ui.save.duration);
  await ui.countdown();
  app.setScene(scene, {
    duration: Number(ui.save.duration),
    bombs: !!ui.save.bombs,
    speed: Number(ui.save.speed)
  });
  app.play();
}

function doPause() {
  if (app.paused || !scene || scene.state !== 'running') return;
  app.hold();
  sfx.tap();
  ui.show('s-pause');
}

async function doResume() {
  sfx.tap();
  ui.hideScreens();
  await ui.countdown();
  app.play();
}

function goStart() {
  sfx.tap();
  releaseWake();
  app.hold();
  scene?.leave();
  ui.setHud(false);
  ui.effect({});
  music.setIntensity(0.35);
  ui.show('s-start');
}

const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
on('playBtn', play);
on('pauseBtn', doPause);
on('resumeBtn', doResume);
on('restartBtn', () => { app.hold(); scene?.leave(); play(); });
on('againBtn', () => { app.hold(); scene?.leave(); play(); });
on('homeBtn', goStart);
on('endHomeBtn', goStart);
on('backBtn', () => { sfx.tap(); showCatalog(); });
on('settingsBtn', () => { sfx.tap(); ui.show('s-settings'); });
on('closeSettings', () => { sfx.tap(); ui.show('s-start'); });
on('scoresBtn', () => { sfx.tap(); ui.showScores(); });
on('closeScores', () => { sfx.tap(); ui.show('s-start'); });

addEventListener('keydown', e => {
  if (e.key === 'Escape' || e.key === 'p') {
    if (scene?.state === 'running') app.paused ? doResume() : doPause();
  }
  if (e.key === ' ' && scene && scene.state === 'idle') play();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !app.paused && scene?.state === 'running') doPause();
});

/* Browsers only allow audio after a gesture, so the soundtrack waits
   for the first touch rather than failing silently on load. */
addEventListener('pointerdown', () => {
  audio.unlock();
  music.play(meta ? meta.track : 'menu');
}, { once: true });

guardGestures();
registerSW();
showCatalog();

if (new URLSearchParams(location.search).has('debug'))
  window.__fs = { app, ui, music, get scene() { return scene; }, get meta() { return meta; } };
