/* Runebreaker — the walkable world. Each floor of a run is a small area to
   explore, laid out from that floor's nodes: tall grass for wild monsters,
   houses for trainers, the healer, the shop and the riddle hall, a locked
   chest, a townsperson or two, and a gate (or, every third floor, the boss
   tower) leading on.

   Kept small on purpose: 11 by 13 tiles, the whole area on one phone
   screen. Time spent walking is time not spent on maths, so everything in
   it leads to a problem to solve, and nothing is more than a few steps away.

   Pure logic, no DOM: deterministic from the run's rng so it can be tested. */

import { isBossFloor } from './engine.js';

export const W = 11;
export const H = 13;

/* Terrain. Objects (houses, people, the gate) sit on top and block the tile;
   walking into one is how you use it. */
export const WALKABLE = new Set(['ground', 'path', 'tall']);

/* What each node of the floor becomes in the world. A plain fight is the tall
   grass, which every area has anyway. */
const BUILDING_FOR = {
  elite: 'trainer',
  riddle: 'riddle',
  treasure: 'chest',
  shop: 'shop',
  rest: 'healer',
};

/* Things that can be used once per area are marked done when they are. */
export const ONCE = new Set(['trainer', 'riddle', 'chest', 'shop', 'healer']);

const NPC_LOOKS = [
  { art: '\u{1F467}', name: 'Lily' }, { art: '\u{1F466}', name: 'Max' },
  { art: '\u{1F475}', name: 'Grandma Rose' }, { art: '\u{1F468}‍\u{1F33E}', name: 'Farmer Joe' },
  { art: '\u{1F9D1}‍\u{1F3EB}', name: 'Teacher Kim' }, { art: '\u{1F46E}', name: 'Officer Dan' },
  { art: '\u{1F9D9}‍♀️', name: 'Old Wizard Ada' }, { art: '\u{1F468}‍\u{1F373}', name: 'Chef Leo' },
];

const TRAINER_LOOKS = [
  { art: '\u{1F9D1}‍\u{1F3A4}', name: 'Rocker Zed' }, { art: '\u{1F469}‍\u{1F680}', name: 'Astro Ava' },
  { art: '\u{1F977}', name: 'Ninja Ken' }, { art: '\u{1F9D1}‍\u{1F52C}', name: 'Professor Pi' },
  { art: '\u{1F478}', name: 'Princess Sum' }, { art: '\u{1F920}', name: 'Cowboy Carl' },
  { art: '\u{1F9DD}', name: 'Ranger Elm' }, { art: '\u{1F9DB}', name: 'Count Remainder' },
];

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const key = (x, y) => `${x},${y}`;
const inside = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Tiles reachable on foot from a point, as a Set of "x,y". */
export function reachable(area, from = area.start) {
  const seen = new Set([key(from.x, from.y)]);
  const queue = [from];
  while (queue.length) {
    const { x, y } = queue.shift();
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = key(nx, ny);
      if (seen.has(k) || !walkableAt(area, nx, ny)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

export function objectAt(area, x, y) {
  return area.objects.find(o => o.x === x && o.y === y) || null;
}

export function walkableAt(area, x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  return WALKABLE.has(area.tiles[y][x]) && !objectAt(area, x, y);
}

/** Every object can be walked up to, and there is grass to fight in. */
export function areaIsSound(area) {
  const reach = reachable(area);
  const touchable = o => NEIGHBOURS.some(([dx, dy]) => reach.has(key(o.x + dx, o.y + dy)));
  const grass = [...reach].filter(k => { const [x, y] = k.split(',').map(Number); return area.tiles[y][x] === 'tall'; });
  return area.objects.every(touchable) && grass.length >= 6;
}

function blob(rng, tiles, x0, y0, size, from, to) {
  const cells = [[x0, y0]];
  if (tiles[y0][x0] === from) tiles[y0][x0] = to;
  let guard = 0;
  while (cells.length < size && guard++ < size * 12) {
    const [cx, cy] = pick(rng, cells);
    const [dx, dy] = pick(rng, NEIGHBOURS);
    const nx = cx + dx, ny = cy + dy;
    if (!inside(nx, ny) || tiles[ny][nx] !== from) continue;
    tiles[ny][nx] = to;
    cells.push([nx, ny]);
  }
}

function tryArea(rng, depth, nodes) {
  const boss = isBossFloor(depth);
  const tiles = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) =>
    (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? 'tree' : 'ground'));
  const mid = Math.floor(W / 2);
  const start = { x: mid, y: H - 2 };
  const gate = { x: mid, y: 0 };

  // A winding path from the entrance up to the gate.
  let x = mid;
  for (let y = H - 2; y >= 1; y--) {
    tiles[y][x] = 'path';
    if (y > 1 && y < H - 2 && rng() < 0.55) {
      const nx = Math.max(2, Math.min(W - 3, x + (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 2))));
      for (let i = Math.min(x, nx); i <= Math.max(x, nx); i++) tiles[y][i] = 'path';
      x = nx;
    }
  }
  for (let i = Math.min(x, mid); i <= Math.max(x, mid); i++) tiles[1][i] = 'path';

  // Tall grass, two or three patches, where the wild monsters are.
  const patches = 2 + (rng() < 0.5 ? 1 : 0);
  for (let i = 0; i < patches; i++) {
    const gx = 1 + Math.floor(rng() * (W - 2)), gy = 2 + Math.floor(rng() * (H - 5));
    blob(rng, tiles, gx, gy, 7 + Math.floor(rng() * 7), 'ground', 'tall');
  }
  // Sometimes a pond.
  if (rng() < 0.5) {
    const px = 1 + Math.floor(rng() * (W - 2)), py = 3 + Math.floor(rng() * (H - 7));
    if (tiles[py][px] === 'ground') blob(rng, tiles, px, py, 3 + Math.floor(rng() * 4), 'ground', 'water');
  }
  // A few trees for shape.
  for (let y = 1; y < H - 1; y++) for (let x2 = 1; x2 < W - 1; x2++) {
    if (tiles[y][x2] === 'ground' && rng() < 0.08) tiles[y][x2] = 'tree';
  }
  // Keep the entrance and the tile in front of the gate clear.
  tiles[start.y][start.x] = 'path';
  tiles[1][mid] = 'path';

  const objects = [];
  const spotsNextToPath = () => {
    const out = [];
    for (let y = 2; y < H - 2; y++) for (let x2 = 1; x2 < W - 1; x2++) {
      if (tiles[y][x2] !== 'ground' || objects.some(o => o.x === x2 && o.y === y)) continue;
      if (NEIGHBOURS.some(([dx, dy]) => tiles[y + dy]?.[x2 + dx] === 'path')) out.push({ x: x2, y });
    }
    return out;
  };
  const place = obj => {
    const spots = spotsNextToPath();
    if (!spots.length) return false;
    const s = pick(rng, spots);
    objects.push({ ...obj, x: s.x, y: s.y });
    return true;
  };

  let n = 0;
  if (!boss) {
    for (const node of nodes) {
      const kind = BUILDING_FOR[node.type];
      if (!kind) continue;
      const extra = kind === 'trainer' ? { trainer: pick(rng, TRAINER_LOOKS) } : {};
      if (!place({ id: `o${n++}`, kind, ...extra })) return null;
    }
  }
  const npcCount = boss ? 1 : 1 + (rng() < 0.4 ? 1 : 0);
  const people = NPC_LOOKS.slice();
  for (let i = 0; i < npcCount; i++) {
    const look = people.splice(Math.floor(rng() * people.length), 1)[0];
    if (!place({ id: `o${n++}`, kind: 'npc', npc: look })) return null;
  }
  objects.push({ id: 'exit', kind: boss ? 'boss' : 'gate', x: gate.x, y: gate.y });
  tiles[gate.y][gate.x] = 'ground';

  // Decorations: flowers and seasonal bits on open ground, never blocking.
  const deco = [];
  for (let y = 1; y < H - 1; y++) for (let x2 = 1; x2 < W - 1; x2++) {
    if (tiles[y][x2] === 'ground' && !objects.some(o => o.x === x2 && o.y === y) && rng() < 0.06) deco.push(key(x2, y));
  }

  const area = { depth, boss, tiles, start, gate, objects, deco, wins: 0, steps: 0, pos: { ...start } };
  return areaIsSound(area) ? area : null;
}

/** The area for a floor. Retries layouts until one is fully reachable. */
export function generateArea(rng, depth, nodes = []) {
  for (let tries = 0; tries < 40; tries++) {
    const a = tryArea(rng, depth, nodes);
    if (a) return a;
  }
  // A plain, always-sound fallback: a straight path with grass either side.
  const tiles = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) =>
    (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? 'tree' : (x === 5 ? 'path' : (x >= 2 && x <= 3 && y >= 3 && y <= 9 ? 'tall' : 'ground'))));
  tiles[0][5] = 'ground';
  tiles[H - 1][5] = 'tree';
  const objects = [{ id: 'exit', kind: isBossFloor(depth) ? 'boss' : 'gate', x: 5, y: 0 }];
  let y = 3;
  for (const node of isBossFloor(depth) ? [] : nodes) {
    const kind = BUILDING_FOR[node.type];
    if (kind) { objects.push({ id: `o${y}`, kind, x: 6, y, ...(kind === 'trainer' ? { trainer: TRAINER_LOOKS[0] } : {}) }); y += 2; }
  }
  objects.push({ id: 'npc', kind: 'npc', x: 4, y: 10, npc: NPC_LOOKS[0] });
  return { depth, boss: isBossFloor(depth), tiles, start: { x: 5, y: H - 2 }, gate: { x: 5, y: 0 }, objects, deco: [],
           wins: 0, steps: 0, pos: { x: 5, y: H - 2 } };
}

/** Shortest walk from one tile to stand next to a target, as moves. For bots and tests. */
export function pathTo(area, from, target) {
  const goal = (x, y) => NEIGHBOURS.some(([dx, dy]) => x + dx === target.x && y + dy === target.y);
  const prev = new Map([[key(from.x, from.y), null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (goal(cur.x, cur.y)) {
      const moves = [];
      let k = key(cur.x, cur.y);
      while (prev.get(k)) { const p = prev.get(k); moves.unshift(p.move); k = p.from; }
      moves.push([target.x - cur.x, target.y - cur.y]); // the final bump
      return moves;
    }
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cur.x + dx, ny = cur.y + dy, k = key(nx, ny);
      if (prev.has(k) || !walkableAt(area, nx, ny)) continue;
      prev.set(k, { from: key(cur.x, cur.y), move: [dx, dy] });
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}
