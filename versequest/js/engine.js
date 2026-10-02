/* Verse Quest — the rules. No DOM in here, so the tests can run it in Node.

   How a verse is learned:
   - Each verse takes 5 steps. Every step is a short lesson (one or two
     exercises) that hides a little more of the verse than the last one.
   - A kid can pass at most STEPS_PER_DAY steps of the same verse in a day,
     and work on at most MAX_ACTIVE verses at once. Spreading the steps over a
     few days is the point: it sticks far better than cramming.
   - After step 5 the verse is memorized and goes into review. Reviews come
     back after 1, 3, 7, 14, 30, then 60 days. A missed review pulls the verse
     back two boxes, never all the way to the start. A verse that reaches box
     GOLD_BOX turns gold. */
import { VERSES, TRIVIA, BADGES } from './data.js';

export const STEPS = 5;
export const STEPS_PER_DAY = 2;
export const MAX_ACTIVE = 2;
export const INTERVALS = [1, 3, 7, 14, 30, 60];
export const GOLD_BOX = 4;
export const GOALS = [2, 3, 5];
export const ROUND_SIZE = 5;
export const STAR = { step: 10, mastered: 20, retry: 3, review: 5, reviewMiss: 2, practice: 2, trivia: 2, perfect: 5 };

export const verseById = id => VERSES.find(v => v.id === id) || null;

/* ------------------------------------------------------------------ rng -- */
export function makeRng(seed = Date.now()) {
  let a = (Number(seed) >>> 0) || 1;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = n => Math.floor(next() * n);
  next.pick = arr => arr[next.int(arr.length)];
  next.shuffle = arr => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = next.int(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  };
  return next;
}

/* ----------------------------------------------------------------- days -- */
// Days are local calendar dates as 'YYYY-MM-DD' strings, so "today" flips at
// the kid's midnight, not UTC midnight.
export function dayStr(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return dayStr(d); };
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
export const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ---------------------------------------------------------------- words -- */
// Checking ignores case and punctuation: "LORD," and "lord" are the same word.
export const norm = w => w.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9'-]/g, '').replace(/^['-]+|['-]+$/g, '');
// What a word looks like on a choice button: no commas or quote marks.
export const clean = w => w.replace(/[‘’]/g, "'").replace(/[^A-Za-z0-9'-]/g, '').replace(/^['-]+|['-]+$/g, '');

/* Split a verse into words. A dash glued between two words ("faith—and")
   becomes two words, the dash staying on the first. */
export function tokenize(text) {
  const out = [];
  for (const piece of text.split(/\s+/).filter(Boolean)) {
    const parts = piece.split(/(?<=—)/).filter(Boolean);
    for (const t of parts) if (norm(t)) out.push({ t, n: norm(t), c: clean(t) });
      else if (out.length) out[out.length - 1].t += t; // lone punctuation sticks to the word before
  }
  return out;
}

/* Every word that appears lowercase somewhere in the game. Distractors come
   only from here, so a capital letter never gives the answer away and proper
   names (Jesus, Christ, Spirit) are never offered as a wrong word. */
let POOL = null;
export function wordPool() {
  if (POOL) return POOL;
  const seen = new Map();
  for (const v of VERSES) for (const tok of tokenize(v.text)) {
    if (tok.c && tok.c === tok.c.toLowerCase() && !seen.has(tok.n)) seen.set(tok.n, tok.c);
  }
  POOL = [...seen.values()];
  return POOL;
}
const matchCase = (w, like) => /^[A-Z]/.test(like) ? w[0].toUpperCase() + w.slice(1) : w;

export function distractors(correct, rng, count = 2, avoid = []) {
  const n = norm(correct);
  const bad = new Set([n, ...avoid.map(norm)]);
  const pool = wordPool().filter(w => !bad.has(norm(w)));
  const near = pool.filter(w => Math.abs(w.length - n.length) <= 2);
  const from = near.length >= count * 3 ? near : pool;
  return rng.shuffle(from).slice(0, count).map(w => matchCase(w, clean(correct)));
}

/* Phrase tiles for the put-it-in-order exercise. A tile ends at a comma or
   other break, or after four words. Always at least three tiles. */
export function chunks(tokens) {
  let out = [], cur = [];
  tokens.forEach((tok, i) => {
    cur.push(i);
    if (cur.length >= 4 || (cur.length >= 2 && /[,;:.!?—]["”]?$/.test(tok.t))) { out.push(cur); cur = []; }
  });
  if (cur.length) {
    if (cur.length === 1 && out.length) out[out.length - 1].push(cur[0]);
    else out.push(cur);
  }
  if (out.length < 3) {
    const size = Math.max(1, Math.ceil(tokens.length / 3));
    out = [];
    for (let i = 0; i < tokens.length; i += size) out.push(tokens.slice(i, i + size).map((_, k) => i + k));
  }
  return out;
}

/* ------------------------------------------------------------ exercises -- */
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'is', 'as', 'at', 'by', 'so', 'it', 'be', 'we', 'he', 'i', 'my', 'me', 'us', 'you', 'all']);

function blanks(verse, frac, rng) {
  const tokens = tokenize(verse.text);
  const content = tokens.map((t, i) => i).filter(i => !STOP.has(tokens[i].n) && tokens[i].n.length >= 3);
  const want = Math.max(1, Math.min(content.length, Math.round(tokens.length * frac)));
  const holes = rng.shuffle(content).slice(0, want).sort((a, b) => a - b);
  const bankWords = holes.map(i => tokens[i].c);
  const extra = distractors(bankWords[0].toLowerCase(), rng, 2, tokens.map(t => t.c));
  const bank = rng.shuffle([...bankWords, ...extra].map(w => ({ c: w, n: norm(w) })));
  return { type: 'blanks', tokens, holes, bank };
}

function order(verse, rng) {
  const tokens = tokenize(verse.text);
  const groups = chunks(tokens);
  const tiles = groups.map((g, k) => ({ k, text: g.map(i => tokens[i].t).join(' '), n: g.map(i => tokens[i].n).join(' ') }));
  let shuffled = rng.shuffle(tiles);
  // Never hand over the tiles already in order.
  if (shuffled.every((t, i) => t.k === i)) shuffled = [...shuffled.slice(1), shuffled[0]];
  return { type: 'order', tokens, tiles: shuffled, count: tiles.length };
}

function nextWord(verse, hint, rng) {
  const tokens = tokenize(verse.text);
  const options = tokens.map(tok => rng.shuffle([tok.c, ...distractors(tok.c, rng, 2)]));
  return { type: 'next', hint, tokens, options };
}

function refQuiz(verse, rng) {
  const others = rng.shuffle(VERSES.filter(v => v.id !== verse.id)).slice(0, 3);
  if (rng() < 0.5) {
    return { type: 'ref', mode: 'where', prompt: verse.text,
      choices: rng.shuffle([verse, ...others].map(v => ({ label: v.ref, correct: v.id === verse.id }))) };
  }
  const start = v => { const t = tokenize(v.text); return t.slice(0, 7).map(x => x.t).join(' ') + (t.length > 7 ? ' …' : ''); };
  return { type: 'ref', mode: 'which', prompt: verse.ref,
    choices: rng.shuffle([verse, ...others].map(v => ({ label: start(v), correct: v.id === verse.id }))) };
}

/* The exercises for step `step` (1 to 5) of a verse. */
export function buildLesson(verse, step, rng) {
  switch (step) {
    case 1: return [{ type: 'read', verse }, blanks(verse, 0.2, rng)];
    case 2: return [blanks(verse, 0.4, rng), refQuiz(verse, rng)];
    case 3: return [order(verse, rng), blanks(verse, 0.6, rng)];
    case 4: return [nextWord(verse, 'letters', rng), refQuiz(verse, rng)];
    default: return [nextWord(verse, 'none', rng)];
  }
}

/* A review of a memorized verse. Early boxes still show first letters. */
export function buildReview(verse, box, rng) {
  return [refQuiz(verse, rng), nextWord(verse, box < 2 ? 'letters' : 'none', rng)];
}

/* How many wrong taps a lesson can have and still pass. Longer verses get a
   little more room. */
export const allowance = verse => 2 + Math.floor(tokenize(verse.text).length / 10);

/* -------------------------------------------------------------- profile -- */
export function newProfile({ name = 'Player', color = '#f59e0b' } = {}) {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: String(name).trim().slice(0, 16) || 'Player',
    color,
    verses: {},       // id -> { stage, box, due, mastered, stepDay, stepsToday, misses }
    trivia: {},       // question id -> { right, wrong }
    days: {},         // 'YYYY-MM-DD' -> activities finished that day
    streak: { count: 0, best: 0, last: null, freezes: 0 },
    stars: 0,
    badges: [],
    triviaRight: 0,
    triviaTotal: 0,
    settings: { sound: true, readAloud: false, goal: 3 },
  };
}

export const vstate = (p, id) => p.verses[id] || null;
export const isMastered = (p, id) => (vstate(p, id)?.stage || 0) >= STEPS;
export const activeIds = p => VERSES.map(v => v.id).filter(id => p.verses[id] && p.verses[id].stage < STEPS);
export const masteredIds = p => VERSES.map(v => v.id).filter(id => isMastered(p, id));
export const goldIds = p => masteredIds(p).filter(id => p.verses[id].box >= GOLD_BOX);

export function stepsLeftToday(p, id, today) {
  const s = vstate(p, id);
  if (!s || s.stage >= STEPS) return 0;
  return s.stepDay === today ? Math.max(0, STEPS_PER_DAY - s.stepsToday) : STEPS_PER_DAY;
}

export const canStart = p => activeIds(p).length < MAX_ACTIVE;
export const nextNewVerse = p => VERSES.find(v => !p.verses[v.id]) || null;

export function startVerse(p, id) {
  if (p.verses[id] || !canStart(p) || !verseById(id)) return false;
  p.verses[id] = { stage: 0, box: 0, due: null, mastered: null, stepDay: null, stepsToday: 0, misses: 0 };
  return true;
}

export const dueReviews = (p, today) => masteredIds(p).filter(id => p.verses[id].due && p.verses[id].due <= today)
  .sort((a, b) => p.verses[a].due.localeCompare(p.verses[b].due));

/* What the home screen should offer, in the order it should offer it:
   reviews first (they are the ones that slip), then lessons, then a new verse. */
export function plan(p, today) {
  return {
    reviews: dueReviews(p, today),
    lessons: activeIds(p).filter(id => stepsLeftToday(p, id, today) > 0),
    waiting: activeIds(p).filter(id => stepsLeftToday(p, id, today) === 0),
    next: canStart(p) ? nextNewVerse(p) : null,
  };
}

/* ------------------------------------------------------ streak and goal -- */
/* Counts one finished activity. The streak goes up the first time the daily
   goal is met on a given day. One missed day is forgiven if a freeze is saved
   up; a freeze is earned every 7 days of streak, and at most 2 are kept. */
export function countActivity(p, today) {
  p.days[today] = (p.days[today] || 0) + 1;
  const goal = p.settings.goal || 3;
  if (p.days[today] !== goal) return { goalHit: false, froze: false };
  const s = p.streak;
  let froze = false;
  if (s.last === today) return { goalHit: false, froze };
  const gap = s.last ? daysBetween(s.last, today) : null;
  if (gap === 1) s.count += 1;
  else if (gap === 2 && s.freezes > 0) { s.freezes -= 1; s.count += 1; froze = true; }
  else s.count = 1;
  s.last = today;
  if (s.count % 7 === 0) s.freezes = Math.min(2, s.freezes + 1);
  s.best = Math.max(s.best, s.count);
  return { goalHit: true, froze };
}

/* The streak as it stands today. Still alive if the goal was met today or
   yesterday, or the day before that with a freeze saved up. */
export function currentStreak(p, today) {
  const s = p.streak;
  if (!s.last) return 0;
  const gap = daysBetween(s.last, today);
  if (gap <= 1) return s.count;
  if (gap === 2 && s.freezes > 0) return s.count;
  return 0;
}

export const doneToday = (p, today) => p.days[today] || 0;

/* --------------------------------------------------------------- results -- */
export function finishLesson(p, id, mistakes, today) {
  const s = vstate(p, id);
  const verse = verseById(id);
  const passed = mistakes <= allowance(verse);
  const res = { passed, mastered: false, stars: 0, step: s.stage + 1 };
  if (passed) {
    if (s.stepDay !== today) { s.stepDay = today; s.stepsToday = 0; }
    s.stepsToday += 1;
    s.stage += 1;
    res.stars = STAR.step;
    if (s.stage >= STEPS) {
      s.stage = STEPS; s.box = 0; s.mastered = today; s.due = addDays(today, INTERVALS[0]);
      res.mastered = true;
      res.stars += STAR.mastered;
    }
  } else {
    s.misses += 1;
    res.stars = STAR.retry;
  }
  p.stars += res.stars;
  return finish(p, today, res);
}

export function finishReview(p, id, mistakes, today) {
  const s = vstate(p, id);
  const verse = verseById(id);
  const passed = mistakes <= allowance(verse);
  const wasGold = s.box >= GOLD_BOX;
  if (passed) s.box = Math.min(INTERVALS.length - 1, s.box + 1);
  else { s.box = Math.max(0, s.box - 2); s.misses += 1; }
  s.due = addDays(today, passed ? INTERVALS[s.box] : 1);
  const res = { passed, box: s.box, gold: !wasGold && s.box >= GOLD_BOX, stars: passed ? STAR.review : STAR.reviewMiss, due: s.due };
  p.stars += res.stars;
  return finish(p, today, res);
}

/* Extra practice on a memorized verse. Counts toward the daily goal but
   leaves the review schedule alone. */
export function finishPractice(p, today) {
  p.stars += STAR.practice;
  return finish(p, today, { passed: true, stars: STAR.practice });
}

export function recordTrivia(p, qid, right) {
  const t = p.trivia[qid] || (p.trivia[qid] = { right: 0, wrong: 0 });
  if (right) t.right += 1; else t.wrong += 1;
  p.triviaTotal += 1;
  if (right) p.triviaRight += 1;
}

export function finishTrivia(p, right, total, today) {
  const perfect = total > 0 && right === total;
  const stars = right * STAR.trivia + (perfect ? STAR.perfect : 0);
  p.stars += stars;
  return finish(p, today, { right, total, perfect, stars });
}

function finish(p, today, res) {
  Object.assign(res, countActivity(p, today));
  res.badges = awardBadges(p, today, res);
  return res;
}

/* ---------------------------------------------------------------- badges -- */
export function earnedBadges(p, today, res = {}) {
  const m = masteredIds(p).length;
  const streak = Math.max(currentStreak(p, today), p.streak.best);
  const has = {
    'first-step': Object.values(p.verses).some(s => s.stage > 0),
    'first-verse': m >= 1,
    'verses-5': m >= 5,
    'verses-10': m >= 10,
    'verses-20': m >= 20,
    'verses-all': m >= VERSES.length,
    'gold': goldIds(p).length > 0,
    'streak-3': streak >= 3,
    'streak-7': streak >= 7,
    'streak-30': streak >= 30,
    'trivia-25': p.triviaRight >= 25,
    'trivia-100': p.triviaRight >= 100,
    'perfect': !!res.perfect || p.badges.includes('perfect'),
  };
  return BADGES.filter(b => has[b.id]).map(b => b.id);
}

function awardBadges(p, today, res) {
  const fresh = earnedBadges(p, today, res).filter(id => !p.badges.includes(id));
  p.badges.push(...fresh);
  return fresh;
}

/* ---------------------------------------------------------------- trivia -- */
/* Picks a round. Questions never seen and questions missed more than got
   right come up most; ones answered right several times fade back. */
export function triviaWeight(p, q) {
  const t = p.trivia[q.id];
  if (!t) return 3;
  if (t.wrong > t.right) return 4;
  return 1 / (1 + t.right - t.wrong);
}

export function pickTrivia(p, rng, n = ROUND_SIZE, cat = null) {
  let pool = TRIVIA.filter(q => !cat || q.cat === cat);
  const out = [];
  while (out.length < n && pool.length) {
    const weights = pool.map(q => triviaWeight(p, q));
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < pool.length - 1 && (r -= weights[i]) > 0) i++;
    out.push(pool[i]);
    pool = pool.filter((_, k) => k !== i);
  }
  return out;
}

export function triviaChoices(q, rng) {
  const all = [{ label: q.a, correct: true }, ...q.wrong.map(w => ({ label: w, correct: false }))];
  // True/false always reads True then False.
  if (q.wrong.length === 1) return all.sort((a, b) => (a.label === 'True' ? -1 : b.label === 'True' ? 1 : 0));
  return rng.shuffle(all);
}

/* ----------------------------------------------------------------- stats -- */
export function summary(p, today) {
  return {
    mastered: masteredIds(p).length,
    gold: goldIds(p).length,
    active: activeIds(p).length,
    due: dueReviews(p, today).length,
    streak: currentStreak(p, today),
    best: p.streak.best,
    freezes: p.streak.freezes,
    trivia: p.triviaTotal ? Math.round(100 * p.triviaRight / p.triviaTotal) : null,
    today: doneToday(p, today),
    goal: p.settings.goal,
  };
}
