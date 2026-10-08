/* Word Kick — players saved in localStorage on this device. Nothing is sent
   anywhere. Every load goes through hydrate(), so a save written by an older
   version comes back with any new fields filled in instead of crashing. */
import { newProfile, clampGrade, clampNumber } from './engine.js';
import { KITS } from './data.js';
import { hydrateRewards } from '../../wordpunch/js/rewards.js';
import { PRIZES } from './prizes.js';

export const KEY = 'wordkick-v1';

export function hydrateProfile(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const base = newProfile({ name: raw.name, grade: raw.grade, kit: raw.kit, number: raw.number });
  const p = { ...base, ...raw };
  p.id = String(raw.id);
  p.name = String(p.name || 'Striker').slice(0, 16);
  p.grade = clampGrade(p.grade);
  p.number = clampNumber(p.number);
  if (!KITS.some(k => k.id === p.kit)) p.kit = KITS[0].id;
  p.settings = { ...base.settings, ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) };
  for (const k of ['progress', 'stats', 'missed']) {
    if (!p[k] || typeof p[k] !== 'object' || Array.isArray(p[k])) p[k] = {};
  }
  for (const [g, prog] of Object.entries(p.progress)) {
    p.progress[g] = {
      next: Math.max(0, Math.min(8, Number(prog?.next) || 0)),
      cups: Array.isArray(prog?.cups) ? prog.cups.filter(c => typeof c === 'string') : [],
    };
  }
  if (!Array.isArray(p.misses)) p.misses = [];
  p.matches = Number(p.matches) || 0;
  p.wins = Number(p.wins) || 0;
  p.rewards = hydrateRewards(raw.rewards, PRIZES);
  return p;
}

export function hydrate(raw) {
  const players = Array.isArray(raw?.players) ? raw.players.map(hydrateProfile).filter(Boolean) : [];
  const current = players.some(b => b.id === raw?.current) ? raw.current : (players[0]?.id ?? null);
  return { players, current };
}

export function load(storage = globalThis.localStorage) {
  let text = null;
  try { text = storage.getItem(KEY); } catch { return { players: [], current: null, readOnly: true }; }
  if (!text) return { players: [], current: null };
  try {
    return hydrate(JSON.parse(text));
  } catch {
    // Unreadable save: leave it on disk untouched rather than overwrite it.
    return { players: [], current: null, readOnly: true };
  }
}

export function save(state, storage = globalThis.localStorage) {
  if (state.readOnly) return false;
  try {
    storage.setItem(KEY, JSON.stringify({ players: state.players, current: state.current }));
    return true;
  } catch { return false; }
}
