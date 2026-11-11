// Offline support: cache the whole game on first visit, then serve from cache.
// Bump VERSION whenever any file below changes, so players get the update.
const VERSION = 'ogashop-v43';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/main.js',
  './js/ui.js',
  './js/engine.js',
  './js/core.js',
  './js/events.js',
  './js/parser.js',
  './js/data.js',
  './js/art.js',
  './js/voice.js',
  './js/bills.js',
  './js/goals.js',
  './js/run.js',
  './js/quiz.js',
  './js/challenge.js',
  './js/analytics.js',
  './js/account.js',
  './js/market.js',
  './js/stages.js',
  './js/junior.js',
  './js/fx.js',
  './js/cups.js',
  './js/venues.js',
  './js/username.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
