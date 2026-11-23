// The rules: turns, d20 combat, skills, talents, enemies and bosses, loot, floors. No DOM: the UI reads `ev` (events) and `log`.
import { ACTS, actOf, actIndex, actStart, isBossFloor, isLastBoss, FLOORS, CLASSES, SKILLS, ENEMIES, BASES, TIER_ADJ, RARITIES, LEGENDARY_NAMES, MODS, CONSUMABLES, RELICS, xpNext } from './data.js';
import { generate, fov, los, distanceMap, walkable, canStep, tile, dist, DIRS, WALL, inside } from './dungeon.js';
import { t, L, lang } from './i18n.js';

const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const chance = (p) => Math.random() < p;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export { xpNext };
const BAG = 16;

export function itemName(it) {
  if (!it) return '';
  if (it.kind === 'gold') return `${it.n} ${t('gold').toLowerCase()}`;
  if (it.slot === 'use') return L(CONSUMABLES[it.kind].name);
  if (it.uniq != null) return L(LEGENDARY_NAMES[it.uniq]);
  const base = BASES[it.base], adj = TIER_ADJ[it.tier - 1];
  return lang === 'it' ? `${base.it} ${adj.it[base.f ? 1 : 0]}` : `${adj.en} ${base.en}`;
}
export const itemScore = (it) => (it && it.slot !== 'use' && it.kind !== 'gold' ? it.tier * 10 + it.rarity * 15 + Object.keys(it.mods || {}).length * 4 : 0);
export function itemLines(it) {
  const out = [];
  if (it.slot === 'use') return [L(CONSUMABLES[it.kind].desc)];
  if (it.power) out.push(MODS.power[lang].replace('{0}', it.power));
  if (it.ac) out.push(MODS.ac[lang].replace('{0}', it.ac));
  for (const [k, v] of Object.entries(it.mods || {})) out.push(MODS[k][lang].replace('{0}', v));
  return out;
}

export class Game {
  constructor(data) {
    Object.assign(this, data);
    this.ev = [];
    if (this.map && !(this.map.t instanceof Uint8Array)) { // restored from a save
      const s = this.map.packed; delete this.map.packed;
      this.map.t = Uint8Array.from(s, (c) => c.charCodeAt(0) & 3);
      this.map.seen = Uint8Array.from(s, (c) => (c.charCodeAt(0) >> 2) & 1);
    }
    if (this.map) { this.vis = new Uint8Array(this.map.w * this.map.h); this.recompute(); }
  }

  // a fresh run. meta: sanctuary state (upgrades fixed for the whole run)
  static create({ cls, name, relic = null, heirloom = null, meta = {} }) {
    const up = (id) => meta.upgrades?.[id] || 0;
    const player = {
      id: 1, kind: 'player', cls, name, x: 0, y: 0, hp: 1, lvl: 1, xp: 0, points: 1 + up('insight'), talents: {}, cds: {}, st: {},
      equip: { weapon: null, armor: null, trinket: null }, bag: [], gold: 0, flags: {}, venom: 0,
    };
    const g = new Game({
      floor: 0, turn: 0, uid: 2, player, enemies: [], items: [], chests: [], hazards: [], fountain: null, stairsOpen: true, log: [], over: null, killer: null,
      relic, bonus: { hp: up('vigor') * 5, power: up('edge'), ac: up('guard'), gold: up('fortune') * 0.2, light: up('torch') },
      stats: { kills: 0, gold: 0, bosses: [] }, map: null,
    });
    player.equip.weapon = g.makeEquip('weapon', 1, 0, true);
    for (let i = 0; i < 1 + up('satchel'); i++) player.bag.push(g.makeUse('heal'));
    if (heirloom) {
      const it = { ...heirloom, uid: g.uid++ };
      const c = CLASSES[cls];
      if (it.slot === 'weapon' && !c.weapons.includes(it.base)) it.base = c.weapons[0];
      if (it.slot === 'armor') it.base = c.armor;
      if (player.equip[it.slot]) player.bag.push(player.equip[it.slot]);
      player.equip[it.slot] = it;
    }
    g.newFloor(1);
    player.hp = g.ps().maxHp;
    return g;
  }

  toJSON() {
    const { ev, vis, ...rest } = this;
    const m = this.map;
    let packed = '';
    for (let i = 0; i < m.t.length; i++) packed += String.fromCharCode(48 + (m.t[i] | (m.seen[i] << 2)));
    return { ...rest, map: { w: m.w, h: m.h, deco: m.deco, lights: m.lights, start: m.start, stairs: m.stairs, packed } };
  }

  // ---------- derived stats ----------
  // the talents a class turned on: a Set of effect names, read once per call (see talentFlags in data.js)
  flags() {
    const f = CLASSES[this.player.cls].talentFlags || {}, T = this.player.talents, out = new Set();
    for (const [id, effect] of Object.entries(f)) if (T[id]) out.add(effect);
    return out;
  }

  has(effect) { return this.flags().has(effect); }

  ps() {
    const p = this.player, c = CLASSES[p.cls], b = this.bonus, F = this.flags();
    const m = { hp: 0, hit: 0, power: 0, ac: 0, crit: 0, regen: 0, steal: 0, gold: 0, light: 0 };
    for (const it of Object.values(p.equip)) if (it) {
      m.power += it.power || 0; m.ac += it.ac || 0;
      for (const [k, v] of Object.entries(it.mods || {})) m[k] += v;
    }
    return {
      maxHp: c.hp + (p.lvl - 1) * c.hpLvl + b.hp + m.hp + (F.has('hp15') ? 15 : 0),
      ac: c.ac + b.ac + m.ac + (F.has('ac2') ? 2 : 0) + (F.has('ac3') ? 3 : 0),
      hit: c.hit + Math.floor(p.lvl / 2) + m.hit,
      power: b.power + m.power + Math.floor((p.lvl - 1) / 3),
      crit: c.crit - Math.min(2, m.crit) - (F.has('lucky') ? 1 : 0),
      dmg: c.dmg, regen: m.regen, steal: m.steal,
      gold: 1 + b.gold + m.gold / 100 + (F.has('lucky') ? 0.25 : 0),
      light: 7 + b.light + m.light,
    };
  }

  skills() { // the class skills the hero knows
    const p = this.player, s = CLASSES[p.cls].skills;
    return s.filter((_, i) => i === 0 || (i === 1 ? p.talents.B1 : p.talents.C1));
  }

  skillCd(id) {
    const p = this.player, T = p.talents, F = this.flags();
    let cd = SKILLS[id].cd;
    if (id === 'bash' && T.B2) cd--;
    if (id === 'firebolt' && T.A2) cd--;
    if (F.has('fastskills')) cd--;
    return Math.max(1, cd);
  }

  // ---------- helpers ----------
  say(s, c = '') { this.log.push({ s, c }); if (this.log.length > 80) this.log.shift(); }
  emit(e) { this.ev.push(e); }
  enemyAt(x, y) { return this.enemies.find((e) => e.x === x && e.y === y); }
  chestAt(x, y) { return this.chests.find((c) => c.x === x && c.y === y && !c.open); }
  blocked(x, y) { return !walkable(this.map, x, y) || this.enemyAt(x, y) || (this.player.x === x && this.player.y === y) || this.chestAt(x, y); }
  seesPlayer(e) { return this.vis[e.y * this.map.w + e.x] && !(this.player.st.invis > 0); }
  visibleEnemies() { return this.enemies.filter((e) => this.vis[e.y * this.map.w + e.x]); }
  ename(e) { return L(ENEMIES[e.type].name); }
  onStairs() { const s = this.map.stairs; return this.stairsOpen && this.player.x === s.x && this.player.y === s.y; }

  recompute() {
    const p = this.player, m = this.map;
    fov(m, p.x, p.y, this.ps().light, this.vis);
    for (let i = 0; i < this.vis.length; i++) if (this.vis[i]) m.seen[i] = 1;
  }

  freeCells(minFromStart = 0) {
    const m = this.map, out = [];
    const d = m.dist || distanceMap(m, m.start.x, m.start.y);
    for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
      if (tile(m, x, y) !== 1 || d[y * m.w + x] < minFromStart) continue;
      if ((x === m.stairs.x && y === m.stairs.y) || this.blocked(x, y) || this.items.some((i) => i.x === x && i.y === y)) continue;
      out.push({ x, y });
    }
    return out;
  }

  freeNear(x, y, r = 1) {
    const out = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if ((dx || dy) && !this.blocked(x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
    return out;
  }

  // ---------- items ----------
  rollRarity(min = 0) {
    const w = RARITIES.map((r, i) => r.weight + (i === 3 ? this.floor * 0.6 : i === 2 ? this.floor : 0));
    let r = Math.random() * w.reduce((a, b) => a + b), i = 0;
    while (r > w[i]) r -= w[i++];
    return Math.max(min, i);
  }

  makeEquip(slot, tierBoost = 0, rarityMin = 0, plain = false) {
    const c = CLASSES[this.player.cls];
    const tier = plain ? 1 : clamp(Math.ceil(Math.max(1, this.floor) / 2) + tierBoost + (chance(0.25) ? 1 : 0) - (chance(0.2) ? 1 : 0), 1, 5);
    const rarity = plain ? 0 : this.rollRarity(rarityMin);
    const it = { uid: this.uid++, slot, tier, rarity, mods: {} };
    let pool;
    if (slot === 'weapon') { it.base = pick(c.weapons); it.power = Math.ceil(tier * 0.8); pool = ['hit', 'power', 'crit', 'steal']; }
    else if (slot === 'armor') { it.base = c.armor; it.ac = Math.ceil(tier * 0.6); pool = ['hp', 'ac', 'regen', 'light']; }
    else { it.base = pick(['ring', 'amulet']); pool = ['hp', 'hit', 'power', 'ac', 'crit', 'regen', 'steal', 'gold', 'light']; }
    const n = RARITIES[rarity].mods + (slot === 'trinket' ? 1 : 0);
    for (const k of pool.sort(() => Math.random() - 0.5).slice(0, n)) {
      const d = MODS[k];
      it.mods[k] = d.fixed ?? Math.max(d.min || 1, Math.round(d.per * tier + (rarity >= 2 ? 1 : 0)));
    }
    if (rarity === 3) it.uniq = rint(0, LEGENDARY_NAMES.length - 1);
    return it;
  }

  makeUse(kind) { return { uid: this.uid++, slot: 'use', kind }; }

  randomLoot(rarityMin = 0) {
    const r = Math.random();
    if (r < 0.18) return this.makeUse('heal');
    if (r < 0.4) return this.makeUse(pick(['fire', 'teleport', 'map']));
    return this.makeEquip(pick(['weapon', 'armor', 'armor', 'trinket']), 0, rarityMin);
  }

  give(it, x, y) { // into the bag, or on the floor when the bag is full
    const p = this.player;
    if (it.kind === 'gold') {
      const n = Math.round(it.n * this.ps().gold);
      p.gold += n; this.stats.gold += n;
      this.say(t('lGold', n), 'gold'); this.emit({ t: 'fx', k: 'gold', x, y, n });
      return true;
    }
    if (p.bag.length >= BAG) { this.items.push({ x, y, it }); this.say(t('lFull', itemName(it))); return false; }
    p.bag.push(it);
    this.say(t('lPick', itemName(it)), 'loot');
    this.emit({ t: 'fx', k: 'pickup', x, y, it });
    return true;
  }

  // ---------- floors ----------
  newFloor(n) {
    this.floor = n;
    const m = generate(n);
    this.map = m;
    this.vis = new Uint8Array(m.w * m.h);
    this.enemies = []; this.items = []; this.chests = []; this.hazards = []; this.fountain = null;
    const p = this.player;
    p.x = m.start.x; p.y = m.start.y;
    p.flags.unbreakable = false; p.flags.secondWind = false;
    const act = actOf(n), boss = isBossFloor(n);
    this.stairsOpen = !boss;
    const within = n - actStart(n); // 0..ACT_LEN-1 inside the act
    if (boss) this.spawn(act.boss, m.stairs.x, m.stairs.y, false, within);
    let count = Math.round((7 + n + rint(0, 2)) * (boss ? 0.7 : 1));
    const cells = this.freeCells(8).sort(() => Math.random() - 0.5);
    const pool = act.pool.filter((k) => (ENEMIES[k].minFloor || 0) <= n);
    while (count > 0 && cells.length) {
      const c = cells.pop(), type = pick(pool), d = ENEMIES[type];
      if (boss && dist(c, m.stairs) < 7) continue;
      const elite = chance(0.07 + n * 0.012);
      this.spawn(type, c.x, c.y, elite, within); count--;
      for (let k = 1; k < (d.pack || 1); k++) { const f = this.freeNear(c.x, c.y)[0]; if (f && count > 0) { this.spawn(type, f.x, f.y, false, within); count--; } }
    }
    const free = this.freeCells(3).sort(() => Math.random() - 0.5);
    const take = () => free.pop();
    let potions = 0;
    for (let i = 0, k = 2 + rint(0, 2); i < k && free.length; i++) {
      const c = take(), it = this.randomLoot();
      if (it.kind === 'heal') potions++;
      this.items.push({ ...c, it });
    }
    if (!potions && n % 2 && free.length) this.items.push({ ...take(), it: this.makeUse('heal') });
    for (let i = 0, k = 3 + rint(0, 2); i < k && free.length; i++) this.items.push({ ...take(), it: { kind: 'gold', n: rint(4, 9) * n } });
    for (let i = 0, k = rint(1, 2); i < k && free.length; i++) {
      const c = take();
      if (walkable(m, c.x, c.y)) this.chests.push({ ...c, open: false });
    }
    if (chance(0.45) && free.length) this.fountain = { ...take(), used: false };
    delete m.dist;
    this.recompute();
    this.say(t('lWelcome', n), 'sys');
    this.emit({ t: 'floor', n });
  }

  spawn(type, x, y, elite = false, within = 0) {
    // tougher inside an act (within 0..2) and from one act to the next (bosses are tuned by hand)
    const d = ENEMIES[type], act = d.boss ? 0 : actIndex(Math.max(1, this.floor));
    const k = (1 + 0.12 * within) * (1 + 0.25 * act);
    const hp = Math.round(d.hp * k * (elite ? 1.6 : 1));
    const e = {
      id: this.uid++, kind: 'enemy', type, x, y, hp, maxHp: hp, ac: d.ac + (elite ? 1 : 0), hit: d.hit + act + (within >= 2 ? 1 : 0) + (elite ? 1 : 0),
      dmg: [d.dmg[0] + act + (elite ? 1 : 0), d.dmg[1] + act * 2 + (elite ? 2 : 0)], xp: Math.round(d.xp * k * (elite ? 2 : 1)),
      elite, boss: !!d.boss, st: {}, cd: {}, energy: 0, awake: false, seen: -99, touched: false,
    };
    this.enemies.push(e);
    return e;
  }

  descend() {
    this.say(t('lDescend', this.floor + 1), 'sys');
    this.newFloor(this.floor + 1);
  }

  // ---------- the player's turn ----------
  // a: { type: 'move', dx, dy } | { type: 'wait' } | { type: 'skill', id, x, y } | { type: 'use', uid } | { type: 'descend' }
  act(a) {
    if (this.over) return false;
    const p = this.player;
    this.usedSkill = null;
    if (p.st.stun > 0) { this.say(t('lStunned'), 'bad'); this.endTurn(); return true; }
    let done = false;
    if (a.type === 'move') done = this.tryMove(a.dx, a.dy);
    else if (a.type === 'wait') done = true;
    else if (a.type === 'skill') done = this.useSkill(a.id, a.x, a.y);
    else if (a.type === 'use') done = this.useItem(a.uid);
    else if (a.type === 'descend') {
      if (!this.onStairs()) return false;
      this.descend(); return true;
    }
    if (done && !this.over) this.endTurn();
    return done;
  }

  tryMove(dx, dy) {
    const p = this.player, m = this.map, nx = p.x + dx, ny = p.y + dy;
    const e = this.enemyAt(nx, ny);
    const diagOk = !dx || !dy || (tile(m, p.x + dx, p.y) !== WALL && tile(m, p.x, p.y + dy) !== WALL);
    if (e) { if (!diagOk) return false; this.strike(p, e); return true; }
    const chest = this.chestAt(nx, ny);
    if (chest) {
      chest.open = true;
      this.say(t('lChest'), 'loot');
      this.emit({ t: 'fx', k: 'chest', x: nx, y: ny });
      this.give(this.randomLoot(1), nx, ny);
      if (chance(0.6)) this.give(this.randomLoot(), nx, ny);
      this.give({ kind: 'gold', n: rint(8, 16) * this.floor }, nx, ny);
      return true;
    }
    if (!canStep(m, p.x, p.y, dx, dy)) return false;
    if (p.st.web > 0) { this.say(t('lWebbed'), 'bad'); return true; }
    p.x = nx; p.y = ny;
    this.emit({ t: 'step' });
    for (let i = this.items.length - 1; i >= 0; i--) {
      const o = this.items[i];
      if (o.x === nx && o.y === ny) { this.items.splice(i, 1); this.give(o.it, nx, ny); }
    }
    const f = this.fountain;
    if (f && !f.used && f.x === nx && f.y === ny) {
      f.used = true;
      const st = this.ps(), n = st.maxHp - p.hp;
      p.hp = st.maxHp; p.st.poison = 0;
      this.say(t('lFountain'), 'good'); this.emit({ t: 'fx', k: 'fountain', x: nx, y: ny }); if (n > 0) this.emit({ t: 'heal', id: p.id, n, x: nx, y: ny });
    }
    if (this.onStairs()) this.say(t('stairsHint'), 'sys');
    return true;
  }

  // one attack roll. o: { flat, mult, sure, adv, kind ('melee' | shot kind | 'spell'), noCrit }
  strike(a, d, o = {}) {
    const p = this.player, isP = a === p, st = this.ps(), F = this.flags();
    let roll = rint(1, 20);
    if (o.adv) roll = Math.max(roll, rint(1, 20));
    let crit = !o.noCrit && roll >= (isP ? st.crit : 20);
    if (isP && p.st.invis > 0) { crit = true; p.st.invis = 0; }
    if (isP && F.has('ambush') && !d.touched) crit = true;
    const hitBonus = isP ? st.hit : a.hit, ac = isP ? d.ac : st.ac;
    const hit = o.sure || crit || (roll !== 1 && roll + hitBonus >= ac);
    if (o.kind && o.kind !== 'melee' && o.kind !== 'spell') this.emit({ t: 'shot', a: a.id, d: d.id, k: o.kind, x0: a.x, y0: a.y, x1: d.x, y1: d.y });
    else if (o.kind !== 'spell') this.emit({ t: 'atk', a: a.id, d: d.id });
    if (isP) d.touched = true;
    if (!hit) {
      this.emit({ t: 'miss', id: d.id, x: d.x, y: d.y });
      this.say(isP ? t('lYouMiss', this.ename(d)) : t('lMissYou', this.ename(a)));
      return false;
    }
    let n = o.base != null ? o.base : rint(...(isP ? st.dmg : a.dmg)) + (isP ? st.power : 0);
    n += o.flat || 0;
    if (crit) n *= isP && F.has('assassin') ? 3 : 2;
    n *= o.mult || 1;
    if (isP) n *= this.playerMult(d);
    n = Math.max(1, Math.round(n));
    if (!isP && F.has('ward') && chance(0.25)) {
      this.say(t('lWard'), 'good'); this.emit({ t: 'fx', k: 'ward', x: p.x, y: p.y }); return false;
    }
    this.say(isP ? t(crit ? 'lYouCrit' : 'lYouHit', this.ename(d), n) : t(crit ? 'lCritYou' : 'lHitYou', this.ename(a), n), isP ? (crit ? 'crit' : '') : 'bad');
    this.damage(d, n, crit, a);
    if (isP && d.hp > 0) {
      if (p.venom > 0 && o.kind !== 'spell') { p.venom--; this.poison(d, p.talents.B2 ? 4 : 3, p.talents.B2 ? 6 : 4); }
      else if (this.relic === 'gland' && o.kind !== 'spell') this.poison(d, 2, 3);
    }
    if (isP && st.steal && p.hp > 0) this.heal(st.steal, true);
    if (!isP && p.hp > 0) {
      const on = ENEMIES[a.type].onHit;
      if (on === 'stun' && chance(0.15)) { p.st.stun = 1; this.say(t('lStunned'), 'bad'); }
      if (on === 'poison') { p.st.poison = Math.max(p.st.poison || 0, 3); p.st.poisonDmg = 2 + Math.floor(this.floor / 3); }
      if (on === 'drain') { a.hp = Math.min(a.maxHp, a.hp + Math.ceil(n / 2)); }
    }
    return true;
  }

  playerMult(d) {
    const p = this.player, st = this.ps(), F = this.flags();
    let k = 1;
    if (this.relic === 'crown') k *= 1.15;
    if (F.has('rage') && p.hp < st.maxHp / 2) k *= 1.5;
    if (F.has('executioner') && d.hp < d.maxHp * 0.3) k *= 1.6;
    if (F.has('shatter') && (d.st.frozen > 0 || d.st.stun > 0)) k *= 1.6;
    if (F.has('virulence') && d.st.poison > 0) k *= 1.3;
    return k;
  }

  poison(e, dmg, turns) { e.st.poison = Math.max(e.st.poison || 0, turns); e.st.poisonDmg = Math.max(e.st.poisonDmg || 0, dmg); }

  heal(n, quiet = false) {
    const p = this.player, max = this.ps().maxHp;
    const got = Math.min(n, max - p.hp);
    if (got <= 0) return 0;
    p.hp += got;
    this.emit({ t: 'heal', id: p.id, n: got, x: p.x, y: p.y });
    if (!quiet) this.say(t('lHeal', got), 'good');
    return got;
  }

  damage(d, n, crit, from) {
    const p = this.player, F = this.flags();
    d.hp -= n;
    this.emit({ t: 'hit', id: d.id, n, crit, x: d.x, y: d.y, p: d === p });
    if (crit) this.emit({ t: 'shake', p: d === p ? 6 : 4 });
    if (d === p) {
      const st = this.ps();
      if (p.hp <= 0 && F.has('unbreakable') && !p.flags.unbreakable) {
        p.flags.unbreakable = true; p.hp = 1; this.say(t('lUnbreakable'), 'good'); this.emit({ t: 'fx', k: 'ward', x: p.x, y: p.y });
      }
      if (p.hp <= 0 && this.relic === 'phylactery' && !p.flags.phylactery) {
        p.flags.phylactery = true; p.hp = Math.round(st.maxHp / 2); this.say(t('lRelic'), 'good'); this.emit({ t: 'fx', k: 'level', x: p.x, y: p.y });
      }
      if (p.hp > 0 && p.hp < st.maxHp * 0.25 && F.has('secondwind') && !p.flags.secondWind) {
        p.flags.secondWind = true; this.say(t('lSecondWind'), 'good'); this.heal(Math.round(st.maxHp * 0.35), true);
      }
      if (p.hp <= 0) {
        p.hp = 0; this.over = 'dead'; this.killer = from ? (from === 'poison' ? t('lPoison', '').replace(/[:.\s]+$/, '') : this.ename(from)) : '?';
        this.emit({ t: 'die', id: p.id, x: p.x, y: p.y, player: true });
        this.emit({ t: 'over', win: false });
      }
      return;
    }
    if (d.hp <= 0) this.kill(d);
  }

  kill(e) {
    const p = this.player, d = ENEMIES[e.type];
    this.enemies = this.enemies.filter((x) => x !== e);
    this.stats.kills++;
    this.say(t('lKill', this.ename(e)), 'kill');
    this.emit({ t: 'die', id: e.id, x: e.x, y: e.y, type: e.type, boss: e.boss, elite: e.elite });
    if (this.has('bloodlust')) this.heal(3, true);
    this.gainXp(e.xp);
    if (d.split) for (const c of this.freeNear(e.x, e.y).slice(0, 2)) { const s = this.spawn('slimelet', c.x, c.y); s.awake = true; }
    const drop = (it) => { const c = this.blocked(e.x, e.y) || this.items.some((i) => i.x === e.x && i.y === e.y) ? this.freeNear(e.x, e.y)[0] : e; if (c) this.items.push({ x: c.x, y: c.y, it }); };
    if (e.boss) {
      drop(this.makeEquip(pick(['weapon', 'armor', 'trinket']), 1, 2));
      drop(this.makeUse('heal'));
      drop({ kind: 'gold', n: 40 * this.floor });
      this.stats.bosses.push(e.type);
      this.emit({ t: 'shake', p: 14 });
      if (isLastBoss(this.floor)) { this.over = 'win'; this.emit({ t: 'over', win: true }); return; }
      this.stairsOpen = true;
      this.say(t('lStairsOpen'), 'sys');
      this.emit({ t: 'fx', k: 'stairs', x: this.map.stairs.x, y: this.map.stairs.y });
      return;
    }
    if (e.elite || chance(d.small ? 0.04 : 0.16)) drop(this.randomLoot(e.elite ? 1 : 0));
    else if (chance(0.3)) drop({ kind: 'gold', n: rint(2, 6) * this.floor });
  }

  gainXp(n) {
    const p = this.player;
    p.xp += n;
    while (p.xp >= xpNext(p.lvl)) {
      p.xp -= xpNext(p.lvl); p.lvl++; p.points++;
      const st = this.ps();
      p.hp = Math.min(st.maxHp, p.hp + Math.round(st.maxHp * 0.3) + CLASSES[p.cls].hpLvl);
      this.say(t('lLevel', p.lvl), 'good');
      this.emit({ t: 'level', lvl: p.lvl, x: p.x, y: p.y });
    }
  }

  learn(id) { // talent: costs a point, needs the tier above in the same branch
    const p = this.player, tier = Number(id[1]);
    if (p.points <= 0 || p.talents[id] || (tier > 1 && !p.talents[id[0] + (tier - 1)])) return false;
    const before = this.ps().maxHp;
    p.points--; p.talents[id] = 1;
    p.hp += Math.max(0, this.ps().maxHp - before);
    this.recompute();
    return true;
  }

  // ---------- skills ----------
  // which targets a skill accepts right now (for the UI): [{x, y}]
  targets(id) {
    const p = this.player, sk = SKILLS[id], m = this.map;
    if (sk.target === 'adjacent') return this.enemies.filter((e) => dist(e, p) === 1 && (e.x === p.x || e.y === p.y || (tile(m, e.x, p.y) !== WALL && tile(m, p.x, e.y) !== WALL)));
    if (sk.target === 'enemy') return this.visibleEnemies().filter((e) => dist(e, p) <= sk.range && los(m, p, e)).sort((a, b) => dist(a, p) - dist(b, p));
    if (sk.target === 'tile') {
      const out = [];
      for (let y = p.y - sk.range; y <= p.y + sk.range; y++) for (let x = p.x - sk.range; x <= p.x + sk.range; x++)
        if (inside(m, x, y) && this.vis[y * m.w + x] && !this.blocked(x, y) && dist({ x, y }, p) >= 2) out.push({ x, y });
      return out;
    }
    return [];
  }

  useSkill(id, x, y) {
    const p = this.player, st = this.ps(), sk = SKILLS[id];
    if (!this.skills().includes(id) || (p.cds[id] || 0) > 0) return false;
    let target = null;
    if (sk.target) {
      target = this.targets(id).find((c) => c.x === x && c.y === y);
      if (!target) { this.say(t('lNoTarget')); return false; }
    }
    const adjacent = () => this.enemies.filter((e) => dist(e, p) === 1);
    const spell = (lo, hi) => rint(lo, hi) + st.power;
    switch (id) {
      case 'cleave': {
        const list = adjacent();
        if (!list.length) { this.say(t('lNoTarget')); return false; }
        this.emit({ t: 'fx', k: 'cleave', x: p.x, y: p.y });
        for (const e of list) this.strike(p, e, { flat: 3 });
        break;
      }
      case 'bash':
        this.emit({ t: 'fx', k: 'bash', x: target.x, y: target.y });
        if (this.strike(p, target, { sure: true, flat: 2 }) && target.hp > 0) {
          target.st.stun = target.boss ? 1 : p.talents.B2 ? 3 : 2; this.say(t('lStun', this.ename(target)));
        }
        break;
      case 'charge': {
        const spots = dist(target, p) === 1 ? [{ x: p.x, y: p.y }] : this.freeNear(target.x, target.y).filter((c) => los(this.map, p, c)).sort((a, b) => dist(a, p) - dist(b, p));
        if (!spots.length) { this.say(t('lNoTarget')); return false; }
        this.emit({ t: 'fx', k: 'charge', x: p.x, y: p.y, x1: spots[0].x, y1: spots[0].y });
        p.x = spots[0].x; p.y = spots[0].y;
        if (this.strike(p, target, { flat: 3, adv: true }) && target.hp > 0) { target.st.stun = 1; this.say(t('lStun', this.ename(target))); }
        break;
      }
      case 'firebolt': {
        this.emit({ t: 'shot', a: p.id, d: target.id, k: 'fire', x0: p.x, y0: p.y, x1: target.x, y1: target.y });
        const n = rint(3, 8) + p.lvl + st.power;
        const hit = (e, k) => {
          if (e.hp <= 0) return;
          this.strike(p, e, { sure: true, kind: 'spell', base: Math.round(n * k) });
          if (p.talents.A1 && e.hp > 0) { e.st.burn = 3; e.st.burnDmg = 2 + Math.floor(this.floor / 3); }
        };
        const around = p.talents.A3 ? this.enemies.filter((e) => e !== target && dist(e, target) === 1) : [];
        hit(target, 1);
        if (p.talents.A3) { this.emit({ t: 'fx', k: 'explode', x: target.x, y: target.y }); for (const e of around) hit(e, 0.5); }
        break;
      }
      case 'nova': {
        const list = this.enemies.filter((e) => dist(e, p) <= 2);
        if (!list.length) { this.say(t('lNoTarget')); return false; }
        this.emit({ t: 'fx', k: 'nova', x: p.x, y: p.y });
        for (const e of list) {
          this.strike(p, e, { sure: true, kind: 'spell', base: spell(3, 6) + Math.floor(p.lvl / 2) });
          if (e.hp > 0) { e.st.frozen = e.boss ? 1 : 2; this.say(t('lFrozen', this.ename(e))); }
        }
        break;
      }
      case 'blink':
        this.emit({ t: 'fx', k: 'blink', x: p.x, y: p.y, x1: target.x, y1: target.y });
        p.x = target.x; p.y = target.y;
        break;
      case 'shadowstep': {
        const spots = this.freeNear(target.x, target.y).sort((a, b) => dist(b, p) - dist(a, p));
        if (!spots.length) { this.say(t('lNoTarget')); return false; }
        this.emit({ t: 'fx', k: 'blink', x: p.x, y: p.y, x1: spots[0].x, y1: spots[0].y, shadow: true });
        p.x = spots[0].x; p.y = spots[0].y;
        this.strike(p, target, { adv: true, mult: 2 });
        break;
      }
      case 'venom':
        p.venom = 3; this.emit({ t: 'fx', k: 'venom', x: p.x, y: p.y });
        break;
      case 'smoke':
        p.st.invis = 4; this.say(t('lInvis'), 'good'); this.emit({ t: 'fx', k: 'smoke', x: p.x, y: p.y });
        for (const e of this.enemies) e.awake = false;
        break;
    }
    p.cds[id] = this.skillCd(id);
    this.usedSkill = id;
    this.emit({ t: 'skill', id });
    return true;
  }

  useItem(uid) {
    const p = this.player, i = p.bag.findIndex((x) => x.uid === uid);
    if (i < 0) return false;
    const it = p.bag[i];
    if (it.slot !== 'use') return false;
    const st = this.ps();
    if (it.kind === 'heal') {
      if (p.hp >= st.maxHp && !p.st.poison) return false;
      this.say(t('lDrink'));
      this.heal(Math.max(15, Math.round(st.maxHp / 2)));
      p.st.poison = 0;
      this.emit({ t: 'fx', k: 'potion', x: p.x, y: p.y });
    } else if (it.kind === 'fire') {
      const list = this.visibleEnemies();
      if (!list.length) { this.say(t('lNoTarget')); return false; }
      this.say(t('lScrollFire'), 'good');
      for (const e of list) {
        this.emit({ t: 'fx', k: 'explode', x: e.x, y: e.y });
        this.strike(p, e, { sure: true, kind: 'spell', base: rint(8, 14) + this.floor * 2 });
      }
    } else if (it.kind === 'teleport') {
      const c = pick(this.freeCells(0).filter((c) => dist(c, p) > 10));
      if (!c) return false;
      this.emit({ t: 'fx', k: 'blink', x: p.x, y: p.y, x1: c.x, y1: c.y });
      p.x = c.x; p.y = c.y; this.say(t('lScrollTp'), 'good');
    } else if (it.kind === 'map') {
      this.map.seen.fill(1); this.say(t('lScrollMap'), 'good');
      this.emit({ t: 'fx', k: 'map', x: p.x, y: p.y });
    }
    p.bag.splice(i, 1);
    return true;
  }

  quickPotion() { const it = this.player.bag.find((x) => x.kind === 'heal'); return it ? this.act({ type: 'use', uid: it.uid }) : false; }

  // equipping and dropping are free actions
  equip(uid) {
    const p = this.player, i = p.bag.findIndex((x) => x.uid === uid);
    if (i < 0 || p.bag[i].slot === 'use') return false;
    const it = p.bag[i], before = this.ps().maxHp;
    p.bag.splice(i, 1);
    if (p.equip[it.slot]) p.bag.push(p.equip[it.slot]);
    p.equip[it.slot] = it;
    const after = this.ps().maxHp;
    p.hp = clamp(p.hp + Math.max(0, after - before), 1, after);
    this.recompute();
    return true;
  }

  drop(uid) {
    const p = this.player, i = p.bag.findIndex((x) => x.uid === uid);
    if (i < 0) return false;
    this.items.push({ x: p.x, y: p.y, it: p.bag.splice(i, 1)[0] });
    return true;
  }

  // ---------- end of turn ----------
  endTurn() {
    const p = this.player, st = this.ps();
    for (const k of Object.keys(p.cds)) if (p.cds[k] > 0 && k !== this.usedSkill) p.cds[k]--;
    if (p.st.poison > 0) {
      p.st.poison--;
      const n = p.st.poisonDmg || 2;
      this.say(t('lPoison', n), 'bad');
      this.damage(p, n, false, 'poison');
    }
    for (const k of ['stun', 'web', 'invis']) if (p.st[k] > 0) p.st[k]--;
    if (st.regen && this.turn % 3 === 0) this.heal(st.regen, true);
    if (this.turn % 6 === 0 && !this.enemies.some((e) => e.awake)) this.heal(1, true);
    if (!this.over) this.enemyPhase();
    if (!this.over) this.hazardPhase();
    this.turn++;
    this.recompute();
  }

  enemyPhase() {
    const p = this.player, m = this.map;
    const dm = distanceMap(m, p.x, p.y);
    for (const e of [...this.enemies]) {
      if (e.hp <= 0 || this.over) continue;
      for (const [k, kd] of [['burn', 'burnDmg'], ['poison', 'poisonDmg']]) {
        if (e.st[k] > 0 && e.hp > 0) {
          e.st[k]--;
          this.emit({ t: 'dot', id: e.id, k });
          this.damage(e, e.st[kd] || 2, false, null);
        }
      }
      if (e.hp <= 0) continue;
      if (e.st.frozen > 0) { e.st.frozen--; continue; }
      if (e.st.stun > 0) { e.st.stun--; continue; }
      e.energy += ENEMIES[e.type].speed || 1;
      while (e.energy >= 1 && e.hp > 0 && !this.over) { e.energy--; this.enemyAct(e, dm); }
      if (e.st.fear > 0) e.st.fear--;
    }
  }

  enemyAct(e, dm) {
    const p = this.player, m = this.map, def = ENEMIES[e.type], d = dist(e, p);
    if (this.seesPlayer(e)) {
      e.seen = this.turn;
      if (!e.awake) {
        e.awake = true;
        if (e.boss && !e.cd.intro) { e.cd.intro = 1; e.cd.a = 2; e.cd.b = 3; e.cd.c = 4; this.emit({ t: 'boss', id: e.id }); return; }
      }
    } else if (e.awake && this.turn - e.seen > 12) e.awake = false;
    if (!e.awake || p.st.invis > 0) { if (chance(0.3)) this.wander(e); return; }
    if (e.st.fear > 0) { this.stepBy(e, dm, 1); return; }
    if (e.boss && this.bossAct(e, d)) return;
    if (def.ai === 'erratic' && chance(0.4)) { this.wander(e); return; }
    const reach = d === 1 && (e.x === p.x || e.y === p.y || (tile(m, e.x, p.y) !== WALL && tile(m, p.x, e.y) !== WALL));
    if (def.ai === 'ranged') {
      if (reach && !e.boss && chance(0.5) && this.stepBy(e, dm, 1)) return;
      if (d > 1 && d <= def.range && los(m, e, p)) { this.strike(e, p, { kind: def.shot }); return; }
    }
    if (reach) { this.strike(e, p); return; }
    this.stepBy(e, dm, -1);
  }

  // dir -1: toward the player, 1: away from the player
  stepBy(e, dm, dir) {
    const m = this.map, here = dm[e.y * m.w + e.x];
    if (here < 0) return this.wander(e);
    let best = null, bestV = here;
    for (const [dx, dy] of [...DIRS].sort(() => Math.random() - 0.5)) {
      const nx = e.x + dx, ny = e.y + dy, v = dm[ny * m.w + nx];
      if (v < 0 || this.blocked(nx, ny) || !canStep(m, e.x, e.y, dx, dy)) continue;
      if (dir < 0 ? v < bestV : v > bestV) { best = [nx, ny]; bestV = v; }
    }
    if (!best && dir < 0) { // stuck behind a friend: a sideways step keeps the crowd moving
      for (const [dx, dy] of [...DIRS].sort(() => Math.random() - 0.5)) {
        const nx = e.x + dx, ny = e.y + dy;
        if (dm[ny * m.w + nx] === here && !this.blocked(nx, ny) && canStep(m, e.x, e.y, dx, dy) && chance(0.5)) { best = [nx, ny]; break; }
      }
    }
    if (!best) return false;
    [e.x, e.y] = best;
    return true;
  }

  wander(e) {
    const [dx, dy] = pick(DIRS);
    if (!this.blocked(e.x + dx, e.y + dy) && canStep(this.map, e.x, e.y, dx, dy)) { e.x += dx; e.y += dy; return true; }
    return false;
  }

  telegraph(cells, dmg, kind) {
    const m = this.map;
    for (const c of cells) if (inside(m, c.x, c.y) && tile(m, c.x, c.y) !== WALL) this.hazards.push({ x: c.x, y: c.y, at: this.turn + 1, dmg, kind });
    this.say(t('lTelegraph'), 'bad');
  }

  summon(e, type, n, max) {
    if (this.enemies.filter((x) => x.type === type).length >= max) return false;
    const spots = this.freeNear(e.x, e.y, 2).sort(() => Math.random() - 0.5).slice(0, n);
    if (!spots.length) return false;
    for (const c of spots) { const s = this.spawn(type, c.x, c.y, false, 1); s.awake = true; s.seen = this.turn; this.emit({ t: 'fx', k: 'summon', x: c.x, y: c.y }); }
    this.say(t('lSummon', this.ename(e)), 'bad');
    return true;
  }

  // boss specials on cooldowns a, b, c. Returns true when the boss used its turn.
  bossAct(e, d) {
    const p = this.player, m = this.map, half = e.hp < e.maxHp / 2, f = this.floor;
    for (const k of ['a', 'b', 'c']) if (e.cd[k] > 0) e.cd[k]--;
    const around = (r) => { const out = []; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) out.push({ x: p.x + x, y: p.y + y }); return out; };
    if (e.type === 'boneKing') {
      if (e.cd.a <= 0 && this.summon(e, 'skeleton', 2, 4)) { e.cd.a = 7; return true; }
      if (e.cd.b <= 0 && d <= 6) {
        this.telegraph([{ x: p.x, y: p.y }, ...DIRS.slice(0, 4).map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))], rint(6, 10) + f, 'bone');
        e.cd.b = half ? 3 : 4; return true;
      }
      if (half) e.dmg = [6, 12];
    } else if (e.type === 'broodmother') {
      if (e.cd.a <= 0 && this.summon(e, 'spiderling', 2, 4)) { e.cd.a = 6; return true; }
      if (e.cd.b <= 0 && d > 1 && d <= 7 && los(m, e, p)) {
        this.emit({ t: 'shot', a: e.id, d: p.id, k: 'web', x0: e.x, y0: e.y, x1: p.x, y1: p.y });
        p.st.web = 2; this.say(t('lWebbed'), 'bad'); this.damage(p, 3, false, e);
        e.cd.b = 4; return true;
      }
      if (half && e.cd.c <= 0) {
        this.telegraph(around(2).filter(() => chance(0.4)).concat([{ x: p.x, y: p.y }]), rint(7, 12), 'acid');
        e.cd.c = 5; return true;
      }
    } else if (e.type === 'lich') {
      if (d <= 1 && e.cd.c <= 0) {
        const spots = this.freeCells(0).filter((c) => this.vis[c.y * m.w + c.x] && dist(c, p) >= 4 && dist(c, p) <= 7);
        if (spots.length) {
          const c = pick(spots);
          this.emit({ t: 'fx', k: 'blink', x: e.x, y: e.y, x1: c.x, y1: c.y });
          e.x = c.x; e.y = c.y; e.cd.c = 6; return true;
        }
      }
      if (e.cd.b <= 0 && d <= 8) {
        this.telegraph(around(1).concat(half ? around(2).filter(() => chance(0.25)) : []), rint(10, 16), 'fire');
        e.cd.b = half ? 3 : 5; return true;
      }
      if (e.cd.a <= 0 && this.summon(e, half ? 'wraith' : 'skeleton', 2, 3)) { e.cd.a = 9; return true; }
    }
    return false;
  }

  hazardPhase() {
    const p = this.player;
    const now = this.hazards.filter((h) => h.at <= this.turn);
    this.hazards = this.hazards.filter((h) => h.at > this.turn);
    const hitP = now.find((h) => h.x === p.x && h.y === p.y);
    for (const h of now) this.emit({ t: 'fx', k: 'blast', x: h.x, y: h.y, kind: h.kind });
    if (now.length) this.emit({ t: 'shake', p: 5 });
    if (hitP) this.damage(p, hitP.dmg, false, this.enemies.find((e) => e.boss) || null);
  }

  // ---------- end of run ----------
  score() {
    const s = this.stats, win = this.over === 'win';
    return this.floor * 1000 + s.kills * 15 + s.gold + s.bosses.length * 2500 + this.player.lvl * 100 + (win ? 10000 : 0);
  }
  embers() {
    const s = this.stats;
    return this.floor * 12 + s.kills + s.bosses.length * 60 + Math.floor(s.gold / 8) + (this.over === 'win' ? 200 : 0);
  }
  bestItem() {
    const p = this.player;
    return [...Object.values(p.equip), ...p.bag].filter(Boolean).sort((a, b) => itemScore(b) - itemScore(a))[0] || null;
  }
}

export { RELICS };
