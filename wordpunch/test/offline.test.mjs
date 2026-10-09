/* Offline voice test, shared by Word Punch and Word Kick: installs the game's
   service worker in Chromium, waits for it to save every recorded clip, then
   cuts the network and checks the game still loads and the clips still play.
   Run: node test/offline.test.mjs  (expects a static server on PORT)
   APP is the game's folder on that server: '' for Word Punch (served from its
   own folder), 'wordkick/' for Word Kick (served from the repo root). */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(`${globalRoot}/playwright`));
}

const PORT = process.env.PORT || 8125;
const APP = process.env.APP || '';
const PAGE = `http://127.0.0.1:${PORT}/${APP}index.html`;
const VOICE = APP ? '../wordpunch/voice/' : './voice/';
const manifest = JSON.parse(readFileSync(new URL('../voice/manifest.json', import.meta.url), 'utf8'));
const files = [...new Set(Object.values(manifest))];

let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.error(`  FAIL ${name} ${extra}`); }
};

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(PAGE);
  // The game only registers its worker on https, so register it here the same
  // way and send the same message the game sends.
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('./sw.js');
    const reg = await navigator.serviceWorker.ready;
    reg.active.postMessage('cache-voice');
  });
  // Poll from Node: waitForFunction doesn't wait on an async check.
  let saved = 0;
  for (let t = Date.now(); Date.now() - t < 120000; await page.waitForTimeout(500)) {
    saved = await page.evaluate(async () => (await (await caches.open('wordvoice-clips')).keys()).length);
    if (saved >= files.length) break;
  }
  ok('every recorded clip is saved for offline', saved === files.length, `${saved}/${files.length}`);

  await page.reload();
  ok('the page is run by the worker', await page.evaluate(() => !!navigator.serviceWorker.controller));

  await ctx.setOffline(true);
  await page.reload();
  ok('the game loads offline', (await page.title()).length > 0 && await page.evaluate(() => !!document.querySelector('#app, main, body > *')));

  const pick = [files[0], files[Math.floor(files.length / 2)], files[files.length - 1]];
  const res = await page.evaluate(async ({ pick, VOICE }) => {
    const out = [];
    for (const f of pick) {
      const url = new URL(VOICE + f, location.href).href;
      const full = await fetch(url).then(r => r.arrayBuffer().then(b => ({ s: r.status, n: b.byteLength }))).catch(e => ({ e: String(e) }));
      const part = await fetch(url, { headers: { Range: 'bytes=0-99' } })
        .then(r => r.arrayBuffer().then(b => ({ s: r.status, n: b.byteLength, cr: r.headers.get('content-range') }))).catch(e => ({ e: String(e) }));
      const plays = await new Promise(resolve => {
        const a = new Audio();
        a.muted = true;
        a.oncanplaythrough = () => resolve(true);
        a.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000);
        a.src = url;
        a.load();
      });
      out.push({ f, full, part, plays });
    }
    return out;
  }, { pick, VOICE });
  ok('offline, clips come back whole', res.every(r => r.full.s === 200 && r.full.n > 2000), JSON.stringify(res));
  ok('offline, byte-range requests get a 206 slice', res.every(r => r.part.s === 206 && r.part.n === 100 && /^bytes 0-99\/\d+$/.test(r.part.cr)), JSON.stringify(res));
  ok('offline, clips load in an audio element', res.every(r => r.plays), JSON.stringify(res));
  await ctx.close();
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
