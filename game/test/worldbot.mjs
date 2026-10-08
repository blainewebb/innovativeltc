/* A bot that walks the world the way a player would: it reads the tiles off
   the screen, picks a goal, finds a path, and presses the arrow keys. Shared
   by the browser test and the soak run.

   Goals, in order: the healer when low on health, an unbeaten trainer, the
   tall grass until a fight here has been won, then the gate (or the boss).
   It skips riddle halls and chests, whose word problems it can only guess,
   so what the soak run measures stays combat balance. */

const KEY = { '0,-1': 'ArrowUp', '0,1': 'ArrowDown', '-1,0': 'ArrowLeft', '1,0': 'ArrowRight' };

/** Plan the next walk, in the page. Returns { goal, moves } or null. */
function plan({ skip = [], want = null } = {}) {
  const tiles = {};
  document.querySelectorAll('#world .wt').forEach(t => { tiles[`${t.dataset.x},${t.dataset.y}`] = t.dataset; });
  const h = document.getElementById('hero').dataset;
  const start = [Number(h.x), Number(h.y)];
  const walk = k => tiles[k] && ['ground', 'path', 'tall'].includes(tiles[k].k);
  const hpTxt = (document.querySelector('.hp-pill') || {}).textContent || '50/50';
  const [hp, max] = hpTxt.replace(/[^\d/]/g, '').split('/').map(Number);
  const low = hp / max;
  const objs = Object.entries(tiles).filter(([, t]) => t.k === 'obj')
    .map(([k, t]) => ({ k, kind: t.o, done: t.done === '1' }));
  const has = kind => objs.some(o => o.kind === kind && !o.done && !skip.includes(kind));
  const gateLocked = !!document.querySelector('.o-gate .wmark.lock');

  let goal;
  if (want) goal = want;
  else if (low < 0.6 && has('healer')) goal = 'healer';
  else if (low >= 0.4 && has('trainer')) goal = 'trainer';
  else if (gateLocked) goal = 'grass';
  else goal = objs.some(o => o.kind === 'boss') ? 'boss' : 'gate';

  // Breadth first from the hero. For an object, stand next to it and bump;
  // for grass, step onto a tall tile (or along one if already standing in it).
  // Heading anywhere else it keeps out of the grass if it can, like a player
  // who does not want a fight just now.
  if (goal === 'grass' && tiles[start.join(',')]?.k === 'tall') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${start[0] + dx},${start[1] + dy}`;
      if (walk(k)) return { goal, moves: [[dx, dy], [-dx, -dy], [dx, dy], [-dx, -dy]] };
    }
  }
  const search = avoidGrass => {
    const prev = { [start.join(',')]: null };
    const queue = [start];
    const back = k => { const moves = []; while (prev[k]) { moves.unshift(prev[k].m); k = prev[k].f; } return moves; };
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
        const k = `${x + dx},${y + dy}`;
        const t = tiles[k];
        if (!t) continue;
        if (goal !== 'grass' && t.k === 'obj' && t.o === goal && t.done !== '1') {
          return { goal, moves: [...back(`${x},${y}`), [dx, dy]] };
        }
        if (k in prev || !walk(k)) continue;
        if (avoidGrass && t.k === 'tall') continue;
        prev[k] = { f: `${x},${y}`, m: [dx, dy] };
        if (goal === 'grass' && t.k === 'tall') return { goal, moves: back(k) };
        queue.push([x + dx, y + dy]);
      }
    }
    return null;
  };
  return (goal !== 'grass' && search(true)) || search(false);
}

/** One step of play in the world. Returns what it did, or null if not in the world. */
export async function worldTurn(page, opts = {}) {
  if (!(await page.$('#world'))) return null;
  // A text box: read on, or take the first (main) choice.
  const dlg = await page.$('#wdialog:not([hidden])');
  if (dlg) {
    const btn = await page.$('#wdialog [data-db="next"]') || await page.$('#wdialog [data-db="0"]');
    if (btn) await btn.click();
    return 'dialog';
  }
  const p = await page.evaluate(plan, opts);
  if (!p) return 'stuck';
  for (const m of p.moves) {
    await page.keyboard.press(KEY[m.join(',')]);
    // Stop as soon as something happens: a fight, a text box, a new screen.
    if (!(await page.$('#world')) || (await page.$('#wdialog:not([hidden])')) || (await page.$('#app[data-busy]'))) break;
  }
  await page.waitForSelector('#app:not([data-busy])', { timeout: 5000 }).catch(() => {});
  return p.goal;
}
