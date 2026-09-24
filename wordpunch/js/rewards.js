/* Prizes, shared by Word Punch and Word Kick. Pure logic, no DOM. Each game
   passes in its own prize list; this file only decides when one is earned
   and what is switched on.

   The rules:
   - Every 3 wins earns the next prize. Losses never take progress away.
   - Only wins at the kid's own grade or higher count, so replaying an easy
     grade can't farm prizes.
   - Prizes come in the order the game lists them (card, gear, character,
     card, ...), so every kid sees every kind early.

   A prize is { id, kind: 'card' | 'gear' | 'character', slot? } plus
   whatever the game needs to draw it. Gear has a `slot` (boots, ball,
   gloves, celebration...). One gear item per slot and one character can be
   switched on at a time. Cards are just collected. */

export const WINS_PER_PRIZE = 3;

export function newRewards() {
  return { wins: 0, earned: [], equip: {} };
}

const slotOf = prize => (prize.kind === 'character' ? 'character' : prize.kind === 'gear' ? prize.slot : null);

/* Clean up whatever came out of localStorage: unknown prizes dropped, and
   nothing switched on that hasn't been earned or is in the wrong slot. */
export function hydrateRewards(raw, prizes) {
  const r = newRewards();
  if (!raw || typeof raw !== 'object') return r;
  r.wins = Math.max(0, Math.floor(Number(raw.wins) || 0));
  const known = new Set(prizes.map(p => p.id));
  if (Array.isArray(raw.earned)) {
    for (const id of raw.earned) if (known.has(id) && !r.earned.includes(id)) r.earned.push(id);
  }
  if (raw.equip && typeof raw.equip === 'object') {
    for (const [slot, id] of Object.entries(raw.equip)) {
      const p = prizes.find(x => x.id === id);
      if (p && r.earned.includes(id) && slotOf(p) === slot) r.equip[slot] = id;
    }
  }
  return r;
}

export const winCounts = (profile, grade) => grade >= profile.grade;

/* Call after a win. Returns { counted, prize } where prize is the one just
   earned, or null. */
export function recordWin(profile, grade, prizes) {
  const r = profile.rewards || (profile.rewards = newRewards());
  if (!winCounts(profile, grade)) return { counted: false, prize: null };
  r.wins++;
  let prize = null;
  if (r.earned.length < Math.floor(r.wins / WINS_PER_PRIZE)) {
    prize = prizes.find(p => !r.earned.includes(p.id)) || null;
    if (prize) r.earned.push(prize.id);
  }
  return { counted: true, prize };
}

/* Wins still needed for the next prize, or null once everything is earned. */
export function winsToNext(profile, prizes) {
  const r = profile.rewards || newRewards();
  if (r.earned.length >= prizes.length) return null;
  return WINS_PER_PRIZE - (r.wins % WINS_PER_PRIZE);
}

export const hasPrize = (profile, id) => !!profile.rewards?.earned.includes(id);

/* Switch a character or gear on; tapping the one already on switches it off. */
export function toggleEquip(profile, prize) {
  const slot = slotOf(prize);
  if (!slot || !hasPrize(profile, prize.id)) return false;
  const eq = profile.rewards.equip;
  if (eq[slot] === prize.id) delete eq[slot];
  else eq[slot] = prize.id;
  return true;
}

/* The prize switched on in a slot, or null. */
export function equipped(profile, prizes, slot) {
  const id = profile.rewards?.equip?.[slot];
  return id ? prizes.find(p => p.id === id) || null : null;
}
