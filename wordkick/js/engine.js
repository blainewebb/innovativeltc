/* Word Kick — pure game logic: building questions from Word Punch's content,
   running a penalty shootout, and a player's bookkeeping. No DOM, no storage,
   so all of it can be tested in Node. Randomness always comes in as `rng`. */
import { formatsFor, buildQuestionWith, weightedPick, shuffle, recordAnswer, accuracy } from '../../wordpunch/js/engine.js';
import { TEAMS, CUPS, KICK_NAMES, contentGrade } from './data.js';

export { recordAnswer, accuracy };

/* ------------------------------------------------------------- teams --
   Every stat comes from the team's place on the ladder.

   clock: seconds per kick. A couple of seconds longer than Word Punch at the
          same grade, shaved a little per rung.
   reach: how good their keeper is. A right answer given in the last `reach`
          share of the clock is still saved ("too slow for this keeper").
          The first four teams can't save a right answer at all. With the
          clock turned off there is no "slow", so reach does nothing. */
const BASE_CLOCK = { 1: 26, 2: 24, 3: 22, 4: 20, 5: 18, 6: 16, 7: 15, 8: 14 };
const REACH = [0, 0, 0, 0, 0.15, 0.2, 0.25, 0.3];

export function teamStats(idx, grade) {
  return {
    clock: Math.round(BASE_CLOCK[grade] * (1 - 0.035 * idx)),
    reach: REACH[idx],
  };
}

export function cupOf(idx) {
  return CUPS.find(c => c.teams.includes(idx));
}

/* ---------------------------------------------------------- questions --
   Word Punch's question builders, fed the grade below the player's. The
   format mix (which formats open up at which rung) is Word Punch's too, also
   at the easier grade. 1st grade can't go lower, so its pick-a-word and
   spelling questions drop to 3 choices. */
const TAP_TYPES = new Set(['tap_pos', 'spell_fix']);
export const isTap = q => TAP_TYPES.has(q.type);

export function makeKick(ctx) {
  const { grade, idx, rng } = ctx;
  const team = TEAMS[idx];
  const cg = contentGrade(grade);
  const formats = formatsFor(idx, cg);
  const spell = rng() < team.spell;
  const fmt = weightedPick(rng, spell ? formats.spell : formats.pos, f => f.w).type;
  const q = buildQuestionWith(fmt, { ...ctx, grade: cg }, { focus: team.focus });
  if (grade === 1) trimChoices(q, rng, 3);
  q.kick = KICK_NAMES[q.type];
  ctx.used?.add(q.key);
  return q;
}

function trimChoices(q, rng, n) {
  if (q.type !== 'pick_pos' && q.type !== 'spell_pick') return;
  if (q.choices.length <= n) return;
  const before = q.choices.map(c => c.label).join(', ');
  const right = q.choices.find(c => c.correct);
  const keep = new Set([right, ...shuffle(rng, q.choices.filter(c => !c.correct)).slice(0, n - 1)]);
  q.choices = q.choices.filter(c => keep.has(c));
  q.speak = q.speak.replace(before, q.choices.map(c => c.label).join(', '));
}

/* A star clears away wrong answers. Multiple choice keeps the right answer
   and one wrong one. Tap-a-word keeps the right word(s) and two wrong ones.
   Returns the choice indexes to remove. */
export function starHelp(q, rng) {
  const wrong = q.choices.map((c, i) => (c.correct ? -1 : i)).filter(i => i >= 0);
  const keep = isTap(q) ? 2 : 1;
  return shuffle(rng, wrong).slice(keep);
}

/* ------------------------------------------------------------ shootout --
   Five kicks each, you first. Your kick: right answer scores. Their kick:
   right answer and you save it. Real shootout rules: it ends as soon as one
   side can't catch up, and a tie after five goes to sudden death, a kick
   each until one scores and the other doesn't.
   The maths is done here before any animation, so a picture can never
   change a result. */
export const KICKS = 5;
export const QUICK_SHARE = 0.35;   // answered in the first 35% of the clock
export const STREAK_FOR_STAR = 3;
export const MAX_STARS = 3;

export function createMatch(grade, idx) {
  return {
    grade, idx, stats: teamStats(idx, grade),
    you: [], them: [],       // one true/false per kick taken: did it go in?
    turn: 'you',             // who kicks next
    sudden: false,
    stars: 0, streak: 0, bestStreak: 0,
    right: 0, wrong: 0,
    phase: 'kicks',          // 'kicks' | 'over'
    result: null,            // 'win' | 'lose'
    misses: [],              // { prompt, answer, explain } for the review
  };
}

export const goals = arr => arr.filter(Boolean).length;

export function useStar(m) {
  if (m.stars <= 0) return false;
  m.stars--;
  return true;
}

/* answer = { correct, timedOut, share } where share is how much of the clock
   was used (0..1), or null when the clock is off. Returns a list of events. */
export function resolveKick(m, answer) {
  if (m.phase === 'over') throw new Error('resolveKick after the final whistle');
  const ev = [];
  const { correct } = answer;
  const share = answer.share ?? null;

  if (correct) {
    m.right++;
    m.streak++;
    m.bestStreak = Math.max(m.bestStreak, m.streak);
  } else {
    m.wrong++;
    m.streak = 0;
  }

  if (m.turn === 'you') {
    const slowSave = correct && share !== null && m.stats.reach > 0 && share > 1 - m.stats.reach;
    const goal = correct && !slowSave;
    m.you.push(goal);
    ev.push({
      type: 'shot', goal,
      quick: goal && share !== null && share < QUICK_SHARE,
      reason: goal ? null : slowSave ? 'slow' : answer.timedOut ? 'timeout' : 'wrong',
    });
    m.turn = 'them';
  } else {
    m.them.push(!correct);
    ev.push({ type: 'theirShot', saved: correct, timedOut: !!answer.timedOut });
    m.turn = 'you';
  }

  if (correct && m.streak % STREAK_FOR_STAR === 0 && m.stars < MAX_STARS) {
    m.stars++;
    ev.push({ type: 'star' });
  }

  const y = goals(m.you), t = goals(m.them);
  const ny = m.you.length, nt = m.them.length;
  let result = null;
  if (!m.sudden) {
    if (y > t + (KICKS - nt)) result = 'win';
    else if (t > y + (KICKS - ny)) result = 'lose';
    else if (ny === KICKS && nt === KICKS) {
      m.sudden = true;
      ev.push({ type: 'suddenDeath' });
    }
  } else if (ny === nt && y !== t) {
    result = y > t ? 'win' : 'lose';
  }
  if (result) {
    m.phase = 'over';
    m.result = result;
    ev.push({ type: 'final', result });
  }
  return ev;
}

/* ------------------------------------------------------------- profile --
   What a player carries between matches. Plain JSON for localStorage. */
export const clampGrade = g => Math.min(8, Math.max(1, Math.round(Number(g)) || 1));
export const clampNumber = n => Math.min(99, Math.max(1, Math.round(Number(n)) || 10));

export function newProfile({ name, grade, kit, number }) {
  const g = clampGrade(grade);
  return {
    id: `k${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: String(name || 'Striker').slice(0, 16),
    grade: g,
    kit: kit || 'argentina',
    number: clampNumber(number),
    created: Date.now(),
    // Read-aloud defaults on while the questions are 1st/2nd grade level.
    settings: { clock: true, readAloud: contentGrade(g) <= 2, sound: true },
    progress: {},      // grade -> { next, cups: [cup ids] }
    stats: {},         // skill -> { right, wrong }
    missed: {},        // item key -> how many more rights it needs
    misses: [],        // recent misses for the coach's corner
    matches: 0, wins: 0,
  };
}

export function progressFor(profile, grade) {
  const p = profile.progress[grade] || { next: 0, cups: [] };
  profile.progress[grade] = p;
  return p;
}

/* A match is over: move the ladder on and hand out a trophy if one was won. */
export function finishMatch(profile, grade, idx, won) {
  profile.matches++;
  const out = { cup: null, gradeChamp: false, nextUnlocked: null };
  if (!won) return out;
  profile.wins++;
  const p = progressFor(profile, grade);
  if (idx + 1 > p.next) {
    p.next = Math.min(TEAMS.length, idx + 1);
    if (p.next < TEAMS.length) out.nextUnlocked = p.next;
  }
  const cup = cupOf(idx);
  if (TEAMS[idx].champion && !p.cups.includes(cup.id)) {
    p.cups.push(cup.id);
    out.cup = cup;
    out.gradeChamp = cup.id === 'golden';
  }
  return out;
}
