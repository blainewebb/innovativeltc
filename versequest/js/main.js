/* Verse Quest — every screen and the lesson loop. The rules live in
   engine.js; this file shows exercises, collects taps, and reports what the
   engine says happened. */
import { VERSION, VERSES, TRIVIA, CATEGORIES, BADGES, COLORS, NIV_NOTICE } from './data.js';
import {
  makeRng, dayStr, isDay, norm, verseById, buildLesson, buildReview, allowance, newProfile,
  vstate, plan, startVerse, canStart, stepsLeftToday, finishLesson, finishReview, finishPractice,
  pickTrivia, triviaChoices, recordTrivia, finishTrivia, currentStreak, summary, masteredIds,
  STEPS, STEPS_PER_DAY, MAX_ACTIVE, GOLD_BOX, GOALS, ROUND_SIZE,
} from './engine.js';
import { load, save } from './storage.js';
import { sfx, setEnabled as setSound, speak, stopSpeaking, canSpeak } from './sfx.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const rng = makeRng(TEST && params.get('seed') ? Number(params.get('seed')) : Date.now());
const wait = ms => new Promise(r => setTimeout(r, TEST ? 0 : ms));
// Tests can pin the date with ?test&day=2026-10-02.
const today = () => (TEST && isDay(params.get('day')) ? params.get('day') : dayStr());

let state = load();
const me = () => state.players.find(b => b.id === state.current) || null;
const persist = () => save(state);

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function view(html, cls = '') {
  stopSpeaking();
  app.className = cls;
  app.innerHTML = html;
  window.scrollTo(0, 0);
  if (TEST) window.__vq.screen = cls;
}
const $ = sel => app.querySelector(sel);
const $$ = sel => [...app.querySelectorAll(sel)];
function on(sel, fn) { $$(sel).forEach(el => el.addEventListener('click', e => { sfx.tap(); fn(e, el); })); }
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/* ------------------------------------------------------------------ art -- */
const ICON = {
  flame: c => `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path fill="${c}" d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3-1-3 0-6 1-9.5z"/></svg>`,
  star: c => `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path fill="${c}" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>`,
  lamp: c => `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path fill="${c}" d="M4 14c0-2 3-3 7-3h2c3 0 5-2 7-3-1 3-2 6-6 7l-1 2H8l-1-2c-2 0-3-.5-3-1zm7-5c-1-1-1-2.5 0-4 1 1.5 1 3 0 4zM8 18h7v2H8z"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4zM16 8a5 5 0 0 1 0 8l-1-1.4a3.3 3.3 0 0 0 0-5.2zM18.5 5.5a8.5 8.5 0 0 1 0 13l-1-1.4a6.8 6.8 0 0 0 0-10.2z"/></svg>`,
  badge: (c, on) => `<svg viewBox="0 0 48 48" class="badge-ico" aria-hidden="true"><circle cx="24" cy="20" r="15" fill="${on ? c : '#d6d3e8'}"/><path d="M16 32l-4 12 8-4 4 6 4-6 8 4-4-12" fill="${on ? '#b45309' : '#c4c1da'}"/><path fill="#fff" opacity="${on ? 1 : .6}" d="M24 10l2.6 5.4 6 .8-4.4 4.1 1.1 5.9L24 23.3l-5.3 2.9 1.1-5.9-4.4-4.1 6-.8z"/></svg>`,
};

function speakBtn(text, id = 'say') {
  return canSpeak() ? `<button class="iconbtn" id="${id}" data-say="${esc(text)}" aria-label="Read it out loud">${ICON.speaker}</button>` : '';
}
function wireSpeak() { $$('[data-say]').forEach(el => el.addEventListener('click', () => speak(el.dataset.say))); }

/* ================================================================ title == */
function title() {
  if (!state.players.length) return newPlayer(true);
  view(`<div class="screen">
    <div class="brand">${ICON.lamp('#f59e0b')}<h1>Verse Quest</h1></div>
    <p class="tag">Hide God's word in your heart, one step at a time.</p>
    <h2 class="sub">Who's playing?</h2>
    <div class="player-list">
      ${state.players.map(p => {
        const s = summary(p, today());
        return `<button class="player-btn" data-id="${esc(p.id)}">
          <span class="dot" style="background:${esc(p.color)}">${esc(p.name[0].toUpperCase())}</span>
          <span class="pname">${esc(p.name)}</span>
          <span class="pmeta">${plural(s.mastered, 'verse')} memorized &middot; ${s.streak} day streak</span>
        </button>`;
      }).join('')}
    </div>
    <button class="btn ghost" id="add">+ Add a player</button>
    ${state.readOnly ? '<p class="warn">This browser is not letting the game save. Progress will be lost when you close it.</p>' : ''}
    <p class="notice">${esc(NIV_NOTICE)}</p>
    <p class="version">v${VERSION}</p>
  </div>`, 'bg-title');
  on('.player-btn', (e, el) => { state.current = el.dataset.id; persist(); home(); });
  on('#add', () => newPlayer(false));
}

function newPlayer(first) {
  let color = COLORS[state.players.length % COLORS.length];
  view(`<div class="screen">
    ${first ? `<div class="brand">${ICON.lamp('#f59e0b')}<h1>Verse Quest</h1></div>
      <p class="tag">Learn Bible verses a little each day, and see how much Bible trivia you know.</p>` : ''}
    <h2>New player</h2>
    <label class="field">Your name
      <input id="name" maxlength="16" autocomplete="off" placeholder="Your name">
    </label>
    <div class="field">Pick a color
      <div class="swatches">${COLORS.map(c => `<button class="swatch${c === color ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="color"></button>`).join('')}</div>
    </div>
    <button class="btn primary big" id="create">Start my quest</button>
    ${first ? `<p class="notice">${esc(NIV_NOTICE)}</p>` : '<button class="btn ghost" id="back">Back</button>'}
  </div>`, 'bg-title');
  on('.swatch', (e, el) => { color = el.dataset.c; $$('.swatch').forEach(s => s.classList.toggle('on', s === el)); });
  on('#back', title);
  on('#create', () => {
    const name = $('#name').value.trim();
    if (!name) { $('#name').focus(); $('#name').classList.add('shake'); return; }
    const p = newProfile({ name, color });
    state.players.push(p);
    state.current = p.id;
    persist();
    home();
  });
  $('#name').focus();
}

/* ================================================================= home == */
function header(p) {
  const s = summary(p, today());
  return `<header class="bar">
    <button class="who" id="who" style="--c:${esc(p.color)}"><span class="dot small" style="background:${esc(p.color)}">${esc(p.name[0].toUpperCase())}</span>${esc(p.name)}</button>
    <span class="pill" title="Day streak">${ICON.flame(s.streak ? '#f97316' : '#c4c1da')}<b id="streak">${s.streak}</b></span>
    <span class="pill" title="Stars">${ICON.star('#f59e0b')}<b id="stars">${p.stars}</b></span>
  </header>`;
}

function goalBar(p) {
  const s = summary(p, today());
  const pct = Math.min(100, Math.round(100 * s.today / s.goal));
  const done = s.today >= s.goal;
  return `<div class="goal${done ? ' done' : ''}">
    <div class="goal-top"><b>${done ? 'Daily goal done!' : "Today's goal"}</b><span>${Math.min(s.today, s.goal)} / ${s.goal}</span></div>
    <div class="meter"><i style="width:${pct}%"></i></div>
    ${s.freezes ? `<small class="muted">${plural(s.freezes, 'streak saver')} ready. If you miss one day, your streak is safe.</small>` : ''}
  </div>`;
}

function home() {
  const p = me();
  if (!p) return title();
  setSound(p.settings.sound);
  const t = today();
  const pl = plan(p, t);
  const cards = [];
  for (const id of pl.reviews) {
    const v = verseById(id);
    cards.push(`<button class="card review" data-act="review" data-id="${id}">
      <span class="kicker">Review</span><span class="ctitle">${esc(v.ref)}</span>
      <span class="cmeta">Keep this verse strong</span></button>`);
  }
  for (const id of pl.lessons) {
    const v = verseById(id), s = vstate(p, id);
    cards.push(`<button class="card lesson" data-act="lesson" data-id="${id}">
      <span class="kicker">Step ${s.stage + 1} of ${STEPS}</span><span class="ctitle">${esc(v.ref)}</span>
      ${steps(s.stage)}</button>`);
  }
  if (pl.next) {
    cards.push(`<button class="card new" data-act="start" data-id="${pl.next.id}">
      <span class="kicker">New verse</span><span class="ctitle">${esc(pl.next.ref)}</span>
      <span class="cmeta">${esc(firstWords(pl.next.text, 6))}</span></button>`);
  }
  cards.push(`<button class="card trivia" data-act="trivia">
    <span class="kicker">Bible trivia</span><span class="ctitle">Quick round</span>
    <span class="cmeta">${ROUND_SIZE} questions</span></button>`);
  const waiting = pl.waiting.length
    ? `<p class="muted small center">${pl.waiting.map(id => esc(verseById(id).ref)).join(' and ')}: come back tomorrow for the next step. Your brain needs a night's sleep to lock it in!</p>` : '';

  view(`<div class="screen">
    ${header(p)}
    ${goalBar(p)}
    <div class="cards">${cards.join('')}</div>
    ${waiting}
    <nav class="nav">
      <button class="btn ghost" id="verses">My verses</button>
      <button class="btn ghost" id="badges">Badges</button>
      <button class="btn ghost" id="grown">Grown-ups</button>
    </nav>
  </div>`, 'bg-home');
  on('[data-act="review"]', (e, el) => runSession('review', el.dataset.id));
  on('[data-act="lesson"]', (e, el) => runSession('lesson', el.dataset.id));
  on('[data-act="start"]', (e, el) => { startVerse(p, el.dataset.id); persist(); runSession('lesson', el.dataset.id); });
  on('[data-act="trivia"]', () => trivia());
  on('#verses', verseList);
  on('#badges', badges);
  on('#grown', grownups);
  on('#who', title);
}

const firstWords = (text, n) => { const w = text.split(/\s+/); return w.slice(0, n).join(' ') + (w.length > n ? ' …' : ''); };
const steps = done => `<span class="steps">${Array.from({ length: STEPS }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('')}</span>`;

/* ============================================================== session == */
/* Runs a lesson, review or practice: a short list of exercises, then the
   result. Mistakes add up across the exercises. */
async function runSession(mode, id) {
  const p = me();
  const verse = verseById(id);
  const s = vstate(p, id);
  const t = today();
  if (mode === 'lesson' && stepsLeftToday(p, id, t) === 0) return home();
  const exercises = mode === 'lesson' ? buildLesson(verse, s.stage + 1, rng) : buildReview(verse, mode === 'practice' ? GOLD_BOX : s.box, rng);
  const ctx = { mistakes: 0, quit: false };
  for (let i = 0; i < exercises.length; i++) {
    await exercise(exercises[i], verse, ctx, { i, n: exercises.length, mode, step: s.stage + 1 });
    if (ctx.quit) return home();
  }
  const res = mode === 'lesson' ? finishLesson(p, id, ctx.mistakes, t)
    : mode === 'review' ? finishReview(p, id, ctx.mistakes, t)
      : finishPractice(p, t);
  persist();
  result(mode, verse, res, ctx.mistakes);
}

function sessionTop(meta, title) {
  const pct = Math.round(100 * meta.i / meta.n);
  return `<div class="stop">
    <button class="iconbtn" id="quit" aria-label="Stop">&times;</button>
    <div class="meter thin"><i style="width:${pct}%"></i></div>
  </div>
  <p class="kicker center">${esc(title)}</p>`;
}

function exercise(ex, verse, ctx, meta) {
  return new Promise(resolve => {
    const label = meta.mode === 'lesson' ? `${verse.ref} · Step ${meta.step} of ${STEPS}` : `${verse.ref} · ${meta.mode === 'review' ? 'Review' : 'Practice'}`;
    const done = () => resolve();
    const miss = el => {
      ctx.mistakes++;
      sfx.wrong();
      if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake', 'bad'); }
    };
    const ui = { label: sessionTop(meta, label), done, miss, ctx };
    if (ex.type === 'read') exRead(ex, verse, ui);
    else if (ex.type === 'blanks') exBlanks(ex, verse, ui);
    else if (ex.type === 'order') exOrder(ex, verse, ui);
    else if (ex.type === 'next') exNext(ex, verse, ui);
    else if (ex.type === 'ref') exRef(ex, verse, ui);
    on('#quit', () => {
      if (confirm('Stop this lesson? Your progress on this step will not be saved.')) { ctx.quit = true; resolve(); }
    });
    wireSpeak();
  });
}

/* Read it ----------------------------------------------------------------- */
function exRead(ex, verse, ui) {
  view(`<div class="screen">
    ${ui.label}
    <h2 class="prompt">Read this verse out loud two times.</h2>
    <div class="verse big"><p>${esc(verse.text)}</p><p class="ref">${esc(verse.ref)}</p></div>
    ${canSpeak() ? `<button class="btn" id="listen">${ICON.speaker} Read it to me</button>` : ''}
    <button class="btn primary big" id="go">I read it!</button>
  </div>`, 'bg-ex');
  if (TEST) window.__vq.ex = { type: 'read', right: '#go' };
  on('#listen', () => speak(`${verse.text} ${verse.ref}`));
  on('#go', ui.done);
  if (me().settings.readAloud) speak(`${verse.text} ${verse.ref}`);
}

/* Fill the blanks --------------------------------------------------------- */
function exBlanks(ex, verse, ui) {
  let pos = 0;
  const filled = new Set();
  const line = () => ex.tokens.map((tok, i) => {
    const h = ex.holes.indexOf(i);
    if (h < 0) return `<span class="w">${esc(tok.t)}</span>`;
    if (h < pos) return `<span class="w got">${esc(tok.t)}</span>`;
    return `<span class="hole${h === pos ? ' cur' : ''}">${' '.repeat(Math.max(4, tok.c.length))}</span>`;
  }).join(' ');
  view(`<div class="screen">
    ${ui.label}
    <h2 class="prompt">Tap the missing words in order.</h2>
    <div class="verse"><p id="line">${line()}</p><p class="ref">${esc(verse.ref)}</p></div>
    <div class="bank">${ex.bank.map((b, i) => `<button class="tile" data-i="${i}">${esc(b.c)}</button>`).join('')}</div>
  </div>`, 'bg-ex');
  const expect = () => {
    const want = ex.tokens[ex.holes[pos]]?.n;
    const i = ex.bank.findIndex((b, k) => !filled.has(k) && b.n === want);
    const j = ex.bank.findIndex((b, k) => !filled.has(k) && b.n !== want);
    window.__vq.ex = { type: 'blanks', right: `.tile[data-i="${i}"]`, wrong: j < 0 ? null : `.tile[data-i="${j}"]` };
  };
  if (TEST) expect();
  $$('.tile').forEach(el => el.addEventListener('click', () => {
    const i = Number(el.dataset.i);
    if (filled.has(i)) return;
    if (ex.bank[i].n === ex.tokens[ex.holes[pos]].n) {
      sfx.right();
      filled.add(i);
      el.disabled = true;
      el.classList.add('used');
      pos++;
      $('#line').innerHTML = line();
      if (pos >= ex.holes.length) return wait(500).then(ui.done);
      if (TEST) expect();
    } else ui.miss(el);
  }));
}

/* Put it in order --------------------------------------------------------- */
function exOrder(ex, verse, ui) {
  const canon = ex.tiles.slice().sort((a, b) => a.k - b.k);
  let placed = 0;
  const used = new Set();
  view(`<div class="screen">
    ${ui.label}
    <h2 class="prompt">Put the verse in order.</h2>
    <div class="verse"><p id="built" class="built"><span class="muted">Tap the first part&hellip;</span></p><p class="ref">${esc(verse.ref)}</p></div>
    <div class="bank col">${ex.tiles.map((t, i) => `<button class="tile wide" data-i="${i}">${esc(t.text)}</button>`).join('')}</div>
  </div>`, 'bg-ex');
  const expect = () => {
    const want = canon[placed]?.n;
    const i = ex.tiles.findIndex((t, k) => !used.has(k) && t.n === want);
    const j = ex.tiles.findIndex((t, k) => !used.has(k) && t.n !== want);
    window.__vq.ex = { type: 'order', right: `.tile[data-i="${i}"]`, wrong: j < 0 ? null : `.tile[data-i="${j}"]` };
  };
  if (TEST) expect();
  $$('.tile').forEach(el => el.addEventListener('click', () => {
    const i = Number(el.dataset.i);
    if (used.has(i)) return;
    if (ex.tiles[i].n === canon[placed].n) {
      sfx.right();
      used.add(i);
      el.disabled = true;
      el.classList.add('used');
      placed++;
      $('#built').innerHTML = canon.slice(0, placed).map(t => `<span class="w got">${esc(t.text)}</span>`).join(' ');
      if (placed >= canon.length) return wait(600).then(ui.done);
      if (TEST) expect();
    } else ui.miss(el);
  }));
}

/* Next word --------------------------------------------------------------- */
function exNext(ex, verse, ui) {
  let pos = 0;
  const hidden = tok => ex.hint === 'letters'
    ? `<span class="hole letters">${esc(tok.c[0])}${' '.repeat(Math.max(2, tok.c.length - 1))}</span>`
    : `<span class="hole">${' '.repeat(4)}</span>`;
  const line = () => ex.tokens.map((tok, i) => i < pos ? `<span class="w got">${esc(tok.t)}</span>`
    : i === pos ? hidden(tok).replace('class="hole', 'class="hole cur') : hidden(tok)).join(' ');
  const choices = () => ex.options[pos].map((w, i) => `<button class="choice" data-i="${i}">${esc(w)}</button>`).join('');
  view(`<div class="screen">
    ${ui.label}
    <h2 class="prompt">${ex.hint === 'letters' ? 'Pick each next word. The first letters will help.' : 'Say it from memory! Pick each next word.'}</h2>
    <div class="verse"><p id="line">${line()}</p><p class="ref">${esc(verse.ref)}</p></div>
    <div class="choices row" id="choices">${choices()}</div>
  </div>`, 'bg-ex');
  const expect = () => {
    const want = ex.tokens[pos].n;
    const i = ex.options[pos].findIndex(w => norm(w) === want);
    const j = ex.options[pos].findIndex(w => norm(w) !== want);
    window.__vq.ex = { type: 'next', right: `.choice[data-i="${i}"]`, wrong: `.choice[data-i="${j}"]` };
  };
  const wire = () => {
    if (TEST) expect();
    $$('#choices .choice').forEach(el => el.addEventListener('click', () => {
      if (el.disabled) return;
      if (norm(ex.options[pos][Number(el.dataset.i)]) === ex.tokens[pos].n) {
        sfx.tap();
        pos++;
        $('#line').innerHTML = line();
        if (pos >= ex.tokens.length) { sfx.right(); return wait(600).then(ui.done); }
        $('#choices').innerHTML = choices();
        wire();
      } else { ui.miss(el); el.disabled = true; }
    }));
  };
  wire();
}

/* Where is it found? ------------------------------------------------------ */
function exRef(ex, verse, ui) {
  const q = ex.mode === 'where' ? 'Where is this verse found?' : `Which verse is ${esc(verse.ref)}?`;
  view(`<div class="screen">
    ${ui.label}
    <h2 class="prompt">${q}</h2>
    ${ex.mode === 'where' ? `<div class="verse"><p>${esc(ex.prompt)}</p></div>` : ''}
    <div class="choices">${ex.choices.map((c, i) => `<button class="choice${ex.mode === 'which' ? ' long' : ''}" data-i="${i}">${esc(c.label)}</button>`).join('')}</div>
  </div>`, 'bg-ex');
  if (TEST) window.__vq.ex = { type: 'ref', right: `.choice[data-i="${ex.choices.findIndex(c => c.correct)}"]`, wrong: `.choice[data-i="${ex.choices.findIndex(c => !c.correct)}"]` };
  $$('.choice').forEach(el => el.addEventListener('click', () => {
    if (el.disabled) return;
    if (ex.choices[Number(el.dataset.i)].correct) {
      sfx.right();
      el.classList.add('good');
      $$('.choice').forEach(b => { b.disabled = true; });
      wait(700).then(ui.done);
    } else { ui.miss(el); el.disabled = true; }
  }));
}

/* Result ------------------------------------------------------------------ */
function result(mode, verse, res, mistakes) {
  const p = me();
  let head, body;
  if (mode === 'lesson' && res.mastered) {
    sfx.big();
    head = 'Verse memorized!';
    body = `You learned all ${STEPS} steps of ${esc(verse.ref)}. It will come back for a quick review tomorrow so you don't forget it.`;
  } else if (mode === 'lesson' && res.passed) {
    sfx.step();
    head = `Step ${res.step} done!`;
    const left = stepsLeftToday(p, verse.id, today());
    body = left ? 'You can do the next step now, or come back later.' : 'Come back tomorrow for the next step.';
  } else if (mode === 'lesson') {
    sfx.soft();
    head = 'So close!';
    body = `That was ${plural(mistakes, 'mistake')}. Read the verse again, then try this step one more time.`;
  } else if (mode === 'review' && res.passed) {
    sfx.step();
    head = res.gold ? 'Gold verse!' : 'Still got it!';
    body = res.gold ? `${esc(verse.ref)} is locked in. It turned gold!` : `Next review in ${plural(daysUntil(res.due), 'day')}.`;
  } else if (mode === 'review') {
    sfx.soft();
    head = 'Let’s practice this one more';
    body = 'Read it a few times. It will come back tomorrow.';
  } else {
    sfx.step();
    head = 'Nice practice!';
    body = 'Practicing helps verses stick.';
  }
  view(`<div class="screen center-col">
    <h1 class="big-head">${head}</h1>
    <p>${body}</p>
    <div class="verse"><p>${esc(verse.text)}</p><p class="ref">${esc(verse.ref)}</p></div>
    ${speakBtn(`${verse.text} ${verse.ref}`)}
    ${rewards(res)}
    <button class="btn primary big" id="next">Continue</button>
  </div>`, res.passed ? 'bg-win' : 'bg-soft');
  wireSpeak();
  on('#next', home);
}

const daysUntil = d => Math.max(1, Math.round((new Date(d + 'T12:00') - new Date(today() + 'T12:00')) / 86400000));

function rewards(res) {
  const out = [];
  if (res.stars) out.push(`<span class="pill">${ICON.star('#f59e0b')}+${res.stars}</span>`);
  if (res.goalHit) out.push(`<span class="pill hot">${ICON.flame('#f97316')}Daily goal done! ${currentStreak(me(), today())} day streak</span>`);
  if (res.froze) out.push('<span class="pill">A streak saver kept your streak going</span>');
  for (const id of res.badges || []) {
    const b = BADGES.find(x => x.id === id);
    out.push(`<div class="newbadge">${ICON.badge('#f59e0b', true)}<div><b>New badge: ${esc(b.name)}</b><small>${esc(b.desc)}</small></div></div>`);
  }
  return `<div class="rewards">${out.join('')}</div>`;
}

/* ================================================================ trivia == */
function trivia(cat = null) {
  const p = me();
  const qs = pickTrivia(p, rng, ROUND_SIZE, cat);
  let i = 0, right = 0;
  const ask = () => {
    const q = qs[i];
    const choices = triviaChoices(q, rng);
    view(`<div class="screen">
      <div class="stop">
        <button class="iconbtn" id="quit" aria-label="Stop">&times;</button>
        <div class="meter thin"><i style="width:${Math.round(100 * i / qs.length)}%"></i></div>
      </div>
      <p class="kicker center">${esc(CATEGORIES[q.cat])} &middot; ${i + 1} of ${qs.length}</p>
      <div class="qrow"><h2 class="prompt">${esc(q.q)}</h2>${speakBtn(q.q)}</div>
      <div class="choices">${choices.map((c, k) => `<button class="choice" data-i="${k}">${esc(c.label)}</button>`).join('')}</div>
      <div id="fb"></div>
    </div>`, 'bg-ex');
    wireSpeak();
    if (p.settings.readAloud) speak(q.q);
    if (TEST) window.__vq.ex = { type: 'trivia', right: `.choice[data-i="${choices.findIndex(c => c.correct)}"]`, wrong: `.choice[data-i="${choices.findIndex(c => !c.correct)}"]` };
    on('#quit', () => { if (!i || confirm('Stop this trivia round?')) home(); });
    $$('.choice').forEach(el => el.addEventListener('click', () => {
      const k = Number(el.dataset.i);
      const ok = choices[k].correct;
      recordTrivia(p, q.id, ok);
      if (ok) { right++; sfx.right(); } else sfx.wrong();
      $$('.choice').forEach((b, n) => {
        b.disabled = true;
        if (choices[n].correct) b.classList.add('good');
        else if (n === k) b.classList.add('bad');
      });
      $('#fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}">
        <b>${ok ? 'Right!' : `The answer is: ${esc(q.a)}`}</b>
        <p>${esc(q.why)}</p>
        ${q.ref ? `<p class="ref">${esc(q.ref)}</p>` : ''}
        <button class="btn primary" id="ok">${i + 1 < qs.length ? 'Next' : 'Finish'}</button>
      </div>`;
      if (TEST) window.__vq.ex = { type: 'feedback', right: '#ok' };
      persist();
      on('#ok', () => { i++; if (i < qs.length) ask(); else done(); });
      $('#ok').scrollIntoView?.({ block: 'nearest' });
    }));
  };
  const done = () => {
    const res = finishTrivia(p, right, qs.length, today());
    persist();
    if (res.perfect) sfx.big(); else sfx.step();
    view(`<div class="screen center-col">
      <h1 class="big-head">${res.perfect ? 'Perfect round!' : right >= qs.length - 1 ? 'Great job!' : 'Round done!'}</h1>
      <p class="score">${right} / ${qs.length}</p>
      <p class="muted">Questions you miss come back more often, so you'll get another try.</p>
      ${rewards(res)}
      <button class="btn primary big" id="again">Play another round</button>
      <button class="btn ghost" id="home">Home</button>
    </div>`, 'bg-win');
    on('#again', () => trivia(cat));
    on('#home', home);
  };
  ask();
}

/* ============================================================ my verses == */
function verseList() {
  const p = me();
  const t = today();
  const status = v => {
    const s = vstate(p, v.id);
    if (!s) return { cls: 'todo', label: 'Not started' };
    if (s.stage < STEPS) return { cls: 'active', label: `Step ${s.stage} of ${STEPS}` };
    if (s.box >= GOLD_BOX) return { cls: 'gold', label: 'Gold' };
    return { cls: 'done', label: s.due <= t ? 'Review today' : 'Memorized' };
  };
  view(`<div class="screen">
    ${header(p)}
    <h2>My verses</h2>
    <p class="muted small">${plural(masteredIds(p).length, 'verse')} memorized out of ${VERSES.length}. You can work on ${MAX_ACTIVE} new verses at a time.</p>
    <div class="vlist">${VERSES.map(v => { const st = status(v); return `<button class="vrow ${st.cls}" data-id="${v.id}">
      <span class="vref">${esc(v.ref)}</span><span class="vstat">${st.label}</span></button>`; }).join('')}</div>
    <button class="btn ghost" id="home">Home</button>
  </div>`, 'bg-home');
  on('#who', title);
  on('#home', home);
  on('.vrow', (e, el) => verseDetail(el.dataset.id));
}

function verseDetail(id) {
  const p = me();
  const v = verseById(id);
  const s = vstate(p, id);
  const t = today();
  let actions = '';
  if (!s && canStart(p)) actions = '<button class="btn primary big" id="start">Start learning this verse</button>';
  else if (!s) actions = `<p class="muted small">Finish one of the verses you're learning first. You can work on ${MAX_ACTIVE} at a time.</p>`;
  else if (s.stage < STEPS && stepsLeftToday(p, id, t)) actions = `<button class="btn primary big" id="lesson">Do step ${s.stage + 1}</button>`;
  else if (s.stage < STEPS) actions = `<p class="muted small">You did ${STEPS_PER_DAY} steps on this verse today. Come back tomorrow!</p>`;
  else actions = '<button class="btn primary big" id="practice">Practice it</button>';
  view(`<div class="screen">
    <h2>${esc(v.ref)}</h2>
    <div class="verse big"><p>${esc(v.text)}</p><p class="ref">${esc(v.ref)}</p></div>
    ${s ? steps(s.stage) : ''}
    ${speakBtn(`${v.text} ${v.ref}`)}
    ${actions}
    <button class="btn ghost" id="back">Back</button>
  </div>`, 'bg-home');
  wireSpeak();
  on('#start', () => { startVerse(p, id); persist(); runSession('lesson', id); });
  on('#lesson', () => runSession('lesson', id));
  on('#practice', () => runSession('practice', id));
  on('#back', verseList);
}

/* =============================================================== badges == */
function badges() {
  const p = me();
  view(`<div class="screen">
    ${header(p)}
    <h2>Badges</h2>
    <div class="badges">${BADGES.map(b => { const has = p.badges.includes(b.id); return `<div class="bcard${has ? ' on' : ''}">
      ${ICON.badge('#f59e0b', has)}<b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`; }).join('')}</div>
    <button class="btn ghost" id="home">Home</button>
  </div>`, 'bg-home');
  on('#who', title);
  on('#home', home);
}

/* ============================================================ grown-ups == */
function grownups() {
  const p = me();
  const s = summary(p, today());
  const missed = Object.entries(p.trivia).filter(([, t]) => t.wrong > t.right)
    .map(([id]) => TRIVIA.find(q => q.id === id)).filter(Boolean).slice(0, 8);
  view(`<div class="screen">
    <h2>Grown-ups: ${esc(p.name)}</h2>
    <div class="stats">
      <div><b>${s.mastered}</b><small>verses memorized</small></div>
      <div><b>${s.gold}</b><small>gold (kept 3+ weeks)</small></div>
      <div><b>${s.active}</b><small>learning now</small></div>
      <div><b>${s.due}</b><small>reviews due</small></div>
      <div><b>${s.streak}</b><small>day streak (best ${s.best})</small></div>
      <div><b>${s.trivia === null ? '–' : s.trivia + '%'}</b><small>trivia right</small></div>
    </div>
    ${missed.length ? `<h3>Trivia to talk about</h3><ul class="missed">${missed.map(q => `<li>${esc(q.q)} <b>${esc(q.a)}</b>${q.ref ? ` <span class="muted">(${esc(q.ref)})</span>` : ''}</li>`).join('')}</ul>` : ''}
    <h3>Settings</h3>
    <label class="toggle"><input type="checkbox" id="sound" ${p.settings.sound ? 'checked' : ''}> Sound effects</label>
    ${canSpeak() ? `<label class="toggle"><input type="checkbox" id="aloud" ${p.settings.readAloud ? 'checked' : ''}> Read verses and questions out loud automatically</label>` : ''}
    <div class="field">Daily goal (activities per day)
      <div class="chips">${GOALS.map(g => `<button class="chip${g === p.settings.goal ? ' on' : ''}" data-g="${g}">${g}</button>`).join('')}</div>
      <small class="muted">One activity is a lesson step, a review, or a trivia round.</small>
    </div>
    <h3>How it works</h3>
    <p class="small">Each verse takes ${STEPS} short steps, at most ${STEPS_PER_DAY} a day, so it is spread over a few days. Once memorized, it comes back for review after 1, 3, 7, 14, 30 and 60 days. A verse kept through four reviews turns gold. Missing a review moves it back a little, not to the start.</p>
    <p class="small">Progress is saved only on this device and this browser.</p>
    <h3>Players</h3>
    <button class="btn" id="switch">Switch player</button>
    <button class="btn ghost" id="add">+ Add a player</button>
    <button class="btn ghost danger" id="del">Delete ${esc(p.name)}</button>
    <p class="notice">${esc(NIV_NOTICE)}</p>
    <button class="btn primary" id="home">Done</button>
  </div>`, 'bg-home');
  $('#sound').addEventListener('change', e => { p.settings.sound = e.target.checked; setSound(p.settings.sound); persist(); });
  $('#aloud')?.addEventListener('change', e => { p.settings.readAloud = e.target.checked; persist(); });
  on('.chip', (e, el) => { p.settings.goal = Number(el.dataset.g); persist(); grownups(); });
  on('#switch', title);
  on('#add', () => newPlayer(false));
  on('#del', () => {
    if (!confirm(`Delete ${p.name} and all of their progress? This cannot be undone.`)) return;
    state.players = state.players.filter(x => x.id !== p.id);
    state.current = state.players[0]?.id ?? null;
    persist();
    title();
  });
  on('#home', home);
}

/* ================================================================= boot == */
if (TEST) window.__vq = { state: () => state, ex: null, screen: '', today };
if (state.current && me()) home(); else title();

if ('serviceWorker' in navigator && !TEST && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
