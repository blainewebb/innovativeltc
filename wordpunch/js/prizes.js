/* Word Punch prizes, in the order they're earned: a boxer card, a piece of
   gear, a playable boxer, then round again. One every 3 wins (rules in
   rewards.js). Every boxer here is made up. */

/* Trading cards for the album. `look` uses the same fields as FIGHTERS. */
const CARDS = [
  { id: 'c-ivy', name: 'Iron Ivy', from: 'Steel City', record: '30-1', fact: 'Punches so hard the bell rings itself.',
    look: { skin: '#e0ac7e', hair: '#111827', trunks: '#475569', gloves: '#94a3b8', acc: 'none', brow: 'angry' } },
  { id: 'c-pete', name: 'Pillow Fist Pete', from: 'Snoozeville', record: '2-40', fact: 'Softest punches in boxing. Very comfy.',
    look: { skin: '#f2c894', hair: '#b45309', trunks: '#93c5fd', gloves: '#f8fafc', acc: 'beanie', brow: 'worried' } },
  { id: 'c-hattie', name: 'Hurricane Hattie', from: 'Stormport', record: '25-3', fact: 'Spins three times before every punch.',
    look: { skin: '#8d5a3b', hair: '#7c3aed', trunks: '#0ea5e9', gloves: '#38bdf8', acc: 'bow', brow: 'angry' } },
  { id: 'c-jabs', name: 'Sir Jabs-a-Lot', from: 'Castle Knuckle', record: '19-6', fact: 'Bows politely. Then jabs 40 times.',
    look: { skin: '#f5d0b0', hair: '#e5e7eb', trunks: '#1e3a8a', gloves: '#facc15', acc: 'mustache', brow: 'flat' } },
  { id: 'c-mo', name: 'Mighty Mo', from: 'Muscle Beach', record: '22-2', fact: 'Lifts the ring ropes for warm-up.',
    look: { skin: '#6b4226', hair: '#111827', trunks: '#dc2626', gloves: '#111827', acc: 'cap', brow: 'angry' } },
  { id: 'c-bea', name: 'Bouncy Bea', from: 'Springfield Heights', record: '17-4', fact: 'Never stops bouncing. Not even to eat.',
    look: { skin: '#f0c7a0', hair: '#f59e0b', trunks: '#ec4899', gloves: '#a3e635', acc: 'none', brow: 'flat' } },
  { id: 'c-tank', name: 'Tank Tucker', from: 'Big Rock', record: '28-5', fact: 'Has never once been knocked down.',
    look: { skin: '#c68a5a', hair: '#3a2415', trunks: '#15803d', gloves: '#b91c1c', acc: 'none', brow: 'angry' } },
  { id: 'c-gran', name: 'Grandma Gloves', from: 'Cookie Lane', record: '51-0', fact: 'Undefeated for 50 years. Bakes after every fight.',
    look: { skin: '#f5d0b0', hair: '#e5e7eb', trunks: '#a855f7', gloves: '#f472b6', acc: 'glasses', brow: 'flat' } },
].map(c => ({ ...c, kind: 'card' }));

/* Gear. gloves = special gloves (beats your glove color), ropes = the ring,
   celebration = what you do after a knockout. */
const GEAR = [
  { id: 'g-gold-gloves', slot: 'gloves', name: 'Golden Gloves', a: '#fde047', b: '#ca8a04', desc: 'Shiny gold gloves.' },
  { id: 'g-victory-dance', slot: 'celebration', name: 'Victory Dance', move: 'dance', desc: 'Dance around the ring after a knockout.' },
  { id: 'g-neon-ropes', slot: 'ropes', name: 'Neon Ropes', a: '#22d3ee', b: '#a3e635', desc: 'Glowing ring ropes.' },
  { id: 'g-flame-gloves', slot: 'gloves', name: 'Flame Gloves', a: '#fde047', b: '#dc2626', desc: 'Gloves on fire (not really).' },
  { id: 'g-glove-spin', slot: 'celebration', name: 'Glove Spin', move: 'spin', desc: 'Spin your gloves in the air.' },
  { id: 'g-gold-ropes', slot: 'ropes', name: 'Gold Ropes', a: '#facc15', b: '#fef3c7', desc: 'A champion\'s ring.' },
  { id: 'g-galaxy-gloves', slot: 'gloves', name: 'Galaxy Gloves', a: '#6366f1', b: '#0f172a', desc: 'Purple gloves full of stars.' },
  { id: 'g-flex', slot: 'celebration', name: 'The Flex', move: 'flex', desc: 'Gloves up, show those muscles.' },
].map(g => ({ ...g, kind: 'gear' }));

/* Playable boxers. Pick one in the Prize Room and they box for you: their
   look, their gloves, their name on the scoreboard. `hat` is what shows from
   behind: none, headband, mohawk, bun, crown, beanie. */
const CHARACTERS = [
  { id: 'p-comet', name: 'Kid Comet', gloves: '#f97316', desc: 'Punches so fast they leave a tail.',
    look: { skin: '#e8b98f', hair: '#3b2314', hat: 'headband', band: '#ef4444' } },
  { id: 'p-lightning', name: 'Lady Lightning', gloves: '#facc15', desc: 'Strikes twice in the same place.',
    look: { skin: '#8d5a3b', hair: '#111827', hat: 'bun', band: '#facc15' } },
  { id: 'p-bear', name: 'Big Bear Barnes', gloves: '#78350f', desc: 'Gentle giant. Huge hugs, huger hooks.',
    look: { skin: '#f2c894', hair: '#78350f', hat: 'beanie', band: '#b45309' } },
  { id: 'p-flash', name: 'Flash Flores', gloves: '#22c55e', desc: 'Dodges before you even swing.',
    look: { skin: '#c68a5a', hair: '#1f1f1f', hat: 'mohawk', band: '#22c55e' } },
  { id: 'p-duchess', name: 'Duchess Dynamite', gloves: '#ec4899', desc: 'Royal manners. Explosive uppercuts.',
    look: { skin: '#f5d0b0', hair: '#b45309', hat: 'crown', band: '#facc15' } },
  { id: 'p-ninja', name: 'Ninja Nate', gloves: '#111827', desc: 'Silent footwork. Sneaky jabs.',
    look: { skin: '#e0ac7e', hair: '#111827', hat: 'headband', band: '#111827' } },
  { id: 'p-cannon', name: 'Captain Cannonball', gloves: '#1d4ed8', desc: 'Every punch is a cannon shot.',
    look: { skin: '#6b4226', hair: '#111827', hat: 'none', band: '#1d4ed8' } },
  { id: 'p-tia', name: 'Tornado Tia', gloves: '#06b6d4', desc: 'Whirls around the ring like a storm.',
    look: { skin: '#f0c7a0', hair: '#7c3aed', hat: 'mohawk', band: '#06b6d4' } },
].map(p => ({ ...p, kind: 'character' }));

/* Card, gear, character, card, gear, character... */
export const PRIZES = CARDS.flatMap((c, i) => [c, GEAR[i], CHARACTERS[i]]);

export const prizeById = id => PRIZES.find(p => p.id === id) || null;
