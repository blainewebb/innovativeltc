/* Runebreaker soak test: a bot plays a long run, always answering correctly,
   so every screen and node type gets exercised and any runtime error surfaces. */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')); }

const URL = `http://127.0.0.1:${process.env.PORT || 8124}/index.html`;
/* Which hero to play as. Without a grade the bot never climbs past fifth
   grade content, so the middle school topics need their own persona or they
   are only ever exercised by the browser test. */
const GRADE = Number(process.env.GRADE || 0);
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

const OP_KEY = { '+': '+', '−': '-', '×': '*', '÷': '/', '^': '^' };

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 420, height: 880 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const seen = new Set();
let deepest = 1, actions = 0, deaths = 0, current = 1;
const runDepths = [];

let slowest = 0, askedSolved = 0, askedGuessed = 0;
const unsolved = new Set();
let lastBad = '';

/** Type any answer the keypad can express, including decimals and negatives. */
async function typeAnswer(text, sel) {
  const t0 = Date.now();
  for (const ch of text) {
    const key = ch === '-' ? '-' : ch;
    await page.click(`.key[data-k="${key}"]`).catch(() => {});
  }
  await page.click(sel);
  slowest = Math.max(slowest, Date.now() - t0);
}

const typeNum = (n, sel) => typeAnswer(String(n), sel);

/* ---------------------------------------------------- written problems --
   The bot has to answer middle school questions or the balance number stops
   measuring the game and starts measuring the bot's reading. These rules
   cover the mechanical shapes: percentages, plain expressions with real
   precedence, powers, roots and solve-for-x. Genuinely wordy ones (ratios,
   fraction word problems) are still guessed, and the run reports how often,
   so a bad number can be told apart from a bad game. */
function evalExpression(text) {
  const t = text.replace(/\u00d7/g, '*').replace(/\u00f7/g, '/').replace(/\u2212/g, '-');
  if (!/^[\d+\-*/().\s]+$/.test(t)) return null;
  // Shunting-yard, so 3 + 4 * 5 is 23 and not 35.
  const tokens = t.match(/\d+\.?\d*|[+\-*/()]/g);
  if (!tokens) return null;
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const out = [], ops = [];
  for (const tok of tokens) {
    if (/^\d/.test(tok)) out.push(Number(tok));
    else if (tok === '(') ops.push(tok);
    else if (tok === ')') { while (ops.length && ops.at(-1) !== '(') out.push(ops.pop()); ops.pop(); }
    else { while (ops.length && prec[ops.at(-1)] >= prec[tok]) out.push(ops.pop()); ops.push(tok); }
  }
  while (ops.length) out.push(ops.pop());
  const st = [];
  for (const tok of out) {
    if (typeof tok === 'number') { st.push(tok); continue; }
    const b = st.pop(), a = st.pop();
    if (a === undefined || b === undefined) return null;
    st.push(tok === '+' ? a + b : tok === '-' ? a - b : tok === '*' ? a * b : a / b);
  }
  const v = st.pop();
  return st.length === 0 && Number.isFinite(v) ? v : null;
}

function gcdOf(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }

/** Answer as the string a player would type, so fractions can be returned. */
function fracText(n, d) {
  const g = gcdOf(n, d);
  return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`;
}

const N = '(\\d+)';

function solveAsked(prompt) {
  const p = prompt.replace(/\u2212/g, '-');
  const hit = re => re.exec(p);
  const num = s2 => Math.round(s2 * 1e6) / 1e6;
  let m;

  /* percentages */
  if ((m = hit(new RegExp(`^What is ${N}% of ${N}\\?$`)))) return String(+m[2] * +m[1] / 100);
  if ((m = hit(new RegExp(`costs ${N} gold and is ${N}% off`)))) return String(+m[1] * (1 - +m[2] / 100));
  if ((m = hit(new RegExp(`^${N} out of ${N}\\. What percent`)))) return String(Math.round(+m[1] / +m[2] * 100));
  if ((m = hit(new RegExp(`hoard of ${N} gold grows by ${N}%`)))) return String(+m[1] * (1 + +m[2] / 100));
  if ((m = hit(new RegExp(`^${N} is ${N}% of what number`)))) return String(+m[1] / (+m[2] / 100));

  /* ratios */
  if ((m = hit(new RegExp(`^${N} potions cost ${N} gold\\. How much do ${N} cost`)))) return String(+m[2] / +m[1] * +m[3]);
  if ((m = hit(new RegExp(`ratio of orcs to goblins is ${N}:${N}\\. If there are ${N} orcs`)))) return String(+m[2] * (+m[3] / +m[1]));
  if ((m = hit(new RegExp(`flies ${N} miles in ${N} hours`)))) return String(+m[1] / +m[2]);
  if ((m = hit(new RegExp(`come ${N} to a bundle\\. How many bundles for ${N} arrows`)))) return String(+m[2] / +m[1]);
  if ((m = hit(new RegExp(`split ${N}:${N} between two heroes\\. If there are ${N} gems`)))) return String(+m[3] * +m[1] / (+m[1] + +m[2]));

  /* fractions */
  if ((m = hit(new RegExp(`^${N}/${N} \\+ ${N}/${N} = \\?$`)))) {
    const n = +m[1] * +m[4] + +m[3] * +m[2];
    return fracText(n, +m[2] * +m[4]);
  }
  if ((m = hit(new RegExp(`^What is 1/${N} of ${N}\\?$`)))) return String(+m[2] / +m[1]);
  if ((m = hit(new RegExp(`^Simplify ${N}/${N}\\.`)))) return fracText(+m[1], +m[2]);
  if ((m = hit(new RegExp(`^Write ${N}/${N} as a decimal`)))) return String(num(+m[1] / +m[2]));
  if ((m = hit(new RegExp(`bag holds ${N} coins\\. You take ${N}/${N} of them`)))) return String(+m[1] * +m[2] / +m[3]);

  /* powers and roots */
  if ((m = hit(new RegExp(`^${N}\\u00b2 \\+ ${N} = \\?$`)))) return String(+m[1] * +m[1] + +m[2]);
  if ((m = hit(new RegExp(`^${N}\\u00b2 = \\?$`)))) return String(+m[1] * +m[1]);
  if ((m = hit(new RegExp(`^${N}\\u00b3 = \\?$`)))) return String(Math.pow(+m[1], 3));
  if ((m = hit(new RegExp(`^\\u221a${N} = \\?$`)))) return String(Math.sqrt(+m[1]));

  /* solving for x */
  if ((m = hit(new RegExp(`^${N}\\(x \\+ ${N}\\) = ${N}\\.`)))) return String(+m[3] / +m[1] - +m[2]);
  if ((m = hit(new RegExp(`^${N}x \\+ ${N} = ${N}\\.`)))) return String((+m[3] - +m[2]) / +m[1]);
  if ((m = hit(new RegExp(`^${N}x = ${N}\\.`)))) return String(+m[2] / +m[1]);
  if ((m = hit(new RegExp(`^x \\u00f7 ${N} = ${N}\\.`)))) return String(+m[2] * +m[1]);
  if ((m = hit(new RegExp(`^x - ${N} = ${N}\\.`)))) return String(+m[2] + +m[1]);

  /* a signed pair, which unary minus makes awkward for the evaluator */
  const plain = p.replace(/\u00d7/g, '*').replace(/\u00f7/g, '/');
  if ((m = /^(-?\d+(?:\.\d+)?) ([+\-*/]) (-?\d+(?:\.\d+)?) = \?$/.exec(plain))) {
    const a = +m[1], b = +m[3];
    const v = m[2] === '+' ? a + b : m[2] === '-' ? a - b : m[2] === '*' ? a * b : a / b;
    return String(num(v));
  }

  /* anything left that is a plain expression, including decimals */
  if (/= \?$/.test(p)) {
    const v = evalExpression(p.replace(/= \?$/, '').trim());
    return v === null ? null : String(num(v));
  }
  return null;
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

/** Everything a turn needs, in one round trip. */
function readBoard() {
  return page.evaluate(() => ({
    runes: [...document.querySelectorAll('.rune')].map(e => e.dataset.op),
    tiles: [...document.querySelectorAll('.tile')].map((e, i) => ({
      i, v: Number(e.textContent.trim()), locked: e.classList.contains('locked'),
    })),
    tags: [...document.querySelectorAll('.enemy-tags .tag')].map(e => e.textContent.trim()),
    drill: [...document.querySelectorAll('.drill-problem .dp')].map(e => e.textContent.trim()),
    asked: document.querySelector('.asked')?.textContent.trim() || null,
    duel: !!document.querySelector('.duel-banner'),
  }));
}

async function bestPlay(board) {
  const { runes, tiles, tags } = board;
  const enemy = readEnemy(tags);
  const live = tiles.filter(t => !t.locked && Number.isFinite(t.v));
  let best = null;
  for (const t1 of live) for (const t2 of live) {
    if (t1.i === t2.i) continue;
    for (const op of runes) {
      const a = t1.v, c = t2.v;
      if (!legalPlay(a, op, c)) continue;
      const r = OPS[{ '+': '+', '-': '\u2212', '*': '\u00d7', '/': '\u00f7', '^': '^' }[op]](a, c);
      const score = scorePlay(r, enemy);
      if (!best || score > best.score) best = { i: t1.i, j: t2.i, op, r, score };
    }
  }
  return best;
}

try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('#newName', GRADE ? `Soak${GRADE}` : 'Soak');
  if (GRADE) await page.click(`.grade[data-grade="${GRADE}"]`);
  await page.click('#createProfile');
  await page.click('#startRun');

  for (actions = 0; actions < 3000; actions++) {
    const floorTxt = await page.$eval('.depth-pill', e => e.textContent).catch(() => null);
    if (floorTxt) {
      const f = Number((floorTxt.match(/\d+/) || [1])[0]);
      if (process.env.TRACE && f !== current) {
        const hpTxt = await page.$eval('.hp-pill', e => e.textContent).catch(() => '?');
        console.error(`  floor ${f}: ${hpTxt.trim()}`);
      }
      current = f;
      deepest = Math.max(deepest, current);
    }

    if (process.env.TRACE) {
      const line = await page.$eval('.log', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
      if (/\u274C|Too slow/.test(line) && line !== lastBad) {
        lastBad = line;
        console.error(`  MISS: ${line.slice(0, 160)}`);
      }
    }
    const board = (await page.$('.drill-problem')) || (await page.$('.hand')) ? await readBoard() : null;

    if (board && board.asked) {                        // a written question
      seen.add('asked');
      if (board.duel) seen.add('boss-duel');
      const solved = solveAsked(board.asked);
      if (solved === null) {
        askedGuessed++;
        unsolved.add(board.asked.slice(0, 60));
        await typeNum(7, '#answer');
      } else {
        askedSolved++;
        await typeAnswer(solved, '#answer');
      }
    } else if (board && board.drill.length) {          // drill calculation
      seen.add('drill');
      if (board.duel) seen.add('boss-duel');
      const answer = OPS[board.drill[1]](Number(board.drill[0]), Number(board.drill[2]));
      if (!Number.isFinite(answer)) break;
      await typeNum(answer, '#answer');
    } else if (board && board.tiles.length) {          // built turn
      seen.add('battle');
      const play = await bestPlay(board);
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
      if (await page.$('.node.boss')) seen.add('boss-floor');
      // The bot cannot read word problems, so it avoids them where it can and
      // the run length being measured stays a test of combat balance.
      const n = await page.$('.node.battle') || await page.$('.node.rest')
             || await page.$('.node.elite') || await page.$('.node');
      await n.click();
    } else if (await page.$('#again')) {
      const cleared = await page.$eval('h2', e => /CLEARED/.test(e.textContent)).catch(() => false);
      if (cleared) { runDepths.push({ end: 'clear', floor: current }); seen.add('cleared'); await page.click('#again'); await page.click('#startRun'); continue; }
      if (process.env.TRACE) {
        const panel = await page.$eval('.panel', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '?');
        console.error(`  DEATH: ${panel.slice(0, 220)}`);
      }
      deaths++;
      runDepths.push({ end: 'death', floor: current });
      seen.add('death');
      if (deaths >= 5) break;
      await page.click('#again');
    } else {
      break;
    }
  }

  const report = { grade: GRADE || 'none', deepest, actions, deaths, runDepths, slowestAnswerMs: slowest,
                   askedSolved, askedGuessed, unsolved: [...unsolved].slice(0, 8),
                   seen: [...seen].sort(), errors };
  console.log(JSON.stringify(report, null, 2));

  let failed = 0;
  const ok = (name, cond, extra = '') => { if (!cond) { failed++; console.error(`FAIL ${name} ${extra}`); } };
  ok('no runtime errors', errors.length === 0, errors.join(' | '));
  // If the harness itself is slower than the in-game minimum allowance, this
  // stops being a balance measurement and starts measuring Playwright.
  ok('the bot answers well inside the clock', slowest < 3000, `slowest answer took ${slowest}ms`);
  ok('a standard run ends at floor 20, not forever', deepest <= 20, `deepest ${deepest}`);
  // The bot plays the arithmetic perfectly but everything else naively, so it
  // should clear at least once in five attempts without clearing every time.
  ok('an optimal player clears the run at least once in five', seen.has('cleared'),
     JSON.stringify(runDepths));
  ok('saw battles', seen.has('battle'));
  ok('saw drill turns', seen.has('drill'));
  ok('saw a boss duel', seen.has('boss-duel'), [...seen].join(','));
  ok('saw the map', seen.has('map'));
  ok('saw a victory screen', seen.has('victory'));
  ok('saw a boss node', seen.has('node:boss'), [...seen].join(','));
  ok('saw a non-combat node', [...seen].some(t => /^node:(riddle|treasure|shop|rest)$/.test(t)), [...seen].join(','));
  // If the bot is mostly guessing at written problems, the clear rate below is
  // measuring its reading rather than the game's balance.
  ok('the bot solves most written problems it meets',
     askedSolved + askedGuessed === 0 || askedSolved / (askedSolved + askedGuessed) > 0.5,
     `solved ${askedSolved}, guessed ${askedGuessed}`);
  // A middle school persona must actually meet middle school work, or the new
  // content is going untested however green the run looks.
  if (GRADE >= 6) {
    ok('a middle school hero is served middle school work',
       askedSolved + askedGuessed > 10, `only ${askedSolved + askedGuessed} written problems`);
    ok('a middle school hero can still clear a run',
       runDepths.some(d => d.end === 'clear'), JSON.stringify(runDepths));
  }
  console.log(failed ? `\n${failed} checks failed` : '\nsoak passed');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.error('threw:', e.message);
  process.exitCode = 1;
} finally {
  await b.close();
}
