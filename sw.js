/* Cache-first service worker. Bump CACHE when you change any file. */
const CACHE = 'fruit-slash-v5';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './main.js',
  './css/style.css',
  './engine/app.js', './engine/view.js', './engine/scene.js', './engine/input.js',
  './engine/particles.js', './engine/audio.js', './engine/ui.js',
  './engine/pwa.js', './engine/util.js', './engine/scores.js',
  './games/fruit-slash/index.js', './games/fruit-slash/fruits.js',
  './games/fruit-slash/director.js', './games/fruit-slash/background.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
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
