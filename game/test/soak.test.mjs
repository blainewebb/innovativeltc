/* Runebreaker soak test: a bot plays a long run, always answering correctly,
   so every screen and node type gets exercised and any runtime error surfaces. */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')); }

const URL = `http://127.0.0.1:${process.env.PORT || 8124}/index.html`;
const OPS = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b };
const OP_KEY = { '+': '+', '−': '-', '×': '*', '÷': '/' };

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 420, height: 880 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const seen = new Set();
let deepest = 1, actions = 0, deaths = 0, current = 1;
const runDepths = [];

async function typeNum(n, sel) {
  for (const ch of String(n)) await page.click(`.key[data-k="${ch}"]`);
  await page.click(sel);
}

/* Score a play the way a kid who READS the enemy card would. Everything below
   is parsed out of the visible text, which means this doubles as a test that
   the screen tells the player enough to play well. */
function readEnemy(tags) {
  const text = tags.join(' | ');
  const num = re => { const m = text.match(re); return m ? Number(m[1]) : null; };
  return {
    armor: num(/Armor (\d+)/) || 0,
    shield: num(/EXACTLY (\d+)/),
    cap: num(/CAPPED at (\d+)/),
    over: num(/Results over (\d+)/),
    under: num(/Results under (\d+) are HALVED/),
    ward: /Even numbers hit DOUBLE/.test(text) ? n => (n % 2 === 0 ? 2 : 1)
        : /Odd numbers hit DOUBLE/.test(text) ? n => (n % 2 === 1 ? 2 : 1)
        : /Multiples of 5 hit DOUBLE/.test(text) ? n => (n % 5 === 0 ? 2 : 1)
        : /Multiples of 3 hit DOUBLE/.test(text) ? n => (n % 3 === 0 ? 2 : 1)
        : /Multiples of 10 hit TRIPLE/.test(text) ? n => (n % 10 === 0 ? 3 : 1)
        : /Two-digit results hit/.test(text) ? n => (n >= 10 && n <= 99 ? 1.5 : 1)
        : /Results under 10 hit TRIPLE/.test(text) ? n => (n < 10 ? 3 : 1)
        : /Square numbers hit TRIPLE/.test(text) ? n => (Number.isInteger(Math.sqrt(n)) ? 3 : 1)
        : () => 1,
  };
}

function scorePlay(result, e) {
  if (e.shield) return result === e.shield ? 1e6 : 0; // only an exact hit matters
  let dmg = result * e.ward(result);
  if (e.over !== null && result > e.over) dmg *= 0.5;
  if (e.under !== null && result < e.under) dmg *= 0.5;
  if (e.cap !== null) dmg = Math.min(dmg, e.cap);
  return Math.max(1, Math.round(dmg) - e.armor);
}

async function bestPlay() {
  const runes = await page.$$eval('.rune', els => els.map(e => e.dataset.op));
  const tiles = await page.$$eval('.tile', els => els.map((e, i) => ({
    i, v: Number(e.textContent.trim()), locked: e.classList.contains('locked'),
  })));
  const tags = await page.$$eval('.enemy-tags .tag', els => els.map(e => e.textContent.trim()));
  const enemy = readEnemy(tags);
  const live = tiles.filter(t => !t.locked && Number.isFinite(t.v));
  let best = null;
  for (const t1 of live) for (const t2 of live) {
    if (t1.i === t2.i) continue;
    for (const op of runes) {
      const a = t1.v, c = t2.v;
      if (op === '-' && a < c) continue;
      if (op === '/' && (c === 0 || a % c !== 0)) continue;
      const r = op === '+' ? a + c : op === '-' ? a - c : op === '*' ? a * c : a / c;
      const score = scorePlay(r, enemy);
      if (!best || score > best.score) best = { i: t1.i, j: t2.i, op, r, score };
    }
  }
  return best;
}

try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('#newName', 'Soak');
  await page.click('#createProfile');
  await page.click('#startRun');

  for (actions = 0; actions < 1400; actions++) {
    const floorTxt = await page.$eval('.depth-pill', e => e.textContent).catch(() => null);
    if (floorTxt) { current = Number((floorTxt.match(/\d+/) || [1])[0]); deepest = Math.max(deepest, current); }

    if (await page.$('.hand')) {                       // battle
      seen.add('battle');
      const play = await bestPlay();
      if (!play) { await page.click('#reshuffle'); continue; }
      await page.click(`.tile[data-i="${play.i}"]`);
      await page.click(`.rune[data-op="${play.op}"]`);
      await page.click(`.tile[data-i="${play.j}"]`);
      const slots = await page.$$eval('.expr .slot', els => els.map(e => e.textContent.trim()));
      const answer = OPS[slots[1]](Number(slots[0]), Number(slots[2]));
      if (!Number.isFinite(answer)) { await page.click('#clearSel'); continue; }
      await typeNum(answer, '#strike');
    } else if (await page.$('#go')) {                  // riddle / chest
      seen.add('question');
      const prompt = await page.$eval('.prompt', e => e.textContent);
      // The bot cannot read word problems, so it guesses. Wrong is fine here:
      // the point is that the screen survives both outcomes.
      await typeNum(7, '#go');
    } else if (await page.$('#next')) {
      await page.click('#next');
    } else if (await page.$('#cont')) {
      seen.add('victory');
      await page.click('#cont');
    } else if (await page.$('.choice')) {
      seen.add(await page.$('#heal') ? 'rest' : 'relic');
      await page.click('.choice');
    } else if (await page.$('#leave')) {
      seen.add('shop');
      const item = await page.$('.shop-item:not([disabled])');
      if (item) await item.click(); else await page.click('#leave');
    } else if (await page.$('.node')) {
      seen.add('map');
      const nodes = await page.$$eval('.node', els => els.map(e => e.className));
      nodes.forEach(c => seen.add('node:' + c.split(' ')[1]));
      // The bot cannot read word problems, so it avoids them where it can and
      // the run length being measured stays a test of combat balance.
      const n = await page.$('.node.battle') || await page.$('.node.rest')
             || await page.$('.node.elite') || await page.$('.node');
      await n.click();
    } else if (await page.$('#again')) {
      const cleared = await page.$eval('h2', e => /CLEARED/.test(e.textContent)).catch(() => false);
      if (cleared) { runDepths.push({ end: 'clear', floor: current }); seen.add('cleared'); await page.click('#again'); await page.click('#startRun'); continue; }
      deaths++;
      runDepths.push({ end: 'death', floor: current });
      seen.add('death');
      if (deaths >= 5) break;
      await page.click('#again');
    } else {
      break;
    }
  }

  const report = { deepest, actions, deaths, runDepths, seen: [...seen].sort(), errors };
  console.log(JSON.stringify(report, null, 2));

  let failed = 0;
  const ok = (name, cond, extra = '') => { if (!cond) { failed++; console.error(`FAIL ${name} ${extra}`); } };
  ok('no runtime errors', errors.length === 0, errors.join(' | '));
  ok('a standard run ends at floor 20, not forever', deepest <= 20, `deepest ${deepest}`);
  // The bot plays the arithmetic perfectly but everything else naively, so it
  // should clear at least once in five attempts without clearing every time.
  ok('an optimal player clears the run at least once in five', seen.has('cleared'),
     JSON.stringify(runDepths));
  ok('saw battles', seen.has('battle'));
  ok('saw the map', seen.has('map'));
  ok('saw a victory screen', seen.has('victory'));
  ok('saw a boss node', seen.has('node:boss'), [...seen].join(','));
  ok('saw a non-combat node', seen.has('question') || seen.has('shop') || seen.has('rest'));
  console.log(failed ? `\n${failed} checks failed` : '\nsoak passed');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.error('threw:', e.message);
  process.exitCode = 1;
} finally {
  await b.close();
}
