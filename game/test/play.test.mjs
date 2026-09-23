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

const OPS = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b, '^': (a, b) => Math.pow(a, b) };

/* The game's own rule: a strike must make a whole number of at least one.
   Negative tiles and the power rune both fall out of this, so the bot checks
   the result rather than keeping a list of per-operator special cases. */
function legalPlay(a, op, b) {
  if (op === '^') {
    if (b < 2 || b > 3) return false;
    const r = Math.pow(a, b);
    return Number.isInteger(r) && r >= 1 && r <= 4000;
  }
  if (op === '/' && (b === 0 || a % b !== 0)) return false;
  const r = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b;
  return Number.isInteger(r) && r >= 1;
}


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
        if (!legalPlay(t1.v, op, t2.v)) continue;
        await page.click(`.tile[data-i="${t1.i}"]`, { timeout: 3000 });
        await page.click(`.rune[data-op="${op}"]`, { timeout: 3000 });
        await page.click(`.tile[data-i="${t2.i}"]`, { timeout: 3000 });
        return true;
      }
    }
  }
  return false;
}

/* Turns alternate, so a built turn is usually followed by a drill. Answer it
   correctly and carry on, unless the caller wants to test the miss path. */
async function clearDrill(page, { correct = true } = {}) {
  if (!(await page.$('.drill-problem'))) return false;
  // A drill is either three number boxes or a written question. The bot can
  // only do the arithmetic one, so it guesses at the rest.
  const parts = await page.$$eval('.drill-problem .dp', els => els.map(e => e.textContent.trim()));
  if (parts.length < 3) {
    await typeNumber(page, 7, '#answer');
    await page.waitForTimeout(120);
    return true;
  }
  const answer = OPS[parts[1]](Number(parts[0]), Number(parts[2]));
  await typeNumber(page, correct ? answer : answer + 1, '#answer');
  await page.waitForTimeout(120);
  return true;
}

/** Play on until a build turn with tiles is on screen. The fight is random,
    so a hit can end it early, or a guessed question can end the run; neither
    is what the check that follows is about. */
async function toHand(page) {
  for (let step = 0; step < 60; step++) {
    await page.waitForSelector('#app:not([data-busy])', { timeout: 5000 });
    if (await page.$('.win-scene:not(.done)')) await page.click('.win-scene');
    if (await page.$('.hand')) return true;
    if (await page.$('.drill-problem')) { await clearDrill(page); continue; }
    if (await page.$('#cont')) { await page.click('#cont'); continue; }
    if (await page.$('#next')) { await page.click('#next'); continue; }
    if (await page.$('#wear')) { await page.click('#wear'); continue; }
    if (await page.$('.choice')) { await page.click('.choice'); continue; }
    if (await page.$('#go')) { await typeNumber(page, 7, '#go'); continue; }
    if (await page.$('#leave')) { await page.click('#leave'); continue; }
    if (await page.$('#again')) { await page.click('#again'); continue; }
    const n = await page.$('.node.battle') || await page.$('.node');
    if (n) { await n.click(); continue; }
    return false;
  }
  return false;
}

/** Reshuffle if there is one left. A stuck hand with none left ends the walk. */
async function tryReshuffle(page) {
  const btn = await page.$('#reshuffle:not([disabled])');
  if (btn) { await btn.click(); return true; }
  return false;
}

const b = await chromium.launch();
// Reduced motion skips the hit animations, so most of this test can check
// state straight after each move. The animations get their own page below.
const page = await b.newPage({ viewport: { width: 420, height: 880 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

try {
  await page.goto(URL, { waitUntil: 'networkidle' });

  /* ---- profile creation, with a school year ---- */
  ok('the picker asks for a school year, 1st through 8th', (await page.$$('.grade')).length === 8);
  ok('8th grade is offered', !!(await page.$('.grade[data-grade="8"]')));
  // A readable build stamp, so "is this the new version?" stops being guesswork.
  const stamp = await page.$eval('.version', e => e.textContent).catch(() => '');
  ok('the picker shows which build is loaded', /^v\d{4}-\d{2}-\d{2}\.\d+$/.test(stamp), stamp);
  await page.fill('#newName', 'Tester');
  await page.click('.grade[data-grade="4"]');
  await page.click('#createProfile');
  await page.waitForSelector('#startRun');
  ok('creates a hero and lands on the hub', await page.isVisible('#startRun'));
  const hubText = await page.$eval('.panel', e => e.textContent);
  ok('a 4th grader starts above level 1', /Challenge level [4-6]/.test(hubText), hubText.slice(0, 200));
  const runeChips = await page.$$eval('.rune-chip.on', els => els.length);
  ok('a 4th grader starts with all four operators', runeChips === 4, `${runeChips} runes`);

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
  const hpBefore = await page.$eval('#foeHp b', e => Number(e.textContent.split('/')[0].trim()));
  ok('enemy shows a readable ward or armor line', (await page.$$('.enemy-tags .tag, .intent')).length > 0);

  let built = await buildLegalExpression(page);
  ok('can select tile, rune, tile', built);
  const expr = await readExpression(page);
  ok('expression is fully populated', Number.isFinite(expr.answer), JSON.stringify(expr));
  await typeNumber(page, expr.answer, '#strike');
  await page.waitForTimeout(120);
  const log = await page.$eval('.log', e => e.textContent);
  const hpAfter = await page.$eval('#foeHp b', e => Number(e.textContent.split('/')[0].trim()));
  ok('a correct answer damages the enemy', hpAfter < hpBefore, `${hpBefore} -> ${hpAfter}`);
  ok('the log reports the strike', /damage|shield|EXACT/i.test(log), log);
  ok('combo went up', (await page.$eval('.combo', e => e.textContent)).includes('1'));

  /* ---- the drill turn ---- */
  ok('a drill turn follows the built turn', !!(await page.$('.drill-problem')));
  if (await page.$('.drill-problem')) {
    ok('the drill shows a clock', !!(await page.$('#timerbar')));
    ok('the drill says what it is parrying', /INCOMING/.test(await page.$eval('.incoming', e => e.textContent)));
    const hpBeforeParry = await page.$eval('#foeHp b', e => Number(e.textContent.split('/')[0].trim()));
    await clearDrill(page);
    const afterParry = await page.$eval('#foeHp b', e => Number(e.textContent.split('/')[0].trim())).catch(() => 0);
    ok('a correct parry counters for damage', afterParry < hpBeforeParry, `${hpBeforeParry} -> ${afterParry}`);
    const parryLog = await page.$eval('.log', e => e.textContent).catch(() => '');
    // The counter can finish the enemy off, in which case the win scene is up
    // and there is no log to read.
    const wonOnParry = !!(await page.$('.win-scene'));
    ok('the log says it was parried', wonOnParry || /PARRIED/.test(parryLog), parryLog);
  }

  /* ---- a wrong answer teaches, does not just punish ---- */
  await toHand(page);
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
  await toHand(page);
  if (await page.$('.hand')) {
    await buildLegalExpression(page);
    const expr3 = await readExpression(page);
    for (const ch of String(expr3.answer)) await page.keyboard.press(ch);
    const typedText = await page.$eval('.answer', e => e.textContent.trim());
    ok('physical keyboard fills the answer', typedText === String(expr3.answer), typedText);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }

  /* ---- earning a hero ---- */
  await page.goto(URL, { waitUntil: 'networkidle' });
  // A hero four floors from their first unlock, so one more beaten floor does it.
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('runebreaker.v1'));
    data.profiles[0].records.floorsBeaten = 4;
    data.activeId = data.profiles[0].id;
    localStorage.setItem('runebreaker.v1', JSON.stringify(data));
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#startRun');
  const nextHeroLine = await page.$eval('.hero-row', e => e.textContent);
  ok('the hub says how close the next hero is', /Next hero: .* in 1 floor\b/.test(nextHeroLine), nextHeroLine);

  await page.click('#looksBtn');
  await page.waitForSelector('.look');
  ok('the look picker shows all twenty', (await page.$$('.look')).length === 20);
  ok('twelve of them are still locked', (await page.$$('.look.locked')).length === 12);
  ok('a locked one says what it costs', /floors/.test(await page.$eval('.look.locked small', e => e.textContent)));
  const secondLook = await page.$$eval('[data-look]', els => els[1]?.dataset.look);
  await page.click(`[data-look="${secondLook}"]`);
  await page.waitForTimeout(100);
  ok('picking an earned hero changes it', (await page.$eval('.look.on', e => e.dataset.look)) === secondLook);
  await page.click('#done');
  await page.waitForSelector('#startRun');

  // Beat one floor and the unlock should fire.
  await page.click('#startRun');
  let earnedScreen = false;
  for (let step = 0; step < 90 && !earnedScreen; step++) {
    if (await page.$('#wear')) { earnedScreen = true; break; }
    if (await page.$('.drill-problem')) { await clearDrill(page); continue; }
    if (await page.$('.hand')) {
      if (!(await buildLegalExpression(page))) { if (await tryReshuffle(page)) continue; break; }
      const ex = await readExpression(page);
      if (!Number.isFinite(ex.answer)) { await page.click('#clearSel'); continue; }
      await typeNumber(page, ex.answer, '#strike');
      continue;
    }
    if (await page.$('#cont')) { await page.click('#cont'); continue; }
    if (await page.$('#next')) { await page.click('#next'); continue; }
    if (await page.$('.choice')) { await page.click('.choice'); continue; }
    if (await page.$('#go')) { await typeNumber(page, 7, '#go'); continue; }
    if (await page.$('#leave')) { await page.click('#leave'); continue; }
    if (await page.$('#again')) { await page.click('#again'); continue; }
    if (await page.$('.node')) { const n = await page.$('.node.battle') || await page.$('.node'); await n.click(); continue; }
    break;
  }
  ok('beating a floor earns the next hero', earnedScreen);
  if (earnedScreen) {
    const panel = await page.$eval('.panel', e => e.textContent);
    ok('the earning screen names the hero and the floors', /is yours, for beating 5 floors/.test(panel), panel.slice(0, 160));
    await page.click('#wear');
    await page.waitForSelector('.node, .drill-problem, .hand');
    ok('wearing it carries on with the run', true);
  }

  /* ---- an 8th grader is served middle school work, typed as such ---- */
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (await page.$('#switchBtn')) await page.click('#switchBtn');
  await page.waitForSelector('#newName');
  await page.fill('#newName', 'Middle');
  await page.click('.grade[data-grade="8"]');
  await page.click('#createProfile');
  await page.waitForSelector('#startRun');
  const eighthHub = await page.$eval('.panel', e => e.textContent);
  ok('an 8th grader starts well above level 1', /Challenge level [7-9]/.test(eighthHub), eighthHub.slice(0, 200));
  await page.click('#startRun');

  let askedSeen = null;
  for (let step = 0; step < 140 && !askedSeen; step++) {
    const asked = await page.$('.asked');
    if (asked) { askedSeen = await asked.textContent(); break; }
    if (await page.$('.drill-problem')) { await clearDrill(page); continue; }
    if (await page.$('.hand')) {
      if (!(await buildLegalExpression(page))) { if (await tryReshuffle(page)) continue; break; }
      const ex = await readExpression(page);
      if (!Number.isFinite(ex.answer)) { await page.click('#clearSel'); continue; }
      await typeNumber(page, ex.answer, '#strike');
      continue;
    }
    if (await page.$('#cont')) { await page.click('#cont'); continue; }
    if (await page.$('#next')) { await page.click('#next'); continue; }
    if (await page.$('.choice')) { await page.click('.choice'); continue; }
    if (await page.$('#go')) { await typeNumber(page, 7, '#go'); continue; }
    if (await page.$('#leave')) { await page.click('#leave'); continue; }
    if (await page.$('#again')) { await page.click('#again'); continue; }
    if (await page.$('#wear')) { await page.click('#wear'); continue; }
    if (await page.$('.node')) {
      const n = await page.$('.node.battle') || await page.$('.node');
      await n.click();
      continue;
    }
    break;
  }
  ok('a written middle-school question comes up', !!askedSeen, String(askedSeen).slice(0, 120));
  if (askedSeen) {
    ok('the question reads as real maths, not a template leak',
       !/undefined|NaN|\[object/.test(askedSeen), askedSeen);
    // Fractions, decimals and negatives need keys the old pad did not have.
    const symbols = await page.$$eval('.key.sym', els => els.map(e => e.dataset.k).sort());
    ok('the keypad gains slash, point and minus', symbols.join('') === '-./', symbols.join(''));
    await page.click('.key[data-k="3"]');
    await page.click('.key[data-k="/"]');
    await page.click('.key[data-k="4"]');
    ok('a fraction can be typed', (await page.$eval('.answer', e => e.textContent.trim())) === '3/4');
    await page.click('.key[data-k="back"]');
    await page.click('.key[data-k="back"]');
    await page.click('.key[data-k="back"]');
    await page.click('.key[data-k="-"]');
    await page.click('.key[data-k="5"]');
    ok('a negative can be typed', (await page.$eval('.answer', e => e.textContent.trim())) === '-5');
    await page.click('#answer');
    await page.waitForTimeout(150);
    ok('a written answer resolves the turn', !!(await page.$('.hand, .drill-problem, #cont, #again')));
  }

  /* ---- the boss duel on floor 3 ---- */
  // Walk to the first boss floor. Answering everything correctly is enough.
  let sawDuel = false;
  for (let step = 0; step < 120 && !sawDuel; step++) {
    if (await page.$('.duel-banner')) { sawDuel = true; break; }
    if (await page.$('.drill-problem')) { await clearDrill(page); continue; }
    if (await page.$('.hand')) {
      if (!(await buildLegalExpression(page))) { if (await tryReshuffle(page)) continue; break; }
      const ex = await readExpression(page);
      if (!Number.isFinite(ex.answer)) { await page.click('#clearSel'); continue; }
      await typeNumber(page, ex.answer, '#strike');
      continue;
    }
    if (await page.$('#cont')) { await page.click('#cont'); continue; }
    if (await page.$('#next')) { await page.click('#next'); continue; }
    if (await page.$('.choice')) { await page.click('.choice'); continue; }
    if (await page.$('#go')) { await typeNumber(page, 7, '#go'); continue; }
    if (await page.$('#leave')) { await page.click('#leave'); continue; }
    // The bot guesses at written questions, so now and then it dies before
    // floor 3. That says nothing about duels, so it just starts again.
    if (await page.$('#again')) { await page.click('#again'); continue; }
    if (await page.$('#wear')) { await page.click('#wear'); continue; }
    if (await page.$('.node')) {
      const n = await page.$('.node.boss') || await page.$('.node.battle') || await page.$('.node');
      await n.click();
      continue;
    }
    break;
  }
  ok('a boss duel appears within the first few floors', sawDuel);
  if (sawDuel) {
    ok('the duel has an overall clock', !!(await page.$('#fighttimer')));
    ok('the duel clock counts seconds', /Duel clock \d+s/.test(await page.$eval('#fighttimer b', e => e.textContent)));
    ok('the duel is all asked questions, no tiles', !(await page.$('.hand')));
    ok('the duel still shows a per-question clock', !!(await page.$('#timerbar')));
    await clearDrill(page);
    ok('answering in a duel keeps you in the duel or ends it', !!(await page.$('.drill-problem, #cont, #again')));
  }

  /* ---- a second hero, kept entirely separate ---- */
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#switchBtn');
  ok('the hub says you can add a hero, not just switch', /add/i.test(await page.$eval('#switchBtn', e => e.textContent)));
  await page.click('#switchBtn');
  await page.waitForSelector('#createProfile');
  ok('the picker offers to add another hero', /Add another hero/i.test(await page.$eval('.newprof', e => e.textContent)));
  await page.fill('#newName', 'Second');
  await page.click('#createProfile');
  await page.waitForSelector('#startRun');
  ok('the new hero starts fresh, not on the first one\'s progress',
     /Deepest floor 0/.test(await page.$eval('.hero-row', e => e.textContent)),
     await page.$eval('.hero-row', e => e.textContent));

  await page.click('#switchBtn');
  await page.waitForSelector('.profile-card');
  const heroNames = await page.$$eval('.profile-card .pn', els => els.map(e => e.textContent.trim()));
  ok('both heroes are listed', heroNames.includes('Tester') && heroNames.includes('Second'), heroNames.join(','));
  await page.click('.profile-card');

  /* ---- grown-up report card ---- */
  await page.evaluate(() => localStorage.getItem('runebreaker.v1'));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#parentBtn');
  await page.click('#parentBtn');
  await typeNumber(page, 390, '#go');           // wrong on purpose
  ok('report card stays shut behind a wrong code', !(await page.$('.report-card')));
  await typeNumber(page, 391, '#go');
  await page.waitForSelector('.report-card');
  const cards = await page.$$('.report-card');
  const heroCount = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('runebreaker.v1')).profiles.length);
  ok('the report card has a section per hero', cards.length === heroCount, `${cards.length} cards, ${heroCount} heroes`);
  const perCard = await page.$$eval('.report-card', els => els.map(e => e.querySelectorAll('.skill-row').length));
  ok('report card lists every skill for each hero', perCard.every(n => n >= 11), perCard.join(','));
  // Read the actual count: /0 problems/ also matches "40 problems".
  const counts = await page.$$eval('.report-card', els => els.map(e => {
    const m = e.textContent.match(/(\d+) problems/);
    return m ? Number(m[1]) : -1;
  }));
  ok('the heroes have independent records',
     counts.some(n => n === 0) && counts.some(n => n > 0),
     JSON.stringify(counts));
  const reportText = await page.$eval('.report-card', e => e.textContent);
  ok('report card shows attempts, not just zeros', /% right/.test(reportText), reportText.slice(0, 200));

  /* ---- progress survived a reload ---- */
  ok('progress persisted across the reload', /Tester/.test(reportText));

  /* ---- backup and restore, the way a parent would do it ---- */
  ok('two heroes unlock a whole-device backup', !!(await page.$('#exportAll')));
  await page.click('[data-export]');
  await page.waitForSelector('#payload');
  const backup = await page.$eval('#payload', e => e.value);
  ok('the backup contains the hero and their facts', /Tester/.test(backup) && /"facts"/.test(backup), backup.slice(0, 120));

  await page.click('#back');
  await page.waitForSelector('.report-card');
  // Wipe the device, then bring the hero back from the text.
  while (await page.$('[data-reset]')) {
    await page.click('details.danger summary');
    await page.click('[data-reset]');
    await page.waitForTimeout(100);
  }
  ok('the heroes are gone after a reset', !(await page.$('[data-export]')));

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

  /* ---- a hero saved by an older build survives an update ---- */
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('runebreaker.v1', JSON.stringify({
    // Shaped like a save written before grades, drill prefs, wins or endless
    // existed. This is what an update must never cost anyone.
    profiles: [{
      id: 'old1', name: 'Hudson', avatar: '\u{1F409}', created: 1700000000000,
      mastery: {
        skills: { add_small: { attempts: 40, correct: 38, ema: 0.95, totalMs: 64000 } },
        facts: { '7+8': { attempts: 9, correct: 7, ema: 0.8, totalMs: 18000 } },
      },
      records: { deepest: 8, runs: 3, bossesFelled: 1 },
      days: [{ date: '2026-09-20', ms: 600000, correct: 30, wrong: 5 }],
    }],
    activeId: 'old1',
    settings: { sound: true },
  })));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#startRun');
  const oldHero = await page.$eval('.hero-row', e => e.textContent);
  ok('an older save still loads straight into its hub', /Hudson/.test(oldHero), oldHero);
  ok('an older save keeps its deepest floor', /\b8\b/.test(oldHero), oldHero);
  await page.click('#startRun');
  await page.waitForSelector('.node');
  ok('an older save is playable, not just visible', (await page.$$('.node')).length >= 1);

  /* ---- deleting a hero from the picker ---- */
  await page.goto(URL, { waitUntil: 'networkidle' });
  // A save with an active hero boots into the hub, so step out to the picker.
  if (await page.$('#switchBtn')) await page.click('#switchBtn');
  await page.waitForSelector('#newName');
  await page.fill('#newName', 'Doomed');
  await page.click('.grade[data-grade="2"]');
  await page.click('#createProfile');
  await page.waitForSelector('#switchBtn');
  await page.click('#switchBtn');
  await page.waitForSelector('#manageBtn');
  ok('the picker offers to manage heroes', true);
  ok('no delete buttons until you ask for them', !(await page.$('[data-del]')));
  await page.click('#manageBtn');
  await page.waitForSelector('[data-del]');
  // Target Doomed specifically: clicking the first delete button would remove
  // whichever hero happens to be top of the list.
  const doomedId = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.profile-row')]
      .find(r => r.querySelector('.pn')?.textContent.trim() === 'Doomed');
    return row?.querySelector('[data-del]')?.dataset.del || null;
  });
  ok('each hero has its own delete button', !!doomedId);
  await page.click(`[data-del="${doomedId}"]`);
  await page.waitForSelector('#confirm');
  const warn = await page.$eval('.panel', e => e.textContent);
  ok('deleting says what will be lost', /answered problems/.test(warn), warn.slice(0, 160));
  ok('deleting offers a backup first', !!(await page.$('#backup')));
  await page.click('#cancel');
  await page.waitForSelector('.profile-card');
  ok('cancelling keeps the hero', (await page.$$('.profile-card')).length >= 1);
  // Cancelling leaves manage mode on, so only re-enter it if it turned off.
  if (!(await page.$('[data-del]'))) await page.click('#manageBtn');
  await page.waitForSelector(`[data-del="${doomedId}"]`);
  await page.click(`[data-del="${doomedId}"]`);
  await page.waitForSelector('#confirm');
  await page.click('#confirm');
  await page.waitForTimeout(150);
  const left = await page.$$eval('.profile-card .pn', els => els.map(e => e.textContent.trim()));
  ok('confirming removes that hero and no other',
     !left.includes('Doomed') && left.length >= 1, left.join(','));

  /* ---- the battlefield and its animations ---- */
  const fxPage = await b.newPage({ viewport: { width: 390, height: 844 } });
  fxPage.on('pageerror', e => errors.push(e.message));
  await fxPage.goto(URL, { waitUntil: 'networkidle' });
  // Its own 4th grader, so the bot can answer every drill: whichever hero
  // happens to be listed first might be one whose questions it can only guess.
  await fxPage.waitForSelector('.profile-card, #newName');
  if (await fxPage.$('#switchBtn')) await fxPage.click('#switchBtn');
  await fxPage.waitForSelector('#newName');
  await fxPage.fill('#newName', 'Mover');
  await fxPage.click('.grade[data-grade="4"]');
  await fxPage.click('#createProfile');
  await fxPage.waitForSelector('#startRun');
  await fxPage.click('#startRun');
  await fxPage.waitForSelector('.node');
  for (let i = 0; i < 6 && !(await fxPage.$('.hand')); i++) {
    const n = await fxPage.$('.node.battle');
    await (n || await fxPage.$('.node')).click();
    if (await fxPage.$('.hand')) break;
    if (await fxPage.$('#go')) { await typeNumber(fxPage, 1, '#go'); await fxPage.click('#next'); }
    else if (await fxPage.$('#leave')) await fxPage.click('#leave');
    else if (await fxPage.$('#heal')) await fxPage.click('#heal');
    await fxPage.waitForSelector('.node, .hand');
  }
  ok('the battle shows both fighters on a field',
     !!(await fxPage.$('.field #heroSprite')) && !!(await fxPage.$('.field #foeSprite')));
  ok('both fighters have a health bar', !!(await fxPage.$('#heroHp')) && !!(await fxPage.$('#foeHp')));

  await buildLegalExpression(fxPage);
  const fxExpr = await readExpression(fxPage);
  const fxHpBefore = await fxPage.$eval('#foeHp b', e => Number(e.textContent.split('/')[0].trim()));
  await typeNumber(fxPage, fxExpr.answer, '#strike');
  ok('a strike plays out before the next turn', !!(await fxPage.$('#app[data-busy]')));
  ok('the answer flies at the enemy', !!(await fxPage.$('.fx-orb')));
  ok('the caption names the move', /used .*Strike/.test(await fxPage.$eval('.log', e => e.textContent)));
  await fxPage.waitForSelector('.fx-num', { timeout: 1500 }).catch(() => {});
  const popped = await fxPage.$eval('.fx-num', e => e.textContent).catch(() => '');
  ok('the hit shows a damage number or a block', /^-\d+$|BLOCKED/.test(popped), popped);
  const midHp = await fxPage.$eval('#foeHp b', e => Number(e.textContent.split('/')[0].trim()));
  ok('the enemy bar drops during the hit', midHp < fxHpBefore || popped === 'BLOCKED', `${fxHpBefore} -> ${midHp}`);
  const fxT0 = Date.now();
  await fxPage.waitForSelector('#app:not([data-busy])', { timeout: 5000 });
  ok('the whole exchange is quick', Date.now() - fxT0 < 2500, `${Date.now() - fxT0}ms`);

  // Tapping skips it at once, and the tap does not also press anything.
  if (await fxPage.$('.drill-problem')) {
    const parts = await fxPage.$$eval('.drill-problem .dp', els => els.map(e => e.textContent.trim()));
    const guess = parts.length === 3 ? OPS[parts[1]](Number(parts[0]), Number(parts[2])) : 7;
    await typeNumber(fxPage, guess, '#answer');
    ok('a parry plays out too', !!(await fxPage.$('#app[data-busy]')));
    await fxPage.click('.fx-skip');
    ok('tapping skips straight to the next turn', !(await fxPage.$('#app[data-busy]')) && !(await fxPage.$('.fx-skip')));
    ok('after skipping the next turn is ready', !!(await fxPage.$('.hand')) || !!(await fxPage.$('.drill-problem'))
       || !!(await fxPage.$('.node')) || !!(await fxPage.$('#cont, #next')));
  }

  // Keep fighting until something faints, watching the caption for it. The
  // bot's moves can be weak, so it skips the replay until the enemy is low,
  // then lets the finishing blow play out. A knockout missed while skipping
  // just means on to the next fight.
  let fainted = '';
  for (let move = 0; move < 200 && !fainted; move++) {
    if (await fxPage.$('.win-scene')) {
      await fxPage.click('#cont', { force: true }); await fxPage.click('#cont');
    }
    if (!(await toHand(fxPage)) && !(await fxPage.$('.drill-problem'))) break;
    const bar = await fxPage.$eval('#foeHp b', e => e.textContent.split('/').map(x => Number(x.trim()))).catch(() => null);
    const low = bar && bar[0] <= bar[1] * 0.5;
    if (await fxPage.$('.drill-problem')) {
      const parts = await fxPage.$$eval('.drill-problem .dp', els => els.map(e => e.textContent.trim()));
      const guess = parts.length === 3 ? OPS[parts[1]](Number(parts[0]), Number(parts[2])) : 7;
      await typeNumber(fxPage, guess, '#answer');
    } else {
      if (!(await buildLegalExpression(fxPage))) { if (await tryReshuffle(fxPage)) continue; break; }
      const ex = await readExpression(fxPage);
      await typeNumber(fxPage, ex.answer, '#strike');
    }
    if (!low) { if (await fxPage.$('.fx-skip')) await fxPage.click('.fx-skip'); continue; }
    for (let t = 0; t < 60; t++) {
      const cap = await fxPage.$eval('.log', e => e.textContent).catch(() => '');
      if (/fainted/.test(cap)) { fainted = cap; break; }
      if (!(await fxPage.$('#app[data-busy]'))) break;
      await fxPage.waitForTimeout(30);
    }
    await fxPage.waitForSelector('#app:not([data-busy])', { timeout: 5000 });
    // Only the enemy fainting counts here; if the hero fell, play on.
    if (fainted && !(await fxPage.$('.win-scene'))) fainted = '';
  }
  ok('a knockout is shown as a faint', /fainted/.test(fainted), fainted);

  /* ---- the win scene ---- */
  if (await fxPage.$('.win-scene')) {
    const banner = await fxPage.$eval('.vbanner', e => e.textContent);
    ok('a win gets a victory banner', /VICTORY|BOSS FELLED/.test(banner), banner);
    ok('the hero stands on the stage', (await fxPage.$eval('.vhero', e => e.textContent)).length > 0);
    const recap = await fxPage.$eval('.recap', e => e.textContent);
    ok('the win recaps the maths in that fight', /\d+ right/.test(recap) && /\d+ wrong/.test(recap), recap);
    ok('the scene is still playing at first', !(await fxPage.$('.win-scene.done')));
    await fxPage.click('#cont', { force: true });
    ok('an early tap finishes the scene instead of leaving it', !!(await fxPage.$('.win-scene.done')));
    await fxPage.click('#cont');
    await fxPage.waitForTimeout(150);
    ok('Continue then moves on', !(await fxPage.$('.win-scene')));
  } else {
    ok('a win gets a victory banner', false, 'no win scene after the knockout');
  }
  await fxPage.close();

  ok('no page errors', errors.length === 0, errors.join(' | '));
} catch (err) {
  failed++;
  console.error('  FAIL threw:', err.message);
} finally {
  await b.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
