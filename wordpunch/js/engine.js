/* Word Punch — pure game logic: parsing the content, building questions,
   resolving punches, tracking what a boxer gets wrong. No DOM, no storage,
   so all of it can be tested in Node. Randomness always comes in as `rng`. */
import { POS, POS_ORDER, posForGrade, FIGHTERS, CIRCUITS, WORDS, SENTENCES, SPELLING } from './data.js';
import { newRewards, recordWin } from './rewards.js';
import { PRIZES } from './prizes.js';

/* ----------------------------------------------------------------- random */
export function makeRng(seed = Date.now()) {
  // mulberry32: small, fast, good enough for shuffling quiz answers.
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function weightedPick(rng, items, weightOf) {
  const ws = items.map(weightOf);
  const total = ws.reduce((s, w) => s + w, 0);
  if (total <= 0) return pick(rng, items);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/* ---------------------------------------------------------------- parsing */
const TOKEN = /^([^A-Za-z0-9_']*)([A-Za-z0-9_'’-]+)(?:\/(n|v|a|av|pr)(\*)?)?([^A-Za-z0-9_']*)$/;

/* "The big/a dog/n ran/v." -> tokens with the tag pulled off. */
export function parseSentence(src) {
  const raw = typeof src === 'string' ? { s: src } : src;
  const tokens = raw.s.split(/\s+/).filter(Boolean).map(chunk => {
    const m = chunk.match(TOKEN);
    if (!m) throw new Error(`Cannot parse "${chunk}" in: ${raw.s}`);
    const [, lead, word, pos, star, trail] = m;
    return { lead, word, trail, pos: pos || null, ask: !!pos && !star };
  });
  return { tokens, notes: raw.notes || {} };
}

export function parseSpelling(line) {
  const homophone = line.startsWith('~');
  const [word, wrong, sentence] = (homophone ? line.slice(1) : line).split('|');
  if (!word || !wrong || !sentence) throw new Error(`Bad spelling line: ${line}`);
  return { word, wrong: wrong.split(','), sentence, homophone };
}

/* ------------------------------------------------------------------ pools --
   What a fight in a given grade can draw on: that grade's content at full
   weight, plus the grade below at a lower weight, so earlier material keeps
   coming back for review rather than vanishing the day a kid moves up. */
const REVIEW_WEIGHT = 0.35;
const poolCache = new Map();

export function poolFor(grade) {
  if (poolCache.has(grade)) return poolCache.get(grade);
  const words = [], sentences = [], spelling = [];
  for (const g of [grade, grade - 1]) {
    if (!WORDS[g]) continue;
    const w = g === grade ? 1 : REVIEW_WEIGHT;
    for (const pos of Object.keys(WORDS[g])) {
      for (const word of WORDS[g][pos]) words.push({ word, pos, grade: g, w, key: `w:${word}` });
    }
    SENTENCES[g].forEach((src, i) => {
      sentences.push({ ...parseSentence(src), grade: g, w, key: `s:${g}:${i}` });
    });
    for (const line of SPELLING[g]) {
      const item = parseSpelling(line);
      spelling.push({ ...item, grade: g, w, key: `sp:${item.word}` });
    }
  }
  const pool = { words, sentences, spelling };
  poolCache.set(grade, pool);
  return pool;
}

/* ---------------------------------------------------------------- fighters --
   Every stat comes from the fighter's place on the ladder, so the climb gets
   harder evenly rather than wherever someone happened to type a big number.

   hits:     correct answers needed to knock them down
   takes:    wrong answers that put YOU down
   clock:    seconds per question, from the grade (younger kids read slower)
             shaved a little per rung
   getUps:   circuit champions climb off the canvas once */
const HITS  = [4, 4, 5, 5, 6, 7, 7, 8];
const TAKES = [5, 5, 4, 4, 4, 3, 3, 3];
const BASE_CLOCK = { 1: 22, 2: 20, 3: 18, 4: 16, 5: 15, 6: 14, 7: 13, 8: 12 };

export function fighterStats(idx, grade) {
  const f = FIGHTERS[idx];
  return {
    hits: HITS[idx],
    takes: TAKES[idx],
    clock: Math.round(BASE_CLOCK[grade] * (1 - 0.035 * idx)),
    getUps: f.champion ? 1 : 0,
  };
}

export function circuitOf(idx) {
  return CIRCUITS.find(c => c.fighters.includes(idx));
}

/* -------------------------------------------------------------- questions */
const article = label => (/^[aeiou]/i.test(label) ? 'an' : 'a');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function ruleFor(pos, grade) {
  if (pos === 'v' && grade <= 1) return 'a verb shows an action';
  return POS[pos].rule;
}

/* Question formats open up as a kid climbs the ladder:
     pick_pos   "Which word is a NOUN?"  four loose words
     name_pos   "What part of speech is the highlighted word?"
     tap_pos    "Tap the VERB." in a whole sentence
     spell_pick "Which spelling is right?" with the sentence for meaning
     spell_fix  "One word is spelled wrong. Tap it!"  (4th grade up)
   The later ones are harder because the kid has to find the word as well as
   judge it. */
export function formatsFor(idx, grade) {
  return {
    pos: [
      { type: 'pick_pos', w: idx < 3 ? 1 : 0.5 },
      { type: 'name_pos', w: 1 },
      { type: 'tap_pos', w: (grade >= 2 && idx >= 2) || idx >= 5 ? 0.9 : 0 },
    ].filter(f => f.w > 0),
    spell: [
      { type: 'spell_pick', w: 1 },
      { type: 'spell_fix', w: (grade >= 4 && idx >= 3) || (grade === 3 && idx >= 6) ? 0.6 : 0 },
    ].filter(f => f.w > 0),
  };
}

/* How hard to lean on something the kid has missed before. A word missed
   once comes back roughly seven times as often as an untouched one, and
   drifts back to normal as they get it right. */
const missWeight = (missed, key) => 1 + 3 * (missed?.[key] || 0);

function chooseTargetPos(rng, grade, fighter) {
  const set = posForGrade(grade);
  if (fighter.focus && set.includes(fighter.focus) && rng() < 0.5) return fighter.focus;
  const base = { n: 1, v: 1, a: 1, av: 0.8, pr: 0.6 };
  return weightedPick(rng, set, p => base[p]);
}

function fresh(items, used) {
  const unused = items.filter(i => !used.has(i.key));
  return unused.length ? unused : items;
}

/* Build one question. ctx = { grade, idx, rng, missed, used } where `used`
   is a Set of item keys already asked this fight, so a fight does not repeat
   itself until it has run out of material. */
export function makeQuestion(ctx) {
  const { grade, idx, rng } = ctx;
  const fighter = FIGHTERS[idx];
  const formats = formatsFor(idx, grade);
  const spell = rng() < fighter.spell;
  const fmt = weightedPick(rng, spell ? formats.spell : formats.pos, f => f.w).type;
  const q = BUILDERS[fmt](ctx, fighter);
  ctx.used?.add(q.key);
  return q;
}

/* Words in a sentence become tappable choices; punctuation stays attached. */
function sentenceTokens(tokens, { tappable = false, highlight = -1 } = {}) {
  const choices = [];
  const out = tokens.map((t, i) => {
    const tok = { lead: t.lead, text: t.word, trail: t.trail, hl: i === highlight, choice: -1 };
    if (tappable && t.word !== '___') {
      tok.choice = choices.length;
      choices.push({ label: t.word, correct: false, tokenIndex: i });
    }
    return tok;
  });
  return { sentence: out, choices };
}

const plainSentence = tokens => tokens.map(t => t.lead + t.word + t.trail).join(' ');

const BUILDERS = {
  pick_pos(ctx, fighter) {
    const { grade, rng, missed, used } = ctx;
    const pool = poolFor(grade);
    const set = posForGrade(grade);
    const T = chooseTargetPos(rng, grade, fighter);
    const candidates = fresh(pool.words.filter(w => w.pos === T), used);
    const target = weightedPick(rng, candidates, w => w.w * missWeight(missed, w.key));

    // One distractor from each other part of speech where possible, so the
    // wrong answers are varied rather than three adjectives in a row.
    const others = shuffle(rng, set.filter(p => p !== T));
    const distractors = [];
    const taken = new Set([target.word]);
    for (let i = 0; distractors.length < 3 && i < 12; i++) {
      const p = others[i % others.length];
      const opts = pool.words.filter(w => w.pos === p && !taken.has(w.word) && w.grade === target.grade);
      const src = opts.length ? opts : pool.words.filter(w => w.pos === p && !taken.has(w.word));
      if (!src.length) continue;
      const d = pick(rng, src);
      taken.add(d.word);
      distractors.push(d);
    }
    const choices = shuffle(rng, [target, ...distractors]).map(w => ({ label: w.word, correct: w === target }));
    const label = POS[T].upper;
    return {
      type: 'pick_pos', skill: T, key: target.key, answer: target.word,
      punch: 'Word Jab',
      prompt: `Which word is ${article(label)} ${label}?`,
      choices, sentence: null,
      explain: `"${target.word}" is ${article(POS[T].label)} ${POS[T].label.toLowerCase()}. Remember, ${ruleFor(T, grade)}.`,
      speak: `Which word is ${article(label)} ${POS[T].label}? ${choices.map(c => c.label).join(', ')}.`,
    };
  },

  name_pos(ctx, fighter) {
    const { grade, rng, missed, used } = ctx;
    const set = posForGrade(grade);
    const T = chooseTargetPos(rng, grade, fighter);
    const pool = poolFor(grade).sentences;
    let cands = pool.filter(s => s.tokens.some(t => t.ask && t.pos === T));
    let pos = T;
    if (!cands.length) { pos = 'n'; cands = pool.filter(s => s.tokens.some(t => t.ask && t.pos === 'n')); }
    const s = weightedPick(rng, fresh(cands, used), c => c.w * missWeight(missed, c.key));
    const idxs = s.tokens.map((t, i) => (t.ask && t.pos === pos ? i : -1)).filter(i => i >= 0);
    const ti = pick(rng, idxs);
    const tok = s.tokens[ti];
    const { sentence } = sentenceTokens(s.tokens, { highlight: ti });
    const choices = POS_ORDER.filter(p => set.includes(p)).map(p => ({ label: POS[p].label, correct: p === pos }));
    const note = s.notes[tok.word];
    return {
      type: 'name_pos', skill: pos, key: s.key, answer: POS[pos].label,
      punch: 'Grammar Hook',
      prompt: 'What part of speech is the highlighted word?',
      choices, sentence,
      explain: note || `"${tok.word}" is ${article(POS[pos].label)} ${POS[pos].label.toLowerCase()} here. ${cap(ruleFor(pos, grade))}.`,
      speak: `${plainSentence(s.tokens)} What part of speech is the word ${tok.word}?`,
    };
  },

  tap_pos(ctx, fighter) {
    const { grade, rng, missed, used } = ctx;
    const T = chooseTargetPos(rng, grade, fighter);
    const pool = poolFor(grade).sentences;
    let cands = pool.filter(s => s.tokens.some(t => t.ask && t.pos === T));
    let pos = T;
    if (!cands.length) { pos = 'v'; cands = pool.filter(s => s.tokens.some(t => t.ask && t.pos === 'v')); }
    const s = weightedPick(rng, fresh(cands, used), c => c.w * missWeight(missed, c.key));
    const { sentence, choices } = sentenceTokens(s.tokens, { tappable: true });
    const hits = [];
    for (const c of choices) {
      const t = s.tokens[c.tokenIndex];
      if (t.pos === pos) { c.correct = true; hits.push(t.word); }
    }
    const label = POS[pos].upper;
    const many = hits.length > 1;
    const noted = hits.map(w => s.notes[w]).find(Boolean);
    const listed = hits.map(w => `"${w}"`).join(' and ');
    return {
      type: 'tap_pos', skill: pos, key: s.key, answer: hits.join(' / '),
      punch: 'Sentence Smash',
      prompt: many ? `Tap ${article(label)} ${label}.` : `Tap the ${label}.`,
      choices, sentence,
      explain: (many
        ? `The ${POS[pos].label.toLowerCase()}s here are ${listed}. `
        : `The ${POS[pos].label.toLowerCase()} is ${listed}. `) + (noted || `${cap(ruleFor(pos, grade))}.`),
      speak: `Tap the ${POS[pos].label}. ${plainSentence(s.tokens)}`,
    };
  },

  spell_pick(ctx) {
    const { grade, rng, missed, used } = ctx;
    const item = weightedPick(rng, fresh(poolFor(grade).spelling, used), i => i.w * missWeight(missed, i.key));
    const wrong = shuffle(rng, item.wrong).slice(0, 3);
    const choices = shuffle(rng, [item.word, ...wrong]).map(w => ({ label: w, correct: w === item.word }));
    const { sentence } = sentenceTokens(parseSentence(item.sentence).tokens);
    const filled = item.sentence.replace('___', item.word);
    return {
      type: 'spell_pick', skill: 'spell', key: item.key, answer: item.word,
      punch: 'Spelling Uppercut',
      prompt: item.homophone ? 'Which word fits the sentence?' : 'Which spelling is right?',
      choices, sentence,
      explain: item.homophone
        ? `"${item.word}" is the one that fits: ${filled}`
        : `It's spelled ${item.word.split('').join('-')}.`,
      speak: item.homophone ? `Which word fits? ${filled}` : `Spell ${item.word}. ${filled}`,
    };
  },

  spell_fix(ctx) {
    const { grade, rng, missed, used } = ctx;
    const item = weightedPick(rng, fresh(poolFor(grade).spelling, used), i => i.w * missWeight(missed, i.key));
    const bad = pick(rng, item.wrong);
    const atStart = item.sentence.startsWith('___');
    const shown = item.sentence.replace('___', atStart ? cap(bad) : bad);
    const parsed = parseSentence(shown).tokens;
    const { sentence, choices } = sentenceTokens(parsed, { tappable: true });
    const badIndex = item.sentence.split(/\s+/).findIndex(w => w.includes('___'));
    for (const c of choices) c.correct = c.tokenIndex === badIndex;
    const good = atStart ? cap(item.word) : item.word;
    return {
      type: 'spell_fix', skill: 'spell', key: item.key, answer: good,
      punch: 'Red-Pen Haymaker',
      prompt: item.homophone ? 'One word is the WRONG word. Tap it!' : 'One word is spelled wrong. Tap it!',
      choices, sentence,
      explain: `"${atStart ? cap(bad) : bad}" should be "${good}".`,
      speak: `Find the mistake. ${item.sentence.replace('___', item.word)}`,
    };
  },
};

export const QUESTION_TYPES = Object.keys(BUILDERS);
export function buildQuestion(type, ctx) {
  return BUILDERS[type](ctx, FIGHTERS[ctx.idx]);
}

/* Same builders without the fighter ladder, for other games that share this
   content (Word Kick). `lean` is { focus } like a fighter's. */
export function buildQuestionWith(type, ctx, lean = {}) {
  return BUILDERS[type](ctx, { focus: null, ...lean });
}

/* ------------------------------------------------------------------ fight --
   The fight is a small state machine. The UI asks a question, the kid
   answers, `resolveAnswer` works out everything that happens, and the UI
   plays the events back as animation. The maths is done before the picture,
   so an animation can never change a result. */
export const POWER_MULT = 2.5;
export const QUICK_MULT = 1.2;
export const QUICK_SHARE = 0.35;   // answered in the first 35% of the clock
export const GETUP_HP = 60;
export const GETUP_TRIES = 2;
export const MAX_STARS = 3;
export const STREAK_FOR_STAR = 3;
export const DOWNS_FOR_TKO = 3;

export function createFight(grade, idx) {
  const stats = fighterStats(idx, grade);
  return {
    grade, idx, stats,
    oppHp: 100, youHp: 100,
    stars: 0, streak: 0, bestStreak: 0,
    youDowns: 0, oppDowns: 0, oppGetUps: stats.getUps,
    right: 0, wrong: 0,
    getUpTries: 0,
    phase: 'fight',    // 'fight' | 'youDown' | 'over'
    result: null,      // 'win' | 'lose'
    misses: [],        // { prompt, answer, explain } for the review after a loss
  };
}

/* answer = { correct, power, quick, timedOut } -> list of events */
export function resolveAnswer(f, answer) {
  if (f.phase !== 'fight') throw new Error(`resolveAnswer during ${f.phase}`);
  const ev = [];
  const power = answer.power && f.stars > 0;
  if (power) f.stars--;

  if (answer.correct) {
    f.right++;
    f.streak++;
    f.bestStreak = Math.max(f.bestStreak, f.streak);
    let dmg = 100 / f.stats.hits;
    if (power) dmg *= POWER_MULT;
    if (answer.quick) dmg *= QUICK_MULT;
    dmg = Math.round(dmg);
    f.oppHp = Math.max(0, f.oppHp - dmg);
    ev.push({ type: power ? 'uppercut' : 'jab', dmg, quick: !!answer.quick });
    if (f.streak % STREAK_FOR_STAR === 0 && f.stars < MAX_STARS) {
      f.stars++;
      ev.push({ type: 'star' });
    }
    if (f.oppHp === 0) {
      f.oppDowns++;
      if (f.oppGetUps > 0) {
        f.oppGetUps--;
        f.oppHp = 50;
        ev.push({ type: 'oppDown' }, { type: 'oppUp' });
      } else {
        f.phase = 'over';
        f.result = 'win';
        ev.push({ type: 'oppDown' }, { type: 'ko' });
      }
    }
  } else {
    f.wrong++;
    f.streak = 0;
    const dmg = Math.round(100 / f.stats.takes);
    f.youHp = Math.max(0, f.youHp - dmg);
    ev.push({ type: 'hit', dmg, timedOut: !!answer.timedOut, lostStar: power });
    if (f.youHp === 0) {
      f.youDowns++;
      ev.push({ type: 'youDown' });
      if (f.youDowns >= DOWNS_FOR_TKO) {
        f.phase = 'over';
        f.result = 'lose';
        ev.push({ type: 'tko' });
      } else {
        f.phase = 'youDown';
        f.getUpTries = GETUP_TRIES;
      }
    }
  }
  return ev;
}

/* On the canvas, a right answer gets you up. Two tries before the count
   reaches ten. */
export function resolveGetUp(f, correct) {
  if (f.phase !== 'youDown') throw new Error(`resolveGetUp during ${f.phase}`);
  if (correct) {
    f.right++;
    f.youHp = GETUP_HP;
    f.phase = 'fight';
    return [{ type: 'youUp' }];
  }
  f.wrong++;
  f.getUpTries--;
  if (f.getUpTries <= 0) {
    f.phase = 'over';
    f.result = 'lose';
    return [{ type: 'ko' }];
  }
  return [{ type: 'count' }];
}

/* ---------------------------------------------------------------- profile --
   What a boxer carries between fights. Kept as plain JSON so it survives
   localStorage and backups. */
export function newProfile({ name, grade, gloves }) {
  return {
    id: `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: String(name || 'Boxer').slice(0, 16),
    grade: clampGrade(grade),
    gloves: gloves || '#22c55e',
    created: Date.now(),
    settings: { clock: true, readAloud: grade <= 2, sound: true },
    progress: {},      // grade -> { next, belts: [circuit ids] }
    stats: {},         // skill -> { right, wrong }
    missed: {},        // item key -> how many more rights it needs
    misses: [],        // recent misses for the coach's corner
    fights: 0, wins: 0,
    rewards: newRewards(),   // prizes: every 3 wins at their grade or above
  };
}

export const clampGrade = g => Math.min(8, Math.max(1, Math.round(Number(g)) || 1));

export function progressFor(profile, grade) {
  const p = profile.progress[grade] || { next: 0, belts: [] };
  profile.progress[grade] = p;
  return p;
}

const MISS_CAP = 4;
export function recordAnswer(profile, q, correct) {
  const s = profile.stats[q.skill] || (profile.stats[q.skill] = { right: 0, wrong: 0 });
  if (correct) s.right++; else s.wrong++;
  const m = profile.missed[q.key] || 0;
  const next = correct ? m - 1 : Math.min(MISS_CAP, m + 2);
  if (next > 0) profile.missed[q.key] = next;
  else delete profile.missed[q.key];
  if (!correct) {
    profile.misses.unshift({ prompt: q.prompt, answer: q.answer, explain: q.explain, skill: q.skill, at: Date.now() });
    profile.misses.length = Math.min(profile.misses.length, 30);
  }
}

/* A fight is over: move the ladder on and hand out a belt if one was won. */
export function finishFight(profile, grade, idx, won) {
  profile.fights++;
  const out = { belt: null, gradeChamp: false, nextUnlocked: null, reward: { counted: false, prize: null } };
  if (!won) return out;
  profile.wins++;
  out.reward = recordWin(profile, grade, PRIZES);
  const p = progressFor(profile, grade);
  if (idx + 1 > p.next) {
    p.next = Math.min(FIGHTERS.length, idx + 1);
    if (p.next < FIGHTERS.length) out.nextUnlocked = p.next;
  }
  const circuit = circuitOf(idx);
  if (FIGHTERS[idx].champion && !p.belts.includes(circuit.id)) {
    p.belts.push(circuit.id);
    out.belt = circuit;
    out.gradeChamp = circuit.id === 'world';
  }
  return out;
}

export function accuracy(stat) {
  const n = (stat?.right || 0) + (stat?.wrong || 0);
  return n ? stat.right / n : null;
}
