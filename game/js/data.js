/* Runebreaker — static content: skills, enemies, relics, riddles.
   Pure data + small pure helpers. No DOM, no storage. */

/* ---------------------------------------------------------------- skills --
   Every arithmetic attempt the player makes is classified into one of these.
   The report card and the adaptive hand generator both read off this list. */
/* Shown on the picker so "is this the new version?" is a thing you read
   rather than infer from which buttons exist. Bump it with any change worth
   telling a device about, alongside CACHE in sw.js. */
export const VERSION = '2026-09-22.3';

export const SKILLS = [
  { id: 'add_small',  label: 'Adding to 20',        op: '+', tier: 1 },
  { id: 'sub_small',  label: 'Subtracting within 20', op: '-', tier: 1 },
  { id: 'add_big',    label: 'Adding bigger numbers', op: '+', tier: 2 },
  { id: 'sub_big',    label: 'Subtracting bigger numbers', op: '-', tier: 2 },
  { id: 'mult_easy',  label: 'Times tables 2-5',    op: '*', tier: 2 },
  { id: 'mult_hard',  label: 'Times tables 6-12',   op: '*', tier: 3 },
  { id: 'div_easy',   label: 'Dividing by 2-5',     op: '/', tier: 3 },
  { id: 'div_hard',   label: 'Dividing by 6-12',    op: '/', tier: 4 },
  /* `slow: true` marks work that SHOULD take longer. Scoring a word problem
     against a recall-speed clock would mark careful reading as weakness. */
  { id: 'word_1step', label: 'One-step word problems', op: null, tier: 2, slow: true },
  { id: 'word_2step', label: 'Two-step word problems', op: null, tier: 3, slow: true },
  { id: 'place_est',  label: 'Place value & estimating', op: null, tier: 3, slow: true },

  /* Middle school. These do not fit "pick two tiles and combine them": there
     is nothing to pick in "what is 15% of 60". They are asked on drill turns
     and at riddle shrines instead, where the game sets the problem. The two
     that DO fit the tiles, integers and exponents, carry an operator. */
  { id: 'fractions',  label: 'Fractions',                op: null, tier: 5, slow: true },
  { id: 'decimals',   label: 'Decimals',                 op: null, tier: 5 },
  { id: 'percent',    label: 'Percentages',              op: null, tier: 5, slow: true },
  { id: 'ratio',      label: 'Ratios & proportions',     op: null, tier: 6, slow: true },
  { id: 'integers',   label: 'Negative numbers',         op: null, tier: 5 },
  { id: 'order_ops',  label: 'Order of operations',      op: null, tier: 6, slow: true },
  { id: 'exponents',  label: 'Powers & roots',           op: '^',  tier: 6 },
  { id: 'solve_x',    label: 'Solving for x',            op: null, tier: 7, slow: true },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]));

/* ---------------------------------------------------------------- grade --
   A starting point only. Asked once when a hero is made, because a brand new
   profile has no evidence and would otherwise put a fourth grader through
   single-digit addition for their first three runs. It is asked as a US grade
   rather than an age on purpose: two eight year olds can be two years apart
   on times tables, so age predicts very little. Its influence decays as real
   answers arrive, so a wrong guess corrects itself. */
export const GRADES = [
  { id: 1, label: '1st grade', hint: 'Adding and taking away small numbers', level: 1, ops: ['+', '-'] },
  { id: 2, label: '2nd grade', hint: 'Adding and subtracting to 100', level: 2, ops: ['+', '-'] },
  { id: 3, label: '3rd grade', hint: 'Starting times tables', level: 3, ops: ['+', '-', '*'] },
  { id: 4, label: '4th grade', hint: 'Times tables and division', level: 4, ops: ['+', '-', '*', '/'] },
  { id: 5, label: '5th grade', hint: 'Fractions, decimals, multi-step', level: 5, ops: ['+', '-', '*', '/'] },
  { id: 6, label: '6th grade', hint: 'Percentages, ratios, negatives', level: 6, ops: ['+', '-', '*', '/'] },
  { id: 7, label: '7th grade', hint: 'Proportions, powers, order of operations', level: 7, ops: ['+', '-', '*', '/', '^'] },
  { id: 8, label: '8th grade', hint: 'Solving for x, roots, harder ratios', level: 8, ops: ['+', '-', '*', '/', '^'] },
];

export const GRADE_BY_ID = Object.fromEntries(GRADES.map(g => [g.id, g]));

/** Which skill does this concrete calculation exercise? */
export function classify(a, op, b) {
  if (op === '+') return (a <= 10 && b <= 10) ? 'add_small' : 'add_big';
  if (op === '-') return (a <= 20 && b <= 10) ? 'sub_small' : 'sub_big';
  if (op === '*') return (Math.max(a, b) <= 5) ? 'mult_easy' : 'mult_hard';
  if (op === '/') return (b <= 5) ? 'div_easy' : 'div_hard';
  if (op === '^') return 'exponents';
  return 'add_small';
}

/** Stable key for one arithmetic fact, so "7 x 8" and "8 x 7" are the same fact. */
export function factKey(a, op, b) {
  if (op === '+' || op === '*') {
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return `${lo}${op}${hi}`;
  }
  return `${a}${op}${b}`;
}

/* ----------------------------------------------------------------- runes --
   Operator runes. The player starts a run with + and -, and finds the rest. */
export const RUNES = {
  '+': { id: '+', name: 'Rune of Joining', glyph: '+' },
  '-': { id: '-', name: 'Rune of Taking',  glyph: '−' },
  '*': { id: '*', name: 'Rune of Stacking', glyph: '×' },
  '/': { id: '/', name: 'Rune of Splitting', glyph: '÷' },
  '^': { id: '^', name: 'Rune of Raising', glyph: '^' },
};

/* --------------------------------------------------------------- wards ----
   A ward is the enemy's weakness: results matching it deal bonus damage.
   Shown to the player in plain words. This is what stops "always multiply
   the two biggest tiles" from being the right answer every turn. */
export const WARDS = {
  none:    { id: 'none',    label: 'No ward',                    mult: 1,   test: () => false },
  even:    { id: 'even',    label: 'Even numbers hit DOUBLE',    mult: 2,   test: n => n % 2 === 0 },
  odd:     { id: 'odd',     label: 'Odd numbers hit DOUBLE',     mult: 2,   test: n => n % 2 === 1 },
  five:    { id: 'five',    label: 'Multiples of 5 hit DOUBLE',  mult: 2,   test: n => n % 5 === 0 },
  three:   { id: 'three',   label: 'Multiples of 3 hit DOUBLE',  mult: 2,   test: n => n % 3 === 0 },
  ten:     { id: 'ten',     label: 'Multiples of 10 hit TRIPLE', mult: 3,   test: n => n % 10 === 0 },
  twoDigit:{ id: 'twoDigit',label: 'Two-digit results hit x1.5', mult: 1.5, test: n => n >= 10 && n <= 99 },
  small:   { id: 'small',   label: 'Results under 10 hit TRIPLE',mult: 3,   test: n => n < 10 },
  square:  { id: 'square',  label: 'Square numbers hit TRIPLE',  mult: 3,   test: n => Number.isInteger(Math.sqrt(n)) },
};

/* ------------------------------------------------------------ resists ----
   A ward rewards a matching number. A resist PUNISHES the obvious one. Without
   these, "multiply the two biggest tiles" is the right answer four turns in
   five once a kid unlocks x, and the thinking disappears. The threshold is set
   at spawn as a share of what the player can currently hit for, so it stays
   meaningful whether they are adding to 20 or multiplying twelves. */
export const RESISTS = {
  none:  { id: 'none',  share: 0,    label: () => '',                                    apply: () => 1 },
  /* `over` is the important one. The threshold sits ABOVE the penalty, so the
     best play is the largest result that stays under it: real estimation work,
     and the naive maximum genuinely loses. A gentler penalty than the
     threshold would make overshooting correct anyway, which is the trap. */
  over:  { id: 'over',  share: 0.70, label: n => `Results over ${n} barely scratch it`,   apply: (r, n) => (r > n ? 0.5 : 1) },
  under: { id: 'under', share: 0.30, label: n => `Results under ${n} are HALVED`,         apply: (r, n) => (r < n ? 0.5 : 1) },
  cap:   { id: 'cap',   share: 0.55, label: n => `Damage is CAPPED at ${n}`,              apply: () => 1, cap: true },
};

/* --------------------------------------------------------------- enemies --
   Templates carry flavour and shape only. Concrete health, armor and damage
   are worked out at spawn time from the player's own damage ceiling, so a
   fight is always about 3-5 turns whether the kid is adding single digits or
   multiplying twelves. Hand-written hp numbers cannot do that.

   hpW       relative toughness (1 = the standard 3-5 turn fight)
   armorFrac armor as a share of the player's best realistic hit
   intents   the telegraphed move cycle; `w` weights an attack's damage
*/
export const ENEMIES = [
  { id: 'slime', name: 'Digit Slime', art: '\u{1F7E2}', tier: 1,
    hpW: 0.85, armorFrac: 0, ward: ['none', 'even'], resist: ['none', 'none', 'under'],
    intents: [{ type: 'attack', w: 0.9 }, { type: 'attack', w: 1.1 }] },

  { id: 'bat', name: 'Tally Bat', art: '\u{1F987}', tier: 1,
    hpW: 0.7, armorFrac: 0, ward: ['odd', 'small'], resist: ['none', 'over'],
    intents: [{ type: 'attack', w: 0.7 }, { type: 'jam' }, { type: 'attack', w: 0.9 }] },

  { id: 'golem', name: 'Abacus Golem', art: '\u{1F5FF}', tier: 2,
    hpW: 1.15, armorFrac: 0.22, ward: ['five', 'ten'], resist: ['over', 'cap'],
    intents: [{ type: 'attack', w: 1 }, { type: 'armorUp' }, { type: 'attack', w: 1.2 }] },

  { id: 'wisp', name: 'Carry Wisp', art: '\u2728', tier: 2,
    hpW: 0.9, armorFrac: 0.08, ward: ['three', 'twoDigit'], resist: ['over', 'none'],
    intents: [{ type: 'attack', w: 0.9 }, { type: 'heal' }] },

  { id: 'knight', name: 'Remainder Knight', art: '\u{1F6E1}\uFE0F', tier: 3,
    hpW: 1.2, armorFrac: 0.3, ward: ['square', 'ten'], resist: ['cap', 'over'],
    intents: [{ type: 'attack', w: 1 }, { type: 'shield' }, { type: 'bigAttack', w: 1.8 }] },

  { id: 'hydra', name: 'Fraction Hydra', art: '\u{1F409}', tier: 3,
    hpW: 1.3, armorFrac: 0.15, ward: ['even', 'five'], resist: ['over', 'under'],
    intents: [{ type: 'attack', w: 1 }, { type: 'jam' }, { type: 'bigAttack', w: 1.6 }] },
];

export const BOSSES = [
  { id: 'king', name: 'The Number King', art: '\u{1F451}', boss: true,
    hpW: 1, armorFrac: 0.28, ward: ['ten', 'square'], resist: ['cap', 'over'],
    intents: [{ type: 'attack', w: 1 }, { type: 'shield' }, { type: 'armorUp' }, { type: 'bigAttack', w: 1.7 }] },
  { id: 'scribe', name: 'The Zero Scribe', art: '\u{1F4DC}', boss: true,
    hpW: 1, armorFrac: 0.2, ward: ['odd', 'three'], resist: ['over', 'cap'],
    intents: [{ type: 'jam' }, { type: 'attack', w: 1.1 }, { type: 'shield' }, { type: 'bigAttack', w: 1.6 }] },
];

/* ---------------------------------------------------------------- relics --
   Run-scoped items. `hooks` are read by the battle engine.
   Kept deliberately arithmetic-flavoured so the reward still points at math. */
export const RELICS = [
  { id: 'abacus',   name: 'Sharp Abacus',    art: '\u{1F9EE}', text: 'Every hit deals +3 damage.',            flat: 3 },
  { id: 'evenblade',name: 'Even Blade',      art: '⚔️', text: 'Even results deal +50%.',             pctIf: n => n % 2 === 0, pct: 0.5 },
  { id: 'oddcharm', name: 'Odd Charm',       art: '\u{1F9FF}', text: 'Odd results deal +50%.',                pctIf: n => n % 2 === 1, pct: 0.5 },
  { id: 'roundstone',name:'Round Stone',     art: '⚪', text: 'Results ending in 0 deal +100%.',          pctIf: n => n % 10 === 0, pct: 1 },
  { id: 'sixthtile',name: 'Sixth Tile',      art: '\u{1F0CF}', text: 'Draw one extra tile.',                   handBonus: 1 },
  { id: 'patience', name: 'Patience Stone',  art: '\u{1F422}', text: 'Correct answers that took over 6s deal +6.', slowBonus: 6 },
  { id: 'speedsigil',name:'Speed Sigil',     art: '⚡', text: 'Correct answers under 4s deal +40%.',      fastPct: 0.4 },
  { id: 'ironskin', name: 'Iron Skin',       art: '\u{1F6E1}️', text: 'Take 2 less damage from every hit.', block: 2 },
  { id: 'secondwind',name:'Second Wind',     art: '\u{1F4A8}', text: 'Heal 6 after every battle.',             healAfter: 6 },
  { id: 'mercy',    name: 'Mercy Rune',      art: '\u{1F54A}️', text: 'Your first wrong answer each battle is free.', mercy: true },
  { id: 'chain',    name: 'Chain Rune',      art: '⛓️', text: 'Your combo bonus counts double.',      comboX2: true },
  { id: 'doubler',  name: 'Opening Gambit',  art: '\u{1F3AF}', text: 'Your first hit each battle is doubled.',  firstHitX2: true },
  { id: 'borrower', name: "Borrower's Coin", art: '\u{1FA99}', text: 'Subtraction results deal +7.',           opBonus: { '-': 7 } },
  { id: 'splitter', name: "Splitter's Edge", art: '\u{1FA93}', text: 'Division results deal +12.',             opBonus: { '/': 12 } },
  { id: 'stacker',  name: "Stacker's Grip",  art: '\u{1F4DA}', text: 'Multiplication results deal +4.',        opBonus: { '*': 4 } },
  { id: 'bighands', name: 'Big Hands',       art: '\u{1F44F}', text: 'One extra reshuffle each battle.',        reshuffleBonus: 1 },
  { id: 'goldtooth',name: 'Gold Tooth',      art: '\u{1F48E}', text: 'Earn +8 gold per battle.',               goldBonus: 8 },
  { id: 'scholar',  name: "Scholar's Quill", art: '\u{1F58B}️', text: 'Riddles heal you for 8 when solved.', riddleHeal: 8 },
];

export const RELIC_BY_ID = Object.fromEntries(RELICS.map(r => [r.id, r]));

/* --------------------------------------------------------------- riddles --
   Word-problem templates. Each returns { text, answer, skill }.
   rng is a function returning a float in [0,1) so runs can be reproduced. */
const NAMES = ['Max', 'Leo', 'Sam', 'Ava', 'Nate', 'Ruby', 'Theo', 'Jonah', 'Cora', 'Finn'];
const THINGS = ['dragon eggs', 'gold coins', 'arrows', 'apples', 'marbles', 'trading cards', 'stickers'];

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }

/* A ratio is written in simplest form or it is not really a ratio. 3:12 is
   arithmetically fine and reads like a mistake. */
function coprimePair(rng, lo, hi) {
  let a = ri(rng, lo, hi), b = ri(rng, lo, hi);
  let guard = 0;
  while ((gcd(a, b) !== 1 || a === b) && guard++ < 40) {
    a = ri(rng, lo, hi);
    b = ri(rng, lo, hi);
  }
  return gcd(a, b) === 1 && a !== b ? [a, b] : [2, 3];
}

/** A fraction in simplest form, or a plain number when it divides evenly. */
export function simplifyFraction(n, d) {
  const g = gcd(n, d);
  const num = n / g, den = d / g;
  return den === 1 ? num : { n: num, d: den };
}

/* ------------------------------------------------------ asked problems ----
   Middle school topics that the tile mechanic cannot express: there is
   nothing to pick in "what is 15% of 60". Each generator returns a prompt and
   an answer, and the answer may be a fraction as { n, d }. These are served on
   drill turns, where the game sets the problem and the player types a reply.
   Percentages and ratios carry the most variants because they are the most
   used, in school and out of it. */
const NICE_PERCENTS = [5, 10, 20, 25, 40, 50, 60, 75, 80];

export const ASKED = {
  percent: [
    rng => { const p = pick(rng, NICE_PERCENTS), base = ri(rng, 2, 20) * 10;
      return { prompt: `What is ${p}% of ${base}?`, answer: base * p / 100 }; },
    rng => { const p = pick(rng, [10, 20, 25, 50]), base = ri(rng, 2, 12) * 4;
      return { prompt: `A sword costs ${base} gold and is ${p}% off. What do you pay?`, answer: base - base * p / 100 }; },
    rng => { const part = ri(rng, 1, 9), whole = part * ri(rng, 2, 5);
      return { prompt: `${part} out of ${whole}. What percent is that?`, answer: Math.round(part / whole * 100) }; },
    rng => { const p = pick(rng, [10, 20, 25, 50]), base = ri(rng, 2, 12) * 10;
      return { prompt: `A hoard of ${base} gold grows by ${p}%. How much is there now?`, answer: base + base * p / 100 }; },
    rng => { const whole = ri(rng, 2, 9) * 10, p = pick(rng, [10, 20, 50]);
      return { prompt: `${whole * p / 100} is ${p}% of what number?`, answer: whole }; },
  ],

  ratio: [
    rng => { const n = ri(rng, 2, 6), cost = n * ri(rng, 2, 9), m = n + ri(rng, 1, 4);
      return { prompt: `${n} potions cost ${cost} gold. How much do ${m} cost?`, answer: cost / n * m }; },
    rng => { const [a, b] = coprimePair(rng, 2, 9), k = ri(rng, 2, 6);
      return { prompt: `The ratio of orcs to goblins is ${a}:${b}. If there are ${a * k} orcs, how many goblins?`, answer: b * k }; },
    rng => { const hours = ri(rng, 2, 8), rate = ri(rng, 10, 60);
      return { prompt: `A dragon flies ${rate * hours} miles in ${hours} hours. How many miles per hour?`, answer: rate }; },
    rng => { const per = ri(rng, 3, 9), packs = ri(rng, 3, 8);
      return { prompt: `Arrows come ${per} to a bundle. How many bundles for ${per * packs} arrows?`, answer: packs }; },
    rng => { const [a, b] = coprimePair(rng, 1, 6), total = (a + b) * ri(rng, 2, 6);
      return { prompt: `Treasure is split ${a}:${b} between two heroes. If there are ${total} gems, how many does the FIRST hero get?`, answer: total * a / (a + b) }; },
  ],

  fractions: [
    rng => { const d2 = pick(rng, [2, 4, 8]), n1 = 1, n2 = 1;
      const lo = Math.max(2, d2 / 2);
      return { prompt: `${n1}/${lo} + ${n2}/${d2} = ?`, answer: simplifyFraction(n1 * d2 + n2 * lo, lo * d2) }; },
    rng => { const d2 = pick(rng, [2, 3, 4, 5]), each = ri(rng, 2, 9);
      return { prompt: `What is 1/${d2} of ${d2 * each}?`, answer: each }; },
    rng => { // Built from an already-simplest fraction, then scaled up.
      let n = ri(rng, 1, 5), d2 = ri(rng, 2, 6);
      while (gcd(n, d2) !== 1 || n >= d2) { n = ri(rng, 1, 5); d2 = ri(rng, 2, 6); }
      const k = ri(rng, 2, 5);
      return { prompt: `Simplify ${n * k}/${d2 * k}. Answer as a fraction.`, answer: { n, d: d2 } }; },
    rng => { const d2 = pick(rng, [2, 4, 5, 10]), n = ri(rng, 1, d2 - 1);
      return { prompt: `Write ${n}/${d2} as a decimal.`, answer: n / d2 }; },
    rng => { const parts = pick(rng, [3, 4, 5, 6]), each = ri(rng, 2, 8), taken = ri(rng, 1, parts - 1);
      return { prompt: `A bag holds ${parts * each} coins. You take ${taken}/${parts} of them. How many?`, answer: each * taken }; },
  ],

  decimals: [
    rng => { const a = ri(rng, 1, 9) / 10, b = ri(rng, 1, 9) / 10;
      return { prompt: `${a} + ${b} = ?`, answer: Math.round((a + b) * 10) / 10 }; },
    rng => { const a = ri(rng, 11, 99) / 10, b = ri(rng, 2, 9);
      return { prompt: `${a} \u00d7 ${b} = ?`, answer: Math.round(a * b * 10) / 10 }; },
    rng => { const whole = ri(rng, 2, 9), tenths = ri(rng, 1, 9);
      return { prompt: `${whole}.${tenths} \u2212 ${whole} = ?`, answer: tenths / 10 }; },
    rng => { const a = ri(rng, 2, 9) * 10, b = ri(rng, 2, 8);
      return { prompt: `${a} \u00f7 ${b * 10} = ?`, answer: Math.round(a / (b * 10) * 100) / 100 }; },
  ],

  integers: [
    rng => { const a = ri(rng, 2, 15), b = ri(rng, a + 1, a + 15);
      return { prompt: `${a} \u2212 ${b} = ?`, answer: a - b }; },
    rng => { const a = ri(rng, 2, 15), b = ri(rng, 2, 20);
      return { prompt: `\u2212${a} + ${b} = ?`, answer: b - a }; },
    rng => { const a = ri(rng, 2, 9), b = ri(rng, 2, 9);
      return { prompt: `\u2212${a} \u00d7 ${b} = ?`, answer: -a * b }; },
    rng => { const a = ri(rng, 2, 9), b = ri(rng, 2, 9);
      return { prompt: `\u2212${a} \u00d7 \u2212${b} = ?`, answer: a * b }; },
    rng => { const a = ri(rng, 2, 12), b = ri(rng, 2, 12);
      return { prompt: `\u2212${a} \u2212 ${b} = ?`, answer: -a - b }; },
  ],

  order_ops: [
    rng => { const a = ri(rng, 2, 9), b = ri(rng, 2, 9), c = ri(rng, 2, 9);
      return { prompt: `${a} + ${b} \u00d7 ${c} = ?`, answer: a + b * c }; },
    rng => { const a = ri(rng, 2, 9), b = ri(rng, 2, 9), c = ri(rng, 2, 9);
      return { prompt: `(${a} + ${b}) \u00d7 ${c} = ?`, answer: (a + b) * c }; },
    rng => { const b = ri(rng, 2, 6), c = b * ri(rng, 2, 6), a = ri(rng, 20, 60);
      return { prompt: `${a} \u2212 ${c} \u00f7 ${b} = ?`, answer: a - c / b }; },
    rng => { const a = ri(rng, 2, 9), b = ri(rng, 2, 9), c = ri(rng, 2, 5);
      return { prompt: `${a} \u00d7 ${b} \u2212 ${c} \u00d7 ${b} = ?`, answer: a * b - c * b }; },
  ],

  exponents: [
    rng => { const a = ri(rng, 2, 12); return { prompt: `${a}\u00b2 = ?`, answer: a * a }; },
    rng => { const a = ri(rng, 2, 7); return { prompt: `${a}\u00b3 = ?`, answer: a * a * a }; },
    rng => { const a = ri(rng, 2, 15); return { prompt: `\u221a${a * a} = ?`, answer: a }; },
    rng => { const a = ri(rng, 2, 9); return { prompt: `${a}\u00b2 + ${a} = ?`, answer: a * a + a }; },
  ],

  solve_x: [
    rng => { const x = ri(rng, 2, 12), m = ri(rng, 2, 9), c = ri(rng, 1, 20);
      return { prompt: `${m}x + ${c} = ${m * x + c}. What is x?`, answer: x }; },
    rng => { const x = ri(rng, 2, 12), d2 = ri(rng, 2, 6);
      return { prompt: `x \u00f7 ${d2} = ${x}. What is x?`, answer: x * d2 }; },
    rng => { const x = ri(rng, 2, 15), m = ri(rng, 2, 9);
      return { prompt: `${m}x = ${m * x}. What is x?`, answer: x }; },
    rng => { const x = ri(rng, 3, 15), c = ri(rng, 1, 10);
      return { prompt: `x \u2212 ${c} = ${x - c}. What is x?`, answer: x }; },
    rng => { const x = ri(rng, 2, 10), m = ri(rng, 2, 6), c = ri(rng, 1, 9);
      return { prompt: `${m}(x + ${c}) = ${m * (x + c)}. What is x?`, answer: x }; },
  ],
};

export const ASKED_SKILLS = Object.keys(ASKED);

export const RIDDLES = [
  { id: 'total_cost', skill: 'word_1step', tier: 2, make: rng => {
      const n = ri(rng, 3, 9), price = ri(rng, 2, 9), who = pick(rng, NAMES), thing = pick(rng, THINGS);
      return { text: `${who} buys ${n} ${thing}. Each one costs ${price} gold. How much gold does ${who} spend?`, answer: n * price };
    } },
  { id: 'share_equal', skill: 'word_1step', tier: 2, make: rng => {
      const g = ri(rng, 2, 6), each = ri(rng, 3, 9), who = pick(rng, NAMES), thing = pick(rng, THINGS);
      return { text: `${who} shares ${g * each} ${thing} equally between ${g} friends. How many does each friend get?`, answer: each };
    } },
  { id: 'change', skill: 'word_1step', tier: 2, make: rng => {
      const paid = ri(rng, 5, 10) * 10, cost = ri(rng, 12, 48), who = pick(rng, NAMES);
      return { text: `${who} pays ${paid} gold for a sword that costs ${cost} gold. How much change comes back?`, answer: paid - cost };
    } },
  { id: 'more_than', skill: 'word_1step', tier: 2, make: rng => {
      const a = ri(rng, 12, 40), d = ri(rng, 5, 25), n1 = pick(rng, NAMES);
      let n2 = pick(rng, NAMES); while (n2 === n1) n2 = pick(rng, NAMES);
      return { text: `${n1} has ${a} gold. ${n2} has ${d} more than ${n1}. How much gold does ${n2} have?`, answer: a + d };
    } },
  { id: 'rows', skill: 'word_1step', tier: 2, make: rng => {
      const r = ri(rng, 3, 8), c = ri(rng, 3, 9);
      return { text: `A dungeon floor has ${r} rows of tiles with ${c} tiles in each row. How many tiles are on the floor?`, answer: r * c };
    } },
  { id: 'left_over', skill: 'word_2step', tier: 3, make: rng => {
      const n = ri(rng, 4, 9), price = ri(rng, 3, 8), who = pick(rng, NAMES);
      const spend = n * price;
      const start = spend + ri(rng, 6, 40); // always leaves something, never goes negative
      return { text: `${who} starts with ${start} gold and buys ${n} potions at ${price} gold each. How much gold is left?`, answer: start - spend };
    } },
  { id: 'two_groups', skill: 'word_2step', tier: 3, make: rng => {
      const a = ri(rng, 2, 6), b = ri(rng, 2, 6), each = ri(rng, 3, 9);
      return { text: `${a} goblins and ${b} trolls each carry ${each} coins. How many coins do they carry altogether?`, answer: (a + b) * each };
    } },
  { id: 'split_after', skill: 'word_2step', tier: 3, make: rng => {
      const g = ri(rng, 2, 5), each = ri(rng, 4, 9), extra = ri(rng, 2, 9) * g;
      return { text: `A chest holds ${g * each} gems. You find ${extra} more, then split them all evenly between ${g} heroes. How many gems does each hero get?`, answer: (g * each + extra) / g };
    } },
  { id: 'perimeter', skill: 'word_2step', tier: 3, make: rng => {
      const w = ri(rng, 3, 12), h = ri(rng, 3, 12);
      return { text: `A treasure room is ${w} steps wide and ${h} steps long. How many steps is it all the way around the edge?`, answer: 2 * (w + h) };
    } },
  { id: 'time', skill: 'word_2step', tier: 3, make: rng => {
      const mins = ri(rng, 3, 9) * 15;
      return { text: `A torch burns for ${mins} minutes. How many WHOLE quarter-hours (15 minute blocks) is that?`, answer: mins / 15 };
    } },
  { id: 'round_ten', skill: 'place_est', tier: 3, make: rng => {
      const n = ri(rng, 121, 989);
      return { text: `Round ${n} to the nearest TEN.`, answer: Math.round(n / 10) * 10 };
    } },
  { id: 'round_hundred', skill: 'place_est', tier: 3, make: rng => {
      const n = ri(rng, 121, 989);
      return { text: `Round ${n} to the nearest HUNDRED.`, answer: Math.round(n / 100) * 100 };
    } },
  { id: 'place_digit', skill: 'place_est', tier: 3, make: rng => {
      // Force a non-zero hundreds digit: "0" as an answer just reads as broken.
      const n = ri(rng, 1, 9) * 1000 + ri(rng, 1, 9) * 100 + ri(rng, 0, 9) * 10 + ri(rng, 0, 9);
      return { text: `In the number ${n}, what is the value of the digit in the HUNDREDS place? (For example, in 4500 it is 500.)`, answer: Math.floor(n / 100) % 10 * 100 };
    } },
  { id: 'estimate_sum', skill: 'place_est', tier: 3, make: rng => {
      const a = ri(rng, 21, 89), b = ri(rng, 21, 89);
      return { text: `Round ${a} and ${b} each to the nearest ten, then add them. What do you get?`, answer: Math.round(a / 10) * 10 + Math.round(b / 10) * 10 };
    } },
  { id: 'fraction_set', skill: 'word_2step', tier: 4, make: rng => {
      const parts = pick(rng, [2, 3, 4, 5]), each = ri(rng, 3, 9);
      return { text: `A bag holds ${parts * each} coins. You take 1/${parts} of them. How many coins do you take?`, answer: each };
    } },
];
