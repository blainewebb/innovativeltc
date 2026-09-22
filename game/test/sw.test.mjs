/* Runebreaker service worker tests.
   The worker is plain script, not a module, so it is loaded into a tiny fake
   worker scope and its handlers are driven directly. These exist because a
   caching bug here is invisible in every other test: the app works perfectly,
   it is just months out of date on the only device that matters. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e.message}`); process.exitCode = 1; }
};

/** Load sw.js into a fake worker global and hand back its pieces. */
function loadWorker({ networkFails = false, served = {} } = {}) {
  const handlers = {};
  const store = new Map(Object.entries(served));
  const fetched = [];

  const cache = {
    addAll: async keys => { for (const k of keys) store.set(k, 'shell'); },
    match: async req => store.get(String(req)) ?? undefined,
    put: async (req, res) => { store.set(String(req), res); },
  };
  const caches = {
    _deleted: [],
    open: async () => cache,
    keys: async () => ['runebreaker-v1', 'runebreaker-v2', 'nutritrack-v9'],
    delete: async k => { caches._deleted.push(k); return true; },
    match: async req => store.get(String(req)) ?? undefined,
  };

  const sandbox = {
    self: {
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches,
    location: { origin: 'https://example.github.io' },
    fetch: async req => {
      fetched.push(String(req));
      if (networkFails) throw new Error('offline');
      return { status: 200, clone: () => 'fresh', _fresh: true };
    },
    URL,
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), sandbox);
  return { handlers, store, fetched, caches };
}

/** Run the fetch handler for one request and return what it responded with. */
async function respond(worker, url, { mode = 'no-cors', method = 'GET' } = {}) {
  let responded;
  const event = {
    request: { url, method, mode, toString: () => url },
    respondWith: p => { responded = p; },
  };
  worker.handlers.fetch(event);
  return responded === undefined ? undefined : await responded;
}

const ORIGIN = 'https://example.github.io';

await (async () => {
  test('placeholder so the counter starts', () => {});

  /* ---- the bug this file exists for ---- */
  {
    const w = loadWorker({ served: { [`${ORIGIN}/game/js/main.js`]: 'STALE' } });
    const res = await respond(w, `${ORIGIN}/game/js/main.js`);
    test('a script comes from the network even when a cached copy exists', () => {
      assert.equal(res._fresh, true,
        'cache-first on scripts serves months-old code behind a fresh index.html');
      assert.ok(w.fetched.includes(`${ORIGIN}/game/js/main.js`));
    });
  }

  {
    const w = loadWorker({ served: { [`${ORIGIN}/game/styles.css`]: 'STALE' } });
    const res = await respond(w, `${ORIGIN}/game/styles.css`);
    test('a stylesheet comes from the network too', () => assert.equal(res._fresh, true));
  }

  /* ---- offline still works, which is the whole point of the worker ---- */
  {
    const w = loadWorker({ networkFails: true, served: { [`${ORIGIN}/game/js/main.js`]: 'CACHED' } });
    const res = await respond(w, `${ORIGIN}/game/js/main.js`);
    test('with no network a script falls back to the cache', () => assert.equal(res, 'CACHED'));
  }

  {
    const w = loadWorker({ networkFails: true, served: { [`${ORIGIN}/game/index.html`]: 'CACHED PAGE' } });
    const res = await respond(w, `${ORIGIN}/game/index.html`, { mode: 'navigate' });
    test('with no network the page falls back to the cache', () => assert.equal(res, 'CACHED PAGE'));
  }

  /* ---- the page was always network-first; keep it that way ---- */
  {
    const w = loadWorker({ served: { [`${ORIGIN}/game/index.html`]: 'STALE PAGE' } });
    const res = await respond(w, `${ORIGIN}/game/index.html`, { mode: 'navigate' });
    test('the page prefers the network', () => assert.equal(res._fresh, true));
  }

  /* ---- scope and safety ---- */
  {
    const w = loadWorker();
    const res = await respond(w, 'https://cdn.example.com/thing.js');
    test('another origin is left alone entirely', () => assert.equal(res, undefined));
  }

  {
    const w = loadWorker();
    const res = await respond(w, `${ORIGIN}/game/api`, { method: 'POST' });
    test('a POST is never intercepted', () => assert.equal(res, undefined));
  }

  /* ---- old caches are cleared, other apps in the repo are not ---- */
  {
    const w = loadWorker();
    let done;
    w.handlers.activate({ waitUntil: p => { done = p; } });
    await done;
    test('activating drops the previous Runebreaker cache', () =>
      assert.ok(w.caches._deleted.includes('runebreaker-v1')));
    test('activating leaves the other apps in this repo alone', () =>
      assert.ok(!w.caches._deleted.includes('nutritrack-v9'),
        'the tracker and quote tool have their own worker and cache'));
  }

  /* ---- a bumped cache name is what forces the swap on existing devices ---- */
  test('the cache name is versioned', () => {
    const src = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
    assert.match(src, /const CACHE = 'runebreaker-v\d+';/);
  });

  console.log(`${passed} service worker tests passed`);
})();
