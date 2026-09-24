/* Word Kick browser test: plays the game in Chromium.
   Makes a player, wins a shootout, loses one on purpose, wins the Local Cup,
   checks progress survives a reload, uses a star, and opens the coach's corner.
   Run: node test/play.test.mjs  (expects a static server for the REPO ROOT on
   PORT, default 8126, since the game loads ../wordpunch) */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(`${globalRoot}/playwright`));
}

const PORT = process.env.PORT || 8126;
const BASE = `http://127.0.0.1:${PORT}/wordkick/index.html?test&seed=`;
let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.error(`  FAIL ${name} ${extra}`); }
};
const sel = (q, i) => (q.type === 'tap_pos' || q.type === 'spell_fix' ? `.tok[data-c="${i}"]` : `.choice[data-c="${i}"]`);

async function nextQuestion(page) {
  return page.waitForFunction(() => {
    if (document.querySelector('.result')) return 'result';
    if (document.querySelector('#ok')) return 'feedback';
    if (window.__wk.n > (window.__answered || 0) && document.querySelector('.choice:not(:disabled), .tok:not(:disabled)')) return 'question';
    return false;
  }, null, { timeout: 15000 }).then(h => h.jsonValue());
}

/* Play one shootout to the end. Returns 'win' or 'lose'. */
async function playMatch(page, rightRate = 1) {
  for (let turn = 0; turn < 80; turn++) {
    const next = await nextQuestion(page);
    if (next === 'result') return (await page.$('.result.win')) ? 'win' : 'lose';
    if (next === 'feedback') { await page.click('#ok'); continue; }
    const q = await page.evaluate(() => { window.__answered = window.__wk.n; return window.__wk.q; });
    const right = Math.random() < rightRate;
    await page.click(sel(q, q.choices.findIndex(c => c.correct === right)));
  }
  throw new Error('match never ended');
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE + '1');
  ok('first visit asks for a new player', await page.isVisible('#name'));
  ok('kit picker shows national colors', (await page.$$('.kit')).length >= 12 && (await page.textContent('.kit-pick')).includes('Argentina'));
  await page.fill('#name', 'Tester');
  await page.fill('#number', '7');
  await page.click('.kit[data-k="brazil"]');
  ok('preview shows the shirt number', (await page.textContent('.preview')).includes('7'));
  await page.click('.grade-pick .chip[data-g="3"]');
  await page.click('#create');
  ok('hub shows eight teams', (await page.$$('.tcard')).length === 8);
  ok('hub says grade 3 plays 2nd grade questions', (await page.textContent('.level-note')).includes('2nd grade'));
  ok('first team is next', await page.isVisible('.tcard.next[data-i="0"]'));

  // Match 1: every answer right.
  await page.click('#go');
  ok('intro shows the opponent', (await page.textContent('.intro-name')).includes('Noun City'));
  await page.click('#play');
  await page.waitForSelector('.pitch');
  ok('scoreboard shows five kicks a side', (await page.$$('.sb-you .pen')).length === 5 && (await page.$$('.sb-them .pen')).length === 5);
  let res = await playMatch(page, 1);
  ok('perfect answers win', res === 'win');
  ok('result shows the score', /3\s*–\s*0/.test(await page.textContent('.final-score')), await page.textContent('.final-score'));
  ok('next team is announced', (await page.textContent('.unlock')).includes('Spelling Rovers'));

  // Match 2: throw it.
  await page.click('#nextm');
  await page.click('#play');
  res = await playMatch(page, 0);
  ok('all wrong answers lose', res === 'lose');
  ok('a loss shows words to practice', await page.isVisible('.review'));
  const st = await page.evaluate(() => window.__wk.state().players[0]);
  ok('misses are recorded', Object.keys(st.missed).length > 0 && st.misses.length > 0);
  ok('a loss does not unlock the next team', st.progress[3].next === 1);

  // Rematch, then the Local Cup final.
  await page.click('#again');
  res = await playMatch(page, 1);
  ok('rematch won', res === 'win');
  await page.click('#nextm');
  await page.click('#play');
  res = await playMatch(page, 1);
  ok('Adjective Athletic beaten', res === 'win');
  ok('trophy is offered', await page.isVisible('#cup'));
  await page.click('#cup');
  ok('trophy screen shows the Local Cup', (await page.textContent('.trophy-screen h2')).includes('Local Cup'));
  await page.click('#hub');
  ok('hub shows the trophy as won', (await page.$$('.trophy-slot.won')).length === 1);

  // Reload keeps progress.
  await page.reload();
  await page.waitForSelector('.tcard');
  ok('reload goes straight to the hub', await page.isVisible('.tcard.next[data-i="3"]'));
  ok('trophy survives a reload', (await page.$$('.trophy-slot.won')).length === 1);

  // Stars: three right in a row, then use it.
  await page.click('#go');
  await page.click('#play');
  for (let i = 0; i < 3; i++) {
    await nextQuestion(page);
    const q = await page.evaluate(() => { window.__answered = window.__wk.n; return window.__wk.q; });
    await page.click(sel(q, q.choices.findIndex(c => c.correct)));
  }
  await nextQuestion(page);
  ok('star help appears after 3 right', await page.isVisible('#help'));
  await page.click('#help');
  const gone = await page.$$('.gone');
  ok('star clears wrong answers', gone.length > 0);
  ok('star is spent', (await page.$$('.stars .on')).length === 0 && !(await page.isVisible('#help')));
  const q = await page.evaluate(() => { window.__answered = window.__wk.n; return window.__wk.q; });
  const goneRight = await page.evaluate(() => [...document.querySelectorAll('.gone')].some(el => el.classList.contains('right')));
  ok('star never clears the right answer', !goneRight);
  await page.click(sel(q, q.choices.findIndex(c => c.correct)));
  page.once('dialog', d => d.accept());
  await page.click('#quit');
  await page.waitForSelector('.tcard');
  ok('quitting returns to the hub', true);

  // Coach's corner.
  await page.click('#coach');
  ok('coach shows skills', (await page.$$('.skill')).length === 6);
  ok('coach lists misses', (await page.$$('.misses li')).length > 0);
  await page.click('.kit[data-k="argentina"]');
  ok('kit can be changed', (await page.evaluate(() => window.__wk.state().players[0].kit)) === 'argentina');
  await page.uncheck('#clock');
  ok('clock can be turned off', (await page.evaluate(() => window.__wk.state().players[0].settings.clock)) === false);
  await page.click('#back');
  await page.click('#go');
  await page.click('#play');
  await page.waitForSelector('.choice:not(:disabled), .tok:not(:disabled)');
  ok('no clock shows a dimmed timer', await page.isVisible('.timer.off'));
  page.once('dialog', d => d.accept());
  await page.click('#quit');
  await page.waitForSelector('.tcard');

  // Timeout: clock on, no answer, their... your kick sails over.
  await page.click('#coach');
  await page.check('#clock');
  await page.click('#back');
  await page.click('.gtab[data-g="8"]');
  await page.click('#go');
  await page.click('#play');
  await page.waitForSelector('.choice:not(:disabled), .tok:not(:disabled)');
  await page.waitForSelector('#ok', { timeout: 25000 });
  ok('running out of time counts as a miss', (await page.textContent('.feedback')).includes('Too slow'));

  // A second player has their own progress.
  await page.evaluate(() => { location.search = '?test&seed=9'; });
  await page.waitForSelector('.tcard');
  await page.click('#switch');
  await page.click('#add');
  await page.fill('#name', 'Sibling');
  await page.click('#create');
  ok('second player starts fresh', await page.isVisible('.tcard.next[data-i="0"]'));
  ok('both players are saved', (await page.evaluate(() => window.__wk.state().players.length)) === 2);

  ok('no page errors', errors.length === 0, errors.join(' | '));

  // Motion on: a goal actually moves the ball and ripples the net.
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.goto(`http://127.0.0.1:${PORT}/wordkick/index.html?test&seed=3`);
  await p2.fill('#name', 'Motion');
  await p2.click('#create');
  await p2.click('#go');
  await p2.click('#play');
  await p2.waitForFunction(() => window.__wk.n > 0 && document.querySelector('.choice:not(:disabled), .tok:not(:disabled)'));
  await p2.evaluate(() => {
    window.__ripple = false;
    const g = document.querySelector('.goal');
    new MutationObserver(() => { if (g.classList.contains('ripple')) window.__ripple = true; }).observe(g, { attributes: true });
  });
  const q2 = await p2.evaluate(() => window.__wk.q);
  await p2.click(sel(q2, q2.choices.findIndex(c => c.correct)));
  const rippled = await p2.waitForFunction(() => window.__ripple, null, { timeout: 4000 }).then(() => true).catch(() => false);
  ok('a right answer puts the ball in the net', rippled);
  const ballMoved = await p2.evaluate(() => document.querySelector('.ball').getBoundingClientRect().top < document.querySelector('.goal').getBoundingClientRect().bottom);
  ok('the ball ends up in the goal', ballMoved);
  await ctx2.close();
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
