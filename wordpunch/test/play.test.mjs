/* Word Punch browser test: plays the game in Chromium.
   Makes a boxer, wins fights, loses one on purpose, wins the Minor Circuit
   belt, checks progress survives a reload, and opens the coach's corner.
   Run: node test/play.test.mjs  (expects a static server on PORT, default 8125) */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(`${globalRoot}/playwright`));
}

const PORT = process.env.PORT || 8125;
const BASE = `http://127.0.0.1:${PORT}/index.html?test&seed=`;
let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.error(`  FAIL ${name} ${extra}`); }
};

/* Play one fight to the end. `rightRate` is how often to answer correctly.
   Returns 'win' or 'lose'. */
async function playFight(page, rightRate = 1, usePower = true) {
  for (let turn = 0; turn < 120; turn++) {
    const next = await page.waitForFunction(() => {
      if (document.querySelector('.result')) return 'result';
      if (document.querySelector('#ok')) return 'feedback';
      if (window.__wp.n > (window.__answered || 0) && document.querySelector('.choice:not(:disabled), .tok:not(:disabled)')) return 'question';
      return false;
    }, null, { timeout: 15000 }).then(h => h.jsonValue());
    if (next === 'result') return (await page.$('.result.win')) ? 'win' : 'lose';
    if (next === 'feedback') { await page.click('#ok'); continue; }
    const q = await page.evaluate(() => { window.__answered = window.__wp.n; return window.__wp.q; });
    const right = Math.random() < rightRate;
    const idx = q.choices.findIndex(c => c.correct === right);
    if (usePower && right && await page.isVisible('#power') && !(await page.$('#power.armed'))) await page.click('#power');
    const sel = q.type === 'tap_pos' || q.type === 'spell_fix' ? `.tok[data-c="${idx}"]` : `.choice[data-c="${idx}"]`;
    await page.click(sel);
  }
  throw new Error('fight never ended');
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE + '1');
  ok('first visit asks for a new boxer', await page.isVisible('#name'));
  await page.fill('#name', 'Tester');
  await page.click('.grade-pick .chip[data-g="2"]');
  await page.click('#create');
  ok('hub shows the ladder', (await page.$$('.fcard')).length === 8);
  ok('first fighter is next', await page.isVisible('.fcard.next[data-i="0"]'));
  ok('hub opens on the boxer\'s grade', (await page.textContent('.gtab.on')).includes('2'));

  // Fight 1: win with every answer right.
  await page.click('#go');
  ok('intro shows the opponent', (await page.textContent('.intro-name')).includes('Lowercase Larry'));
  await page.click('#fight');
  await page.waitForSelector('.hud');
  ok('fight shows health bars', (await page.$$('.hp .bar')).length === 2);
  let res = await playFight(page, 1);
  ok('perfect answers win the fight', res === 'win');
  ok('result shows a recap', (await page.$$('.recap div')).length === 4);
  ok('next fighter is announced', (await page.textContent('.unlock')).includes('Vowel Vinnie'));

  // Fight 2: throw it, to check losing, the get-up flow and the review.
  await page.click('#nextf');
  await page.click('#fight');
  res = await playFight(page, 0);
  ok('all wrong answers lose the fight', res === 'lose');
  ok('a loss shows words to practice', await page.isVisible('.review'));
  ok('a loss offers a rematch', await page.isVisible('#again'));
  const st = await page.evaluate(() => window.__wp.state().boxers[0]);
  ok('misses are recorded for review', Object.keys(st.missed).length > 0 && st.misses.length > 0);
  ok('a loss does not unlock the next fighter', st.progress[2].next === 1);

  // Rematch and win, then take the Minor Circuit belt from Captain Capital.
  await page.click('#again');
  res = await playFight(page, 0.9);
  ok('rematch won at 90%', res === 'win', res);
  await page.click('#nextf');
  await page.click('#fight');
  res = await playFight(page, 1);
  ok('Captain Capital beaten', res === 'win');
  ok('belt is offered', await page.isVisible('#belt'));
  await page.click('#belt');
  ok('belt screen shows the Minor Circuit Belt', (await page.textContent('.belt-screen h2')).includes('Minor Circuit Belt'));
  await page.click('#hub');
  ok('hub shows the belt as won', (await page.$$('.belt-slot.won')).length === 1);
  ok('Major Circuit opens', await page.isVisible('.fcard.next[data-i="3"]'));

  // Progress survives a reload.
  await page.reload();
  await page.waitForSelector('.fcard');
  ok('reload goes straight to the hub', await page.isVisible('.fcard.next[data-i="3"]'));
  ok('belt survives a reload', (await page.$$('.belt-slot.won')).length === 1);

  // Other grades have their own ladder.
  await page.click('.gtab[data-g="5"]');
  ok('grade 5 ladder starts fresh', await page.isVisible('.fcard.next[data-i="0"]'));

  // Coach's corner and the no-clock setting.
  await page.click('#coach');
  ok('coach shows skills', (await page.$$('.skill')).length === 6);
  ok('coach lists misses', (await page.$$('.misses li')).length > 0);
  await page.uncheck('#clock');
  const clock = await page.evaluate(() => window.__wp.state().boxers[0].settings.clock);
  ok('clock can be turned off', clock === false);
  await page.click('#back');
  await page.click('#go');
  await page.click('#fight');
  await page.waitForSelector('.choice:not(:disabled), .tok:not(:disabled)');
  ok('no clock shows a dimmed timer', await page.isVisible('.timer.off'));
  page.once('dialog', d => d.accept());
  await page.click('#quit');
  await page.waitForSelector('.fcard');
  ok('quitting returns to the hub', true);

  // Timeouts: with the clock on and no answer, the opponent lands a punch.
  await page.click('#coach');
  await page.check('#clock');
  await page.click('#back');
  await page.click('.gtab[data-g="8"]');
  await page.click('#go');
  await page.click('#fight');
  await page.waitForSelector('.choice:not(:disabled), .tok:not(:disabled)');
  await page.waitForSelector('#ok', { timeout: 20000 });
  ok('running out of time counts as a miss', (await page.textContent('.feedback')).includes('Too slow'));

  // A second boxer on the same device has their own progress.
  await page.evaluate(() => { location.search = '?test&seed=9'; });
  await page.waitForSelector('.fcard');
  ok('hub has a labelled switch button', (await page.textContent('#switch')).includes('Switch boxer'));
  await page.click('#switch');
  await page.click('#add');
  await page.fill('#name', 'Sibling');
  await page.click('#create');
  ok('second boxer starts fresh', await page.isVisible('.fcard.next[data-i="0"]'));
  const boxers = await page.evaluate(() => window.__wp.state().boxers.length);
  ok('both boxers are saved', boxers === 2);
  await page.click('#switch');
  ok('switch lists both boxers', (await page.$$('.boxer-btn')).length === 2);
  await page.click('.boxer-btn:has-text("Tester")');
  ok('switching back loads the first boxer', (await page.textContent('.me')).includes('Tester') && await page.isVisible('.belt-slot.won'));
  await page.click('#coach');
  await page.click('#switch2');
  ok('coach\'s corner can switch boxers too', (await page.$$('.boxer-btn')).length === 2);

  ok('no page errors', errors.length === 0, errors.join(' | '));

  // Motion on: a hit actually animates.
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.goto(`http://127.0.0.1:${PORT}/index.html?test&seed=3`);
  await p2.fill('#name', 'Motion');
  await p2.click('#create');
  await p2.click('#go');
  await p2.click('#fight');
  await p2.waitForFunction(() => window.__wp.n > 0 && document.querySelector('.choice:not(:disabled), .tok:not(:disabled)'));
  await p2.evaluate(() => {
    window.__cls = [];
    const el = document.querySelector('.ring .opp');
    new MutationObserver(() => window.__cls.push(el.className)).observe(el, { attributes: true });
  });
  const q = await p2.evaluate(() => window.__wp.q);
  const i = q.choices.findIndex(c => c.correct);
  await p2.click(q.type === 'tap_pos' || q.type === 'spell_fix' ? `.tok[data-c="${i}"]` : `.choice[data-c="${i}"]`);
  const sawHit = await p2.waitForFunction(() => window.__cls.some(c => /hurt|rocked/.test(c)), null, { timeout: 3000 }).then(() => true).catch(() => false);
  ok('a right answer makes the opponent flinch', sawHit);
  ok('the health bars never get fight animations', !(await p2.$('.hud .idle, .hud .hurt, .hud .windup')));
  await ctx2.close();
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
