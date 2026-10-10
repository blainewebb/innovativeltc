/* Word lists, trucks and every line the game says out loud.
   Shared by the game (index.html) and the recording script (voice/make-voice.mjs),
   so a line added here gets a recorded clip the next time the script runs. */
var MTS = (() => {
'use strict';
const WORDS = [
  ['the', 'in', 'on', 'a', 'I', 'is', 'it', 'up', 'go'],
  ['me', 'my', 'we', 'to', 'and', 'see', 'can', 'no', 'at'],
  ['big', 'run', 'you', 'look', 'stop', 'car', 'mud', 'red', 'jump', 'like', 'here', 'said']
];
// Picture words for quiet mode: see the picture, find the word.
const PIC_WORDS = [
  ['car', '🚗'], ['bus', '🚌'], ['sun', '☀️'], ['dog', '🐶'], ['cat', '🐱'], ['pig', '🐷'], ['hat', '🎩'], ['bed', '🛏️'],
  ['cup', '🥤'], ['bug', '🐛'], ['fox', '🦊'], ['cow', '🐮'], ['egg', '🥚'], ['box', '📦'], ['bat', '🦇'], ['map', '🗺️']
];
// Animals for "what letter does it start with?". Third entry: letters never offered as wrong
// choices because they fit another name for the picture (puppy, kitty, bunny, pony, bird).
const ANIMALS = [
  ['dog', '🐶', 'p'], ['cat', '🐱', 'k'], ['pig', '🐷'], ['cow', '🐮'], ['fox', '🦊'], ['bee', '🐝'], ['owl', '🦉', 'b'],
  ['duck', '🦆', 'b'], ['frog', '🐸'], ['bear', '🐻'], ['lion', '🦁'], ['fish', '🐟'], ['snake', '🐍'], ['zebra', '🦓', 'h'],
  ['monkey', '🐵'], ['tiger', '🐯', 'c'], ['horse', '🐴', 'p'], ['mouse', '🐭', 'r'], ['whale', '🐳', 'f'], ['ant', '🐜', 'b'],
  ['turtle', '🐢'], ['rabbit', '🐰', 'b'], ['penguin', '🐧', 'b'], ['elephant', '🐘']
];
const LETTER = { a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'eff', g: 'jee', h: 'aitch', i: 'eye', j: 'jay', k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'ar', s: 'ess', t: 'tee', u: 'you', v: 'vee', w: 'double you', x: 'ex', y: 'why', z: 'zee' };
const TRUCKS = [
  { name: 'Big Red', body: '#E23B2E', trim: '#FFC61A', deco: 'flames', need: 0 },
  { name: 'Blue Thunder', body: '#2F6FE0', trim: '#FFE14D', deco: 'bolt', need: 1 },
  { name: 'Dino Crusher', body: '#34A853', trim: '#FFFFFF', deco: 'teeth', need: 2 },
  { name: 'Tiger Stripe', body: '#FF8A1F', trim: '#231911', deco: 'stripes', need: 3 },
  { name: 'Purple Rumble', body: '#8A4FD8', trim: '#8EF0FF', deco: 'stars', need: 5 }
];
const PRAISE = ['Yes!', 'You got it!', 'Awesome!', 'Great job!', 'Super smash!', 'Way to go!', 'Nailed it!'];
// Names with recorded cheers. A name typed in settings that isn't here is still used
// by the device voice, but the recorded voice cheers without it.
const NAMES = ['Draper'];
const ORD = ['', 'first', 'second', 'third', 'fourth'];

// Every spoken line. The text is the clip's key; voice/manifest.json maps it to a file.
const LINE = {
  praise: i => PRAISE[i],
  nameCheer: n => `Great job, ${n}!`,
  letsGo: n => n ? `Let's go, ${n}! Answer questions to fill your turbo!` : `Let's go! Answer questions to fill your turbo!`,
  howMany: () => 'How many cars?',
  addQ: (a, b) => `What is ${a} plus ${b}?`,
  bigQ: n => `Find the number ${n}!`,
  letterQ: w => `What letter does... ${w}... start with?`,
  picQ: w => `Which word says... ${w}?`,
  findWord: w => `Find the word... ${w}!`,
  thatsNum: n => `That's ${n}.`,
  thatsLetter: l => `That's ${l.toUpperCase()}.`,
  countTogether: () => "Let's count them together!",
  thatSays: w => `That says... ${w}.`,
  addDone: (a, b) => `${a} plus ${b} is ${a + b}!`,
  carsDone: n => `${n} cars!`,
  letterFor: w => { const l = w[0].toUpperCase(); return `${l}! ${l} is for ${w}!`; },
  spellWord: w => w.length > 1 ? `${w.toUpperCase().split('').join(', ')}... ${w}!` : `${w}!`,
  digits: n => {
    const s = String(n), art = d => d === '8' ? 'an' : 'a';
    return s.length === 2 ? `${art(s[0])} ${s[0]} and ${art(s[1])} ${s[1]} make ${n}!` : `${n}!`;
  },
  num: n => String(n),
  soAdd: (a, b) => `So... ${a} plus ${b} is...?`,
  soCount: () => 'So... how many cars?',
  levelUp: stage => stage === 2 ? 'Level up! Now find the words!' : 'Level up! Now you are reading!',
  stuntTime: () => 'Turbo is full! Stunt time! Tap to jump!',
  didIt: () => 'You did it!',
  raceIntro: () => 'Big race time! Tap tap tap to go fast! Ready?',
  go: () => 'Go!',
  racePlace: p => p === 1 ? "You're in first place!" : `${ORD[p][0].toUpperCase() + ORD[p].slice(1)} place! Tap tap tap!`,
  raceEnd: p => p === 1 ? 'You won the race! First place!' : `You finished in ${ORD[p]} place! Great race!`,
  trophy: () => 'You won a trophy!',
  raceNext: () => 'Next up... the big race!',
  unlocked: name => `You unlocked ${name}!`,
  truckName: name => name,
  countStars: () => "Let's count your stars!",
  talking: () => 'Talking mode!'
};
const MAX_ADD = 10, MAX_BIG = 100, MAX_COUNTED = 60;

function allLines() {
  const out = [];
  const add = s => out.push(s);
  PRAISE.forEach((_, i) => add(LINE.praise(i)));
  NAMES.forEach(n => { add(LINE.nameCheer(n)); add(LINE.letsGo(n)); });
  add(LINE.letsGo('')); add(LINE.howMany()); add(LINE.soCount()); add(LINE.countTogether());
  for (let a = 1; a < MAX_ADD; a++) for (let b = 1; a + b <= MAX_ADD; b++) { add(LINE.addQ(a, b)); add(LINE.addDone(a, b)); add(LINE.soAdd(a, b)); }
  for (let n = 11; n <= MAX_BIG; n++) { add(LINE.bigQ(n)); add(LINE.digits(n)); }
  for (let n = 1; n <= MAX_BIG; n++) add(LINE.thatsNum(n));
  for (let n = 2; n <= 10; n++) add(LINE.carsDone(n));
  for (let n = 1; n <= MAX_COUNTED; n++) add(LINE.num(n));
  ANIMALS.forEach(([w]) => { add(LINE.letterQ(w)); add(LINE.letterFor(w)); });
  Object.keys(LETTER).forEach(l => add(LINE.thatsLetter(l)));
  PIC_WORDS.forEach(([w]) => add(LINE.picQ(w)));
  const allWords = [...new Set([...WORDS.flat(), ...PIC_WORDS.map(p => p[0])])];
  allWords.forEach(w => { add(LINE.findWord(w)); add(LINE.thatSays(w)); add(LINE.spellWord(w)); });
  add(LINE.levelUp(2)); add(LINE.levelUp(3));
  add(LINE.stuntTime()); add(LINE.didIt()); add(LINE.raceIntro()); add(LINE.go());
  for (let p = 1; p <= 4; p++) { add(LINE.racePlace(p)); add(LINE.raceEnd(p)); }
  add(LINE.trophy()); add(LINE.raceNext()); add(LINE.countStars()); add(LINE.talking());
  TRUCKS.forEach(t => { add(LINE.truckName(t.name)); if (t.need > 0) add(LINE.unlocked(t.name)); });
  return [...new Set(out)];
}

// What the recording voice is actually given for a line, when the written text would be misread:
// letter names are spelled out, and the word "a" is said the way kids hear it in a sentence.
const SPOKEN_WORD = { a: 'uh' };
function spokenText(line) {
  const word = w => SPOKEN_WORD[w] || w;
  let m;
  if ((m = line.match(/^That's ([A-Z])\.$/))) return `That's ${LETTER[m[1].toLowerCase()]}.`;
  if ((m = line.match(/^([A-Z])! \1 is for (\w+)!$/))) { const n = LETTER[m[1].toLowerCase()], N = n[0].toUpperCase() + n.slice(1); return `${N}! ${N} is for ${m[2]}!`; }
  if ((m = line.match(/^((?:[A-Z], )*[A-Z])\.\.\. (\w+)!$/))) { const t = m[1].split(', ').map(l => LETTER[l.toLowerCase()]).join(', '); return `${t[0].toUpperCase() + t.slice(1)}... ${word(m[2])}!`; }
  if ((m = line.match(/^(Find the word\.\.\. |That says\.\.\. )(\w+)([.!])$/))) return m[1] + word(m[2]) + m[3];
  if (line === 'a!') return 'Uh!';
  return line;
}

return { WORDS, PIC_WORDS, ANIMALS, LETTER, TRUCKS, PRAISE, NAMES, ORD, LINE, allLines, spokenText };
})();
if (typeof module !== 'undefined') module.exports = MTS;
