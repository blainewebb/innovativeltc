/* Runebreaker browser smoke test: actually plays the game in Chromium.
   Run: node test/play.test.mjs  (expects a static server on PORT, default 8124) */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

// Playwright lives in the global npm root here, which ESM resolution ignores.
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(`${globalRoot}/playwright`));
}

const PORT = process.env.PORT || 8124;
const URL = `http://127.0.0.1:${PORT}/index.html`;
let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.error(`  FAIL ${name} ${extra}`); }
};

const OPS = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b };

async function typeNumber(page, n, submitSel) {
  for (const ch of String(n)) await page.click(`.key[data-k="${ch}"]`);
  await page.click(submitSel);
}

/** Read the three expression slots and work out the right answer. */
async function readExpression(page) {
  const slots = await page.$$eval('.expr .slot', els => els.map(e => e.textContent.trim()));
  const [a, op, b] = slots;
  return { a: Number(a), op, b: Number(b), answer: OPS[op](Number(a), Number(b)) };
}

/** Pick the first legal tile/rune/tile combination, skipping jammed tiles. */
async function buildLegalExpression(page) {
  const runes = await page.$$eval('.rune', els => els.map(e => e.dataset.op));
  const tiles = await page.$$eval('.tile', els => els.map((e, i) => ({
    i, v: Number(e.textContent.trim()), locked: e.classList.contains('locked'),
  })));
  const live = tiles.filter(t => !t.locked && Number.isFinite(t.v));
  for (const t1 of live) {
    for (const op of runes) {
      for (const t2 of live) {
        if (t1.i === t2.i) continue;
        if (op === '-' && t1.v < t2.v) continue;
        if (op === '/' && (t2.v === 0 || t1.v % t2.v !== 0)) continue;
        await page.click(`.tile[data-i="${t1.i}"]`, { timeout: 3000 });
        await page.click(`.rune[data-op="${op}"]`, { timeout: 3000 });
        await page.click(`.tile[data-i="${t2.i}"]`, { timeout: 3000 });
        return true;
      }
    }
  }
  return false;
}

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 420, height: 880 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

try {
  await page.goto(URL, { waitUntil: 'networkidle' });

  /* ---- profile creation ---- */
  await page.fill('#newName', 'Tester');
  await page.click('#createProfile');
  await page.waitForSelector('#startRun');
  ok('creates a hero and lands on the hub', await page.isVisible('#startRun'));

  /* ---- start a run, reach a battle ---- */
  await page.click('#startRun');
  await page.waitForSelector('.node');
  ok('run starts on floor 1 with path choices', (await page.$$('.node')).length >= 2);

  // Walk floors until a battle screen appears.
  let foundBattle = false;
  for (let attempt = 0; attempt < 6 && !foundBattle; attempt++) {
    const battleNode = await page.$('.node.battle');
    if (battleNode) { await battleNode.click(); }
    else { await page.click('.node'); }
    if (await page.$('.hand')) { foundBattle = true; break; }
    // Non-battle node: answer it however we can, then continue.
    if (await page.$('#go')) { await typeNumber(page, 1, '#go'); await page.click('#next'); }
    else if (await page.$('#leave')) await page.click('#leave');
    else if (await page.$('#heal')) await page.click('#heal');
    await page.waitForSelector('.node, .hand');
  }
  ok('reaches a battle with a hand of tiles', foundBattle);

  /* ---- a correct strike deals damage ---- */
  const hpBefore = await page.$eval('.enemy-card .bar.hp b', e => Number(e.textContent.split('/')[0].trim()));
  ok('enemy shows a readable ward or armor line', (await page.$$('.enemy-tags .tag, .intent')).length > 0);

  let built = await buildLegalExpression(page);
  ok('can select tile, rune, tile', built);
  const expr = await readExpression(page);
  ok('expression is fully populated', Number.isFinite(expr.answer), JSON.stringify(expr));
  await typeNumber(page, expr.answer, '#strike');
  await page.waitForTimeout(120);
  const log = await page.$eval('.log', e => e.textContent);
  const hpAfter = await page.$eval('.enemy-card .bar.hp b', e => Number(e.textContent.split('/')[0].trim()));
  ok('a correct answer damages the enemy', hpAfter < hpBefore, `${hpBefore} -> ${hpAfter}`);
  ok('the log reports the strike', /damage|shield|EXACT/i.test(log), log);
  ok('combo went up', (await page.$eval('.combo', e => e.textContent)).includes('1'));

  /* ---- a wrong answer teaches, does not just punish ---- */
  built = await buildLegalExpression(page);
  const expr2 = await readExpression(page);
  await typeNumber(page, expr2.answer + 1, '#strike');
  await page.waitForTimeout(120);
  if (await page.$('.log')) {
    const log2 = await page.$eval('.log', e => e.textContent);
    ok('a wrong answer shows the correct one', log2.includes(String(expr2.answer)), log2);
  } else {
    ok('a wrong answer shows the correct one', false, 'battle screen gone');
  }

  /* ---- keyboard input works too ---- */
  if (await page.$('.hand')) {
    await buildLegalExpression(page);
    const expr3 = await readExpression(page);
    for (const ch of String(expr3.answer)) await page.keyboard.press(ch);
    const typedText = await page.$eval('.answer', e => e.textContent.trim());
    ok('physical keyboard fills the answer', typedText === String(expr3.answer), typedText);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }

  /* ---- grown-up report card ---- */
  await page.evaluate(() => localStorage.getItem('runebreaker.v1'));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#parentBtn');
  await page.click('#parentBtn');
  await typeNumber(page, 390, '#go');           // wrong on purpose
  ok('report card stays shut behind a wrong code', !(await page.$('.report-card')));
  await typeNumber(page, 391, '#go');
  await page.waitForSelector('.report-card');
  const skillRows = await page.$$('.skill-row');
  ok('report card lists every skill', skillRows.length >= 11, `${skillRows.length} rows`);
  const reportText = await page.$eval('.report-card', e => e.textContent);
  ok('report card shows attempts, not just zeros', /% right/.test(reportText), reportText.slice(0, 200));

  /* ---- progress survived a reload ---- */
  ok('progress persisted across the reload', /Tester/.test(reportText));

  /* ---- backup and restore, the way a parent would do it ---- */
  await page.click('[data-export]');
  await page.waitForSelector('#payload');
  const backup = await page.$eval('#payload', e => e.value);
  ok('the backup contains the hero and their facts', /Tester/.test(backup) && /"facts"/.test(backup), backup.slice(0, 120));

  await page.click('#back');
  await page.waitForSelector('.report-card');
  // Wipe the device, then bring the hero back from the text.
  await page.click('details.danger summary');
  await page.click('[data-reset]');
  await page.waitForTimeout(100);
  ok('the hero is gone after a reset', !(await page.$('[data-export]')));

  await page.click('#importBtn');
  await page.waitForSelector('#paste');
  await page.fill('#paste', backup);
  await page.click('#go');
  await page.waitForSelector('#done, #err');
  ok('importing a clean backup needs no further questions', !!(await page.$('#done')));
  await page.click('#done');
  await page.waitForSelector('.report-card');
  const restored = await page.$eval('.report-card', e => e.textContent);
  ok('the hero came back with their record intact', /Tester/.test(restored) && /% right/.test(restored), restored.slice(0, 160));

  /* ---- importing the same hero twice must not silently overwrite ---- */
  await page.click('#importBtn');
  await page.fill('#paste', backup);
  await page.click('#go');
  await page.waitForSelector('#replace, #done');
  ok('a clash asks before overwriting', !!(await page.$('#replace')));
  await page.click('#copy');
  await page.waitForSelector('#done');
  await page.click('#done');
  await page.waitForSelector('.report-card');
  ok('keeping both leaves two heroes', (await page.$$('[data-export]')).length === 2);

  /* ---- a junk paste fails politely instead of breaking ---- */
  await page.click('#importBtn');
  await page.fill('#paste', 'this is not a backup');
  await page.click('#go');
  await page.waitForSelector('#err:not([hidden])');
  const errText = await page.$eval('#err', e => e.textContent);
  ok('junk input explains itself', /Runebreaker backup/.test(errText), errText);
  await page.click('#back');

  ok('no page errors', errors.length === 0, errors.join(' | '));
} catch (err) {
  failed++;
  console.error('  FAIL threw:', err.message);
} finally {
  await b.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
