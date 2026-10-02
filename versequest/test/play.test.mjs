/* Verse Quest browser test: plays the game in Chromium on a phone-sized
   screen. Makes a player, learns a verse over three days, fails a step on
   purpose, does a review, plays a perfect trivia round, reloads, and adds a
   second player.
   Run: node test/play.test.mjs  (expects a static server on PORT, default 8126) */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(`${globalRoot}/playwright`));
}

const PORT = process.env.PORT || 8126;
const url = day => `http://127.0.0.1:${PORT}/index.html?test&seed=3&day=${day}`;
let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.error(`  FAIL ${name} ${extra}`); }
};

/* Answers every exercise in a lesson, review or trivia round until a result
   screen shows. `wrong` is how many wrong taps to make along the way. */
async function play(page, wrong = 0) {
  for (let n = 0; n < 400; n++) {
    const ex = await page.waitForFunction(() => {
      if (/bg-(win|soft)/.test(window.__vq.screen)) return { done: true };
      return window.__vq.ex;
    }, null, { timeout: 10000 }).then(h => h.jsonValue());
    if (ex.done) return;
    await page.evaluate(() => { window.__vq.ex = null; });
    if (wrong > 0 && ex.wrong) {
      wrong--;
      await page.click(ex.wrong);
      await page.evaluate(e => { window.__vq.ex = window.__vq.ex || { ...e, wrong: null }; }, ex);
      continue;
    }
    await page.click(ex.right);
  }
  throw new Error('session never ended');
}
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());

  // Day 1 ------------------------------------------------------------------
  await page.goto(url('2026-10-05'));
  ok('first visit asks for a name', await page.isVisible('#name'));
  ok('NIV notice shows on first screen', (await page.textContent('.notice')).includes('Biblica'));
  await page.click('#create');
  ok('empty name is refused', await page.isVisible('#name'));
  await page.fill('#name', 'Hannah');
  await page.click('#create');
  ok('home shows a new verse card', await page.isVisible('[data-act="start"]'));
  ok('home shows the trivia card', await page.isVisible('[data-act="trivia"]'));
  ok('first verse is Genesis 1:1', (await page.textContent('[data-act="start"] .ctitle')) === 'Genesis 1:1');
  ok('home fits a phone without side scrolling', await noSideScroll(page));

  await page.click('[data-act="start"]');
  ok('step 1 starts with reading', await page.isVisible('#go'));
  await play(page);
  ok('step 1 done', (await page.textContent('.big-head')).includes('Step 1'));
  await page.click('#next');
  ok('home now offers step 2', (await page.textContent('[data-act="lesson"] .kicker')).includes('Step 2'));
  ok('a second new verse is offered', await page.isVisible('[data-act="start"]'));
  ok('goal shows 1 of 3', (await page.textContent('.goal-top span')).includes('1 / 3'));

  // Fail step 2 on purpose, then pass it.
  await page.click('[data-act="lesson"]');
  await play(page, 6);
  ok('too many mistakes: try again', (await page.textContent('.big-head')).includes('So close'));
  await page.click('#next');
  ok('still on step 2', (await page.textContent('[data-act="lesson"] .kicker')).includes('Step 2'));
  await page.click('[data-act="lesson"]');
  await play(page, 1);
  ok('one mistake still passes', (await page.textContent('.big-head')).includes('Step 2'));
  ok('daily goal reached', (await page.textContent('.rewards')).includes('Daily goal done'));
  await page.click('#next');
  ok('streak shows 1', (await page.textContent('#streak')) === '1');
  ok('verse waits for tomorrow', !(await page.isVisible('[data-act="lesson"]')) && (await page.textContent('.screen')).includes('come back tomorrow'));

  // Trivia, all right.
  await page.click('[data-act="trivia"]');
  await play(page);
  ok('perfect trivia round', (await page.textContent('.big-head')).includes('Perfect'));
  ok('perfect badge awarded', (await page.textContent('.rewards')).includes('Perfect Round'));
  ok('trivia result fits a phone', await noSideScroll(page));
  await page.click('#home');

  // Days 2 and 3 ------------------------------------------------------------
  await page.goto(url('2026-10-06'));
  ok('reload goes straight to home', await page.isVisible('[data-act="lesson"]'));
  ok('progress survived the reload', (await page.textContent('[data-act="lesson"] .kicker')).includes('Step 3'));
  for (const s of [3, 4]) {
    await page.click('[data-act="lesson"]');
    await play(page);
    ok(`step ${s} done`, (await page.textContent('.big-head')).includes(`Step ${s}`));
    await page.click('#next');
  }
  await page.goto(url('2026-10-07'));
  await page.click('[data-act="lesson"]');
  await play(page);
  ok('step 5 memorizes the verse', (await page.textContent('.big-head')).includes('memorized'));
  ok('first-verse badge', (await page.textContent('.rewards')).includes('Hidden in My Heart'));
  await page.click('#next');

  // Day 4: review ----------------------------------------------------------
  await page.goto(url('2026-10-08'));
  ok('review is offered first', (await page.getAttribute('.cards .card:first-child', 'data-act')) === 'review');
  await page.click('[data-act="review"]');
  await play(page);
  ok('review passed', (await page.textContent('.big-head')).includes('Still got it'));
  ok('next review in 3 days', (await page.textContent('.screen')).includes('3 days'));
  await page.click('#next');

  // My verses and grown-ups ------------------------------------------------
  await page.click('#verses');
  ok('verse list shows memorized', (await page.textContent('.vrow[data-id="gen-1-1"] .vstat')) === 'Memorized');
  ok('verse list fits a phone', await noSideScroll(page));
  await page.click('.vrow[data-id="gen-1-1"]');
  await page.click('#practice');
  await play(page);
  ok('practice works', (await page.textContent('.big-head')).includes('practice'));
  await page.click('#next');
  await page.click('#grown');
  ok('grown-ups shows 1 memorized', (await page.textContent('.stats div:first-child b')) === '1');
  ok('grown-ups shows the NIV notice', (await page.textContent('.notice')).includes('Biblica'));
  await page.click('.chip[data-g="5"]');
  await page.click('#home');
  ok('goal setting applies', (await page.textContent('.goal-top span')).includes('/ 5'));

  // Second player ----------------------------------------------------------
  await page.click('#who');
  await page.click('#add');
  await page.fill('#name', 'Eli');
  await page.click('#create');
  ok('second player starts fresh', (await page.textContent('#stars')) === '0');
  await page.click('#who');
  ok('both players listed', (await page.$$('.player-btn')).length === 2);

  ok('no console errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
