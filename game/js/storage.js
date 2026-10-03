/* Runebreaker — profiles and persistence. One device, several kids.
   Everything stays in localStorage. Nothing is sent anywhere. */

import { blankMastery } from './engine.js';
import { AVATAR_BY_CHAR, MONSTER_BY_ID } from './data.js';

const KEY = 'runebreaker.v1';

const EMPTY = { profiles: [], activeId: null, settings: { sound: true } };

/* Bring a saved store up to the current shape. Every release that adds a
   field would otherwise leave every existing hero missing it, and a hero the
   code cannot read is a hero the family has lost. Nothing here deletes: it
   only fills in what is absent, so an update can never cost anyone progress.
   Separated from load() so it can be tested without a browser. */
export function hydrate(raw) {
  const base = structuredClone(EMPTY);
  if (!raw || typeof raw !== 'object') return base;
  const data = { ...base, ...raw };
  data.settings = { ...base.settings, ...(raw.settings || {}) };
  data.profiles = (Array.isArray(raw.profiles) ? raw.profiles : [])
    .map(normalizeProfile)
    .filter(Boolean);
  // A pointer to a hero that is no longer there would show an empty hub.
  if (!data.profiles.some(p => p.id === data.activeId)) data.activeId = null;
  return data;
}

export function load() {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return structuredClone(EMPTY);
    return hydrate(JSON.parse(stored));
  } catch {
    // A save we cannot parse is left on disk untouched rather than overwritten,
    // so there is still something to recover by hand.
    return structuredClone(EMPTY);
  }
}

export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota or private mode */ }
}

export function newProfile(name, avatar, grade = 0) {
  return {
    id: `p${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name,
    avatar,
    /* Who they play as. heroId names a character (an earned hero or a caught
       monster); avatar is kept as its picture, which the older screens use. */
    heroId: AVATAR_BY_CHAR[avatar]?.id || 'mage',
    party: [],
    caught: [],
    trophies: {},
    // Right answers made with each character, and the stage each has evolved to.
    xp: {},
    stages: {},
    /* A starting point for difficulty, not a setting. Its influence fades as
       the child's own answers accumulate. 0 means it was never asked. */
    grade,
    created: Date.now(),
    mastery: blankMastery(),
    meta: { startRunes: [], bonusHp: 0, xp: 0, unlockedRelics: [] },
    /* Per hero, so a kid who freezes under a clock can have drills off
       without changing anything for their brother. */
    prefs: { drills: true },
    records: { deepest: 0, runs: 0, bossesFelled: 0, wins: 0, bestEndless: 0, floorsBeaten: 0,
               fightsWon: 0, bestStreak: 0, flawlessFights: 0, flawlessBosses: 0, fastAnswers: 0,
               levelSeen: 0 },
    /* One entry per day the kid played: { date:'YYYY-MM-DD', ms, correct, wrong } */
    days: [],
  };
}

/* ---------------------------------------------------------- normalising --
   Anything coming from an export file, or from a store written by an older
   version of the game, gets filled in here. Missing fields would otherwise
   crash a screen much later, a long way from the cause. */
/** A { name: whole number } map from a save, with junk dropped. */
function cleanCounts(raw, max = Infinity) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw)
    .map(([k, v]) => [k, Math.floor(Number(v))])
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .map(([k, v]) => [k, Math.min(max, v)]));
}

export function normalizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const base = newProfile(String(raw.name || 'Hero').slice(0, 12), raw.avatar || '\u{1F9D9}', Number(raw.grade) || 0);
  const p = {
    ...base,
    id: typeof raw.id === 'string' && raw.id ? raw.id : base.id,
    created: Number(raw.created) || base.created,
    grade: Number(raw.grade) || 0,
    meta: { ...base.meta, ...(raw.meta || {}) },
    prefs: { ...base.prefs, ...(raw.prefs || {}) },
    heroId: typeof raw.heroId === 'string' && raw.heroId ? raw.heroId : base.heroId,
    party: Array.isArray(raw.party) ? raw.party.filter(x => typeof x === 'string').slice(0, 3) : [],
    // Only monsters that still exist, so a renamed one cannot leave a blank card.
    caught: Array.isArray(raw.caught) ? [...new Set(raw.caught.filter(id => MONSTER_BY_ID[id]))] : [],
    xp: cleanCounts(raw.xp),
    stages: cleanCounts(raw.stages, 3),
    trophies: raw.trophies && typeof raw.trophies === 'object' && !Array.isArray(raw.trophies)
      ? Object.fromEntries(Object.entries(raw.trophies).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]))
      : {},
    records: (() => {
      const r = { ...base.records, ...(raw.records || {}) };
      /* Heroes from before avatars were earned should not read as zero. Credit
         them their deepest floor, which is the most we can honestly infer. */
      if (!Number.isFinite(Number(raw.records?.floorsBeaten))) r.floorsBeaten = Number(r.deepest) || 0;
      return r;
    })(),
    days: Array.isArray(raw.days) ? raw.days.filter(d => d && typeof d.date === 'string').map(d => ({
      date: d.date, ms: Number(d.ms) || 0, correct: Number(d.correct) || 0, wrong: Number(d.wrong) || 0,
    })) : [],
  };

  // Mastery is merged onto a blank record so a new skill added since the
  // export still exists, rather than being undefined on the report card.
  const mastery = blankMastery();
  const src = raw.mastery || {};
  for (const [id, rec] of Object.entries(src.skills || {})) {
    if (!rec || typeof rec !== 'object') continue;
    mastery.skills[id] = {
      attempts: Number(rec.attempts) || 0,
      correct: Number(rec.correct) || 0,
      ema: Number.isFinite(rec.ema) ? rec.ema : 0.5,
      totalMs: Number(rec.totalMs) || 0,
    };
  }
  for (const [key, rec] of Object.entries(src.facts || {})) {
    if (!rec || typeof rec !== 'object') continue;
    mastery.facts[key] = {
      attempts: Number(rec.attempts) || 0,
      correct: Number(rec.correct) || 0,
      ema: Number.isFinite(rec.ema) ? rec.ema : 0.5,
      totalMs: Number(rec.totalMs) || 0,
    };
  }
  p.mastery = mastery;
  return p;
}

/* ------------------------------------------------------ export / import --
   There is no server and no account, so a hero lives only in one browser on
   one device. That makes a backup file the difference between "we moved to
   the new tablet" and "eight months of learning record is gone". */
export const EXPORT_FORMAT = 1;

export function exportPayload(profiles) {
  return {
    app: 'runebreaker',
    format: EXPORT_FORMAT,
    exported: new Date().toISOString(),
    heroes: profiles,
  };
}

export function exportFilename(profiles) {
  const who = profiles.length === 1 ? profiles[0].name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : 'all-heroes';
  return `runebreaker-${who}-${today()}.json`;
}

/** Parse an export file. Throws an Error whose message is safe to show. */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That does not look like a Runebreaker backup. Check you copied the whole thing.');
  }
  if (!data || data.app !== 'runebreaker') {
    throw new Error('That file is not a Runebreaker backup.');
  }
  if (Number(data.format) > EXPORT_FORMAT) {
    throw new Error('That backup was made by a newer version of the game. Update this device first.');
  }
  const heroes = (Array.isArray(data.heroes) ? data.heroes : []).map(normalizeProfile).filter(Boolean);
  if (!heroes.length) throw new Error('That backup has no heroes in it.');
  return heroes;
}

/** Give an incoming hero a fresh id so it can sit alongside the existing one. */
export function asCopy(profile) {
  return {
    ...profile,
    id: `p${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name: `${profile.name} (2)`.slice(0, 16),
  };
}

export function activeProfile(data) {
  return data.profiles.find(p => p.id === data.activeId) || null;
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayEntry(profile) {
  const date = today();
  let entry = profile.days.find(d => d.date === date);
  if (!entry) { entry = { date, ms: 0, correct: 0, wrong: 0 }; profile.days.push(entry); }
  if (profile.days.length > 400) profile.days = profile.days.slice(-400);
  return entry;
}
