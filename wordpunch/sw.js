/* Word Punch service worker. Scoped to /wordpunch/ so it never touches the
   other apps in this repo. Everything is network-first: a fresh deploy shows
   up on the next load, and the cache only answers when there is no network.
   (Cache-first for scripts once left another app in this repo running
   months-old code behind a fresh page.) Bump CACHE with VERSION in data.js. */
const CACHE = 'wordpunch-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './js/main.js',
  './js/engine.js',
  './js/data.js',
  './js/storage.js',
  './js/sfx.js',
  './js/art.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('wordpunch-')).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (isPage ? caches.match('./index.html') : undefined)))
  );
});
