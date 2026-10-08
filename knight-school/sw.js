// Offline support. The page is fetched fresh when online (so updates show up), and cached for offline play.
// chess.js and Stockfish ship in vendor/. The fonts (and the CDN fallbacks) are cached on install too.
// Bump CACHE when shipping changes to this file's list.
const CACHE = 'knight-school-v2';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './app.js', './board.js', './coach.js', './lessons.js', './books/winning-chess-strategy-for-kids.js', './books/the-chess-course.js',
  './books/fischer-teaches-chess.js', './books/traps-and-zaps.js', './vendor/chess.min.js', './vendor/stockfish.js'];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;800&family=Noto+Sans+Symbols+2&display=swap',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).then(() => Promise.all(CDN.map(u => c.add(new Request(u, {mode: 'cors'})).catch(() => {}))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith('knight-school-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // Game scripts: network first so updates show up, cache as the offline fallback.
  if (new URL(req.url).origin === location.origin) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })
      .catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
