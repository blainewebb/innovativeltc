/* Verse Quest — players saved in localStorage on this device. Nothing is sent
   anywhere. Every load goes through hydrate(), so a save written by an older
   version comes back with any new fields filled in instead of crashing. */
import { newProfile, isDay, GOALS, STEPS, INTERVALS } from './engine.js';
import { VERSES } from './data.js';

export const KEY = 'versequest-v1';
const num = (v, lo, hi, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.floor(n))) : d; };

export function hydrateProfile(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const base = newProfile({ name: raw.name, color: raw.color });
  const p = { ...base, id: String(raw.id) };
  p.color = typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : '#f59e0b';
  p.settings = { ...base.settings, ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) };
  p.settings.sound = p.settings.sound !== false;
  p.settings.readAloud = !!p.settings.readAloud;
  if (!GOALS.includes(p.settings.goal)) p.settings.goal = base.settings.goal;

  const known = new Set(VERSES.map(v => v.id));
  for (const [id, s] of Object.entries(raw.verses && typeof raw.verses === 'object' ? raw.verses : {})) {
    if (!known.has(id) || !s || typeof s !== 'object') continue;   // a verse removed from the game
    const stage = num(s.stage, 0, STEPS);
    p.verses[id] = {
      stage,
      box: num(s.box, 0, INTERVALS.length - 1),
      due: stage >= STEPS && isDay(s.due) ? s.due : null,
      mastered: isDay(s.mastered) ? s.mastered : null,
      stepDay: isDay(s.stepDay) ? s.stepDay : null,
      stepsToday: num(s.stepsToday, 0, 99),
      misses: num(s.misses, 0, 1e6),
    };
  }
  for (const [id, t] of Object.entries(raw.trivia && typeof raw.trivia === 'object' ? raw.trivia : {})) {
    if (t && typeof t === 'object') p.trivia[id] = { right: num(t.right, 0, 1e6), wrong: num(t.wrong, 0, 1e6) };
  }
  for (const [d, n] of Object.entries(raw.days && typeof raw.days === 'object' ? raw.days : {})) {
    if (isDay(d)) p.days[d] = num(n, 0, 1e4);
  }
  const s = raw.streak && typeof raw.streak === 'object' ? raw.streak : {};
  p.streak = { count: num(s.count, 0, 1e5), best: num(s.best, 0, 1e5), last: isDay(s.last) ? s.last : null, freezes: num(s.freezes, 0, 2) };
  p.stars = num(raw.stars, 0, 1e9);
  p.badges = Array.isArray(raw.badges) ? raw.badges.filter(b => typeof b === 'string') : [];
  p.triviaRight = num(raw.triviaRight, 0, 1e9);
  p.triviaTotal = Math.max(p.triviaRight, num(raw.triviaTotal, 0, 1e9));
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
    // Unreadable save: leave it on disk untouched rather than overwrite it,
    // so there is still something to recover by hand.
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
