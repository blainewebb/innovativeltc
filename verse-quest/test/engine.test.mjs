/* Verse Quest engine tests: the content itself, exercise building, the
   learning schedule, streaks, trivia picking, and saves. Pure Node, no browser.
   Run: node test/engine.test.mjs */

import { readFileSync } from 'node:fs';

// The rules live in ../index.html between the @engine markers, with no page
// code, so they load straight into Node.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const code = html.slice(html.indexOf('// @engine-begin'), html.indexOf('// @engine-end'));
const NAMES = ['VERSES', 'TRIVIA', 'CATEGORIES', 'BADGES', 'NIV_NOTICE', 'makeRng', 'tokenize', 'chunks', 'norm', 'wordPool',
  'buildLesson', 'buildReview', 'allowance', 'newProfile', 'startVerse', 'plan', 'stepsLeftToday', 'finishLesson',
  'finishReview', 'finishTrivia', 'recordTrivia', 'countActivity', 'currentStreak', 'pickTrivia', 'triviaChoices',
  'addDays', 'daysBetween', 'masteredIds', 'summary', 'STEPS', 'STEPS_PER_DAY', 'MAX_ACTIVE', 'MAX_PLAYERS', 'INTERVALS',
  'GOLD_BOX', 'hydrate', 'load', 'save', 'KEY'];
const E = new Function(`'use strict';\n${code}\nreturn { ${NAMES.join(', ')} };`)();
const {
  VERSES, TRIVIA, CATEGORIES, BADGES, NIV_NOTICE, makeRng, tokenize, chunks, norm, wordPool, buildLesson, buildReview,
  allowance, newProfile, startVerse, plan, stepsLeftToday, finishLesson, finishReview, finishTrivia, recordTrivia,
  countActivity, currentStreak, pickTrivia, triviaChoices, addDays, daysBetween, masteredIds, summary,
  STEPS, STEPS_PER_DAY, MAX_ACTIVE, MAX_PLAYERS, INTERVALS, GOLD_BOX, hydrate, load, save, KEY,
} = E;

let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) passed++;
  else { failed++; console.error(`  FAIL ${name} ${extra}`); }
};
const section = n => console.log(`-- ${n}`);
const D0 = '2026-10-02';

/* ------------------------------------------------------------ content -- */
section('content');
{
  const ids = new Set(), refs = new Set();
  let verseCount = 0;
  for (const v of VERSES) {
    ok(`${v.id} id is unique`, !ids.has(v.id)); ids.add(v.id);
    ok(`${v.ref} ref is unique`, !refs.has(v.ref)); refs.add(v.ref);
    const m = v.ref.match(/^(\d )?[A-Z][a-z]+ (\d+):(\d+)(?:-(\d+))?$/);
    ok(`${v.ref} looks like a reference`, !!m);
    if (m) verseCount += m[4] ? Number(m[4]) - Number(m[3]) + 1 : 1;
    const toks = tokenize(v.text);
    ok(`${v.ref} has words`, toks.length >= 5);
    ok(`${v.ref} rebuilds from its words`, toks.map(t => t.t).join(' ').replace(/— /g, '—') === v.text, toks.map(t => t.t).join(' '));
    ok(`${v.ref} has no doubled spaces`, !/\s\s/.test(v.text));
    ok(`${v.ref} uses curly quotes`, !/["']/.test(v.text));
  }
  // Biblica allows up to 500 NIV verses without written permission.
  ok('well under the NIV 500-verse limit', verseCount < 100, `(${verseCount})`);
  ok('notice names Biblica', NIV_NOTICE.includes('Biblica'));

  const qids = new Set();
  for (const q of TRIVIA) {
    ok(`${q.id} id is unique`, !qids.has(q.id)); qids.add(q.id);
    ok(`${q.id} has a known category`, q.cat in CATEGORIES);
    ok(`${q.id} has 1 or 3 wrong answers`, q.wrong.length === 1 || q.wrong.length === 3);
    ok(`${q.id} answers are all different`, new Set([q.a, ...q.wrong].map(s => s.toLowerCase())).size === q.wrong.length + 1);
    ok(`${q.id} has an explanation`, q.why && q.why.length > 15);
    ok(`${q.id} ref is a string or null`, q.ref === null || (typeof q.ref === 'string' && q.ref.length > 3));
    if (q.wrong.length === 1) ok(`${q.id} true/false is True/False`, [q.a, q.wrong[0]].sort().join() === 'False,True');
  }
  for (const c of Object.keys(CATEGORIES)) ok(`category ${c} has at least 5 questions`, TRIVIA.filter(q => q.cat === c).length >= 5);
  ok('there are enough questions for many rounds', TRIVIA.length >= 50);
  ok('badge ids unique', new Set(BADGES.map(b => b.id)).size === BADGES.length);
  ok('word pool has no proper names', !wordPool().some(w => /^(Jesus|Christ|God|LORD|Lord|Spirit|Father|I)$/.test(w)));
}

/* ---------------------------------------------------------- exercises -- */
section('exercises');
for (const v of VERSES) {
  const toks = tokenize(v.text);
  const groups = chunks(toks);
  ok(`${v.ref} has at least 3 order tiles`, groups.length >= 3);
  ok(`${v.ref} tiles cover every word once in order`, groups.flat().join() === toks.map((_, i) => i).join());
  for (let seed = 1; seed <= 25; seed++) {
    const rng = makeRng(seed);
    for (let step = 1; step <= STEPS; step++) {
      for (const ex of buildLesson(v, step, rng)) check(ex, v, `${v.ref} step ${step} seed ${seed}`);
    }
    for (const ex of buildReview(v, seed % 6, rng)) check(ex, v, `${v.ref} review seed ${seed}`);
  }
}
function check(ex, v, where) {
  if (ex.type === 'blanks') {
    ok(`${where}: blanks has holes`, ex.holes.length >= 1);
    const bank = ex.bank.map(b => b.n);
    for (const h of ex.holes) {
      const i = bank.indexOf(ex.tokens[h].n);
      ok(`${where}: hole word "${ex.tokens[h].c}" is in the bank`, i >= 0);
      if (i >= 0) bank.splice(i, 1);
    }
    ok(`${where}: bank has 2 extra words`, bank.length === 2);
    ok(`${where}: extra words are not in the verse`, bank.every(n => !ex.tokens.some(t => t.n === n)));
  } else if (ex.type === 'order') {
    const canon = ex.tiles.slice().sort((a, b) => a.k - b.k).map(t => t.text).join(' ');
    ok(`${where}: order tiles rebuild the verse`, canon === ex.tokens.map(t => t.t).join(' '));
    ok(`${where}: order tiles start shuffled`, !ex.tiles.every((t, i) => t.k === i));
  } else if (ex.type === 'next') {
    ex.options.forEach((opts, i) => {
      ok(`${where}: next has 3 options`, opts.length === 3);
      ok(`${where}: exactly one option is word ${i}`, opts.filter(w => norm(w) === ex.tokens[i].n).length === 1, opts.join('/'));
    });
  } else if (ex.type === 'ref') {
    ok(`${where}: ref has 4 choices, 1 right`, ex.choices.length === 4 && ex.choices.filter(c => c.correct).length === 1);
    ok(`${where}: ref choices all different`, new Set(ex.choices.map(c => c.label)).size === 4);
  } else ok(`${where}: known type`, ex.type === 'read');
}

/* ---------------------------------------------------------- schedule -- */
section('schedule');
{
  const p = newProfile({ name: 'Ada' });
  const first = VERSES[0].id;
  let pl = plan(p, D0);
  ok('new player is offered the first verse', pl.next?.id === first && !pl.lessons.length);
  ok('can start', startVerse(p, first));
  ok('cannot start twice', !startVerse(p, first));
  ok('second verse can start', startVerse(p, VERSES[1].id));
  ok(`only ${MAX_ACTIVE} at once`, !startVerse(p, VERSES[2].id) && plan(p, D0).next === null);

  // Too many mistakes: no progress, but it still counts as an activity.
  const r0 = finishLesson(p, first, allowance(VERSES[0]) + 1, D0);
  ok('failed step does not advance', !r0.passed && p.verses[first].stage === 0);
  ok('failed step counts toward goal', p.days[D0] === 1);

  let day = D0, r;
  for (let s = 1; s <= STEPS; s++) {
    if (stepsLeftToday(p, first, day) === 0) day = addDays(day, 1);
    r = finishLesson(p, first, 0, day);
    ok(`step ${s} passes`, r.passed && p.verses[first].stage === s);
  }
  ok(`steps limited to ${STEPS_PER_DAY} a day`, daysBetween(D0, day) === Math.ceil(STEPS / STEPS_PER_DAY) - 1);
  ok('step 5 memorizes the verse', r.mastered && masteredIds(p).includes(first));
  ok('first review is tomorrow', p.verses[first].due === addDays(day, 1));
  ok('first-verse badge', p.badges.includes('first-verse') && p.badges.includes('first-step'));
  ok('a slot opened for a new verse', plan(p, day).next?.id === VERSES[2].id);
  ok('no review due the same day', !plan(p, day).reviews.length);

  // Pass reviews on the day they're due until gold.
  let d = p.verses[first].due;
  for (let b = 1; b <= GOLD_BOX; b++) {
    ok(`review ${b} is due on ${d}`, plan(p, d).reviews.includes(first) && !plan(p, addDays(d, -1)).reviews.includes(first));
    r = finishReview(p, first, 0, d);
    ok(`review ${b} moves to box ${b}`, r.passed && p.verses[first].box === b);
    ok(`review ${b} next due in ${INTERVALS[b]} days`, daysBetween(d, p.verses[first].due) === INTERVALS[b]);
    d = p.verses[first].due;
  }
  ok('gold after box 4', r.gold && p.badges.includes('gold') && summary(p, d).gold === 1);
  r = finishReview(p, first, 99, d);
  ok('missed review drops two boxes', !r.passed && p.verses[first].box === GOLD_BOX - 2);
  ok('missed review comes back tomorrow', p.verses[first].due === addDays(d, 1));
  for (let i = 0; i < 10; i++) finishReview(p, first, 99, addDays(d, i + 1));
  ok('box never goes below 0', p.verses[first].box === 0);
  for (let i = 0; i < 20; i++) finishReview(p, first, 0, addDays(d, 20 + i));
  ok('box tops out at the last interval', p.verses[first].box === INTERVALS.length - 1);
}

/* ------------------------------------------------------------ streaks -- */
section('streaks');
{
  const p = newProfile({ name: 'Ben' });
  const goal = p.settings.goal;
  const meet = day => { for (let i = 0; i < goal; i++) countActivity(p, day); };
  countActivity(p, D0);
  ok('below goal: no streak yet', currentStreak(p, D0) === 0);
  meet(D0);
  ok('goal met: streak 1', currentStreak(p, D0) === 1);
  meet(D0);
  ok('extra activity same day does not double count', currentStreak(p, D0) === 1);
  ok('streak alive next morning', currentStreak(p, addDays(D0, 1)) === 1);
  ok('streak gone after a missed day with no saver', currentStreak(p, addDays(D0, 2)) === 0);
  for (let i = 1; i < 7; i++) meet(addDays(D0, i));
  ok('7 days in a row', currentStreak(p, addDays(D0, 6)) === 7 && p.streak.freezes === 1);
  ok('streak-7 badge counted', p.streak.best === 7);
  ok('saver keeps streak through one missed day', currentStreak(p, addDays(D0, 8)) === 7);
  meet(addDays(D0, 8));
  ok('saver used up', p.streak.count === 8 && p.streak.freezes === 0);
  meet(addDays(D0, 11));
  ok('two missed days reset', p.streak.count === 1 && p.streak.best === 8);
}

/* ------------------------------------------------------------- trivia -- */
section('trivia');
{
  const p = newProfile({ name: 'Cy' });
  const rng = makeRng(7);
  const round = pickTrivia(p, rng);
  ok('round has 5 different questions', round.length === 5 && new Set(round.map(q => q.id)).size === 5);
  ok('category filter works', pickTrivia(p, rng, 5, 'jesus').every(q => q.cat === 'jesus'));
  for (const q of TRIVIA) {
    const ch = triviaChoices(q, rng);
    ok(`${q.id} one right choice`, ch.filter(c => c.correct).length === 1 && ch.find(c => c.correct).label === q.a);
    if (q.wrong.length === 1) ok(`${q.id} reads True then False`, ch[0].label === 'True');
  }
  // Missed questions should come up far more than ones known well.
  const missed = TRIVIA[0], known = TRIVIA[1];
  recordTrivia(p, missed.id, false);
  for (let i = 0; i < 5; i++) recordTrivia(p, known.id, true);
  let m = 0, k = 0;
  for (let s = 0; s < 400; s++) { const ids = pickTrivia(p, makeRng(s + 1)).map(q => q.id); m += ids.includes(missed.id); k += ids.includes(known.id); }
  ok('missed question comes up more than a known one', m > k * 4, `(${m} vs ${k})`);
  const r = finishTrivia(p, 5, 5, D0);
  ok('perfect round badge and bonus', r.perfect && p.badges.includes('perfect') && r.stars === 15);
}

/* ------------------------------------------------------------ storage -- */
section('storage');
{
  const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
  const s = mem();
  ok('empty storage loads', load(s).players.length === 0);
  const p = newProfile({ name: 'Dee' });
  startVerse(p, VERSES[0].id);
  finishLesson(p, VERSES[0].id, 0, D0);
  ok('saves', save({ players: [p], current: p.id }, s));
  const back = load(s);
  ok('round trip keeps progress', back.players[0].verses[VERSES[0].id].stage === 1 && back.current === p.id);
  s.setItem(KEY, '{not json');
  const bad = load(s);
  ok('corrupt save loads read-only', bad.readOnly && !save(bad, s) && s.m.get(KEY) === '{not json');
  const junk = hydrate({ players: [null, 5, { id: 'x', name: 'A very very long name here', color: 'red',
    verses: { 'gen-1-1': { stage: 99, box: -3, due: 'soon' }, 'no-such-verse': { stage: 2 } },
    trivia: { q: { right: 'x' } }, days: { bad: 3, [D0]: 2 }, streak: { count: -1, last: 'x', freezes: 9 },
    settings: { goal: 17 }, badges: [1, 'gold'] }], current: 'nobody' });
  const j = junk.players[0];
  ok('junk players dropped, unknown current cleared', junk.players.length === 1 && junk.current === null);
  ok('junk fields fixed', j.name.length <= 16 && j.color.startsWith('#') && j.settings.goal === 3 && j.streak.freezes === 2 && j.streak.last === null);
  ok('stage clamped, unknown verse dropped', j.verses['gen-1-1'].stage === STEPS && j.verses['gen-1-1'].box === 0 && !j.verses['no-such-verse']);
  ok('bad dates dropped', !('bad' in j.days) && j.days[D0] === 2 && j.verses['gen-1-1'].due === null);
  ok('junk loads into a working plan', Array.isArray(plan(j, D0).reviews));
  const many = hydrate({ players: [1, 2, 3, 4, 5].map(n => ({ id: 'p' + n, name: 'Kid ' + n })) });
  ok(`never more than ${MAX_PLAYERS} players`, MAX_PLAYERS === 3 && many.players.length === 3);
  ok('long dashes split into words', tokenize('faith\u2014and this').map(t => t.c).join() === 'faith,and,this');
  const throws = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  ok('blocked storage is read-only', load(throws).readOnly === true);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
