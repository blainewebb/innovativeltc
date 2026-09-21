/* Runebreaker engine tests. Run: node test/engine.test.mjs */
import assert from 'node:assert/strict';
import {
  makeRng, blankMastery, recordAttempt, skillScore, shakyFacts, difficultyLevel,
  unlockedOps, generateHand, isLegal, evaluate, legalPlays, computeDamage,
  spawnEnemy, enemyAct, describeIntent, generateFloor, generateRiddle, offerRelics,
  newRun, handSize, reshuffles, classify, factKey, bestHitEstimate, turnsFor,
  effectiveHit, tileRangeFor,
} from '../js/engine.js';
import { RIDDLES, SKILLS, RELICS, WARDS, RESISTS } from '../js/data.js';

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
test('every fifth floor is a boss and other floors always offer a fight', () => {
  for (let depth = 1; depth <= 40; depth++) {
    const nodes = generateFloor(makeRng(depth * 31), depth);
    assert.ok(nodes.length >= 1);
    if (depth % 5 === 0) assert.deepEqual(nodes.map(n => n.type), ['boss']);
    else assert.ok(nodes.some(n => n.type === 'battle' || n.type === 'elite'), `floor ${depth} had no fight`);
    if (depth < 3) assert.ok(!nodes.some(n => n.type === 'elite'), 'no elites in the first two floors');
  }
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
test('every fifth floor is a boss and other floors always offer a fight', () => {
  for (let depth = 1; depth <= 40; depth++) {
    const nodes = generateFloor(makeRng(depth * 31), depth);
    assert.ok(nodes.length >= 1);
    if (depth % 5 === 0) assert.deepEqual(nodes.map(n => n.type), ['boss']);
    else assert.ok(nodes.some(n => n.type === 'battle' || n.type === 'elite'), `floor ${depth} had no fight`);
    if (depth < 3) assert.ok(!nodes.some(n => n.type === 'elite'), 'no elites in the first two floors');
  }
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
