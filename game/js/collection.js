/* Runebreaker — the collection: who you can play as, catching monsters, and
   math trophies. Pure logic, no DOM, so it can be unit tested. */

import { AVATARS, AVATAR_BY_CHAR, ALL_MONSTERS, MONSTER_BY_ID, TYPES, typeMult, SKILLS } from './data.js';
import { skillScore } from './engine.js';

/* ----------------------------------------------------------- characters --
   Everything a kid can play as: the heroes earned by beating floors, and
   every monster in the game, which become playable once caught. */
export const CHARACTERS = [
  ...AVATARS.map(a => ({ id: a.id, char: a.char, name: a.name, type: a.type, kind: 'hero', at: a.at })),
  ...ALL_MONSTERS.map(m => ({ id: m.id, char: m.art, name: m.name, type: m.type,
                              kind: m.boss ? 'boss' : 'monster', season: m.season || null })),
];
export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

export const TEAM_SIZE = 3;

/** Ids of every character this profile may play as. */
export function ownedIds(profile) {
  const beaten = profile.records?.floorsBeaten || 0;
  const heroes = AVATARS.filter(a => a.at <= beaten).map(a => a.id);
  const caught = (profile.caught || []).filter(id => MONSTER_BY_ID[id]);
  return [...new Set([...heroes, ...caught])];
}

/** The profile's lead character. Falls back on the avatar picked at creation. */
export function leadOf(profile) {
  return CHARACTER_BY_ID[profile.heroId]
    || CHARACTER_BY_ID[AVATAR_BY_CHAR[profile.avatar]?.id]
    || CHARACTER_BY_ID.mage;
}

/** The team, cleaned: owned characters only, no repeats, never empty. */
export function teamOf(profile) {
  const owned = new Set(ownedIds(profile));
  const lead = leadOf(profile);
  const team = [lead.id, ...(profile.party || [])]
    .filter((id, i, all) => all.indexOf(id) === i && (owned.has(id) || id === lead.id));
  return team.slice(0, TEAM_SIZE).map(id => CHARACTER_BY_ID[id]).filter(Boolean);
}

/** Matchup of a fighter against a foe, from the fighter's side. */
export function matchup(fighterType, foeType) {
  const dealt = typeMult(fighterType, foeType);
  const taken = typeMult(foeType, fighterType);
  const edge = dealt > 1 && taken > 1 ? 'clash'
    : dealt > 1 ? 'strong' : dealt < 1 ? 'weak' : taken > 1 ? 'risky' : 'even';
  return { dealt, taken, edge };
}

/* ------------------------------------------------------------- evolving --
   Characters evolve from the maths done with them: every right answer while
   a character is the one fighting counts toward its next stage. Three stages,
   and each one hits a little harder, so a favourite is worth building up.

   Emoji only stretch so far. Where a real line exists (an egg-to-bird kind
   of chain) the picture changes; everything else keeps its picture and
   gains a new name, a glow in its type's colour, and stars. */
export const EVOLVE_AT = [0, 60, 200];          // right answers to reach stage 1, 2, 3
export const STAGE_POWER = [1, 1.1, 1.2];       // damage at stage 1, 2, 3
export const MAX_STAGE = 3;

export const EVO_CHAINS = {
  chick:   ['\u{1F425}', '\u{1F414}', '\u{1F99A}'],                   // chick, hen, peacock
  newt:    ['\u{1F98E}', '\u{1F40A}', '\u{1F409}'],                   // lizard, crocodile, dragon
  crab:    ['\u{1F980}', '\u{1F99E}', '\u{1F991}'],                   // crab, lobster, squid
  tiger:   ['\u{1F42F}', '\u{1F405}', '\u{1F405}'],                   // tiger face, tiger
  bat:     ['\u{1F987}', '\u{1F9DB}', '\u{1F9DB}'],                   // bat, vampire
  wisp:    ['✨', '⭐', '\u{1F31F}'],                         // sparkles, star, glowing star
  v_rain:  ['\u{1F327}️', '⛈️', '\u{1F30A}'],          // rain, thunderstorm, wave
  h_candle:['\u{1F56F}️', '\u{1F525}', '☄️'],          // candle, flame, comet
  w_snow:  ['⛄', '☃️', '☃️'],                // snowman, snowing snowman
};

const STAGE_WORDS = {
  fire:   ['Blaze', 'Inferno'],
  water:  ['Tide', 'Tsunami'],
  grass:  ['Wild', 'Ancient'],
  storm:  ['Thunder', 'Tempest'],
  light:  ['Bright', 'Radiant'],
  shadow: ['Dusk', 'Eclipse'],
};

/** Right answers made with a character. */
export function xpOf(profile, id) { return (profile.xp && profile.xp[id]) || 0; }

/** The stage a character has actually evolved to (shown on the evolution screen first). */
export function stageOf(profile, id) {
  return Math.max(1, Math.min(MAX_STAGE, (profile.stages && profile.stages[id]) || 1));
}

/** The stage its right answers have earned, which may be ahead of what has been shown. */
export function earnedStage(profile, id) {
  const xp = xpOf(profile, id);
  return EVOLVE_AT.reduce((st, at, i) => (xp >= at ? i + 1 : st), 1);
}

/** Its name at a stage: "Ember Newt" becomes "Blaze Newt" then "Inferno Newt". */
export function stageName(c, stage) {
  if (stage <= 1) return c.name;
  const word = (STAGE_WORDS[c.type] || STAGE_WORDS.light)[stage - 2];
  const words = c.name.split(' ');
  if (words[0] === 'The') return ['The', word, ...words.slice(1)].join(' ');
  if (words.length >= 2) return [word, ...words.slice(1)].join(' ');
  return `${word} ${c.name}`;
}

/** How a character looks for this profile: picture, name, stage, and power. */
export function formOf(profile, c, stage = stageOf(profile, c.id)) {
  const chain = EVO_CHAINS[c.id];
  return {
    ...c,
    char: chain ? chain[stage - 1] : c.char,
    name: stageName(c, stage),
    stage,
    power: STAGE_POWER[stage - 1],
    newPicture: !!(chain && stage > 1 && chain[stage - 1] !== chain[stage - 2]),
  };
}

/** Progress toward the next stage, for a bar: { have, need, next } or null at the top. */
export function evolveProgress(profile, id) {
  const st = stageOf(profile, id);
  if (st >= MAX_STAGE) return null;
  return { have: xpOf(profile, id), need: EVOLVE_AT[st], next: st + 1 };
}

/** Count a right answer for a character. */
export function addXp(profile, id) {
  profile.xp = profile.xp || {};
  profile.xp[id] = (profile.xp[id] || 0) + 1;
}

/** Characters whose right answers have earned a stage not yet shown. */
export function pendingEvolutions(profile) {
  return Object.keys(profile.xp || {})
    .filter(id => CHARACTER_BY_ID[id] && earnedStage(profile, id) > stageOf(profile, id))
    .map(id => ({ id, from: stageOf(profile, id), to: stageOf(profile, id) + 1 }));
}

/** Evolve one step (the screen calls this as it plays). */
export function evolve(profile, id) {
  profile.stages = profile.stages || {};
  profile.stages[id] = Math.min(MAX_STAGE, stageOf(profile, id) + 1);
}

/* ---------------------------------------------------------------- moves --
   Special moves, three per type. A character knows the first from the start,
   learns the second when it evolves and the third at full evolution. Right
   answers fill an energy bar; a move spends it. Using one is a free action,
   so the turn still goes to a problem: the maths stays the main event and
   the move is the reward for it. */
export const ENERGY_MAX = 10;

export const MOVES = {
  fire: [
    { id: 'ember', name: 'Ember Boost', cost: 6, text: 'Your next hit does +30%.', fx: { boost: 1.3 } },
    { id: 'flame', name: 'Flame Burst', cost: 8, text: 'Blast the foe for an eighth of its health.', fx: { burst: 0.12 } },
    { id: 'inferno', name: 'Inferno', cost: 10, text: 'Your next hit does +60%.', fx: { boost: 1.6 } },
  ],
  water: [
    { id: 'rain', name: 'Healing Rain', cost: 6, text: 'Heal a little health.', fx: { heal: 0.12 } },
    { id: 'tidal', name: 'Tidal Shield', cost: 8, text: 'Block the next attack completely.', fx: { guard: true } },
    { id: 'tsunami', name: 'Tsunami', cost: 10, text: 'Crash into the foe for a seventh of its health.', fx: { burst: 0.15 } },
  ],
  grass: [
    { id: 'vine', name: 'Vine Wrap', cost: 6, text: 'The foe is tangled and skips its next attack.', fx: { skip: true } },
    { id: 'leech', name: 'Leech Seed', cost: 8, text: 'Drain some of the foe’s health into yours.', fx: { burst: 0.08, drain: true } },
    { id: 'regrow', name: 'Regrowth', cost: 10, text: 'Heal a good chunk of health.', fx: { heal: 0.22 } },
  ],
  storm: [
    { id: 'static', name: 'Static Shock', cost: 6, text: 'Your next hit ignores armor and resists.', fx: { boost: 1, pierce: true } },
    { id: 'thunder', name: 'Thunderbolt', cost: 8, text: 'Zap the foe for an eighth of its health.', fx: { burst: 0.12 } },
    { id: 'tempest', name: 'Tempest', cost: 10, text: 'Your next two hits do +25%.', fx: { boost: 1.25, hits: 2 } },
  ],
  light: [
    { id: 'shine', name: 'Shine', cost: 6, text: 'Breaks any shield and heals a little.', fx: { unshield: true, heal: 0.06 } },
    { id: 'barrier', name: 'Barrier', cost: 8, text: 'Block the next attack completely.', fx: { guard: true } },
    { id: 'beam', name: 'Radiant Beam', cost: 10, text: 'Strike the foe for a seventh of its health.', fx: { burst: 0.15 } },
  ],
  shadow: [
    { id: 'sneak', name: 'Shadow Sneak', cost: 6, text: 'Your next hit ignores armor and resists, +15%.', fx: { boost: 1.15, pierce: true } },
    { id: 'drain', name: 'Dark Drain', cost: 8, text: 'Drain some of the foe’s health into yours.', fx: { burst: 0.1, drain: true } },
    { id: 'curse', name: 'Curse', cost: 10, text: 'The foe hits softer for its next three attacks.', fx: { curse: 0.6, curseHits: 3 } },
  ],
};
export const MOVE_BY_ID = Object.fromEntries(Object.values(MOVES).flat().map(m => [m.id, m]));

/** The moves a character knows: one per stage it has evolved to. */
export function movesOf(profile, c) {
  return (MOVES[c.type] || MOVES.light).slice(0, stageOf(profile, c.id));
}

/* Apply a move. `me` and `foe` are anything with hp and maxHp (the run's
   player and an enemy, or two versus players); the rest of the state lives
   on them as flags the battle code reads: guard, boost, skipNext, weak.
   Returns what happened, for the log and the animation. */
export function applyMove(mv, me, foe, myType, foeType) {
  const f = mv.fx, out = { dmg: 0, heal: 0 };
  if (f.burst) {
    out.dmg = Math.max(1, Math.round(foe.maxHp * f.burst * typeMult(myType, foeType)));
    foe.hp -= out.dmg;
    if (f.drain) out.heal += out.dmg;
  }
  if (f.heal) out.heal += Math.round(me.maxHp * f.heal);
  if (out.heal) {
    const before = me.hp;
    me.hp = Math.min(me.maxHp, me.hp + out.heal);
    out.heal = me.hp - before;
  }
  if (f.guard) me.guard = true;
  if (f.boost) me.boost = { mult: f.boost, hits: f.hits || 1, pierce: !!f.pierce };
  if (f.skip) foe.skipNext = true;
  if (f.unshield) foe.shield = 0;
  if (f.curse) foe.weak = { mult: f.curse, hits: f.curseHits || 3 };
  return out;
}

/** Use up one hit of a boost; returns { mult, pierce } for this hit. */
export function spendBoost(me) {
  const b = me.boost;
  if (!b) return { mult: 1, pierce: false };
  b.hits -= 1;
  if (b.hits <= 0) me.boost = null;
  return { mult: b.mult, pierce: b.pierce };
}

/* -------------------------------------------------------------- catching --
   A win is a chance to catch the monster, and the chance is the math: the
   better the fight went, the likelier it joins. A flawless fight is close to
   a sure thing, so a careful kid is never stuck chasing one by luck. Elites
   and bosses are harder to catch, which keeps them special. */
export function catchChance(stats, { boss = false, elite = false } = {}) {
  const right = stats.right || 0, wrong = stats.wrong || 0;
  let p;
  if (right === 0) p = 0.1;
  else {
    const acc = right / (right + wrong);
    p = 0.15 + 0.55 * acc * acc
      + Math.min(0.1, (stats.best || 0) * 0.01)
      + (stats.fastMs !== null && stats.fastMs !== undefined && stats.fastMs < 3000 ? 0.05 : 0);
    if (wrong === 0 && right >= 3) p = Math.max(p, 0.9);
  }
  if (boss) p *= 0.6;
  else if (elite) p *= 0.8;
  return Math.max(0.05, Math.min(0.95, p));
}

/** Seasonal set progress: { total, caught }. */
export function seasonProgress(profile, seasonId) {
  const set = ALL_MONSTERS.filter(m => m.season === seasonId);
  const have = new Set(profile.caught || []);
  return { total: set.length, caught: set.filter(m => have.has(m.id)).length };
}

/* -------------------------------------------------------------- trophies --
   Every one is for the math, not for playing a lot of rounds: streaks,
   speed, clean fights, mastering a skill, trying a new topic, and climbing.
   Locked ones show what to aim for, including topics above the kid's level. */
const correctIn = (m, ...ids) => ids.reduce((n, id) => n + (m.skills[id]?.correct || 0), 0);
const solid = (m, id, tries = 12) => (m.skills[id]?.attempts || 0) >= tries && skillScore(m.skills[id], id) >= 0.8;
const totalRight = m => SKILLS.reduce((n, s) => n + (m.skills[s.id]?.correct || 0), 0);

export const TROPHIES = [
  { id: 'first_win',   icon: '\u{1F947}', name: 'First Victory',       text: 'Win a fight.',                         test: c => c.r.fightsWon >= 1 },
  { id: 'hot_streak',  icon: '\u{1F525}', name: 'Hot Streak',          text: '10 right in a row.',                   test: c => c.r.bestStreak >= 10 },
  { id: 'unstoppable', icon: '\u{1F320}', name: 'Unstoppable',         text: '25 right in a row.',                   test: c => c.r.bestStreak >= 25 },
  { id: 'flawless',    icon: '\u{1F48E}', name: 'Flawless',            text: 'Win a fight with no wrong answers (5 or more).', test: c => c.r.flawlessFights >= 1 },
  { id: 'flawless_boss', icon: '\u{1F451}', name: 'Not a Scratch',    text: 'Beat a boss with no wrong answers.',   test: c => c.r.flawlessBosses >= 1 },
  { id: 'speed_demon', icon: '\u{1F3CE}️', name: 'Speed Demon',   text: '25 right answers in under 3 seconds.', test: c => c.r.fastAnswers >= 25 },
  { id: 'lightning',   icon: '⚡',    name: 'Lightning Brain',     text: '100 right answers in under 3 seconds.', test: c => c.r.fastAnswers >= 100 },
  { id: 'century',     icon: '\u{1F4AF}', name: 'Century',             text: '100 right answers.',                   test: c => totalRight(c.m) >= 100 },
  { id: 'machine',     icon: '⚙️', name: 'Math Machine',     text: '500 right answers.',                   test: c => totalRight(c.m) >= 500 },
  { id: 'legend',      icon: '\u{1F3C6}', name: 'Legend',              text: '2,000 right answers.',                 test: c => totalRight(c.m) >= 2000 },
  { id: 'tables_rookie', icon: '✖️', name: 'Tables Rookie',  text: 'Times tables 2-5, quick and right.',   test: c => solid(c.m, 'mult_easy') },
  { id: 'tables_master', icon: '\u{1F9E0}', name: 'Times Table Master', text: 'Times tables 6-12, quick and right.', test: c => solid(c.m, 'mult_hard', 20) },
  { id: 'division_ace', icon: '➗',   name: 'Division Ace',        text: 'Dividing by 6-12, quick and right.',   test: c => solid(c.m, 'div_hard') },
  { id: 'word_wizard', icon: '\u{1F4D6}', name: 'Word Wizard',         text: '10 word problems right.',              test: c => correctIn(c.m, 'word_1step', 'word_2step') >= 10 },
  { id: 'fractions',   icon: '\u{1F355}', name: 'Fraction Finder',     text: '5 fraction questions right.',          test: c => correctIn(c.m, 'fractions') >= 5 },
  { id: 'decimals',    icon: '\u{1F50D}', name: 'Decimal Detective',   text: '5 decimal questions right.',           test: c => correctIn(c.m, 'decimals') >= 5 },
  { id: 'percent',     icon: '\u{1F4CA}', name: 'Percent Pro',         text: '5 percentage questions right.',        test: c => correctIn(c.m, 'percent') >= 5 },
  { id: 'ratio',       icon: '⚖️', name: 'Ratio Ranger',     text: '5 ratio questions right.',             test: c => correctIn(c.m, 'ratio') >= 5 },
  { id: 'negatives',   icon: '\u{1F977}', name: 'Negative Ninja',      text: '5 negative number questions right.',   test: c => correctIn(c.m, 'integers') >= 5 },
  { id: 'powers',      icon: '\u{1F680}', name: 'Power Player',        text: '5 powers right.',                      test: c => correctIn(c.m, 'exponents') >= 5 },
  { id: 'solve_x',     icon: '\u{1F5FA}️', name: 'X Marks the Spot', text: '5 solve-for-x questions right.',   test: c => correctIn(c.m, 'solve_x') >= 5 },
  { id: 'champion',    icon: '\u{1F94A}', name: 'Champion',            text: 'Win a battle against a friend.',       test: c => (c.r.versusWins || 0) >= 1 },
  { id: 'level5',      icon: '\u{1F9D7}', name: 'Climber',             text: 'Reach challenge level 5.',             test: c => c.level >= 5 },
  { id: 'level7',      icon: '\u{1F3D4}️', name: 'Mountaineer',   text: 'Reach challenge level 7.',             test: c => c.level >= 7 },
  { id: 'level9',      icon: '\u{1F31F}', name: 'Summit',              text: 'Reach challenge level 9.',             test: c => c.level >= 9 },
];
export const TROPHY_BY_ID = Object.fromEntries(TROPHIES.map(t => [t.id, t]));

/** Award anything newly earned. Returns the new trophies, and records them. */
export function checkTrophies(profile, level) {
  profile.trophies = profile.trophies || {};
  const r = {
    fightsWon: 0, bestStreak: 0, flawlessFights: 0, flawlessBosses: 0, fastAnswers: 0,
    ...(profile.records || {}),
  };
  const ctx = { r, m: profile.mastery, level };
  const fresh = [];
  for (const t of TROPHIES) {
    if (profile.trophies[t.id]) continue;
    let ok = false;
    try { ok = !!t.test(ctx); } catch { ok = false; }
    if (ok) { profile.trophies[t.id] = Date.now(); fresh.push(t); }
  }
  return fresh;
}

