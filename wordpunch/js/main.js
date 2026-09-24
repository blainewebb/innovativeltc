/* Word Punch — every screen, input handling, and the fight loop. The rules
   live in engine.js; this file asks questions, collects taps, and plays back
   whatever the engine says happened. */
import { VERSION, FIGHTERS, CIRCUITS, SKILLS, GLOVES } from './data.js';
import {
  makeRng, makeQuestion, createFight, resolveAnswer, resolveGetUp, newProfile,
  progressFor, recordAnswer, finishFight, accuracy, circuitOf, fighterStats, QUICK_SHARE, clampGrade,
} from './engine.js';
import { load, save } from './storage.js';
import { sfx, setEnabled as setSound, speak, stopSpeaking, canSpeak } from './sfx.js';
import { fighterSVG, faceSVG, playerSVG, beltSVG } from './art.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/* Tests run the animations at a fraction of real speed so a full fight
   takes seconds. Reduced motion shortens waits too, since there is nothing to
   watch. */
const SPEED = TEST ? 0.02 : reducedMotion ? 0.35 : 1;
const wait = ms => new Promise(r => setTimeout(r, ms * SPEED));
const rng = makeRng(TEST && params.get('seed') ? Number(params.get('seed')) : Date.now());

let state = load();
let fightToken = 0;          // bumps when a fight is abandoned, so its loop stops

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const me = () => state.boxers.find(b => b.id === state.current) || null;
const persist = () => save(state);

function view(html, cls = '') {
  stopSpeaking();
  app.className = cls;
  app.innerHTML = html;
  window.scrollTo(0, 0);
}
const $ = sel => app.querySelector(sel);
const $$ = sel => [...app.querySelectorAll(sel)];
function on(sel, fn) { $$(sel).forEach(el => el.addEventListener('click', e => { sfx.tap(); fn(e, el); })); }

/* ================================================================ title == */
function title() {
  if (!state.boxers.length) return newBoxer(true);
  view(`<div class="screen title-screen">
    <h1 class="logo"><span>WORD</span><span>PUNCH</span></h1>
    <p class="tag">Knock out nouns, verbs, adjectives and spelling. Win the belt!</p>
    <h2 class="sub">Who's boxing?</h2>
    <div class="boxer-list">
      ${state.boxers.map(b => {
        const belts = Object.values(b.progress).reduce((n, p) => n + p.belts.length, 0);
        return `<button class="boxer-btn" data-id="${esc(b.id)}">
          <span class="glove-dot" style="background:${esc(b.gloves)}"></span>
          <span class="bname">${esc(b.name)}</span>
          <span class="bmeta">Grade ${b.grade} &middot; ${belts} belt${belts === 1 ? '' : 's'}</span>
        </button>`;
      }).join('')}
    </div>
    <button class="btn ghost" id="add">+ New boxer</button>
    ${state.readOnly ? '<p class="warn">This browser is not letting the game save. Progress will be lost when you close it.</p>' : ''}
    <p class="version">v${VERSION}</p>
  </div>`, 'bg-title');
  on('.boxer-btn', (e, el) => { state.current = el.dataset.id; persist(); hub(); });
  on('#add', () => newBoxer(false));
}

function newBoxer(first) {
  let grade = 3, gloves = GLOVES[0];
  view(`<div class="screen form-screen">
    ${first ? '<h1 class="logo small"><span>WORD</span><span>PUNCH</span></h1>' : ''}
    <h2>New boxer</h2>
    <label class="field">Boxer name
      <input id="name" maxlength="16" autocomplete="off" placeholder="Kid Thunder">
    </label>
    <div class="field">What grade are you in?
      <div class="grade-pick">${[1, 2, 3, 4, 5, 6, 7, 8].map(g => `<button class="chip${g === grade ? ' on' : ''}" data-g="${g}">${g}</button>`).join('')}</div>
      <small>You can box in any grade later. This just picks where you start.</small>
    </div>
    <div class="field">Glove color
      <div class="glove-pick">${GLOVES.map(c => `<button class="swatch${c === gloves ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="glove color"></button>`).join('')}</div>
    </div>
    <button class="btn big" id="create">Step into the ring</button>
    ${first ? '' : '<button class="btn ghost" id="back">Back</button>'}
  </div>`, 'bg-title');
  on('.grade-pick .chip', (e, el) => { grade = Number(el.dataset.g); $$('.grade-pick .chip').forEach(c => c.classList.toggle('on', c === el)); });
  on('.swatch', (e, el) => { gloves = el.dataset.c; $$('.swatch').forEach(c => c.classList.toggle('on', c === el)); });
  on('#back', title);
  on('#create', () => {
    const name = $('#name').value.trim() || 'Kid Thunder';
    const p = newProfile({ name, grade, gloves });
    state.boxers.push(p);
    state.current = p.id;
    persist();
    hub();
  });
}

/* ================================================================== hub == */
let hubGrade = null;

function hub() {
  const b = me();
  if (!b) return title();
  setSound(b.settings.sound);
  const g = hubGrade && hubGrade >= 1 && hubGrade <= 8 ? hubGrade : b.grade;
  hubGrade = g;
  const prog = progressFor(b, g);
  const allBeaten = prog.next >= FIGHTERS.length;

  const card = i => {
    const f = FIGHTERS[i];
    const st = i < prog.next ? 'beaten' : i === prog.next ? 'next' : 'locked';
    return `<button class="fcard ${st}${f.champion ? ' champ' : ''}" data-i="${i}" ${st === 'locked' ? 'disabled' : ''}>
      <span class="fface">${faceSVG(f)}</span>
      <span class="finfo"><b>${esc(f.name)}</b>
        <small>${st === 'beaten' ? 'Beaten! Tap to rematch' : st === 'next' ? 'NEXT FIGHT' : 'Locked'}${f.champion ? ' &middot; Champion' : ''}</small></span>
      ${st === 'beaten' ? '<span class="check">&#10003;</span>' : ''}
    </button>`;
  };

  view(`<div class="screen hub">
    <header class="hub-top">
      <button class="me" id="switch"><span class="glove-dot" style="background:${esc(b.gloves)}"></span>${esc(b.name)}</button>
      <button class="btn small ghost" id="coach">Coach's Corner</button>
    </header>
    <div class="grade-tabs" role="tablist">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => {
      const belts = (b.progress[n]?.belts || []).length;
      return `<button class="gtab${n === g ? ' on' : ''}" data-g="${n}">Gr ${n}${belts ? `<i class="pips">${'&#9679;'.repeat(belts)}</i>` : ''}</button>`;
    }).join('')}</div>
    <div class="belt-row">${CIRCUITS.map(c => `<div class="belt-slot${prog.belts.includes(c.id) ? ' won' : ''}" title="${esc(c.belt)}">
      ${beltSVG(c.id, { small: true })}<span>${prog.belts.includes(c.id) ? esc(c.belt) : 'Not won yet'}</span></div>`).join('')}</div>
    ${CIRCUITS.map(c => `<section class="circuit">
      <h3>${esc(c.name)} <small>Grade ${g}</small></h3>
      <div class="ladder">${c.fighters.map(card).join('')}</div>
    </section>`).join('')}
    <div class="hub-cta">
      <button class="btn big punch" id="go">${allBeaten ? `Defend your title` : `Fight ${esc(FIGHTERS[prog.next].name)}!`}</button>
    </div>
  </div>`, 'bg-hub');

  on('.gtab', (e, el) => { hubGrade = Number(el.dataset.g); hub(); });
  on('.fcard', (e, el) => intro(g, Number(el.dataset.i)));
  on('#go', () => intro(g, allBeaten ? FIGHTERS.length - 1 : prog.next));
  on('#coach', coach);
  on('#switch', title);
}

/* ================================================================ intro == */
function intro(grade, idx) {
  const f = FIGHTERS[idx];
  const circuit = circuitOf(idx);
  const st = fighterStats(idx, grade);
  view(`<div class="screen intro">
    <div class="intro-card">
      <div class="intro-circuit">${esc(circuit.name)} &middot; Grade ${grade}${f.champion ? ' &middot; <b>TITLE FIGHT</b>' : ''}</div>
      <div class="intro-art">${fighterSVG(f)}</div>
      <h2 class="intro-name">${esc(f.name)}</h2>
      <div class="intro-meta"><span>From <b>${esc(f.from)}</b></span><span>Record <b>${esc(f.record)}</b></span></div>
      <blockquote>&ldquo;${esc(f.quote)}&rdquo;</blockquote>
      <div class="intro-special">Special move: <b>${esc(f.special)}</b></div>
      <ul class="intro-tips">
        <li>Right answer = <b>you punch</b>. Wrong or too slow = <b>you get hit</b>.</li>
        <li>3 right in a row earns a <b>&#9733; star</b>. Use it for a POWER PUNCH.</li>
        <li>Knock them down to win${st.getUps ? ` (champions get back up once!)` : ''}.</li>
      </ul>
    </div>
    <button class="btn big punch" id="fight">Let's box!</button>
    <button class="btn ghost" id="back">Back</button>
  </div>`, 'bg-intro');
  on('#fight', () => fight(grade, idx));
  on('#back', hub);
}

/* ================================================================ fight == */
function hpClass(hp) { return hp > 50 ? 'ok' : hp > 25 ? 'mid' : 'low'; }

function fight(grade, idx) {
  const b = me();
  const f = FIGHTERS[idx];
  const F = createFight(grade, idx);
  const used = new Set();
  const token = ++fightToken;
  const live = () => token === fightToken;

  view(`<div class="fight">
    <div class="hud">
      <div class="hp hp-you"><span class="nm">${esc(b.name)}</span><div class="bar"><i></i></div><span class="downs" aria-label="knockdowns"></span></div>
      <div class="stars" aria-label="stars"></div>
      <div class="hp hp-opp"><span class="nm">${esc(f.name)}</span><div class="bar"><i></i></div><span class="downs"></span></div>
    </div>
    <div class="ring">
      <div class="crowd"></div>
      <div class="ropes"><i></i><i></i><i></i></div>
      <div class="opp idle">${fighterSVG(f)}</div>
      <div class="fx"></div>
      <div class="player">${playerSVG(b.gloves)}</div>
      <div class="banner"></div>
      <button class="quit" id="quit" aria-label="Leave fight">&#10005;</button>
    </div>
    <div class="tell" aria-live="polite"></div>
    <div class="qpanel">
      <div class="timer"><i></i></div>
      <div class="prompt-row"><div class="prompt"></div>${canSpeak() ? '<button class="speak" id="speak" aria-label="Read it to me">&#128264;</button>' : ''}</div>
      <div class="sentence"></div>
      <div class="choices"></div>
      <div class="feedback" hidden></div>
      <button class="power" id="power" hidden>&#9733; POWER PUNCH</button>
    </div>
  </div>`, 'bg-fight');

  const oppEl = $('.ring .opp'), ringEl = $('.ring'), fxEl = $('.fx'), playerEl = $('.player');
  const bannerEl = $('.banner'), tellEl = $('.tell');
  const promptEl = $('.prompt'), sentEl = $('.sentence'), choicesEl = $('.choices');
  const timerEl = $('.timer i'), feedbackEl = $('.feedback'), powerEl = $('#power');
  let powerArmed = false;
  let current = null;

  on('#quit', () => {
    if (!confirm('Leave this fight? It will count as a loss.')) return;
    fightToken++;
    finishFight(b, grade, idx, false);
    persist();
    hub();
  });
  on('#speak', () => current && speak(current.speak));
  powerEl.addEventListener('click', () => {
    if (!F.stars) return;
    powerArmed = !powerArmed;
    sfx.tap();
    powerEl.classList.toggle('armed', powerArmed);
    powerEl.textContent = powerArmed ? '★ POWER PUNCH READY!' : '★ POWER PUNCH';
  });

  function hud() {
    const set = (sel, hp) => { const el = $(sel); el.style.width = `${hp}%`; el.className = hpClass(hp); };
    set('.hp.hp-you .bar i', F.youHp);
    set('.hp.hp-opp .bar i', F.oppHp);
    $('.hp.hp-you .downs').innerHTML = '<i class="d"></i>'.repeat(F.youDowns);
    $('.hp.hp-opp .downs').innerHTML = '<i class="d"></i>'.repeat(F.oppDowns);
    $('.stars').innerHTML = [0, 1, 2].map(i => `<span class="${i < F.stars ? 'on' : ''}">&#9733;</span>`).join('');
    powerEl.hidden = F.stars === 0 || F.phase !== 'fight';
    if (!F.stars) { powerArmed = false; }
    powerEl.classList.toggle('armed', powerArmed);
    powerEl.textContent = powerArmed ? '★ POWER PUNCH READY!' : '★ POWER PUNCH';
  }

  async function play(el, cls, ms) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    await wait(ms);
    el.classList.remove(cls);
  }
  async function banner(text, cls = '', ms = 900) {
    bannerEl.className = `banner show ${cls}`;
    bannerEl.textContent = text;
    await wait(ms);
    bannerEl.className = 'banner';
  }
  function pop(text, cls = '') {
    const el = document.createElement('div');
    el.className = `pop ${cls}`;
    el.textContent = text;
    fxEl.appendChild(el);
    setTimeout(() => el.remove(), 1100 * Math.max(SPEED, 0.2));
  }

  function renderQuestion(q, { getUp = false } = {}) {
    current = q;
    if (TEST) { window.__wp.q = q; window.__wp.n++; }
    promptEl.innerHTML = (getUp ? '<span class="getup-tag">GET UP!</span> ' : '') + esc(q.prompt);
    feedbackEl.hidden = true;
    feedbackEl.innerHTML = '';
    if (q.sentence) {
      sentEl.hidden = false;
      sentEl.innerHTML = q.sentence.map(t => {
        const text = t.text === '___' ? '<span class="blank">_____</span>' : esc(t.text);
        const inner = t.choice >= 0
          ? `<button class="tok" data-c="${t.choice}">${esc(t.lead)}${text}${esc(t.trail)}</button>`
          : `<span class="w${t.hl ? ' hl' : ''}">${esc(t.lead)}${text}${esc(t.trail)}</span>`;
        return inner;
      }).join(' ');
    } else {
      sentEl.hidden = true;
      sentEl.innerHTML = '';
    }
    const tapping = q.type === 'tap_pos' || q.type === 'spell_fix';
    choicesEl.innerHTML = tapping ? '' : q.choices.map((c, i) => `<button class="choice" data-c="${i}">${esc(c.label)}</button>`).join('');
    choicesEl.classList.toggle('two-col', !tapping && q.choices.length >= 4);
  }

  /* Wait for a tap or for the clock. Resolves { index, timedOut, elapsed }. */
  function answer(seconds) {
    return new Promise(resolve => {
      const start = performance.now();
      let done = false, raf = 0;
      const finish = res => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        $$('.choice, .tok').forEach(el => { el.disabled = true; });
        resolve({ ...res, elapsed: (performance.now() - start) / 1000 });
      };
      $$('.choice, .tok').forEach(el => el.addEventListener('click', () => finish({ index: Number(el.dataset.c), timedOut: false })));
      const timer = $('.timer');
      if (!seconds) {
        timer.classList.add('off');
        timerEl.style.width = '100%';
        return;
      }
      timer.classList.remove('off');
      const tick = () => {
        if (!live()) return finish({ index: -1, timedOut: true });
        const left = 1 - (performance.now() - start) / 1000 / seconds;
        timerEl.style.width = `${Math.max(0, left) * 100}%`;
        timerEl.className = left > 0.5 ? 'ok' : left > 0.25 ? 'mid' : 'low';
        if (left <= 0) return finish({ index: -1, timedOut: true });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
  }

  function markChoices(q, picked) {
    const els = q.type === 'tap_pos' || q.type === 'spell_fix' ? $$('.tok') : $$('.choice');
    els.forEach(el => {
      const c = q.choices[Number(el.dataset.c)];
      if (c.correct) el.classList.add('right');
      else if (Number(el.dataset.c) === picked) el.classList.add('wrong');
    });
  }

  /* After a miss the kid has to see the right answer and why. It waits for a
     tap, because a lesson that flashes past for a second is not a lesson. */
  function showFeedback(q, timedOut) {
    feedbackEl.hidden = false;
    feedbackEl.innerHTML = `<b>${timedOut ? 'Too slow!' : 'Not quite.'}</b> The answer: <b class="ans">${esc(q.answer)}</b>
      <p>${esc(q.explain)}</p><button class="btn small" id="ok">Got it!</button>`;
    feedbackEl.scrollIntoView({ block: 'end', behavior: reducedMotion ? 'auto' : 'smooth' });
    return new Promise(r => {
      const ok = feedbackEl.querySelector('#ok');
      ok.addEventListener('click', () => { sfx.tap(); feedbackEl.hidden = true; feedbackEl.innerHTML = ''; r(); }, { once: true });
      if (TEST) ok.dataset.test = 'ok';
    });
  }

  function clockFor() {
    if (!b.settings.clock) return 0;
    return F.stats.clock + (b.settings.readAloud ? 5 : 0);
  }

  async function playEvents(events) {
    for (const e of events) {
      if (!live()) return;
      if (e.type === 'jab' || e.type === 'uppercut') {
        const up = e.type === 'uppercut';
        up ? sfx.upper() : sfx.jab();
        const glove = rng() < 0.5 ? 'jab-l' : 'jab-r';
        play(playerEl, up ? 'upper' : glove, 380);
        await wait(140);
        oppEl.classList.remove('idle');
        play(oppEl, up ? 'rocked' : 'hurt', 450);
        pop(up ? `POW! -${e.dmg}` : `-${e.dmg}`, up ? 'big' : '');
        if (e.quick) pop('QUICK!', 'quick');
        hud();
        await wait(460);
        oppEl.classList.add('idle');
      } else if (e.type === 'star') {
        sfx.star();
        pop('★ STAR!', 'star');
        hud();
        await wait(350);
      } else if (e.type === 'hit') {
        oppEl.classList.remove('idle');
        await play(oppEl, 'windup', 260);
        sfx.hit();
        play(oppEl, 'punch', 360);
        await wait(150);
        play(ringEl, 'shake', 380);
        pop(e.timedOut ? 'TOO SLOW!' : 'OUCH!', 'ouch');
        if (e.lostStar) pop('Power punch missed!', 'ouch small');
        hud();
        await wait(400);
        oppEl.classList.add('idle');
      } else if (e.type === 'oppDown') {
        sfx.down();
        oppEl.classList.remove('idle');
        oppEl.classList.add('down');
        await banner('DOWN!', 'gold', 800);
        hud();
      } else if (e.type === 'oppUp') {
        for (const n of [1, 2, 3, 4, 5]) { sfx.count(); await banner(String(n), '', 260); }
        oppEl.classList.remove('down');
        oppEl.classList.add('idle');
        hud();
        await banner(`${f.name.split(' ').pop()} is back up!`, 'red', 1100);
      } else if (e.type === 'youDown') {
        sfx.down();
        playerEl.classList.add('down');
        ringEl.classList.add('dim');
        await banner('YOU\'RE DOWN!', 'red', 900);
        hud();
      } else if (e.type === 'youUp') {
        playerEl.classList.remove('down');
        ringEl.classList.remove('dim');
        sfx.bell();
        await banner('BACK ON YOUR FEET!', 'gold', 900);
        hud();
      } else if (e.type === 'count') {
        sfx.count();
        await banner('5... 6... 7...', 'red', 700);
      } else if (e.type === 'ko' || e.type === 'tko') {
        await wait(200);
      }
    }
  }

  async function loop() {
    hud();
    sfx.bell();
    await banner('FIGHT!', 'gold', 900);
    while (live() && F.phase !== 'over') {
      const getUp = F.phase === 'youDown';
      const q = makeQuestion({ grade, idx, rng, missed: b.missed, used });
      tellEl.innerHTML = getUp
        ? `The ref is counting! <b>Answer right to get up.</b> (${F.getUpTries === 1 ? 'Last try!' : '2 tries'})`
        : `${esc(f.name)} throws a <b>${esc(q.punch)}</b>!`;
      if (!getUp) {
        oppEl.classList.remove('idle');
        await play(oppEl, 'windup', 240);
        oppEl.classList.add('idle');
      }
      if (!live()) return;
      renderQuestion(q, { getUp });
      if (b.settings.readAloud) speak(q.speak);
      const seconds = clockFor();
      const res = await answer(seconds);
      if (!live()) return;
      stopSpeaking();
      const correct = res.index >= 0 && !!q.choices[res.index]?.correct;
      markChoices(q, res.index);
      recordAnswer(b, q, correct);
      persist();

      if (!correct) F.misses.push({ prompt: q.prompt, answer: q.answer, explain: q.explain });
      let events;
      if (getUp) {
        events = resolveGetUp(F, correct);
        if (!correct) {
          await showFeedback(q, res.timedOut);
          if (!live()) return;
        }
        await playEvents(events);
      } else {
        const quick = correct && seconds > 0 && res.elapsed < seconds * QUICK_SHARE;
        events = resolveAnswer(F, { correct, power: powerArmed, quick, timedOut: res.timedOut });
        powerArmed = false;
        if (correct) {
          await playEvents(events);
        } else {
          await playEvents(events.filter(e => e.type === 'hit'));
          await showFeedback(q, res.timedOut);
          if (!live()) return;
          await playEvents(events.filter(e => e.type !== 'hit'));
        }
      }
      hud();
      await wait(correct ? 250 : 100);
    }
    if (!live()) return;
    const outcome = finishFight(b, grade, idx, F.result === 'win');
    persist();
    if (F.result === 'win') {
      sfx.cheer();
      await banner('K.O.!', 'gold huge', 1400);
    } else {
      sfx.lose();
      await banner(F.youDowns >= 3 ? 'T.K.O.' : 'K.O.', 'red huge', 1400);
    }
    if (!live()) return;
    result(grade, idx, F, outcome);
  }

  if (TEST) window.__wp.fight = F;
  loop();
}

/* =============================================================== result == */
function result(grade, idx, F, outcome) {
  const f = FIGHTERS[idx];
  const won = F.result === 'win';
  const total = F.right + F.wrong;
  const next = outcome.nextUnlocked != null ? FIGHTERS[outcome.nextUnlocked] : null;
  view(`<div class="screen result ${won ? 'win' : 'lose'}">
    <h1 class="result-title">${won ? 'YOU WIN!' : 'KNOCKED OUT'}</h1>
    <div class="result-art">${won ? `<div class="loser">${fighterSVG(f)}</div>` : `<div class="winner">${fighterSVG(f)}</div>`}</div>
    <p class="result-line">${won
      ? `You knocked out <b>${esc(f.name)}</b>!`
      : `<b>${esc(f.name)}</b> got you this time. Every champ loses sometimes.`}</p>
    <div class="recap">
      <div><b>${F.right}</b><span>right</span></div>
      <div><b>${F.wrong}</b><span>missed</span></div>
      <div><b>${total ? Math.round(100 * F.right / total) : 0}%</b><span>accuracy</span></div>
      <div><b>${F.bestStreak}</b><span>best streak</span></div>
    </div>
    ${F.misses.length ? `<details class="review" ${won ? '' : 'open'}><summary>Words to practice (${F.misses.length})</summary>
      <ul>${F.misses.map(m => `<li><b>${esc(m.answer)}</b> <span>${esc(m.explain)}</span></li>`).join('')}</ul></details>` : ''}
    ${next ? `<p class="unlock">Next up: <b>${esc(next.name)}</b></p>` : ''}
    <div class="result-btns">
      ${outcome.belt ? `<button class="btn big punch" id="belt">Claim your belt!</button>` : ''}
      ${!outcome.belt && won && next ? `<button class="btn big punch" id="nextf">Fight ${esc(next.name)}</button>` : ''}
      ${!won ? `<button class="btn big punch" id="again">Rematch!</button>` : ''}
      <button class="btn ghost" id="hub">Back to the ladder</button>
    </div>
  </div>`, won ? 'bg-win' : 'bg-lose');
  if (won) sfx.win();
  on('#belt', () => beltScreen(grade, outcome.belt, outcome.gradeChamp));
  on('#nextf', () => intro(grade, outcome.nextUnlocked));
  on('#again', () => fight(grade, idx));
  on('#hub', hub);
}

function beltScreen(grade, circuit, gradeChamp) {
  const b = me();
  const confetti = Array.from({ length: 40 }, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 10) * 0.12}s;background:${['#facc15', '#ef4444', '#3b82f6', '#22c55e', '#ec4899'][i % 5]}"></i>`).join('');
  view(`<div class="screen belt-screen${gradeChamp ? ' world' : ''}">
    <div class="confetti">${confetti}</div>
    <div class="rays"></div>
    <h1 class="belt-title">${gradeChamp ? 'WORLD CHAMPION!' : 'NEW BELT!'}</h1>
    <div class="belt-big">${beltSVG(circuit.id, { grade })}</div>
    <h2>${esc(b.name)} wins the ${esc(circuit.belt)}</h2>
    <p class="muted">Grade ${grade}</p>
    ${gradeChamp && grade < 8 ? `<p>You beat every boxer in Grade ${grade}. Ready for the Grade ${grade + 1} circuit?</p>
      <button class="btn big punch" id="up">Take on Grade ${grade + 1}</button>` : ''}
    ${gradeChamp && grade === 8 ? '<p><b>You are the undisputed champion of Word Punch.</b> Every grade, every belt you want is yours to defend.</p>' : ''}
    <button class="btn ${gradeChamp && grade < 8 ? 'ghost' : 'big punch'}" id="hub">Back to the ladder</button>
  </div>`, 'bg-belt');
  sfx.cheer();
  sfx.win();
  on('#up', () => {
    hubGrade = grade + 1;
    if (b.grade < grade + 1) { b.grade = grade + 1; persist(); }
    hub();
  });
  on('#hub', hub);
}

/* ================================================================ coach == */
function coach() {
  const b = me();
  const rows = SKILLS.map(s => {
    const st = b.stats[s.id];
    const acc = accuracy(st);
    const n = (st?.right || 0) + (st?.wrong || 0);
    const pct = acc == null ? 0 : Math.round(acc * 100);
    return `<div class="skill"><span class="sname">${s.label}</span>
      <div class="sbar"><i class="${acc == null ? '' : acc >= 0.8 ? 'ok' : acc >= 0.6 ? 'mid' : 'low'}" style="width:${pct}%"></i></div>
      <span class="spct">${acc == null ? 'not yet' : `${pct}% <small>of ${n}</small>`}</span></div>`;
  }).join('');
  const belts = [1, 2, 3, 4, 5, 6, 7, 8].map(g => (b.progress[g]?.belts || []).map(id => `<span class="mini-belt" title="Grade ${g} ${id}">${beltSVG(id, { small: true })}<small>Gr ${g}</small></span>`).join('')).join('');
  view(`<div class="screen coach">
    <h2>Coach's Corner</h2>
    <p class="muted">${esc(b.name)} &middot; ${b.wins} win${b.wins === 1 ? '' : 's'} in ${b.fights} fight${b.fights === 1 ? '' : 's'}</p>
    <section><h3>How they're doing</h3>${rows}</section>
    <section><h3>Belts</h3><div class="belt-case">${belts || '<p class="muted">No belts yet. Beat Captain Capital to win the first one.</p>'}</div></section>
    <section><h3>Recent misses</h3>
      ${b.misses.length ? `<ul class="misses">${b.misses.slice(0, 15).map(m => `<li><b>${esc(m.answer)}</b><span>${esc(m.explain)}</span></li>`).join('')}</ul>
        <p class="muted small">Missed words come back more often in fights until they're answered right.</p>` : '<p class="muted">Nothing missed yet.</p>'}
    </section>
    <section class="settings"><h3>Settings</h3>
      <label class="toggle"><input type="checkbox" id="clock" ${b.settings.clock ? 'checked' : ''}> Punch clock <small>Turn off for no time pressure</small></label>
      <label class="toggle"><input type="checkbox" id="read" ${b.settings.readAloud ? 'checked' : ''} ${canSpeak() ? '' : 'disabled'}> Read questions out loud <small>Great for early readers${canSpeak() ? '' : ' (not supported on this device)'}</small></label>
      <label class="toggle"><input type="checkbox" id="sound" ${b.settings.sound ? 'checked' : ''}> Sound effects</label>
      <div class="field">Starting grade
        <div class="grade-pick">${[1, 2, 3, 4, 5, 6, 7, 8].map(g => `<button class="chip${g === b.grade ? ' on' : ''}" data-g="${g}">${g}</button>`).join('')}</div>
      </div>
      <button class="btn ghost danger" id="del">Delete this boxer</button>
    </section>
    <button class="btn big" id="back">Back</button>
  </div>`, 'bg-hub');
  const bind = (id, key) => $(id).addEventListener('change', e => { b.settings[key] = e.target.checked; if (key === 'sound') setSound(e.target.checked); persist(); });
  bind('#clock', 'clock');
  bind('#read', 'readAloud');
  bind('#sound', 'sound');
  on('.grade-pick .chip', (e, el) => { b.grade = clampGrade(el.dataset.g); hubGrade = b.grade; persist(); coach(); });
  on('#del', () => {
    if (!confirm(`Delete ${b.name}? All belts and progress for this boxer will be gone for good.`)) return;
    state.boxers = state.boxers.filter(x => x.id !== b.id);
    state.current = state.boxers[0]?.id ?? null;
    persist();
    title();
  });
  on('#back', hub);
}

/* ================================================================= boot == */
if (TEST) window.__wp = { state: () => state, q: null, n: 0, fight: null };

if ('serviceWorker' in navigator && !TEST && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  // Reload once when a NEW worker takes over, so a deploy lands without a
  // second refresh. Skipped on the very first visit, when there was no old one.
  let reloaded = !navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

state.current && me() ? hub() : title();
