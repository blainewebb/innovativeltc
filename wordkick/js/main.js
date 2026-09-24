/* Word Kick — every screen, input handling, and the shootout loop. The rules
   live in engine.js; this file asks questions, collects taps, and plays back
   whatever the engine says happened. */
import { VERSION, GRADES, TEAMS, CUPS, KITS, kitById, contentGrade } from './data.js';
import { SKILLS } from '../../wordpunch/js/data.js';
import { makeRng } from '../../wordpunch/js/engine.js';
import {
  makeKick, starHelp, isTap, createMatch, resolveKick, useStar, goals, KICKS,
  newProfile, progressFor, recordAnswer, finishMatch, accuracy, cupOf, teamStats, clampGrade, clampNumber,
} from './engine.js';
import { load, save } from './storage.js';
import { sfx, setEnabled as setSound, speak, stopSpeaking, canSpeak } from './sfx.js';
import { shirtSVG, shooterSVG, myKeeperSVG, rivalKeeperSVG, ballSVG, goalSVG, crestSVG, trophySVG, starSVG, gearSVG } from './art.js';
import { PRIZES } from './prizes.js';
import { WINS_PER_PRIZE, winsToNext, toggleEquip, equipped, hasPrize } from '../../wordpunch/js/rewards.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/* Tests run the animations at a fraction of real speed. Reduced motion
   shortens waits too, since there is less to watch. */
const SPEED = TEST ? 0.02 : reducedMotion ? 0.35 : 1;
const wait = ms => new Promise(r => setTimeout(r, ms * SPEED));
const rng = makeRng(TEST && params.get('seed') ? Number(params.get('seed')) : Date.now());

let state = load();
let matchToken = 0;          // bumps when a match is abandoned, so its loop stops

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const me = () => state.players.find(p => p.id === state.current) || null;
const persist = () => save(state);
const ordinal = g => `${g}${g === 1 ? 'st' : g === 2 ? 'nd' : g === 3 ? 'rd' : 'th'}`;

function view(html, cls = '') {
  stopSpeaking();
  app.className = cls;
  app.innerHTML = html;
  window.scrollTo(0, 0);
}
const $ = sel => app.querySelector(sel);
const $$ = sel => [...app.querySelectorAll(sel)];
function on(sel, fn) { $$(sel).forEach(el => el.addEventListener('click', e => { sfx.tap(); fn(e, el); })); }

const kitPicker = selected => `<div class="kit-pick">${KITS.map(k => `<button class="kit${k.id === selected ? ' on' : ''}" data-k="${k.id}" aria-label="${esc(k.name)} colors">
  ${shirtSVG(k)}<span>${esc(k.name)}</span></button>`).join('')}</div>`;

/* ================================================================ title == */
function title() {
  if (!state.players.length) return newPlayer(true);
  view(`<div class="screen title-screen">
    <h1 class="logo"><span>WORD</span><span>KICK</span></h1>
    <p class="tag">Score with nouns, verbs, adjectives and spelling. Win the Golden Cup!</p>
    <h2 class="sub">Who's playing?</h2>
    <p class="muted small pick-hint">Tap your name to play. Each player keeps their own trophies.</p>
    <div class="player-list">
      ${state.players.map(p => {
        const cups = Object.values(p.progress).reduce((n, g) => n + g.cups.length, 0);
        return `<button class="player-btn${p.id === state.current ? ' current' : ''}" data-id="${esc(p.id)}">
          <span class="mini-shirt">${shirtSVG(kitById(p.kit), { number: p.number })}</span>
          <span class="pname">${esc(p.name)}</span>
          <span class="pmeta">Grade ${p.grade} &middot; ${cups} troph${cups === 1 ? 'y' : 'ies'}</span>
        </button>`;
      }).join('')}
    </div>
    <button class="btn ghost" id="add">+ New player</button>
    ${state.readOnly ? '<p class="warn">This browser is not letting the game save. Progress will be lost when you close it.</p>' : ''}
    <p class="version">v${VERSION}</p>
  </div>`, 'bg-title');
  on('.player-btn', (e, el) => { state.current = el.dataset.id; persist(); hub(); });
  on('#add', () => newPlayer(false));
}

function newPlayer(first) {
  let grade = 3, kit = KITS[0].id;
  view(`<div class="screen form-screen">
    ${first ? '<h1 class="logo small"><span>WORD</span><span>KICK</span></h1>' : ''}
    <h2>New player</h2>
    <div class="preview"></div>
    <div class="form-row">
      <label class="field grow">Player name
        <input id="name" maxlength="16" autocomplete="off" placeholder="Striker">
      </label>
      <label class="field num">Number
        <input id="number" type="number" inputmode="numeric" min="1" max="99" value="10">
      </label>
    </div>
    <div class="field">What grade are you in?
      <div class="grade-pick">${GRADES.map(g => `<button class="chip${g === grade ? ' on' : ''}" data-g="${g}">${g}</button>`).join('')}</div>
      <small>You can play any grade later. This just picks where you start.</small>
    </div>
    <div class="field">Pick your team colors
      ${kitPicker(kit)}
    </div>
    <button class="btn big kick" id="create">Take the field</button>
    ${first ? '' : '<button class="btn ghost" id="back">Back</button>'}
  </div>`, 'bg-title');
  const preview = () => {
    $('.preview').innerHTML = shooterSVG(kitById(kit), { number: clampNumber($('#number').value), name: $('#name').value.trim() || 'Striker' });
  };
  preview();
  $('#name').addEventListener('input', preview);
  $('#number').addEventListener('input', preview);
  on('.grade-pick .chip', (e, el) => { grade = Number(el.dataset.g); $$('.grade-pick .chip').forEach(c => c.classList.toggle('on', c === el)); });
  on('.kit', (e, el) => { kit = el.dataset.k; $$('.kit').forEach(c => c.classList.toggle('on', c === el)); preview(); });
  on('#back', title);
  on('#create', () => {
    const name = $('#name').value.trim() || 'Striker';
    const p = newProfile({ name, grade, kit, number: $('#number').value });
    state.players.push(p);
    state.current = p.id;
    persist();
    hub();
  });
}

/* ================================================================== hub == */
let hubGrade = null;

function hub() {
  const p = me();
  if (!p) return title();
  setSound(p.settings.sound);
  const g = hubGrade && hubGrade >= 1 && hubGrade <= 8 ? hubGrade : p.grade;
  hubGrade = g;
  const prog = progressFor(p, g);
  const allBeaten = prog.next >= TEAMS.length;

  const card = i => {
    const t = TEAMS[i];
    const st = i < prog.next ? 'beaten' : i === prog.next ? 'next' : 'locked';
    return `<button class="tcard ${st}${t.champion ? ' champ' : ''}" data-i="${i}" ${st === 'locked' ? 'disabled' : ''}>
      <span class="tcrest">${crestSVG(t)}</span>
      <span class="tinfo"><b>${esc(t.name)}</b>
        <small>${st === 'beaten' ? 'Beaten! Tap to replay' : st === 'next' ? 'NEXT MATCH' : 'Locked'}${t.champion ? ' &middot; Cup final' : ''}</small></span>
      ${st === 'beaten' ? '<span class="check">&#10003;</span>' : ''}
    </button>`;
  };

  view(`<div class="screen hub">
    <header class="hub-top">
      <div class="me"><span class="mini-shirt">${shirtSVG(kitById(p.kit), { number: p.number })}</span><span class="me-name">${esc(p.name)}</span></div>
      <div class="hub-btns">
        <button class="btn small ghost" id="switch">&#8644; Switch player</button>
        <button class="btn small ghost" id="coach">Coach's Corner</button>
      </div>
    </header>
    ${prizeBar(p)}
    <div class="grade-tabs" role="tablist">${GRADES.map(n => {
      const cups = (p.progress[n]?.cups || []).length;
      return `<button class="gtab${n === g ? ' on' : ''}" data-g="${n}">Gr ${n}${cups ? `<i class="pips">${'&#9679;'.repeat(cups)}</i>` : ''}</button>`;
    }).join('')}</div>
    <p class="level-note">Grade ${g} plays ${ordinal(contentGrade(g))} grade questions${g === 1 ? ' with 3 choices' : ''}.</p>
    <div class="trophy-row">${CUPS.map(c => `<div class="trophy-slot${prog.cups.includes(c.id) ? ' won' : ''}" title="${esc(c.trophy)}">
      ${trophySVG(c.id, { small: true })}<span>${prog.cups.includes(c.id) ? esc(c.trophy) : 'Not won yet'}</span></div>`).join('')}</div>
    ${CUPS.map(c => `<section class="cup">
      <h3>${esc(c.name)} <small>Grade ${g}</small></h3>
      <div class="ladder">${c.teams.map(card).join('')}</div>
    </section>`).join('')}
    <div class="hub-cta">
      <button class="btn big kick" id="go">${allBeaten ? 'Defend your title' : `Play ${esc(TEAMS[prog.next].name)}!`}</button>
    </div>
  </div>`, 'bg-hub');

  on('.gtab', (e, el) => { hubGrade = Number(el.dataset.g); hub(); });
  on('.tcard', (e, el) => intro(g, Number(el.dataset.i)));
  on('#go', () => intro(g, allBeaten ? TEAMS.length - 1 : prog.next));
  on('#coach', coach);
  on('#switch', title);
  on('#prizes', prizeRoom);
}

/* ================================================================ intro == */
function intro(grade, idx) {
  const p = me();
  const t = TEAMS[idx];
  const cup = cupOf(idx);
  const st = teamStats(idx, grade);
  const quickKeeper = st.reach > 0 && p.settings.clock;
  view(`<div class="screen intro">
    <div class="intro-card">
      <div class="intro-cup">${esc(cup.name)} &middot; Grade ${grade}${t.champion ? ' &middot; <b>CUP FINAL</b>' : ''}</div>
      <div class="intro-art"><span class="intro-crest">${crestSVG(t)}</span>${rivalKeeperSVG(t)}</div>
      <h2 class="intro-name">${esc(t.name)}</h2>
      <div class="intro-meta"><span>&ldquo;${esc(t.nick)}&rdquo;</span><span>Keeper <b>${esc(t.keeper)}</b></span></div>
      <blockquote>&ldquo;${esc(t.quote)}&rdquo;</blockquote>
      <ul class="intro-tips">
        <li><b>Your kick:</b> right answer = <b>GOAL</b>. Answer fast for the top corner!</li>
        <li><b>Their kick:</b> right answer = <b>you save it</b>.</li>
        <li>3 right in a row earns a <b>&#9733; star</b>. Use it to clear away wrong answers.</li>
        <li>${KICKS} kicks each. Still tied? <b>Sudden death!</b></li>
        ${quickKeeper ? `<li class="warn-tip">${esc(t.keeper)} has quick hands. A right answer at the very end of the clock gets <b>saved</b>. Be quick!</li>` : ''}
      </ul>
    </div>
    <button class="btn big kick" id="play">Kick off!</button>
    <button class="btn ghost" id="back">Back</button>
  </div>`, 'bg-intro');
  on('#play', () => match(grade, idx));
  on('#back', hub);
}

/* ================================================================ match == */
/* Where things sit on the pitch, in % of its width/height. */
const SPOT = { x: 50, y: 84 };
const TARGETS = {
  topL: { x: 17, y: 16 }, topR: { x: 83, y: 16 },
  lowL: { x: 20, y: 41 }, lowR: { x: 80, y: 41 },
};

function match(grade, idx) {
  const p = me();
  const t = TEAMS[idx];
  const look = myLook(p);
  const kit = look.kit;
  const M = createMatch(grade, idx);
  const used = new Set();
  const token = ++matchToken;
  const live = () => token === matchToken;

  view(`<div class="match">
    <div class="hud">
      <div class="sb-row sb-you"><span class="sb-badge">${shirtSVG(kit)}</span><span class="nm">${esc(look.name)}</span><span class="pens"></span><b class="score">0</b></div>
      <div class="sb-row sb-them"><span class="sb-badge">${crestSVG(t)}</span><span class="nm">${esc(t.short)}</span><span class="pens"></span><b class="score">0</b></div>
    </div>
    <div class="pitch">
      <div class="stands"></div>
      <div class="box-lines"></div>
      <div class="goal">${goalSVG()}</div>
      <div class="keeper"></div>
      <div class="spot"></div>
      <div class="shooter"></div>
      <div class="ball">${ballSVG(look.ball || {})}</div>
      <div class="fx"></div>
      <div class="side-tag"></div>
      <div class="banner"></div>
      <button class="quit" id="quit" aria-label="Leave match">&#10005;</button>
    </div>
    <div class="tell" aria-live="polite"></div>
    <div class="qpanel">
      <div class="timer"><i></i></div>
      <div class="prompt-row"><div class="prompt"></div>${canSpeak() ? '<button class="speak" id="speak" aria-label="Read it to me">&#128264;</button>' : ''}</div>
      <div class="sentence"></div>
      <div class="choices"></div>
      <div class="feedback" hidden></div>
      <div class="star-row"><span class="stars" aria-label="stars"></span><button class="star-help" id="help" hidden>&#9733; Use a star</button></div>
    </div>
  </div>`, 'bg-match');

  const pitchEl = $('.pitch'), goalEl = $('.goal'), keeperEl = $('.keeper'), shooterEl = $('.shooter'), ballEl = $('.ball');
  const fxEl = $('.fx'), bannerEl = $('.banner'), tellEl = $('.tell'), sideEl = $('.side-tag');
  const promptEl = $('.prompt'), sentEl = $('.sentence'), choicesEl = $('.choices');
  const timerEl = $('.timer i'), feedbackEl = $('.feedback'), helpEl = $('#help');
  let current = null;
  let helpUsed = false;
  let answering = false;

  on('#quit', () => {
    if (!confirm('Leave this match? It will count as a loss.')) return;
    matchToken++;
    finishMatch(p, grade, idx, false);
    persist();
    hub();
  });
  on('#speak', () => current && speak(current.speak));
  helpEl.addEventListener('click', () => {
    if (!answering || helpUsed || !current || !useStar(M)) return;
    sfx.star();
    helpUsed = true;
    const gone = new Set(starHelp(current, rng));
    const els = isTap(current) ? $$('.tok') : $$('.choice');
    els.forEach(el => { if (gone.has(Number(el.dataset.c))) { el.disabled = true; el.classList.add('gone'); } });
    hud();
  });

  function pens(arr, kicking) {
    const n = Math.max(KICKS, arr.length + (kicking ? 1 : 0));
    return Array.from({ length: n }, (_, i) => {
      if (i < arr.length) return `<i class="pen ${arr[i] ? 'in' : 'out'}">${arr[i] ? '&#10003;' : '&#10005;'}</i>`;
      return `<i class="pen${i === arr.length && kicking ? ' up' : ''}"></i>`;
    }).join('');
  }
  function hud() {
    if (!live()) return;     // match was left; the screen belongs to someone else now
    const over = M.phase === 'over';
    $('.sb-you .pens').innerHTML = pens(M.you, !over && M.turn === 'you');
    $('.sb-them .pens').innerHTML = pens(M.them, !over && M.turn === 'them');
    $('.sb-you .score').textContent = goals(M.you);
    $('.sb-them .score').textContent = goals(M.them);
    $('.stars').innerHTML = [0, 1, 2].map(i => `<span class="${i < M.stars ? 'on' : ''}">&#9733;</span>`).join('');
    helpEl.hidden = !(answering && M.stars > 0 && !helpUsed);
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

  /* ------------------------------------------------------ the pitch -- */
  const KEEPER_REST = 'translate(-50%, -100%)';
  function resetPitch() {
    for (const el of [keeperEl, ballEl, shooterEl]) el.getAnimations().forEach(a => a.cancel());
    goalEl.classList.remove('ripple');
  }
  function setSide(side) {
    resetPitch();
    pitchEl.classList.toggle('defending', side === 'them');
    if (side === 'you') {
      keeperEl.innerHTML = rivalKeeperSVG(t);
      shooterEl.innerHTML = shooterSVG(kit, { number: look.number, name: look.name, skin: look.skin, hair: look.hair, boots: look.boots });
      sideEl.innerHTML = 'YOUR KICK';
    } else {
      keeperEl.innerHTML = myKeeperSVG(kit, { gloves: look.gloves, skin: look.skin, hair: look.hair });
      shooterEl.innerHTML = shooterSVG(t.kit, { number: [9, 7, 11, 10][M.them.length % 4], name: t.short, skin: t.skin, hair: t.hair });
      sideEl.innerHTML = 'SAVE IT!';
    }
  }
  const anim = (el, frames, ms, easing = 'ease-out') =>
    el.animate(frames, { duration: Math.max(1, ms * SPEED), easing, fill: 'forwards' }).finished.catch(() => {});

  /* After your goal: a little hop, or the celebration from the Prize Room. */
  function celebrate(move) {
    const base = 'translate(-50%, 0)';
    const frames = {
      slide: [{ transform: base }, { transform: `${base} translate(120%, -8%) rotate(-12deg)` }, { transform: `${base} translate(170%, 0) rotate(-18deg)` }],
      flip: [{ transform: base }, { transform: `${base} translateY(-45%) rotate(-180deg)` }, { transform: `${base} translateY(0) rotate(-360deg)` }],
      airplane: [{ transform: base }, { transform: `${base} translate(90%, -10%) rotate(18deg)` }, { transform: `${base} translate(-40%, -14%) rotate(-18deg)` }, { transform: `${base} translate(60%, 0) rotate(8deg)` }],
    }[move] || [{ transform: base }, { transform: `${base} translateY(-18%)` }, { transform: base }];
    return anim(shooterEl, frames, move ? 900 : 450, 'ease-in-out');
  }

  /* Keeper dive toward a target (in pitch %). `reach` 0..1 is how far they get. */
  function dive(target, reach = 1, ms = 420) {
    const w = pitchEl.clientWidth, h = pitchEl.clientHeight;
    const dx = ((target.x - 50) / 100) * w * reach;
    const dy = ((target.y - 47) / 100) * h * reach * 0.8;
    const rot = target.x === 50 ? 0 : (target.x < 50 ? -1 : 1) * 70 * reach;
    return anim(keeperEl, [
      { transform: KEEPER_REST },
      { transform: `${KEEPER_REST} translate(${dx}px, ${Math.min(0, dy)}px) rotate(${rot}deg)` },
    ], ms);
  }
  function flight(to, ms = 430, scale = 0.5) {
    return anim(ballEl, [
      { left: `${SPOT.x}%`, top: `${SPOT.y}%`, transform: 'translate(-50%, -50%) scale(1) rotate(0)' },
      { left: `${to.x}%`, top: `${to.y}%`, transform: `translate(-50%, -50%) scale(${scale}) rotate(540deg)` },
    ], ms, 'cubic-bezier(.15,.7,.35,1)');
  }
  async function runUp() {
    await anim(shooterEl, [{ transform: 'translate(-50%, 0)' }, { transform: 'translate(-20%, -9%) scale(.94)' }], 320, 'ease-in');
    sfx.kick();
  }
  const side = () => (rng() < 0.5 ? 'L' : 'R');
  const other = s => (s === 'L' ? 'R' : 'L');

  /* Play one kick. `how` is what happened: goal / save / post / over. */
  async function playKick(how, { high = false } = {}) {
    await runUp();
    const s = side();
    const target = TARGETS[`${high ? 'top' : 'low'}${s}`];
    if (how === 'goal') {
      // Keeper guesses wrong: dives the other way, or just stands and watches.
      const wrongWay = rng() < 0.75 ? TARGETS[`low${other(s)}`] : { x: 50, y: 47 };
      dive(wrongWay, 0.8);
      await flight(target);
      goalEl.classList.add('ripple');
      sfx.net();
    } else if (how === 'save') {
      const at = { x: s === 'L' ? 30 : 70, y: high ? 24 : 36 };
      dive(at, 1);
      await flight(at, 420, 0.55);
      sfx.save();
      await anim(ballEl, [
        { left: `${at.x}%`, top: `${at.y}%`, transform: 'translate(-50%, -50%) scale(.55)' },
        { left: `${at.x + (s === 'L' ? -12 : 12)}%`, top: '62%', transform: 'translate(-50%, -50%) scale(.7) rotate(-200deg)' },
      ], 380);
    } else if (how === 'post') {
      const post = { x: s === 'L' ? 10 : 90, y: 30 };
      dive(TARGETS[`low${other(s)}`], 0.6);
      await flight(post, 400, 0.5);
      sfx.post();
      await anim(ballEl, [
        { left: `${post.x}%`, top: `${post.y}%`, transform: 'translate(-50%, -50%) scale(.5)' },
        { left: `${s === 'L' ? -8 : 108}%`, top: '58%', transform: 'translate(-50%, -50%) scale(.6)' },
      ], 380);
    } else {
      dive({ x: 50, y: 30 }, 0.4);
      await flight({ x: s === 'L' ? 38 : 62, y: -12 }, 480, 0.45);
    }
  }

  /* -------------------------------------------------------- questions -- */
  function renderQuestion(q) {
    current = q;
    helpUsed = false;
    if (TEST) { window.__wk.q = q; window.__wk.n++; }
    promptEl.textContent = q.prompt;
    feedbackEl.hidden = true;
    feedbackEl.innerHTML = '';
    if (q.sentence) {
      sentEl.hidden = false;
      sentEl.innerHTML = q.sentence.map(tk => {
        const text = tk.text === '___' ? '<span class="blank">_____</span>' : esc(tk.text);
        return tk.choice >= 0
          ? `<button class="tok" data-c="${tk.choice}">${esc(tk.lead)}${text}${esc(tk.trail)}</button>`
          : `<span class="w${tk.hl ? ' hl' : ''}">${esc(tk.lead)}${text}${esc(tk.trail)}</span>`;
      }).join(' ');
    } else {
      sentEl.hidden = true;
      sentEl.innerHTML = '';
    }
    const tapping = isTap(q);
    choicesEl.innerHTML = tapping ? '' : q.choices.map((c, i) => `<button class="choice" data-c="${i}">${esc(c.label)}</button>`).join('');
    choicesEl.classList.toggle('two-col', !tapping && q.choices.length >= 4);
  }

  /* Wait for a tap or for the clock. Resolves { index, timedOut, elapsed }. */
  function answer(seconds) {
    return new Promise(resolve => {
      const start = performance.now();
      let done = false, raf = 0;
      answering = true;
      hud();
      const finish = res => {
        if (done) return;
        done = true;
        answering = false;
        cancelAnimationFrame(raf);
        $$('.choice, .tok').forEach(el => { el.disabled = true; });
        hud();
        resolve({ ...res, elapsed: (performance.now() - start) / 1000 });
      };
      $$('.choice, .tok').forEach(el => el.addEventListener('click', () => finish({ index: Number(el.dataset.c), timedOut: false })));
      const timer = $('.timer');
      if (!seconds) {
        timer.classList.add('off');
        timerEl.style.width = '100%';
        timerEl.className = 'ok';
        return;
      }
      timer.classList.remove('off');
      const reach = M.turn === 'you' ? M.stats.reach : 0;
      timer.style.setProperty('--reach', `${reach * 100}%`);
      timer.classList.toggle('has-reach', reach > 0);
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
    const els = isTap(q) ? $$('.tok') : $$('.choice');
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
    });
  }

  function clockFor() {
    if (!p.settings.clock) return 0;
    return M.stats.clock + (p.settings.readAloud ? 5 : 0);
  }

  /* ----------------------------------------------------------- events -- */
  async function playEvents(events) {
    for (const e of events) {
      if (!live()) return;
      if (e.type === 'shot') {
        if (e.goal) {
          await playKick('goal', { high: e.quick });
          sfx.goal();
          pitchEl.classList.add('flash-goal');
          if (e.quick) pop('TOP CORNER!', 'quick');
          hud();
          celebrate(look.celebration);
          await banner('GOAL!', 'gold', 1000);
          pitchEl.classList.remove('flash-goal');
        } else if (e.reason === 'slow') {
          await playKick('save');
          hud();
          await banner('SAVED!', 'red', 700);
          pop('Right answer, but too slow!', 'note');
          await wait(1300);
        } else if (e.reason === 'timeout') {
          await playKick('over');
          sfx.groan();
          hud();
          await banner('OVER THE BAR!', 'red', 900);
        } else {
          const how = rng() < 0.55 ? 'save' : rng() < 0.5 ? 'post' : 'over';
          await playKick(how);
          if (how !== 'post') sfx.groan();
          hud();
          await banner(how === 'save' ? 'SAVED!' : how === 'post' ? 'OFF THE POST!' : 'WIDE!', 'red', 900);
        }
      } else if (e.type === 'theirShot') {
        if (e.saved) {
          await playKick('save', { high: rng() < 0.4 });
          sfx.cheer();
          hud();
          await banner('GREAT SAVE!', 'gold', 1000);
        } else {
          await playKick('goal', { high: rng() < 0.4 });
          sfx.groan();
          hud();
          await banner('THEY SCORE', 'red', 900);
        }
      } else if (e.type === 'star') {
        sfx.star();
        pop('★ STAR!', 'star');
        hud();
        await wait(400);
      } else if (e.type === 'suddenDeath') {
        sfx.whistle();
        await banner('SUDDEN DEATH!', 'gold', 1400);
      }
    }
  }

  async function loop() {
    hud();
    setSide('you');
    sfx.whistle();
    await banner('PENALTIES!', 'gold', 1000);
    while (live() && M.phase !== 'over') {
      const shooting = M.turn === 'you';
      setSide(M.turn);
      hud();
      const q = makeKick({ grade, idx, rng, missed: p.missed, used });
      tellEl.innerHTML = shooting
        ? `<b>Your kick!</b> Answer right to score.${M.stats.reach > 0 && p.settings.clock ? ` ${esc(t.keeper)} saves slow shots, so be quick!` : ''}`
        : `<b>${esc(t.short)}</b> step up with a <b>${esc(q.kick)}</b>. Answer right to save it!`;
      renderQuestion(q);
      if (p.settings.readAloud) speak(q.speak);
      const seconds = clockFor();
      const res = await answer(seconds);
      if (!live()) return;
      stopSpeaking();
      const correct = res.index >= 0 && !!q.choices[res.index]?.correct;
      markChoices(q, res.index);
      recordAnswer(p, q, correct);
      persist();
      if (!correct) M.misses.push({ prompt: q.prompt, answer: q.answer, explain: q.explain });

      const share = seconds ? (res.timedOut ? 1 : Math.min(1, res.elapsed / seconds)) : null;
      const events = resolveKick(M, { correct, timedOut: res.timedOut, share });
      const kickEvents = events.filter(e => e.type === 'shot' || e.type === 'theirShot');
      await playEvents(kickEvents);
      if (!live()) return;
      if (!correct) {
        await showFeedback(q, res.timedOut);
        if (!live()) return;
      }
      await playEvents(events.filter(e => !kickEvents.includes(e)));
      hud();
      await wait(200);
    }
    if (!live()) return;
    const outcome = finishMatch(p, grade, idx, M.result === 'win');
    persist();
    sfx.final();
    if (M.result === 'win') {
      sfx.cheer();
      await banner('YOU WIN!', 'gold huge', 1500);
    } else {
      sfx.lose();
      await banner('FULL TIME', 'red huge', 1400);
    }
    if (!live()) return;
    result(grade, idx, M, outcome);
  }

  if (TEST) window.__wk.match = M;
  loop();
}

/* =============================================================== result == */
function result(grade, idx, M, outcome) {
  const t = TEAMS[idx];
  const won = M.result === 'win';
  const total = M.right + M.wrong;
  const y = goals(M.you), th = goals(M.them);
  const next = outcome.nextUnlocked != null ? TEAMS[outcome.nextUnlocked] : null;
  view(`<div class="screen result ${won ? 'win' : 'lose'}">
    <h1 class="result-title">${won ? 'YOU WIN!' : y === th - 1 ? 'SO CLOSE!' : 'NOT THIS TIME'}</h1>
    <div class="final-score"><span>${esc(me().name)}</span><b>${y} &ndash; ${th}</b><span>${esc(t.short)}</span></div>
    ${M.sudden ? '<p class="muted">after sudden death</p>' : ''}
    <div class="result-art">${won ? trophySVG(cupOf(idx).id, { small: true }) : crestSVG(t)}</div>
    <p class="result-line">${won
      ? `You beat <b>${esc(t.name)}</b> on penalties!`
      : `<b>${esc(t.name)}</b> won this one. Every star misses a penalty sometimes.`}</p>
    <div class="recap">
      <div><b>${M.right}</b><span>right</span></div>
      <div><b>${M.wrong}</b><span>missed</span></div>
      <div><b>${total ? Math.round(100 * M.right / total) : 0}%</b><span>accuracy</span></div>
      <div><b>${M.bestStreak}</b><span>best streak</span></div>
    </div>
    ${M.misses.length ? `<details class="review" ${won ? '' : 'open'}><summary>Words to practice (${M.misses.length})</summary>
      <ul>${M.misses.map(m => `<li><b>${esc(m.answer)}</b> <span>${esc(m.explain)}</span></li>`).join('')}</ul></details>` : ''}
    ${next ? `<p class="unlock">Next up: <b>${esc(next.name)}</b></p>` : ''}
    ${won ? prizeNote(me(), outcome.reward) : ''}
    <div class="result-btns">
      ${outcome.reward?.prize ? '<button class="btn big prize" id="prize">&#9733; Open your prize!</button>' : ''}
      ${outcome.cup ? '<button class="btn big kick" id="cup">Lift the trophy!</button>' : ''}
      ${!outcome.cup && won && next ? `<button class="btn big kick" id="nextm">Play ${esc(next.name)}</button>` : ''}
      ${!won ? '<button class="btn big kick" id="again">Rematch!</button>' : ''}
      <button class="btn ghost" id="hub">Back to the cups</button>
    </div>
  </div>`, won ? 'bg-win' : 'bg-lose');
  if (won) sfx.win();
  on('#prize', () => prizeReveal(outcome.reward.prize,
    () => result(grade, idx, M, { ...outcome, reward: { ...outcome.reward, prize: null, opened: true } })));
  on('#cup', () => trophyScreen(grade, outcome.cup, outcome.gradeChamp));
  on('#nextm', () => intro(grade, outcome.nextUnlocked));
  on('#again', () => match(grade, idx));
  on('#hub', hub);
}

function trophyScreen(grade, cup, gradeChamp) {
  const p = me();
  const confetti = Array.from({ length: 40 }, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 10) * 0.12}s;background:${['#facc15', '#ef4444', '#3b82f6', '#22c55e', '#ec4899'][i % 5]}"></i>`).join('');
  view(`<div class="screen trophy-screen${gradeChamp ? ' golden' : ''}">
    <div class="confetti">${confetti}</div>
    <div class="rays"></div>
    <h1 class="trophy-title">${gradeChamp ? 'CHAMPIONS!' : 'NEW TROPHY!'}</h1>
    <div class="trophy-big">${trophySVG(cup.id, { grade })}</div>
    <h2>${esc(p.name)} wins the ${esc(cup.trophy)}</h2>
    <p class="muted">Grade ${grade}</p>
    ${gradeChamp && grade < 8 ? `<p>You beat every team in Grade ${grade}. Ready for Grade ${grade + 1}?</p>
      <button class="btn big kick" id="up">Play Grade ${grade + 1}</button>` : ''}
    ${gradeChamp && grade === 8 ? '<p><b>You won every Golden Cup there is.</b> Legend status.</p>' : ''}
    <button class="btn ${gradeChamp && grade < 8 ? 'ghost' : 'big kick'}" id="hub">Back to the cups</button>
  </div>`, 'bg-trophy');
  sfx.cheer();
  sfx.win();
  on('#up', () => {
    hubGrade = grade + 1;
    if (p.grade < grade + 1) { p.grade = grade + 1; persist(); }
    hub();
  });
  on('#hub', hub);
}

/* =============================================================== prizes == */
/* What the player looks like in a match: their own kit and name, or the
   character they picked, plus any gear switched on. */
function myLook(p) {
  const ch = equipped(p, PRIZES, 'character');
  const boots = equipped(p, PRIZES, 'boots');
  const ball = equipped(p, PRIZES, 'ball');
  const gloves = equipped(p, PRIZES, 'gloves');
  const cel = equipped(p, PRIZES, 'celebration');
  return {
    kit: kitById(ch ? ch.kit : p.kit),
    name: ch ? ch.name.split(' ').pop() : p.name,
    number: ch ? ch.number : p.number,
    skin: ch?.skin, hair: ch?.hair,
    boots: boots?.color, ball, gloves: gloves?.color, celebration: cel?.move,
  };
}

const meterHTML = n => `<span class="meter">${Array.from({ length: WINS_PER_PRIZE }, (_, i) =>
  `<i class="${i < WINS_PER_PRIZE - n ? 'on' : ''}"></i>`).join('')}</span>`;

function prizeBar(p) {
  const n = winsToNext(p, PRIZES);
  const got = p.rewards.earned.length;
  return `<button class="prize-bar" id="prizes">
    <span class="pb-title">&#9733; Prize Room <small>${got} of ${PRIZES.length}</small></span>
    ${n == null ? '<span class="pb-meta">You got them all!</span>'
      : `<span class="pb-meta">${meterHTML(n)} ${n} more win${n === 1 ? '' : 's'} to your next prize</span>`}
  </button>`;
}

function prizeNote(p, reward) {
  if (!reward || reward.prize || reward.opened) return '';
  if (!reward.counted) return `<p class="prize-note muted">Wins at Grade ${p.grade} or higher count toward prizes.</p>`;
  const n = winsToNext(p, PRIZES);
  return n == null ? '' : `<p class="prize-note">${meterHTML(n)} ${n} more win${n === 1 ? '' : 's'} to your next prize!</p>`;
}

const KIND_TITLE = { card: 'NEW STAR CARD!', gear: 'NEW GEAR!', character: 'NEW PLAYER!' };
const SLOT_NAME = { boots: 'Boots', ball: 'Ball', gloves: 'Keeper gloves', celebration: 'Goal celebration' };

function prizeArt(prize) {
  if (prize.kind === 'gear') return gearSVG(prize);
  return starSVG(kitById(prize.kit), { skin: prize.skin, hair: prize.hair, number: prize.number });
}

function prizeCardHTML(prize, { big = false } = {}) {
  const sub = prize.kind === 'card' ? `${prize.pos} &middot; ${esc(kitById(prize.kit).name)} colors`
    : prize.kind === 'gear' ? SLOT_NAME[prize.slot] : `Playable &middot; ${esc(kitById(prize.kit).name)} colors`;
  return `<div class="pcard ${prize.kind}${big ? ' big' : ''}">
    <div class="pcard-art">${prizeArt(prize)}</div>
    <b class="pcard-name">${esc(prize.name)}</b>
    <small class="pcard-sub">${sub}</small>
    ${big ? `<p class="pcard-text">${esc(prize.fact || prize.desc)}</p>` : ''}
  </div>`;
}

function prizeReveal(prize, done) {
  const p = me();
  const usable = prize.kind !== 'card';
  const confetti = Array.from({ length: 30 }, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 10) * 0.12}s;background:${['#facc15', '#ef4444', '#3b82f6', '#22c55e', '#ec4899'][i % 5]}"></i>`).join('');
  view(`<div class="screen reveal">
    <div class="confetti">${confetti}</div>
    <h1 class="reveal-title">${KIND_TITLE[prize.kind]}</h1>
    <div class="reveal-card">${prizeCardHTML(prize, { big: true })}</div>
    ${usable ? `<button class="btn big kick" id="use">${prize.kind === 'character' ? `Play as ${esc(prize.name.split(' ').pop())}` : 'Use it now'}</button>` : ''}
    <button class="btn ${usable ? 'ghost' : 'big kick'}" id="done">${usable ? 'Maybe later' : 'Put it in my album'}</button>
  </div>`, 'bg-trophy');
  sfx.star();
  sfx.cheer();
  on('#use', () => {
    if (equipped(p, PRIZES, prize.kind === 'character' ? 'character' : prize.slot)?.id !== prize.id) toggleEquip(p, prize);
    persist();
    done();
  });
  on('#done', done);
}

function prizeRoom() {
  const p = me();
  const n = winsToNext(p, PRIZES);
  const earnedOf = kind => PRIZES.filter(x => x.kind === kind && hasPrize(p, x.id));
  const lockedOf = kind => PRIZES.filter(x => x.kind === kind && !hasPrize(p, x.id)).length;
  const on_ = x => equipped(p, PRIZES, x.kind === 'character' ? 'character' : x.slot)?.id === x.id;
  const tile = x => `<button class="ptile${on_(x) ? ' on' : ''}" data-id="${x.id}">${prizeCardHTML(x)}${on_(x) ? '<span class="ptag">ON</span>' : ''}</button>`;
  const locked = k => Array.from({ length: k }, () => '<div class="ptile locked"><span>?</span></div>').join('');
  const chars = earnedOf('character');
  const noChar = !equipped(p, PRIZES, 'character');
  view(`<div class="screen prize-room">
    <h2>Prize Room</h2>
    <p class="muted">${n == null ? 'You collected every prize. Legend!' : `${meterHTML(n)} ${n} more win${n === 1 ? '' : 's'} at Grade ${p.grade} or higher to your next prize.`}</p>
    <section><h3>Players <small>Tap to play as them</small></h3>
      <div class="pgrid">
        <button class="ptile${noChar ? ' on' : ''}" id="me-tile"><div class="pcard"><div class="pcard-art">${starSVG(kitById(p.kit), { number: p.number })}</div>
          <b class="pcard-name">${esc(p.name)}</b><small class="pcard-sub">That's you!</small></div>${noChar ? '<span class="ptag">ON</span>' : ''}</button>
        ${chars.map(tile).join('')}${locked(lockedOf('character'))}
      </div></section>
    <section><h3>Gear <small>Tap to switch on or off</small></h3>
      <div class="pgrid">${earnedOf('gear').map(tile).join('')}${locked(lockedOf('gear'))}</div></section>
    <section><h3>Sticker album <small>${earnedOf('card').length} of ${PRIZES.filter(x => x.kind === 'card').length}</small></h3>
      <div class="pgrid">${earnedOf('card').map(x => `<button class="ptile" data-card="${x.id}">${prizeCardHTML(x)}</button>`).join('')}${locked(lockedOf('card'))}</div></section>
    <button class="btn big" id="back">Back</button>
  </div>`, 'bg-hub');
  on('.ptile[data-id]', (e, el) => { toggleEquip(p, PRIZES.find(x => x.id === el.dataset.id)); persist(); prizeRoom(); });
  on('#me-tile', () => { delete p.rewards.equip.character; persist(); prizeRoom(); });
  on('.ptile[data-card]', (e, el) => cardView(PRIZES.find(x => x.id === el.dataset.card)));
  on('#back', hub);
}

function cardView(card) {
  view(`<div class="screen reveal">
    <div class="reveal-card">${prizeCardHTML(card, { big: true })}</div>
    <button class="btn big" id="back">Back to the album</button>
  </div>`, 'bg-hub');
  on('#back', prizeRoom);
}

/* ================================================================ coach == */
function coach() {
  const p = me();
  const rows = SKILLS.map(s => {
    const st = p.stats[s.id];
    const acc = accuracy(st);
    const n = (st?.right || 0) + (st?.wrong || 0);
    const pct = acc == null ? 0 : Math.round(acc * 100);
    return `<div class="skill"><span class="sname">${s.label}</span>
      <div class="sbar"><i class="${acc == null ? '' : acc >= 0.8 ? 'ok' : acc >= 0.6 ? 'mid' : 'low'}" style="width:${pct}%"></i></div>
      <span class="spct">${acc == null ? 'not yet' : `${pct}% <small>of ${n}</small>`}</span></div>`;
  }).join('');
  const cups = GRADES.map(g => (p.progress[g]?.cups || []).map(id => `<span class="mini-trophy" title="Grade ${g} ${id}">${trophySVG(id, { small: true })}<small>Gr ${g}</small></span>`).join('')).join('');
  view(`<div class="screen coach">
    <h2>Coach's Corner</h2>
    <p class="muted">${esc(p.name)} &middot; ${p.wins} win${p.wins === 1 ? '' : 's'} in ${p.matches} match${p.matches === 1 ? '' : 'es'}</p>
    <section><h3>How they're doing</h3>${rows}</section>
    <section><h3>Trophies</h3><div class="trophy-case">${cups || '<p class="muted">No trophies yet. Beat Adjective Athletic to win the Local Cup.</p>'}</div></section>
    <section><h3>Recent misses</h3>
      ${p.misses.length ? `<ul class="misses">${p.misses.slice(0, 15).map(m => `<li><b>${esc(m.answer)}</b><span>${esc(m.explain)}</span></li>`).join('')}</ul>
        <p class="muted small">Missed words come back more often in matches until they're answered right.</p>` : '<p class="muted">Nothing missed yet.</p>'}
    </section>
    <section class="settings"><h3>Settings</h3>
      <label class="toggle"><input type="checkbox" id="clock" ${p.settings.clock ? 'checked' : ''}> Kick clock <small>Turn off for no time pressure. Keepers can't save slow shots then.</small></label>
      <label class="toggle"><input type="checkbox" id="read" ${p.settings.readAloud ? 'checked' : ''} ${canSpeak() ? '' : 'disabled'}> Read questions out loud <small>Great for early readers${canSpeak() ? '' : ' (not supported on this device)'}</small></label>
      <label class="toggle"><input type="checkbox" id="sound" ${p.settings.sound ? 'checked' : ''}> Sound effects</label>
      <div class="field">Starting grade
        <div class="grade-pick">${GRADES.map(g => `<button class="chip${g === p.grade ? ' on' : ''}" data-g="${g}">${g}</button>`).join('')}</div>
        <small>Each grade plays one grade easier than Word Punch: Grade ${p.grade} gets ${ordinal(contentGrade(p.grade))} grade questions.</small>
      </div>
      <label class="field num">Shirt number
        <input id="number" type="number" inputmode="numeric" min="1" max="99" value="${p.number}">
      </label>
      <div class="field">Team colors ${kitPicker(p.kit)}</div>
      <button class="btn ghost danger" id="del">Delete this player</button>
    </section>
    <button class="btn big" id="back">Back</button>
  </div>`, 'bg-hub');
  const bind = (id, key) => $(id).addEventListener('change', e => { p.settings[key] = e.target.checked; if (key === 'sound') setSound(e.target.checked); persist(); });
  bind('#clock', 'clock');
  bind('#read', 'readAloud');
  bind('#sound', 'sound');
  $('#number').addEventListener('change', e => { p.number = clampNumber(e.target.value); e.target.value = p.number; persist(); });
  on('.kit', (e, el) => { p.kit = el.dataset.k; $$('.kit').forEach(c => c.classList.toggle('on', c === el)); persist(); });
  on('.grade-pick .chip', (e, el) => { p.grade = clampGrade(el.dataset.g); hubGrade = p.grade; persist(); coach(); });
  on('#del', () => {
    if (!confirm(`Delete ${p.name}? All trophies and progress for this player will be gone for good.`)) return;
    state.players = state.players.filter(x => x.id !== p.id);
    state.current = state.players[0]?.id ?? null;
    persist();
    title();
  });
  on('#back', hub);
}

/* ================================================================= boot == */
if (TEST) window.__wk = { state: () => state, q: null, n: 0, match: null };

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
