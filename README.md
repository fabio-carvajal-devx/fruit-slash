# The Arcade

**Play: https://fabio-carvajal-devx.github.io/fruit-slash/**

A tiny arcade cabinet for kids. Two games so far, one button to start each,
pause top-left, a round is over in one to three minutes. Plain HTML and ES
modules — no build step, no dependencies, installable as a PWA and playable
with the tablet in aeroplane mode.

```bash
python3 tools/serve.py 8080      # then open http://localhost:8080
```

---

## 1. The games

### Fruit Slash — swipe to slice

Fruit is lobbed from below on parabolic arcs; a swipe is a line segment, and
anything it crosses splits along the swipe angle. Three in one window is a
combo. Bombs cost 20 points and shake the screen — they do not end the run.

Cut fruit can be cut again: halves split into chunks, chunks burst. Every
re-cut scores and feeds the combo window, so chasing the debris of a big
watermelon is worth doing.

Power-ups: **Freeze** (world at 34% for 5.5s, the clock keeps real time),
**Frenzy** (6s of dense throws, no bombs), **×2** (8s), **+10s**.

### Asteroid Run — tilt to fly

Lean the tablet to steer the rocket, tap to fire. Collect energy cells, shoot
rocks apart, kill saucers, and every three minutes a mothership shows up.

- **Steering** reads device orientation, mapped through the current screen
  angle so "lean left" means left however the tablet is held, and calibrated
  to whatever angle the player is already holding it at. Dragging a finger
  works too, for desks and anything without a gyroscope.
- **Weapons** are pickups like any other item, held for 14 seconds:
  **Bolt** (default), **Twin**, **Spread**, **Beam** (pierces everything).
  Taking a hit knocks the gun back to Bolt.
- **The boss** sweeps overhead, fires slow readable spreads and drops rocks.
  It has a health bar, its own heavier music, and a 200-point bounty.

Power-ups: **Shield** (absorbs one hit), **Slow-mo**, **×2**, **+10s**.

Neither game has a lose condition. Only the clock ends a round.

---

## 2. Areas

`engine/` is game-agnostic and carries both games; `games/<id>/` is everything
specific to one.

```
engine/
  view.js        canvas, DPR, and the unit system
  app.js         fixed-timestep loop, screen shake, scene host
  scene.js       the contract a game implements
  rhythm.js      the beat grid every game paces itself from
  input.js       multi-touch blades, trails, swipe segments
  particles.js   juice, sparks, smoke, shockwaves, debris, confetti
  audio.js       synthesised sound effects
  music.js       the procedural soundtrack
  ui.js          screens, HUD, settings, name entry, leaderboard
  scores.js      records and lifetime stats, keyed by game id
  menu-scene.js  the catalogue's synthwave backdrop
  pwa.js         fullscreen, orientation, wake lock, gestures, SW
games/
  registry.js    the catalogue: one entry per game
  fruit-slash/   fruits.js, director.js, background.js, index.js
  asteroid-run/  art.js, weapons.js, background.js, index.js
main.js          routes between the catalogue and a game
```

### 2.1 No pixels anywhere

The short edge of the screen is **always exactly 100 units**, on every device.
`View` computes `u = min(width, height) / 100` and sets the canvas transform to
`dpr * u`, so games are authored in units and the backing store is sized for
the real device pixel ratio (capped at 2.5). The CSS follows the same rule:
every size is `vmin`, `em` or `%`.

Nothing is a bitmap. Fruit, rockets, rocks, saucers, the blade, the moon, the
grid and the icons are canvas paths and gradients. The whole cabinet is under
a megabyte.

### 2.2 Motion

A fixed 120 Hz simulation with an accumulator, decoupled from the render frame,
so physics is identical on a 60 Hz tablet and a 120 Hz one. Returning from a
background tab clamps `dt` so nothing teleports.

### 2.3 Gestures

Pointer Events throughout, so finger, stylus and mouse are one code path.

- Every finger is its own blade — kids use two hands.
- Coalesced events are read, so a fast swipe on a 120 Hz digitiser produces
  every intermediate segment instead of one long chord, and long jumps are
  subdivided so a flick curves instead of snapping to a bar.
- Slicing tests each *segment* against each fruit, so a fast swipe cannot
  tunnel through one.
- Hit padding is generous on fruit and tight on bombs: easy to hit what you
  want, harder to hit what you don't.
- Asteroid Run tracks exactly one pointer id for steering, so a stray or stuck
  pointer cannot take the controls.
- `touch-action: none`, `overscroll-behavior: none` and preventDefault on
  `touchmove` / `gesturestart` / `dblclick`, so a swipe is never a scroll, a
  zoom or a back-navigation.
- Haptics on slices, combos, hits and pickups, armed after the first tap.

### 2.4 Pace and rhythm

Random spawn timers give inconsistent difficulty: an unlucky run of rolls turns
an easy round into chaos. So timing is not random. `engine/rhythm.js` runs a
beat grid whose tempo ramps across the round; each game reacts on the beat.
Randomness decides *what* arrives and *where*, never *when*.

A density governor then caps what can be in the air at once — 3 rising to 6 in
both games. That, not the patterns, is the real difficulty dial: the patterns
ask for more than the cap allows, and the cap decides what a player at this
point in the round can be asked to handle.

The same intensity curve drives the music, so the soundtrack tightens as the
round does.

### 2.5 Music

`engine/music.js` synthesises a synthwave soundtrack at run time from a pattern
table — nothing is sampled or downloaded, so it costs zero bytes and works
offline. Four-on-the-floor kick, sixteenth bass, detuned saw arps over a minor
progression, with a delay locked to a straight eighth.

It is **layered by intensity** rather than fixed. A round opens with pad and a
half-time kick; bass, hats, clap, the sixteenth arp and a lead each arrive at
their own threshold as the game speeds up. The boss has its own heavier track.

If a tab is throttled the scheduler is starved; rather than dumping the backlog
in a heap it resyncs to the next downbeat. A track may instead name an audio
`file`, which is streamed and looped — the hook for a licensed recording.

### 2.6 Records and storage

Everything persists in `localStorage`, under one namespace:

| Key | Holds |
| --- | --- |
| `arcade/v1` | top-ten records per game, last name used, lifetime stats |
| `arcade/settings/<game>` | round length, bombs, sound, music, speed |

Arcade rules for records: three characters, cycled with big up/down buttons (a
keyboard works too). After every round the score is checked against that game's
top ten; if it lands, the screen says **NEW RECORD!** or **TOP n!**, takes the
name, and shows the board with the new row lit. It defaults to the last name
used, so a repeat player just taps OK. The trophy button shows the full board
plus lifetime games, points and minutes played.

`engine/scores.js` is one store for the whole cabinet keyed by game id, and the
shell owns the flow — a new game gets records by calling `ui.end(result)`.

### 2.7 Shipping

`manifest.webmanifest` plus a cache-first service worker precaching every file.
Icons are generated from maths by `tools/make-icons.py` (pure stdlib — it
writes the PNG bytes itself).

Two things that are easy to get wrong and are handled here:

- The precache fetches with `cache: 'reload'`. A plain `addAll()` may satisfy
  itself from the browser's HTTP cache, which bakes a stale file into a fresh
  precache and ships half an old build to a tablet that already installed.
- The worker refuses to run on localhost, and `tools/serve.py` sends
  `Cache-Control: no-store`. A cache-first worker in front of a dev server
  serves yesterday's build over today's edits — and since it also serves its
  own replacement, it can keep doing so indefinitely.

Tapping Play requests fullscreen, locks landscape and takes a wake lock, none
of it awaited, so a browser that stalls or refuses cannot block the round.

---

## 3. Running it on the tablet

Open **https://fabio-carvajal-devx.github.io/fruit-slash/** in Chrome, then
menu → *Install app*. After the first load it runs offline.

Installing to the home screen needs a secure context. Serving the folder over
`http://192.168.x.x` plays fine in the browser but will never offer "Add to
home screen" — that is why it lives on Pages rather than your laptop.

### Shipping a change

```bash
git add -A && git commit -m "..." && git push
```

Pages rebuilds in about a minute. **Bump `CACHE` in `sw.js` in the same
commit**, or a tablet that already installed keeps serving the old build.

## 4. Settings

Per game, behind the gear: round length (60s / 90s / 2m / 3m), bombs on/off
(Fruit Slash), sound, music, and speed (easy / normal / fast, which scales the
tempo ramp).

## 5. Adding a third game

Implement `enter / step / draw / overlay` from `engine/scene.js`, add an entry
to `games/registry.js`, and list its files in `sw.js`. The loop, unit system,
input, particles, audio, music, HUD, settings, theme, leaderboard and PWA
plumbing all come for free, and it will look and behave like the other two
because it is the same shell.

## 6. Development

- `python3 tools/serve.py 8080` — dev server that never lets the browser cache.
- `?debug` in the URL exposes `window.__fs = { app, ui, music, scene, meta }`.

## 7. Not yet verified on hardware

Tilt steering is written against `deviceorientation` and the screen-angle
mapping, but this machine has no gyroscope, so it has only been exercised
through the finger fallback. Worth a two-minute check on the tablet: lean it
both ways in landscape and confirm the rocket follows.
