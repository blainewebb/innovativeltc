/* Word Kick engine tests: the grade shift, question building on top of Word
   Punch's content, the shootout rules, and profile bookkeeping. Pure Node.
   Run: node test/engine.test.mjs */
import { TEAMS, CUPS, KITS, contentGrade, KICK_NAMES } from '../js/data.js';
import {
  makeKick, starHelp, isTap, createMatch, resolveKick, useStar, goals, KICKS, teamStats,
  newProfile, progressFor, finishMatch, recordAnswer,
} from '../js/engine.js';
import { makeRng, poolFor } from '../../wordpunch/js/engine.js';
import { hydrate, load, save, KEY } from '../js/storage.js';

let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL ${name} ${extra}`); }
};
const section = n => console.log(`-- ${n}`);
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];

/* --------------------------------------------------------------- data -- */
section('data');
{
  ok('eight teams', TEAMS.length === 8);
  ok('cups cover every team once', CUPS.flatMap(c => c.teams).sort().join() === '0,1,2,3,4,5,6,7');
  for (const c of CUPS) {
    const last = TEAMS[c.teams[c.teams.length - 1]];
    ok(`${c.name} ends with its cup final`, last.champion === c.id);
  }
  ok('team ids are unique', new Set(TEAMS.map(t => t.id)).size === TEAMS.length);
  ok('kit ids are unique', new Set(KITS.map(k => k.id)).size === KITS.length);
  for (const k of KITS) {
    ok(`${k.name} kit has every color`, ['shirt', 'alt', 'shorts', 'socks', 'num'].every(f => /^#[0-9a-f]{6}$/i.test(k[f])));
    ok(`${k.name} kit pattern is known`, ['solid', 'stripes', 'hoops', 'checks', 'sash'].includes(k.pattern));
  }
  ok('Argentina is there', KITS.some(k => k.id === 'argentina' && k.pattern === 'stripes'));
}

/* --------------------------------------------------------- grade shift -- */
section('grade shift');
{
  ok('grade 1 stays on grade 1 content', contentGrade(1) === 1);
  for (const g of GRADES.slice(1)) ok(`grade ${g} plays grade ${g - 1} content`, contentGrade(g) === g - 1);

  // Every loose word a grade 3 player is asked about comes from grade 1 or 2,
  // never grade 3.
  const pool2 = new Set(poolFor(2).words.map(w => w.word));
  const rng = makeRng(7);
  let checked = 0, leaked = 0;
  for (let i = 0; i < 400; i++) {
    const q = makeKick({ grade: 3, idx: i % 8, rng, missed: {}, used: new Set() });
    if (q.type === 'pick_pos') {
      checked++;
      if (!q.choices.every(c => pool2.has(c.label))) leaked++;
    }
  }
  ok('grade 3 pick-a-word questions only use grade 1-2 words', checked > 20 && leaked === 0, `(${leaked}/${checked})`);

  // Grade 3 players never see pronoun questions (taught in grade 3).
  let pronoun = 0;
  for (let i = 0; i < 400; i++) {
    const q = makeKick({ grade: 3, idx: 3, rng, missed: {}, used: new Set() });
    if (q.skill === 'pr') pronoun++;
  }
  ok('grade 3 never gets pronouns', pronoun === 0);

  // 1st grade gets 3 choices on pick-a-word and spelling.
  let g1 = 0, g1bad = 0;
  for (let i = 0; i < 300; i++) {
    const q = makeKick({ grade: 1, idx: i % 8, rng, missed: {}, used: new Set() });
    if (q.type === 'pick_pos' || q.type === 'spell_pick') {
      g1++;
      if (q.choices.length > 3 || q.choices.filter(c => c.correct).length !== 1) g1bad++;
      if (q.type === 'pick_pos' && !q.choices.every(c => q.speak.includes(c.label))) g1bad++;
    }
  }
  ok('grade 1 multiple choice has 3 choices, one right, read-aloud matches', g1 > 20 && g1bad === 0, `(${g1bad}/${g1})`);

  const clocks = GRADES.map(g => teamStats(0, g).clock);
  ok('clock gets shorter with grade', clocks.every((c, i) => i === 0 || c <= clocks[i - 1]));
  ok('clock gets shorter up the ladder', teamStats(7, 4).clock < teamStats(0, 4).clock);
  ok('first four keepers never save a right answer', [0, 1, 2, 3].every(i => teamStats(i, 3).reach === 0));
  ok('later keepers have reach', [4, 5, 6, 7].every(i => teamStats(i, 3).reach > 0));
}

/* ----------------------------------------------------------- questions -- */
section('questions');
{
  const rng = makeRng(11);
  let n = 0;
  for (const g of GRADES) for (let idx = 0; idx < 8; idx++) {
    const used = new Set();
    for (let i = 0; i < 25; i++) {
      const q = makeKick({ grade: g, idx, rng, missed: {}, used });
      n++;
      const right = q.choices.filter(c => c.correct).length;
      if (isTap(q) && q.type === 'tap_pos') ok(`g${g} t${idx} tap has a right word`, right >= 1);
      else ok(`g${g} t${idx} ${q.type} has exactly one right answer`, right === 1, `(${right}) ${q.prompt}`);
      ok(`g${g} t${idx} ${q.type} explains itself`, typeof q.explain === 'string' && q.explain.length > 8);
      ok(`g${g} t${idx} ${q.type} has a kick name`, q.kick === KICK_NAMES[q.type]);
      ok(`g${g} t${idx} ${q.type} is recorded as used`, used.has(q.key));

      const gone = new Set(starHelp(q, rng));
      const left = q.choices.filter((c, i) => !gone.has(i));
      ok(`g${g} star help never removes a right answer`, q.choices.every((c, i) => !c.correct || !gone.has(i)));
      const wrongLeft = left.filter(c => !c.correct).length;
      const wrongAll = q.choices.filter(c => !c.correct).length;
      ok(`g${g} star help leaves ${isTap(q) ? 2 : 1} wrong`, wrongLeft === Math.min(isTap(q) ? 2 : 1, wrongAll));
    }
  }
  ok('built a lot of questions', n === 8 * 8 * 25);

  // Team focus shows up: Verbton Wanderers lean on verbs.
  const count = idx => {
    let v = 0, total = 0;
    for (let i = 0; i < 600; i++) {
      const q = makeKick({ grade: 5, idx, rng, missed: {}, used: new Set() });
      if (q.skill !== 'spell') { total++; if (q.skill === 'v') v++; }
    }
    return v / total;
  };
  ok('Verbton Wanderers throw more verbs than Spelling Rovers', count(5) > count(1) + 0.15);
}

/* ------------------------------------------------------------ shootout -- */
section('shootout');
const kick = (m, correct, share = 0.5) => resolveKick(m, { correct, share, timedOut: false });
{
  // Perfect answers: you score every kick and save every kick. 3-0 after
  // three each is out of reach, so it ends early.
  const m = createMatch(3, 0);
  let n = 0;
  while (m.phase !== 'over') { kick(m, true); n++; }
  ok('perfect answers win', m.result === 'win');
  ok('ends early when they cannot catch up', n === 6 && goals(m.you) === 3 && goals(m.them) === 0, `(${n} kicks)`);
  ok('turns alternate, you first', m.you.length === 3 && m.them.length === 3);
}
{
  // All wrong: you miss, they score.
  const m = createMatch(3, 0);
  while (m.phase !== 'over') kick(m, false);
  ok('all wrong loses', m.result === 'lose' && goals(m.you) === 0);
  ok('a loss can end before your last kick', m.you.length < KICKS);
}
{
  // Right on your kicks, wrong on theirs: 5-5, sudden death.
  const m = createMatch(3, 0);
  let ev = [];
  for (let i = 0; i < 10; i++) ev = ev.concat(kick(m, m.turn === 'you'));
  ok('5-5 goes to sudden death', m.sudden && m.phase !== 'over' && ev.some(e => e.type === 'suddenDeath'));
  kick(m, true);             // you score
  ok('sudden death waits for their kick', m.phase !== 'over');
  kick(m, true);             // you save
  ok('score then save wins sudden death', m.result === 'win' && goals(m.you) === 6 && goals(m.them) === 5);
}
{
  const m = createMatch(3, 0);
  for (let i = 0; i < 10; i++) kick(m, m.turn === 'you');
  kick(m, false); kick(m, true);   // both miss
  ok('both missing in sudden death carries on', m.phase !== 'over' && m.you.length === 6);
  kick(m, false); kick(m, false);  // you miss, they score
  ok('miss then concede loses sudden death', m.result === 'lose');
}
{
  // Real shootout early finish: 4-2 after four each... check a close one.
  const m = createMatch(3, 0);
  // you: G G G G, them: G G x x  -> after 4 each 4-2, one kick each left
  const seq = [true, false, true, false, true, true, true, true];
  for (const s of seq) kick(m, s);
  ok('4-2 with one each left is over', m.result === 'win', `${goals(m.you)}-${goals(m.them)} ${m.phase}`);
}
{
  // Quick and slow.
  const m = createMatch(3, 5);   // Verbton Wanderers keeper has reach 0.2
  let ev = kick(m, true, 0.1);
  ok('fast right answer is a top-corner goal', ev[0].goal && ev[0].quick);
  kick(m, true);
  ev = kick(m, true, 0.95);
  ok('slow right answer is saved by a good keeper', !ev[0].goal && ev[0].reason === 'slow');
  ok('slow save still counts as a right answer', m.right === 3 && m.streak === 3);
  kick(m, true);
  ev = kick(m, true, null);
  ok('with the clock off there is no slow save', ev[0].goal && !ev[0].quick);

  const easy = createMatch(3, 0);
  ev = kick(easy, true, 0.99);
  ok('early keepers never save a right answer', ev[0].goal);
  ev = resolveKick(easy, { correct: false, timedOut: true, share: 1 });
  ok('timing out on their kick lets it in', !ev[0].saved && ev[0].timedOut);
  ev = resolveKick(easy, { correct: false, timedOut: true, share: 1 });
  ok('timing out on your kick is a miss', !ev[0].goal && ev[0].reason === 'timeout');
}
{
  // Stars.
  const m = createMatch(4, 0);
  const ev = [...kick(m, true), ...kick(m, true), ...kick(m, true)];
  ok('3 in a row earns a star', m.stars === 1 && ev.some(e => e.type === 'star'));
  ok('a star can be used', useStar(m) && m.stars === 0);
  ok('no stars, no help', !useStar(m));
  const m2 = createMatch(4, 0);
  m2.stars = 3; m2.streak = 2;
  kick(m2, true);
  ok('stars cap at 3', m2.stars === 3);
  kick(m2, false);
  ok('a miss resets the streak', m2.streak === 0);
}
{
  const m = createMatch(3, 0);
  while (m.phase !== 'over') kick(m, true);
  let threw = false;
  try { kick(m, true); } catch { threw = true; }
  ok('no kicks after the final whistle', threw);
}

/* ------------------------------------------------------------- profile -- */
section('profile');
{
  const p = newProfile({ name: 'Maya', grade: 3, kit: 'argentina', number: 10 });
  ok('read-aloud on while questions are grade 2 or below', p.settings.readAloud === true);
  ok('read-aloud off from grade 4', newProfile({ name: 'x', grade: 4 }).settings.readAloud === false);
  ok('number clamps', newProfile({ number: 250 }).number === 99 && newProfile({ number: 'abc' }).number === 10);

  for (const i of [0, 1]) finishMatch(p, 3, i, true);
  let out = finishMatch(p, 3, 2, true);
  ok('beating Adjective Athletic wins the Local Cup', out.cup?.id === 'local' && progressFor(p, 3).cups.includes('local'));
  ok('Continental Cup opens', progressFor(p, 3).next === 3 && out.nextUnlocked === 3);
  out = finishMatch(p, 3, 2, true);
  ok('winning the final again gives no second cup', !out.cup && progressFor(p, 3).cups.length === 1);
  out = finishMatch(p, 3, 3, false);
  ok('a loss moves nothing', progressFor(p, 3).next === 3 && !out.cup);
  for (const i of [3, 4, 5, 6]) finishMatch(p, 3, i, true);
  out = finishMatch(p, 3, 7, true);
  ok('Golden Cup makes you grade champion', out.cup?.id === 'golden' && out.gradeChamp);
  ok('other grades are untouched', progressFor(p, 4).next === 0);
  ok('matches and wins counted', p.matches === 10 && p.wins === 9);

  const q = { skill: 'n', key: 'w:dog', prompt: 'x', answer: 'dog', explain: 'y' };
  recordAnswer(p, q, false);
  ok('misses are remembered', p.missed['w:dog'] > 0 && p.misses.length === 1);
}

/* ------------------------------------------------------------- storage -- */
section('storage');
{
  const mem = () => { const d = {}; return { getItem: k => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, d }; };
  const s = mem();
  const p = newProfile({ name: 'Maya', grade: 3, kit: 'brazil', number: 7 });
  finishMatch(p, 3, 0, true);
  ok('saves', save({ players: [p], current: p.id }, s));
  const back = load(s);
  ok('loads what it saved', back.players[0].name === 'Maya' && back.players[0].kit === 'brazil' && back.players[0].progress[3].next === 1);
  ok('uses its own key', KEY === 'wordkick-v1' && s.d[KEY]);

  const junk = hydrate({ players: [{ id: 'a', grade: 99, kit: 'atlantis', number: -4, progress: { 3: { next: 'x', cups: [1, 'local'] } }, misses: 'no' }, null, 5], current: 'zzz' });
  const j = junk.players[0];
  ok('junk data loads safely', junk.players.length === 1 && j.grade === 8 && j.kit === KITS[0].id && j.number === 1);
  ok('junk progress is cleaned', j.progress[3].next === 0 && j.progress[3].cups.join() === 'local' && Array.isArray(j.misses));
  ok('missing current falls back to first player', junk.current === 'a');

  const bad = { getItem: () => '{nope', setItem: () => {} };
  const r = load(bad);
  ok('unreadable save is left alone and read-only', r.readOnly && !save(r, bad));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
