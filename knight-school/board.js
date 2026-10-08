// Knight School board: tap or drag to move, legal-move dots, arrows, rings.
(function () {
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const OUTLINE = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
  const FILES = 'abcdefgh';

  class Board {
    constructor(el, opts = {}) {
      this.el = el; this.opts = opts; this.flipped = false; this.sel = null; this.game = null;
      this.last = null; this.rings = {}; this.arrows = []; this.locked = false;
      el.classList.add('board');
      el.innerHTML = '<div class="squares"></div><svg class="arrows" viewBox="0 0 800 800" aria-hidden="true"></svg>';
      this.sqEl = el.querySelector('.squares'); this.svg = el.querySelector('.arrows');
      el.addEventListener('pointerdown', e => this.down(e));
      window.addEventListener('pointermove', e => this.move(e));
      window.addEventListener('pointerup', e => this.up(e));
    }
    setGame(g) { this.game = g; this.sel = null; this.render(); }
    order() { const s = []; for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) s.push(FILES[f] + (r + 1)); return this.flipped ? s.reverse() : s; }
    render() {
      const g = this.game; if (!g) return;
      const legal = this.sel ? g.moves({ square: this.sel, verbose: true }) : [];
      const targets = new Map(legal.map(m => [m.to, m]));
      const myKing = KS.pieces(g, g.turn()).find(p => p.type === 'k');
      const checkSq = myKing && g.in_check() ? myKing.sq : null;
      this.sqEl.innerHTML = this.order().map((s, i) => {
        const f = FILES.indexOf(s[0]), r = +s[1] - 1, light = (f + r) % 2 === 1;
        const p = g.get(s), cls = ['sq', light ? 'l' : 'd'];
        if (this.last && (s === this.last.from || s === this.last.to)) cls.push('last');
        if (s === this.sel) cls.push('sel');
        if (s === checkSq) cls.push('check');
        if (this.rings[s]) cls.push('ring-' + this.rings[s]);
        if (targets.has(s)) cls.push(p ? 'cap' : 'dot');
        const row = i % 8 === 0, col = i >= 56;
        const coordR = row ? `<span class="cr">${s[1]}</span>` : '';
        const coordF = col ? `<span class="cf">${s[0]}</span>` : '';
        const piece = p ? `<span class="pc ${p.color}" data-sq="${s}"><i>${GLYPH[p.type]}</i>${p.color === 'w' ? `<b>${OUTLINE[p.type]}</b>` : ''}</span>` : '';
        return `<div class="${cls.join(' ')}" data-sq="${s}">${coordR}${coordF}${piece}</div>`;
      }).join('');
      this.drawArrows();
    }
    center(s) {
      let f = FILES.indexOf(s[0]), r = 8 - +s[1];
      if (this.flipped) { f = 7 - f; r = 7 - r; }
      return [f * 100 + 50, r * 100 + 50];
    }
    drawArrows() {
      this.svg.innerHTML = '<defs><marker id="ah" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="context-stroke"/></marker></defs>' +
        this.arrows.map(a => {
          const [x1, y1] = this.center(a.from), [x2, y2] = this.center(a.to);
          const len = Math.hypot(x2 - x1, y2 - y1), k = (len - 30) / len;
          return `<line class="arw ${a.kind || ''}" x1="${x1}" y1="${y1}" x2="${x1 + (x2 - x1) * k}" y2="${y1 + (y2 - y1) * k}" marker-end="url(#ah)"/>`;
        }).join('');
    }
    sqAt(x, y) {
      const el = document.elementFromPoint(x, y); const s = el && el.closest('.sq');
      return s && this.el.contains(s) ? s.dataset.sq : null;
    }
    mine(s) { const p = this.game.get(s); return p && p.color === this.game.turn() && (!this.opts.canMove || this.opts.canMove(s)); }
    down(e) {
      if (this.locked || !this.game) return;
      const s = this.sqAt(e.clientX, e.clientY); if (!s) return;
      if (this.opts.tapMode && this.opts.tapMode()) { e.preventDefault(); this.opts.onTap(s); return; }
      if (this.sel && s !== this.sel && !this.mine(s)) { this.tryMove(this.sel, s); return; }
      if (!this.mine(s)) { this.sel = null; this.render(); return; }
      this.sel = s; this.render();
      const pc = this.el.querySelector(`.pc[data-sq="${s}"]`);
      if (pc) {
        e.preventDefault();
        const r = pc.getBoundingClientRect();
        this.drag = { s, ghost: pc.cloneNode(true), sx: e.clientX, sy: e.clientY, moved: false };
        const gh = this.drag.ghost; gh.classList.add('ghost');
        gh.style.width = r.width + 'px'; gh.style.height = r.height + 'px';
        gh.style.left = (e.clientX - r.width / 2) + 'px'; gh.style.top = (e.clientY - r.height / 2) + 'px';
        this.drag.src = pc; this.drag.w = r.width;
      }
    }
    move(e) {
      const d = this.drag; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) {
        d.moved = true; document.body.appendChild(d.ghost); d.src.style.opacity = '.25';
      }
      if (d.moved) { d.ghost.style.left = (e.clientX - d.w / 2) + 'px'; d.ghost.style.top = (e.clientY - d.w / 2) + 'px'; }
    }
    up(e) {
      const d = this.drag; if (!d) return; this.drag = null;
      if (!d.moved) return; d.ghost.remove();
      const s = this.sqAt(e.clientX, e.clientY);
      if (s && s !== d.s) this.tryMove(d.s, s); else this.render();
    }
    tryMove(from, to) {
      const legal = this.game.moves({ square: from, verbose: true }).filter(m => m.to === to);
      this.sel = null;
      if (!legal.length) { this.render(); return; }
      const promo = legal.find(m => m.promotion) ? 'q' : undefined;
      const ok = this.opts.onMove ? this.opts.onMove(from, to, promo) : true;
      this.render();
      return ok;
    }
  }
  window.Board = Board;
})();
