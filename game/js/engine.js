/* Runebreaker — pure game logic. No DOM, no localStorage.
   Everything here is deterministic given a seed, so it can be unit tested. */

import { SKILLS, SKILL_BY_ID, classify, factKey, WARDS, RESISTS, ENEMIES, BOSSES,
         RELICS, RELIC_BY_ID, RIDDLES, GRADES, GRADE_BY_ID } from './data.js';

/* ------------------------------------------------------------------ rng --
   Small seeded PRNG (mulberry32) so a run can be replayed from its seed. */
export function makeRng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/* -------------------------------------------------------------- mastery --
   A profile's learning record. Two layers:
     skills[] — broad buckets, drive difficulty and the report card bars
     facts[]  — individual facts like "7x8", drive the "shaky facts" list
   Mastery is an exponential moving average so recent work counts most. */
export function blankMastery() {
  const skills = {};
  for (const s of SKILLS) skills[s.id] = { attempts: 0, correct: 0, ema: 0.5, totalMs: 0 };
  return { skills, facts: {} };
}

export const EMA_ALPHA = 0.25;

/** Record one attempt. `ms` is time-to-answer in milliseconds. */
export function recordAttempt(mastery, { skill, fact, correct, ms }) {
  const s = mastery.skills[skill] || (mastery.skills[skill] = { attempts: 0, correct: 0, ema: 0.5, totalMs: 0 });
  s.attempts += 1;
  if (correct) s.correct += 1;
  s.totalMs += ms;
  s.ema = s.ema * (1 - EMA_ALPHA) + (correct ? 1 : 0) * EMA_ALPHA;

  if (fact) {
    const f = mastery.facts[fact] || (mastery.facts[fact] = { attempts: 0, correct: 0, ema: 0.5, totalMs: 0 });
    f.attempts += 1;
    if (correct) f.correct += 1;
    f.totalMs += ms;
    f.ema = f.ema * (1 - EMA_ALPHA) + (correct ? 1 : 0) * EMA_ALPHA;
  }
  return mastery;
}

/** 0..1 confidence that the skill is solid. Slow-but-right still counts, just less. */
export function skillScore(rec, skillId) {
  if (!rec || rec.attempts === 0) return 0;
  const accuracy = rec.ema;
  const avgMs = rec.totalMs / rec.attempts;
  const confidence = Math.min(1, rec.attempts / 12); // few attempts = low confidence

  /* Reading and reasoning take time by nature, so those skills are judged on
     accuracy alone. Fact recall is judged partly on speed, because knowing
     7 x 8 and working it out from scratch are different things. */
  if (skillId && SKILL_BY_ID[skillId]?.slow) return accuracy * confidence;

  // Under 5s is full speed credit, over 20s is none. Speed is a 25% weight.
  const speed = Math.max(0, Math.min(1, (20000 - avgMs) / 15000));
  return (accuracy * 0.75 + speed * 0.25) * confidence;
}

/* Facts worth drilling, worst first. A fact the kid answers correctly and
   quickly is not a drill candidate, so it is left out entirely rather than
   padding the list: a report card that lists everything tells you nothing. */
export const DRILL_THRESHOLD = 0.65;

/* Facts are scored differently from skills: no confidence ramp, because a kid
   only meets any single fact a handful of times, and a heavier speed weight,
   because the whole point of a number fact is recall rather than derivation.
   Right but fifteen seconds of counting on fingers still needs drilling. */
export function factScore(f) {
  if (!f || f.attempts === 0) return 1;
  const avgMs = f.totalMs / f.attempts;
  const speed = Math.max(0, Math.min(1, (15000 - avgMs) / 12000));
  return f.ema * 0.6 + speed * 0.4;
}

export function shakyFacts(mastery, limit = 10) {
  return Object.entries(mastery.facts)
    .filter(([, f]) => f.attempts >= 2)
    .map(([key, f]) => ({
      key,
      attempts: f.attempts,
      accuracy: f.correct / f.attempts,
      avgMs: Math.round(f.totalMs / f.attempts),
      score: factScore(f),
    }))
    .filter(f => f.score < DRILL_THRESHOLD)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

/* ----------------------------------------------------------- difficulty --
   One number, 1..6, derived from how the skills the player has actually
   unlocked are going. It sets tile ranges and enemy scaling. It moves slowly
   on purpose: a couple of bad answers should not knock the game down a tier. */
export function totalAttempts(mastery) {
  return SKILLS.reduce((n, s) => n + (mastery.skills[s.id]?.attempts || 0), 0);
}

/** Level from answers alone, ignoring whatever grade was declared. */
function evidenceLevel(mastery) {
  const active = SKILLS.filter(s => (mastery.skills[s.id]?.attempts || 0) >= 4);
  if (active.length === 0) return 1;
  const avg = active.reduce((sum, s) => sum + skillScore(mastery.skills[s.id], s.id), 0) / active.length;
  const reach = Math.max(...active.map(s => s.tier));
  // Level tracks the highest tier the player is working in, nudged by how well.
  const level = reach + (avg > 0.72 ? 1 : avg < 0.45 ? -1 : 0);
  return Math.max(1, Math.min(6, level));
}

/* The declared grade acts as a floor that erodes as real answers arrive: one
   level of it falls away every 30 attempts, so within roughly 150 problems
   the child's own record is the only thing setting difficulty. That gives a
   sensible first run without letting a parent's guess outlive the evidence,
   in either direction. */
export const GRADE_DECAY_ATTEMPTS = 30;

export function difficultyLevel(mastery, grade = 0) {
  const evidence = evidenceLevel(mastery);
  const seeded = GRADE_BY_ID[grade]?.level || 0;
  if (!seeded) return evidence;
  const floor = seeded - Math.floor(totalAttempts(mastery) / GRADE_DECAY_ATTEMPTS);
  return Math.max(1, Math.min(6, Math.max(evidence, floor)));
}

/** Which operator runes the profile is allowed to find, given where they are. */
export function unlockedOps(mastery, grade = 0) {
  const ops = ['+', '-'];
  const addOk = skillScore(mastery.skills.add_small, 'add_small') > 0.5 || (mastery.skills.add_small?.attempts || 0) > 15;
  if (addOk) ops.push('*');
  const multOk = skillScore(mastery.skills.mult_easy, 'mult_easy') > 0.5 || (mastery.skills.mult_easy?.attempts || 0) > 20;
  if (multOk) ops.push('/');
  // A third grader is being taught multiplication whether or not they are
  // good at it yet, so the grade adds operators it never takes away.
  for (const op of GRADE_BY_ID[grade]?.ops || []) if (!ops.includes(op)) ops.push(op);
  return ['+', '-', '*', '/'].filter(o => ops.includes(o));
}

/* --------------------------------------------------------------- tiles ---
   Hand generation is where adaptation actually bites. We aim the hand at the
   weakest skill the player has the runes for, so the tiles in front of them
   make that skill the attractive play. */
const TILE_RANGE = {
  1: [1, 9], 2: [1, 10], 3: [2, 12], 4: [2, 15], 5: [3, 20], 6: [4, 25],
};

export function tileRangeFor(level) { return TILE_RANGE[level] || TILE_RANGE[6]; }

/* Which skill should this hand be built around?
   An untouched skill scores 0, so simply taking the minimum would always aim
   at whatever the kid has never tried and never revisit the fact they keep
   missing. Known-weak beats unknown, with an occasional deliberate
   introduction so new skills still get their first exposure. */
function weakestTargetSkill(rng, mastery, runes, level) {
  const candidates = SKILLS.filter(s => s.op && runes.includes(s.op) && s.tier <= level + 1);
  if (candidates.length === 0) return null;

  const tried = candidates.filter(s => (mastery.skills[s.id]?.attempts || 0) >= 3);
  const untried = candidates.filter(s => (mastery.skills[s.id]?.attempts || 0) < 3 && s.tier <= level);

  if (untried.length && (tried.length === 0 || rng() < 0.25)) {
    return untried[Math.floor(rng() * untried.length)];
  }
  if (!tried.length) return candidates[Math.floor(rng() * candidates.length)];
  return tried.reduce((a, b) => (skillScore(mastery.skills[b.id], b.id) < skillScore(mastery.skills[a.id], a.id) ? b : a));
}

/* Seeds for each skill, all clamped to the level's tile range so the damage
   ceiling stays predictable. Enemy stats are budgeted against that ceiling,
   so a rogue oversized tile would quietly break the balance. */
function seedFor(rng, skillId, lo, hi) {
  const R = (a, b) => ri(rng, Math.max(lo, Math.min(a, hi)), Math.max(lo, Math.min(b, hi)));
  switch (skillId) {
    case 'add_small': return [R(2, 9), R(2, 9)];
    case 'sub_small': { const b = R(2, 9); return [Math.min(hi, b + R(2, 9)), b]; }
    case 'add_big':   return hi >= 11 ? [R(11, hi), R(8, hi)] : null;
    case 'sub_big':   { if (hi < 12) return null; const b = R(8, Math.floor(hi / 2)); return [Math.min(hi, b + R(6, hi)), b]; }
    case 'mult_easy': return [R(2, 5), R(3, 9)];
    case 'mult_hard': return hi >= 6 ? [R(6, Math.min(12, hi)), R(4, hi)] : null;
    case 'div_easy':  { const b = R(2, 5); const q = R(2, Math.floor(hi / b) || 2); return b * q <= hi ? [b * q, b] : null; }
    case 'div_hard':  { if (hi < 12) return null; const b = R(6, Math.min(12, hi)); const q = Math.max(2, Math.floor(hi / b)); return b * q <= hi ? [b * q, b] : null; }
    default: return null;
  }
}

/** Draw a hand of number tiles, biased toward giving the target skill a home. */
export function generateHand(rng, { mastery, runes, size = 5, depth = 1, grade = 0 }) {
  const level = difficultyLevel(mastery, grade);
  const [lo, hi] = tileRangeFor(level);
  const tiles = [];

  const target = weakestTargetSkill(rng, mastery, runes, level);
  if (target && rng() < 0.7) {
    const seed = seedFor(rng, target.id, lo, hi);
    if (seed) tiles.push(...seed);
  }
  while (tiles.length < size) tiles.push(ri(rng, lo, hi));

  return tiles.slice(0, size).map((v, i) => ({
    id: `t${i}_${Math.floor(rng() * 1e6)}`,
    value: Math.max(lo, Math.min(hi, v)),
  }));
}

/* --------------------------------------------------------------- drills --
   On a built turn the player chooses the numbers, which means they can spend
   a whole run never once making the fact they are worst at. Drill turns take
   the choice away and hand them a problem, weighted toward exactly what they
   have been dodging. This is the only part of the game that picks for them,
   which is why it is also the only part with a clock. */

/** Turn a stored fact key such as "7*8" back into a problem. */
export function parseFactKey(key) {
  const m = /^(\d+)([+\-*/])(\d+)$/.exec(key || '');
  if (!m) return null;
  const a = Number(m[1]), op = m[2], b = Number(m[3]);
  if (!isLegal(a, op, b)) return null;
  return { a, op, b };
}

/** A fresh problem in a given skill, sized to the player's current level. */
export function problemForSkill(rng, skillId, level) {
  const skill = SKILL_BY_ID[skillId];
  if (!skill || !skill.op) return null;
  const [lo, hi] = tileRangeFor(level);
  const seed = seedFor(rng, skillId, lo, hi);
  if (!seed) return null;
  const [a, b] = seed;
  if (!isLegal(a, skill.op, b)) return null;
  return { a, op: skill.op, b };
}

/* Mostly what they avoid, with some they know mixed in. All-weak every time
   reads as punishment, and a kid who only ever meets their worst fact stops
   playing, which teaches nothing at all. */
export const DRILL_WEAK_SHARE = 0.65;

export function pickDrill(rng, mastery, runes, level) {
  const usable = SKILLS.filter(s => s.op && runes.includes(s.op) && s.tier <= level + 1);
  if (!usable.length) return null;

  if (rng() < DRILL_WEAK_SHARE) {
    const shaky = shakyFacts(mastery, 12)
      .map(f => ({ f, parsed: parseFactKey(f.key) }))
      .filter(x => x.parsed && runes.includes(x.parsed.op));
    if (shaky.length) {
      const pool = shaky.slice(0, 6);
      const chosen = pool[Math.floor(rng() * pool.length)];
      const { a, op, b } = chosen.parsed;
      return { a, op, b, skill: classify(a, op, b), fact: factKey(a, op, b), weak: true };
    }
    // No fact history yet: aim at the weakest skill instead.
    const target = usable.reduce((x, y) =>
      (skillScore(mastery.skills[y.id], y.id) < skillScore(mastery.skills[x.id], x.id) ? y : x));
    const prob = problemForSkill(rng, target.id, level);
    if (prob) return { ...prob, skill: classify(prob.a, prob.op, prob.b), fact: factKey(prob.a, prob.op, prob.b), weak: true };
  }

  for (let tries = 0; tries < 8; tries++) {
    const skill = usable[Math.floor(rng() * usable.length)];
    const prob = problemForSkill(rng, skill.id, level);
    if (prob) return { ...prob, skill: classify(prob.a, prob.op, prob.b), fact: factKey(prob.a, prob.op, prob.b), weak: false };
  }
  return null;
}

/* How long they get. Taken from how fast this child already answers this kind
   of problem, not a number picked out of the air: a fixed countdown is
   trivial for the quick kid and demoralising for the slower one, and it
   punishes the slower one forever. The window tightens on its own as their
   average comes down. */
export const DRILL_MIN_MS = 4000;
export const DRILL_MAX_MS = 20000;
export const DRILL_DEFAULT_MS = 12000;

export function drillAllowanceMs(mastery, { skill, fact }) {
  const f = fact && mastery.facts[fact];
  const s = skill && mastery.skills[skill];
  let avg = null;
  if (f && f.attempts >= 2) avg = f.totalMs / f.attempts;
  else if (s && s.attempts >= 4) avg = s.totalMs / s.attempts;
  if (avg === null) return DRILL_DEFAULT_MS;
  // Their own pace plus a moment to read the problem.
  const allowance = avg * 1.6 + 1500;
  return Math.round(Math.max(DRILL_MIN_MS, Math.min(DRILL_MAX_MS, allowance)));
}

/* The whole-duel clock. Long enough to answer every question at this child's
   own pace with room to spare, so running it out means they stalled rather
   than that they are simply a slower thinker. */
export function averageAnswerMs(mastery) {
  let ms = 0, n = 0;
  for (const s of SKILLS) {
    const rec = mastery.skills[s.id];
    if (rec?.attempts) { ms += rec.totalMs; n += rec.attempts; }
  }
  return n ? ms / n : 6000;
}

export function bossFightMs(mastery, depth) {
  const turns = Math.ceil(turnsFor(depth, { boss: true }));
  const per = Math.max(DRILL_MIN_MS, Math.min(DRILL_MAX_MS, averageAnswerMs(mastery) * 1.6 + 1500));
  return Math.round(turns * per * 1.35);
}

/* -------------------------------------------------------------- strikes --
   A strike is: tile a, operator, tile b, and the answer the player typed. */

/** Is this pair legal for this operator? Illegal pairs are greyed out in the UI. */
export function isLegal(a, op, b) {
  if (op === '-') return a >= b;
  if (op === '/') return b !== 0 && a % b === 0;
  return true;
}

export function evaluate(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    default: return NaN;
  }
}

/** Every legal play available from a hand. Used by the hint system and tests. */
export function legalPlays(tiles, runes) {
  const out = [];
  for (let i = 0; i < tiles.length; i++) {
    for (let j = 0; j < tiles.length; j++) {
      if (i === j) continue;
      for (const op of runes) {
        const a = tiles[i].value, b = tiles[j].value;
        if (isLegal(a, op, b)) out.push({ i, j, op, a, b, result: evaluate(a, op, b) });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------- damage ----
   Order: raw result -> relic flat/op bonuses -> ward multiplier -> combo
   -> subtract armor. Armor last so a ward can punch through it, which is the
   whole reason a smaller ward-matching number can beat a bigger raw one. */
export function computeDamage({ result, op, ward, resist, resistAt, armor, relics, combo, ms, isFirstHit }) {
  let dmg = result;
  const owned = relics.map(id => RELIC_BY_ID[id]).filter(Boolean);

  for (const r of owned) {
    if (r.flat) dmg += r.flat;
    if (r.opBonus && r.opBonus[op]) dmg += r.opBonus[op];
    if (r.slowBonus && ms > 6000) dmg += r.slowBonus;
  }
  let pct = 0;
  for (const r of owned) {
    if (r.pctIf && r.pctIf(result)) pct += r.pct;
    if (r.fastPct && ms < 4000) pct += r.fastPct;
  }
  dmg = dmg * (1 + pct);

  const w = WARDS[ward] || WARDS.none;
  const warded = w.test(result);
  if (warded) dmg *= w.mult;

  /* Resist is applied after the ward so a ward-matching number can still be
     the best play even when it is on the wrong side of the threshold. */
  const rz = RESISTS[resist] || RESISTS.none;
  const resisted = rz.id !== 'none' && !rz.cap && rz.apply(result, resistAt) < 1;
  if (resisted) dmg *= rz.apply(result, resistAt);
  const capped = !!rz.cap && dmg > resistAt;
  if (capped) dmg = resistAt;

  const comboStep = owned.some(r => r.comboX2) ? 0.2 : 0.1;
  dmg *= 1 + Math.min(5, combo) * comboStep;

  if (isFirstHit && owned.some(r => r.firstHitX2)) dmg *= 2;

  const final = Math.max(1, Math.round(dmg) - armor);
  return { damage: Math.max(1, final), warded, resisted, capped, blockedByArmor: Math.round(dmg) <= armor };
}

/* -------------------------------------------------------------- enemies --
   Everything here is derived from `bestHit`: the largest damage the player
   can realistically produce with the tiles and runes they currently have.
   Tying enemy health to that is what keeps a fight the same length whether
   the kid is adding to 20 or multiplying twelves, and it means the balance
   adapts automatically as they get better instead of needing new tables. */

/** Largest damage the player can plausibly reach on one strike right now. */
export function bestHitEstimate(runes, level) {
  const [, hi] = TILE_RANGE[level] || TILE_RANGE[6];
  if (runes.includes('*')) return Math.round(hi * (hi - 1) * 0.7);
  return hi * 2;
}

/** Turn budget for a fight: shortest early, longest at the bottom of the run. */
export function turnsFor(depth, { elite = false, boss = false } = {}) {
  const base = 2.6 + depth * 0.09;
  return base * (boss ? 2.0 : elite ? 1.5 : 1);
}

function resolveIntent(it, budget) {
  switch (it.type) {
    case 'attack':    return { type: 'attack', dmg: Math.max(1, Math.round(budget.hitDmg * (it.w || 1))) };
    case 'bigAttack': return { type: 'bigAttack', dmg: Math.max(2, Math.round(budget.hitDmg * (it.w || 1.7))) };
    case 'armorUp':   return { type: 'armorUp', amount: Math.max(1, Math.round(budget.bestHit * 0.12)) };
    case 'heal':      return { type: 'heal', amount: Math.max(1, Math.round(budget.maxHp * 0.18)) };
    case 'shield':    return { type: 'shield', value: budget.shieldValue };
    default:          return { type: it.type };
  }
}

/* A shield the player can never build is a wall, not a puzzle, so the target
   is always a number their own tile range can actually produce. */
function reachableTarget(rng, runes, level) {
  const [lo, hi] = TILE_RANGE[level] || TILE_RANGE[6];
  const a = ri(rng, Math.max(2, lo), hi);
  const b = ri(rng, Math.max(2, lo), hi);
  if (runes.includes('*')) return a * b;
  return a + b;
}

/** The damage a thinking player will actually land once a resist is in play. */
export function effectiveHit(bestHit, resist, resistAt) {
  if (resist === 'cap') return resistAt;
  if (resist === 'over') return Math.max(resistAt, bestHit * 0.5);
  return bestHit;
}

/* What one answer is worth in a boss duel. A duel has no tiles, so the player
   cannot pick the big multiplication that bestHitEstimate assumes: they get
   whatever problem the game hands them. Budgeting a duel against the building
   ceiling makes it run about twice its intended length, and those extra turns
   are extra damage taken. Sampling the actual drill picker is the honest
   answer, since that is precisely what they will be asked. */
export function expectedDrillDamage(rng, mastery, runes, level, samples = 32) {
  let sum = 0, n = 0;
  for (let i = 0; i < samples; i++) {
    const d = pickDrill(rng, mastery, runes, level);
    if (!d) continue;
    sum += evaluate(d.a, d.op, d.b);
    n++;
  }
  return n ? Math.max(1, sum / n) : 10;
}

export function spawnEnemy(rng, depth, opts = {}) {
  const { boss = false, elite = false, runes = ['+', '-'], level = 1, playerMaxHp = 50,
          ceiling = null, duel = false } = opts;
  const tier = Math.max(1, Math.min(3, Math.ceil(depth / 3)));
  const pool = boss ? BOSSES : ENEMIES.filter(e => e.tier <= tier + (elite ? 1 : 0));
  const tpl = pick(rng, pool.length ? pool : ENEMIES);

  const bestHit = ceiling || bestHitEstimate(runes, level);
  const turns = turnsFor(depth, { elite, boss });
  const armor = Math.round(bestHit * tpl.armorFrac);

  /* Per-turn chip damage. A four-turn fight should cost a fifth of the
     player's health, not half: the run has to survive fifteen of them. */
  /* A duel is nothing but telegraphed blows you are meant to parry, so those
     blows are heavy. Parrying one is clearly worth the answer; missing one
     hurts. Without this a duel is the safest floor in the run, because a
     fluent player blunts every hit and the fight carries no threat at all. */
  const share = Math.min(0.07, 0.03 + depth * 0.002)
    * (boss ? 1.3 : elite ? 1.15 : 1)
    /* Nearly every duel turn is an attack now that jam and shield are gone,
       where an ordinary boss attacks on about half its turns. The multiplier
       is sized for that, not for the raw per-hit number. */
    * (duel ? 1.2 : 1);
  const hitDmg = Math.max(1, Math.round(playerMaxHp * share));

  let resist = pick(rng, tpl.resist || ['none']);
  /* Multiplication hands the player a damage ceiling an order of magnitude
     above addition, which makes "multiply the two biggest tiles" correct
     almost every turn and kills the thinking. Once x is in play, most enemies
     therefore carry a ceiling-punishing resist, and "under" (which rewards
     going big) is swapped out for one that does not. */
  if (runes.includes('*') && (resist === 'under' || resist === 'cap' || (resist === 'none' && rng() < 0.75))) {
    resist = 'over';
  }
  const resistAt = resist === 'none' ? 0 : Math.max(3, Math.round(bestHit * RESISTS[resist].share));

  /* Health is budgeted after armor AND resist, so those are puzzles that change
     which number you want rather than padding that makes the fight longer. */
  const perTurn = Math.max(1, effectiveHit(bestHit, resist, resistAt) - armor);
  const maxHp = Math.max(6, Math.round(perTurn * turns * tpl.hpW));
  const budget = { bestHit, maxHp, hitDmg, shieldValue: reachableTarget(rng, runes, level) };

  /* In a duel the player answers what they are given, so two of the moves
     have nothing to bite on: there are no tiles to jam, and a shield asking
     for an exact number cannot be met by a number you did not choose. Both
     would be free turns that read as threats, so a duelling boss does not
     have them. */
  const intents = duel
    ? (tpl.intents.filter(i => i.type !== 'jam' && i.type !== 'shield').length
        ? tpl.intents.filter(i => i.type !== 'jam' && i.type !== 'shield')
        : [{ type: 'attack', w: 1 }])
    : tpl.intents;

  return {
    id: tpl.id,
    name: (elite ? 'Elite ' : '') + tpl.name,
    art: tpl.art,
    boss: !!tpl.boss,
    elite,
    duel,
    hp: maxHp,
    maxHp,
    armor,
    ward: pick(rng, tpl.ward),
    resist,
    resistAt,
    shield: 0,
    intents: intents.map(it => resolveIntent(it, budget)),
    intentIndex: 0,
    depth,
  };
}

/** Resolve the enemy's telegraphed move. Returns the events it produced. */
export function enemyAct(enemy, player, rng) {
  const intent = enemy.intents[enemy.intentIndex % enemy.intents.length];
  enemy.intentIndex += 1;
  const events = [];

  switch (intent.type) {
    case 'attack':
    case 'bigAttack': {
      const block = player.relics.map(id => RELIC_BY_ID[id]).filter(Boolean)
        .reduce((sum, r) => sum + (r.block || 0), 0);
      const raw = enemy.enraged ? intent.dmg * 2 : intent.dmg;
      const dmg = Math.max(1, raw - block);
      player.hp -= dmg;
      events.push({ type: 'damage', amount: dmg, text: `${enemy.name} hits you for ${dmg}.` });
      break;
    }
    case 'armorUp':
      enemy.armor += intent.amount;
      events.push({ type: 'armor', text: `${enemy.name} hardens. Armor is now ${enemy.armor}.` });
      break;
    case 'heal': {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + intent.amount);
      events.push({ type: 'heal', text: `${enemy.name} heals ${intent.amount}.` });
      break;
    }
    case 'shield': {
      enemy.shield = intent.value;
      events.push({ type: 'shield', text: `${enemy.name} raises a shield. Hit it for EXACTLY ${enemy.shield} to shatter it.` });
      break;
    }
    case 'jam':
      events.push({ type: 'jam', text: `${enemy.name} jams a tile. One of your tiles is locked next turn.` });
      break;
    default:
      break;
  }
  return { intent, events };
}

/** The one-turn warning the player plans against. */
export function describeIntent(enemy) {
  const intent = enemy.intents[enemy.intentIndex % enemy.intents.length];
  const hit = n => (enemy.enraged ? n * 2 : n);
  switch (intent.type) {
    case 'attack': return { icon: '\u{1F5E1}\uFE0F', text: `Attack for ${hit(intent.dmg)}` };
    case 'bigAttack': return { icon: '\u{1F4A5}', text: `BIG attack for ${hit(intent.dmg)}` };
    case 'armorUp': return { icon: '\u{1F6E1}\uFE0F', text: `Armor +${intent.amount}` };
    case 'heal': return { icon: '\u2764\uFE0F', text: `Heal ${intent.amount}` };
    case 'shield': return { icon: '\u{1F512}', text: `Raise a ${intent.value} shield` };
    case 'jam': return { icon: '\u{1F513}', text: 'Lock one of your tiles' };
    default: return { icon: '?', text: 'Unknown' };
  }
}

/* ----------------------------------------------------------------- map ---
   A run is a column of floors, 2-3 node choices each, a boss every third.
   A standard run ENDS at floor 20 with a win. Kids need a finish line, not a
   treadmill: a session you can actually complete is worth more than one that
   only ever ends in death. Endless mode unlocks after the first clear. */
export const FINAL_DEPTH = 20;
export const NODE_TYPES = ['battle', 'elite', 'riddle', 'treasure', 'shop', 'rest'];

/* Two identical choices is not a choice, so a floor never repeats a node type
   and always contains exactly one fight to anchor it. */
/* A boss every third floor, and always one on the last floor of a standard
   run so it ends on a duel rather than a slime. */
export const BOSS_EVERY = 3;

export function isBossFloor(depth) {
  return depth % BOSS_EVERY === 0 || depth === FINAL_DEPTH;
}

export function generateFloor(rng, depth) {
  if (isBossFloor(depth)) return [{ type: 'boss', depth }];

  const fight = depth >= 3 && rng() < 0.28 ? 'elite' : 'battle';
  const others = ['riddle', 'treasure', 'rest'];
  if (depth >= 3) others.push('shop');
  if (depth >= 4) others.push(fight === 'elite' ? 'battle' : 'elite');

  const count = depth === 1 ? 2 : (rng() < 0.5 ? 2 : 3);
  const nodes = [{ type: fight, depth }];
  const pool = others.slice();
  while (nodes.length < count && pool.length) {
    const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    nodes.push({ type: t, depth });
  }
  // Shuffle so the fight is not always the first option on screen.
  for (let i = nodes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
  }
  return nodes;
}

/* -------------------------------------------------------------- riddles --
   Pick a riddle aimed at the player's level, avoiding immediate repeats. */
export function generateRiddle(rng, mastery, recentIds = [], grade = 0) {
  const level = difficultyLevel(mastery, grade);
  let pool = RIDDLES.filter(r => r.tier <= level + 1 && !recentIds.includes(r.id));
  if (pool.length === 0) pool = RIDDLES.filter(r => !recentIds.includes(r.id));
  if (pool.length === 0) pool = RIDDLES;
  const tpl = pick(rng, pool);
  const made = tpl.make(rng);
  return { id: tpl.id, skill: tpl.skill, text: made.text, answer: made.answer };
}

/* --------------------------------------------------------------- relics --
   Offer three the player does not already hold. */
export function offerRelics(rng, owned, count = 3) {
  const pool = RELICS.filter(r => !owned.includes(r.id));
  const out = [];
  const copy = pool.slice();
  while (out.length < count && copy.length) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}

/* ------------------------------------------------------------------ run --
   The run object the UI drives. Held in memory; only mastery + meta persist. */
export function newRun(seed, profile, endless = false) {
  const rng = makeRng(seed);
  const ops = profile.mastery ? unlockedOps(profile.mastery, profile.grade) : ['+', '-'];
  for (const op of profile.meta?.startRunes || []) if (!ops.includes(op)) ops.push(op);
  return {
    seed,
    rng,
    depth: 1,
    endless: !!endless,
    floorNodes: generateFloor(rng, 1),
    player: {
      hp: 50 + (profile.meta?.bonusHp || 0),
      maxHp: 50 + (profile.meta?.bonusHp || 0),
      runes: ops,
      relics: [],
      gold: 0,
      combo: 0,
    },
    recentRiddles: [],
    stats: { battlesWon: 0, correct: 0, wrong: 0, deepest: 1 },
    over: false,
  };
}

export function handSize(player) {
  const bonus = player.relics.map(id => RELIC_BY_ID[id]).filter(Boolean)
    .reduce((sum, r) => sum + (r.handBonus || 0), 0);
  return 5 + bonus;
}

export function reshuffles(player) {
  const bonus = player.relics.map(id => RELIC_BY_ID[id]).filter(Boolean)
    .reduce((sum, r) => sum + (r.reshuffleBonus || 0), 0);
  return 1 + bonus;
}

export function hasRelic(player, id) { return player.relics.includes(id); }

export { classify, factKey, SKILLS, SKILL_BY_ID, WARDS, RESISTS, RELICS, RELIC_BY_ID, GRADES, GRADE_BY_ID };
