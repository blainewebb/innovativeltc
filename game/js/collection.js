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

