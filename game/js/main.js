/* Runebreaker — screens, input and the run state machine.
   The arithmetic rules live in engine.js; this file is presentation + flow. */

import {
  makeRng, newRun, generateFloor, generateHand, generateRiddle, offerRelics,
  spawnEnemy, enemyAct, describeIntent, isLegal, evaluate, computeDamage,
  recordAttempt, classify, factKey, skillScore, shakyFacts, difficultyLevel,
  unlockedOps, handSize, reshuffles, FINAL_DEPTH,
  pickDrill, drillAllowanceMs, bossFightMs, isBossFloor, expectedDrillDamage,
  bestHitEstimate, makeRng as engineRng, typeInto, checkAnswer, formatAnswer, parseAnswer,
  SKILLS, WARDS, RESISTS, RELIC_BY_ID,
} from './engine.js';
import { RUNES, RELICS, GRADES, GRADE_BY_ID, VERSION } from './data.js';
import * as store from './storage.js';
import { sfx, setEnabled, isEnabled } from './sfx.js';

let data = store.load();
let profile = null;
let run = null;
let battle = null;
let playClock = null;
let manageHeroes = false;

const app = document.getElementById('app');
const $ = sel => app.querySelector(sel);
const $$ = sel => Array.from(app.querySelectorAll(sel));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render(html) { stopDrillTimer(); app.innerHTML = html; }
function persist() { store.save(data); }

/* Count playing time honestly: a ticking clock only while a run is live. */
function startClock() {
  if (playClock) return;
  playClock = setInterval(() => {
    if (!profile || !run || run.over) return;
    store.todayEntry(profile).ms += 10000;
    persist();
  }, 10000);
}

const AVATARS = ['\u{1F9D9}', '\u{1F9DD}', '\u{1F9DB}', '\u{1F916}', '\u{1F98A}', '\u{1F42F}', '\u{1F409}', '\u{1F984}'];

/* ================================================================ boot === */
function boot() {
  setEnabled(data.settings?.sound !== false);
  profile = store.activeProfile(data);
  startClock();
  if (!profile) screenProfiles(); else screenHub();
}

/* ============================================================ profiles === */
function screenProfiles() {
  render(`
    <div class="screen center">
      <h1 class="logo">RUNE<span>BREAKER</span></h1>
      <p class="tag">Numbers are your weapon.</p>
      <div class="panel">
        <h2>Who's playing?</h2>
        ${data.profiles.length > 1 ? '<p class="muted tiny center">Tap a hero to play as them.</p>' : ''}
        <div class="profile-list">
          ${data.profiles.map(p => `
            <div class="profile-row">
              <button class="profile-card" data-id="${p.id}" ${manageHeroes ? 'disabled' : ''}>
                <span class="pa">${p.avatar}</span>
                <span class="pn">${esc(p.name)}</span>
                <span class="pd">${p.grade ? GRADE_BY_ID[p.grade].label + ' &middot; ' : ''}deepest floor ${p.records.deepest}</span>
              </button>
              ${manageHeroes ? `<button class="hero-del" data-del="${p.id}" aria-label="Delete ${esc(p.name)}">\u2715</button>` : ''}
            </div>`).join('')}
        </div>
        ${data.profiles.length ? `<button class="btn ghost small manage" id="manageBtn">${manageHeroes ? 'Done' : 'Manage heroes'}</button>` : ''}
        <div class="newprof">
          <h3>${data.profiles.length ? 'Add another hero' : 'Make your hero'}</h3>
          ${data.profiles.length ? '<p class="muted tiny">Every hero keeps their own progress, their own difficulty and their own report card. Give each kid their own.</p>' : ''}
          <input id="newName" maxlength="12" placeholder="${data.profiles.length ? 'Their name' : 'Hero name'}" autocomplete="off">
          <div class="avatars">${AVATARS.map((a, i) => `<button class="av ${i === 0 ? 'on' : ''}" data-av="${a}">${a}</button>`).join('')}</div>
          <label class="field-label">School year</label>
          <div class="grades">
            ${GRADES.map(g => `<button class="grade" data-grade="${g.id}"><b>${g.label}</b><small>${g.hint}</small></button>`).join('')}
          </div>
          <p class="muted tiny">Only a starting point. The game works out their real level from how they answer and adjusts within a run or two, so a wrong guess fixes itself.</p>
          <button class="btn primary" id="createProfile">${data.profiles.length ? 'Add this hero' : 'Create hero'}</button>
        </div>
      </div>
      ${data.profiles.length ? '<button class="btn ghost small" id="parentBtn">Grown-ups</button>' : ''}
      <p class="version">v${VERSION}</p>
    </div>`);

  $$('.profile-card').forEach(b => b.onclick = () => {
    data.activeId = b.dataset.id; persist(); profile = store.activeProfile(data); sfx.tap();
    manageHeroes = false;
    screenHub();
  });
  const manageBtn = $('#manageBtn');
  if (manageBtn) manageBtn.onclick = () => { manageHeroes = !manageHeroes; sfx.tap(); screenProfiles(); };
  $$('[data-del]').forEach(b => b.onclick = () => {
    const hero = data.profiles.find(x => x.id === b.dataset.del);
    if (hero) { sfx.tap(); screenConfirmDelete(hero); }
  });
  let chosen = AVATARS[0];
  let grade = 0;
  $$('.av').forEach(b => b.onclick = () => {
    chosen = b.dataset.av; $$('.av').forEach(x => x.classList.remove('on')); b.classList.add('on'); sfx.tap();
  });
  $$('.grade').forEach(b => b.onclick = () => {
    grade = Number(b.dataset.grade);
    $$('.grade').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    sfx.tap();
  });
  $('#createProfile').onclick = () => {
    const name = ($('#newName').value || '').trim() || 'Hero';
    const p = store.newProfile(name, chosen, grade);
    data.profiles.push(p); data.activeId = p.id; persist(); profile = p; sfx.reward(); screenHub();
  };
  const pb = $('#parentBtn');
  if (pb) pb.onclick = parentGate;
}

function screenConfirmDelete(hero) {
  const answered = hero.days.reduce((n, d) => n + d.correct + d.wrong, 0);
  const minutes = Math.round(hero.days.reduce((n, d) => n + d.ms, 0) / 60000);
  render(`
    <div class="screen center">
      <div class="panel lose">
        <h2>Delete ${esc(hero.name)}?</h2>
        <div class="big-art">${hero.avatar}</div>
        <p class="center">This removes <b>${answered}</b> answered problems and <b>${minutes}</b> minutes of playing, including everything the report card is built from.</p>
        <p class="muted tiny center">There is no undo and no copy on a server. If you might want them back, back them up first.</p>
        <button class="btn primary" id="backup">Back them up first</button>
        <div class="row">
          <button class="btn ghost" id="cancel">Keep them</button>
          <button class="btn danger" id="confirm">Delete for good</button>
        </div>
      </div>
    </div>`);
  $('#backup').onclick = () => { sfx.tap(); screenBackup([hero], () => screenConfirmDelete(hero)); };
  $('#cancel').onclick = () => { sfx.tap(); screenProfiles(); };
  $('#confirm').onclick = () => {
    data.profiles = data.profiles.filter(x => x.id !== hero.id);
    if (data.activeId === hero.id) { data.activeId = null; profile = null; run = null; }
    if (!data.profiles.length) manageHeroes = false;
    persist(); sfx.lose(); screenProfiles();
  };
}

/* ================================================================= hub === */
function screenHub() {
  const level = difficultyLevel(profile.mastery, profile.grade);
  const ops = unlockedOps(profile.mastery, profile.grade);
  render(`
    <div class="screen center">
      <h1 class="logo small">RUNE<span>BREAKER</span></h1>
      <div class="panel">
        <div class="hero-row">
          <span class="pa big">${profile.avatar}</span>
          <div>
            <h2>${esc(profile.name)}</h2>
            <p class="muted">Deepest floor <b>${profile.records.deepest}</b> &middot; ${profile.records.runs} runs &middot; ${profile.records.bossesFelled} bosses felled</p>
          </div>
        </div>
        <div class="runes-owned">
          ${['+', '-', '*', '/', '^'].map(op => `<span class="rune-chip ${ops.includes(op) ? 'on' : 'off'}">${RUNES[op].glyph}</span>`).join('')}
          <span class="muted tiny">Runes you can find &middot; Challenge level ${level}</span>
        </div>
        <button class="btn primary big" id="startRun">Start a run</button>
        ${profile.records.wins ? `<button class="btn big" id="startEndless">Endless run</button>
        <p class="muted tiny center">Cleared the Deep ${profile.records.wins} time${profile.records.wins === 1 ? '' : 's'}. Best endless floor: ${profile.records.bestEndless || 0}.</p>` : ''}
        <div class="row">
          <button class="btn ghost" id="switchBtn">Switch / add hero</button>
          <button class="btn ghost" id="soundBtn">Sound: ${isEnabled() ? 'on' : 'off'}</button>
        </div>
      </div>
      <button class="btn ghost small" id="parentBtn">Grown-ups</button>
    </div>`);

  $('#startRun').onclick = () => { sfx.tap(); beginRun(false); };
  const endlessBtn = $('#startEndless');
  if (endlessBtn) endlessBtn.onclick = () => { sfx.tap(); beginRun(true); };
  $('#switchBtn').onclick = () => { data.activeId = null; persist(); screenProfiles(); };
  $('#soundBtn').onclick = () => {
    setEnabled(!isEnabled()); data.settings.sound = isEnabled(); persist(); sfx.tap(); screenHub();
  };
  $('#parentBtn').onclick = parentGate;
}

function beginRun(endless = false) {
  run = newRun(Date.now() % 2147483647, profile, endless);
  profile.records.runs += 1;
  persist();
  screenMap();
}

/* ================================================================= map === */
const NODE_LOOK = {
  battle:   { icon: '⚔️', label: 'Monster', hint: 'A fight. Gold when you win.' },
  elite:    { icon: '\u{1F480}', label: 'Elite', hint: 'Much tougher. Drops a relic.' },
  boss:     { icon: '\u{1F451}', label: 'BOSS', hint: 'Beat it to unlock something permanent.' },
  riddle:   { icon: '\u{1F52E}', label: 'Riddle shrine', hint: 'A word problem. Relic if you solve it.' },
  treasure: { icon: '\u{1F4E6}', label: 'Locked chest', hint: 'Crack the number lock for loot.' },
  shop:     { icon: '\u{1F3EA}', label: 'Trader', hint: 'Spend gold on relics and healing.' },
  rest:     { icon: '\u{1F525}', label: 'Campfire', hint: 'Heal up, or train for more health.' },
};

function screenMap() {
  const p = run.player;
  render(`
    <div class="screen">
      ${topBar()}
      <div class="map">
        <h2 class="floor-title">Floor ${run.depth}${run.endless ? '' : ` of ${FINAL_DEPTH}`}</h2>
        <p class="muted center">Choose your path.</p>
        <div class="nodes">
          ${run.floorNodes.map((n, i) => `
            <button class="node ${n.type}" data-i="${i}">
              <span class="ni">${NODE_LOOK[n.type].icon}</span>
              <span class="nbody">
                <span class="nl">${NODE_LOOK[n.type].label}</span>
                <small>${NODE_LOOK[n.type].hint}</small>
              </span>
            </button>`).join('')}
        </div>
        <div class="relic-tray">
          ${p.relics.length ? p.relics.map(id => `<span class="relic-mini" title="${esc(RELIC_BY_ID[id].text)}">${RELIC_BY_ID[id].art}</span>`).join('')
            : '<span class="muted tiny">No relics yet. Beat elites and shrines to earn them.</span>'}
        </div>
      </div>
    </div>`);
  $$('.node').forEach(b => b.onclick = () => { sfx.tap(); enterNode(run.floorNodes[+b.dataset.i]); });
}

function topBar() {
  const p = run.player;
  return `
    <div class="topbar">
      <span class="hp-pill">❤️ ${Math.max(0, p.hp)}/${p.maxHp}</span>
      <span class="gold-pill">\u{1FA99} ${p.gold}</span>
      <span class="depth-pill">Floor ${run.depth}${run.endless ? '' : `/${FINAL_DEPTH}`}</span>
      <span class="runes-pill">${p.runes.map(o => RUNES[o].glyph).join(' ')}</span>
    </div>`;
}

function nextFloor() {
  run.depth += 1;
  run.stats.deepest = Math.max(run.stats.deepest, run.depth);
  if (run.depth > profile.records.deepest) profile.records.deepest = run.depth;
  if (run.endless && run.depth > (profile.records.bestEndless || 0)) profile.records.bestEndless = run.depth;
  run.floorNodes = generateFloor(run.rng, run.depth);
  persist();
  screenMap();
}

function enterNode(node) {
  const level = difficultyLevel(profile.mastery, profile.grade);
  const ctx = {
    runes: run.player.runes,
    level,
    playerMaxHp: run.player.maxHp,
  };

  /* Enemy health is budgeted against what this player can actually hit for,
     and turns alternate, so BOTH kinds have to count. A built strike at
     eighth grade level hits for a few hundred; a handed-out percentage
     question hits for tens. Budgeting on the built ceiling alone made every
     fight run about twice its intended length, and the extra turns were extra
     damage taken. It only bit at the top grades, where the tile ceiling grows
     quadratically while drill answers do not.

     Sampled on a throwaway rng so the run's own seeded stream stays in step. */
  const drillDamage = drillsOn()
    ? expectedDrillDamage(engineRng(Math.floor(run.rng() * 2 ** 31)),
                          profile.mastery, run.player.runes, level)
    : 0;
  const built = bestHitEstimate(run.player.runes, level);
  /* An ordinary fight alternates, so health is budgeted on the average of the
     two turn types, while armor is sized against the weaker one so it cannot
     wipe out a drill turn entirely. */
  const mixed = drillsOn()
    ? { ...ctx, ceiling: (built + drillDamage) / 2, armorBase: drillDamage }
    : ctx;
  // A duel is every turn a question, so both are sized against questions.
  const duelCtx = drillsOn()
    ? { ...ctx, duel: true, ceiling: drillDamage, armorBase: drillDamage }
    : ctx;

  switch (node.type) {
    case 'battle': return startBattle(spawnEnemy(run.rng, run.depth, mixed), { gold: 8 + run.depth * 2 });
    case 'elite':  return startBattle(spawnEnemy(run.rng, run.depth, { ...mixed, elite: true }), { gold: 16 + run.depth * 3, relic: true });
    case 'boss':   return startBattle(spawnEnemy(run.rng, run.depth, { ...duelCtx, boss: true }), { gold: 30 + run.depth * 4, relic: true, boss: true });
    case 'riddle': return screenRiddle();
    case 'treasure': return screenTreasure();
    case 'shop':   return screenShop();
    case 'rest':   return screenRest();
    default:       return nextFloor();
  }
}

/* ============================================================== battle === */
function startBattle(enemy, reward) {
  battle = {
    enemy,
    reward,
    tiles: [],
    sel: { aIdx: null, op: null, bIdx: null },
    lockedId: null,
    pendingJam: false,
    reshuffleLeft: reshuffles(run.player),
    firstHit: true,
    mercyLeft: run.player.relics.includes('mercy') ? 1 : 0,
    shieldTurns: 0,
    typed: '',
    exprReadyAt: null,
    lastWrong: null,
    turn: 1,
    mode: 'build',
    drill: null,
    /* A boss duel is nothing but asked questions: no tile building, and one
       clock over the whole fight on top of the per-question one. */
    allDrills: !!reward.boss && drillsOn(),
    fightMs: 0,
    fightStart: performance.now(),
    log: [`A ${enemy.name} blocks your way!`],
  };
  /* What one written answer is worth as damage in this fight. Sampled from
     the drill picker so a question hits for about what a calculation would. */
  battle.askedDamage = Math.max(1, Math.round(expectedDrillDamage(
    engineRng(Math.floor(run.rng() * 2 ** 31)),
    profile.mastery, run.player.runes, difficultyLevel(profile.mastery, profile.grade))));

  if (battle.allDrills) {
    battle.fightMs = bossFightMs(profile.mastery, run.depth);
    battle.log = [`${enemy.name} challenges you to a duel. Answer, or be hit.`];
  }
  dealHand();
  if (battle.allDrills) { battle.turn = 0; return nextTurn(); }
  renderBattle();
}

function dealHand() {
  battle.tiles = generateHand(run.rng, {
    mastery: profile.mastery,
    runes: run.player.runes,
    size: handSize(run.player),
    depth: run.depth,
    grade: profile.grade,
  });
}

/* Swap out only the two tiles that were spent, so the hand feels like a hand. */
function replaceTiles(idxs) {
  const fresh = generateHand(run.rng, {
    mastery: profile.mastery, runes: run.player.runes,
    size: handSize(run.player), depth: run.depth, grade: profile.grade,
  });
  idxs.forEach((idx, k) => { battle.tiles[idx] = fresh[k % fresh.length]; });
}

function selectedExpression() {
  const { aIdx, op, bIdx } = battle.sel;
  if (aIdx === null || op === null || bIdx === null) return null;
  const a = battle.tiles[aIdx].value, b = battle.tiles[bIdx].value;
  if (!isLegal(a, op, b)) return null;
  return { a, op, b, result: evaluate(a, op, b) };
}

/* Shared by the built turn and the drill turn: both need the player to see
   armor, the ward, the resist and what is coming next. */
function enemyCardHtml() {
  const e = battle.enemy;
  const ward = WARDS[e.ward];
  const resist = RESISTS[e.resist] || RESISTS.none;
  const intent = describeIntent(e);
  return `
    <div class="enemy-card ${e.boss ? 'boss' : ''} ${e.elite ? 'elite' : ''}">
      <div class="enemy-art">${e.art}</div>
      <div class="enemy-info">
        <div class="enemy-name">${esc(e.name)}</div>
        <div class="bar hp"><span style="width:${Math.max(0, e.hp / e.maxHp * 100)}%"></span><b>${Math.max(0, e.hp)} / ${e.maxHp}</b></div>
<div class="enemy-tags">
          ${e.armor ? `<span class="tag armor">\u{1F6E1}\uFE0F Armor ${e.armor}</span>` : ''}
          ${!e.duel && ward.id !== 'none' ? `<span class="tag ward">\u{1F52E} ${ward.label}</span>` : ''}
          ${!e.duel && resist.id !== 'none' ? `<span class="tag resist">\u{1F6AB} ${resist.label(e.resistAt)}</span>` : ''}
          ${e.shield ? `<span class="tag shield">\u{1F512} Shield: hit EXACTLY ${e.shield}</span>` : ''}
        </div>
        <div class="intent">Next: ${intent.icon} ${intent.text}</div>
      </div>
    </div>`;
}

function renderBattle() {
  const e = battle.enemy, p = run.player;
  const expr = selectedExpression();
  const { aIdx, op, bIdx } = battle.sel;

  const tileBtn = (t, i) => {
    const locked = t.id === battle.lockedId;
    const isA = i === aIdx, isB = i === bIdx;
    let disabled = locked || (isA && bIdx !== null) ;
    // Once A and an operator are picked, grey out tiles that cannot legally follow.
    if (!isA && op !== null && aIdx !== null && bIdx === null) {
      if (!isLegal(battle.tiles[aIdx].value, op, t.value)) disabled = true;
    }
    if (isA || isB) disabled = false;
    return `<button class="tile ${isA ? 'sel-a' : ''} ${isB ? 'sel-b' : ''} ${locked ? 'locked' : ''}"
              data-i="${i}" ${disabled && !isA && !isB ? 'disabled' : ''}>${locked ? '\u{1F512}' : t.value}</button>`;
  };

  render(`
    <div class="screen battle">
      ${topBar()}
      ${enemyCardHtml()}

      <div class="log">${battle.log.slice(-2).map(l => `<div>${l}</div>`).join('')}</div>

      <div class="expr-area">
        <div class="expr">
          <span class="slot ${aIdx !== null ? 'filled' : ''}">${aIdx !== null ? battle.tiles[aIdx].value : '?'}</span>
          <span class="slot op ${op ? 'filled' : ''}">${op ? RUNES[op].glyph : '?'}</span>
          <span class="slot ${bIdx !== null ? 'filled' : ''}">${bIdx !== null ? battle.tiles[bIdx].value : '?'}</span>
          <span class="eq">=</span>
          <span class="answer ${battle.typed ? 'filled' : ''}">${battle.typed || '_'}</span>
        </div>
        ${expr ? `<div class="expr-hint muted tiny">Type the answer, then STRIKE.</div>`
               : `<div class="expr-hint muted tiny">Pick a tile, a rune, then another tile.</div>`}
      </div>

      <div class="hand">${battle.tiles.map(tileBtn).join('')}</div>

      <div class="runes">
        ${p.runes.map(o => `<button class="rune ${op === o ? 'on' : ''}" data-op="${o}">${RUNES[o].glyph}</button>`).join('')}
        <button class="btn ghost tiny" id="clearSel">Clear</button>
        <button class="btn ghost tiny" id="reshuffle" ${battle.reshuffleLeft ? '' : 'disabled'}>Reshuffle (${battle.reshuffleLeft})</button>
      </div>

      ${keypadHtml({ submitId: 'strike', submitLabel: 'STRIKE', ready: !!(expr && battle.typed), extras: false })}

      <div class="player-strip">
        <span class="hp-pill">❤️ ${Math.max(0, p.hp)}/${p.maxHp}</span>
        <span class="combo ${p.combo ? 'on' : ''}">\u{1F525} Combo ${p.combo}</span>
        <span class="relic-tray inline">${p.relics.map(id => `<span class="relic-mini" title="${esc(RELIC_BY_ID[id].text)}">${RELIC_BY_ID[id].art}</span>`).join('')}</span>
      </div>
    </div>`);

  $$('.tile').forEach(b => b.onclick = () => onTile(+b.dataset.i));
  $$('.rune').forEach(b => b.onclick = () => onRune(b.dataset.op));
  $$('.key').forEach(b => b.onclick = () => onKey(b.dataset.k));
  $('#clearSel').onclick = () => { battle.sel = { aIdx: null, op: null, bIdx: null }; battle.typed = ''; battle.exprReadyAt = null; sfx.tap(); renderBattle(); };
  $('#reshuffle').onclick = () => {
    if (!battle.reshuffleLeft) return;
    battle.reshuffleLeft -= 1; dealHand();
    battle.sel = { aIdx: null, op: null, bIdx: null }; battle.typed = ''; battle.exprReadyAt = null;
    sfx.tap(); renderBattle();
  };
  const st = $('#strike'); if (st) st.onclick = submitStrike;
}

function onTile(i) {
  const s = battle.sel;
  if (battle.tiles[i].id === battle.lockedId) return;
  sfx.tap();
  if (s.aIdx === i) { s.aIdx = null; s.bIdx = null; }
  else if (s.bIdx === i) { s.bIdx = null; }
  else if (s.aIdx === null) { s.aIdx = i; }
  else { s.bIdx = i; }
  battle.typed = '';
  battle.exprReadyAt = selectedExpression() ? performance.now() : null;
  renderBattle();
}

function onRune(op) {
  sfx.tap();
  battle.sel.op = battle.sel.op === op ? null : op;
  battle.typed = '';
  battle.exprReadyAt = selectedExpression() ? performance.now() : null;
  renderBattle();
}

function onKey(k) {
  if (k === 'back') battle.typed = battle.typed.slice(0, -1);
  else if (battle.typed.length < 5) battle.typed += k;
  sfx.tap();
  renderBattle();
}

/* A short, concrete strategy nudge after a miss. Immediate feedback beats a
   wall, and re-doing the same fact next turn is the point. */
function hintFor(a, op, b) {
  if (op === '*') {
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    if (lo % 2 === 0) return `${hi} x ${lo} is ${hi} x ${lo / 2} doubled: ${hi * (lo / 2)} + ${hi * (lo / 2)}.`;
    return `${hi} x ${lo} is ${hi} x ${lo - 1} plus one more ${hi}: ${hi * (lo - 1)} + ${hi}.`;
  }
  if (op === '/') return `Ask: ${b} times WHAT makes ${a}?`;
  if (op === '+' && (a % 10) + (b % 10) >= 10) return `Make a ten first: ${a} + ${10 - (a % 10)} = ${a + (10 - (a % 10))}, then add the rest.`;
  if (op === '-') return `Count up from ${b} to ${a}, or take away the tens first.`;
  return null;
}

function submitStrike() {
  const expr = selectedExpression();
  if (!expr || !battle.typed) return;
  const { a, op, b, result } = expr;
  const ms = battle.exprReadyAt ? Math.round(performance.now() - battle.exprReadyAt) : 8000;
  const given = parseInt(battle.typed, 10);
  const correct = given === result;

  const skill = classify(a, op, b);
  recordAttempt(profile.mastery, { skill, fact: factKey(a, op, b), correct, ms });
  const day = store.todayEntry(profile);
  if (correct) { day.correct += 1; run.stats.correct += 1; } else { day.wrong += 1; run.stats.wrong += 1; }

  const e = battle.enemy, p = run.player;

  if (!correct) {
    if (battle.mercyLeft > 0) {
      battle.mercyLeft -= 1;
      battle.log.push(`\u{1F54A}️ Mercy Rune: ${a} ${RUNES[op].glyph} ${b} = <b>${result}</b>, not ${given}. This one is free.`);
      sfx.wrong();
      battle.sel = { aIdx: null, op: null, bIdx: null }; battle.typed = ''; battle.exprReadyAt = null;
      persist(); renderBattle(); return;
    }
    const tip = hintFor(a, op, b);
    battle.log.push(`❌ ${a} ${RUNES[op].glyph} ${b} = <b>${result}</b>, not ${given}.${tip ? ' ' + tip : ''}`);
    p.combo = 0;
    sfx.wrong();
    battle.sel = { aIdx: null, op: null, bIdx: null }; battle.typed = ''; battle.exprReadyAt = null;
    persist();
    return enemyTurn();
  }

  /* Correct. Work out what the number actually did. */
  const { damage, warded, resisted, capped } = computeDamage({
    result, op, ward: e.ward, resist: e.resist, resistAt: e.resistAt,
    armor: e.armor, relics: p.relics, combo: p.combo, ms, isFirstHit: battle.firstHit,
  });

  if (e.shield > 0) {
    if (result === e.shield) {
      e.shield = 0; battle.shieldTurns = 0;
      e.hp -= damage;
      battle.log.push(`\u{1F4A5} EXACT ${result}! The shield shatters and you hit for <b>${damage}</b>.`);
      sfx.shatter();
    } else {
      battle.log.push(`\u{1F6E1}️ The ${e.shield} shield swallows your ${result}. You need exactly ${e.shield}.`);
      sfx.hurt();
    }
  } else {
    e.hp -= damage;
    const note = capped ? ' (capped)' : resisted ? ' (resisted)' : '';
    battle.log.push(`${warded ? '\u{1F52E} WARD BROKEN! ' : '\u2694\uFE0F '}${a} ${RUNES[op].glyph} ${b} = ${result} \u2192 <b>${damage}</b> damage${note}.`);
    warded ? sfx.crit() : sfx.hit();
  }

  p.combo += 1;
  battle.firstHit = false;
  const used = [battle.sel.aIdx, battle.sel.bIdx];
  battle.sel = { aIdx: null, op: null, bIdx: null }; battle.typed = ''; battle.exprReadyAt = null;
  replaceTiles(used);
  persist();

  if (e.hp <= 0) return winBattle();
  enemyTurn();
}

/* The enemy's telegraphed move actually happening. Skipped entirely when the
   player parries it on a drill turn. */
function enemyAction() {
  const e = battle.enemy, p = run.player;
  const { events } = enemyAct(e, p, run.rng);
  for (const ev of events) {
    battle.log.push(ev.text);
    if (ev.type === 'damage') sfx.hurt();
    if (ev.type === 'jam') battle.pendingJam = true;
    if (ev.type === 'shield') battle.shieldTurns = 3;
  }
}

/* Timers and locks tick down whether or not the move landed, so a parry does
   not freeze a shield in place forever. */
function endEnemyPhase() {
  const e = battle.enemy;
  if (e.shield > 0) {
    battle.shieldTurns -= 1;
    if (battle.shieldTurns <= 0) { e.shield = 0; battle.log.push('The shield flickers out.'); }
  }
  battle.lockedId = null;
  if (battle.pendingJam) {
    const free = battle.tiles.filter(Boolean);
    if (free.length) battle.lockedId = free[Math.floor(run.rng() * free.length)].id;
    battle.pendingJam = false;
  }
}

function enemyTurn() {
  enemyAction();
  endEnemyPhase();
  nextTurn();
}

/* Turns alternate: the player builds their own strike, then the game hands
   them one. Building is where the thinking is; the drill is the only place
   the game can insist on a fact they would otherwise never choose. */
function drillsOn() {
  return profile.prefs ? profile.prefs.drills !== false : true;
}

function nextTurn() {
  if (run.player.hp <= 0) return loseRun();
  if (battle.enemy.hp <= 0) return winBattle();
  battle.turn += 1;
  if (battle.allDrills || (drillsOn() && battle.turn % 2 === 0)) return beginDrill();
  battle.mode = 'build';
  renderBattle();
}

/* ========================================================= drill turns === */
/* Share of a hit that still lands on a clean parry. Applies to every drill
   parry, not just duels: parrying is what a fluent player does on half of all
   turns, so a free parry removes most of the run's danger for them alone.
   A kid who misses takes the full hit either way, so this raises the ceiling
   without touching the floor. */
const PARRY_LEAK = 0.4;

let drillTimer = null;

function stopDrillTimer() {
  if (drillTimer) { clearInterval(drillTimer); drillTimer = null; }
}

function beginDrill() {
  const level = difficultyLevel(profile.mastery, profile.grade);
  const d = pickDrill(run.rng, profile.mastery, run.player.runes, level);
  if (!d) { battle.mode = 'build'; return renderBattle(); } // nothing to drill yet
  battle.mode = 'drill';
  /* The answer comes from the picker. Recomputing it here used to overwrite a
     written problem's answer with evaluate(undefined, undefined, undefined),
     which is NaN, so nothing the player typed could ever be right. */
  battle.drill = d;
  battle.allowanceMs = drillAllowanceMs(profile.mastery, d);
  battle.drillStart = performance.now();
  battle.typed = '';
  renderDrill();
}

/* Running the duel clock out does not end the run. The boss simply starts
   hitting twice as hard, so a slow fight gets dangerous rather than lost. */
function checkEnrage() {
  if (!battle.fightMs || battle.enemy.enraged) return false;
  if (performance.now() - battle.fightStart < battle.fightMs) return false;
  battle.enemy.enraged = true;
  battle.log.push(`\u{1F525} The duel has run long. ${esc(battle.enemy.name)} is ENRAGED and hits twice as hard.`);
  return true;
}

function fightTimerHtml() {
  if (!battle.fightMs) return '';
  const left = Math.max(0, battle.fightMs - (performance.now() - battle.fightStart));
  const pct = Math.max(0, left / battle.fightMs * 100);
  const enraged = battle.enemy.enraged;
  return `
    <div class="fight-timer ${enraged ? 'enraged' : ''}" id="fighttimer">
      <span style="width:${pct}%"></span>
      <b>${enraged ? '\u{1F525} ENRAGED' : `Duel clock ${Math.ceil(left / 1000)}s`}</b>
    </div>`;
}

function renderDrill() {
  const d = battle.drill, p = run.player;
  const intent = describeIntent(battle.enemy);
  render(`
    <div class="screen battle drill">
      ${topBar()}
      ${enemyCardHtml()}

      <div class="log">${battle.log.slice(-2).map(l => `<div>${l}</div>`).join('')}</div>

      ${battle.allDrills ? '<div class="duel-banner">\u2694\uFE0F BOSS DUEL</div>' : ''}
      ${fightTimerHtml()}

      <div class="incoming">\u26A1 INCOMING: ${intent.text}. Answer to parry it.</div>

      <div class="drill-group">
        <div class="timer" id="timerbar"><span style="width:100%"></span></div>
        ${d.kind === 'text' ? `
          <p class="asked">${esc(d.prompt)}</p>
          <div class="drill-problem">
            <span class="answer ${battle.typed ? 'filled' : ''}">${battle.typed || '_'}</span>
          </div>` : `
          <div class="drill-problem">
            <span class="dp">${d.a}</span>
            <span class="dp op">${RUNES[d.op].glyph}</span>
            <span class="dp">${d.b}</span>
            <span class="eq">=</span>
            <span class="answer ${battle.typed ? 'filled' : ''}">${battle.typed || '_'}</span>
          </div>`}
      </div>

      ${keypadHtml({ submitId: 'answer', submitLabel: 'PARRY', ready: !!battle.typed, extras: d.kind === 'text' })}

      <div class="player-strip">
        <span class="hp-pill">\u2764\uFE0F ${Math.max(0, p.hp)}/${p.maxHp}</span>
        <span class="combo ${p.combo ? 'on' : ''}">\u{1F525} Combo ${p.combo}</span>
        <span class="relic-tray inline">${p.relics.map(id => `<span class="relic-mini" title="${esc(RELIC_BY_ID[id].text)}">${RELIC_BY_ID[id].art}</span>`).join('')}</span>
      </div>
    </div>`);

  $$('.key').forEach(b => b.onclick = () => {
    battle.typed = typeInto(battle.typed, b.dataset.k);
    sfx.tap();
    renderDrill();
  });
  const go = $('#answer');
  if (go) go.onclick = () => resolveDrill(battle.typed);

  startDrillTimer();
}

function startDrillTimer() {
  stopDrillTimer();
  drillTimer = setInterval(() => {
    if (!battle || battle.mode !== 'drill') return stopDrillTimer();
    const bar = app.querySelector('#timerbar span');
    if (!bar) return stopDrillTimer();
    const left = battle.allowanceMs - (performance.now() - battle.drillStart);
    const pct = Math.max(0, left / battle.allowanceMs * 100);
    bar.style.width = `${pct}%`;
    bar.classList.toggle('low', pct < 33);

    if (battle.fightMs) {
      const wasEnraged = battle.enemy.enraged;
      checkEnrage();
      const box = app.querySelector('#fighttimer');
      if (box) {
        const dleft = Math.max(0, battle.fightMs - (performance.now() - battle.fightStart));
        box.querySelector('span').style.width = `${dleft / battle.fightMs * 100}%`;
        if (battle.enemy.enraged) {
          box.classList.add('enraged');
          box.querySelector('b').textContent = '\u{1F525} ENRAGED';
        } else if (!wasEnraged) {
          box.querySelector('b').textContent = `Duel clock ${Math.ceil(dleft / 1000)}s`;
        }
      }
    }

    if (left <= 0) { stopDrillTimer(); resolveDrill(null); }
  }, 80);
}

function resolveDrill(text) {
  stopDrillTimer();
  const d = battle.drill, e = battle.enemy, p = run.player;
  const ms = Math.round(performance.now() - battle.drillStart);
  const timedOut = text === null;
  const { ok: correct, note } = timedOut ? { ok: false, note: null } : checkAnswer(text, d.answer);
  const shown = d.kind === 'text' ? d.prompt : `${d.a} ${RUNES[d.op].glyph} ${d.b}`;
  const expected = formatAnswer(d.answer);

  recordAttempt(profile.mastery, { skill: d.skill, fact: d.fact, correct, ms });
  const day = store.todayEntry(profile);
  if (correct) { day.correct += 1; run.stats.correct += 1; } else { day.wrong += 1; run.stats.wrong += 1; }

  // Mercy still means "free", so it parries without the counter.
  const mercied = !correct && battle.mercyLeft > 0;
  if (mercied) battle.mercyLeft -= 1;
  checkEnrage();

  if (correct) {
    /* A parry blunts the blow rather than stopping it outright. */
    const pending = e.intents[e.intentIndex % e.intents.length];
    if (pending.dmg) {
      const block = p.relics.map(id => RELIC_BY_ID[id]).filter(Boolean)
        .reduce((sum, r) => sum + (r.block || 0), 0);
      const raw = e.enraged ? pending.dmg * 2 : pending.dmg;
      const leak = Math.max(1, Math.round(raw * PARRY_LEAK) - block);
      p.hp -= leak;
      battle.log.push(`You turn the blow aside, but ${leak} still gets through.`);
    }
    e.intentIndex += 1; // the telegraphed move never happens

    /* A written answer can be a fraction, a decimal or a negative, none of
       which make sense as a damage number, so a written problem counters for
       what an average drill answer is worth in this fight. A calculation
       counters for its own result, as before.

       Either way the counter gets no ward or resist bonus: the player did not
       choose the number, so the reward is for speed and accuracy and the built
       turn keeps the high ceiling. A riposte also ignores shields, so a
       shielded enemy cannot make drills a dead turn. */
    const result = d.kind === 'text' ? battle.askedDamage : d.answer;
    const { damage } = computeDamage({
      result, op: d.op || '+', ward: 'none', resist: 'none', resistAt: 0,
      armor: e.armor, relics: p.relics, combo: p.combo, ms, isFirstHit: false,
    });
    e.hp -= damage;
    p.combo += 1;
    battle.log.push(d.kind === 'text'
      ? `\u{1F6E1}\uFE0F PARRIED! ${expected} is right, riposte for <b>${damage}</b>.${note ? ' ' + note : ''}`
      : `\u{1F6E1}\uFE0F PARRIED! ${shown} = ${expected}, riposte for <b>${damage}</b>.`);
    sfx.crit();
  } else if (mercied) {
    e.intentIndex += 1;
    battle.log.push(`\u{1F54A}\uFE0F Mercy Rune parries it. The answer was <b>${expected}</b>.`);
    sfx.wrong();
  } else {
    const tip = d.kind === 'arith' ? hintFor(d.a, d.op, d.b) : null;
    battle.log.push(timedOut
      ? `\u23F1\uFE0F Too slow. The answer was <b>${expected}</b>.${tip ? ' ' + tip : ''}`
      : `\u274C The answer was <b>${expected}</b>, not ${esc(text)}.${tip ? ' ' + tip : ''}`);
    p.combo = 0;
    sfx.wrong();
    enemyAction();
  }

  endEnemyPhase();
  persist();
  nextTurn();
}

function winBattle() {
  const p = run.player, e = battle.enemy;
  const goldBonus = p.relics.map(id => RELIC_BY_ID[id]).filter(Boolean)
    .reduce((s, r) => s + (r.goldBonus || 0), 0);
  const gold = (battle.reward.gold || 0) + goldBonus;
  p.gold += gold;
  const healAfter = p.relics.map(id => RELIC_BY_ID[id]).filter(Boolean)
    .reduce((s, r) => s + (r.healAfter || 0), 0);
  if (healAfter) p.hp = Math.min(p.maxHp, p.hp + healAfter);
  run.stats.battlesWon += 1;
  let unlockMsg = '';
  if (e.boss) { profile.records.bossesFelled += 1; unlockMsg = grantBossUnlock(); }
  persist();
  sfx.win();

  render(`
    <div class="screen center">
      ${topBar()}
      <div class="panel win">
        <h2>${e.boss ? 'BOSS FELLED' : 'Victory'}</h2>
        <div class="big-art">${e.art}</div>
        <p>${esc(e.name)} is beaten.</p>
        <p class="reward">\u{1FA99} +${gold} gold${healAfter ? ` &middot; ❤️ +${healAfter}` : ''}</p>
        ${unlockMsg ? `<p class="unlock">${unlockMsg}</p>` : ''}
        <button class="btn primary" id="cont">Continue</button>
      </div>
    </div>`);
  $('#cont').onclick = () => {
    sfx.tap();
    if (e.boss && !run.endless && run.depth >= FINAL_DEPTH) return screenRunComplete();
    if (battle.reward.relic) return screenRelicPick(() => nextFloor());
    nextFloor();
  };
}

/* Clearing floor 20. The one screen in the game that says "you finished". */
function screenRunComplete() {
  run.over = true;
  profile.records.wins = (profile.records.wins || 0) + 1;
  persist();
  sfx.win();
  const total = run.stats.correct + run.stats.wrong;
  const acc = total ? Math.round(run.stats.correct / total * 100) : 0;
  render(`
    <div class="screen center">
      <div class="panel win">
        <h2>THE DEEP IS CLEARED</h2>
        <div class="big-art">\u{1F3C6}</div>
        <p class="center">You beat all 20 floors.</p>
        <ul class="run-stats">
          <li><b>${run.stats.battlesWon}</b> monsters beaten</li>
          <li><b>${run.stats.correct}</b> right &middot; <b>${run.stats.wrong}</b> wrong (${acc}%)</li>
          <li>Clears: <b>${profile.records.wins}</b></li>
        </ul>
        <p class="unlock">\u{1F513} Endless run unlocked. It never stops getting harder.</p>
        <button class="btn primary big" id="again">Back to camp</button>
      </div>
    </div>`);
  $('#again').onclick = () => { sfx.tap(); screenHub(); };
}

function loseRun() {
  run.over = true;
  sfx.lose();
  const acc = run.stats.correct + run.stats.wrong
    ? Math.round(run.stats.correct / (run.stats.correct + run.stats.wrong) * 100) : 0;
  persist();
  render(`
    <div class="screen center">
      <div class="panel lose">
        <h2>You fell on floor ${run.depth}</h2>
        <div class="big-art">\u{1F480}</div>
        <ul class="run-stats">
          <li><b>${run.stats.battlesWon}</b> monsters beaten</li>
          <li><b>${run.stats.correct}</b> right &middot; <b>${run.stats.wrong}</b> wrong (${acc}%)</li>
          <li>Deepest floor ever: <b>${profile.records.deepest}</b></li>
        </ul>
        <button class="btn primary big" id="again">Run again</button>
        <button class="btn ghost" id="home">Back to camp</button>
      </div>
    </div>`);
  $('#again').onclick = () => { sfx.tap(); beginRun(); };
  $('#home').onclick = () => { sfx.tap(); screenHub(); };
}

/* A shared keypad. Middle school answers can be fractions, decimals or
   negative, so those keys appear wherever a written answer is typed. Strike
   answers are always whole numbers of at least one, so that keypad stays
   digits only and keeps its big three-column targets. */
function keypadHtml({ submitId, submitLabel, ready, extras = false }) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  if (!extras) {
    return `
      <div class="keypad">
        ${digits.map(n => `<button class="key" data-k="${n}">${n}</button>`).join('')}
        <button class="key" data-k="back">\u232B</button>
        <button class="key" data-k="0">0</button>
        <button class="key strike" id="${submitId}" ${ready ? '' : 'disabled'}>${submitLabel}</button>
      </div>`;
  }
  const rows = [[1, 2, 3, '/'], [4, 5, 6, '.'], [7, 8, 9, '-']];
  return `
    <div class="keypad four">
      ${rows.flat().map(k => `<button class="key ${typeof k === 'string' ? 'sym' : ''}" data-k="${k}">${k === '-' ? '\u2212' : k}</button>`).join('')}
      <button class="key" data-k="back">\u232B</button>
      <button class="key" data-k="0">0</button>
      <button class="key strike wide" id="${submitId}" ${ready ? '' : 'disabled'}>${submitLabel}</button>
    </div>`;
}

/* ======================================================== number entry === */
/* Shared typed-answer panel. No multiple choice anywhere in this game:
   a guess has to be a number the kid actually produced. */
function askNumber({ title, art, prompt, sub, onSubmit, extras = true }) {
  let typed = '';
  const startedAt = performance.now();
  const draw = () => {
    render(`
      <div class="screen center">
        ${run ? topBar() : ''}
        <div class="panel ask">
          <h2>${title}</h2>
          <div class="big-art">${art}</div>
          <p class="prompt">${prompt}</p>
          ${sub ? `<p class="muted tiny">${sub}</p>` : ''}
          <div class="answer-box ${typed ? 'filled' : ''}">${typed || '_'}</div>
          ${keypadHtml({ submitId: 'go', submitLabel: 'ANSWER', ready: !!typed, extras })}
        </div>
      </div>`);
    $$('.key').forEach(b => b.onclick = () => {
      typed = typeInto(typed, b.dataset.k);
      sfx.tap(); draw();
    });
    const go = $('#go');
    if (go) go.onclick = () => onSubmit(typed, Math.round(performance.now() - startedAt));
  };
  draw();
}

function resultCard({ correct, answer, given, body, onNext }) {
  render(`
    <div class="screen center">
      ${run ? topBar() : ''}
      <div class="panel ${correct ? 'win' : 'lose'}">
        <h2>${correct ? 'Correct' : 'Not quite'}</h2>
        <div class="big-art">${correct ? '✅' : '❌'}</div>
        ${correct ? '' : `<p>The answer was <b>${answer}</b>. You said ${given ? esc(given) : '—'}.</p>`}
        <p>${body}</p>
        <button class="btn primary" id="next">Continue</button>
      </div>`);
  $('#next').onclick = () => { sfx.tap(); onNext(); };
}

/* ============================================================== riddle === */
function screenRiddle() {
  const r = generateRiddle(run.rng, profile.mastery, run.recentRiddles, profile.grade);
  run.recentRiddles = [r.id, ...run.recentRiddles].slice(0, 5);
  askNumber({
    title: 'Riddle Shrine',
    art: '\u{1F52E}',
    prompt: esc(r.text),
    sub: 'Solve it for a relic. Get it wrong and the shrine bites.',
    onSubmit: (text, ms) => {
      const { ok: correct } = checkAnswer(text, r.answer);
      recordAttempt(profile.mastery, { skill: r.skill, fact: null, correct, ms });
      const day = store.todayEntry(profile);
      correct ? (day.correct += 1, run.stats.correct += 1) : (day.wrong += 1, run.stats.wrong += 1);
      const heal = run.player.relics.map(id => RELIC_BY_ID[id]).filter(Boolean)
        .reduce((s, x) => s + (x.riddleHeal || 0), 0);
      if (correct) {
        if (heal) run.player.hp = Math.min(run.player.maxHp, run.player.hp + heal);
        sfx.reward();
      } else {
        run.player.hp -= 6; run.player.combo = 0; sfx.wrong();
      }
      persist();
      if (run.player.hp <= 0) return loseRun();
      resultCard({
        correct, answer: formatAnswer(r.answer), given: text,
        body: correct ? `The shrine opens.${heal ? ` ❤️ +${heal}` : ''}` : 'You take 6 damage and the shrine seals.',
        onNext: () => correct ? screenRelicPick(() => nextFloor()) : nextFloor(),
      });
    },
  });
}

/* ============================================================ treasure === */
function screenTreasure() {
  /* The chest lock is a place-value / estimation question, so treasure nodes
     exercise a different skill than combat does. */
  const rng = run.rng;
  // Digits are built so the answer is never 0, which reads as a broken question.
  const n = (1 + Math.floor(rng() * 9)) * 1000 + (1 + Math.floor(rng() * 9)) * 100
          + (1 + Math.floor(rng() * 9)) * 10 + Math.floor(rng() * 10);
  const kind = Math.floor(rng() * 3);
  const q = kind === 0
    ? { text: `The lock reads <b>${n}</b>. Round it to the nearest HUNDRED.`, answer: Math.round(n / 100) * 100 }
    : kind === 1
      ? { text: `The lock reads <b>${n}</b>. What is the value of the TENS digit? (In 4560 it is 60.)`, answer: Math.floor(n / 10) % 10 * 10 }
      : { text: `The lock reads <b>${n}</b>. Round it to the nearest TEN.`, answer: Math.round(n / 10) * 10 };

  askNumber({
    title: 'Locked Chest', art: '\u{1F4E6}', prompt: q.text,
    sub: 'Crack the lock to take what is inside.',
    onSubmit: (text, ms) => {
      const { ok: correct } = checkAnswer(text, q.answer);
      recordAttempt(profile.mastery, { skill: 'place_est', fact: null, correct, ms });
      const day = store.todayEntry(profile);
      correct ? (day.correct += 1, run.stats.correct += 1) : (day.wrong += 1, run.stats.wrong += 1);

      let body = 'The chest stays shut.';
      if (correct) {
        const missingRune = unlockedOps(profile.mastery, profile.grade).find(o => !run.player.runes.includes(o));
        if (missingRune && run.rng() < 0.6) {
          run.player.runes.push(missingRune);
          body = `Inside is the <b>${RUNES[missingRune].name}</b> (${RUNES[missingRune].glyph}). You can use it for the rest of this run.`;
        } else {
          const gold = 20 + run.depth * 4;
          run.player.gold += gold;
          body = `\u{1FA99} +${gold} gold.`;
        }
        sfx.reward();
      } else { sfx.wrong(); }
      persist();
      resultCard({ correct, answer: formatAnswer(q.answer), given: text, body, onNext: () => nextFloor() });
    },
  });
}

/* ================================================================ shop === */
function screenShop() {
  const p = run.player;
  const stock = offerRelics(run.rng, p.relics, 2)
    .map(r => ({ kind: 'relic', relic: r, price: 35 + run.depth * 3 }));
  stock.push({ kind: 'heal', price: 20, label: 'Healing draught', art: '\u{1F9EA}', text: 'Restore 18 health.' });
  const missingRune = unlockedOps(profile.mastery, profile.grade).find(o => !p.runes.includes(o));
  if (missingRune) stock.push({ kind: 'rune', op: missingRune, price: 45, label: RUNES[missingRune].name, art: RUNES[missingRune].glyph, text: 'Adds this operator for the rest of the run.' });

  const draw = () => {
    render(`
      <div class="screen">
        ${topBar()}
        <div class="panel">
          <h2>\u{1F3EA} The Trader</h2>
          <p class="muted center">You have <b>${p.gold}</b> gold.</p>
          <div class="shop-list">
            ${stock.map((s, i) => {
              const art = s.kind === 'relic' ? s.relic.art : s.art;
              const name = s.kind === 'relic' ? s.relic.name : s.label;
              const text = s.kind === 'relic' ? s.relic.text : s.text;
              const gone = s.sold;
              return `<button class="shop-item ${gone ? 'sold' : ''}" data-i="${i}" ${gone || p.gold < s.price ? 'disabled' : ''}>
                <span class="si-art">${art}</span>
                <span class="si-body"><b>${esc(name)}</b><small>${esc(text)}</small></span>
                <span class="si-price">${gone ? 'SOLD' : `\u{1FA99} ${s.price}`}</span>
              </button>`;
            }).join('')}
          </div>
          <button class="btn primary" id="leave">Leave the shop</button>
        </div>
      </div>`);
    $$('.shop-item').forEach(b => b.onclick = () => {
      const s = stock[+b.dataset.i];
      if (s.sold || p.gold < s.price) return;
      p.gold -= s.price; s.sold = true;
      if (s.kind === 'relic') p.relics.push(s.relic.id);
      if (s.kind === 'heal') p.hp = Math.min(p.maxHp, p.hp + 18);
      if (s.kind === 'rune') p.runes.push(s.op);
      sfx.reward(); persist(); draw();
    });
    $('#leave').onclick = () => { sfx.tap(); nextFloor(); };
  };
  draw();
}

/* ================================================================ rest === */
function screenRest() {
  const p = run.player;
  render(`
    <div class="screen center">
      ${topBar()}
      <div class="panel">
        <h2>\u{1F525} Campfire</h2>
        <p class="muted center">Take one.</p>
        <div class="choices">
          <button class="choice" id="heal"><span class="ci">❤️</span><b>Rest</b><small>Heal ${Math.round(p.maxHp * 0.5)} health</small></button>
          <button class="choice" id="train"><span class="ci">\u{1F4AA}</span><b>Train</b><small>+8 max health, permanently this run</small></button>
        </div>
      </div>
    </div>`);
  $('#heal').onclick = () => { p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.5)); sfx.reward(); persist(); nextFloor(); };
  $('#train').onclick = () => { p.maxHp += 8; p.hp += 8; sfx.reward(); persist(); nextFloor(); };
}

/* ========================================================== relic pick === */
function screenRelicPick(onDone) {
  const offer = offerRelics(run.rng, run.player.relics, 3);
  if (!offer.length) return onDone();
  render(`
    <div class="screen center">
      ${topBar()}
      <div class="panel">
        <h2>Choose a relic</h2>
        <div class="choices vertical">
          ${offer.map((r, i) => `
            <button class="choice wide" data-i="${i}">
              <span class="ci">${r.art}</span>
              <b>${esc(r.name)}</b>
              <small>${esc(r.text)}</small>
            </button>`).join('')}
        </div>
        <button class="btn ghost small" id="skip">Skip</button>
      </div>
    </div>`);
  $$('.choice').forEach(b => b.onclick = () => {
    run.player.relics.push(offer[+b.dataset.i].id);
    if (!profile.meta.unlockedRelics.includes(offer[+b.dataset.i].id)) profile.meta.unlockedRelics.push(offer[+b.dataset.i].id);
    sfx.reward(); persist(); onDone();
  });
  $('#skip').onclick = () => { sfx.tap(); onDone(); };
}

/* Beating a boss permanently unlocks a starting rune for future runs. */
function grantBossUnlock() {
  const meta = profile.meta;
  if (meta.bonusHp >= 40) return `\u{1F451} You have felled every crown. Nothing left to unlock.`;
  meta.bonusHp += 5;
  return `\u{1F451} Every future run now starts with <b>+${meta.bonusHp}</b> extra health.`;
}

/* ======================================================= grown-up area === */
/* A deliberately un-8-year-old-friendly gate. Not security, just friction. */
function parentGate() {
  let typed = '';
  const answer = 391;
  const draw = () => {
    render(`
      <div class="screen center">
        <div class="panel ask">
          <h2>Grown-ups only</h2>
          <p class="prompt">What is 23 &times; 17?</p>
          <div class="answer-box ${typed ? 'filled' : ''}">${typed || '_'}</div>
          ${keypadHtml({ submitId: 'go', submitLabel: 'ENTER', ready: true, extras: false })}
          <button class="btn ghost small" id="back">Back</button>
        </div>
      </div>`);
    $$('.key').forEach(b => b.onclick = () => { typed = typeInto(typed, b.dataset.k); draw(); });
    $('#go').onclick = () => {
      if (parseAnswer(typed)?.value === answer) screenReport();
      else { typed = ''; draw(); }
    };
    $('#back').onclick = () => (profile ? screenHub() : screenProfiles());
  };
  draw();
}

/* "7*8" is how a fact is keyed; "7 x 8" is how a person reads it. */
function fmtFact(key) {
  return key.replace('*', ' \u00d7 ').replace('/', ' \u00f7 ').replace('+', ' + ').replace('-', ' \u2212 ');
}

function fmtMinutes(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function screenReport() {
  const list = data.profiles;
  const rows = list.map(p => {
    const totalMs = p.days.reduce((s, d) => s + d.ms, 0);
    const correct = p.days.reduce((s, d) => s + d.correct, 0);
    const wrong = p.days.reduce((s, d) => s + d.wrong, 0);
    const acc = correct + wrong ? Math.round(correct / (correct + wrong) * 100) : 0;

    const bars = SKILLS.map(s => {
      const rec = p.mastery.skills[s.id] || { attempts: 0, correct: 0, totalMs: 0 };
      const score = Math.round(skillScore(rec, s.id) * 100);
      const seen = rec.attempts;
      const acc2 = seen ? Math.round(rec.correct / seen * 100) : 0;
      const avg = seen ? Math.round(rec.totalMs / seen / 100) / 10 : 0;
      const state = seen < 4 ? 'untested' : score >= 70 ? 'solid' : score >= 40 ? 'working' : 'weak';
      return `<div class="skill-row ${state}">
        <div class="sr-label">${esc(s.label)}</div>
        <div class="bar skill"><span style="width:${score}%"></span></div>
        <div class="sr-meta">${seen < 4 ? 'not enough data' : `${acc2}% right &middot; ${avg}s avg &middot; ${seen} tries`}</div>
      </div>`;
    }).join('');

    const shaky = shakyFacts(p.mastery, 10);
    const guessy = shaky.filter(f => f.accuracy < 0.6 && f.avgMs < 3000);

    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const e = p.days.find(x => x.date === key);
      last14.push({ key, ms: e ? e.ms : 0 });
    }
    const maxMs = Math.max(1, ...last14.map(d => d.ms));

    return `
      <div class="report-card">
        <div class="hero-row">
          <span class="pa big">${p.avatar}</span>
          <div><h3>${esc(p.name)}</h3>
            <p class="muted">${fmtMinutes(totalMs)} played &middot; ${correct + wrong} problems &middot; <b>${acc}%</b> right &middot; deepest floor ${p.records.deepest}</p>
          </div>
        </div>

        <h4>Where they are</h4>
        <div class="skills">${bars}</div>

        <h4>Facts to drill</h4>
        ${shaky.length
          ? `<div class="facts">${shaky.map(f => `<span class="fact ${f.accuracy < 0.5 ? 'bad' : ''}">${esc(fmtFact(f.key))} <small>${Math.round(f.accuracy * 100)}% &middot; ${(f.avgMs / 1000).toFixed(1)}s</small></span>`).join('')}</div>`
          : '<p class="muted tiny">Nothing to drill. Every fact they have met is quick and correct.</p>'}
        ${guessy.length ? `<p class="flag">⚠️ Answering fast and wrong on: ${guessy.map(f => esc(fmtFact(f.key))).join(', ')}. That pattern usually means guessing, not a gap in knowledge.</p>` : ''}

        <h4>Last 14 days</h4>
        <div class="spark">${last14.map(d => `<span class="sp" style="height:${Math.max(3, d.ms / maxMs * 40)}px" title="${d.key}: ${fmtMinutes(d.ms)}"></span>`).join('')}</div>

        <h4>School year</h4>
        <p class="muted tiny">Only a starting point, and it fades as their own answers accumulate. Raise it if they are being served work below them; lower it if they are struggling. Changing it never touches their record.</p>
        <div class="grades compact">
          ${GRADES.map(g => `<button class="grade ${p.grade === g.id ? 'on' : ''}" data-grade-for="${p.id}" data-grade="${g.id}"><b>${g.label}</b></button>`).join('')}
        </div>

        <div class="card-actions">
          <button class="btn ghost small" data-drills="${p.id}">Timed drill turns: <b>${p.prefs?.drills === false ? 'off' : 'on'}</b></button>
          <button class="btn ghost small" data-export="${p.id}">Back up / move ${esc(p.name)}</button>
        </div>
        <p class="muted tiny">Every second turn the game picks a problem, weighted to the facts they avoid, with a clock set from their own answering speed. Turn it off if the timer causes more stress than it is worth.</p>

        <details class="danger">
          <summary>Reset ${esc(p.name)}</summary>
          <p class="muted tiny">Wipes progress and the learning record for this hero. Cannot be undone.</p>
          <button class="btn danger small" data-reset="${p.id}">Delete this hero</button>
        </details>
      </div>`;
  }).join('');

  render(`
    <div class="screen report">
      <div class="report-head">
        <h2>Report card</h2>
        <button class="btn ghost small" id="back">Done</button>
      </div>
      <div class="head-actions">
        <button class="btn ghost small" id="importBtn">Bring a hero in</button>
        ${data.profiles.length > 1 ? '<button class="btn ghost small" id="exportAll">Back up everything</button>' : ''}
      </div>
      <p class="muted tiny">Bars combine accuracy and speed, weighted toward recent answers, and stay low until there are enough attempts to judge. Word problems and place value are scored on accuracy alone, since reading and reasoning should take longer. Nothing here leaves this device.</p>
      ${rows || '<p class="muted">No heroes yet.</p>'}
    </div>`);

  $('#back').onclick = () => (profile ? screenHub() : screenProfiles());
  $('#importBtn').onclick = () => { sfx.tap(); screenImport(); };
  const exAll = $('#exportAll');
  if (exAll) exAll.onclick = () => { sfx.tap(); screenBackup(data.profiles); };
  $$('[data-grade-for]').forEach(b => b.onclick = () => {
    const hero = data.profiles.find(x => x.id === b.dataset.gradeFor);
    if (!hero) return;
    const next = Number(b.dataset.grade);
    hero.grade = hero.grade === next ? 0 : next;  // tapping the current one clears it
    persist(); sfx.tap(); screenReport();
  });
  $$('[data-drills]').forEach(b => b.onclick = () => {
    const hero = data.profiles.find(x => x.id === b.dataset.drills);
    if (!hero) return;
    hero.prefs = { ...hero.prefs, drills: hero.prefs?.drills === false };
    persist(); sfx.tap(); screenReport();
  });
  $$('[data-export]').forEach(b => b.onclick = () => {
    const hero = data.profiles.find(x => x.id === b.dataset.export);
    if (hero) { sfx.tap(); screenBackup([hero]); }
  });
  $$('[data-reset]').forEach(b => b.onclick = () => {
    const id = b.dataset.reset;
    data.profiles = data.profiles.filter(x => x.id !== id);
    if (data.activeId === id) { data.activeId = null; profile = null; run = null; }
    persist(); screenReport();
  });
}

/* ===================================================== backup / restore ===
   There is no account and no server, so a hero exists in exactly one browser
   on one device. Both paths are offered on every screen below, because a
   download and a file picker are not reliable inside an installed web app on
   every phone, while copy and paste always is. */

function screenBackup(profiles, onDone = screenReport) {
  const text = JSON.stringify(store.exportPayload(profiles), null, 2);
  const filename = store.exportFilename(profiles);
  const who = profiles.length === 1 ? esc(profiles[0].name) : `all ${profiles.length} heroes`;

  render(`
    <div class="screen report">
      <div class="report-head">
        <h2>Back up ${who}</h2>
        <button class="btn ghost small" id="back">Done</button>
      </div>
      <div class="report-card">
        <p class="muted tiny">This is the whole record: heroes, progress and everything the report card is built from. Save the file somewhere safe, or paste the text into the other device under "Bring a hero in". Importing does not remove it from this device, so you can keep playing here.</p>
        <div class="head-actions">
          <button class="btn primary small" id="download">Download the file</button>
          <button class="btn ghost small" id="copy">Copy the text</button>
        </div>
        <p class="muted tiny" id="status"></p>
        <textarea class="backup-box" id="payload" readonly spellcheck="false">${esc(text)}</textarea>
      </div>
    </div>`);

  const status = $('#status');
  $('#back').onclick = () => { sfx.tap(); onDone(); };

  $('#download').onclick = () => {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = `Saved as ${filename}.`;
      sfx.reward();
    } catch {
      status.textContent = 'This device would not download the file. Use "Copy the text" instead.';
    }
  };

  $('#copy').onclick = async () => {
    const box = $('#payload');
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Copied. Paste it into the other device.';
      sfx.reward();
    } catch {
      box.focus();
      box.select();
      status.textContent = 'Copying was blocked. The text is selected, copy it by hand.';
    }
  };
}

function screenImport() {
  render(`
    <div class="screen report">
      <div class="report-head">
        <h2>Bring a hero in</h2>
        <button class="btn ghost small" id="back">Cancel</button>
      </div>
      <div class="report-card">
        <p class="muted tiny">Load a backup made on another device. Either pick the file, or paste the text you copied.</p>
        <input type="file" id="file" accept="application/json,.json">
        <p class="muted tiny center">or</p>
        <textarea class="backup-box" id="paste" placeholder="Paste the backup text here" spellcheck="false"></textarea>
        <button class="btn primary small" id="go">Bring them in</button>
        <p class="flag" id="err" hidden></p>
      </div>
    </div>`);

  const fail = msg => { const e = $('#err'); e.hidden = false; e.textContent = msg; sfx.wrong(); };
  $('#back').onclick = () => { sfx.tap(); screenReport(); };
  $('#file').onchange = async ev => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try { handleImport(await f.text()); } catch { fail('That file could not be read.'); }
  };
  $('#go').onclick = () => {
    const text = $('#paste').value.trim();
    if (!text) return fail('Paste the backup text first, or pick the file.');
    handleImport(text);
  };

  function handleImport(text) {
    let heroes;
    try { heroes = store.parseImport(text); } catch (e) { return fail(e.message); }
    const existing = new Set(data.profiles.map(h => h.id));
    const clashes = heroes.filter(h => existing.has(h.id));
    if (!clashes.length) return commitImport(heroes, 'add');
    screenImportClash(heroes, clashes);
  }
}

/* The same hero imported onto a device that already has them. Merging two
   divergent learning records would invent data, so the parent picks. */
function screenImportClash(heroes, clashes) {
  render(`
    <div class="screen center">
      <div class="panel">
        <h2>Already here</h2>
        <p class="center">${clashes.map(h => esc(h.name)).join(', ')} ${clashes.length === 1 ? 'is' : 'are'} already on this device.</p>
        <div class="choices vertical">
          <button class="choice wide" id="replace">
            <span class="ci">\u{1F504}</span><b>Use the backup</b>
            <small>Overwrite what is on this device. Right when the backup is the newer one.</small>
          </button>
          <button class="choice wide" id="copy">
            <span class="ci">\u{1F465}</span><b>Keep both</b>
            <small>Add the backup alongside, as a second hero. Nothing is overwritten.</small>
          </button>
        </div>
        <button class="btn ghost small" id="cancel">Cancel</button>
      </div>
    </div>`);
  $('#replace').onclick = () => commitImport(heroes, 'replace');
  $('#copy').onclick = () => commitImport(heroes, 'copy');
  $('#cancel').onclick = () => { sfx.tap(); screenReport(); };
}

function commitImport(heroes, mode) {
  const names = [];
  for (const hero of heroes) {
    const at = data.profiles.findIndex(h => h.id === hero.id);
    if (at === -1) { data.profiles.push(hero); names.push(hero.name); continue; }
    if (mode === 'replace') { data.profiles[at] = hero; names.push(hero.name); }
    else { const dup = store.asCopy(hero); data.profiles.push(dup); names.push(dup.name); }
  }
  persist();
  sfx.win();
  render(`
    <div class="screen center">
      <div class="panel win">
        <h2>Brought in</h2>
        <div class="big-art">\u2705</div>
        <p class="center">${names.map(esc).join(', ')} ${names.length === 1 ? 'is' : 'are'} on this device now.</p>
        <p class="muted tiny center">Progress from here is separate again. Back up whichever device they actually play on.</p>
        <button class="btn primary" id="done">Done</button>
      </div>
    </div>`);
  $('#done').onclick = () => { sfx.tap(); screenReport(); };
}

/* ============================================================ keyboard === */
/* Physical keyboards should work as well as the on-screen pad. */
document.addEventListener('keydown', ev => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (ev.target && /^(INPUT|TEXTAREA)$/.test(ev.target.tagName)) return;
  let btn = null;
  if (/^[0-9]$/.test(ev.key)) btn = app.querySelector(`.key[data-k="${ev.key}"]`);
  else if (ev.key === 'Backspace') btn = app.querySelector('.key[data-k="back"]');
  else if (ev.key === 'Enter') btn = app.querySelector('#strike:not([disabled]), #answer:not([disabled]), #go:not([disabled]), #next, #cont');
  if (btn && !btn.disabled) { ev.preventDefault(); btn.click(); }
});

/* ====================================================== service worker === */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then(reg => reg.update())
      .catch(() => { /* offline install optional */ });
  });

  /* When a new worker takes over, the page is still running the old code.
     Reload once so a deploy actually reaches the device instead of waiting
     for someone to guess that they need to refresh twice. The flag stops it
     looping if a worker ever activates repeatedly. */
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

boot();
