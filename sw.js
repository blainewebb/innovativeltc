/* NutriTrack service worker — offline app shell.
   Bump CACHE when the shell changes so old caches are cleared. */
const CACHE = 'nutritrack-v5';
const SHELL = [
  './tracker.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // never touch API POSTs (Anthropic, etc.)

  const url = new URL(req.url);
  // Live data APIs — always go to network, never cache.
  if (url.hostname.includes('openfoodfacts.org') || url.hostname.includes('api.anthropic.com')) {
    return; // default browser handling
  }

  // App shell + CDN libs: cache-first, fall back to network and cache it.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && (url.origin === location.origin || SHELL.includes(req.url))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./tracker.html')))
  );
});
