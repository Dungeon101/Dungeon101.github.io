// node tests/selftest.mjs [runs per class]
// Checks the floor generator and plays whole runs with a simple bot: no exceptions, saves that survive a round trip,
// and a rough balance report (how deep each class gets).
import assert from 'node:assert/strict';
import { generate, distanceMap, walkable, canStep, DIRS, dist } from '../js/dungeon.js';
import { Game, itemScore } from '../js/game.js';
import { CLASSES, TALENTS, SKILLS } from '../js/data.js';

// 1. floors: start and stairs reachable, every walkable tile connected
for (let f = 1; f <= 9; f++) for (let i = 0; i < 40; i++) {
  const m = generate(f);
  const d = distanceMap(m, m.start.x, m.start.y);
  assert.ok(d[m.stairs.y * m.w + m.stairs.x] > 0, `floor ${f}: stairs unreachable`);
  for (let k = 0; k < m.t.length; k++) if (m.t[k] === 1 || m.t[k] === 3) assert.ok(d[k] >= 0, `floor ${f}: isolated tile`);
}
console.log('floors ok');

// 2. local and cloud progress merge: more lifetime embers wins, relics and records add up
{
  const { mergeMeta, blankMeta } = await import('../js/meta.js');
  const a = { ...blankMeta(), earned: 100, embers: 40, relics: { crown: 1 }, stats: { ...blankMeta().stats, best: 3, runs: 5 }, history: [{ at: 1 }] };
  const b = { ...blankMeta(), earned: 300, embers: 10, relics: { gland: 1 }, stats: { ...blankMeta().stats, best: 2, runs: 9 }, history: [{ at: 2 }, { at: 1 }] };
  const m = mergeMeta(a, b);
  assert.equal(m.embers, 10); assert.equal(m.earned, 300);
  assert.deepEqual(Object.keys(m.relics).sort(), ['crown', 'gland']);
  assert.equal(m.stats.best, 3); assert.equal(m.stats.runs, 9);
  assert.deepEqual(m.history.map((r) => r.at), [2, 1]);
  assert.equal(mergeMeta(a, null), a);
  console.log('meta merge ok');
}

// 3. bot runs
const order = ['B1', 'C1', 'A1', 'B2', 'A2', 'C2', 'B3', 'A3', 'C3'];
const dropped = new WeakSet(); // the bot does not go back for what it threw away
function botTurn(g) {
  const p = g.player, m = g.map, st = g.ps();
  while (p.points > 0 && order.some((id) => g.learn(id)));
  for (const it of [...p.bag]) if (it.slot !== 'use' && itemScore(it) > itemScore(p.equip[it.slot])) g.equip(it.uid);
  for (const it of p.bag.filter((x) => x.slot !== 'use').sort((a, b) => itemScore(a) - itemScore(b)).slice(0, Math.max(0, p.bag.length - 12))) { dropped.add(it); g.drop(it.uid); }
  if (p.hp < st.maxHp * 0.4 && p.bag.some((x) => x.kind === 'heal')) return g.quickPotion();
  if (g.onStairs()) return g.act({ type: 'descend' });
  const foes = g.visibleEnemies().sort((a, b) => dist(a, p) - dist(b, p));
  // step out of telegraphed tiles
  if (g.hazards.some((h) => h.x === p.x && h.y === p.y)) {
    for (const [dx, dy] of DIRS) if (!g.hazards.some((h) => h.x === p.x + dx && h.y === p.y + dy) && g.act({ type: 'move', dx, dy })) return true;
  }
  if (foes.length) {
    for (const id of g.skills()) {
      if ((p.cds[id] || 0) > 0) continue;
      const sk = SKILLS[id];
      if (id === 'blink' || id === 'smoke') continue;
      if (!sk.target) { if (g.act({ type: 'skill', id })) return true; continue; }
      const tg = g.targets(id)[0];
      if (tg && g.act({ type: 'skill', id, x: tg.x, y: tg.y })) return true;
    }
    const e = foes[0];
    const dm = distanceMap(m, e.x, e.y, (x, y) => g.enemyAt(x, y) && !(x === e.x && y === e.y));
    let best = null, bv = 1e9;
    for (const [dx, dy] of DIRS) { const v = dm[(p.y + dy) * m.w + p.x + dx]; if (v >= 0 && v < bv && (canStep(m, p.x, p.y, dx, dy) || g.enemyAt(p.x + dx, p.y + dy))) { bv = v; best = [dx, dy]; } }
    if (best && g.act({ type: 'move', dx: best[0], dy: best[1] })) return true;
    return g.act({ type: 'wait' });
  }
  // explore: nearest seen tile next to an unseen one, else the stairs (or the boss waiting on them)
  const dm = distanceMap(m, p.x, p.y, (x, y) => g.blocked(x, y) && !g.chestAt(x, y));
  let goal = null, gv = 1e9;
  for (let i = 0; i < m.t.length; i++) {
    if (dm[i] <= 0 || !m.seen[i]) continue;
    const x = i % m.w, y = (i / m.w) | 0;
    const frontier = DIRS.some(([dx, dy]) => !m.seen[(y + dy) * m.w + x + dx] && walkable(m, x + dx, y + dy)) || (p.bag.length < 16 && g.items.some((o) => o.x === x && o.y === y && !dropped.has(o.it)));
    if (frontier && dm[i] < gv) { gv = dm[i]; goal = { x, y }; }
  }
  if (!goal) goal = m.stairs;
  const back = distanceMap(m, goal.x, goal.y);
  let best = null, bv = back[p.y * m.w + p.x];
  for (const [dx, dy] of DIRS) { const v = back[(p.y + dy) * m.w + p.x + dx]; if (v >= 0 && v < bv && canStep(m, p.x, p.y, dx, dy)) { bv = v; best = [dx, dy]; } }
  if (best && g.act({ type: 'move', dx: best[0], dy: best[1] })) return true;
  return g.act({ type: 'wait' });
}

export { botTurn };
const runs = process.env.NORUN ? 0 : Number(process.argv[2] || 25);
for (const cls of Object.keys(CLASSES)) {
  const floors = [], causes = {};
  let wins = 0, lv = 0;
  for (let r = 0; r < runs; r++) {
    let g = Game.create({ cls, name: 'Bot', meta: { upgrades: {} } });
    for (let turn = 0; turn < 8000 && !g.over; turn++) {
      if (turn % 500 === 250) { // save round trip in the middle of a run
        const copy = new Game(JSON.parse(JSON.stringify(g)));
        assert.equal(copy.map.t.join(), g.map.t.join());
        assert.equal(copy.player.hp, g.player.hp);
        g = copy;
      }
      if (!botTurn(g)) g.act({ type: 'wait' });
      g.ev.length = 0;
      assert.ok(Number.isFinite(g.player.hp), 'hp is a number');
      for (const e of g.enemies) assert.ok(walkable(g.map, e.x, e.y), 'enemy on a wall');
    }
    floors.push(g.floor); lv += g.player.lvl;
    if (g.over === 'win') wins++; else causes[g.killer || 'timeout'] = (causes[g.killer || 'timeout'] || 0) + 1;
  }
  const avg = floors.reduce((a, b) => a + b, 0) / runs;
  console.log(`${cls.padEnd(8)} avg floor ${avg.toFixed(1)}  wins ${wins}/${runs}  avg level ${(lv / runs).toFixed(1)}  deaths ${JSON.stringify(causes)}`);
}
// talents are all reachable
for (const c of Object.keys(TALENTS)) assert.equal(TALENTS[c].flat().length, 9);
console.log('selftest ok');
