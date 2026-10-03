// Knight School: chess helpers, theme finder, engines. Needs chess.js (global Chess).
(function () {
  const FILES = 'abcdefgh';
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const NAME = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
  const COLOR = { w: 'White', b: 'Black' };
  const xy = s => [FILES.indexOf(s[0]), +s[1] - 1];
  const sq = (x, y) => FILES[x] + (y + 1);
  const onBoard = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;

  function pieces(g, color) {
    const out = [];
    g.board().forEach((row, r) => row.forEach((p, f) => {
      if (p && (!color || p.color === color)) out.push({ sq: sq(f, 7 - r), type: p.type, color: p.color });
    }));
    return out;
  }

  // Does the piece on `from` attack square `to`? (ignores pins, like real attack maps)
  function attacks(g, from, to) {
    const p = g.get(from); if (!p) return false;
    const [fx, fy] = xy(from), [tx, ty] = xy(to), dx = tx - fx, dy = ty - fy;
    if (!dx && !dy) return false;
    switch (p.type) {
      case 'p': return Math.abs(dx) === 1 && dy === (p.color === 'w' ? 1 : -1);
      case 'n': return (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
      case 'k': return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
      default: {
        const diag = Math.abs(dx) === Math.abs(dy), straight = !dx || !dy;
        if (p.type === 'b' && !diag) return false;
        if (p.type === 'r' && !straight) return false;
        if (p.type === 'q' && !diag && !straight) return false;
        const sx = Math.sign(dx), sy = Math.sign(dy);
        for (let x = fx + sx, y = fy + sy; x !== tx || y !== ty; x += sx, y += sy) if (g.get(sq(x, y))) return false;
        return true;
      }
    }
  }
  const attackers = (g, target, color) => pieces(g, color).filter(p => attacks(g, p.sq, target));

  // Squares a piece could move to, by the movement rules only (works without kings on the board).
  function pieceTargets(g, from) {
    const p = g.get(from); if (!p) return [];
    const out = [], [fx, fy] = xy(from);
    if (p.type === 'p') {
      const dir = p.color === 'w' ? 1 : -1, start = p.color === 'w' ? 1 : 6;
      if (onBoard(fx, fy + dir) && !g.get(sq(fx, fy + dir))) {
        out.push(sq(fx, fy + dir));
        if (fy === start && !g.get(sq(fx, fy + 2 * dir))) out.push(sq(fx, fy + 2 * dir));
      }
      [-1, 1].forEach(dx => { if (onBoard(fx + dx, fy + dir)) { const t = g.get(sq(fx + dx, fy + dir)); if (t && t.color !== p.color) out.push(sq(fx + dx, fy + dir)); } });
      return out;
    }
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
      const s = sq(x, y), t = g.get(s);
      if (attacks(g, from, s) && (!t || t.color !== p.color)) out.push(s);
    }
    return out;
  }

  // Pieces of `color` that can be won: attacked and undefended, or attacked by something cheaper.
  function looseOrHanging(g, color) {
    const enemy = color === 'w' ? 'b' : 'w';
    return pieces(g, color).filter(p => p.type !== 'k').filter(p => {
      const att = attackers(g, p.sq, enemy); if (!att.length) return false;
      const def = attackers(g, p.sq, color);
      return !def.length || Math.min(...att.map(a => VAL[a.type])) < VAL[p.type];
    });
  }

  function material(g, color) {
    let m = 0; pieces(g).forEach(p => { if (p.type !== 'k') m += (p.color === color ? 1 : -1) * VAL[p.type]; });
    return m;
  }

  // ---- Words: turn moves into sentences a kid can follow ----
  function sayMove(m, g) {
    if (m.san.startsWith('O-O-O')) return 'castles queenside' + endWords(m.san);
    if (m.san.startsWith('O-O')) return 'castles' + endWords(m.san);
    let s = NAME[m.piece];
    if (m.captured) s += ' takes the ' + NAME[m.captured] + ' on ' + m.to;
    else s += ' to ' + m.to;
    if (m.promotion) s += ' and becomes a ' + NAME[m.promotion];
    return s + endWords(m.san);
  }
  function endWords(san) { return san.includes('#') ? ', checkmate!' : san.includes('+') ? ', check!' : ''; }

  // ---- Theme finder: looks at the solution line and names the trick ----
  const THEMES = {
    mate: { label: 'Checkmate', tip: 'Look at the enemy King. Which checks leave it with no squares to run to?' },
    backrank: { label: 'Back-rank mate', tip: 'The King is stuck behind its own pawns. Can a Rook or Queen reach that back row?' },
    fork: { label: 'Fork', tip: 'Can one of your pieces attack two things at the same time?' },
    pin: { label: 'Pin', tip: 'Is an enemy piece standing in front of something more valuable? Line it up!' },
    skewer: { label: 'Skewer', tip: 'Attack the big piece in front. When it moves, take the piece behind it.' },
    discovered: { label: 'Discovered attack', tip: 'Move one piece out of the way so the piece behind it can attack.' },
    promotion: { label: 'Pawn promotion', tip: 'Can a pawn march to the last row and become a Queen?' },
    sacrifice: { label: 'Sacrifice', tip: 'Sometimes you give up a piece on purpose to get something bigger. Look for a surprising move!' },
    removedefender: { label: 'Remove the defender', tip: 'Which enemy piece is doing an important job? Take it away, and something else falls.' },
    material: { label: 'Win material', tip: 'Look for checks, captures and threats. Something can be won!' },
  };

  function findThemes(fen, line, mate) {
    const g = new Chess(fen), me = g.turn(), them = me === 'w' ? 'b' : 'w', tags = new Set();
    const before = new Chess(fen);
    const m1 = g.move(line[0]); if (!m1) return [];
    if (mate) {
      tags.add('mate');
      // back-rank: final mating move by rook/queen on the enemy's back row
      const gg = new Chess(fen); let last;
      for (const s of line.slice(0, mate * 2 - 1)) last = gg.move(s) || last;
      const back = me === 'w' ? '8' : '1', fwd = me === 'w' ? -1 : 1;
      const k = gg.in_checkmate() && pieces(gg, them).find(p => p.type === 'k');
      if (k && last && /[rq]/.test(last.piece) && last.to[1] === back && k.sq[1] === back) {
        const [kx, ky] = xy(k.sq);
        const boxed = [-1, 0, 1].every(dx => { const x = kx + dx; if (!onBoard(x, ky + fwd)) return true; const p = gg.get(sq(x, ky + fwd)); return p && p.color === them; });
        if (boxed) tags.add('backrank');
      }
    }
    line.slice(0, 7).forEach((s, i) => { if (i % 2 === 0 && /=/.test(s)) tags.add('promotion'); });
    // fork: the moved piece hits 2+ worthwhile targets
    const hit = pieces(g, them).filter(p => attacks(g, m1.to, p.sq)).filter(p =>
      p.type === 'k' || VAL[p.type] > VAL[m1.piece] || !attackers(g, p.sq, them).length);
    if (hit.length >= 2 && m1.piece !== 'k') tags.add('fork');
    // discovered: another of my pieces now hits king/queen/rook that it did not before
    pieces(g, me).filter(p => p.sq !== m1.to && /[bqr]/.test(p.type)).forEach(p => {
      pieces(g, them).filter(t => /[kqr]/.test(t.type) && VAL[t.type] > VAL[p.type] || t.type === 'k').forEach(t => {
        if (attacks(g, p.sq, t.sq) && !attacks(before, p.sq, t.sq)) tags.add('discovered');
      });
    });
    // pin / skewer along the moved slider's lines
    if (/[bqr]/.test(m1.piece)) {
      const [fx, fy] = xy(m1.to);
      const dirs = { b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
      const ds = m1.piece === 'q' ? dirs.b.concat(dirs.r) : dirs[m1.piece];
      ds.forEach(([sx, sy]) => {
        const seen = [];
        for (let x = fx + sx, y = fy + sy; onBoard(x, y) && seen.length < 2; x += sx, y += sy) {
          const p = g.get(sq(x, y)); if (p) seen.push(p);
        }
        if (seen.length === 2 && seen[0].color === them && seen[1].color === them) {
          if (VAL[seen[1].type] > VAL[seen[0].type] && VAL[seen[1].type] > VAL[m1.piece] - 1) tags.add('pin');
          else if (VAL[seen[0].type] > VAL[seen[1].type] && VAL[seen[0].type] >= 9 && seen[1].type !== 'p') tags.add('skewer');
        }
      });
    }
    // sacrifice: gives up more than it takes and the piece can be captured
    const gave = VAL[m1.piece], took = m1.captured ? VAL[m1.captured] : 0;
    if (m1.piece !== 'p' && m1.piece !== 'k' && gave - took >= 2 && attackers(g, m1.to, them).length) tags.add('sacrifice');
    // remove the defender: first move captures a piece that guarded something we then win
    if (m1.captured && line[2]) {
      const g2 = new Chess(fen); g2.move(line[0]); const r = g2.move(line[1]); const m3 = r && g2.move(line[2]);
      if (m3 && m3.captured && VAL[m3.captured] >= 3 && !m1.san.includes('+') && !tags.has('mate')) tags.add('removedefender');
    }
    if (!tags.size) tags.add('material');
    const order = ['backrank', 'mate', 'fork', 'pin', 'skewer', 'discovered', 'promotion', 'removedefender', 'sacrifice', 'material'];
    return order.filter(t => tags.has(t));
  }

  // Explain a whole solved line in plain words.
  function explainLine(fen, line, upTo) {
    const g = new Chess(fen), me = g.turn(), out = [];
    line.slice(0, upTo).forEach((s, i) => {
      const m = g.move(s); if (!m) return;
      const who = m.color === me ? (i === 0 ? 'You play ' : 'Then you play ') : COLOR[m.color] + ' answers ';
      out.push(who + sayMove(m) + (/[!.]$/.test(sayMove(m)) ? '' : '.'));
    });
    return out;
  }

  // ---- Engines ----
  const SF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';
  const Stockfish = {
    ok: false, worker: null, handler: null, chain: Promise.resolve(),
    init() {
      return new Promise(res => {
        let done = false; const finish = v => { if (!done) { done = true; this.ok = v; res(v); } };
        try {
          const blob = new Blob([`importScripts("${SF_URL}");`], { type: 'text/javascript' });
          this.worker = new Worker(URL.createObjectURL(blob));
          this.worker.onmessage = e => { const l = String(e.data); if (l === 'uciok') finish(true); if (this.handler) this.handler(l); };
          this.worker.onerror = () => finish(false);
          this.worker.postMessage('uci');
        } catch (e) { finish(false); }
        setTimeout(() => finish(false), 12000);
      });
    },
    // returns {lines:[{type,v,pv:[uci]}]} with score from side-to-move's view
    analyse(fen, { movetime = 300, multipv = 1, skill = 20 } = {}) {
      const run = () => new Promise(res => {
        const lines = {};
        const timer = setTimeout(() => { this.handler = null; res({ lines: Object.values(lines) }); }, movetime + 4000);
        this.handler = l => {
          if (l.startsWith('info') && l.includes(' pv ')) {
            const mp = +((l.match(/ multipv (\d+)/) || [0, 1])[1]);
            const s = l.match(/score (cp|mate) (-?\d+)/);
            if (s) lines[mp] = { type: s[1], v: +s[2], pv: l.split(' pv ')[1].trim().split(' ') };
          } else if (l.startsWith('bestmove')) {
            clearTimeout(timer); this.handler = null;
            const best = l.split(' ')[1];
            const arr = Object.keys(lines).sort().map(k => lines[k]);
            if (!arr.length && best && best !== '(none)') arr.push({ type: 'cp', v: 0, pv: [best] });
            res({ lines: arr, best });
          }
        };
        const w = this.worker;
        w.postMessage('setoption name Skill Level value ' + skill);
        w.postMessage('setoption name MultiPV value ' + multipv);
        w.postMessage('position fen ' + fen);
        w.postMessage('go movetime ' + movetime);
      });
      const p = this.chain.then(run, run); this.chain = p.catch(() => {}); return p;
    },
  };

  // Small built-in engine: used for the beginner levels and when Stockfish can't load.
  const PST_CENTER = [0, 1, 2, 3, 3, 2, 1, 0];
  const Mini = {
    evalBoard(g) { // from white's view, centipawns
      if (g.in_checkmate()) return g.turn() === 'w' ? -100000 : 100000;
      if (g.in_draw() || g.in_stalemate()) return 0;
      let s = 0;
      g.board().forEach((row, r) => row.forEach((p, f) => {
        if (!p) return;
        let v = VAL[p.type] * 100;
        if (p.type !== 'k') v += (PST_CENTER[f] + PST_CENTER[7 - r]) * (p.type === 'n' ? 6 : p.type === 'p' ? 3 : 2);
        if (p.type === 'p') v += (p.color === 'w' ? 7 - r - 1 : r - 1) * 4;
        s += p.color === 'w' ? v : -v;
      }));
      return s;
    },
    search(g, depth, alpha, beta, qdepth) {
      const sign = g.turn() === 'w' ? 1 : -1;
      if (depth <= 0) {
        const stand = sign * this.evalBoard(g);
        if (qdepth <= 0 || g.game_over()) return stand;
        if (stand >= beta) return stand;
        alpha = Math.max(alpha, stand);
        const caps = g.moves({ verbose: true }).filter(m => m.captured);
        for (const m of caps) { g.move(m); const v = -this.search(g, 0, -beta, -alpha, qdepth - 1); g.undo(); if (v >= beta) return v; alpha = Math.max(alpha, v); }
        return alpha;
      }
      const moves = g.moves({ verbose: true });
      if (!moves.length) return sign * this.evalBoard(g);
      moves.sort((a, b) => (b.captured ? VAL[b.captured] * 10 - VAL[b.piece] : 0) - (a.captured ? VAL[a.captured] * 10 - VAL[a.piece] : 0));
      let best = -Infinity;
      for (const m of moves) {
        g.move(m); const v = -this.search(g, depth - 1, -beta, -alpha, qdepth); g.undo();
        if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break;
      }
      return best;
    },
    // returns moves scored from mover's view, best first
    rank(fen, depth = 2) {
      const g = new Chess(fen);
      return g.moves({ verbose: true }).map(m => {
        g.move(m); const v = -this.search(g, depth - 1, -Infinity, Infinity, 2); g.undo();
        return { move: m, v };
      }).sort((a, b) => b.v - a.v);
    },
    pick(fen, depth, noise) {
      const r = this.rank(fen, depth).map(x => ({ ...x, n: x.v + (Math.random() - 0.5) * 2 * noise }));
      r.sort((a, b) => b.n - a.n); return r[0] && r[0].move;
    },
  };

  window.KS = { VAL, NAME, COLOR, THEMES, xy, sq, pieces, attacks, attackers, pieceTargets, looseOrHanging, material, sayMove, findThemes, explainLine, Stockfish, Mini };
})();
