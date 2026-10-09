/* Offline voice clips, shared by the Word Punch and Word Kick service workers
   (they load it with importScripts after setting self.VOICE_DIR).

   The clips are saved in their own cache, 'wordvoice-clips', which the
   version bumps in sw.js never clear. A clip's file name is a hash of its
   text, so a cached file is always the right one for its line. Both games use
   the same clips from the same address, so they share the one cache.

   Every time a game opens, the page asks its worker to fetch whatever clips
   are still missing (see cacheAllClips). Each run only fetches what's missing,
   so a download that gets cut off just carries on next time. */
const VOICE_CACHE = 'wordvoice-clips';

const isClip = url => url.href.startsWith(self.VOICE_DIR) && url.pathname.endsWith('.mp3');

/* Answer a clip request from the cache, fetching and saving it if missing.
   Audio elements often ask for byte ranges (Safari always does), and they
   won't play a full 200 answer to a range request, so slice it into a 206. */
async function clipResponse(req) {
  const cache = await caches.open(VOICE_CACHE);
  let res = await cache.match(req.url);
  if (!res) {
    res = await fetch(req.url).catch(() => null);
    if (!res || !res.ok) return res || Response.error();
    await cache.put(req.url, res.clone()).catch(() => {});
  }
  return sliced(req, res);
}

async function sliced(req, res) {
  const range = req.headers.get('range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  let start, end;
  if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; }   // last N bytes
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

/* Fetch every clip in the manifest that isn't saved yet, a few at a time, and
   drop saved clips the games no longer use. Stops quietly when offline. */
let caching = null;
function cacheAllClips() {
  if (caching) return caching;
  caching = (async () => {
    const manifestUrl = new URL('manifest.json', self.VOICE_DIR).href;
    const manifest = await fetch(manifestUrl).then(r => (r.ok ? r.json() : null))
      .catch(() => caches.match(manifestUrl).then(r => (r ? r.json() : null)));
    if (!manifest || typeof manifest !== 'object') return;
    const wanted = new Set(Object.values(manifest).map(f => new URL(f, self.VOICE_DIR).href));
    const cache = await caches.open(VOICE_CACHE);
    const have = new Set();
    for (const req of await cache.keys()) {
      if (!req.url.startsWith(self.VOICE_DIR)) continue;
      if (wanted.has(req.url)) have.add(req.url);
      else await cache.delete(req);
    }
    const queue = [...wanted].filter(u => !have.has(u));
    let offline = false;
    const worker = async () => {
      while (queue.length && !offline) {
        const url = queue.shift();
        try {
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        } catch { offline = true; }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
  })().catch(() => {}).finally(() => { caching = null; });
  return caching;
}

self.addEventListener('message', e => {
  if (e.data === 'cache-voice') e.waitUntil(cacheAllClips());
});
