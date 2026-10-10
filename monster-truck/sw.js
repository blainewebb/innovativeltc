// Offline support. Saves the whole game (page, fonts, icons, voice clips) so it plays with no internet.
// The page and the voice list are fetched fresh when online, so updates show up.
// Bump VERSION when fonts, icons or content.js change. Voice clips live in their own cache, which a
// version bump keeps; new clips are downloaded and unused ones removed whenever the game opens online.
const VERSION = 'monster-truck-v2';
const VOICE = 'monster-truck-voice';
const FILES = [
  "./",
  "index.html",
  "content.js",
  "manifest.webmanifest",
  "voice/manifest.json",
  "fonts/fonts.css",
  "fonts/andika-400.woff2",
  "fonts/andika-700.woff2",
  "fonts/baloo2-600.woff2",
  "fonts/baloo2-700.woff2",
  "fonts/baloo2-800.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

// Download any clip this device doesn't have yet, a few at a time, and drop clips no longer listed.
let filling = null;
function fillVoice() {
  if (filling) return filling;
  filling = (async () => {
    const res = await fetch('voice/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return;
    (await caches.open(VERSION)).put('voice/manifest.json', res.clone());
    const want = new Set(Object.values(await res.json()).map(f => new URL('voice/' + f, self.registration.scope).href));
    const cache = await caches.open(VOICE);
    const have = new Set((await cache.keys()).map(r => r.url));
    for (const url of have) if (!want.has(url)) await cache.delete(url);
    const todo = [...want].filter(u => !have.has(u));
    const worker = async () => {
      for (let u; (u = todo.pop());) {
        try { const r = await fetch(u); if (r.ok) await cache.put(u, r); } catch (e) { /* offline: try again next time */ }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  })().catch(() => {}).finally(() => { filling = null; });
  return filling;
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== VOICE && k.startsWith('monster-truck-')).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(fillVoice));
});
// The page asks for this each time it opens, so a download cut short finishes later.
self.addEventListener('message', e => { if (e.data === 'fill-voice') e.waitUntil(fillVoice()); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const fresh = req.mode === 'navigate' ? 'index.html' : req.url.endsWith('/voice/manifest.json') ? 'voice/manifest.json' : null;
  if (fresh) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(fresh, copy)); } return r; })
      .catch(() => caches.match(fresh)));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
      if (r.ok && req.url.includes('/voice/') && req.url.endsWith('.mp3')) { const copy = r.clone(); caches.open(VOICE).then(c => c.put(req, copy)); }
      return r;
    }))
  );
});
