/* Runebreaker — profiles and persistence. One device, several kids.
   Everything stays in localStorage. Nothing is sent anywhere. */

import { blankMastery } from './engine.js';

const KEY = 'runebreaker.v1';

const EMPTY = { profiles: [], activeId: null, settings: { sound: true } };

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const data = JSON.parse(raw);
    return { ...structuredClone(EMPTY), ...data };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota or private mode */ }
}

export function newProfile(name, avatar) {
  return {
    id: `p${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name,
    avatar,
    created: Date.now(),
    mastery: blankMastery(),
    meta: { startRunes: [], bonusHp: 0, xp: 0, unlockedRelics: [] },
    records: { deepest: 0, runs: 0, bossesFelled: 0, wins: 0, bestEndless: 0 },
    /* One entry per day the kid played: { date:'YYYY-MM-DD', ms, correct, wrong } */
    days: [],
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
