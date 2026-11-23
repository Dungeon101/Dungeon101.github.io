// node bot.mjs [runs] — bilancio per classe, come tests/selftest.mjs ma riusabile
import { Game, itemScore } from './js/game.js';
import { CLASSES, TALENTS, SKILLS } from './js/data.js';
import { distanceMap, walkable, canStep, DIRS, dist } from './js/dungeon.js';
const order = ['B1', 'C1', 'A1', 'B2', 'A2', 'C2', 'B3', 'A3', 'C3'];
const dropped = new WeakSet();
export function botTurn(g) {
  const p = g.player, m = g.map, st = g.ps();
  while (p.points > 0 && order.some((id) => g.learn(id)));
  for (const it of [...p.bag]) if (it.slot !== 'use' && itemScore(it) > itemScore(p.equip[it.slot])) g.equip(it.uid);
  for (const it of p.bag.filter((x) => x.slot !== 'use').sort((a, b) => itemScore(a) - itemScore(b)).slice(0, Math.max(0, p.bag.length - 12))) { dropped.add(it); g.drop(it.uid); }
  if (p.hp < st.maxHp * 0.4 && p.bag.some((x) => x.kind === 'heal')) return g.quickPotion();
  if (g.onStairs()) return g.act({ type: 'descend' });
  const foes = g.visibleEnemies().sort((a, b) => dist(a, p) - dist(b, p));
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
export function report(runs = 25, only = null) {
  const out = [];
  for (const cls of Object.keys(CLASSES)) {
    if (only && !only.includes(cls)) continue;
    const floors = [], causes = {};
    let wins = 0, lv = 0;
    for (let r = 0; r < runs; r++) {
      const g = Game.create({ cls, name: 'Bot', meta: { upgrades: {} } });
      for (let turn = 0; turn < 12000 && !g.over; turn++) { if (!botTurn(g)) g.act({ type: 'wait' }); g.ev.length = 0; }
      floors.push(g.floor); lv += g.player.lvl;
      if (g.over === 'win') wins++; else causes[g.killer || 'timeout'] = (causes[g.killer || 'timeout'] || 0) + 1;
    }
    const avg = floors.reduce((a, b) => a + b, 0) / runs;
    out.push(`${cls.padEnd(9)} media piano ${avg.toFixed(1)}  vittorie ${wins}/${runs}  livello ${(lv / runs).toFixed(1)}  morti ${JSON.stringify(causes)}`);
  }
  return out;
}
if (process.argv[1]?.endsWith('bot.mjs')) console.log(report(Number(process.argv[2] || 25)).join('\n'));
