// Knight School app: books, puzzle trainer, play the Coach, lessons, players.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const strip = s => s.replace(/[+#!?]/g, '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  KS.THEMES.strategy = { label: 'Best move', tip: 'No quick trick here. Which move makes your pieces stronger, or your opponent\'s weaker?' };
  const LESSON_FOR = Object.fromEntries(LESSONS.filter(l => l.theme).map(l => [l.theme, l]));
  LESSON_FOR.mate = LESSON_FOR.backrank;

  // ---------- saved progress (this device only) ----------
  const KEY = 'knight-school-v1';
  let S = { players: [{ id: 'p1', name: 'Player 1' }], cur: 'p1', prog: {}, voice: false };
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const prog = () => (S.prog[S.cur] = S.prog[S.cur] || { stars: {}, lessons: {} });
  const totalStars = () => Object.values(prog().stars).reduce((a, b) => a + b, 0);

  function renderPlayers() {
    $('#player').innerHTML = S.players.map(p => `<option value="${p.id}" ${p.id === S.cur ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    $('#starCount').textContent = totalStars();
  }
  $('#player').addEventListener('change', e => { S.cur = e.target.value; save(); renderPlayers(); refresh(); });
  $('#addKidBtn').addEventListener('click', () => { $('#kidForm').hidden = false; $('#kidName').focus(); });
  $('#kidCancel').addEventListener('click', () => { $('#kidForm').hidden = true; });
  $('#kidForm').addEventListener('submit', e => {
    e.preventDefault(); const name = $('#kidName').value.trim(); if (!name) return;
    const id = 'p' + Date.now();
    if (S.players.length === 1 && S.players[0].name === 'Player 1' && !Object.keys(prog().stars).length) S.players[0] = { id: S.cur = id, name };
    else { S.players.push({ id, name }); S.cur = id; }
    $('#kidName').value = ''; $('#kidForm').hidden = true; save(); renderPlayers(); refresh();
  });
  const playerName = () => (S.players.find(p => p.id === S.cur) || {}).name || 'friend';

  // ---------- backup / restore (progress lives in this browser only) ----------
  const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify({ app: 'knight-school', format: 1, saved: new Date().toISOString(), data: { players: S.players, cur: S.cur, prog: S.prog } }))));
  function decode(code) {
    let o; try { o = JSON.parse(decodeURIComponent(escape(atob(code.trim().replace(/\s+/g, ''))))); } catch (e) { throw new Error('That code could not be read. Make sure you copied all of it.'); }
    if (!o || o.app !== 'knight-school' || !o.data || !Array.isArray(o.data.players)) throw new Error('That is not a Knight School backup code.');
    return o.data;
  }
  let restoreArmed = false;
  $('#backupBtn').addEventListener('click', () => { const p = $('#backupPanel'); p.hidden = !p.hidden; $('#backupOut').value = enc(); $('#backupMsg').textContent = ''; restoreArmed = false; $('#backupLoad').textContent = 'Restore progress'; });
  $('#backupClose').addEventListener('click', () => { $('#backupPanel').hidden = true; });
  $('#backupCopy').addEventListener('click', () => {
    const t = $('#backupOut');
    const done = () => { $('#backupMsg').textContent = 'Copied. Paste it somewhere safe.'; };
    if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(done, () => { t.select(); $('#backupMsg').textContent = 'Select-all is on. Press Ctrl+C (or Copy) to copy it.'; });
    else { t.select(); $('#backupMsg').textContent = 'Select-all is on. Press Ctrl+C (or Copy) to copy it.'; }
  });
  $('#backupLoad').addEventListener('click', () => {
    let d; try { d = decode($('#backupIn').value); } catch (e) { $('#backupMsg').textContent = e.message; return; }
    if (!restoreArmed) { restoreArmed = true; $('#backupLoad').textContent = `Replace this device's progress with ${d.players.length} player${d.players.length > 1 ? 's' : ''}?`; return; }
    S.players = d.players; S.cur = d.cur || d.players[0].id; S.prog = d.prog || {}; save();
    restoreArmed = false; $('#backupLoad').textContent = 'Restore progress';
    $('#backupMsg').textContent = 'Restored. Welcome back!'; $('#backupIn').value = ''; $('#backupOut').value = enc(); refresh();
  });

  // ---------- voice and sound ----------
  let voice = null;
  function pickVoice() {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    const en = vs.filter(v => /^en/i.test(v.lang));
    const rank = v => (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/aria|jenny|samantha|google us|zira|ava/i.test(v.name) ? 2 : 0) + (/en-US/i.test(v.lang) ? 1 : 0);
    voice = en.sort((a, b) => rank(b) - rank(a))[0] || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text) {
    if (!S.voice || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\b([a-h])([1-8])\b/g, '$1 $2'));
    if (voice) u.voice = voice; u.rate = 0.95; u.pitch = 1.05; speechSynthesis.speak(u);
  }
  function setVoiceBtn() { const b = $('#voiceBtn'); b.setAttribute('aria-pressed', S.voice); b.textContent = S.voice ? 'Voice on' : 'Voice off'; }
  $('#voiceBtn').addEventListener('click', () => { S.voice = !S.voice; save(); setVoiceBtn(); if (S.voice) speak('Hi ' + playerName() + '! I will read everything out loud.'); else speechSynthesis && speechSynthesis.cancel(); });

  let actx = null;
  function tone(freqs, dur = 0.09, type = 'triangle', gap = 0.08) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * gap;
        o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
      });
    } catch (e) {}
  }
  const sfx = { move: () => tone([420], 0.06, 'square'), capture: () => tone([300, 200], 0.08, 'square', 0.05), win: () => tone([523, 659, 784, 1047], 0.18), oops: () => tone([330, 247], 0.16, 'sine', 0.12) };
  const moveSound = m => (m.captured ? sfx.capture() : sfx.move());

  // ---------- confetti ----------
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = $('#confetti'), x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
    const cols = ['#f0a202', '#23856a', '#2b6f8f', '#c9473f', '#ffffff'];
    const ps = Array.from({ length: 120 }, () => ({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - .5) * 14, vy: Math.random() * -12 - 2, r: Math.random() * 6 + 4, c: cols[Math.random() * 5 | 0], a: Math.random() * 6 }));
    let t = 0; const step = () => {
      x.clearRect(0, 0, c.width, c.height);
      ps.forEach(p => { p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.a += 0.2; x.fillStyle = p.c; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); });
      if (++t < 90) requestAnimationFrame(step); else x.clearRect(0, 0, c.width, c.height);
    }; step();
  }

  // ---------- coach bubble ----------
  function coach(el, html, kind, words) {
    el.innerHTML = `<div class="face" aria-hidden="true">&#9822;</div><div class="bubble ${kind || ''}" role="status">${html}</div>`;
    speak(words || el.querySelector('.bubble').textContent);
  }

  // ---------- routing ----------
  const views = ['books', 'book', 'train', 'play', 'lessons', 'lesson'];
  const TAB_OF = { books: 'books', book: 'books', train: 'books', play: 'play', lessons: 'lessons', lesson: 'lessons' };
  let curView = 'books';
  function show(v) {
    curView = v; views.forEach(n => { $('#v-' + n).hidden = n !== v; });
    document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === TAB_OF[v]));
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.tab;
    if (t === 'books') renderShelf(); if (t === 'lessons') renderLessons(); if (t === 'play') renderPlay();
    show(t);
  }));
  function refresh() {
    renderPlayers();
    if (curView === 'books') renderShelf(); else if (curView === 'book') renderBook(); else if (curView === 'lessons') renderLessons();
  }

  // ---------- books ----------
  const themeCache = {};
  const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const VOLS = ['Beginners', 'Advanced Beginners', 'Intermediate', 'Advanced I', 'Advanced II', 'Advanced III'];

  // Every exercise becomes an "item" the trainer understands.
  function puzzleItem(book, p, sideKey) {
    const d = p[sideKey || p.side] || p.w || p.b, other = (sideKey || p.side) === 'w' ? 'b' : 'w';
    return { id: String(p.n), title: 'Puzzle ' + p.n, type: d.mate || d.cp == null || d.cp >= 200 ? (d.mate ? 'mate' : 'play') : 'play',
      fen: d.fen, line: d.line, mate: d.mate, cp: d.cp, alt: d.alt, need: d.need, strategy: !d.mate && d.cp != null && d.cp < 200,
      swap: p[other] ? () => puzzleItem(book, p, other) : null, swapSide: other };
  }
  function itemsOf(book) {
    if (book._items) return book._items;
    if (book.kind === 'course') {
      book._items = [];
      book.sessions.forEach(s => s.items.forEach(it => { it.session = s; it.title = `Session ${s.n} · #${it.q}`; book._items.push(it); }));
    } else if (book.kind === 'items') book._items = book.items;
    else book._items = book.puzzles.map(p => puzzleItem(book, p));
    return book._items;
  }
  function themesOf(book, it) {
    const k = book.id + ':' + it.id; if (themeCache[k]) return themeCache[k];
    let t = ['material'];
    if (it.line && it.line.length) t = it.strategy ? ['strategy'] : KS.findThemes(it.preFen || it.fen, it.line, it.mate);
    return (themeCache[k] = t);
  }
  const doneCount = (book, items) => items.filter(it => prog().stars[book.id + ':' + it.id] != null).length;

  function renderShelf() {
    $('#v-books').innerHTML = `<div class="shelf">${BOOKS.map((b, i) => {
      const items = itemsOf(b), done = doneCount(b, items);
      return `<button class="book" data-i="${i}" type="button">
        <div class="cover" style="background:${b.color}"><div><h3>${esc(b.title)}</h3><div class="by">${esc(b.author)}</div></div>
          <div class="glyph" aria-hidden="true">${b.glyph}</div>
          <div class="meter" aria-hidden="true"><i style="width:${Math.round(done / items.length * 100)}%"></i></div></div>
        <div class="cap">${items.length} ${b.kind === 'puzzles' || !b.kind ? 'puzzles' : 'exercises'}<small>${done} done · ${esc(b.level)}</small></div></button>`;
    }).join('')}</div>`;
    $('#v-books').querySelectorAll('.book').forEach(el => el.addEventListener('click', () => openBook(+el.dataset.i)));
  }

  let B = { i: 0, filter: 'all', session: null };
  function openBook(i, filter) { B = { i, filter: filter || 'all', session: null }; renderBook(); show('book'); }
  function tilesHtml(book, list) {
    return `<div class="grid">${list.map(it => { const s = prog().stars[book.id + ':' + it.id]; return `<button class="tile ${s != null ? 'done' : ''}" type="button" data-id="${esc(it.id)}" aria-label="${esc(it.title)}">${esc(it.q || it.id)}<small>${s ? starStr(s) : s === 0 ? '✓' : ''}</small></button>`; }).join('')}</div>`;
  }
  function listFor(book) {
    if (book.kind === 'course') return B.session ? B.session.items : [];
    return itemsOf(book).filter(it => B.filter === 'all' || themesOf(book, it).includes(B.filter));
  }
  function renderBook() {
    const book = BOOKS[B.i];
    if (book.kind === 'course') return renderCourse(book);
    const items = itemsOf(book);
    const chips = ['all', ...Object.keys(KS.THEMES).filter(t => items.some(it => themesOf(book, it).includes(t)))];
    $('#v-book').innerHTML = `<button class="back" type="button" id="bkBack">&larr; All books</button>
      <div class="bookhead"><h2>${esc(book.title)}</h2><span class="note">${esc(book.about)}</span></div>
      <div class="filters">${chips.map(t => `<button class="chip" type="button" data-t="${t}" aria-pressed="${B.filter === t}">${t === 'all' ? 'All puzzles' : KS.THEMES[t].label}</button>`).join('')}</div>
      ${tilesHtml(book, listFor(book))}`;
    $('#bkBack').addEventListener('click', () => { renderShelf(); show('books'); });
    $('#v-book').querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { B.filter = c.dataset.t; renderBook(); }));
    bindTiles(book);
  }
  function bindTiles(book) {
    $('#v-book').querySelectorAll('.tile').forEach(t => t.addEventListener('click', () => {
      const list = listFor(book); startItem(book, list.findIndex(it => it.id === t.dataset.id), list);
    }));
  }
  function renderCourse(book) {
    if (B.session) {
      const s = B.session, items = s.items, done = doneCount(book, items);
      $('#v-book').innerHTML = `<button class="back" type="button" id="bkBack">&larr; ${esc(book.title)}</button>
        <div class="bookhead"><h2>Session ${s.n}: ${esc(s.title)}</h2><span class="note">${done} of ${items.length} done</span></div>
        ${s.intro ? `<p class="lessontext note">${esc(s.intro)}</p>` : ''}
        ${tilesHtml(book, items)}`;
      $('#bkBack').addEventListener('click', () => { B.session = null; renderBook(); });
      bindTiles(book); return;
    }
    const byVol = {};
    book.sessions.forEach(s => (byVol[s.vol] = byVol[s.vol] || []).push(s));
    $('#v-book').innerHTML = `<button class="back" type="button" id="bkBack">&larr; All books</button>
      <div class="bookhead"><h2>${esc(book.title)}</h2><span class="note">${esc(book.about)}</span></div>
      ${Object.keys(byVol).map(v => `<h3 class="volhead">Book ${v}: ${VOLS[v - 1] || ''}${book.startVol == v ? ' <span class="tag">Start here</span>' : ''}</h3>
        <div class="sessions">${byVol[v].map(s => { const d = doneCount(book, s.items); return `<button class="session ${d === s.items.length ? 'done' : ''}" type="button" data-n="${s.n}">
          <span class="num">${s.n}</span><span><strong>${esc(s.title)}</strong><br><span class="note">${d} of ${s.items.length} done</span></span></button>`; }).join('')}</div>`).join('')}`;
    $('#bkBack').addEventListener('click', () => { renderShelf(); show('books'); });
    $('#v-book').querySelectorAll('.session').forEach(b => b.addEventListener('click', () => { B.session = book.sessions.find(s => s.n === +b.dataset.n); renderBook(); }));
  }

  // ---------- exercise trainer ----------
  let T = null, tBoard = null;
  const TAP_TYPES = { squares: 1, captures: 1, tappiece: 1, quest: 1 };
  function trainShell() {
    $('#v-train').innerHTML = `<button class="back" type="button" id="trBack">&larr; Back</button>
      <div class="bench"><div class="boardbox"><div id="trBoard"></div></div>
      <div class="panel">
        <div class="ptitle"><h2 id="trTitle"></h2><span class="turn" id="trTurn"><i></i><span></span></span></div>
        <div class="coach" id="trCoach"></div>
        <div class="btns" id="trAnswer"></div>
        <div class="btns"><button class="btn" id="trHint" type="button">Hint</button><button class="btn" id="trRetry" type="button">Start over</button><button class="btn" id="trShow" type="button">Show me</button></div>
        <div class="btns"><button class="btn" id="trPrev" type="button">&larr; Previous</button><button class="btn primary" id="trNext" type="button">Next &rarr;</button></div>
        <p class="note" id="trSide"></p>
      </div></div>`;
    tBoard = new Board($('#trBoard'), {
      onMove: trainMove, canMove: () => T && !T.busy && !T.over && !TAP_TYPES[T.it.type],
      tapMode: () => T && TAP_TYPES[T.it.type], onTap: trainTap,
    });
    $('#trBack').addEventListener('click', () => { renderBook(); show('book'); });
    $('#trHint').addEventListener('click', trainHint);
    $('#trRetry').addEventListener('click', () => startItem(T.book, T.idx, T.list, T.it));
    $('#trShow').addEventListener('click', trainShow);
    $('#trNext').addEventListener('click', () => stepItem(1));
    $('#trPrev').addEventListener('click', () => stepItem(-1));
  }
  function stepItem(d) { const n = T.list.length; startItem(T.book, (T.idx + d + n) % n, T.list); }
  const keyOf = () => T.book.id + ':' + T.it.id;

  function startItem(book, idx, list, override) {
    if (!tBoard) trainShell();
    const it = override || list[idx];
    if (it.type === 'training') { playFrom(it); return; }
    const g = new Chess(); const ok = g.load(it.fen);
    if (!ok) { // positions without both kings: chess.js still holds the pieces via put()
      g.clear(); const [board, side] = it.fen.split(' ');
      board.split('/').forEach((row, r) => { let f = 0; for (const c of row) { if (/\d/.test(c)) f += +c; else { g.put({ type: c.toLowerCase(), color: c === c.toUpperCase() ? 'w' : 'b' }, 'abcdefgh'[f] + (8 - r)); f++; } } });
      if (side === 'b' && g.turn() === 'w') { const f2 = g.fen().split(' '); f2[1] = 'b'; g.load(f2.join(' ')); }
    }
    T = { book, idx, list, it, g, ply: 0, hints: 0, misses: 0, over: false, busy: false, shown: false, picks: new Set(), line: it.line ? it.line.slice() : [], moves: 0 };
    T.themes = it.type === 'mate' || it.type === 'play' || it.type === 'pitfall' ? themesOf(book, it) : ['material'];
    const me = (it.fen.split(' ')[1]) || 'w';
    T.me = me;
    tBoard.flipped = me === 'b' && !TAP_TYPES[it.type]; tBoard.last = null; tBoard.rings = {}; tBoard.arrows = []; tBoard.setGame(g);
    $('#trTitle').textContent = it.title;
    $('#trTurn').className = 'turn ' + me; $('#trTurn span').textContent = KS.COLOR[me] + ' to move';
    $('#trTurn').hidden = !!TAP_TYPES[it.type] || it.type === 'choice';
    $('#trBack').innerHTML = '&larr; ' + esc(book.kind === 'course' && it.session ? 'Session ' + it.session.n : 'Back to the book');
    $('#trAnswer').innerHTML = '';
    $('#trHint').disabled = $('#trShow').disabled = false;
    $('#trSide').innerHTML = it.swap ? `The book didn't say whose turn it is. <button class="back" type="button" id="trSwap">Try it with ${KS.COLOR[it.swapSide]} to move instead</button>` : (it.page ? `Book page ${it.page}` : '');
    const sw = $('#trSwap'); if (sw) sw.addEventListener('click', () => startItem(book, idx, list, it.swap()));
    (it.rings || []).forEach(s => { tBoard.rings[s] = "hint"; }); tBoard.render();
    introFor(it, me);
    show('train');
    if (it.type === 'pitfall' && it.pre) playPitfall();
  }

  function introFor(it, me) {
    const C = KS.COLOR[me], p = it.prompt ? `<p class="note">Book: “${esc(it.prompt)}”</p>` : '';
    let h;
    switch (it.type) {
      case 'squares': h = it.ask ? `<p>${esc(it.ask)} Then press <b>Check</b>.</p>` : `<p>Tap <b>every square</b> the ${esc(it.pieceName || 'piece')} on ${it.piece} can move to. Then press <b>Check</b>.</p>`; break;
      case 'captures': h = it.ask ? `<p>${esc(it.ask)} Then press <b>Check</b>.</p>` : `<p>Tap <b>every piece</b> the ${esc(it.pieceName || 'piece')}${it.piece ? ' on ' + it.piece : 's'} can capture. Then press <b>Check</b>.</p>`; break;
      case 'tappiece': h = `<p>${esc(it.ask || 'Tap the piece that is in the wrong place.')}</p>`; break;
      case 'quest': h = `<p>Move your ${esc(it.pieceName || 'piece')} to capture ${it.all ? '<b>all</b> the enemy pieces' : 'the ' + esc(it.targetName || 'enemy piece')} in <b>${it.limit} moves</b>. The other side doesn't move.</p>`; break;
      case 'escape': h = `<p>${C}'s King is in check. Get out of check by <b>${{ move: 'moving the King', block: 'blocking the check', capture: 'capturing the attacker' }[it.method]}</b>.</p>`; break;
      case 'choice': h = `<p>${esc(it.ask)}</p>`; break;
      case 'check': h = `<p>${C} to move. Find a move with your <b>${esc(it.pieceName || 'pieces')}</b> that gives <b>check</b>.</p>`; break;
      case 'checkq': h = `<p>Look at the King. Is it in <b>check</b>, or is it <b>checkmate</b>?</p>`; break;
      case 'playout': h = `<p>${C} to move. ${it.goal === 'win' ? '<b>Win this position</b>: make a new Queen or checkmate.' : it.goal === 'draw' ? '<b>Save the game</b>: hold the draw for 15 moves.' : '<b>Checkmate the King.</b> The Coach will defend as well as it can.'}</p>`; break;
      case 'pitfall': h = it.pre ? `<p>Watch this move. It looks fine, but it's a trap! Then find how to <b>punish it</b>.</p>`
        : `<p>${it.opening ? esc(it.opening) + ': ' : ''}the other side just played <b>${esc(it.trapShown || 'a natural-looking move')}</b>. It's a mistake! You are ${C}: <b>find the punishment</b>.</p>`; break;
      default:
        if (it.intro) { h = `<p>${esc(it.intro)}</p><p>${C} to move.</p>`; break; }
        h = `<p>${C} to move. ${it.mate ? (it.mate === 1 ? 'Find <b>checkmate in one</b> move!' : `Find <b>checkmate in ${it.mate}</b> moves!`)
          : it.goal === 'draw' ? 'Find the move that <b>saves the game</b> (a draw).'
          : it.strategy ? 'Find the <b>best move</b>. This one is about a good plan.' : 'Find the move that <b>wins</b>.'}</p>`;
    }
    coach($('#trCoach'), h + p);
    if (it.type === 'choice') $('#trAnswer').innerHTML = (it.options || ['Yes', 'No']).map(o => `<button class="btn" type="button" data-a="${o.toLowerCase()}">${esc(o)}</button>`).join('');
    if (it.type === 'checkq') $('#trAnswer').innerHTML = '<button class="btn" type="button" data-a="check">Check</button><button class="btn" type="button" data-a="mate">Checkmate</button>';
    if (it.type === 'squares' || it.type === 'captures') $('#trAnswer').innerHTML = '<button class="btn go" type="button" id="trCheck">Check</button>';
    $('#trAnswer').querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => answerChoice(b.dataset.a)));
    const ck = $('#trCheck'); if (ck) ck.addEventListener('click', checkPicks);
  }

  // --- tap exercises ---
  function trainTap(s) {
    if (!T || T.over || T.busy) return;
    const it = T.it;
    if (it.type === 'tappiece') {
      if (it.targets.includes(s)) { tBoard.rings = { [s]: 'ok' }; tBoard.render(); return solved(); }
      T.misses++; sfx.oops(); tBoard.rings = { [s]: 'wrong' }; tBoard.render();
      coach($('#trCoach'), '<p><b>Not that one.</b> Compare each piece with where it starts the game.</p>', 'bad'); return;
    }
    if (it.type === 'quest') return questTap(s);
    if (T.picks.has(s)) T.picks.delete(s); else T.picks.add(s);
    tBoard.rings = {}; T.picks.forEach(p => { tBoard.rings[p] = 'pick'; }); tBoard.render();
  }
  function checkPicks() {
    if (!T || T.over) return;
    const want = new Set(T.it.targets), picks = T.picks;
    const wrong = [...picks].filter(s => !want.has(s)), missing = [...want].filter(s => !picks.has(s));
    tBoard.rings = {};
    [...picks].forEach(s => { tBoard.rings[s] = want.has(s) ? 'ok' : 'wrong'; });
    if (!wrong.length && !missing.length) { tBoard.render(); return solved(); }
    T.misses++; sfx.oops();
    if (T.misses >= 2) missing.forEach(s => { tBoard.rings[s] = 'miss'; });
    tBoard.render();
    coach($('#trCoach'), `<p><b>Almost!</b> ${wrong.length ? `${wrong.length} of your picks ${wrong.length > 1 ? 'are' : 'is'} wrong (red). ` : ''}${missing.length ? `You missed ${missing.length}.` : ''}</p>
      <p class="note">${T.misses >= 2 ? 'The question marks show the ones you missed. Tap them, then press Check.' : 'Fix your answer and press Check again.'}</p>`, 'bad');
    wrong.forEach(s => picks.delete(s));
  }
  function answerChoice(a) {
    if (!T || T.over) return;
    if (a === T.it.answer) return solved();
    T.misses++; sfx.oops();
    coach($('#trCoach'), `<p><b>Look again.</b> ${T.it.type === 'checkq' ? 'Can the King move, block, or capture its way out?' : 'Trace how the piece moves, one square at a time.'}</p>`, 'bad');
  }
  // move a piece N times with the other side passing
  function questTap(s) {
    const it = T.it, g = T.g;
    if (!T.qsel) { const p = g.get(s); if (p && p.color === T.me) { T.qsel = s; tBoard.rings = { [s]: 'pick' }; KS.pieceTargets(g, s).forEach(t => { tBoard.rings[t] = tBoard.rings[t] || 'hint'; }); tBoard.render(); } return; }
    const from = T.qsel; T.qsel = null;
    if (s === from || !KS.pieceTargets(g, from).includes(s)) { tBoard.rings = {}; tBoard.render(); return; }
    const p = g.get(from), cap = g.get(s);
    g.remove(from); g.put(p, s); T.moves++;
    (cap ? sfx.capture : sfx.move)(); tBoard.last = { from, to: s }; tBoard.rings = {}; tBoard.render();
    if (cap && cap.color !== T.me && (!it.all || !KS.pieces(g, T.me === 'w' ? 'b' : 'w').some(q => q.type !== 'k'))) return solved();
    if (T.moves >= it.limit) {
      T.misses++; sfx.oops(); T.busy = true;
      coach($('#trCoach'), `<p><b>Out of moves.</b> Plan the whole path before you start. Try again!</p>`, 'bad');
      setTimeout(() => startItem(T.book, T.idx, T.list, T.it), 1600);
    } else coach($('#trCoach'), `<p>Good. ${it.limit - T.moves} move${it.limit - T.moves > 1 ? 's' : ''} left.</p>`);
  }

  // --- move exercises ---
  const sameMove = (m, san) => san && strip(m.san) === strip(san);
  const uciToMove = (fen, u) => u && new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  function pvToSan(fen, pv) { const g = new Chess(fen), out = []; for (const u of pv || []) { const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); if (!m) break; out.push(m.san); } return out; }

  async function playPitfall() {
    T.busy = true; await sleep(900);
    const m = T.g.move(T.it.pre); if (m) { moveSound(m); tBoard.last = m; }
    T.me = T.g.turn(); tBoard.flipped = T.me === 'b'; tBoard.render();
    $('#trTurn').className = 'turn ' + T.me; $('#trTurn span').textContent = KS.COLOR[T.me] + ' to move';
    T.busy = false;
    coach($('#trCoach'), `<p>${KS.COLOR[m.color]} played <b>${esc(m.san)}</b>. Why is that a mistake? You are ${KS.COLOR[T.me]}: <b>find the punishment!</b></p>`);
  }

  async function trainMove(from, to, promo) {
    if (!T || T.busy || T.over) return false;
    const it = T.it, exp = T.line[T.ply], fenBefore = T.g.fen();
    const expMove = exp && new Chess(fenBefore).move(exp);
    if (expMove && expMove.from === from && expMove.to === to && expMove.promotion) promo = expMove.promotion;
    const m = T.g.move({ from, to, promotion: promo }); if (!m) return false;
    moveSound(m); tBoard.last = m; tBoard.rings = {}; tBoard.arrows = []; tBoard.render();

    if (it.type === 'check') {
      if (m.san.includes('+') || m.san.includes('#')) { if (!it.pieceType || m.piece === it.pieceType) return solved(m); }
      return wrongMove(m, it.pieceType && m.piece !== it.pieceType ? `That's your ${KS.NAME[m.piece]}. The book asks for a check with your ${KS.NAME[it.pieceType]}.` : 'That move doesn\'t attack the King.');
    }
    if (it.type === 'escape') {
      const ok = it.method === 'move' ? m.piece === 'k' : it.method === 'capture' ? !!m.captured : (m.piece !== 'k' && !m.captured);
      if (ok) return solved(m);
      return wrongMove(m, `That gets out of check, but the book asks you to ${it.method === 'move' ? 'move the King' : it.method === 'capture' ? 'capture the piece giving check' : 'put a piece in the way'}.`);
    }
    if (it.type === 'playout') return playoutMove(m);

    const isMate = T.g.in_checkmate();
    let good = sameMove(m, exp) || isMate || (T.ply === 0 && (it.alt || []).some(a => sameMove(m, a)));
    if (!good && KS.Stockfish.ok && T.ply % 2 === 0) good = await engineAccepts(fenBefore, m);
    if (!good) return wrongMove(m);

    T.ply++;
    if (isMate || T.ply >= (it.need || 1)) return solved(m);
    T.busy = true;
    coach($('#trCoach'), `<p><b>Yes!</b> ${esc(KS.sayMove(m))}. Now watch what ${KS.COLOR[T.g.turn()]} does...</p>`, 'good');
    await sleep(900);
    let r = T.line[T.ply] && T.g.move(T.line[T.ply]);
    if (!r && KS.Stockfish.ok) { const a = await KS.Stockfish.analyse(T.g.fen(), { movetime: 400 }); const u = a.lines[0] && a.lines[0].pv[0]; r = u && T.g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); }
    T.ply++; T.busy = false;
    if (!r) return solved(m);
    moveSound(r); tBoard.last = r; tBoard.render();
    coach($('#trCoach'), `<p>${KS.COLOR[r.color]} played ${esc(KS.sayMove(r))}${/[!.]$/.test(KS.sayMove(r)) ? '' : '.'}</p><p><b>Keep going!</b> What is your next move?</p>`);
    return true;
  }
  // A different move is fine if the engine says it is just as good. Then the line continues from the engine's view.
  async function engineAccepts(fenBefore, m) {
    const it = T.it;
    const a = await KS.Stockfish.analyse(T.g.fen(), { movetime: 500 }); const l = a.lines[0]; if (!l) return false;
    const mine = l.type === 'mate' ? (l.v < 0 ? 100000 + l.v : -100000 + l.v) : -l.v; // from the solver's view
    const left = Math.max(1, (it.mate || 0) - T.ply / 2);
    let ok;
    if (it.mate) ok = l.type === 'mate' && l.v < 0 && -l.v <= left - 1 + 1 && -l.v < left;
    else if (it.goal === 'draw') ok = mine > Math.min(-80, (it.cp == null ? 0 : it.cp) - 80);
    else if (T.ply === 0 && it.cp != null) ok = mine >= it.cp - 60 && (it.strategy || mine >= 150);
    else ok = mine >= 200;
    if (ok) T.line = T.line.slice(0, T.ply).concat([m.san], pvToSan(T.g.fen(), l.pv));
    return ok;
  }
  async function wrongMove(m, msg) {
    T.misses++; T.busy = true; sfx.oops();
    let why = msg || '';
    if (!why && KS.Stockfish.ok) {
      const res = await KS.Stockfish.analyse(T.g.fen(), { movetime: 350 });
      const reply = uciToMove(T.g.fen(), res.lines[0] && res.lines[0].pv[0]);
      if (reply) { why = `If you play that, ${KS.COLOR[reply.color]} can answer ${KS.sayMove(reply)}`; tBoard.arrows = [{ from: reply.from, to: reply.to, kind: 'bad' }]; tBoard.render(); }
    } else if (!why) { const hang = KS.looseOrHanging(T.g, m.color).find(p => p.sq === m.to); if (hang) why = `Your ${KS.NAME[m.piece]} could be captured on ${m.to}`; }
    const tip = T.misses >= 2 && T.themes ? `<p class="note">Hint: ${esc(KS.THEMES[T.themes[0]].tip)}</p>` : '';
    coach($('#trCoach'), `<p><b>Not quite.</b> ${why ? esc(why) + (/[!.]$/.test(why) ? '' : '.') : 'That move doesn\'t do enough.'} Try again!</p>${tip}`, 'bad');
    await sleep(why ? 1900 : 1100);
    T.g.undo(); tBoard.last = null; tBoard.arrows = []; tBoard.render(); T.busy = false;
    return false;
  }
  async function playoutMove(m) {
    const g = T.g, goal = T.it.goal || 'mate', me = T.me;
    if (T.startMat == null) T.startMat = KS.material(new Chess(T.it.fen), me);
    if (g.in_checkmate()) return solved(m);
    if (g.game_over()) {
      if (goal === 'draw') return solved(m);
      T.misses++; sfx.oops(); T.over = true;
      coach($('#trCoach'), `<p><b>${g.in_stalemate() ? 'Stalemate!' : 'Draw.'}</b> ${g.in_stalemate() ? 'The King has no moves but is not in check, so it\'s a draw. Always leave the King a square until the final blow.' : ''} Press Start over to try again.</p>`, 'bad'); return true;
    }
    T.busy = true; await sleep(450);
    let r = null;
    if (KS.Stockfish.ok) { const a = await KS.Stockfish.analyse(g.fen(), { movetime: 300 }); r = uciToMove(g.fen(), a.best || (a.lines[0] && a.lines[0].pv[0])); }
    if (!r) r = KS.Mini.pick(g.fen(), 2, 0);
    const rr = r && g.move({ from: r.from, to: r.to, promotion: r.promotion });
    T.busy = false; T.moves++;
    if (rr) { moveSound(rr); tBoard.last = rr; tBoard.render(); }
    const gain = KS.material(g, me) - T.startMat;
    if (g.in_checkmate()) { T.over = true; sfx.oops(); coach($('#trCoach'), '<p><b>Checkmate against you.</b> Press Start over and try a different plan.</p>', 'bad'); return true; }
    if (g.game_over()) {
      if (goal === 'draw') return solved(m);
      T.over = true; coach($('#trCoach'), '<p>The defender escaped with a draw. Press Start over and try again.</p>', 'bad'); return true;
    }
    if (goal === 'win' && gain >= 5) return solved(m);
    if (goal === 'draw' && T.moves >= 15 && gain > -3) return solved(m);
    if (goal === 'draw' && gain <= -5) { T.over = true; sfx.oops(); coach($('#trCoach'), '<p>The other side is winning now. Press Start over and look for the drawing idea.</p>', 'bad'); return true; }
    const tip = goal === 'win' ? 'Keep going until you make a new Queen!' : goal === 'draw' ? `Hold on! ${15 - T.moves} more moves to save the game.` : T.moves > 25 ? 'Push the King toward the edge, step by step.' : 'Keep squeezing the King!';
    coach($('#trCoach'), `<p>${KS.COLOR[rr.color]} played ${esc(KS.sayMove(rr))}${/[!.]$/.test(KS.sayMove(rr)) ? '' : '.'} ${tip}</p>`);
    return true;
  }

  function solved(m) {
    T.over = true;
    const used = T.hints + T.misses;
    const stars = T.shown ? 0 : used === 0 ? 3 : used <= 2 ? 2 : 1;
    const key = keyOf(), prev = prog().stars[key];
    prog().stars[key] = Math.max(prev == null ? 0 : prev, stars); save(); renderPlayers();
    const it = T.it, praise = stars === 3 ? `Amazing, ${esc(playerName())}! First try!` : stars ? 'You got it!' : 'Now you know this one.';
    let body = '';
    if (it.line && it.line.length && !TAP_TYPES[it.type] && it.type !== 'check' && it.type !== 'playout') {
      const th = KS.THEMES[T.themes[0]] || KS.THEMES.material;
      const startFen = it.type === 'pitfall' && it.pre ? (() => { const g = new Chess(it.fen); g.move(it.pre); return g.fen(); })() : it.fen;
      const words = KS.explainLine(startFen, T.line, Math.max(it.need || 1, Math.min(T.line.length, (it.need || 1) + 1)));
      body = `<p><span class="tag">${th.label}</span></p><p>${words.map(esc).join(' ')}</p>`;
      const lesson = LESSON_FOR[T.themes[0]];
      if (lesson) body += `<p><button class="back" type="button" id="trLesson">Learn more: ${esc(lesson.title)} &rarr;</button></p>`;
      T._lesson = lesson;
    } else if (it.type === 'squares' || it.type === 'captures') body = `<p>${it.targets.length ? `That's all ${it.targets.length}.` : 'There were none!'}</p>`;
    else if (it.type === 'check' && m) body = `<p>${esc(KS.sayMove(m))} — that's check.</p>`;
    else if (it.type === 'playout') body = it.goal === 'win' ? '<p>You turned the advantage into a win!</p>' : it.goal === 'draw' ? '<p>You held the draw. That takes real defense!</p>' : `<p>Checkmate in ${T.moves + 1} moves. Practice it until you can do it fast!</p>`;
    else if (it.type === 'choice' && it.why) body = `<p>${esc(it.why)}</p>`;
    if (it.lesson && it.type !== 'choice') body += `<p class="note">${esc(it.lesson)}</p>`;
    coach($('#trCoach'), `<p><b>${praise}</b> ${stars ? '<span style="color:var(--accent)">' + starStr(stars) + '</span>' : ''}</p>${body}`, stars ? 'good' : '', praise.replace(/<[^>]+>/g, '') + ' ' + $('#trCoach').textContent);
    const lb = $('#trLesson'); if (lb) lb.addEventListener('click', () => openLesson(LESSONS.indexOf(T._lesson)));
    $('#trHint').disabled = $('#trShow').disabled = true;
    if (stars) { sfx.win(); confetti(); }
    return true;
  }

  function trainHint() {
    if (!T || T.over || T.busy) return;
    const it = T.it; T.hints++;
    if (it.type === 'squares' || it.type === 'captures') {
      const miss = it.targets.filter(s => !T.picks.has(s));
      coach($('#trCoach'), `<p><b>Hint:</b> ${it.type === 'captures' ? `There ${it.targets.length === 1 ? 'is 1 piece' : 'are ' + it.targets.length + ' pieces'} to find.` : `There are ${it.targets.length} squares in all.`}${miss[0] ? ` One of them is ${miss[0]}.` : ''}</p>`); return;
    }
    if (it.type === 'tappiece') { coach($('#trCoach'), `<p><b>Hint:</b> Look at the ${it.targets[0][1] <= '2' ? 'White' : 'Black'} pieces.</p>`); return; }
    if (it.type === 'choice' || it.type === 'checkq' || it.type === 'quest') { coach($('#trCoach'), `<p><b>Hint:</b> ${it.type === 'checkq' ? 'Check every square around the King. Is any of them safe?' : 'Count the squares one at a time along the piece\'s path.'}</p>`); return; }
    if (it.type === 'check' || it.type === 'escape') {
      const g = new Chess(T.g.fen()); const m = g.moves({ verbose: true }).find(x => it.type === 'escape'
        ? (it.method === 'move' ? x.piece === 'k' : it.method === 'capture' ? !!x.captured : x.piece !== 'k' && !x.captured)
        : /[+#]/.test(x.san) && (!it.pieceType || x.piece === it.pieceType));
      if (m) { tBoard.rings = { [m.from]: 'hint' }; tBoard.render(); coach($('#trCoach'), `<p><b>Hint:</b> Try the ${KS.NAME[m.piece]} on ${m.from}.</p>`); } return;
    }
    const ask = async () => {
      let u = T.line[T.ply];
      let m = u && new Chess(T.g.fen()).move(u);
      if (!m && KS.Stockfish.ok) { const a = await KS.Stockfish.analyse(T.g.fen(), { movetime: 400 }); m = uciToMove(T.g.fen(), a.lines[0] && a.lines[0].pv[0]); }
      if (!m) return;
      if (T.hints === 1 && T.themes && it.type !== 'playout') coach($('#trCoach'), `<p><b>Hint:</b> ${esc(KS.THEMES[T.themes[0]].tip)}</p>`);
      else if (T.hints <= 2) { tBoard.rings = { [m.from]: 'hint' }; tBoard.render(); coach($('#trCoach'), `<p><b>Hint:</b> Move your ${KS.NAME[m.piece]} on ${m.from}.</p>`); }
      else { tBoard.arrows = [{ from: m.from, to: m.to }]; tBoard.render(); coach($('#trCoach'), `<p><b>Here it is:</b> ${esc(KS.sayMove(m))}. You make the move!</p>`); }
    };
    ask();
  }
  async function trainShow() {
    if (!T || T.over || T.busy) return;
    const it = T.it; T.shown = true;
    if (it.targets) { tBoard.rings = {}; it.targets.forEach(s => { tBoard.rings[s] = 'ok'; }); tBoard.render(); return solved(); }
    if (it.type === 'choice' || it.type === 'checkq') { coach($('#trCoach'), `<p>The answer is <b>${esc(it.answer === 'mate' ? 'checkmate' : it.answer)}</b>.</p>`); T.over = true; return; }
    if (it.type === 'check' || it.type === 'escape' || it.type === 'playout' || it.type === 'quest') { T.hints = 9; trainHint(); return; }
    T.busy = true;
    while (T.ply < (it.need || 1) && T.line[T.ply]) {
      const m = T.g.move(T.line[T.ply]); if (!m) break; T.ply++;
      moveSound(m); tBoard.last = m; tBoard.arrows = []; tBoard.render();
      await sleep(1000);
    }
    T.busy = false; solved();
  }

  // ---------- play the Coach ----------
  const LEVELS = [
    { name: 'Pawn', glyph: '♟', mini: { depth: 1, noise: 220 }, note: 'Makes lots of mistakes' },
    { name: 'Knight', glyph: '♞', mini: { depth: 2, noise: 90 }, note: 'Sees one move ahead' },
    { name: 'Bishop', glyph: '♝', sf: { skill: 0, movetime: 120 }, mini: { depth: 2, noise: 30 }, note: 'Beginner club player' },
    { name: 'Rook', glyph: '♜', sf: { skill: 4, movetime: 250 }, mini: { depth: 3, noise: 20 }, note: 'Club player' },
    { name: 'Queen', glyph: '♛', sf: { skill: 10, movetime: 400 }, mini: { depth: 3, noise: 0 }, note: 'Strong player' },
    { name: 'King', glyph: '♚', sf: { skill: 20, movetime: 900 }, mini: { depth: 3, noise: 0 }, note: 'Full strength' },
  ];
  let P = { level: 1, color: 'w', coach: true, danger: true, g: null, me: 'w', live: false };
  let pBoard = null;
  function renderPlay() {
    if (pBoard) return;
    $('#v-play').innerHTML = `<div class="bench"><div class="boardbox"><div id="plBoard"></div></div>
      <div class="panel" id="plPanel"></div></div>`;
    pBoard = new Board($('#plBoard'), { onMove: playMove, canMove: () => P.live && !P.busy && P.g.turn() === P.me });
    P.g = new Chess(); pBoard.setGame(P.g); playSetup();
  }
  function playSetup() {
    P.live = false;
    $('#plPanel').innerHTML = `<div class="setup">
      <h3>Play a game against the Coach</h3>
      <div><div class="note">How strong should the Coach play?</div>
        <div class="levels">${LEVELS.map((l, i) => `<button class="lvl" type="button" data-l="${i}" aria-pressed="${P.level === i}" title="${l.note}"><b aria-hidden="true">${l.glyph}</b><span>${l.name}</span></button>`).join('')}</div>
        <div class="note" id="lvlNote">${LEVELS[P.level].note}</div></div>
      <div><div class="note">You play</div><div class="seg">${[['w', 'White'], ['b', 'Black'], ['r', 'Surprise me']].map(([v, t]) => `<button class="chip" type="button" data-c="${v}" aria-pressed="${P.color === v}">${t}</button>`).join('')}</div></div>
      <label class="toggle"><input type="checkbox" id="optCoach" ${P.coach ? 'checked' : ''}> Coach warns me before a big mistake</label>
      <label class="toggle"><input type="checkbox" id="optDanger" ${P.danger ? 'checked' : ''}> Show my pieces that are in danger</label>
      <button class="btn go" type="button" id="plStart">Start the game</button></div>`;
    $('#plPanel').querySelectorAll('.lvl').forEach(b => b.addEventListener('click', () => { P.level = +b.dataset.l; playSetup(); }));
    $('#plPanel').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { P.color = b.dataset.c; playSetup(); }));
    $('#optCoach').addEventListener('change', e => { P.coach = e.target.checked; });
    $('#optDanger').addEventListener('change', e => { P.danger = e.target.checked; });
    $('#plStart').addEventListener('click', startGame);
  }
  // Training games from a book start from the book's position.
  function playFrom(it) {
    renderPlay(); P.startFen = it.fen; P.startLabel = it.opening || it.title; P.color = it.fen.split(" ")[1];
    show("play"); startGame();
  }
  function startGame() {
    P.me = P.color === "r" ? (Math.random() < .5 ? "w" : "b") : P.color;
    P.g = P.startFen ? new Chess(P.startFen) : new Chess(); P.live = true; P.busy = false; P.tips = {}; P.before = null; P.best = null; P.hintStep = 0;
    pBoard.flipped = P.me === 'b'; pBoard.last = null; pBoard.arrows = []; pBoard.rings = {}; pBoard.setGame(P.g);
    const L = LEVELS[P.level];
    $('#plPanel').innerHTML = `<div class="ptitle"><h2>You vs Coach ${L.name}</h2><span class="turn" id="plTurn"><i></i><span></span></span></div>
      <div class="coach" id="plCoach"></div>
      <div class="btns"><button class="btn" id="plHint" type="button">Hint</button><button class="btn" id="plUndo" type="button">Take back</button><button class="btn" id="plNew" type="button">New game</button></div>
      <div class="moves" id="plMoves"></div>
      <p class="note">${KS.Stockfish.ok ? 'The Coach is using a full chess engine.' : 'The Coach is using its built-in brain.'}</p>`;
    $('#plHint').addEventListener('click', playHint);
    $('#plUndo').addEventListener('click', takeBack);
    $('#plNew').addEventListener('click', () => { P.live = false; P.startFen = null; playSetup(); });
    coach($('#plCoach'), `<p>Good luck, ${esc(playerName())}! You are <b>${KS.COLOR[P.me]}</b>.</p>${P.startFen ? `<p>Starting from the book position: <b>${esc(P.startLabel || "")}</b></p>` : ""}<p class="note">Remember: center pawns, bring out your Knights and Bishops, and castle.</p>`);
    afterMove();
  }
  const plCoach = (h, k, w) => coach($('#plCoach'), h, k, w);
  function setTurn() { const t = P.g.turn(); $('#plTurn').className = 'turn ' + t; $('#plTurn span').textContent = t === P.me ? 'Your move' : 'Coach is thinking'; }
  function renderMoves() {
    const h = P.g.history(); let s = '';
    for (let i = 0; i < h.length; i += 2) s += `<b>${i / 2 + 1}.</b> ${esc(h[i])} ${h[i + 1] ? esc(h[i + 1]) : ''}&nbsp; `;
    $('#plMoves').innerHTML = s; $('#plMoves').scrollTop = 1e6;
  }
  function dangerRings() {
    pBoard.rings = {};
    if (P.danger && P.g.turn() === P.me) KS.looseOrHanging(P.g, P.me).forEach(p => { pBoard.rings[p.sq] = 'danger'; });
  }
  // score from the side-to-move's view, plus best move
  async function evaluate(fen, ms = 300) {
    if (KS.Stockfish.ok) {
      const r = await KS.Stockfish.analyse(fen, { movetime: ms });
      const l = r.lines[0]; if (!l) return null;
      const v = l.type === 'mate' ? (l.v > 0 ? 3000 - l.v : -3000 - l.v) : l.v;
      return { v, best: l.pv[0], mateIn: l.type === 'mate' ? l.v : null };
    }
    await sleep(10);
    const r = KS.Mini.rank(fen, 2); if (!r.length) return null;
    return { v: Math.max(-3000, Math.min(3000, r[0].v)), best: r[0].move.from + r[0].move.to + (r[0].move.promotion || '') };
  }
  const uciMove = (fen, u) => u && new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

  function gameOver() {
    const g = P.g; if (!g.game_over()) return false;
    P.live = false;
    if (g.in_checkmate()) {
      if (g.turn() !== P.me) { sfx.win(); confetti(); plCoach(`<p><b>Checkmate! You won, ${esc(playerName())}!</b></p><p>Great game. Try the next level when you are ready.</p>`, 'good'); }
      else plCoach(`<p><b>Checkmate.</b> The Coach won this time.</p><p>Every game teaches you something. Press Take back to see what happened, or start a new game.</p>`);
    } else plCoach(`<p><b>It's a draw.</b> ${g.in_stalemate() ? 'Stalemate: the King is not in check but has no moves.' : g.insufficient_material() ? 'Nobody has enough pieces left to checkmate.' : 'The same position happened three times.'}</p>`);
    $('#plTurn span').textContent = 'Game over';
    return true;
  }

  async function afterMove() {
    renderMoves(); dangerRings(); pBoard.render();
    if (gameOver()) return;
    setTurn();
    if (P.g.turn() === P.me) {
      P.hintStep = 0; P.best = null; P.before = null;
      const fen = P.g.fen(); const e = await evaluate(fen, 300);
      if (P.g.fen() === fen && e) { P.before = e.v; P.best = e.best; }
    } else computerMove();
  }

  async function computerMove() {
    P.busy = true; const fen = P.g.fen(), L = LEVELS[P.level]; const t0 = Date.now();
    let mv = null;
    if (L.sf && KS.Stockfish.ok) {
      const r = await KS.Stockfish.analyse(fen, { movetime: L.sf.movetime, skill: L.sf.skill });
      mv = uciMove(fen, r.best || (r.lines[0] && r.lines[0].pv[0]));
    }
    if (!mv) { await sleep(20); const m = KS.Mini.pick(fen, L.mini.depth, L.mini.noise); mv = m && { from: m.from, to: m.to, promotion: m.promotion }; }
    await sleep(Math.max(0, 550 - (Date.now() - t0)));
    if (!P.live || P.g.fen() !== fen) { P.busy = false; return; }
    const m = P.g.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    moveSound(m); pBoard.last = m; pBoard.arrows = []; P.busy = false;
    afterMove();
  }

  function openingTip(m, n) {
    const t = P.tips;
    if (m.san.startsWith('O-O') && !t.castle) { t.castle = 1; return 'Castling! Your King is safer now, and your Rook can join the game.'; }
    if (n <= 4 && m.piece === 'q' && !t.queen) { t.queen = 1; return 'Careful bringing your Queen out early. Enemy pieces can chase it around.'; }
    if (n <= 8 && m.piece === 'n' && /^[ah]/.test(m.to) && !t.rim) { t.rim = 1; return 'A Knight on the edge can\'t reach many squares. Knights love the center!'; }
    if (n <= 2 && m.piece === 'p' && /^[de][45]$/.test(m.to) && !t.center) { t.center = 1; return 'Nice! A center pawn helps your pieces come out.'; }
    if (n <= 6 && /[nb]/.test(m.piece) && !m.captured && !t.dev) { t.dev = 1; return 'Good, you are bringing out your pieces.'; }
    const k = KS.pieces(P.g, P.me).find(p => p.type === 'k');
    if (n >= 10 && k && /^[de]/.test(k.sq) && !t.lateCastle && P.g.history({ verbose: true }).every(h => h.color !== P.me || !h.san.startsWith('O-O'))) { t.lateCastle = 1; return 'Try to castle soon, so your King is safe.'; }
    return null;
  }

  async function playMove(from, to, promo) {
    if (!P.live || P.busy || P.g.turn() !== P.me) return false;
    const fenBefore = P.g.fen(), before = P.before, best = P.best;
    const m = P.g.move({ from, to, promotion: promo }); if (!m) return false;
    moveSound(m); pBoard.last = m; pBoard.arrows = []; pBoard.rings = {}; pBoard.render(); renderMoves();
    if (P.g.game_over()) return afterMove();
    const n = Math.ceil(P.g.history().length / 2);
    if (P.coach && before != null) {
      P.busy = true; setTurn(); $('#plTurn span').textContent = 'Coach is watching';
      const e = await evaluate(P.g.fen(), 300);
      P.busy = false;
      if (e) {
        const after = -e.v, loss = before - after;
        const reply = uciMove(P.g.fen(), e.best);
        if (loss >= 250 && before > -700 && reply) {
          sfx.oops();
          pBoard.arrows = [{ from: reply.from, to: reply.to, kind: 'bad' }]; pBoard.render();
          plCoach(`<p><b>Hold on!</b> If you play ${esc(KS.sayMove(m).replace(/[,!].*$/, ''))}, ${KS.COLOR[reply.color]} can answer <b>${esc(KS.sayMove(reply))}</b>${/[!.]$/.test(KS.sayMove(reply)) ? '' : '.'}</p>
            <div class="btns"><button class="btn primary" id="plBack" type="button">Take it back</button><button class="btn" id="plOn" type="button">Play on</button></div>`, 'bad');
          P.busy = true;
          const choice = await new Promise(res => { $('#plBack').onclick = () => res('back'); $('#plOn').onclick = () => res('on'); });
          P.busy = false; pBoard.arrows = [];
          if (choice === 'back') {
            P.g.undo(); pBoard.last = null; renderMoves();
            plCoach('<p>Good idea. Look for a safer move. Check what your opponent can capture after you move.</p>');
            P.before = before; P.best = best; dangerRings(); pBoard.render(); setTurn(); return true;
          }
          plCoach('<p>Okay, let\'s see what happens!</p>');
        } else {
          const bestM = uciMove(fenBefore, best);
          const tip = openingTip(m, n);
          if (bestM && strip(bestM.san) === strip(m.san) && (m.captured || m.san.includes('+') || loss < 20) && Math.random() < (m.captured || m.san.includes('+') ? 1 : .35)) {
            plCoach(`<p><b>${['Great move!', 'That\'s what a master would play!', 'Excellent!', 'Super move!'][Math.random() * 4 | 0]}</b></p>${tip ? `<p class="note">${tip}</p>` : ''}`, 'good');
          } else if (loss >= 120 && bestM) {
            plCoach(`<p>Okay move. <b>${esc(KS.sayMove(bestM))}</b> was even stronger.</p>${tip ? `<p class="note">${tip}</p>` : ''}`);
          } else if (tip) plCoach(`<p>${tip}</p>`);
        }
      }
    } else { const tip = openingTip(m, n); if (tip && P.coach) plCoach(`<p>${tip}</p>`); }
    afterMove();
    return true;
  }

  function playHint() {
    if (!P.live || P.busy || P.g.turn() !== P.me) return;
    const m = uciMove(P.g.fen(), P.best);
    if (!m) { plCoach('<p>Give me a second to look at the board, then press Hint again.</p>'); return; }
    P.hintStep++;
    if (P.hintStep === 1) { pBoard.rings = { [m.from]: 'hint' }; pBoard.render(); plCoach(`<p><b>Hint:</b> Look at your ${KS.NAME[m.piece]} on ${m.from}. ${m.captured ? 'Can it capture something?' : m.san.includes('+') ? 'Can it give a check?' : 'Where could it go?'}</p>`); }
    else { pBoard.arrows = [{ from: m.from, to: m.to }]; pBoard.render(); plCoach(`<p><b>Try this:</b> ${esc(KS.sayMove(m))}</p>`); }
  }
  function takeBack() {
    if (P.busy) return;
    const h = P.g.history({ verbose: true }); if (!h.length) return;
    P.g.undo(); if (P.g.turn() !== P.me) P.g.undo();
    if (P.g.turn() !== P.me) { afterMove(); return; }
    P.live = true; pBoard.last = null; pBoard.arrows = [];
    plCoach('<p>Took it back. Take your time and look for a better move.</p>');
    afterMove();
  }

  // ---------- lessons ----------
  function renderLessons() {
    const done = prog().lessons;
    $('#v-lessons').innerHTML = `<div class="lessons">${LESSONS.map((l, i) => `<button class="lesson ${done[l.id] ? 'done' : ''}" type="button" data-i="${i}">
      <span class="num">${done[l.id] ? '✓' : i + 1}</span><span><strong>${esc(l.title)}</strong><br><span class="note">${esc(l.body[0].split('. ')[0])}.</span></span></button>`).join('')}</div>`;
    $('#v-lessons').querySelectorAll('.lesson').forEach(b => b.addEventListener('click', () => openLesson(+b.dataset.i)));
  }
  let lBoard = null, LS = null;
  function openLesson(i) {
    const l = LESSONS[i];
    $('#v-lesson').innerHTML = `<button class="back" type="button" id="lsBack">&larr; All lessons</button>
      <div class="bench"><div class="boardbox"><div id="lsBoard"></div></div>
      <div class="panel"><h2>${esc(l.title)}</h2><div class="lessontext">${l.body.map(p => `<p>${esc(p)}</p>`).join('')}</div>
      <div class="coach" id="lsCoach"></div><div class="btns" id="lsBtns"></div></div></div>`;
    $('#lsBack').addEventListener('click', () => { renderLessons(); show('lessons'); });
    LS = { l, i, g: new Chess(l.ex.fen), done: false, busy: false };
    lBoard = new Board($('#lsBoard'), { onMove: lessonMove, canMove: () => !LS.done && !LS.busy });
    lBoard.flipped = LS.g.turn() === 'b'; lBoard.setGame(LS.g);
    coach($('#lsCoach'), `<p><b>Your turn:</b> ${esc(l.ex.ask)}</p>`, '', l.body.join(' ') + ' ' + l.ex.ask);
    lessonButtons();
    show('lesson');
  }
  function lessonButtons() {
    const l = LS.l, book = BOOKS[0];
    const count = l.theme && book ? itemsOf(book).filter(p => themesOf(book, p).includes(l.theme)).length : 0;
    const next = LESSONS[LS.i + 1];
    $('#lsBtns').innerHTML = (count ? `<button class="btn primary" type="button" id="lsPractice">Practice: ${count} ${esc(KS.THEMES[l.theme].label.toLowerCase())} puzzles</button>` : '') +
      (next ? `<button class="btn" type="button" id="lsNext">Next lesson: ${esc(next.title)}</button>` : '');
    const p = $('#lsPractice'); if (p) p.addEventListener('click', () => openBook(0, l.theme));
    const n = $('#lsNext'); if (n) n.addEventListener('click', () => openLesson(LS.i + 1));
  }
  async function lessonMove(from, to, promo) {
    const m = LS.g.move({ from, to, promotion: promo }); if (!m) return false;
    moveSound(m); lBoard.last = m; lBoard.render();
    if (LS.l.ex.answers.some(a => strip(a) === strip(m.san))) {
      LS.done = true; prog().lessons[LS.l.id] = true; save();
      sfx.win(); confetti();
      coach($('#lsCoach'), `<p><b>${esc(LS.l.ex.yes)}</b></p>`, 'good');
      return true;
    }
    LS.busy = true; sfx.oops();
    coach($('#lsCoach'), `<p>${esc(LS.l.ex.no)}</p>`, 'bad');
    await sleep(1100); LS.g.undo(); lBoard.last = null; lBoard.render(); LS.busy = false;
    return false;
  }

  // ---------- boot ----------
  setVoiceBtn(); renderPlayers(); renderShelf(); show('books');
  KS.Stockfish.init();
})();
