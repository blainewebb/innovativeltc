/* Word Punch — boxers saved in localStorage on this device. Nothing is sent
   anywhere. Every load goes through hydrate(), so a save written by an older
   version comes back with any new fields filled in instead of crashing. */
import { newProfile, clampGrade } from './engine.js';
import { hydrateRewards } from './rewards.js';
import { PRIZES } from './prizes.js';

export const KEY = 'wordpunch-v1';

export function hydrateProfile(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const base = newProfile({ name: raw.name, grade: raw.grade, gloves: raw.gloves });
  const p = { ...base, ...raw };
  p.id = String(raw.id);
  p.name = String(p.name || 'Boxer').slice(0, 16);
  p.grade = clampGrade(p.grade);
  p.settings = { ...base.settings, ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) };
  for (const k of ['progress', 'stats', 'missed']) {
    if (!p[k] || typeof p[k] !== 'object' || Array.isArray(p[k])) p[k] = {};
  }
  for (const [g, prog] of Object.entries(p.progress)) {
    p.progress[g] = {
      next: Math.max(0, Math.min(8, Number(prog?.next) || 0)),
      belts: Array.isArray(prog?.belts) ? prog.belts.filter(b => typeof b === 'string') : [],
    };
  }
  if (!Array.isArray(p.misses)) p.misses = [];
  p.fights = Number(p.fights) || 0;
  p.wins = Number(p.wins) || 0;
  p.rewards = hydrateRewards(raw.rewards, PRIZES);
  return p;
}

export function hydrate(raw) {
  const boxers = Array.isArray(raw?.boxers) ? raw.boxers.map(hydrateProfile).filter(Boolean) : [];
  const current = boxers.some(b => b.id === raw?.current) ? raw.current : (boxers[0]?.id ?? null);
  return { boxers, current };
}

export function load(storage = globalThis.localStorage) {
  let text = null;
  try { text = storage.getItem(KEY); } catch { return { boxers: [], current: null, readOnly: true }; }
  if (!text) return { boxers: [], current: null };
  try {
    return hydrate(JSON.parse(text));
  } catch {
    // Unreadable save: leave it on disk untouched rather than overwrite it,
    // so there is still something to recover by hand.
    return { boxers: [], current: null, readOnly: true };
  }
}

export function save(state, storage = globalThis.localStorage) {
  if (state.readOnly) return false;
  try {
    storage.setItem(KEY, JSON.stringify({ boxers: state.boxers, current: state.current }));
    return true;
  } catch { return false; }
}
