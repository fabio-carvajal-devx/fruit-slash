/* Cache-first service worker. Bump CACHE when you change any file. */
const CACHE = 'arcade-v11';

/* Never run in front of a dev server. A cache-first worker on localhost
   serves yesterday's build over today's edits, and because it also serves
   its own replacement it can keep doing so indefinitely. If an older copy
   of this worker is registered on a dev host, it retires itself here. */
const DEV = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './main.js',
  './css/style.css',
  './engine/app.js', './engine/view.js', './engine/scene.js', './engine/input.js',
  './engine/particles.js', './engine/audio.js', './engine/music.js',
  './engine/ui.js', './engine/scores.js', './engine/rhythm.js',
  './engine/menu-scene.js', './engine/pwa.js', './engine/util.js',
  './games/registry.js',
  './games/fruit-slash/index.js', './games/fruit-slash/fruits.js',
  './games/fruit-slash/director.js', './games/fruit-slash/background.js',
  './games/asteroid-run/index.js', './games/asteroid-run/art.js',
  './games/asteroid-run/weapons.js', './games/asteroid-run/background.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  if (DEV) { self.skipWaiting(); return; }
  // `cache: 'reload'` matters: a plain addAll() is allowed to satisfy itself
  // from the browser's HTTP cache, which can bake a stale file into a fresh
  // precache and ship half an old build to someone who already installed.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  if (DEV) {
    e.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
    return;
  }
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (DEV) return;                       // straight to the network
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
