/* Runebreaker engine tests. Run: node test/engine.test.mjs */
import assert from 'node:assert/strict';
import {
  makeRng, blankMastery, recordAttempt, skillScore, shakyFacts, difficultyLevel,
  unlockedOps, generateHand, isLegal, evaluate, legalPlays, computeDamage,
  spawnEnemy, enemyAct, describeIntent, generateFloor, generateRiddle, offerRelics,
  newRun, handSize, reshuffles, classify, factKey, bestHitEstimate, turnsFor,
  effectiveHit, tileRangeFor, parseFactKey, problemForSkill, pickDrill,
  drillAllowanceMs, DRILL_MIN_MS, DRILL_MAX_MS, DRILL_DEFAULT_MS,
  isBossFloor, bossFightMs, BOSS_EVERY, FINAL_DEPTH, totalAttempts,
  GRADE_DECAY_ATTEMPTS, GRADE_GRACE_ATTEMPTS, MAX_LEVEL, negativeTilesFor,
  parseAnswer, checkAnswer, answerValue, formatAnswer, typeInto,
  expectedDrillDamage,
} from '../js/engine.js';
import { RIDDLES, SKILLS, RELICS, WARDS, RESISTS, GRADES, GRADE_BY_ID,
         ASKED, ASKED_SKILLS, simplifyFraction, RUNES,
         AVATARS, unlockedAvatars, nextAvatar, avatarsEarnedBetween,
         FLOORS_PER_AVATAR } from '../js/data.js';

/** A drill is either a calculation off the tiles or a written question. */
function drillIsUsable(d) {
  if (!d) return false;
  if (d.kind === 'text') {
    return typeof d.prompt === 'string' && d.prompt.length > 2
      && Number.isFinite(answerValue(d.answer))
      && !/undefined|NaN|Infinity/.test(d.prompt);
  }
  return isLegal(d.a, d.op, d.b) && Number.isFinite(d.answer);
}

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e.message}`); process.exitCode = 1; }
};

/* ------------------------------------------------------------ basics -- */
test('classify buckets by size, not just operator', () => {
  assert.equal(classify(7, '+', 8), 'add_small');
  assert.equal(classify(24, '+', 31), 'add_big');
  assert.equal(classify(4, '*', 5), 'mult_easy');
  assert.equal(classify(7, '*', 8), 'mult_hard');
  assert.equal(classify(24, '/', 8), 'div_hard');
  assert.equal(classify(15, '/', 3), 'div_easy');
});

test('factKey treats 7x8 and 8x7 as the same fact but 12-5 and 5-12 as different', () => {
  assert.equal(factKey(7, '*', 8), factKey(8, '*', 7));
  assert.notEqual(factKey(12, '-', 5), factKey(5, '-', 12));
});

test('legality blocks negatives and non-whole division', () => {
  assert.equal(isLegal(3, '-', 7), false);
  assert.equal(isLegal(7, '-', 3), true);
  assert.equal(isLegal(7, '/', 3), false);
  assert.equal(isLegal(12, '/', 3), true);
  assert.equal(isLegal(5, '/', 0), false);
  assert.equal(evaluate(12, '/', 3), 4);
});

/* ----------------------------------------------------------- mastery -- */
test('mastery ema rises with correct answers and falls with wrong', () => {
  const m = blankMastery();
  for (let i = 0; i < 10; i++) recordAttempt(m, { skill: 'add_small', fact: '3+4', correct: true, ms: 2000 });
  const high = m.skills.add_small.ema;
  for (let i = 0; i < 10; i++) recordAttempt(m, { skill: 'add_small', fact: '3+4', correct: false, ms: 2000 });
  assert.ok(high > 0.85, `ema should climb, got ${high}`);
  assert.ok(m.skills.add_small.ema < 0.2, `ema should fall, got ${m.skills.add_small.ema}`);
});

test('skillScore stays low until there is enough evidence', () => {
  const m = blankMastery();
  recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 1500 });
  assert.ok(skillScore(m.skills.mult_hard) < 0.3, 'one right answer must not read as mastery');
  for (let i = 0; i < 15; i++) recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 1500 });
  assert.ok(skillScore(m.skills.mult_hard) > 0.8, 'sustained fast correct answers should read as solid');
});

test('slow but correct scores below fast and correct', () => {
  const fast = blankMastery(), slow = blankMastery();
  for (let i = 0; i < 15; i++) {
    recordAttempt(fast, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 2000 });
    recordAttempt(slow, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 18000 });
  }
  assert.ok(skillScore(fast.skills.mult_hard) > skillScore(slow.skills.mult_hard));
});

test('word problems are not marked weak for taking time to read', () => {
  const m = blankMastery();
  // All correct, but slowly: exactly what careful reading looks like.
  for (let i = 0; i < 12; i++) recordAttempt(m, { skill: 'word_2step', fact: null, correct: true, ms: 25000 });
  for (let i = 0; i < 12; i++) recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 25000 });
  assert.ok(skillScore(m.skills.word_2step, 'word_2step') > 0.9,
    'slow but always right on a word problem should read as solid');
  assert.ok(skillScore(m.skills.mult_hard, 'mult_hard') < 0.8,
    'slow recall of a times table is genuinely not fluent yet');
});

test('a fact answered right but very slowly still needs drilling', () => {
  const m = blankMastery();
  for (let i = 0; i < 6; i++) recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 15000 });
  for (let i = 0; i < 6; i++) recordAttempt(m, { skill: 'mult_easy', fact: '2*3', correct: true, ms: 1200 });
  const keys = shakyFacts(m).map(f => f.key);
  assert.ok(keys.includes('7*8'), 'fifteen seconds of counting is not fluency');
  assert.ok(!keys.includes('2*3'));
});

test('the drill list leaves out facts the kid already knows', () => {
  const m = blankMastery();
  for (let i = 0; i < 8; i++) recordAttempt(m, { skill: 'mult_easy', fact: '3*4', correct: true, ms: 1100 });
  for (let i = 0; i < 8; i++) recordAttempt(m, { skill: 'add_small', fact: '7+8', correct: true, ms: 1200 });
  for (let i = 0; i < 8; i++) recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: false, ms: 9000 });
  const shaky = shakyFacts(m);
  assert.deepEqual(shaky.map(f => f.key), ['7*8'],
    'a report card that lists mastered facts as "to drill" tells a parent nothing');
});

test('shakyFacts surfaces the worst facts first', () => {
  const m = blankMastery();
  for (let i = 0; i < 6; i++) recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: false, ms: 9000 });
  for (let i = 0; i < 6; i++) recordAttempt(m, { skill: 'mult_easy', fact: '2*3', correct: true, ms: 1200 });
  const shaky = shakyFacts(m, 5);
  assert.equal(shaky[0].key, '7*8');
  assert.ok(shaky[0].accuracy === 0);
  assert.ok(!shaky.some(f => f.key === '2*3'), 'a fast, always-correct fact is not shaky');
});

test('operator runes unlock in order, never skipping ahead', () => {
  const m = blankMastery();
  assert.deepEqual(unlockedOps(m), ['+', '-']);
  for (let i = 0; i < 20; i++) recordAttempt(m, { skill: 'add_small', fact: '3+4', correct: true, ms: 1500 });
  assert.ok(unlockedOps(m).includes('*'));
  assert.ok(!unlockedOps(m).includes('/'), 'division should wait for multiplication');
  for (let i = 0; i < 25; i++) recordAttempt(m, { skill: 'mult_easy', fact: '3*4', correct: true, ms: 1500 });
  assert.ok(unlockedOps(m).includes('/'));
});

test('difficulty level stays in range and reacts to performance', () => {
  const weak = blankMastery(), strong = blankMastery();
  for (let i = 0; i < 12; i++) {
    recordAttempt(weak, { skill: 'mult_hard', fact: '7*8', correct: false, ms: 14000 });
    recordAttempt(strong, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 1500 });
  }
  const lw = difficultyLevel(weak), ls = difficultyLevel(strong);
  assert.ok(lw >= 1 && lw <= 6 && ls >= 1 && ls <= 6);
  assert.ok(ls > lw, `strong (${ls}) should outrank weak (${lw})`);
});

/* ------------------------------------------------------------- hands -- */
test('every generated hand offers at least one legal play', () => {
  const m = blankMastery();
  for (let i = 0; i < 25; i++) recordAttempt(m, { skill: 'add_small', fact: '3+4', correct: true, ms: 1500 });
  for (let i = 0; i < 30; i++) recordAttempt(m, { skill: 'mult_easy', fact: '3*4', correct: true, ms: 1500 });
  for (let seed = 1; seed <= 400; seed++) {
    const rng = makeRng(seed);
    for (const runes of [['+', '-'], ['+', '-', '*'], ['+', '-', '*', '/']]) {
      const hand = generateHand(rng, { mastery: m, runes, size: 5, depth: (seed % 12) + 1 });
      assert.equal(hand.length, 5, 'hand size');
      assert.ok(hand.every(t => Number.isInteger(t.value) && t.value >= 0), 'tiles are whole numbers');
      assert.ok(new Set(hand.map(t => t.id)).size === 5, 'tile ids are unique');
      assert.ok(legalPlays(hand, runes).length > 0, `seed ${seed} runes ${runes} produced a dead hand`);
    }
  }
});

test('tiles never escape the level range the balance is budgeted against', () => {
  // Enemy health is computed from the level's tile ceiling. A tile above it
  // would silently make every fight a one-shot, so this must hold exactly.
  for (let level = 1; level <= 6; level++) {
    const m = blankMastery();
    // Drive the profile to roughly this level, then check whatever it emits.
    const feed = (skill, n, ok) => { for (let i = 0; i < n; i++) recordAttempt(m, { skill, fact: null, correct: ok, ms: 1500 }); };
    feed('add_small', 20, true);
    if (level >= 2) feed('mult_easy', 25, true);
    if (level >= 3) feed('mult_hard', 20, true);
    if (level >= 4) feed('div_easy', 20, true);
    const [lo, hi] = tileRangeFor(difficultyLevel(m));
    for (let seed = 1; seed <= 300; seed++) {
      const hand = generateHand(makeRng(seed), { mastery: m, runes: ['+', '-', '*', '/'], size: 5, depth: (seed % 20) + 1 });
      for (const t of hand) assert.ok(t.value >= lo && t.value <= hi, `tile ${t.value} outside ${lo}-${hi}`);
    }
  }
});

test('hands target a known weakness, not whatever is untouched', () => {
  const m = blankMastery();
  // Strong on the small tables, demonstrably shaky on 6-12, plus a skill the
  // kid has never seen. The shaky one is what needs practice.
  for (let i = 0; i < 25; i++) recordAttempt(m, { skill: 'add_small', fact: '3+4', correct: true, ms: 1200 });
  for (let i = 0; i < 25; i++) recordAttempt(m, { skill: 'mult_easy', fact: '3*4', correct: true, ms: 1200 });
  for (let i = 0; i < 15; i++) recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: false, ms: 12000 });
  let withBigFactor = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const hand = generateHand(makeRng(seed), { mastery: m, runes: ['+', '-', '*'], size: 5, depth: 3 });
    if (hand.some(t => t.value >= 6)) withBigFactor++;
  }
  assert.ok(withBigFactor / 400 > 0.8, `expected most hands to enable the weak skill, got ${withBigFactor}/400`);
});

test('old: hands aim at the weakest skill the player has a rune for', () => {
  const m = blankMastery();
  // Strong at addition, shaky at the 6-12 tables.
  for (let i = 0; i < 20; i++) recordAttempt(m, { skill: 'add_small', fact: '3+4', correct: true, ms: 1200 });
  for (let i = 0; i < 20; i++) recordAttempt(m, { skill: 'mult_easy', fact: '3*4', correct: true, ms: 1200 });
  for (let i = 0; i < 12; i++) recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: false, ms: 12000 });
  let withBigFactor = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const hand = generateHand(makeRng(seed), { mastery: m, runes: ['+', '-', '*'], size: 5, depth: 3 });
    if (hand.some(t => t.value >= 6 && t.value <= 12)) withBigFactor++;
  }
  assert.ok(withBigFactor / 300 > 0.8, `expected most hands to enable the weak skill, got ${withBigFactor}/300`);
});

/* ------------------------------------------------------------ damage -- */
test('a ward-matching smaller number can beat a bigger raw number', () => {
  // This is the whole design claim: "always multiply the two biggest" must lose.
  const base = { op: '*', ward: 'five', armor: 10, relics: [], combo: 0, ms: 3000, isFirstHit: false };
  const big = computeDamage({ ...base, result: 63 });   // 7 x 9, no ward
  const warded = computeDamage({ ...base, result: 45 }); // 9 x 5, matches the ward
  assert.ok(warded.warded && !big.warded);
  assert.ok(warded.damage > big.damage, `warded ${warded.damage} should beat raw ${big.damage}`);
});

test('armor is subtracted last so damage never drops below 1', () => {
  const r = computeDamage({ result: 2, op: '+', ward: 'none', armor: 99, relics: [], combo: 0, ms: 3000 });
  assert.equal(r.damage, 1);
  assert.equal(r.blockedByArmor, true);
});

test('relics change the arithmetic incentives they claim to', () => {
  const base = { result: 12, op: '*', ward: 'none', armor: 0, combo: 0, ms: 3000, isFirstHit: false };
  assert.equal(computeDamage({ ...base, relics: [] }).damage, 12);
  assert.equal(computeDamage({ ...base, relics: ['abacus'] }).damage, 15);
  assert.equal(computeDamage({ ...base, relics: ['evenblade'] }).damage, 18);
  assert.equal(computeDamage({ ...base, relics: ['oddcharm'] }).damage, 12, 'odd bonus must not fire on an even result');
  assert.equal(computeDamage({ ...base, relics: ['stacker'] }).damage, 16);
  assert.equal(computeDamage({ ...base, relics: ['speedsigil'], ms: 2000 }).damage, 17);
  assert.equal(computeDamage({ ...base, relics: ['speedsigil'], ms: 9000 }).damage, 12);
  assert.equal(computeDamage({ ...base, relics: ['patience'], ms: 9000 }).damage, 18);
});

test('combo raises damage and caps out', () => {
  const base = { result: 20, op: '+', ward: 'none', armor: 0, relics: [], ms: 3000 };
  const c0 = computeDamage({ ...base, combo: 0 }).damage;
  const c3 = computeDamage({ ...base, combo: 3 }).damage;
  const c9 = computeDamage({ ...base, combo: 9 }).damage;
  const c5 = computeDamage({ ...base, combo: 5 }).damage;
  assert.ok(c3 > c0);
  assert.equal(c9, c5, 'combo should cap at 5');
});

/* ----------------------------------------------------------- enemies -- */
test('enemies spawn with sane stats and telegraph a readable intent', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = makeRng(seed);
    const depth = (seed % 15) + 1;
    for (const opts of [{}, { elite: true }, { boss: true }]) {
      const e = spawnEnemy(rng, depth, { runes: ['+', '-', '*'], level: 3, playerMaxHp: 50, ...opts });
      assert.ok(e.hp > 0 && e.hp === e.maxHp);
      assert.ok(e.armor >= 0);
      assert.ok(WARDS[e.ward], `unknown ward ${e.ward}`);
      const intent = describeIntent(e);
      assert.ok(intent.text && !/undefined|NaN/.test(intent.text), `bad intent: ${intent.text}`);
    }
  }
});

test('enemy attacks hurt the player and Iron Skin reduces it', () => {
  const rng = makeRng(7);
  const e = spawnEnemy(rng, 3, { runes: ['+', '-'], level: 1, playerMaxHp: 50 });
  e.intents = [{ type: 'attack', dmg: 10 }];
  e.intentIndex = 0;
  const plain = { hp: 40, relics: [] };
  enemyAct(e, plain, rng);
  assert.equal(plain.hp, 30);
  e.intentIndex = 0;
  const armored = { hp: 40, relics: ['ironskin'] };
  enemyAct(e, armored, rng);
  assert.equal(armored.hp, 32);
});

/* --------------------------------------------------------------- map -- */
test('a boss every third floor, and one on the last floor of a run', () => {
  assert.equal(BOSS_EVERY, 3);
  assert.ok(isBossFloor(3) && isBossFloor(6) && isBossFloor(FINAL_DEPTH));
  assert.ok(!isBossFloor(1) && !isBossFloor(2) && !isBossFloor(4));
  for (let depth = 1; depth <= 40; depth++) {
    const nodes = generateFloor(makeRng(depth * 31), depth);
    assert.ok(nodes.length >= 1);
    if (isBossFloor(depth)) assert.deepEqual(nodes.map(n => n.type), ['boss'], `floor ${depth}`);
    else assert.ok(nodes.some(n => n.type === 'battle' || n.type === 'elite'), `floor ${depth} had no fight`);
    if (depth < 3) assert.ok(!nodes.some(n => n.type === 'elite'), 'no elites in the first two floors');
  }
});

test('the boss fight clock leaves room to answer at the child\'s own pace', () => {
  const quick = blankMastery(), slow = blankMastery();
  for (let i = 0; i < 20; i++) {
    recordAttempt(quick, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 2000 });
    recordAttempt(slow, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 12000 });
  }
  for (const depth of [3, 9, 18]) {
    const q = bossFightMs(quick, depth), s = bossFightMs(slow, depth);
    assert.ok(s > q, 'the slower child gets the longer duel, not a shorter one');
    // Enough time to answer every question at their own measured pace.
    const turns = Math.ceil(turnsFor(depth, { boss: true }));
    assert.ok(s > turns * 12000, `floor ${depth}: ${s}ms is not enough for ${turns} answers at 12s each`);
    assert.ok(q < 1000 * 60 * 6, 'no duel should be able to run past six minutes');
  }
});

test('enrage doubles the damage and says so before it lands', () => {
  const e = spawnEnemy(makeRng(3), 9, { boss: true, runes: ['+', '-', '*'], level: 3, playerMaxHp: 50 });
  e.intents = [{ type: 'attack', dmg: 10 }];
  e.intentIndex = 0;
  assert.match(describeIntent(e).text, /10/);
  e.enraged = true;
  assert.match(describeIntent(e).text, /20/, 'the warning must show the enraged number');
  const p = { hp: 100, relics: [] };
  e.intentIndex = 0;
  enemyAct(e, p, makeRng(1));
  assert.equal(p.hp, 80);
});

/* ----------------------------------------------------------- riddles -- */
test('every riddle template produces a whole, positive, sensible answer', () => {
  for (const tpl of RIDDLES) {
    for (let seed = 1; seed <= 300; seed++) {
      const r = tpl.make(makeRng(seed * 13 + 1));
      assert.ok(Number.isInteger(r.answer), `${tpl.id} answer not whole: ${r.answer}`);
      assert.ok(r.answer > 0, `${tpl.id} answer not positive: ${r.answer}`);
      assert.ok(r.text.length > 10 && !/undefined|NaN/.test(r.text), `${tpl.id} bad text: ${r.text}`);
    }
  }
});

test('riddle selection respects level and avoids immediate repeats', () => {
  const m = blankMastery();
  const recent = [];
  for (let i = 0; i < 40; i++) {
    const r = generateRiddle(makeRng(i * 7 + 3), m, recent);
    assert.ok(!recent.includes(r.id), 'served a riddle that was just asked');
    assert.ok(SKILLS.some(s => s.id === r.skill), `unknown skill ${r.skill}`);
    recent.unshift(r.id);
    if (recent.length > 5) recent.pop();
  }
});

/* ------------------------------------------------------------ relics -- */
test('relic offers never duplicate what you already hold', () => {
  const owned = RELICS.slice(0, 4).map(r => r.id);
  for (let seed = 1; seed <= 100; seed++) {
    const offer = offerRelics(makeRng(seed), owned, 3);
    assert.equal(offer.length, 3);
    assert.equal(new Set(offer.map(o => o.id)).size, 3, 'offer repeated itself');
    assert.ok(offer.every(o => !owned.includes(o.id)));
  }
});

test('offer shrinks gracefully when almost everything is owned', () => {
  const owned = RELICS.slice(0, RELICS.length - 1).map(r => r.id);
  assert.equal(offerRelics(makeRng(1), owned, 3).length, 1);
  assert.equal(offerRelics(makeRng(1), RELICS.map(r => r.id), 3).length, 0);
});

/* --------------------------------------------------------------- run -- */
test('a new run starts with every operator the kid has already earned', () => {
  const m = blankMastery();
  for (let i = 0; i < 20; i++) recordAttempt(m, { skill: 'add_small', fact: '3+4', correct: true, ms: 1500 });
  const r = newRun(42, { mastery: m, meta: { startRunes: [], bonusHp: 8 } });
  assert.deepEqual(r.player.runes, ['+', '-', '*'], 'a kid who can multiply should not grind addition');
  assert.equal(r.player.maxHp, 58);
  assert.equal(r.depth, 1);
  assert.ok(r.floorNodes.length >= 1);
});

test('every fight is a handful of turns, whatever the player can do', () => {
  // The point of budgeting enemy health off the player's own damage ceiling:
  // an addition-only 8 year old and a times-tables 9 year old should both get
  // a fight that lasts a similar number of turns.
  const bounds = { normal: [2, 7], elite: [2, 11], boss: [3, 13] };
  for (const runes of [['+', '-'], ['+', '-', '*'], ['+', '-', '*', '/']]) {
    for (let level = 1; level <= 6; level++) {
      const bestHit = bestHitEstimate(runes, level);
      for (let depth = 1; depth <= 20; depth++) {
        for (const [kind, opts] of [['normal', {}], ['elite', { elite: true }], ['boss', { boss: true }]]) {
          const e = spawnEnemy(makeRng(depth * 101 + level), depth, { runes, level, playerMaxHp: 50, ...opts });
          const perTurn = Math.max(1, effectiveHit(bestHit, e.resist, e.resistAt) - e.armor);
          const turns = Math.ceil(e.maxHp / perTurn);
          const [lo, hi] = bounds[kind];
          assert.ok(turns >= lo && turns <= hi,
            `${kind} on floor ${depth} level ${level} runes ${runes.join('')} takes ${turns} turns (hp ${e.maxHp}, armor ${e.armor}, resist ${e.resist}@${e.resistAt}, bestHit ${bestHit})`);
        }
      }
    }
  }
});

test('armor never makes a fight unwinnable', () => {
  for (const runes of [['+', '-'], ['+', '-', '*']]) {
    for (let level = 1; level <= 6; level++) {
      const bestHit = bestHitEstimate(runes, level);
      for (let depth = 1; depth <= 20; depth++) {
        const e = spawnEnemy(makeRng(depth * 7 + level), depth, { runes, level, playerMaxHp: 50, elite: true });
        assert.ok(e.armor < bestHit * 0.5, `armor ${e.armor} vs ceiling ${bestHit}`);
      }
    }
  }
});

test('a fight costs a slice of health, never a one-shot', () => {
  for (let depth = 1; depth <= 20; depth++) {
    for (const opts of [{}, { elite: true }, { boss: true }]) {
      const e = spawnEnemy(makeRng(depth * 3), depth, { runes: ['+', '-', '*'], level: 3, playerMaxHp: 50, ...opts });
      for (const it of e.intents) {
        if (it.dmg !== undefined) assert.ok(it.dmg < 50 * 0.45, `floor ${depth} hits for ${it.dmg} of 50`);
      }
    }
  }
});

test('shield targets are numbers the player can actually build', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const e = spawnEnemy(makeRng(seed), 12, { runes: ['+', '-'], level: 1, playerMaxHp: 50 });
    const shield = e.intents.find(i => i.type === 'shield');
    if (shield) assert.ok(shield.value >= 4 && shield.value <= 18, `unreachable +/- shield ${shield.value}`);
  }
  for (let seed = 1; seed <= 200; seed++) {
    const e = spawnEnemy(makeRng(seed), 12, { runes: ['+', '-', '*'], level: 3, playerMaxHp: 50 });
    const shield = e.intents.find(i => i.type === 'shield');
    if (shield) assert.ok(shield.value >= 4 && shield.value <= 144, `unreachable x shield ${shield.value}`);
  }
});

test('resistances punish the obvious biggest number', () => {
  const base = { op: '*', ward: 'none', armor: 0, relics: [], combo: 0, ms: 3000, isFirstHit: false };
  /* The threshold must sit ABOVE the penalty as a share of the player's
     ceiling, or overshooting stays correct and the resist teaches nothing.
     Ceiling ~100, threshold 70, penalty half: 100 -> 50 but 68 -> 68. */
  const big = computeDamage({ ...base, result: 100, resist: 'over', resistAt: 70 });
  const small = computeDamage({ ...base, result: 68, resist: 'over', resistAt: 70 });
  assert.ok(big.resisted && !small.resisted);
  assert.ok(small.damage > big.damage, `${small.damage} should beat ${big.damage}`);
  // A cap flattens everything above it, so overshooting is pure waste.
  assert.equal(computeDamage({ ...base, result: 100, resist: 'cap', resistAt: 50 }).damage, 50);
  assert.equal(computeDamage({ ...base, result: 50, resist: 'cap', resistAt: 50 }).damage, 50);
  assert.ok(computeDamage({ ...base, result: 100, resist: 'cap', resistAt: 50 }).capped);
});

test('every enemy resist is one the data file defines', () => {
  for (let seed = 1; seed <= 300; seed++) {
    for (const opts of [{}, { elite: true }, { boss: true }]) {
      const e = spawnEnemy(makeRng(seed), (seed % 20) + 1, { runes: ['+', '-', '*'], level: 3, playerMaxHp: 50, ...opts });
      assert.ok(RESISTS[e.resist], `unknown resist ${e.resist}`);
      if (e.resist !== 'none') assert.ok(e.resistAt >= 3, `resist threshold ${e.resistAt} too low to be playable`);
    }
  }
});

test('turn budget grows with depth and with enemy rank', () => {
  assert.ok(turnsFor(20) > turnsFor(1));
  assert.ok(turnsFor(5, { boss: true }) > turnsFor(5, { elite: true }));
  assert.ok(turnsFor(5, { elite: true }) > turnsFor(5));
});

/* ----------------------------------------------------------- enemies -- */
test('enemies spawn with sane stats and telegraph a readable intent', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = makeRng(seed);
    const depth = (seed % 15) + 1;
    for (const opts of [{}, { elite: true }, { boss: true }]) {
      const e = spawnEnemy(rng, depth, { runes: ['+', '-', '*'], level: 3, playerMaxHp: 50, ...opts });
      assert.ok(e.hp > 0 && e.hp === e.maxHp);
      assert.ok(e.armor >= 0);
      assert.ok(WARDS[e.ward], `unknown ward ${e.ward}`);
      const intent = describeIntent(e);
      assert.ok(intent.text && !/undefined|NaN/.test(intent.text), `bad intent: ${intent.text}`);
    }
  }
});

test('enemy attacks hurt the player and Iron Skin reduces it', () => {
  const rng = makeRng(7);
  const e = spawnEnemy(rng, 3, { runes: ['+', '-'], level: 1, playerMaxHp: 50 });
  e.intents = [{ type: 'attack', dmg: 10 }];
  e.intentIndex = 0;
  const plain = { hp: 40, relics: [] };
  enemyAct(e, plain, rng);
  assert.equal(plain.hp, 30);
  e.intentIndex = 0;
  const armored = { hp: 40, relics: ['ironskin'] };
  enemyAct(e, armored, rng);
  assert.equal(armored.hp, 32);
});

/* --------------------------------------------------------------- map -- */
test('a boss every third floor, and one on the last floor of a run', () => {
  assert.equal(BOSS_EVERY, 3);
  assert.ok(isBossFloor(3) && isBossFloor(6) && isBossFloor(FINAL_DEPTH));
  assert.ok(!isBossFloor(1) && !isBossFloor(2) && !isBossFloor(4));
  for (let depth = 1; depth <= 40; depth++) {
    const nodes = generateFloor(makeRng(depth * 31), depth);
    assert.ok(nodes.length >= 1);
    if (isBossFloor(depth)) assert.deepEqual(nodes.map(n => n.type), ['boss'], `floor ${depth}`);
    else assert.ok(nodes.some(n => n.type === 'battle' || n.type === 'elite'), `floor ${depth} had no fight`);
    if (depth < 3) assert.ok(!nodes.some(n => n.type === 'elite'), 'no elites in the first two floors');
  }
});

test('the boss fight clock leaves room to answer at the child\'s own pace', () => {
  const quick = blankMastery(), slow = blankMastery();
  for (let i = 0; i < 20; i++) {
    recordAttempt(quick, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 2000 });
    recordAttempt(slow, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 12000 });
  }
  for (const depth of [3, 9, 18]) {
    const q = bossFightMs(quick, depth), s = bossFightMs(slow, depth);
    assert.ok(s > q, 'the slower child gets the longer duel, not a shorter one');
    // Enough time to answer every question at their own measured pace.
    const turns = Math.ceil(turnsFor(depth, { boss: true }));
    assert.ok(s > turns * 12000, `floor ${depth}: ${s}ms is not enough for ${turns} answers at 12s each`);
    assert.ok(q < 1000 * 60 * 6, 'no duel should be able to run past six minutes');
  }
});

test('enrage doubles the damage and says so before it lands', () => {
  const e = spawnEnemy(makeRng(3), 9, { boss: true, runes: ['+', '-', '*'], level: 3, playerMaxHp: 50 });
  e.intents = [{ type: 'attack', dmg: 10 }];
  e.intentIndex = 0;
  assert.match(describeIntent(e).text, /10/);
  e.enraged = true;
  assert.match(describeIntent(e).text, /20/, 'the warning must show the enraged number');
  const p = { hp: 100, relics: [] };
  e.intentIndex = 0;
  enemyAct(e, p, makeRng(1));
  assert.equal(p.hp, 80);
});

/* ----------------------------------------------------------- riddles -- */
test('every riddle template produces a whole, positive, sensible answer', () => {
  for (const tpl of RIDDLES) {
    for (let seed = 1; seed <= 300; seed++) {
      const r = tpl.make(makeRng(seed * 13 + 1));
      assert.ok(Number.isInteger(r.answer), `${tpl.id} answer not whole: ${r.answer}`);
      assert.ok(r.answer > 0, `${tpl.id} answer not positive: ${r.answer}`);
      assert.ok(r.text.length > 10 && !/undefined|NaN/.test(r.text), `${tpl.id} bad text: ${r.text}`);
    }
  }
});

test('riddle selection respects level and avoids immediate repeats', () => {
  const m = blankMastery();
  const recent = [];
  for (let i = 0; i < 40; i++) {
    const r = generateRiddle(makeRng(i * 7 + 3), m, recent);
    assert.ok(!recent.includes(r.id), 'served a riddle that was just asked');
    assert.ok(SKILLS.some(s => s.id === r.skill), `unknown skill ${r.skill}`);
    recent.unshift(r.id);
    if (recent.length > 5) recent.pop();
  }
});

/* ------------------------------------------------------------ relics -- */
test('relic offers never duplicate what you already hold', () => {
  const owned = RELICS.slice(0, 4).map(r => r.id);
  for (let seed = 1; seed <= 100; seed++) {
    const offer = offerRelics(makeRng(seed), owned, 3);
    assert.equal(offer.length, 3);
    assert.equal(new Set(offer.map(o => o.id)).size, 3, 'offer repeated itself');
    assert.ok(offer.every(o => !owned.includes(o.id)));
  }
});

test('offer shrinks gracefully when almost everything is owned', () => {
  const owned = RELICS.slice(0, RELICS.length - 1).map(r => r.id);
  assert.equal(offerRelics(makeRng(1), owned, 3).length, 1);
  assert.equal(offerRelics(makeRng(1), RELICS.map(r => r.id), 3).length, 0);
});

/* --------------------------------------------------------------- run -- */
test('a new run starts with every operator the kid has already earned', () => {
  const m = blankMastery();
  for (let i = 0; i < 20; i++) recordAttempt(m, { skill: 'add_small', fact: '3+4', correct: true, ms: 1500 });
  const r = newRun(42, { mastery: m, meta: { startRunes: [], bonusHp: 8 } });
  assert.deepEqual(r.player.runes, ['+', '-', '*'], 'a kid who can multiply should not grind addition');
  assert.equal(r.player.maxHp, 58);
  assert.equal(r.depth, 1);
  assert.ok(r.floorNodes.length >= 1);
});



test('hand size and reshuffles respond to relics', () => {
  assert.equal(handSize({ relics: [] }), 5);
  assert.equal(handSize({ relics: ['sixthtile'] }), 6);
  assert.equal(reshuffles({ relics: [] }), 1);
  assert.equal(reshuffles({ relics: ['bighands'] }), 2);
});

test('a floor never offers the same choice twice', () => {
  for (let depth = 1; depth <= 60; depth++) {
    for (let seed = 1; seed <= 25; seed++) {
      const nodes = generateFloor(makeRng(depth * 1000 + seed), depth);
      const types = nodes.map(n => n.type);
      assert.equal(new Set(types).size, types.length, `floor ${depth} seed ${seed} repeated: ${types}`);
    }
  }
});

/* ------------------------------------------------------------- grade -- */
test('a declared grade sets where a brand new hero starts', () => {
  const fresh = blankMastery();
  assert.equal(difficultyLevel(fresh), 1, 'no grade and no evidence is level 1');
  for (const g of GRADES) {
    assert.equal(difficultyLevel(fresh, g.id), g.level, `${g.label} should start at level ${g.level}`);
  }
});

test('a declared grade opens the operators that grade is taught', () => {
  const fresh = blankMastery();
  assert.deepEqual(unlockedOps(fresh, 1), ['+', '-']);
  assert.deepEqual(unlockedOps(fresh, 3), ['+', '-', '*']);
  assert.deepEqual(unlockedOps(fresh, 4), ['+', '-', '*', '/']);
  // It only ever adds. A first grader who is quietly brilliant still earns x.
  const able = blankMastery();
  for (let i = 0; i < 20; i++) recordAttempt(able, { skill: 'add_small', fact: '3+4', correct: true, ms: 1200 });
  assert.ok(unlockedOps(able, 1).includes('*'));
});

test('the grade fades out as real answers arrive', () => {
  // A parent who guesses too high must not hold a struggling kid there.
  const m = blankMastery();
  const start = difficultyLevel(m, 5);
  assert.equal(start, 5);
  // Grace window first, then one level of the declared grade per decay step.
  const enough = GRADE_GRACE_ATTEMPTS + GRADE_DECAY_ATTEMPTS * 6;
  for (let i = 0; i < enough; i++) {
    recordAttempt(m, { skill: 'add_small', fact: '3+4', correct: false, ms: 14000 });
  }
  assert.ok(totalAttempts(m) >= enough);
  assert.equal(difficultyLevel(m, 5), difficultyLevel(m),
    'after enough evidence the declared grade should count for nothing');
});

test('the declared grade holds while the record is still too thin to replace it', () => {
  /* The floor used to erode after thirty problems, before the child's own
     record was thick enough to stand in for it, so the game visibly got
     EASIER a third of a run in. Within the grace window the declared level
     must hold regardless of what they have happened to be asked so far. */
  const m = blankMastery();
  for (let i = 0; i < GRADE_GRACE_ATTEMPTS; i++) {
    recordAttempt(m, { skill: 'add_small', fact: '3+4', correct: true, ms: 1800 });
    assert.ok(difficultyLevel(m, 6) >= 6,
      `level fell to ${difficultyLevel(m, 6)} after only ${totalAttempts(m)} problems`);
  }
});

test('a player answering a real mix correctly only ever climbs', () => {
  const m = blankMastery();
  const rng = makeRng(77);
  let previous = difficultyLevel(m, 4);
  for (let i = 0; i < 600; i++) {
    const level = difficultyLevel(m, 4);
    const runes = unlockedOps(m, 4);
    const hand = generateHand(rng, { mastery: m, runes, size: 5, depth: 5, grade: 4 });
    const plays = legalPlays(hand, runes);
    if (plays.length) {
      const p = plays[Math.floor(rng() * plays.length)];
      recordAttempt(m, { skill: classify(p.a, p.op, p.b), fact: factKey(p.a, p.op, p.b), correct: true, ms: 2200 });
    }
    const d = pickDrill(rng, m, runes, level);
    if (d) recordAttempt(m, { skill: d.skill, fact: d.fact, correct: true, ms: 2200 });
    const now = difficultyLevel(m, 4);
    assert.ok(now >= previous, `level fell from ${previous} to ${now} after ${totalAttempts(m)} problems`);
    previous = now;
  }
});

test('the power rune can be earned, not only declared', () => {
  // Reachable only by declaring 7th grade meant a kid who climbed there on
  // their own record never saw it.
  const m = blankMastery();
  for (let i = 0; i < 25; i++) recordAttempt(m, { skill: 'add_small', fact: '3+4', correct: true, ms: 1200 });
  for (let i = 0; i < 25; i++) recordAttempt(m, { skill: 'mult_easy', fact: '3*4', correct: true, ms: 1200 });
  assert.ok(!unlockedOps(m).includes('^'), 'not before the harder tables');
  for (let i = 0; i < 16; i++) recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 1600 });
  assert.ok(unlockedOps(m).includes('^'), 'solid times tables should earn it');
  // And struggling with them should not.
  const weak = blankMastery();
  for (let i = 0; i < 25; i++) recordAttempt(weak, { skill: 'add_small', fact: '3+4', correct: true, ms: 1200 });
  for (let i = 0; i < 20; i++) recordAttempt(weak, { skill: 'mult_hard', fact: '7*8', correct: false, ms: 12000 });
  assert.ok(!unlockedOps(weak).includes('^'));
});

test('a strong player who starts low still climbs to the top', () => {
  /* Starting a capable child at a low grade has to work: the declared grade
     is a floor, and their own record has to be able to lift them past it. */
  const m = blankMastery();
  const rng = makeRng(2024);
  for (let i = 0; i < 900; i++) {
    const level = difficultyLevel(m, 4);
    const runes = unlockedOps(m, 4);
    const hand = generateHand(rng, { mastery: m, runes, size: 5, depth: 5, grade: 4 });
    const plays = legalPlays(hand, runes);
    if (plays.length) {
      const p = plays[Math.floor(rng() * plays.length)];
      recordAttempt(m, { skill: classify(p.a, p.op, p.b), fact: factKey(p.a, p.op, p.b), correct: true, ms: 2500 });
    }
    const d = pickDrill(rng, m, runes, level);
    if (d) recordAttempt(m, { skill: d.skill, fact: d.fact, correct: true, ms: 2500 });
  }
  assert.ok(difficultyLevel(m, 4) >= 7, `only reached level ${difficultyLevel(m, 4)} starting from 4th`);
  const seen = new Set();
  for (let s2 = 1; s2 <= 400; s2++) {
    const d = pickDrill(makeRng(s2), m, unlockedOps(m, 4), difficultyLevel(m, 4));
    if (d) seen.add(d.skill);
  }
  for (const topic of ['percent', 'ratio', 'fractions', 'solve_x']) {
    assert.ok(seen.has(topic), `never reached ${topic} starting from 4th grade`);
  }
});

test('a kid getting nearly everything right is never dropped below their grade', () => {
  /* A real report card: a 4th grader, 60 problems, 98% right, 4 to 11
     seconds an answer. His record alone rated him 3rd grade, because a few
     tries on a skill count for little and he had only been served 3rd grade
     tables and division so far. So once the grade floor began to fade he was
     handed easier work while getting almost everything right. The floor may
     only fall for a kid who is actually getting problems wrong. */
  const m = blankMastery();
  const card = [
    ['add_small', '3+4', 8, 4100], ['sub_small', '9-4', 13, 5600], ['add_big', '23+18', 4, 11100],
    ['mult_hard', '7*8', 24, 6300], ['div_easy', '12/3', 8, 6100],
    ['word_1step', null, 1, 15000], ['word_2step', null, 1, 20000], ['place_est', null, 1, 15000],
  ];
  for (const [skill, fact, n, ms] of card) {
    for (let i = 0; i < n; i++) {
      recordAttempt(m, { skill, fact, correct: !(skill === 'mult_hard' && i === 5), ms });
    }
  }
  assert.equal(totalAttempts(m), 60);
  assert.equal(difficultyLevel(m, 4), 4);
  // Keep playing at the same accuracy and speed, sticking to favourites the
  // way a kid building their own strikes can: subtraction and times tables.
  const mix = card.filter(c => c[0] === 'sub_small' || c[0] === 'mult_hard');
  for (let i = 0; i < 150; i++) {
    const [skill, fact, , ms] = mix[i % mix.length];
    recordAttempt(m, { skill, fact, correct: i % 40 !== 39, ms });
    assert.ok(difficultyLevel(m, 4) >= 4,
      `fell to level ${difficultyLevel(m, 4)} after ${totalAttempts(m)} problems at 97% right`);
  }
});

test('a kid who is struggling still has the grade fade, gradually', () => {
  // Mostly right is not the same as struggling, but a parent's guess must not
  // hold a kid who gets a third of it wrong.
  const m = blankMastery();
  for (let i = 0; i < GRADE_GRACE_ATTEMPTS + GRADE_DECAY_ATTEMPTS * 6; i++) {
    recordAttempt(m, { skill: 'mult_easy', fact: '3*4', correct: i % 3 !== 0, ms: 9000 });
  }
  assert.ok(difficultyLevel(m, 6) < 6, `stayed at ${difficultyLevel(m, 6)} while getting a third wrong`);
});

test('a kid who races ahead is never held back by the grade', () => {
  const m = blankMastery();
  for (let i = 0; i < 20; i++) recordAttempt(m, { skill: 'div_hard', fact: '56/8', correct: true, ms: 1400 });
  assert.ok(difficultyLevel(m, 1) >= difficultyLevel(m),
    'a low declared grade must act as a floor, never a ceiling');
  assert.equal(difficultyLevel(m, 1), difficultyLevel(m));
});

test('every grade is playable from the very first hand', () => {
  for (const g of GRADES) {
    const m = blankMastery();
    const runes = unlockedOps(m, g.id);
    for (let seed = 1; seed <= 150; seed++) {
      const hand = generateHand(makeRng(seed), { mastery: m, runes, size: 5, depth: 1, grade: g.id });
      assert.ok(legalPlays(hand, runes).length > 0, `${g.label} dealt a dead hand`);
      const d = pickDrill(makeRng(seed), m, runes, difficultyLevel(m, g.id));
      assert.ok(d && drillIsUsable(d), `${g.label} produced an unusable drill: ${JSON.stringify(d)}`);
    }
  }
});

/* ------------------------------------------------------------ drills -- */
test('a fact key round trips back into a solvable problem', () => {
  assert.deepEqual(parseFactKey('7*8'), { a: 7, op: '*', b: 8 });
  assert.deepEqual(parseFactKey('12-5'), { a: 12, op: '-', b: 5 });
  assert.deepEqual(parseFactKey('24/6'), { a: 24, op: '/', b: 6 });
  assert.equal(parseFactKey('5-12'), null, 'a negative result is not a legal problem');
  assert.equal(parseFactKey('7/3'), null, 'a non-whole division is not a legal problem');
  assert.equal(parseFactKey('rubbish'), null);
  assert.equal(parseFactKey(''), null);
  assert.equal(parseFactKey(undefined), null);
});

test('generated drill problems are always legal and whole', () => {
  for (const id of ['add_small', 'sub_small', 'mult_easy', 'mult_hard', 'div_easy', 'div_hard', 'add_big', 'sub_big']) {
    for (let level = 1; level <= 6; level++) {
      for (let seed = 1; seed <= 60; seed++) {
        const p = problemForSkill(makeRng(seed * 7 + level), id, level);
        if (!p) continue; // the skill does not fit this tile range yet
        assert.ok(isLegal(p.a, p.op, p.b), `${id} L${level}: ${p.a} ${p.op} ${p.b}`);
        const r = evaluate(p.a, p.op, p.b);
        assert.ok(Number.isInteger(r) && r >= 0, `${id} produced ${r}`);
      }
    }
  }
});

test('drills mostly serve the facts the kid has been getting wrong', () => {
  // The whole reason drills exist: on a built turn the player can simply
  // never choose the fact they are worst at.
  const m = blankMastery();
  for (let i = 0; i < 25; i++) recordAttempt(m, { skill: 'mult_easy', fact: '3*4', correct: true, ms: 1200 });
  for (let i = 0; i < 10; i++) recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: false, ms: 11000 });
  // Keys go through factKey in real play, which sorts the operands, so the
  // test has to store them the same way or it measures its own typo.
  const weakB = factKey(9, '*', 6);
  for (let i = 0; i < 10; i++) recordAttempt(m, { skill: 'mult_hard', fact: weakB, correct: false, ms: 10000 });

  let weakHits = 0, total = 0;
  for (let seed = 1; seed <= 600; seed++) {
    const d = pickDrill(makeRng(seed), m, ['+', '-', '*'], 3);
    assert.ok(d, 'a drill should always be available once there is history');
    assert.ok(drillIsUsable(d), JSON.stringify(d));
    if (d.kind === 'arith') assert.ok(['+', '-', '*'].includes(d.op), 'never drills an operator they do not have');
    total++;
    if (d.fact === '7*8' || d.fact === weakB) weakHits++;
  }
  const rate = weakHits / total;
  assert.ok(rate > 0.4, `only ${(rate * 100).toFixed(0)}% of drills hit a dodged fact`);
  assert.ok(rate < 0.9, `${(rate * 100).toFixed(0)}% is relentless; a kid who only ever meets their worst fact stops playing`);
});

test('drills work from a standing start, with no history at all', () => {
  const m = blankMastery();
  for (let seed = 1; seed <= 200; seed++) {
    const d = pickDrill(makeRng(seed), m, ['+', '-'], 1);
    assert.ok(d, 'a brand new hero must still get a drill');
    assert.ok(drillIsUsable(d), JSON.stringify(d));
    if (d.kind === 'arith') assert.ok(['+', '-'].includes(d.op));
  }
});

test('the clock is set from the child, not from a fixed number', () => {
  const quick = blankMastery(), slow = blankMastery();
  for (let i = 0; i < 12; i++) {
    recordAttempt(quick, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 1800 });
    recordAttempt(slow, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 9000 });
  }
  const target = { skill: 'mult_hard', fact: '7*8' };
  const q = drillAllowanceMs(quick, target), s = drillAllowanceMs(slow, target);
  assert.ok(s > q, 'the slower child must get the longer window, not be punished forever');
  assert.ok(q >= DRILL_MIN_MS && s <= DRILL_MAX_MS);
});

test('the clock tightens on its own as a child speeds up', () => {
  const m = blankMastery();
  for (let i = 0; i < 12; i++) recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 9000 });
  const before = drillAllowanceMs(m, { skill: 'mult_hard', fact: '7*8' });
  for (let i = 0; i < 40; i++) recordAttempt(m, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 1500 });
  const after = drillAllowanceMs(m, { skill: 'mult_hard', fact: '7*8' });
  assert.ok(after < before, `window should shrink: ${before} -> ${after}`);
});

test('the clock stays inside humane bounds whatever the history', () => {
  assert.equal(drillAllowanceMs(blankMastery(), { skill: 'mult_hard', fact: '7*8' }), DRILL_DEFAULT_MS);
  const glacial = blankMastery();
  for (let i = 0; i < 12; i++) recordAttempt(glacial, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 120000 });
  assert.equal(drillAllowanceMs(glacial, { skill: 'mult_hard', fact: '7*8' }), DRILL_MAX_MS);
  const instant = blankMastery();
  for (let i = 0; i < 12; i++) recordAttempt(instant, { skill: 'mult_hard', fact: '7*8', correct: true, ms: 200 });
  assert.equal(drillAllowanceMs(instant, { skill: 'mult_hard', fact: '7*8' }), DRILL_MIN_MS);
});

test('a drill counter is worth less than a well-chosen built strike', () => {
  /* The counter gets no ward or resist bonus, because the player did not
     choose the number. If a drill ever out-damaged good thinking, the
     thinking half of the game would become the boring half. */
  const shared = { armor: 0, relics: [], combo: 0, ms: 2000, isFirstHit: false };
  const counter = computeDamage({ ...shared, result: 48, op: '*', ward: 'five', resist: 'none', resistAt: 0 });
  const chosen = computeDamage({ ...shared, result: 45, op: '*', ward: 'five', resist: 'none', resistAt: 0 });
  assert.ok(chosen.warded && chosen.damage > counter.damage,
    `a ward-matching built strike (${chosen.damage}) must beat a bigger drill counter (${counter.damage})`);
});

/* ------------------------------------------------- middle school -- */
test('every asked-problem generator produces something answerable', () => {
  // These carry all of grades 6 to 8, so a broken generator is a dead turn.
  for (const [skill, gens] of Object.entries(ASKED)) {
    assert.ok(SKILLS.some(s => s.id === skill), `${skill} has no skill entry, so nothing tracks it`);
    for (let g = 0; g < gens.length; g++) {
      for (let seed = 1; seed <= 250; seed++) {
        const made = gens[g](makeRng(seed * 31 + g));
        const where = `${skill}[${g}] seed ${seed}`;
        assert.ok(made && made.prompt, `${where} produced no prompt`);
        assert.ok(!/undefined|NaN|Infinity|\[object/.test(made.prompt), `${where}: ${made.prompt}`);
        const v = answerValue(made.answer);
        assert.ok(Number.isFinite(v), `${where} answer not finite: ${JSON.stringify(made.answer)}`);
        if (typeof made.answer === 'number') {
          // A plain answer must be typeable, not 0.30000000000000004.
          assert.ok(String(v).replace('-', '').replace('.', '').length <= 8,
            `${where} answer is not typeable: ${v}`);
        } else {
          const { n, d } = made.answer;
          assert.ok(Number.isInteger(n) && Number.isInteger(d) && d > 1,
            `${where} bad fraction: ${JSON.stringify(made.answer)}`);
        }
      }
    }
  }
});

test('ratios are always written in simplest form', () => {
  // 3:12 is arithmetically fine and reads like a mistake.
  const g = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
  for (let seed = 1; seed <= 400; seed++) {
    for (const gen of ASKED.ratio) {
      const made = gen(makeRng(seed * 7 + 1));
      const m = /(\d+):(\d+)/.exec(made.prompt);
      if (!m) continue;
      const [, a, b] = m.map(Number);
      assert.equal(g(a, b), 1, `ratio ${a}:${b} is not in simplest form`);
      assert.notEqual(a, b, `ratio ${a}:${b} is not a ratio`);
      assert.ok(Number.isInteger(made.answer), `${made.prompt} answers ${made.answer}`);
    }
  }
});

test('percentages and ratios are the richest topics, as asked for', () => {
  assert.ok(ASKED.percent.length >= 5);
  assert.ok(ASKED.ratio.length >= 5);
});

test('a simplify question never asks for a fraction already simplified', () => {
  const gen = ASKED.fractions.find((_, i) => i === 2);
  for (let seed = 1; seed <= 300; seed++) {
    const made = gen(makeRng(seed));
    const m = /Simplify (\d+)\/(\d+)/.exec(made.prompt);
    assert.ok(m, made.prompt);
    const [, n, d] = m.map(Number);
    const simplest = simplifyFraction(n, d);
    assert.notEqual(`${n}/${d}`, typeof simplest === 'number' ? String(simplest) : `${simplest.n}/${simplest.d}`,
      `nothing to simplify in ${made.prompt}`);
    assert.deepEqual(made.answer, simplest);
  }
});

test('answers parse as whole numbers, decimals, negatives and fractions', () => {
  assert.deepEqual(parseAnswer('42'), { value: 42 });
  assert.deepEqual(parseAnswer('-7'), { value: -7 });
  assert.deepEqual(parseAnswer('0.75'), { value: 0.75 });
  assert.deepEqual(parseAnswer('3/4'), { value: 0.75, n: 3, d: 4 });
  assert.deepEqual(parseAnswer('  3 / 4 '), { value: 0.75, n: 3, d: 4 });
  assert.deepEqual(parseAnswer('\u22125'), { value: -5 }, 'a typed minus sign should work');
  for (const junk of ['', ' ', 'abc', '3/', '/4', '3/0', '1.2.3', '--4', '3//4']) {
    assert.equal(parseAnswer(junk), null, `accepted junk: "${junk}"`);
  }
});

test('an equivalent fraction is accepted, with the simplest form mentioned', () => {
  // Refusing 6/8 when the child has correctly worked out three quarters
  // teaches nothing except that the game is fussy.
  const exact = checkAnswer('3/4', { n: 3, d: 4 });
  assert.ok(exact.ok && !exact.note);
  const equivalent = checkAnswer('6/8', { n: 3, d: 4 });
  assert.ok(equivalent.ok, 'an equivalent fraction is still the right answer');
  assert.match(equivalent.note, /3\/4/, 'but it should say what simplest form is');
  assert.ok(checkAnswer('0.75', { n: 3, d: 4 }).ok, 'the decimal is also right');
  assert.ok(!checkAnswer('4/3', { n: 3, d: 4 }).ok);
  assert.ok(!checkAnswer('', { n: 3, d: 4 }).ok);
});

test('decimal answers are compared with tolerance, not exact equality', () => {
  assert.ok(checkAnswer('0.8', 0.1 + 0.7).ok, 'floating point must not fail a correct answer');
  assert.ok(checkAnswer('-13', -13).ok);
  assert.ok(!checkAnswer('0.81', 0.8).ok);
});

test('the keypad cannot be typed into an unparseable state', () => {
  const type = keys => keys.split('').reduce((acc, k) => typeInto(acc, k), '');
  assert.equal(type('375'), '375');
  assert.equal(type('3/4'), '3/4');
  assert.equal(typeInto('.', 'x'), '.');
  assert.equal(type('.5'), '0.5', 'a leading point means nought point something');
  assert.equal(type('3..5'), '3.5', 'only one decimal point');
  assert.equal(type('3//4'), '3/4', 'only one slash');
  assert.equal(typeInto('3.5', '/'), '3.5', 'never a slash after a decimal');
  assert.equal(typeInto('3/4', '.'), '3/4', 'nor a decimal inside a fraction');
  assert.equal(typeInto('3/', '0'), '3/', 'a denominator cannot start with nought');
  assert.equal(type('3/10'), '3/10', 'but nought inside a denominator is fine');
  assert.equal(type('-7'), '-7');
  assert.equal(type('7-'), '7', 'a minus only makes sense at the front');
  assert.equal(type('-'), '-');
  assert.equal(typeInto('42', 'back'), '4');
  assert.equal(typeInto('', 'back'), '');
  assert.equal(typeInto('12345678', '9'), '12345678', 'length is capped');
  // Whatever is typed either parses or is still being typed, never garbage.
  const keys = ['0','1','2','3','4','5','6','7','8','9','.','/','-','back'];
  const rng = makeRng(99);
  for (let trial = 0; trial < 4000; trial++) {
    let cur = '';
    for (let i = 0; i < 10; i++) cur = typeInto(cur, keys[Math.floor(rng() * keys.length)]);
    const partial = cur === '' || cur === '-' || cur.endsWith('.') || cur.endsWith('/');
    assert.ok(partial || parseAnswer(cur), `typed into an unparseable state: "${cur}"`);
  }
});

test('formatAnswer writes a fraction as a fraction', () => {
  assert.equal(formatAnswer(12), '12');
  assert.equal(formatAnswer({ n: 3, d: 4 }), '3/4');
  assert.equal(formatAnswer(-5), '-5');
});

test('every operator a grade can unlock has a rune to draw', () => {
  /* This is not hypothetical. Adding the power rune to the grade tables but
     not to RUNES handed out an operator with no glyph, and the whole run
     crashed on the first floor. */
  const seen = new Set();
  for (const g of GRADES) for (const op of unlockedOps(blankMastery(), g.id)) seen.add(op);
  for (const op of seen) {
    assert.ok(RUNES[op], `grade tables can unlock "${op}" but RUNES has no entry, which crashes on render`);
    assert.ok(RUNES[op].glyph, `rune "${op}" has no glyph`);
    assert.ok(RUNES[op].name, `rune "${op}" has no name`);
  }
  // And every skill that claims an operator must be one the runes cover.
  for (const s of SKILLS) if (s.op) assert.ok(RUNES[s.op], `skill ${s.id} uses unknown operator "${s.op}"`);
});

test('every operator in play can actually be evaluated', () => {
  for (const op of Object.keys(RUNES)) {
    let found = false;
    for (let a = 1; a <= 12 && !found; a++) {
      for (let b = 1; b <= 12 && !found; b++) {
        if (!isLegal(a, op, b)) continue;
        const r = evaluate(a, op, b);
        assert.ok(Number.isFinite(r), `${a} ${op} ${b} is legal but evaluates to ${r}`);
        found = true;
      }
    }
    assert.ok(found, `no legal play exists for operator "${op}" at all`);
  }
});

test('levels now run to ninth, and grades reach eighth', () => {
  assert.equal(MAX_LEVEL, 9);
  assert.equal(GRADES.length, 8);
  assert.equal(GRADE_BY_ID[8].level, 8);
  const fresh = blankMastery();
  assert.equal(difficultyLevel(fresh, 8), 8, 'an 8th grader must not start on level 1');
  assert.ok(unlockedOps(fresh, 7).includes('^'), 'powers unlock with 7th grade');
  assert.ok(!unlockedOps(fresh, 5).includes('^'));
});

test('a 7th or 8th grade hero is served middle school work immediately', () => {
  const m = blankMastery();
  const level = difficultyLevel(m, 8);
  const runes = unlockedOps(m, 8);
  const seen = new Set();
  for (let seed = 1; seed <= 600; seed++) {
    const d = pickDrill(makeRng(seed), m, runes, level);
    assert.ok(drillIsUsable(d), JSON.stringify(d));
    seen.add(d.skill);
  }
  const middle = ASKED_SKILLS.filter(s => seen.has(s));
  assert.ok(middle.length >= 5,
    `an 8th grader should meet most middle school topics, saw: ${[...seen].join(',')}`);
  assert.ok(seen.has('percent') && seen.has('ratio'), 'percentages and ratios are the priority');
});

test('negative tiles appear only once integers are on the syllabus', () => {
  assert.equal(negativeTilesFor(1), 0);
  assert.equal(negativeTilesFor(5), 0);
  assert.ok(negativeTilesFor(6) >= 1);
  assert.ok(negativeTilesFor(9) >= 1);
});

test('a hand with negative tiles still always has a legal strike', () => {
  const m = blankMastery();
  for (let i = 0; i < 20; i++) recordAttempt(m, { skill: 'exponents', fact: '5^2', correct: true, ms: 1500 });
  for (const grade of [6, 7, 8]) {
    const runes = unlockedOps(m, grade);
    let sawNegative = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const hand = generateHand(makeRng(seed), { mastery: m, runes, size: 5, depth: 5, grade });
      assert.ok(legalPlays(hand, runes).length > 0, `grade ${grade} seed ${seed} dealt a dead hand`);
      if (hand.some(t => t.value < 0)) sawNegative++;
    }
    assert.ok(sawNegative > 0, `grade ${grade} never dealt a negative tile`);
  }
});

test('powers are limited to squares and cubes, with a sane ceiling', () => {
  assert.ok(isLegal(7, '^', 2) && isLegal(5, '^', 3));
  assert.ok(!isLegal(7, '^', 1), 'a first power is not practice');
  assert.ok(!isLegal(7, '^', 4));
  assert.ok(!isLegal(30, '^', 3), '27000 damage is not a number a kid should see');
  assert.equal(evaluate(7, '^', 2), 49);
  assert.ok(isLegal(-3, '^', 2), 'a negative squared is positive and worth teaching');
});

test('a strike must still make a whole number of at least one', () => {
  assert.ok(isLegal(5, '+', -3), '5 + -3 = 2');
  assert.ok(isLegal(5, '-', -3), '5 - -3 = 8');
  assert.ok(isLegal(-4, '*', -3), 'two negatives make a positive');
  assert.ok(!isLegal(-3, '-', 5), 'a negative result is not a strike');
  assert.ok(!isLegal(4, '-', 4), 'zero damage is not a strike');
  assert.ok(!isLegal(-12, '/', 3), 'nor is a negative quotient');
  assert.ok(isLegal(-12, '/', -3), 'but -12 / -3 = 4');
});

test('every drill carries its own answer, and it is always answerable', () => {
  /* The bug: the drill screen recomputed the answer from a-op-b, which a
     written problem does not have, so the expected answer became NaN and the
     child could not get it right however hard they tried. */
  for (const g of GRADES) {
    const m = blankMastery();
    const level = difficultyLevel(m, g.id);
    const runes = unlockedOps(m, g.id);
    for (let seed = 1; seed <= 400; seed++) {
      const d = pickDrill(makeRng(seed), m, runes, level);
      assert.ok(d, `${g.label} produced no drill`);
      const v = answerValue(d.answer);
      assert.ok(Number.isFinite(v), `${g.label}: answer is ${JSON.stringify(d.answer)} for ${JSON.stringify(d)}`);
      // And the answer must be typeable on the keypad the screen shows.
      const text = formatAnswer(d.answer);
      assert.ok(checkAnswer(text, d.answer).ok, `${g.label}: "${text}" does not match its own answer`);
      assert.ok(text.split('').every(ch => /[0-9./-]/.test(ch)), `${g.label}: "${text}" cannot be typed`);
    }
  }
});

test('a fight can always be won, at every grade', () => {
  /* The bug this guards: expectedDrillDamage averaged in written problems,
     which have no calculation to evaluate, so it returned NaN. That made a
     boss's health NaN, so its health never reached zero and the duel could
     not be won at all. Every run ended on floor 3. */
  for (const g of GRADES) {
    const m = blankMastery();
    const level = difficultyLevel(m, g.id);
    const runes = unlockedOps(m, g.id);
    for (let seed = 1; seed <= 40; seed++) {
      const ceiling = expectedDrillDamage(makeRng(seed), m, runes, level);
      assert.ok(Number.isFinite(ceiling) && ceiling > 0,
        `${g.label}: drill damage estimate is ${ceiling}`);
      for (const opts of [{}, { elite: true }, { boss: true }, { boss: true, duel: true, ceiling }]) {
        const e = spawnEnemy(makeRng(seed * 13), 3, { runes, level, playerMaxHp: 50, ...opts });
        assert.ok(Number.isFinite(e.maxHp) && e.maxHp > 0, `${g.label}: enemy health is ${e.maxHp}`);
        assert.ok(Number.isFinite(e.armor) && e.armor >= 0, `${g.label}: armor is ${e.armor}`);
        for (const it of e.intents) {
          for (const v of [it.dmg, it.amount, it.value]) {
            if (v !== undefined) assert.ok(Number.isFinite(v), `${g.label}: intent value is ${v}`);
          }
        }
      }
    }
  }
});

test('a bad ceiling never reaches the health budget', () => {
  for (const bad of [NaN, 0, -5, undefined, null, Infinity]) {
    const e = spawnEnemy(makeRng(7), 6, { runes: ['+', '-', '*'], level: 3, playerMaxHp: 50, boss: true, ceiling: bad });
    assert.ok(Number.isFinite(e.maxHp) && e.maxHp > 0, `ceiling ${bad} gave health ${e.maxHp}`);
  }
});

/* ------------------------------------------------------------ heroes -- */
test('twenty heroes, eight of them free to start', () => {
  assert.equal(AVATARS.length, 20);
  assert.equal(unlockedAvatars(0).length, 8, 'picking a hero on day one should still be a choice');
  assert.equal(unlockedAvatars(1e6).length, 20);
});

test('every hero is distinct, named, and earned on a five floor step', () => {
  assert.equal(new Set(AVATARS.map(a => a.char)).size, 20, 'two heroes look the same');
  assert.equal(new Set(AVATARS.map(a => a.id)).size, 20);
  for (const a of AVATARS) {
    assert.ok(a.name && a.name.length > 1, `${a.id} has no name`);
    assert.ok(Number.isInteger(a.at) && a.at >= 0, `${a.id} unlocks at ${a.at}`);
    assert.equal(a.at % FLOORS_PER_AVATAR, 0, `${a.id} unlocks at ${a.at}, off the five floor step`);
  }
  // Ordered, so "next" is always the nearest one.
  for (let i = 1; i < AVATARS.length; i++) {
    assert.ok(AVATARS[i].at >= AVATARS[i - 1].at, 'the list must be in unlock order');
  }
});

test('one hero arrives every five floors, with none skipped or repeated', () => {
  const seen = new Set();
  for (let floors = 1; floors <= 200; floors++) {
    for (const a of avatarsEarnedBetween(floors - 1, floors)) {
      assert.ok(!seen.has(a.id), `${a.id} was earned twice`);
      seen.add(a.id);
      assert.equal(floors % FLOORS_PER_AVATAR, 0, `${a.id} arrived on floor ${floors}`);
    }
  }
  assert.equal(seen.size, 12, 'all twelve earnable heroes should arrive within 200 floors');
  assert.equal(unlockedAvatars(200).length, 20);
});

test('nothing is earned twice, and nothing is missed on a jump', () => {
  assert.deepEqual(avatarsEarnedBetween(5, 5), []);
  assert.deepEqual(avatarsEarnedBetween(4, 5).map(a => a.name), ['Wolf']);
  assert.deepEqual(avatarsEarnedBetween(5, 6), []);
  // A jump of several floors must not lose the ones in between.
  assert.deepEqual(avatarsEarnedBetween(0, 15).map(a => a.name), ['Wolf', 'Owl', 'Bear']);
});

test('the next hero is always the nearest one still locked', () => {
  assert.equal(nextAvatar(0).name, 'Wolf');
  assert.equal(nextAvatar(0).away, 5);
  assert.equal(nextAvatar(12).name, 'Bear');
  assert.equal(nextAvatar(12).away, 3);
  assert.equal(nextAvatar(14).away, 1);
  assert.equal(nextAvatar(15).name, 'Eagle', 'the one just earned is no longer next');
  assert.equal(nextAvatar(1e6), null, 'once they are all out, there is no next');
});

test('a starter hero is available to a brand new profile', () => {
  // Hero creation offers unlockedAvatars(0); an empty list would be a dead end.
  const starters = unlockedAvatars(0);
  assert.ok(starters.length > 0);
  assert.ok(starters.every(a => a.at === 0));
});

/* ------------------------------------------------- the design property -- */
/* The reason this game exists: if "multiply the two biggest tiles" were always
   right, the kid would stop computing alternatives and the game would be a
   quiz with a sword on top. This measures how often the naive heuristic
   actually loses, across a realistic spread of hands and enemies. */
test('the biggest number is often NOT the best play', () => {
  const build = level => {
    const m = blankMastery();
    const feed = (skill, n) => { for (let i = 0; i < n; i++) recordAttempt(m, { skill, fact: null, correct: true, ms: 1500 }); };
    feed('add_small', 20);
    if (level >= 2) feed('mult_easy', 25);
    if (level >= 3) feed('mult_hard', 20);
    if (level >= 4) feed('div_easy', 20);
    return m;
  };

  for (const [label, runes, m] of [
    ['plus/minus', ['+', '-'], build(1)],
    ['with x', ['+', '-', '*'], build(3)],
    ['with x and /', ['+', '-', '*', '/'], build(4)],
  ]) {
    const level = difficultyLevel(m);
    let differs = 0, total = 0, gap = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const rng = makeRng(seed);
      const depth = (seed % 20) + 1;
      const hand = generateHand(rng, { mastery: m, runes, size: 5, depth });
      const e = spawnEnemy(rng, depth, { runes, level, playerMaxHp: 50 });
      const plays = legalPlays(hand, runes);
      if (!plays.length) continue;
      const scored = plays.map(p => ({ p, dmg: computeDamage({
        result: p.result, op: p.op, ward: e.ward, resist: e.resist, resistAt: e.resistAt,
        armor: e.armor, relics: [], combo: 0, ms: 3000, isFirstHit: false }).damage }));
      const maxRaw = scored.reduce((a, b) => (b.p.result > a.p.result ? b : a));
      const maxDmg = scored.reduce((a, b) => (b.dmg > a.dmg ? b : a));
      total++;
      if (maxDmg.dmg > maxRaw.dmg) { differs++; gap += (maxDmg.dmg - maxRaw.dmg) / Math.max(1, maxRaw.dmg); }
    }
    const rate = differs / total;
    const avgGap = gap / Math.max(1, differs);
    assert.ok(rate > 0.3,
      `${label}: the naive "biggest number" play only loses ${(rate * 100).toFixed(1)}% of turns, so there is nothing to think about`);
    assert.ok(rate < 0.62,
      `${label}: the naive play loses ${(rate * 100).toFixed(1)}% of turns, which makes this a one-answer puzzle rather than a choice`);
    assert.ok(avgGap < 2.2,
      `${label}: picking the obvious play costs ${(avgGap * 100).toFixed(0)}% damage, which punishes an 8 year old far too hard`);
  }
});

console.log(`${passed} engine tests passed`);
