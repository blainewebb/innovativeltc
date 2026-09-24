/* Word Punch engine tests: the content itself, question building, the fight
   rules, and profile bookkeeping. Pure Node, no browser.
   Run: node test/engine.test.mjs */
import { WORDS, SENTENCES, SPELLING, FIGHTERS, CIRCUITS, posForGrade } from '../js/data.js';
import {
  makeRng, parseSentence, parseSpelling, poolFor, makeQuestion, buildQuestion, QUESTION_TYPES,
  createFight, resolveAnswer, resolveGetUp, newProfile, recordAnswer, finishFight, progressFor, fighterStats,
} from '../js/engine.js';
import { hydrate, load, save, KEY } from '../js/storage.js';
import { PRIZES } from '../js/prizes.js';
import { WINS_PER_PRIZE, newRewards, recordWin, winsToNext, toggleEquip, equipped, hydrateRewards } from '../js/rewards.js';

let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL ${name} ${extra}`); }
};
const section = n => console.log(`-- ${n}`);
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];

/* ------------------------------------------------------------ content -- */
section('content');
{
  // A loose word must be one part of speech everywhere in the game, or
  // "Which word is a NOUN?" can have two right answers.
  const seen = new Map();
  for (const g of GRADES) for (const [pos, list] of Object.entries(WORDS[g])) {
    ok(`grade ${g} ${pos} list is long enough`, list.length >= 5, `(${list.length})`);
    ok(`grade ${g} ${pos} is taught in grade ${g}`, posForGrade(g).includes(pos));
    for (const w of list) {
      ok(`"${w}" is lowercase and one word`, /^[a-z]+$/.test(w));
      const prev = seen.get(w);
      ok(`"${w}" is only ever one part of speech`, !prev || prev === pos, `(${prev} and ${pos})`);
      seen.set(w, pos);
    }
  }
  // Everyday words that are two parts of speech at once. None may appear loose.
  const TWO_WAY = ['run', 'jump', 'play', 'walk', 'swim', 'kick', 'hug', 'dance', 'fish', 'drink', 'cook', 'paint',
    'rain', 'snow', 'ride', 'nap', 'dream', 'smile', 'laugh', 'clap', 'wave', 'help', 'love', 'work', 'talk', 'cry',
    'sleep', 'look', 'hit', 'dress', 'water', 'box', 'brush', 'light', 'fast', 'hard', 'well', 'clean', 'dry', 'warm',
    'cool', 'open', 'empty', 'quiet', 'right', 'wrong', 'still', 'color', 'cold', 'face', 'practice', 'hope', 'resolve',
    'little', 'pretty', 'round', 'calm', 'patient', 'friendly', 'several', 'neither', 'whatever', 'whichever', 'duck', 'book'];
  for (const w of TWO_WAY) ok(`two-way word "${w}" is not a loose word`, !seen.has(w));

  for (const g of GRADES) {
    const set = posForGrade(g);
    ok(`grade ${g} has sentences`, SENTENCES[g].length >= 10);
    const covered = new Set();
    SENTENCES[g].forEach((src, i) => {
      let parsed;
      try { parsed = parseSentence(src); } catch (e) { ok(`grade ${g} sentence ${i} parses`, false, e.message); return; }
      const asks = parsed.tokens.filter(t => t.ask);
      ok(`grade ${g} sentence ${i} asks about something`, asks.length >= 2);
      ok(`grade ${g} sentence ${i} has a verb`, parsed.tokens.some(t => t.pos === 'v'));
      ok(`grade ${g} sentence ${i} has a noun`, parsed.tokens.some(t => t.pos === 'n'));
      for (const t of asks) covered.add(t.pos);
      for (const w of Object.keys(parsed.notes)) {
        ok(`grade ${g} sentence ${i} note "${w}" matches a tagged word`, parsed.tokens.some(t => t.word === w && t.pos));
      }
      // Anything that is plainly a noun/verb/etc. and untagged would mark a
      // right tap wrong. Catch the easy slips: capitalised names mid-sentence.
      parsed.tokens.slice(1).forEach(t => {
        if (/^[A-Z]/.test(t.word)) ok(`grade ${g} sentence ${i} "${t.word}" is tagged`, !!t.pos);
      });
    });
    for (const p of set) ok(`grade ${g} sentences can ask about ${p}`, covered.has(p) || poolFor(g).sentences.some(s => s.tokens.some(t => t.ask && t.pos === p)));

    ok(`grade ${g} has spelling words`, SPELLING[g].length >= 15);
    for (const line of SPELLING[g]) {
      const s = parseSpelling(line);
      ok(`"${s.word}" sentence has exactly one blank`, s.sentence.split('___').length === 2, s.sentence);
      ok(`"${s.word}" has wrong spellings`, s.wrong.length >= 1);
      ok(`"${s.word}" wrong spellings differ from it`, s.wrong.every(w => w && w !== s.word), s.wrong.join(','));
      ok(`"${s.word}" wrong spellings are unique`, new Set(s.wrong).size === s.wrong.length);
      ok(`"${s.word}" blank is a whole word`, s.sentence.split(/\s+/).some(w => /^[^A-Za-z]*___[^A-Za-z]*$/.test(w)));
    }
  }
  ok('8 fighters', FIGHTERS.length === 8);
  ok('circuits cover every fighter once', CIRCUITS.flatMap(c => c.fighters).sort().join() === '0,1,2,3,4,5,6,7');
  ok('each circuit ends with its champion', CIRCUITS.every(c => FIGHTERS[c.fighters.at(-1)].champion === c.id));
}

/* ---------------------------------------------------------- questions -- */
section('questions');
{
  const rng = makeRng(42);
  let built = 0;
  for (const g of GRADES) for (let idx = 0; idx < 8; idx++) {
    const used = new Set();
    for (let n = 0; n < 60; n++) {
      const q = makeQuestion({ grade: g, idx, rng, missed: {}, used });
      built++;
      const right = q.choices.filter(c => c.correct);
      ok(`${q.type} g${g} has a right answer`, right.length >= 1, q.prompt);
      ok(`${q.type} g${g} has a wrong answer`, q.choices.some(c => !c.correct));
      if (!['tap_pos'].includes(q.type)) ok(`${q.type} g${g} has exactly one right answer`, right.length === 1, JSON.stringify(q.choices));
      const labels = q.choices.map(c => c.label);
      if (['pick_pos', 'spell_pick', 'name_pos'].includes(q.type)) ok(`${q.type} g${g} choices are distinct`, new Set(labels).size === labels.length, labels.join());
      ok(`${q.type} g${g} has an explanation`, q.explain && q.explain.length > 10 && !/undefined|NaN/.test(q.explain), q.explain);
      ok(`${q.type} g${g} has speech`, q.speak && !/undefined/.test(q.speak));
      ok(`${q.type} g${g} skill is known`, ['n', 'v', 'a', 'av', 'pr', 'spell'].includes(q.skill));
      if (q.skill !== 'spell') ok(`${q.type} g${g} asks about a grade-${g} part of speech`, posForGrade(g).includes(q.skill), q.skill);
      if (q.type === 'pick_pos' || q.type === 'name_pos') ok(`g${g} choices fit on screen`, q.choices.length <= 5);
    }
  }
  ok('built lots of questions', built === 8 * 8 * 60);

  // Formats unlock up the ladder.
  const typesSeen = (g, idx) => {
    const r = makeRng(7), s = new Set();
    for (let n = 0; n < 300; n++) s.add(makeQuestion({ grade: g, idx, rng: r, missed: {}, used: new Set() }).type);
    return s;
  };
  ok('grade 1 first fight has no sentence tapping', !typesSeen(1, 0).has('tap_pos') && !typesSeen(1, 0).has('spell_fix'));
  ok('grade 5 champion uses every format', typesSeen(5, 7).size === QUESTION_TYPES.length);

  // Misses come back more often.
  const r = makeRng(3);
  let hits = 0;
  const missed = { 'sp:friend': 4 };
  for (let n = 0; n < 400; n++) if (buildQuestion('spell_pick', { grade: 1, idx: 0, rng: r, missed, used: new Set() }).key === 'sp:friend') hits++;
  const base = 400 / poolFor(1).spelling.length;
  ok('a missed word comes back more often', hits > base * 4, `(${hits} vs ~${base.toFixed(0)})`);

  // No repeats within a fight until the material runs out.
  const used = new Set(), r2 = makeRng(11), keys = [];
  for (let n = 0; n < 12; n++) {
    const k = buildQuestion('spell_pick', { grade: 4, idx: 3, rng: r2, missed: {}, used }).key;
    keys.push(k);
    used.add(k);
  }
  ok('spelling does not repeat inside a fight', new Set(keys).size === 12, keys.join());

  // spell_fix marks the misspelled word as the answer, capitalised at the start.
  const q = buildQuestion('spell_fix', { grade: 3, idx: 7, rng: makeRng(1), missed: {}, used: new Set() });
  const right = q.choices.find(c => c.correct);
  ok('spell_fix right answer is not the real spelling', right && right.label.toLowerCase() !== q.answer.toLowerCase(), JSON.stringify(q));
}

/* -------------------------------------------------------------- fight -- */
section('fight');
{
  for (let idx = 0; idx < 8; idx++) {
    const f = createFight(3, idx);
    let n = 0;
    while (f.phase === 'fight' && n < 50) { resolveAnswer(f, { correct: true }); n++; }
    const st = fighterStats(idx, 3);
    const expected = st.hits + (st.getUps ? Math.ceil(50 / (100 / st.hits)) : 0);
    ok(`fighter ${idx} falls to straight right answers`, f.result === 'win', `(after ${n})`);
    ok(`fighter ${idx} takes about ${expected} right answers`, Math.abs(n - expected) <= 2, `(took ${n})`);
    ok(`fighter ${idx} fight is a sensible length`, n >= 4 && n <= 13, `(${n})`);
  }
  {
    const f = createFight(3, 0);
    const ev = resolveAnswer(f, { correct: false });
    ok('a miss hurts you', f.youHp < 100 && ev[0].type === 'hit');
    ok('a miss resets the streak', f.streak === 0);
  }
  {
    const f = createFight(3, 7);
    for (let i = 0; i < 3; i++) resolveAnswer(f, { correct: true });
    ok('three in a row earns a star', f.stars === 1);
    const hp = f.oppHp;
    const ev = resolveAnswer(f, { correct: true, power: true });
    ok('power punch is an uppercut', ev[0].type === 'uppercut');
    ok('power punch hits harder', hp - f.oppHp > 100 / f.stats.hits * 2, `(${hp - f.oppHp})`);
    ok('power punch spends the star', f.stars === 0);
    const noStar = resolveAnswer(f, { correct: true, power: true });
    ok('no star, no power punch', noStar[0].type === 'jab');
  }
  {
    const f = createFight(3, 7);
    for (let i = 0; i < 3; i++) resolveAnswer(f, { correct: true });
    resolveAnswer(f, { correct: false, power: true });
    ok('a missed power punch loses the star', f.stars === 0);
  }
  {
    const f = createFight(3, 7);
    while (f.phase === 'fight') resolveAnswer(f, { correct: false });
    ok('enough misses put you down', f.phase === 'youDown' && f.youDowns === 1);
    let ev = resolveGetUp(f, false);
    ok('first wrong get-up answer keeps counting', ev[0].type === 'count' && f.phase === 'youDown');
    ev = resolveGetUp(f, true);
    ok('right answer gets you up', ev[0].type === 'youUp' && f.phase === 'fight' && f.youHp > 0);
    while (f.phase === 'fight') resolveAnswer(f, { correct: false });
    resolveGetUp(f, true);
    while (f.phase === 'fight') resolveAnswer(f, { correct: false });
    ok('third knockdown is a TKO', f.phase === 'over' && f.result === 'lose' && f.youDowns === 3);
  }
  {
    const f = createFight(3, 0);
    while (f.phase === 'fight') resolveAnswer(f, { correct: false });
    resolveGetUp(f, false);
    resolveGetUp(f, false);
    ok('two wrong get-up answers is a KO', f.phase === 'over' && f.result === 'lose');
  }
  {
    // A kid getting two out of three right beats the first fighter.
    const r = makeRng(9);
    let wins = 0;
    for (let t = 0; t < 200; t++) {
      const f = createFight(1, 0);
      while (f.phase !== 'over') {
        if (f.phase === 'youDown') resolveGetUp(f, r() < 0.67);
        else resolveAnswer(f, { correct: r() < 0.67 });
      }
      if (f.result === 'win') wins++;
    }
    ok('67% accuracy usually beats Lowercase Larry', wins > 150, `(${wins}/200)`);
    // And 50% should not walk through the champion.
    let champ = 0;
    for (let t = 0; t < 200; t++) {
      const f = createFight(1, 7);
      while (f.phase !== 'over') {
        if (f.phase === 'youDown') resolveGetUp(f, r() < 0.5);
        else resolveAnswer(f, { correct: r() < 0.5 });
      }
      if (f.result === 'win') champ++;
    }
    ok('50% accuracy rarely beats the champion', champ < 40, `(${champ}/200)`);
  }
}

/* ------------------------------------------------------------ profile -- */
section('profile');
{
  const p = newProfile({ name: 'Sam', grade: 2 });
  ok('grade 1-2 boxers get read-aloud on', p.settings.readAloud === true);
  ok('grade 5 boxers get read-aloud off', newProfile({ name: 'x', grade: 5 }).settings.readAloud === false);
  const q = { skill: 'n', key: 'w:apple', prompt: 'p', answer: 'apple', explain: 'e' };
  recordAnswer(p, q, false);
  ok('a miss is remembered', p.missed['w:apple'] === 2 && p.stats.n.wrong === 1 && p.misses.length === 1);
  recordAnswer(p, q, true);
  recordAnswer(p, q, true);
  ok('two rights clear it', !('w:apple' in p.missed) && p.stats.n.right === 2);

  let out = finishFight(p, 2, 0, true);
  ok('beating fighter 0 unlocks fighter 1', progressFor(p, 2).next === 1 && out.nextUnlocked === 1 && !out.belt);
  out = finishFight(p, 2, 1, false);
  ok('a loss unlocks nothing', progressFor(p, 2).next === 1);
  finishFight(p, 2, 1, true);
  out = finishFight(p, 2, 2, true);
  ok('beating Captain Capital wins the minor belt', out.belt?.id === 'minor' && progressFor(p, 2).belts.includes('minor'));
  out = finishFight(p, 2, 2, true);
  ok('a rematch does not award the belt twice', !out.belt && progressFor(p, 2).belts.length === 1);
  for (let i = 3; i < 7; i++) finishFight(p, 2, i, true);
  out = finishFight(p, 2, 7, true);
  ok('beating the king makes you grade champion', out.gradeChamp && progressFor(p, 2).belts.length === 3);
  ok('other grades are untouched', progressFor(p, 3).next === 0);
}

/* ------------------------------------------------------------ storage -- */
section('storage');
{
  const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
  const s = mem();
  const p = newProfile({ name: 'Ava', grade: 4 });
  finishFight(p, 4, 0, true);
  ok('save works', save({ boxers: [p], current: p.id }, s));
  const back = load(s);
  ok('round trip keeps the boxer', back.boxers[0].name === 'Ava' && back.boxers[0].progress[4].next === 1);
  const old = hydrate({ boxers: [{ id: 'x1', name: 'Old', grade: 3 }], current: 'x1' });
  ok('an older save gets missing fields', old.boxers[0].settings.clock === true && Array.isArray(old.boxers[0].misses));
  const junk = hydrate({ boxers: [{ id: 'j', grade: 99, progress: { 3: { next: 'x', belts: 'no' } }, settings: 5 }, null, 7] });
  ok('junk is repaired, not fatal', junk.boxers.length === 1 && junk.boxers[0].grade === 8 && junk.boxers[0].progress[3].next === 0);
  const bad = mem();
  bad.setItem(KEY, '{not json');
  const r = load(bad);
  ok('an unreadable save is not overwritten', r.readOnly && !save(r, bad) && bad.getItem(KEY) === '{not json');
}

/* -------------------------------------------------------------- prizes -- */
section('prizes');
{
  ok('24 prizes', PRIZES.length === 24);
  ok('prize ids are unique', new Set(PRIZES.map(p => p.id)).size === PRIZES.length);
  ok('prizes go card, gear, character', PRIZES.every((p, i) => p.kind === ['card', 'gear', 'character'][i % 3]));
  ok('gear slots are known', PRIZES.filter(p => p.kind === 'gear').every(g => ['gloves', 'ropes', 'celebration'].includes(g.slot)));
  ok('celebrations have a move', PRIZES.filter(p => p.slot === 'celebration').every(g => ['dance', 'spin', 'flex'].includes(g.move)));
  ok('cards have a full look', PRIZES.filter(p => p.kind === 'card').every(c => ['skin', 'hair', 'trunks', 'gloves', 'acc', 'brow'].every(k => c.look[k])));
  ok('every prize has words to show', PRIZES.every(p => p.name && (p.fact || p.desc)));

  const p = newProfile({ name: 'K', grade: 3, gloves: '#fff' });
  ok('new boxers start with no prizes', p.rewards.wins === 0 && p.rewards.earned.length === 0);
  ok('3 wins to the first prize', winsToNext(p, PRIZES) === WINS_PER_PRIZE && WINS_PER_PRIZE === 3);
  let r = recordWin(p, 2, PRIZES);
  ok('a win below their grade does not count', !r.counted && p.rewards.wins === 0);
  r = recordWin(p, 3, PRIZES);
  ok('a win at their grade counts', r.counted && !r.prize && winsToNext(p, PRIZES) === 2);
  recordWin(p, 5, PRIZES);
  ok('a win above their grade counts', p.rewards.wins === 2);
  r = recordWin(p, 3, PRIZES);
  ok('third win earns the first prize, a card', r.prize?.id === PRIZES[0].id && r.prize.kind === 'card');
  ok('meter resets after a prize', winsToNext(p, PRIZES) === 3);
  for (let i = 0; i < 3; i++) r = recordWin(p, 3, PRIZES);
  ok('next prize is gear', r.prize?.kind === 'gear');
  for (let i = 0; i < 3; i++) r = recordWin(p, 3, PRIZES);
  ok('then a character', r.prize?.kind === 'character');

  // A loss through finishFight never touches prizes.
  const before = p.rewards.wins;
  const out = finishFight(p, 3, 0, false);
  ok('a loss earns nothing and takes nothing', p.rewards.wins === before && !out.reward.counted);
  const win = finishFight(p, 3, 0, true);
  ok('finishFight counts a win toward prizes', win.reward.counted && p.rewards.wins === before + 1);

  // Switching things on.
  const gear = PRIZES.find(x => x.kind === 'gear');
  const ch = PRIZES.find(x => x.kind === 'character');
  const card = PRIZES.find(x => x.kind === 'card');
  ok('gear can be switched on', toggleEquip(p, gear) && equipped(p, PRIZES, gear.slot)?.id === gear.id);
  ok('tapping it again switches it off', toggleEquip(p, gear) && !equipped(p, PRIZES, gear.slot));
  ok('a character can be picked', toggleEquip(p, ch) && equipped(p, PRIZES, 'character')?.id === ch.id);
  ok('cards cannot be switched on', !toggleEquip(p, card));
  const unearned = PRIZES.filter(x => x.kind === 'gear')[3];
  ok('unearned gear cannot be switched on', !toggleEquip(p, unearned));

  // Everything earned: no more prizes, meter says done.
  const q = newProfile({ name: 'Q', grade: 1 });
  for (let i = 0; i < 24 * 3 + 5; i++) recordWin(q, 1, PRIZES);
  ok('all 24 prizes can be earned', q.rewards.earned.length === 24);
  ok('no next prize once all are earned', winsToNext(q, PRIZES) === null);

  // Saves: junk cleaned, unearned or wrong-slot equips dropped.
  const h = hydrateRewards({ wins: '7', earned: [PRIZES[1].id, 'nope', PRIZES[1].id], equip: { gloves: PRIZES[1].id, ropes: PRIZES[1].id, character: PRIZES[2].id } }, PRIZES);
  ok('saved prizes are cleaned up', h.wins === 7 && h.earned.length === 1);
  ok('only earned prizes in the right slot stay on', h.equip.gloves === PRIZES[1].id && !h.equip.ropes && !h.equip.character);
  ok('missing rewards load as empty', JSON.stringify(hydrateRewards(undefined, PRIZES)) === JSON.stringify(newRewards()));
  const old = hydrate({ boxers: [{ id: 'x', name: 'Old', grade: 2 }] });
  ok('boxers saved before prizes existed load fine', old.boxers[0].rewards.wins === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
