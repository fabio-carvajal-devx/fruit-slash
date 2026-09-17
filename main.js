/* Boot: pick a game, wire it to the shared UI shell. */
import { App } from './engine/app.js';
import { UI } from './engine/ui.js';
import * as audio from './engine/audio.js';
import { sfx } from './engine/audio.js';
import { goImmersive, releaseWake, guardGestures, registerSW } from './engine/pwa.js';
import { FruitSlash } from './games/fruit-slash/index.js';

const GAME = { id: 'fruit-slash', title: 'Fruit Slash' };
const ui = new UI(GAME.id);
const app = new App(document.getElementById('game'));

const scene = new FruitSlash({
  score: v => ui.score(v),
  clock: (l, t) => ui.clock(l, t),
  banner: (t, c) => ui.banner(t, c),
  effect: fx => ui.effect(fx),
  flashBomb: () => ui.flashBomb(),
  end: r => { releaseWake(); app.hold(); ui.end(r); }
});
scene.mount(app);
app.scene = scene;

/* ------------------------------- flow ------------------------------- */
async function play() {
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
  if (app.paused || scene.state !== 'running') return;
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

function goHome() {
  sfx.tap();
  releaseWake();
  app.hold();
  scene.leave();
  ui.setHud(false);
  ui.effect({ freeze: 0, double: 0, frenzy: 0 });
  ui.show('s-start');
}

const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
on('playBtn', play);
on('pauseBtn', doPause);
on('resumeBtn', doResume);
on('restartBtn', () => { app.hold(); scene.leave(); play(); });
on('againBtn', () => { app.hold(); scene.leave(); play(); });
on('homeBtn', goHome);
on('endHomeBtn', goHome);
on('settingsBtn', () => { sfx.tap(); ui.show('s-settings'); });
on('scoresBtn', () => { sfx.tap(); ui.showScores(); });
on('closeScores', () => { sfx.tap(); ui.show('s-start'); });
on('closeSettings', () => { sfx.tap(); ui.show('s-start'); });

addEventListener('keydown', e => {
  if (e.key === 'Escape' || e.key === 'p') {
    if (scene.state === 'running') app.paused ? doResume() : doPause();
  }
  if (e.key === ' ' && scene.state === 'idle') play();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !app.paused && scene.state === 'running') doPause();
});

guardGestures();
registerSW();

// ?debug exposes the internals for tuning from the console
if (new URLSearchParams(location.search).has('debug')) window.__fs = { app, scene, ui };
