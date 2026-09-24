/* Word Kick prizes, in the order they're earned: a star player card, a
   piece of gear, a playable character, then round again. One every 3 wins
   (rules in ../wordpunch/js/rewards.js). Every player here is made up. No
   real players, no real clubs. */

/* Star player cards for the sticker album. `kit` is a KITS id. */
const CARDS = [
  { id: 'c-rosa', name: 'Rocket Rosa', pos: 'Striker', kit: 'brazil', number: 9, skin: '#c68a5a', hair: '#1f1f1f',
    fact: 'Once scored 3 goals in 4 minutes.' },
  { id: 'c-wally', name: 'Big Wall Wally', pos: 'Keeper', kit: 'germany', number: 1, skin: '#f2c894', hair: '#b45309',
    fact: 'Saved 5 penalties in a row. Still talks about it.' },
  { id: 'c-zara', name: 'Zippy Zara', pos: 'Winger', kit: 'argentina', number: 7, skin: '#e0ac7e', hair: '#3a2415',
    fact: 'Fastest player in the league. Ties her boots running.' },
  { id: 'c-kofi', name: 'Captain Kofi', pos: 'Defender', kit: 'nigeria', number: 4, skin: '#6b4226', hair: '#111827',
    fact: 'Ten seasons and never a yellow card.' },
  { id: 'c-hana', name: 'Hat-Trick Hana', pos: 'Midfielder', kit: 'japan', number: 10, skin: '#f5d0b0', hair: '#111827',
    fact: 'Loves a bicycle kick. Mostly lands on her feet.' },
  { id: 'c-diego', name: 'Dizzy Diego', pos: 'Winger', kit: 'mexico', number: 11, skin: '#c68a5a', hair: '#3a2415',
    fact: 'Dribbles in circles until the defenders get dizzy.' },
  { id: 'c-thea', name: 'Thunder Thea', pos: 'Defender', kit: 'england', number: 5, skin: '#f2c894', hair: '#a16207',
    fact: 'Her headers sound like thunder.' },
  { id: 'c-mateo', name: 'Magic Mateo', pos: 'Midfielder', kit: 'spain', number: 8, skin: '#e8b98f', hair: '#1f1f1f',
    fact: 'Passes the ball without even looking.' },
].map(c => ({ ...c, kind: 'card' }));

/* Gear. `slot` decides where it shows up in a match. */
const GEAR = [
  { id: 'g-gold-boots', slot: 'boots', name: 'Golden Boots', color: '#facc15', desc: 'Your striker wears gold boots.' },
  { id: 'g-knee-slide', slot: 'celebration', name: 'Knee Slide', move: 'slide', desc: 'Slide across the grass after you score.' },
  { id: 'g-fire-ball', slot: 'ball', name: 'Fire Ball', fill: '#f97316', patch: '#7f1d1d', desc: 'Kick a blazing orange ball.' },
  { id: 'g-lava-gloves', slot: 'gloves', name: 'Lava Gloves', color: '#ef4444', desc: 'Your keeper wears red-hot gloves.' },
  { id: 'g-backflip', slot: 'celebration', name: 'Backflip', move: 'flip', desc: 'A full backflip after every goal.' },
  { id: 'g-neon-boots', slot: 'boots', name: 'Neon Boots', color: '#a3e635', desc: 'Bright green boots you can see from space.' },
  { id: 'g-gold-ball', slot: 'ball', name: 'Golden Ball', fill: '#facc15', patch: '#92400e', desc: 'Kick a shiny gold ball.' },
  { id: 'g-airplane', slot: 'celebration', name: 'The Airplane', move: 'airplane', desc: 'Arms out, zoom around the pitch.' },
].map(g => ({ ...g, kind: 'gear' }));

/* Playable characters. Pick one in the Prize Room and they take your kicks
   and play in goal, in their own colors. */
const CHARACTERS = [
  { id: 'p-lu', name: 'Lightning Lu', kit: 'italy', number: 11, skin: '#f5d0b0', hair: '#111827',
    desc: 'So fast the ball is still in the air when Lu celebrates.' },
  { id: 'p-gabi', name: 'Golden Boot Gabi', kit: 'portugal', number: 9, skin: '#e0ac7e', hair: '#7a4a24',
    desc: 'Top scorer three years running.' },
  { id: 'p-tomas', name: 'Tiki-Taka Tomas', kit: 'spain', number: 6, skin: '#e8b98f', hair: '#3a2415',
    desc: 'Short passes, big smiles.' },
  { id: 'p-nia', name: 'Nutmeg Nia', kit: 'canada', number: 7, skin: '#8d5a3b', hair: '#111827',
    desc: 'Puts the ball through your legs. Every time.' },
  { id: 'p-sam', name: 'Skyscraper Sam', kit: 'netherlands', number: 5, skin: '#f2c894', hair: '#fde047',
    desc: 'Tallest player anyone has ever seen.' },
  { id: 'p-riley', name: 'Rainbow Flick Riley', kit: 'croatia', number: 10, skin: '#f0c7a0', hair: '#b45309',
    desc: 'Flicks the ball over their own head.' },
  { id: 'p-comet', name: 'Captain Comet', kit: 'usa', number: 14, skin: '#6b4226', hair: '#1f1f1f',
    desc: 'Leads from the front. Shoots from anywhere.' },
  { id: 'p-grace', name: 'Galaxy Grace', kit: 'scotland', number: 99, skin: '#f5d0b0', hair: '#7c3aed',
    desc: 'Purple hair, out-of-this-world shots.' },
].map(p => ({ ...p, kind: 'character' }));

/* Card, gear, character, card, gear, character... */
export const PRIZES = CARDS.flatMap((c, i) => [c, GEAR[i], CHARACTERS[i]]);

export const prizeById = id => PRIZES.find(p => p.id === id) || null;
