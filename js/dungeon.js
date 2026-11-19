// Floor generation, field of view, line of sight and distance maps. No DOM: runs in Node for the self-test.
import { actOf } from './data.js';

export const WALL = 0, FLOOR = 1, LAVA = 2, WATER = 3;
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

export const inside = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
export const tile = (m, x, y) => (inside(m, x, y) ? m.t[y * m.w + x] : WALL);
export const walkable = (m, x, y) => { const k = tile(m, x, y); return k === FLOOR || k === WATER; };
// diagonal steps may not squeeze between two walls' corners
export const canStep = (m, x, y, dx, dy) => walkable(m, x + dx, y + dy) && (!dx || !dy || (tile(m, x + dx, y) !== WALL && tile(m, x, y + dy) !== WALL));
export const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const ri = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));

function blank(w, h) { return { w, h, t: new Uint8Array(w * h), seen: new Uint8Array(w * h), deco: [], lights: [] }; }

function carve(m, x, y, k = FLOOR) { if (x > 0 && y > 0 && x < m.w - 1 && y < m.h - 1) m.t[y * m.w + x] = k; }

function corridor(m, a, b, rnd) {
  let { x, y } = a;
  const horizontalFirst = rnd() < 0.5;
  const stepX = () => { while (x !== b.x) { carve(m, x, y); x += Math.sign(b.x - x); } };
  const stepY = () => { while (y !== b.y) { carve(m, x, y); y += Math.sign(b.y - y); } };
  if (horizontalFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
  carve(m, x, y);
}

const center = (r) => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) });

function rooms(rnd, abyss) {
  const m = blank(abyss ? 52 : 50, abyss ? 38 : 36);
  const list = [];
  for (let i = 0; i < 200 && list.length < (abyss ? 10 : 12); i++) {
    const w = ri(rnd, abyss ? 6 : 5, abyss ? 12 : 10), h = ri(rnd, abyss ? 5 : 4, abyss ? 9 : 8);
    const r = { x: ri(rnd, 1, m.w - w - 2), y: ri(rnd, 1, m.h - h - 2), w, h };
    if (list.some((o) => r.x < o.x + o.w + 2 && r.x + r.w + 2 > o.x && r.y < o.y + o.h + 2 && r.y + r.h + 2 > o.y)) continue;
    list.push(r);
  }
  if (list.length < 6) return null;
  list.sort((a, b) => a.x - b.x);
  for (const r of list) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(m, x, y);
  for (let i = 1; i < list.length; i++) corridor(m, center(list[i - 1]), center(list[i]), rnd);
  for (let i = 0; i < 3; i++) { // a few loops, so the map is not a single line
    const a = list[ri(rnd, 0, list.length - 1)], b = list[ri(rnd, 0, list.length - 1)];
    if (a !== b && Math.abs(a.x - b.x) < 22) corridor(m, center(a), center(b), rnd);
  }
  for (const r of list.slice(1)) {
    const big = r.w >= 8 && r.h >= 6;
    if (abyss && big && rnd() < 0.6) { // lava pool, kept away from the room edges so the room stays crossable
      const c = center(r), rx = (r.w - 4) / 2, ry = (r.h - 4) / 2;
      for (let y = r.y + 2; y < r.y + r.h - 2; y++) for (let x = r.x + 2; x < r.x + r.w - 2; x++)
        if (((x - c.x) / rx) ** 2 + ((y - c.y) / ry) ** 2 <= 1 + rnd() * 0.3) carve(m, x, y, LAVA);
    } else if (!abyss && big && rnd() < 0.5) { // pillars
      for (let y = r.y + 2; y < r.y + r.h - 2; y += 3) for (let x = r.x + 2; x < r.x + r.w - 2; x += 3) carve(m, x, y, WALL);
    }
  }
  m.rooms = list;
  return m;
}

function caves(rnd) {
  const m = blank(52, 38), { w, h } = m;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) m.t[y * w + x] = rnd() < 0.55 ? FLOOR : WALL;
  const walls8 = (x, y) => { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && tile(m, x + dx, y + dy) === WALL) n++; return n; };
  for (let it = 0; it < 6; it++) {
    const next = m.t.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const n = walls8(x, y);
      next[y * w + x] = n >= 5 || (it < 2 && n <= 1) ? WALL : FLOOR;
    }
    m.t = next;
  }
  // keep the biggest open area only
  const region = new Int32Array(w * h).fill(-1);
  let best = -1, bestSize = 0;
  for (let i = 0, id = 0; i < w * h; i++) {
    if (m.t[i] !== FLOOR || region[i] >= 0) continue;
    let size = 0; const stack = [i]; region[i] = id;
    while (stack.length) {
      const c = stack.pop(); size++;
      for (const [dx, dy] of DIRS.slice(0, 4)) {
        const n = c + dx + dy * w;
        if (m.t[n] === FLOOR && region[n] < 0) { region[n] = id; stack.push(n); }
      }
    }
    if (size > bestSize) { bestSize = size; best = id; }
    id++;
  }
  if (bestSize < w * h * 0.3) return null;
  for (let i = 0; i < w * h; i++) if (m.t[i] === FLOOR && region[i] !== best) m.t[i] = WALL;
  for (let k = 0; k < 3; k++) { // shallow pools
    let x = ri(rnd, 2, w - 3), y = ri(rnd, 2, h - 3);
    for (let s = 0; s < 18; s++) {
      if (tile(m, x, y) === FLOOR) m.t[y * w + x] = WATER;
      const [dx, dy] = DIRS[ri(rnd, 0, 3)];
      if (tile(m, x + dx, y + dy) !== WALL) { x += dx; y += dy; }
    }
  }
  return m;
}

// breadth-first distances over walkable tiles (diagonals cost 1). block(x, y) can veto tiles.
export function distanceMap(m, sx, sy, block) {
  const d = new Int16Array(m.w * m.h).fill(-1);
  d[sy * m.w + sx] = 0;
  const q = [sx, sy];
  for (let h = 0; h < q.length; h += 2) {
    const x = q[h], y = q[h + 1], dv = d[y * m.w + x];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, i = ny * m.w + nx;
      if (!inside(m, nx, ny) || d[i] >= 0 || !canStep(m, x, y, dx, dy) || (block && block(nx, ny))) continue;
      d[i] = dv + 1; q.push(nx, ny);
    }
  }
  return d;
}

// shortest walkable path from a to b (excluded a, included b), or null
export function path(m, a, b, block) {
  const d = distanceMap(m, b.x, b.y, (x, y) => !(x === a.x && y === a.y) && block && block(x, y));
  if (d[a.y * m.w + a.x] < 0) return null;
  const out = []; let { x, y } = a;
  while (x !== b.x || y !== b.y) {
    let next = null;
    for (const [dx, dy] of DIRS) {
      const nv = inside(m, x + dx, y + dy) ? d[(y + dy) * m.w + x + dx] : -1;
      if (nv >= 0 && nv < d[y * m.w + x] && canStep(m, x, y, dx, dy)) { next = [x + dx, y + dy]; break; }
    }
    if (!next) return null;
    [x, y] = next; out.push({ x, y });
  }
  return out;
}

// line of sight: no wall strictly between a and b
export function los(m, a, b) {
  let x = a.x, y = a.y;
  const dx = Math.abs(b.x - x), dy = -Math.abs(b.y - y), sx = Math.sign(b.x - x), sy = Math.sign(b.y - y);
  let err = dx + dy;
  for (;;) {
    if (x === b.x && y === b.y) return true;
    if ((x !== a.x || y !== a.y) && tile(m, x, y) === WALL) return false;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// recursive shadowcasting: marks visible tiles (walls included, so they get drawn) in out
const OCT = [[1, 0, 0, -1, -1, 0, 0, 1], [0, 1, -1, 0, 0, -1, 1, 0], [0, 1, 1, 0, 0, -1, -1, 0], [1, 0, 0, 1, -1, 0, 0, -1]];
export function fov(m, ox, oy, radius, out) {
  out.fill(0);
  out[oy * m.w + ox] = 1;
  for (let o = 0; o < 8; o++) cast(m, ox, oy, 1, 1, 0, radius, OCT[0][o], OCT[1][o], OCT[2][o], OCT[3][o], out);
  return out;
}
function cast(m, cx, cy, row, start, end, radius, xx, xy, yx, yy, out) {
  if (start < end) return;
  const r2 = (radius + 0.5) ** 2;
  let newStart = 0;
  for (let j = row; j <= radius; j++) {
    let dx = -j - 1;
    const dy = -j;
    let blocked = false;
    while (dx <= 0) {
      dx++;
      const X = cx + dx * xx + dy * xy, Y = cy + dx * yx + dy * yy;
      const l = (dx - 0.5) / (dy + 0.5), r = (dx + 0.5) / (dy - 0.5);
      if (start < r) continue;
      if (end > l) break;
      const opaque = tile(m, X, Y) === WALL;
      if (inside(m, X, Y) && dx * dx + dy * dy < r2) out[Y * m.w + X] = 1;
      if (blocked) {
        if (opaque) { newStart = r; continue; }
        blocked = false; start = newStart;
      } else if (opaque && j < radius) {
        blocked = true;
        cast(m, cx, cy, j + 1, start, l, radius, xx, xy, yx, yy, out);
        newStart = r;
      }
    }
    if (blocked) break;
  }
}

function decorate(m, act, rnd) {
  const { w } = m;
  const floorAt = (x, y) => walkable(m, x, y);
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const k = m.t[y * w + x];
    if (k === WALL && floorAt(x, y + 1) && rnd() < (act.id === 'caves' ? 0.03 : 0.06)) {
      // light on the wall face: torches in the crypt, crystals in the caves, braziers in the abyss
      const kind = act.id === 'crypt' ? 'torch' : act.id === 'caves' ? 'crystal' : 'brazier';
      if (!m.deco.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) < 5 && d.light)) {
        m.deco.push({ x, y, k: kind, light: true });
        m.lights.push({ x, y: y + 0.6, r: kind === 'crystal' ? 3.5 : 4.5, c: kind === 'crystal' ? [90, 200, 255] : kind === 'torch' ? [255, 150, 60] : [255, 90, 40], flicker: kind !== 'crystal' });
      }
    } else if (k === FLOOR && rnd() < 0.05) {
      const pool = act.id === 'crypt' ? ['bones', 'skull', 'rubble'] : act.id === 'caves' ? ['mushroom', 'mushroom', 'rubble'] : ['skull', 'rubble', 'ember'];
      const kind = pool[ri(rnd, 0, pool.length - 1)];
      m.deco.push({ x, y, k: kind });
      if (kind === 'mushroom' && rnd() < 0.5) m.lights.push({ x, y, r: 2.2, c: [80, 255, 170], flicker: false });
    } else if (k === LAVA && rnd() < 0.25) {
      m.lights.push({ x, y, r: 3, c: [255, 80, 20], flicker: true });
    }
  }
}

// a ready floor: tiles, start, stairs (farthest point), decorations and lights
export function generate(floor, rnd = Math.random) {
  const act = actOf(floor);
  for (let tries = 0; tries < 60; tries++) {
    const m = act.gen === 'caves' ? caves(rnd) : rooms(rnd, act.gen === 'abyss');
    if (!m) continue;
    let start;
    if (m.rooms) start = center(m.rooms[0]);
    else {
      const cells = []; for (let i = 0; i < m.t.length; i++) if (m.t[i] === FLOOR) cells.push(i);
      // the westernmost open cell
      const i = cells.reduce((a, b) => (b % m.w < a % m.w ? b : a));
      start = { x: i % m.w, y: (i / m.w) | 0 };
    }
    if (!walkable(m, start.x, start.y)) continue;
    const d = distanceMap(m, start.x, start.y);
    let far = -1, stairs = null, reach = 0, total = 0;
    for (let i = 0; i < d.length; i++) {
      const k = m.t[i];
      if (k === FLOOR || k === WATER) { total++; if (d[i] >= 0) reach++; }
      if (k === FLOOR && d[i] > far) {
        const x = i % m.w, y = (i / m.w) | 0;
        // the stairs need some room around them (the boss waits there)
        let open = 0; for (const [dx, dy] of DIRS) if (walkable(m, x + dx, y + dy)) open++;
        if (open >= 7) { far = d[i]; stairs = { x, y }; }
      }
    }
    if (!stairs || reach < total || far < 25) continue;
    m.start = start; m.stairs = stairs; m.dist = d;
    decorate(m, act, rnd);
    m.deco = m.deco.filter((o) => !((o.x === start.x && o.y === start.y) || (o.x === stairs.x && o.y === stairs.y)));
    return m;
  }
  throw new Error('floor generation failed');
}
