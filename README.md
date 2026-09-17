# Fruit Slash

A one-button, two-minute fruit-slicing game for kids. Plain HTML + ES modules,
no build step, no dependencies, installable as a PWA on an Android tablet.

```bash
python3 -m http.server 8080      # then open http://localhost:8080
```

---

## 1. What the original does, and what we kept

Fruit Ninja's classic Arcade mode is 60 seconds of fruit lobbed from below on
parabolic arcs. A swipe is a line segment; anything it crosses splits along the
swipe angle into two halves that inherit the parent's velocity plus a
perpendicular kick. Three fruit in one swipe is a combo. Bombs end the run.
Three special bananas — freeze, frenzy, double — reshape the next few seconds.

The load-bearing details, the ones that make it feel good rather than merely work:

| Detail | Why it matters |
| --- | --- |
| Fruit apex lands at 60–90% of screen height | every throw is reachable without the player lunging |
| The cut runs along the *swipe* angle, not the fruit's | the player feels they aimed the knife |
| Halves separate perpendicular to the cut | reads as "it came apart", not "it despawned" |
| A minimum swipe speed is required | a resting finger cannot farm points |
| Juice stains the screen and fades | the last few seconds are visible as a mess you made |

### What changed for a five-year-old

- **Bombs cost 20 points, they do not end the run.** A kid who loses at second 12
  does not get a second turn; they get up and leave. There is no lose condition
  at all — only the clock.
- **Missing a fruit costs nothing.** Classic mode's three-strikes rule punishes
  the exact thing a small child is worst at.
- **Everything is bigger and slower.** Fruit radius is ~8% of the short screen
  edge and flight time is about two seconds.
- **One button.** Play. Pause is top-left, where a right-handed grip on a tablet
  does not reach it by accident.
- **Stars, not rank.** The end screen awards 1–3 stars against a score-per-minute
  threshold, so the target scales with the round length.

---

## 2. Areas

The build is split so each area can be re-tuned without touching the others.
`engine/` is game-agnostic and is meant to carry a second and third game;
`games/fruit-slash/` is everything specific to this one.

```
engine/
  view.js        canvas, DPR, and the unit system
  app.js         fixed-timestep loop, screen shake, scene host
  scene.js       the four-method contract a game implements
  input.js       multi-touch blades, trails, swipe segments
  particles.js   juice, sparks, smoke, confetti + the splatter layer
  audio.js       synthesised SFX (no audio files ship)
  ui.js          screens, HUD, settings, name entry, leaderboard
  scores.js      the arcade record table, keyed by game id
  pwa.js         fullscreen, orientation, wake lock, gesture guards, SW
games/fruit-slash/
  index.js       rules: physics, slicing, scoring, power-ups
  fruits.js      vector fruit definitions and their renderers
  director.js    what gets thrown, and when
  background.js  the parallax night garden
main.js          wires one game to the shell
```

### 2.1 No pixels anywhere

The short edge of the screen is **always exactly 100 units**, on every device.
`View` computes `u = min(width, height) / 100` and sets the canvas transform to
`dpr * u`, so the game is authored in units and the backing store is sized for
the real device pixel ratio (capped at 2.5). A fruit of radius 8 is 8% of the
short edge on a phone, a tablet and a 4K monitor.

The CSS follows the same rule: every size is `vmin`, `em` or `%`. The string
`px` appears nowhere in the layout.

Nothing is a bitmap. Fruit, bombs, power-ups, the blade, the moon, the hills and
the icons are all canvas paths and gradients, so there is no resolution to
outgrow and the whole game is about 90 KB.

### 2.2 Motion

A fixed 120 Hz simulation step with an accumulator, decoupled from the render
frame. Physics is identical on a 60 Hz tablet and a 120 Hz one; only the number
of frames drawn changes. Returning from a background tab clamps `dt` to 0.25 s
so nothing teleports.

Gravity is 132 units/s². A throw picks its apex first (62–92% of screen height)
and solves for the launch velocity, which is why no fruit ever sails off the top.

### 2.3 Gestures

Pointer Events throughout, so finger, stylus and mouse are one code path.

- **Every finger is its own blade.** Kids use two hands.
- **Coalesced events are read** (`getCoalescedEvents`), so a fast swipe on a
  120 Hz digitiser produces every intermediate segment instead of one long chord.
- **Long jumps are subdivided** at 3.5 units, so a flick curves instead of
  snapping to a straight bar.
- Slicing tests each *segment* against each fruit, not each frame's endpoint, so
  a fast swipe cannot tunnel through a fruit.
- Hit padding is generous on fruit (×1.05) and tight on bombs (×0.82): easy to
  hit what you want, harder to hit what you don't.
- The trail is drawn as per-segment quads with round joins, so a folded-back
  swipe cannot punch a hole through the ribbon.
- `touch-action: none`, `overscroll-behavior: none`, and preventDefault on
  `touchmove` / `gesturestart` / `dblclick`, so a swipe is never a scroll, a
  zoom or a back-navigation.
- Haptics on every slice, combo and bomb.

### 2.4 Multi-slice

A fruit can be cut more than once. The first cut makes two halves; each half is
still a target and splits again into two smaller chunks; a chunk bursts into
juice. Re-cuts score 5 and count toward the combo window, so chasing the debris
of a big watermelon is worth doing. A 0.1 s re-cut delay stops a single stroke
shredding its own output in one frame.

### 2.5 Pace and rhythm

Random spawn timers produce inconsistent difficulty: an unlucky run of rolls
turns an easy round into chaos. So timing is not random.

- **A beat grid.** Tempo ramps from 80 to 136 BPM across the round, and every
  bar of eight beats follows a rhythm pattern chosen by intensity tier. Strong
  beats (0 and 4) always throw.
- **Randomness lives in what, not when** — which fruit, which of five lanes,
  which arc. Two rounds at the same setting feel identical in pace and never
  identical in content.
- **Syncopation.** One throw in five is nudged to the following beat so the grid
  never sounds mechanical.
- **A density governor** caps how much can be in the air at once (3 rising to 6,
  12 in frenzy) and forces a throw whenever the screen is empty. This is the
  actual difficulty dial: the patterns ask for more than the cap allows, and the
  cap decides what a player at this point in the round can be asked to handle.
- Bombs land only on off-beats 3 and 7, at most one per bar, never in the first
  six seconds and never during frenzy.
- Power-ups arrive on a downbeat every three bars, so they land *on* the pulse.

### 2.6 Power-ups

| | Effect |
| --- | --- |
| ❄️ Freeze | world runs at 34% for 5.5 s — the clock does not slow |
| ⭐ Frenzy | 6 s of dense throws, bombs suppressed |
| ✕2 Double | 8 s of doubled points, including combo bonuses |
| ⏱ +10s | ten seconds back on the clock |

Each has its own screen tint, its own arpeggio and its own banner.

### 2.7 Background

Five parallax planes: a cached sky gradient with moon, halo and stars; three
procedurally generated ridge silhouettes; drifting lanterns; falling petals; and
foreground foliage framing the bottom corners. Each plane pans at its own rate
from a slow sine drift plus device tilt (`deviceorientation`, smoothed, ignored
where unavailable). A 20% scrim sits between the scenery and the gameplay so
fruit always reads louder than the background.

### 2.8 Audio

Every sound is synthesised at runtime with the Web Audio API — filtered noise
bursts for slices, a sawtooth thud for bombs, arpeggios for power-ups. No audio
files, nothing to download, nothing to cache.

### 2.9 Records

Arcade rules: three characters, cycled with big up/down buttons (a physical
keyboard works too). After every round the score is checked against that game's
top ten; if it lands, the screen says **NEW RECORD!** or **TOP n!**, takes the
name, and shows the board with the new row lit. The entry defaults to the last
name used, so a repeat player just taps OK.

`engine/scores.js` holds one store for the whole cabinet, keyed by game id, and
the shell owns the entire flow — so a second minigame gets records, name entry
and the record notice by calling `ui.end(result)` and nothing else. Settings
live at `arcade/settings/<game>` under the same shape.

### 2.10 Shipping

`manifest.webmanifest` + a cache-first service worker precaching every file, so
the game works with the tablet in aeroplane mode. Icons are generated from maths
by `tools/make-icons.py` (pure stdlib — it writes the PNG bytes itself).

Tapping Play requests fullscreen, locks landscape and takes a wake lock, all in
`try/catch` so a browser that refuses any of them still plays fine.

---

## 3. Running it on the tablet

Installing to the home screen needs a **secure context**. `http://192.168.x.x`
will play in the browser but will not offer "Add to home screen" — you need
HTTPS or localhost.

```bash
git add -A && git commit -m "Fruit Slash"
gh repo create fruit-slash --public --source=. --push
```

Then Settings → Pages → Branch `main` / root. A minute later the game is at
`https://<user>.github.io/fruit-slash/`. Open it in Chrome on the tablet,
menu → *Install app*. After the first load it runs offline.

**When you change a file, bump `CACHE` in `sw.js`.** The worker is cache-first,
so an unbumped version keeps serving the old build.

## 4. Settings and scores

The trophy on the start screen opens the top ten. The gear opens round length (60/90/120 s), bombs on/off, sound
on/off, and speed (easy/normal/fast, which scales the tempo ramp). Choices and
the high score persist in `localStorage`.

## 5. Adding a second game

Implement `enter / step / draw / overlay` from `engine/scene.js`, give it an id,
then point `main.js` at it. The loop, unit system, blades, particles, audio,
HUD, settings, theme, leaderboard and PWA plumbing all come for free, and the
new game looks and behaves like this one because it is literally the same shell.

## 6. Development

`?debug` in the URL exposes `window.__fs = { app, scene, ui }` for tuning from
the console.
