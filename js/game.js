// The rules: turns, d20 combat, skills, talents, enemies and bosses, loot, floors. No DOM: the UI reads `ev` (events) and `log`.
import { ACT_LEN, ACTS, actOf, actIndex, actStart, isBossFloor, isLastBoss, FLOORS, CLASSES, SKILLS, TALENTS, ENEMIES, BASES, TIER_ADJ, RARITIES, LEGENDARY_NAMES, MODS, CONSUMABLES, RELICS, xpNext } from './data.js';
import { generate, fov, los, distanceMap, walkable, canStep, tile, dist, DIRS, WALL, inside } from './dungeon.js';
import { t, L, lang } from './i18n.js';

const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const chance = (p) => Math.random() < p;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export { xpNext };
const BAG = 16;

// the stat names a talent may raise (see talentBonus and ps), and the rules a talent may turn on
export const STAT_KEYS = new Set(['hp', 'ac', 'power', 'hit', 'crit', 'regen', 'sight', 'gold', 'spell', 'pool', 'manaRegen', 'melee', 'ranged', 'trap', 'shieldMax', 'petPower', 'heal', 'steal']);
// every flag a talent can raise, listed once here so a typo in data.js fails the tests instead of doing nothing
export const FLAGS = new Set(('unbreakable lastStand rage concussion trance bloodlust executioner whirlwind shieldwall rampage bloodtrail vanguard ' +
  'unstoppable secondwind packbond lucky kindling pyromancy inferno searing kindled combustion pyre miracle shatter deepfreeze icewall wintergrasp ' +
  'abszero ward mastery mirror timewarp manasurge siphon barrier ambush assassin ghost shadowsummon toxicity virulence twinfangs plaguebearer ' +
  'creepingrot vanish traps bleeding consecrated zeal wrath judgement purgingfire retribution shelter guardian vigil shieldoffaith sacredvow martyr ' +
  'aura shatterblow earthshaker frenzy bloodbond marksman rapidfire piercing poisontrap camouflage pittrap').split(' '));

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

// the numbers of an item, so two items can be put side by side: what goes up and what goes down.
// The order is the order a player thinks in: damage, armour, HP, then the rest.
const STAT_ORDER = ['power', 'ac', 'hp', 'hit', 'crit', 'regen', 'steal', 'gold', 'light', 'pool', 'manaRegen', 'thorns', 'dodge', 'xp'];
export function itemStats(it) {
  const out = {};
  if (!it || it.slot === 'use' || it.kind === 'gold') return out;
  if (it.power) out.power = it.power;
  if (it.ac) out.ac = it.ac;
  for (const [k, v] of Object.entries(it.mods || {})) out[k] = (out[k] || 0) + v;
  return out;
}
// [{ key, mine, theirs, d }] in a fixed order, only the keys either item has
export function itemCompare(mine, theirs) {
  const a = itemStats(mine), b = itemStats(theirs);
  return STAT_ORDER.filter((k) => a[k] != null || b[k] != null)
    .map((k) => ({ key: k, mine: a[k] || 0, theirs: b[k] || 0, d: (a[k] || 0) - (b[k] || 0) }));
}
export const statLabel = (k, v) => (MODS[k] ? MODS[k][lang].replace('{0}', v) : `${k} ${v}`);
export const statShort = (k) => ({ power: 'sword', ac: 'shield', hp: 'heart', hit: 'target', crit: 'sparkles', regen: 'heart-pulse', steal: 'droplet', gold: 'coins', light: 'flame', pool: 'droplet', manaRegen: 'waves', thorns: 'shield-exclamation-point', dodge: 'wind', xp: 'sparkles' }[k] || 'circle');

export const SPEC_MAX = 2;   // specialisations: one at the start, the second from level 10
export const SPEC_LVL = 10;  // the level the second one unlocks at

export class Game {
  constructor(data) {
    Object.assign(this, data);
    if (!this.player.spec) this.player.spec = [];   // a save from before specialisations
    this.ev = [];
    if (this.map && !(this.map.t instanceof Uint8Array)) { // restored from a save
      const s = this.map.packed; delete this.map.packed;
      this.map.t = Uint8Array.from(s, (c) => c.charCodeAt(0) & 3);
      this.map.seen = Uint8Array.from(s, (c) => (c.charCodeAt(0) >> 2) & 1);
    }
    if (this.pet) { this.pet = this.enemies.find((e) => e.ally) || 0; this.tunePet(); }
    if (this.map) { this.vis = new Uint8Array(this.map.w * this.map.h); this.recompute(); }
  }

  // a fresh run. meta: sanctuary state (upgrades fixed for the whole run)
  static create({ cls, name, relic = null, relicLvl = 1, heirloom = null, meta = {} }) {
    const up = (id) => meta.upgrades?.[id] || 0;
    const player = {
      id: 1, kind: 'player', cls, name, x: 0, y: 0, hp: 1, mp: 0, xp: 0, lvl: 1, points: 1 + up('insight') + (relic === 'seal' ? Math.ceil(clamp(relicLvl || 1, 1, 5) / 2) : 0), talents: {}, cds: {}, st: {},
      equip: { weapon: null, armor: null, trinket: null }, bag: [], gold: 0, flags: {}, venom: 0, pet: 0, spec: [],
    };
    const g = new Game({
      floor: 0, turn: 0, uid: 2, player, enemies: [], items: [], chests: [], hazards: [], fountain: null, merchant: null, stairsOpen: true, log: [], over: null, killer: null,
      relic, relicLvl: clamp(relicLvl || 1, 1, 5), up: { ...(meta.upgrades || {}) },
      // the sanctuary's bonuses, read once at the start of the run (up() is still there for the rest)
      bonus: {
        hp: up('vigor') * 5, power: up('edge'), ac: up('guard'), gold: up('fortune') * 0.2, light: up('torch'),
        hit: up('aim'), crit: up('crit'), dodge: up('dodge') * 4, thorns: up('thorns') * 2, regen: up('regen'), leech: up('leech'),
        evade: up('evade'), bulwark: up('bulwark') * 6, mercy: up('mercy') * 2, pool: up('pool') * 4, manaRegen: up('flow'),
        spell: up('spellpower') * 0.06, manafloor: up('manafloor') * 3, cheap: up('cheap') * 0.06, potency: up('potency') * 0.15,
        forage: up('forage'), luck: up('luck') * 6, pockets: up('pockets') * 4, scavenger: up('scavenger') * 0.1,
        keepsake: up('keepsake') * 0.15, anvil: up('anvil'), greed: up('greed') * 0.08, haggle: up('haggle') * 0.08,
        xp: up('xp') * 0.12, lantern: up('lantern') * 2, map: up('map') * 0.25, stairs: up('stairs') * 4, sprint: up('sprint'),
        stealth: up('stealth') * 2, swift: up('swift'), focus: up('focus'), pierce: up('pierce'), bleed: up('bleed'),
        vendetta: up('vendetta') * 0.1, vendettaFloor: meta.history?.[0]?.floor || 0, executioner: up('executioner') * 0.08, firstblood: up('firstblood') * 2, companion: up('companion') * 0.2,
        sanctuary: up('sanctuary') * 0.04, fountain: up('fountain') * 0.2, ward: up('ward') * 5, resist: up('resist'),
        critpower: up('critpower') * 0.2,
      },
      stats: { kills: 0, gold: 0, bosses: [] }, map: null,
    });
    player.equip.weapon = g.makeEquip('weapon', 1, 0, true);
    if (g.bonus.anvil) { player.equip.weapon.power += g.bonus.anvil; player.equip.weapon.tier = Math.min(5, player.equip.weapon.tier + g.bonus.anvil); }
    g.give(g.makeUse('heal', 1 + up('satchel')));
    if (heirloom) {
      const it = { ...heirloom, uid: g.uid++ };
      if (g.bonus.keepsake > 0) { it.power = Math.round((it.power || 0) * (1 + g.bonus.keepsake)); it.ac = Math.round((it.ac || 0) * (1 + g.bonus.keepsake)); }
      const c = CLASSES[cls];
      if (it.slot === 'weapon' && !c.weapons.includes(it.base)) it.base = c.weapons[0];
      if (it.slot === 'armor') it.base = c.armor;
      if (player.equip[it.slot]) player.bag.push(player.equip[it.slot]);
      player.equip[it.slot] = it;
    }
    g.newFloor(1);
    player.hp = g.ps().maxHp; player.mp = g.manaPool();
    if (CLASSES[cls].skills.includes('beast')) { const spot = g.freeNear(player.x, player.y, 2)[0]; if (spot) g.summonWolf(spot); }
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
  // the rules the hero's talents turned on: a Set of effect names built from the 'flag:' effects of the
  // nodes he bought, plus anything the class grants from the start
  flags() {
    const T = this.player.talents, out = new Set();
    for (const br of TALENTS[this.player.cls] || []) for (const n of br) {
      if (!T[n.id]) continue;
      for (const k of Object.keys(n.eff || {})) if (k.startsWith('flag:')) out.add(k.slice(5));
    }
    return out;
  }

  has(effect) { return this.flags().has(effect); }

  // xp needed for the next level, at the pace of the act the hero is in
  xpToNext(lvl = this.player.lvl) { return xpNext(lvl, actIndex(this.floor || 1)); }

  // the d20 roll a hero crits on: the sheet's number, one lower every five levels (a level 15 warrior crits on 17+)
  critChance() { return clamp(this.ps().crit - Math.floor(this.player.lvl / 5), 8, 20); }

  ps() {
    const p = this.player, c = CLASSES[p.cls], b = this.bonus, F = this.flags(), tb = this.talentBonus().stat, near = (this.enemies || []).filter((e) => dist(e, p) === 1);
    const m = { hp: 0, hit: 0, power: 0, ac: 0, crit: 0, regen: 0, steal: 0, gold: 0, light: 0 };
    for (const it of Object.values(p.equip)) if (it) {
      m.power += it.power || 0; m.ac += it.ac || 0;
      for (const [k, v] of Object.entries(it.mods || {})) m[k] += v;
    }
    return {
      maxHp: Math.round((c.hp + (p.lvl - 1) * c.hpLvl + b.hp + m.hp + (tb.hp || 0) + (this.relic === 'heart' ? 8 * this.rl() : 0)) * (this.relic === 'key' ? 1 + 0.1 * this.rl() : 1)),
      ac: c.ac + b.ac + m.ac + (tb.ac || 0) + (p.st.stoneskin > 0 ? 4 : 0) + (F.has('vigil') && !(this.enemies || []).some((e) => e.ally && dist(e, p) <= 1) ? 2 : 0) + (this.relic === 'scale' ? 2 * this.rl() : 0) + (F.has('shieldwall') && near.length > 1 ? 2 : 0) + (F.has('aura') ? this.enemies.filter((e) => e.ally && dist(e, p) === 1).length : 0)
        + (near.length >= 3 ? (b.bulwark || 0) : 0) + (p.hp < (c.hp + (p.lvl - 1) * c.hpLvl + b.hp) * 0.25 ? (b.mercy || 0) : 0),
      hit: c.hit + Math.floor(p.lvl / 2) + m.hit + (tb.hit || 0) + (b.hit || 0),
      power: b.power + m.power + Math.floor((p.lvl - 1) / 3) + (tb.power || 0) + (F.has('rampage') ? Math.min(8, this.stats.kills - (this.floorKills || 0)) : 0),
      crit: c.crit - Math.min(2, m.crit) - (F.has('lucky') ? 1 : 0) - (tb.crit ? 20 - tb.crit : 0) - (b.crit || 0),
      regenRelic: this.relic === 'heart' && this.rl() >= 4 ? 1 : 0,
      dmg: c.dmg, regen: m.regen + (tb.regen || 0) + (b.regen || 0), steal: m.steal + (tb.steal || 0) + (b.leech || 0),
      gold: 1 + b.gold + m.gold / 100 + (tb.gold || 0) / 100 + (F.has('lucky') ? 0.25 : 0) + (this.relic === 'coin' ? 0.2 * this.rl() : 0) + (this.relic === 'sigil' ? 0.12 * this.rl() : 0),
      light: 7 + b.light + m.light + (tb.sight || 0) + (this.relic === 'lantern' ? this.rl() : 0),
      melee: 1 + (tb.melee || 0) / 100, spell: 1 + (tb.spell || 0) / 100 + (b.spell || 0), heal: 1 + (tb.heal || 0) / 100,
      // arrows and spells cast at range, and the traps that wait on the floor
      ranged: 1 + (tb.ranged || 0) / 100, trap: 1 + (tb.trap || 0) / 100,
      shieldMax: 1 + (tb.shieldMax || 0) / 100, petPower: 1 + (tb.petPower || 0) / 100 + (b.companion || 0),
      dodge: b.dodge || 0, thorns: b.thorns || 0, pierce: b.pierce || 0, bleed: b.bleed || 0,
      executioner: b.executioner || 0, firstblood: b.firstblood || 0, critpower: b.critpower || 0,
      resist: b.resist || 0, evade: b.evade || 0, potency: b.potency || 0,
    };
  }

  // every skill the hero knows: the first of the class always, the others when a talent node grants them
  skills() {
    const p = this.player, out = [CLASSES[p.cls].skills[0]], nodes = TALENTS[p.cls].flat();
    for (const [id, lvl] of Object.entries(p.talents || {})) {
      if (!lvl) continue;
      for (const k of Object.keys(nodes.find((x) => x.id === id)?.eff || {})) {
        const sk = k.slice(6);
        if (k.startsWith('skill:') && !out.includes(sk)) out.push(sk);
      }
    }
    return out;
  }

  // what the talent nodes add up to: flat stats, percentages and the flags the rules read
  talentBonus() {
    const p = this.player, out = { stat: {}, flag: new Set() };
    const nodes = TALENTS[p.cls].flat();
    for (const [id, lvl] of Object.entries(p.talents || {})) {
      if (!lvl) continue;
      const n = nodes.find((x) => x.id === id);
      for (const [k, v] of Object.entries(n?.eff || {})) {
        if (k.startsWith('flag:')) out.flag.add(k.slice(5));
        // "crit on N+" is a threshold, not a bonus: two of them keep the better one
        else if (k === 'crit') out.stat.crit = Math.min(out.stat.crit ?? 20, v);
        else if (!k.startsWith('skill:')) out.stat[k] = (out.stat[k] || 0) + v;
      }
    }
    return out;
  }

  // mana is the budget of the turn: a skill costs its price, and a few points come back every turn,
  // so a spell cannot be spammed and has to be chosen. The pool grows with the level and the talents.
  // the level of the relic in hand (1..5), 0 when you carry none
  rl() { return this.relic ? (this.relicLvl || 1) : 0; }

  manaPool() {
    const p = this.player, c = CLASSES[p.cls], tb = this.talentBonus().stat;
    return Math.round(c.pool + (p.lvl - 1) * c.poolLvl + (tb.pool || 0) + (this.bonus.pool || 0) + (this.relic === 'hourglass' ? 2 * this.rl() : 0));
  }
  manaRegen() {
    const p = this.player, c = CLASSES[p.cls], tb = this.talentBonus().stat;
    return Math.max(1, c.regen + Math.floor(p.lvl / 5) + (tb.manaRegen || 0) + (this.bonus.manaRegen || 0));
  }
  // what a skill costs right now, after the talents that make one cheaper
  skillCost(id) {
    const F = this.flags(), base = SKILLS[id].mana ?? SKILLS[id].cd;
    let cost = base;
    if (F.has('trance')) cost -= 1;
    if (id === 'firebolt' && F.has('pyromancy')) cost -= 1;
    if (id === 'whirlwind' && F.has('whirlwind')) cost -= 2;
    if (F.has('timewarp') && this.turn % 3 === 0) cost = 0;
    // Frugal Casting: everything costs a little less; Concentration: the first skill of a floor is free
    if (this.bonus.cheap) cost = Math.round(cost * (1 - this.bonus.cheap));
    if (this.player.flags.freeCast) cost = 0;
    return Math.max(0, cost);
  }
  canCast(id) { return this.skills().includes(id) && this.player.mp >= this.skillCost(id) && (this.player.cds[id] || 0) === 0; }
  // the mana a skill actually takes: canCast and useSkill both read it, so a free cast stays free
  spend(id) {
    const p = this.player, cost = this.skillCost(id);
    if (p.flags.freeCast > 0) p.flags.freeCast--;
    p.mp -= cost;
  }

  // ---------- helpers ----------
  say(s, c = '') { this.log.push({ s, c }); if (this.log.length > 80) this.log.shift(); }
  emit(e) { this.ev.push(e); }
  enemyAt(x, y) { return this.enemies.find((e) => e.x === x && e.y === y); }
  chestAt(x, y) { return this.chests.find((c) => c.x === x && c.y === y && !c.open); }
  blocked(x, y) { return !walkable(this.map, x, y) || this.enemyAt(x, y) || (this.player.x === x && this.player.y === y) || this.chestAt(x, y); }
  isEnemy(e) { return !e.ally; }
  // Soft Step: the enemies notice the hero only up close
  seesPlayer(e) {
    if (this.player.st.invis > 0) return false;
    const soft = this.bonus?.stealth || 0;
    if (!this.vis[e.y * this.map.w + e.x]) return false;
    const hide = soft + (this.has('camouflage') ? 1 : 0);
    return hide ? dist(e, this.player) <= Math.max(1, this.ps().light - hide) : true;
  }
  visibleEnemies() { return this.enemies.filter((e) => this.vis[e.y * this.map.w + e.x]); }
  // a dying hero's killer is sometimes a string ('poison', 'burn'), not an enemy
  ename(e) { return typeof e === 'string' ? e : e?.ally ? t('lPetName') : L(ENEMIES[e.type].name); }
  onStairs() { const s = this.map.stairs; return this.stairsOpen && this.player.x === s.x && this.player.y === s.y; }

  recompute() {
    const p = this.player, m = this.map;
    fov(m, p.x, p.y, this.ps().light, this.vis);
    for (let i = 0; i < this.vis.length; i++) if (this.vis[i]) m.seen[i] = 1;
    if (this.bonus?.stairs && m.stairs && dist(m.stairs, p) <= this.ps().light + this.bonus.stairs) m.seen[m.stairs.y * m.w + m.stairs.x] = 1;
    // the Eternal Lantern lights up every enemy at level 3
    if (this.relic === 'lantern' && this.rl() >= 3) for (const e of this.enemies) if (!e.ally) this.vis[e.y * m.w + e.x] = 1;
    // Lantern Oil: enemies show through the walls, a little further with every level
    const oil = this.bonus?.lantern || 0;
    if (oil) for (const e of this.enemies) if (!e.ally && Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= oil) this.vis[e.y * m.w + e.x] = 1;
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
    const luck = this.bonus?.luck || 0;
    const w = RARITIES.map((r, i) => r.weight + (i === 3 ? this.floor * 0.6 + luck * 1.5 : i === 2 ? this.floor + luck : 0));
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
    if (slot === 'weapon') { it.base = pick(c.weapons); it.power = Math.ceil(tier * 1.8); pool = ['hit', 'power', 'crit', 'steal']; }
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

  makeUse(kind, n = 1) { return { uid: this.uid++, slot: 'use', kind, n }; }
  // two of the same potion are one stack: consumables of a kind pile up to 9, gear never piles
  give(it) {
    const p = this.player;
    if (it.slot === 'use') {
      // the first stack of the same potion that has room: nine is the most that piles up
      const same = p.bag.find((x) => x.slot === 'use' && x.kind === it.kind && (x.n || 1) < 9);
      if (same) {
        const room = 9 - (same.n || 1), moved = Math.min(room, it.n || 1);
        same.n = (same.n || 1) + moved;
        if (moved < (it.n || 1)) {
          const rest = { ...it, uid: this.uid++, n: (it.n || 1) - moved };
          if (!this.give(rest) && this.map) this.items.push({ x: p.x, y: p.y, it: rest });
        }
        return same;
      }
    }
    if (p.bag.length >= this.bagSize()) return null;
    p.bag.push(it);
    return it;
  }
  // how many free places the bag has, counting a stack as one
  bagFree() { return BAG + (this.bonus?.pockets || 0) - this.player.bag.length; }
  bagSize() { return BAG + (this.bonus?.pockets || 0); }

  randomLoot(rarityMin = 0) {
    const r = Math.random();
    if (r < 0.16) return this.makeUse('heal', rint(1, 2));
    if (r < 0.3) return this.makeUse(pick(['fire', 'frost', 'lightning', 'teleport', 'map', 'identify', 'ward', 'rage', 'stoneskin', 'mana', 'antidote', 'smoke', 'food', 'greatHeal']));
    return this.makeEquip(pick(['weapon', 'armor', 'armor', 'trinket']), 0, rarityMin);
  }

  // into the bag (a stack grows), or on the floor when there is no room left
  take(it, x, y) {
    const p = this.player;
    if (it.kind === 'gold') {
      const n = Math.round(it.n * this.ps().gold * (1 + (this.bonus?.scavenger || 0)));
      p.gold += n; this.stats.gold += n;
      this.say(t('lGold', n), 'gold'); this.emit({ t: 'fx', k: 'gold', x, y, n });
      return true;
    }
    const same = it.slot === 'use' && p.bag.find((x) => x.slot === 'use' && x.kind === it.kind && (x.n || 1) < 9);
    if (!same && p.bag.length >= this.bagSize()) { this.items.push({ x, y, it }); this.say(t('lFull', itemName(it))); return false; }
    const stacked = this.give(it);
    this.say(t('lPick', itemName(it)), 'loot');
    // the pickup animation carries the stack, so two potions read as "×2" instead of one more of something
    this.emit({ t: 'fx', k: 'pickup', x, y, it: stacked || it });
    return true;
  }

  // ---------- floors ----------
  newFloor(n) {
    this.floor = n;
    const m = generate(n);
    this.map = m;
    this.vis = new Uint8Array(m.w * m.h);
    const wolves = (this.enemies || []).filter((e) => e.ally && e.hp > 0);
    this.enemies = []; this.items = []; this.chests = []; this.hazards = []; this.fountain = null; this.merchant = null;
    const p = this.player;
    p.x = m.start.x; p.y = m.start.y;
    for (const w of wolves) { const c = this.freeNear(p.x, p.y, 2)[0]; if (c) { w.x = c.x; w.y = c.y; this.enemies.push(w); } }
    p.flags.unbreakable = false; p.flags.secondWind = false; p.flags.guardian = false; p.flags.mirror = false; p.flags.vanguard = false;
    p.flags.sprintUsed = 0;
    // the sanctuary: mana back at the start of a floor, HP healed, a shield, the first skill free
    const bo = this.bonus;
    p.mp = Math.min(this.manaPool(), p.mp + (bo.manafloor || 0));
    p.st.shield = (p.st.shield || 0) + (bo.ward || 0);
    p.flags.freeCast = bo.focus || 0;
    if (bo.sanctuary) this.heal(Math.round(this.ps().maxHp * bo.sanctuary), true);
    if (bo.forage) for (let i = 0; i < bo.forage; i++) this.give(this.makeUse(chance(0.7) ? 'heal' : 'mana'));
    if (bo.map) for (let i = 0; i < m.seen.length; i++) if (chance(bo.map)) m.seen[i] = 1;
    this.floorKills = this.stats.kills;
    const act = actOf(n), boss = isBossFloor(n);
    this.stairsOpen = !boss;
    const within = n - actStart(n); // 0..ACT_LEN-1 inside the act
    if (this.relic === 'brand') p.st.shield = Math.round(10 * this.rl() * this.ps().shieldMax);
    if (this.relic === 'hourglass') p.mp = Math.min(this.manaPool(), p.mp + 6 * this.rl());
    if (this.relic === 'totem' && !this.pets().length) { const spot = this.freeNear(p.x, p.y, 2)[0]; if (spot) this.summonWolf(spot); }
    if (this.has('barrier')) p.st.shield = (p.st.shield || 0) + Math.round(10 * this.ps().shieldMax);
    if (this.has('consecrated')) this.heal(10, true);
    if (this.pets().length) this.tunePet();
    if (boss) this.spawn(act.boss, m.stairs.x, m.stairs.y, false, within);
    let count = Math.round((7 + n + rint(0, 2)) * (boss ? 0.7 : 1));
    const cells = this.freeCells(8).sort(() => Math.random() - 0.5);
    const pool = act.pool.filter((k) => (ENEMIES[k].minFloor || 0) <= n);
    while (count > 0 && cells.length) {
      const c = cells.pop(), type = pick(pool), d = ENEMIES[type];
      if (boss && dist(c, m.stairs) < 7) continue;
      const elite = chance(0.06 + n * 0.008);
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
    if (!potions && n % 2 && free.length) this.items.push({ ...take(), it: this.makeUse('heal', 1 + rint(0, 2)) });
    for (let i = 0, k = 3 + rint(0, 2); i < k && free.length; i++) this.items.push({ ...take(), it: { kind: 'gold', n: rint(4, 9) * n } });
    for (let i = 0, k = rint(1, 2); i < k && free.length; i++) {
      const c = take();
      if (walkable(m, c.x, c.y)) this.chests.push({ ...c, open: false });
    }
    if (chance(0.45) && free.length) this.fountain = { ...take(), used: false };
    // a merchant shows up on a floor of his own from the second act on, never on a boss floor
    this.merchant = null;
    if (!boss && n >= 2 && chance(0.3) && free.length) this.merchant = { ...take(), stock: this.merchantStock(n) };
    delete m.dist;
    this.recompute();
    this.say(t('lWelcome', n), 'sys');
    this.emit({ t: 'floor', n });
  }

  merchantStock(n) {
    const stock = [];
    const uses = ['heal', 'heal', 'greatHeal', 'mana', 'food', 'antidote', 'smoke', 'ward', 'rage', 'stoneskin', 'fire', 'frost', 'lightning', 'teleport', 'map', 'identify'];
    for (let i = 0; i < 4; i++) {
      const kind = pick(uses), it = this.makeUse(kind, kind === 'heal' ? 2 : 1);
      stock.push({ it, price: Math.round(this.priceOf(it) * (1 - this.discount())), sold: false });
    }
    for (let i = 0; i < 3; i++) {
      const it = this.makeEquip(pick(['weapon', 'armor', 'trinket']), 1, 1); // one tier above the floor, like a boss drop
      stock.push({ it, price: Math.round(this.priceOf(it) * (1 - this.discount())), sold: false });
    }
    return stock;
  }

  // what a merchant pays for something, and asks for it: gear keeps its value, potions are cheap
  priceOf(it) {
    if (it.slot === 'use') return it.kind === 'greatHeal' ? 22 : 10 + this.floor * 2;
    return Math.round((itemScore(it) + 3) * (2.2 + this.floor * 0.5));
  }
  sellPrice(it) { return Math.max(3, Math.round(this.priceOf(it) * 0.4 * (1 + (this.bonus?.greed || 0)))) * (it.slot === 'use' ? it.n || 1 : 1); }
  // the Miser's Coin makes everything in a shop cheaper
  discount() { return (this.relic === 'coin' ? 0.05 * this.rl() : 0) + (this.bonus?.haggle || 0); }
  // the merchant's stock, with what he pays for everything in the bag
  shop() {
    const p = this.player;
    return {
      stock: (this.merchant?.stock || []).map((x, i) => ({ ...x, i, can: p.gold >= x.price })),
      sell: p.bag.map((it) => ({ it, price: this.sellPrice(it) })),
    };
  }
  buy(i) {
    const p = this.player, x = this.merchant?.stock[i];
    if (!x || x.sold) return false;
    if (p.gold < x.price) { this.say(t('lNoGold'), 'bad'); return false; }
    if (x.it.slot === 'use') {
      const same = p.bag.find((b) => b.slot === 'use' && b.kind === x.it.kind && (b.n || 1) + (x.it.n || 1) <= 9);
      if (!same && p.bag.length >= this.bagSize()) { this.say(t('lFull', itemName(x.it))); return false; }
    } else if (p.bag.length >= this.bagSize()) { this.say(t('lFull', itemName(x.it))); return false; }
    p.gold -= x.price; x.sold = true;
    this.give(x.it);
    this.say(t('lBought', itemName(x.it)), 'gold');
    this.emit({ t: 'buy', i });
    return true;
  }
  sell(uid) {
    const p = this.player, i = p.bag.findIndex((x) => x.uid === uid);
    if (i < 0) return false;
    const it = p.bag[i], price = this.sellPrice(it);
    p.bag.splice(i, 1); p.gold += price; this.stats.gold += price;
    this.say(t('lSold', itemName(it), price), 'gold');
    this.emit({ t: 'sell', uid });
    return true;
  }

  spawn(type, x, y, elite = false, within = 0) {
    // the game is meant to be hard: every floor is about half again as strong as the one before it.
    // inside an act that is 1.45 a floor, from one act to the next the boss floor of the act before carries over.
    const d = ENEMIES[type], n = Math.max(1, this.floor), act = actIndex(n);
    const k = Math.pow(1.45, n - 1);
    // damage climbs more slowly than HP: an enemy that hits for half the hero's HP a blow kills without a fight
    const dmgK = Math.pow(1.4, n - 1);
    const hp = Math.round(d.hp * k);
    // a boss pays like an elite of his floor, scaled by the floor: the hero has to come out of it at the right level
    // xp goes by the act, not by the floor: with the floor's own growth a hero who survives two acts is
    // level forty and never has to choose anything again
    const actK = Math.pow(1.45, act * ACT_LEN);
    const xp = d.boss ? Math.round(d.xp * 0.5 * actK) : Math.round(d.xp * actK * (elite ? 2 : 1));
    // a boss climbs less than his floor: the whole act has already made him twice the man the last one was,
    // and the hero cannot be expected to outgrow the crypt on his first run.
    // A boss hits for about a third of the hero's HP: the d20 roll decides the fight, not the first two blows.
    // his HP grows with the act, not with the floor of the act: a boss is a wall, not a mountain
    const actStartHp = Math.pow(1.45, act * ACT_LEN);
    const hpB = d.boss ? Math.round(d.hp * actStartHp * (1 + 0.1 * (n - 1 - act * ACT_LEN))) : Math.round(hp * (elite ? 1.6 : 1));
    const bossDmg = Math.max(4, Math.round((4 + n * 1.6) * (1 + 0.08 * act)));
    const dmgB = [Math.round(bossDmg * 0.75), Math.round(bossDmg * 1.15)];
    // armour grows with the act, not with the floor: a d20 roll beats one point of armour one time in twenty,
    // so armour that climbs every floor turns the game into a wall the hero cannot climb
    const acB = d.boss ? d.ac + act : d.ac + Math.floor(act / 2);
    const e = {
      id: this.uid++, kind: 'enemy', type, x, y, hp: hpB, maxHp: hpB, ac: acB + (elite ? 1 : 0), hit: d.hit + Math.floor(act * 0.5) + (within >= 2 ? 1 : 0) + (elite ? 1 : 0),
      dmg: d.boss ? dmgB : [Math.round(d.dmg[0] * dmgK) + (elite ? 1 : 0), Math.round(d.dmg[1] * dmgK) + (elite ? 2 : 0)], xp, turn: 0,
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
    if (this.has('unstoppable')) { p.st.stun = 0; p.st.web = 0; }
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
    if (done && !this.over) {
      // Sprinter: the first step on a floor is free, once per level
      if (a.type === 'move' && (p.flags.sprintUsed || 0) < (this.bonus?.sprint || 0)) {
        p.flags.sprintUsed = (p.flags.sprintUsed || 0) + 1;
        this.recompute();
        return true;
      }
      this.endTurn();
    }
    return done;
  }

  tryMove(dx, dy) {
    const p = this.player, m = this.map, nx = p.x + dx, ny = p.y + dy;
    const e = this.enemyAt(nx, ny);
    const diagOk = !dx || !dy || (tile(m, p.x + dx, p.y) !== WALL && tile(m, p.x, p.y + dy) !== WALL);
    // the wolf steps aside: walking into it swaps places instead of biting your own dog
    if (e && e.ally && canStep(m, p.x, p.y, dx, dy) && !(p.st.web > 0)) { e.x = p.x; e.y = p.y; }
    else if (e) { if (e.ally || !diagOk) return false; this.strike(p, e); return true; }
    const chest = this.chestAt(nx, ny);
    if (chest) {
      chest.open = true;
      this.say(t('lChest'), 'loot');
      this.emit({ t: 'fx', k: 'chest', x: nx, y: ny });
      this.take(this.randomLoot(1), nx, ny);
      if (chance(0.6)) this.take(this.randomLoot(), nx, ny);
      this.take({ kind: 'gold', n: rint(8, 16) * this.floor }, nx, ny);
      return true;
    }
    if (!canStep(m, p.x, p.y, dx, dy)) return false;
    if (p.st.web > 0) { this.say(t('lWebbed'), 'bad'); return true; }
    p.x = nx; p.y = ny;
    this.emit({ t: 'step' });
    for (let i = this.items.length - 1; i >= 0; i--) {
      const o = this.items[i];
      if (o.x === nx && o.y === ny) { this.items.splice(i, 1); this.take(o.it, nx, ny); }
    }
    const mc = this.merchant;
    if (mc && !mc.seen && mc.x === nx && mc.y === ny) {
      mc.seen = true;
      this.say(t('lMerchant'), 'sys');
      this.emit({ t: 'shop' });
    }
    const f = this.fountain;
    if (f && !f.used && f.x === nx && f.y === ny) {
      f.used = true;
      const st = this.ps(), n = st.maxHp - p.hp;
      p.hp = st.maxHp; p.st.poison = 0;
      if (this.bonus.fountain) p.st.shield = Math.max(p.st.shield || 0, Math.round(st.maxHp * this.bonus.fountain));
      this.say(t('lFountain'), 'good'); this.emit({ t: 'fx', k: 'fountain', x: nx, y: ny }); if (n > 0) this.emit({ t: 'heal', id: p.id, n, x: nx, y: ny });
    }
    if (this.onStairs()) this.say(t('stairsHint'), 'sys');
    return true;
  }

  // one attack roll. o: { flat, mult, sure, adv, kind ('melee' | shot kind | 'spell'), noCrit }
  strike(a, d, o = {}) {
    if (d.hp <= 0 || a.hp <= 0) return false; // a second arrow at a body already down
    const p = this.player, isP = a === p, st = this.ps(), F = this.flags(), fresh = !d.touched, toP = d === p;
    let roll = rint(1, 20);
    if (o.adv) roll = Math.max(roll, rint(1, 20));
    let crit = !o.noCrit && roll >= (isP ? this.critChance() : 20);
    if (isP && p.st.invis > 0) { crit = true; p.st.invis = 0; }
    if (isP && (F.has('ambush') || F.has('ghost')) && !d.touched) crit = true;
    // Piercing Blows: the hero's hits go through a few points of the enemy's armour
    const hitBonus = (isP ? st.hit : a.hit) + (o.hitBonus || 0), ac = isP ? d.ac - (st.pierce || 0) : toP ? st.ac : d.ac;
    const hit = o.sure || crit || (roll !== 1 && roll + hitBonus >= ac);
    if (o.kind && o.kind !== 'melee' && o.kind !== 'spell') this.emit({ t: 'shot', a: a.id, d: d.id, k: o.kind, x0: a.x, y0: a.y, x1: d.x, y1: d.y });
    else if (o.kind !== 'spell') this.emit({ t: 'atk', a: a.id, d: d.id });
    if (isP) d.touched = true;
    if (!hit) {
      this.emit({ t: 'miss', id: d.id, x: d.x, y: d.y });
      this.say(isP ? t('lYouMiss', this.ename(d)) : toP ? t('lMissYou', this.ename(a)) : t('lMiss', this.ename(a), this.ename(d)));
      return false;
    }
    // a weapon's power is added to the hero's damage, like a spell's own power is
    let n = o.base != null ? o.base : rint(...(isP ? st.dmg.map((x) => x + st.power) : a.dmg));
    n += o.flat || 0;
    if (isP && o.kind === 'spell') n *= st.spell * (F.has('mastery') ? 1.3 : 1);
    if (isP && o.kind !== 'spell') n *= st.melee * (o.ranged ? st.ranged : 1);
    if (isP && F.has('wrath') && o.kind === 'spell') n *= 1.2;
    if (crit) n *= (isP && F.has('assassin') ? 3 : 2) * (isP && st.critpower ? 1 + st.critpower : 1);
    n *= o.mult || 1;
    if (isP && st.firstblood && fresh) n += st.firstblood;
    if (isP && F.has('vanguard') && !p.flags.vanguard) { p.flags.vanguard = true; n *= 1.25; } // Vanguard: the first blow of a floor
    if (isP) n *= this.playerMult(d);
    n = Math.max(1, Math.round(n));
    if (toP && (p.st.dodge || 0) + (st.dodge || 0) > 0 && chance(((p.st.dodge || 0) + (st.dodge || 0)) / 100)) { this.say(t('lDodge')); this.emit({ t: 'miss', id: p.id, x: p.x, y: p.y }); return false; }
    if (toP && ((F.has('mirror') && !p.flags.mirror) || (F.has('guardian') && !p.flags.guardian))) {
      if (F.has('mirror') && !p.flags.mirror) p.flags.mirror = true; else p.flags.guardian = true;
      this.say(t('lWard'), 'good'); this.emit({ t: 'fx', k: 'ward', x: p.x, y: p.y }); return false;
    }
    if (toP && F.has('ward') && chance(0.25)) {
      this.say(t('lWard'), 'good'); this.emit({ t: 'fx', k: 'ward', x: p.x, y: p.y }); return false;
    }
    this.say(isP ? t(crit ? 'lYouCrit' : 'lYouHit', this.ename(d), n) : toP ? t(crit ? 'lCritYou' : 'lHitYou', this.ename(a), n) : t(crit ? 'lCrit' : 'lHit', this.ename(a), this.ename(d), n), isP ? (crit ? 'crit' : '') : toP ? 'bad' : '');
    this.damage(d, n, crit, a);
    if (isP && F.has('bloodtrail')) this.heal(Math.floor(n / 10), true);
    if (isP && o.kind === 'spell' && F.has('siphon')) this.heal(Math.round(n * 0.15), true);
    if (toP && F.has('retribution') && a.hp > 0) this.damage(a, 3, false, p);
    if (isP && d.hp > 0) {
      if (F.has('wintergrasp') && !d.st.slowed) d.st.slow = 1;
      if (F.has('abszero') && !d.boss && d.hp < d.maxHp * 0.3 && !d.st.frozen) d.st.frozen = 2;
      if (F.has('bleeding') && o.kind !== 'spell') { d.st.bleed = Math.max(d.st.bleed || 0, 3); d.st.bleedDmg = Math.max(d.st.bleedDmg || 0, 2 + Math.floor(this.floor / 3)); }
      if (p.venom > 0 && o.kind !== 'spell') {
        p.venom--; this.poison(d, F.has('toxicity') ? 4 : 3, F.has('toxicity') ? 6 : 4);
        // Plaguebearer: the poison jumps to whoever stands next to the target
        if (F.has('plaguebearer')) for (const e of this.enemies) if (!e.ally && e !== d && e.hp > 0 && dist(e, d) === 1) this.poison(e, 2, 3);
      }
      else if (this.relic === 'gland' && o.kind !== 'spell') this.poison(d, 1 + this.rl(), 3);
      else if (this.relic === 'ember' && o.kind !== 'spell' && d.hp > 0) { d.st.burn = Math.max(d.st.burn || 0, F.has('pyre') ? 5 : 3); d.st.burnDmg = Math.max(d.st.burnDmg || 0, this.rl()); }
      // Serrated Edge: a cut that keeps bleeding
      if (st.bleed && o.kind !== 'spell' && d.hp > 0) { d.st.bleed = Math.max(d.st.bleed || 0, 3); d.st.bleedDmg = Math.max(d.st.bleedDmg || 0, st.bleed); }
      // Frozen Tear: your hits slow, and from level 3 they freeze
      if (this.relic === 'tear' && o.kind !== 'spell' && d.hp > 0) {
        if (this.rl() >= 3) d.st.frozen = Math.max(d.st.frozen || 0, d.boss ? 1 : 2);
        else if (!d.st.slowed) d.st.slow = 1;
      }
    }
    if (isP && st.steal && p.hp > 0) this.heal(st.steal, true);
    if (toP && p.hp > 0) {
      const on = ENEMIES[a.type].onHit;
      if (on === 'stun' && chance(0.15)) { p.st.stun = 1; this.say(t('lStunned'), 'bad'); }
      if (on === 'poison') { p.st.poison = Math.max(p.st.poison || 0, Math.max(1, 3 - (st.resist || 0))); p.st.poisonDmg = 2 + Math.floor(this.floor / 3); }
      if (on === 'burn') { p.st.burn = Math.max(p.st.burn || 0, Math.max(1, 3 - (st.resist || 0))); p.st.burnDmg = 2 + Math.floor(this.floor / 2); }
      if (on === 'drain' && !(a.st.poison > 0 && this.has('creepingrot'))) { a.hp = Math.min(a.maxHp, a.hp + Math.ceil(n / 2)); }
    }
    return true;
  }

  playerMult(d) {
    const p = this.player, st = this.ps(), F = this.flags();
    let k = 1;
    if (this.relic === 'crown') k *= 1 + 0.08 * this.rl();
    if (p.st.rage > 0) k *= 1.4;
    if (p.st.cry > 0) k *= 1.25;
    if (this.bonus.vendetta && this.floor === this.bonus.vendettaFloor) k *= 1 + this.bonus.vendetta;
    if (F.has('judgement') && d.hp < d.maxHp * 0.25) k *= 1.5;
    if (F.has('rage') && p.hp < st.maxHp / 2) k *= 1.5;
    if (F.has('executioner') && d.hp < d.maxHp * 0.3) k *= 1.6;
    if (st.executioner && d.hp < d.maxHp * 0.3) k *= 1 + st.executioner;
    if (F.has('shatter') && (d.st.frozen > 0 || d.st.stun > 0)) k *= 1.6;
    if (F.has('virulence') && d.st.poison > 0) k *= 1.3;
    if (F.has('kindled') && d.st.burn > 0) k *= 1.5;
    if (F.has('searing') && d.st.burn > 0) k *= 1.25;
    if (this.relic === 'sigil') k *= 1 + 0.12 * this.rl();
    return k;
  }

  poison(e, dmg, turns) { e.st.poison = Math.max(e.st.poison || 0, turns); e.st.poisonDmg = Math.max(e.st.poisonDmg || 0, dmg); }

  heal(n, quiet = false) {
    const p = this.player, st = this.ps(), max = st.maxHp;
    n = Math.round(n * st.heal);
    if (this.has('martyr')) for (const w of this.pets()) w.hp = Math.min(w.maxHp, w.hp + n);
    const got = Math.min(n, max - p.hp);
    if (got <= 0) return 0;
    p.hp += got;
    this.emit({ t: 'heal', id: p.id, n: got, x: p.x, y: p.y });
    if (!quiet) this.say(t('lHeal', got), 'good');
    return got;
  }

  // a shield soaks damage before HP does; it is spent, not healed
  shield(n) {
    const p = this.player;
    p.st.shield = Math.max(p.st.shield || 0, n);
    this.say(t('lShield', p.st.shield), 'good');
    this.emit({ t: 'fx', k: 'ward', x: p.x, y: p.y });
  }

  damage(d, n, crit, from) {
    const p = this.player, F = this.flags(), sp = this.ps();
    if (d === p) {
      // Spiked Hide: whoever hits the hero pays for it
      if (from && from !== 'poison' && from !== 'burn' && sp.thorns && from.hp > 0 && from.type !== 'player') {
        this.say(t('lThorns', sp.thorns, this.ename(from)));
        this.damage(from, sp.thorns, false, 'thorns');
      }
      if (F.has('lastStand') && p.hp < this.ps().maxHp / 3) n = Math.max(1, Math.round(n * 0.8));
      if (F.has('sacredvow') && p.hp < sp.maxHp / 2) n = Math.max(1, Math.round(n * 0.85));
      // Blood Bond: the wolf takes half of every blow
      const wolf = F.has('bloodbond') && from !== 'poison' && from !== 'burn' ? this.pets().find((w) => w.hp > 1) : null;
      if (wolf) { const half = Math.min(wolf.hp - 1, Math.floor(n / 2)); wolf.hp -= half; n -= half; }
      if (p.st.sanctuary > 0) n = Math.max(1, Math.round(n * 0.65));
      const sh = p.st.shield || 0;
      if (sh > 0) {
        const used = Math.min(sh, n);
        p.st.shield = sh - used; n -= used;
        this.emit({ t: 'fx', k: 'ward', x: p.x, y: p.y });
        if (n <= 0) { this.say(t('lBlocked', used), 'good'); return; }
      }
    }
    d.hp -= n;
    this.emit({ t: 'hit', id: d.id, n, crit, x: d.x, y: d.y, p: d === p });
    if (crit) this.emit({ t: 'shake', p: d === p ? 6 : 4 });
    if (d === p) {
      const st = this.ps();
      if (p.hp <= 0 && F.has('unbreakable') && !p.flags.unbreakable) {
        p.flags.unbreakable = true; p.hp = 1; this.say(t('lUnbreakable'), 'good'); this.emit({ t: 'fx', k: 'ward', x: p.x, y: p.y });
      }
      if (p.hp <= 0 && sp.evade && (p.flags.evade || 0) < sp.evade) {
        p.flags.evade = (p.flags.evade || 0) + 1; p.hp = 1; this.say(t('lEvade'), 'good'); this.emit({ t: 'fx', k: 'ward', x: p.x, y: p.y });
      }
      if (p.hp <= 0 && F.has('miracle') && !p.flags.miracle) {
        p.flags.miracle = true; p.hp = Math.round(st.maxHp / 2); this.say(t('lRelic'), 'good'); this.emit({ t: 'fx', k: 'level', x: p.x, y: p.y });
      }
      if (p.hp <= 0 && this.relic === 'phylactery' && (p.flags.revives || 0) < 1 + Math.floor(this.rl() / 2)) {
        p.flags.revives = (p.flags.revives || 0) + 1; p.hp = Math.round(st.maxHp / 2); this.say(t('lRelic'), 'good'); this.emit({ t: 'fx', k: 'level', x: p.x, y: p.y });
      }
      if (p.hp > 0 && p.hp < st.maxHp * 0.25 && F.has('secondwind') && !p.flags.secondWind) {
        p.flags.secondWind = true; this.say(t('lSecondWind'), 'good'); this.heal(Math.round(st.maxHp * 0.35), true);
      }
      if (p.hp <= 0) {
        p.hp = 0; this.over = 'dead';
        this.killer = from === 'poison' ? t('lPoison', '').replace(/[:.\s]+$/, '') : from === 'burn' ? t('lBurning', '').replace(/[:.\s]+$/, '') : from ? this.ename(from) : '?';
        this.emit({ t: 'die', id: p.id, x: p.x, y: p.y, player: true });
        this.emit({ t: 'over', win: false });
      }
      return;
    }
    if (d.hp <= 0) this.kill(d);
  }

  kill(e) {
    const p = this.player, d = ENEMIES[e.type];
    if (e.ally) { // the wolf fell: the hunter is alone until the skill comes back
      this.enemies = this.enemies.filter((x) => x !== e);
      this.pet = 0;
      this.say(t('lPetDown'), 'bad');
      return;
    }
    this.enemies = this.enemies.filter((x) => x !== e);
    if (this.over) return; // the hero fell this same turn: a kill after that wins nothing
    this.stats.kills++;
    this.say(t('lKill', this.ename(e)), 'kill');
    this.emit({ t: 'die', id: e.id, x: e.x, y: e.y, type: e.type, boss: e.boss, elite: e.elite });
    if (this.has('bloodlust')) this.heal(3, true);
    if (this.has('manasurge')) p.mp = Math.min(this.manaPool(), p.mp + 2);
    // Combustion: a burning enemy that falls sets its neighbours alight
    if (this.has('combustion') && e.st.burn > 0) for (const x of this.enemies) if (!x.ally && x.hp > 0 && dist(x, e) === 1) { x.st.burn = Math.max(x.st.burn || 0, 3); x.st.burnDmg = Math.max(x.st.burnDmg || 0, e.st.burnDmg || 2); }
    if (this.has('packbond')) for (const w of this.pets()) w.hp = Math.min(w.maxHp, w.hp + Math.round(w.maxHp * 0.25));
    this.gainXp(e.xp);
    if (d.split) for (const c of this.freeNear(e.x, e.y).slice(0, 2)) { const s = this.spawn('slimelet', c.x, c.y); s.awake = true; }
    const drop = (it) => { const c = this.blocked(e.x, e.y) || this.items.some((i) => i.x === e.x && i.y === e.y) ? this.freeNear(e.x, e.y)[0] : e; if (c) this.items.push({ x: c.x, y: c.y, it }); };
    if (e.boss) {
      drop(this.makeEquip(pick(['weapon', 'armor', 'trinket']), 1, 2));
      drop(this.makeUse('heal', 2));
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
    p.xp += Math.round(n * (1 + (this.bonus.xp || 0)));
    while (p.xp >= this.xpToNext(p.lvl)) {
      p.xp -= this.xpToNext(p.lvl); p.lvl++; p.points++;
      if (this.pets().length) this.tunePet();
      const st = this.ps();
      p.hp = Math.min(st.maxHp, p.hp + Math.round(st.maxHp * 0.3) + CLASSES[p.cls].hpLvl);
      this.say(t('lLevel', p.lvl), 'good');
      this.emit({ t: 'level', lvl: p.lvl, x: p.x, y: p.y });
    }
  }

  // which branches of the tree are open: one to begin with, a second one from level 10.
  // A branch is open once picked, and stays open even when the other one is being filled.
  branchOpen(b) { const p = this.player; return (p.spec || []).includes(b); }
  specFull() { const p = this.player; return p.spec.length >= SPEC_MAX; }
  pickSpec(b) {
    const p = this.player;
    if (p.spec.includes(b) || p.spec.length >= SPEC_MAX) return false;
    p.spec.push(b);
    this.recompute();
    return true;
  }
  // the first level of a branch is the specialisation: picking it counts as opening the branch
  learn(id) { // talent: costs a point, needs the level above in the same branch
    const p = this.player, lvl = Number(id.slice(1).replace(/[ab]$/, '')), letter = id[0];
    const bi = letter.charCodeAt(0) - 65, branch = TALENTS[p.cls][bi] || [];
    const above = lvl === 1 || branch.some((n) => n.id !== id && Number(n.id.slice(1).replace(/[ab]$/, '')) === lvl - 1 && p.talents[n.id]);
    const opened = this.branchOpen(bi);
    if (p.points <= 0 || p.talents[id] || !above || p.talents[id.endsWith('b') ? id.slice(0, -1) : id + 'b']) return false;
    if (!opened) {
      if (lvl !== 1 || this.specFull() || (p.spec.length >= 1 && p.lvl < SPEC_LVL)) return false;
      p.spec.push(bi);
    }
    const before = this.ps().maxHp;
    p.points--; p.talents[id] = 1;
    p.hp += Math.max(0, this.ps().maxHp - before);
    if (this.pet) this.tunePet();
    this.recompute();
    return true;
  }

  // ---------- skills ----------
  // which targets a skill accepts right now (for the UI): [{x, y}]
  targets(id) {
    const p = this.player, sk = SKILLS[id], m = this.map;
    if (sk.target === 'adjacent') return this.enemies.filter((e) => dist(e, p) === 1 && (e.x === p.x || e.y === p.y || (tile(m, e.x, p.y) !== WALL && tile(m, p.x, e.y) !== WALL)));
    if (sk.target === 'enemy') return this.visibleEnemies().filter((e) => !e.ally && dist(e, p) <= sk.range && this.laneClear(p, e, sk.block)).sort((a, b) => dist(a, p) - dist(b, p));
    // Hammerfall: the enemy you tapped, or the nearest one if you tapped the floor, plus whoever stands next to you
    if (sk.target === 'enemyAround') {
      const list = this.enemies.filter((e) => !e.ally && e.hp > 0 && dist(e, p) === 1);
      const near = this.visibleEnemies().filter((e) => !e.ally && dist(e, p) <= sk.range && this.laneClear(p, e, sk.block)).sort((a, b) => dist(a, p) - dist(b, p));
      return list.concat(near.filter((e) => !list.includes(e)));
    }
    if (sk.target === 'tile') {
      const out = [];
      for (let y = p.y - sk.range; y <= p.y + sk.range; y++) for (let x = p.x - sk.range; x <= p.x + sk.range; x++)
        if (inside(m, x, y) && this.vis[y * m.w + x] && !this.blocked(x, y) && dist({ x, y }, p) >= 2) out.push({ x, y });
      return out;
    }
    return [];
  }

  useSkill(id, x, y) {
    const p = this.player, st = this.ps(), sk = SKILLS[id], F = this.flags();
    if (!this.canCast(id)) { if (this.skills().includes(id) && (p.cds[id] || 0) === 0) this.say(t('lNoMana')); return false; }
    let target = null;
    if (sk.target) {
      target = this.targets(id).find((c) => c.x === x && c.y === y);
      // a spell that only reaches the next tile fires at whatever is there, no aiming needed
      if (!target && sk.target === 'enemyAround' && sk.range === 1) target = this.targets(id)[0] || null;
      if (!target) {
        // there is something in the way: say so instead of "no target", the two feel very different
        this.say(this.noTargetWhy(id, x, y));
        return false;
      }
    }
    const adjacent = () => this.enemies.filter((e) => !e.ally && dist(e, p) === 1);
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
          target.st.stun = target.boss ? 1 : F.has('concussion') ? 3 : 2; this.say(t('lStun', this.ename(target)));
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
          if (F.has('kindling') && e.hp > 0) { e.st.burn = F.has('pyre') ? 5 : 3; e.st.burnDmg = 2 + Math.floor(this.floor / 3); }
        };
        const around = F.has('inferno') ? this.enemies.filter((e) => !e.ally && e !== target && dist(e, target) === 1) : [];
        hit(target, 1);
        if (F.has('inferno')) { this.emit({ t: 'fx', k: 'explode', x: target.x, y: target.y }); for (const e of around) hit(e, 0.5); }
        break;
      }
      case 'nova': {
        const list = this.enemies.filter((e) => !e.ally && dist(e, p) <= (F.has('deepfreeze') ? 3 : 2));
        if (!list.length) { this.say(t('lNoTarget')); return false; }
        this.emit({ t: 'fx', k: 'nova', x: p.x, y: p.y });
        for (const e of list) {
          this.strike(p, e, { sure: true, kind: 'spell', base: spell(3, 6) + Math.floor(p.lvl / 2) });
          if (e.hp > 0) { e.st.frozen = e.boss ? 1 : F.has('deepfreeze') ? 3 : 2; this.say(t('lFrozen', this.ename(e))); }
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
        this.strike(p, target, { adv: true, mult: F.has('twinfangs') ? 3 : 2 });
        break;
      }
      case 'venom':
        p.venom = 3; this.emit({ t: 'fx', k: 'venom', x: p.x, y: p.y });
        break;
      case 'smoke':
        p.st.invis = F.has('vanish') ? 6 : 4; this.say(t('lInvis'), 'good'); this.emit({ t: 'fx', k: 'smoke', x: p.x, y: p.y });
        for (const e of this.enemies) if (!e.ally) e.awake = false;
        break;
      // ---------- cleric ----------
      // Punizione is a bolt of light: it leaves your hand, so the first body in the way takes it
      case 'smite': {
        const list = F.has('zeal') ? adjacent().concat(target && dist(target, p) === 1 ? [] : [target]) : [target];
        this.emit({ t: 'shot', a: p.id, d: target.id, k: 'holy', x0: p.x, y0: p.y, x1: target.x, y1: target.y });
        if (!list.length) { this.say(t('lNoTarget')); return false; }
        this.emit({ t: 'fx', k: 'cleave', x: p.x, y: p.y });
        for (const e of list) {
          const holy = ENEMIES[e.type].undead ? 2 : 1;
          const mult = holy;
          this.strike(p, e, { sure: true, kind: 'spell', base: Math.round((rint(3, 7) + p.lvl + st.power + 4) * mult) });
        }
        break;
      }
      case 'mend': {
        if (p.hp >= st.maxHp && !p.st.poison && !p.st.burn) { this.say(t('lNoTarget')); return false; }
        this.heal(Math.max(10, Math.round(st.maxHp * 0.35)));
        p.st.poison = 0; p.st.burn = 0;
        if (F.has('purgingfire')) for (const e of this.enemies) if (!e.ally && e.hp > 0 && dist(e, p) === 1) { e.st.burn = Math.max(e.st.burn || 0, 3); e.st.burnDmg = Math.max(e.st.burnDmg || 0, 3 + Math.floor(this.floor / 3)); }
        this.emit({ t: 'fx', k: 'level', x: p.x, y: p.y });
        break;
      }
      case 'sanctuary':
        p.st.sanctuary = F.has('shelter') ? 6 : 4;
        this.say(t('lSanctuary'), 'good'); this.emit({ t: 'fx', k: 'ward', x: p.x, y: p.y });
        break;
      // ---------- paladin ----------
      case 'aegis':
        this.shield(Math.round((10 + p.lvl * 2) * st.shieldMax * (F.has('shieldoffaith') ? 1.5 : 1)));
        break;
      case 'hammer': {
        const reach = F.has('earthshaker') ? 2 : 1;
        const cells = [target, ...this.enemies.filter((e) => !e.ally && e !== target && dist(e, p) <= reach)];
        this.emit({ t: 'fx', k: 'cleave', x: p.x, y: p.y });
        for (const e of cells) {
          if (this.strike(p, e, { sure: true, flat: F.has('earthshaker') ? 6 : 3 }) && e.hp > 0) {
            e.st.stun = e.boss ? 1 : (F.has('shatterblow') ? 3 : 1);
            this.say(t('lStun', this.ename(e)));
          }
        }
        break;
      }
      case 'consecrate':
        p.st.consecrate = F.has('shelter') ? 6 : 4;
        p.st.consecrateDmg = Math.round((4 + p.lvl) * (F.has('shelter') ? 1.5 : 1));
        this.say(t('lConsecrate'), 'good'); this.emit({ t: 'fx', k: 'nova', x: p.x, y: p.y });
        break;
      // ---------- hunter ----------
      // Volley is the hunter's aimed shot: one arrow, twice the punch of a normal one, at the enemy you chose
      case 'volley': {
        const bonus = F.has('marksman') ? 2 : 0;
        const hit = (e, x0, y0) => { this.emit({ t: 'shot', a: p.id, d: e.id, k: 'arrow', x0, y0, x1: e.x, y1: e.y }); this.strike(p, e, { mult: 2, ranged: true, hitBonus: bonus }); };
        // the arrow stops at the first body in the way, whoever it is: no shooting through a friend
        const body = this.bodyBetween(p, target);
        if (body && body !== target) {
          hit(body, p.x, p.y);
          this.say(t('lInTheWay'));
          if (body.hp <= 0 && target.hp > 0 && F.has('piercing')) hit(target, body.x, body.y); // Piercing: on through to the one behind
          break;
        }
        hit(target, p.x, p.y);
        // Rapid Fire: a second arrow at whoever stands next to the one you chose
        if (F.has('rapidfire')) {
          const side = this.enemies.find((e) => !e.ally && e.hp > 0 && e !== target && dist(e, target) === 1 && this.laneClear(p, e, 'arrow'));
          if (side) hit(side, p.x, p.y);
        }
        if (target.hp > 0 && F.has('toxicity')) this.poison(target, 2, 3);
        break;
      }
      case 'snare':
        this.emit({ t: 'shot', a: p.id, d: target.id, k: 'web', x0: p.x, y0: p.y, x1: target.x, y1: target.y });
        target.st.web = target.boss ? 1 : F.has('pittrap') ? 5 : 3;
        const venom = F.has('toxicity') || F.has('poisontrap');
        const dmg = Math.round((venom ? 4 : 3) * st.trap * (F.has('poisontrap') ? 1.5 : 1));
        this.poison(target, dmg, venom ? 6 : 4);
        this.say(t('lSnare', this.ename(target)), 'good');
        break;
      // the wolf comes out on the tile you tapped, so you can put it between yourself and an archer
      case 'beast':
      case 'pack': {
        const most = id === 'pack' || this.skills().includes('pack') ? 2 : 1;
        if (this.pets().length >= most) { this.say(t('lNoTarget')); return false; }
        const spot = this.enemies.some((e) => e.hp > 0 && e.x === x && e.y === y) ? null
          : this.blocked(x, y) ? this.freeNear(p.x, p.y, 2)[0] : { x, y };
        if (!spot) { this.say(t('lNoTarget')); return false; }
        this.summonWolf(spot);
        break;
      }
      case 'whirlwind': {
        const list = this.enemies.filter((e) => !e.ally && e.awake && dist(e, p) === 1);
        if (!list.length) { this.say(t('lNoTarget')); return false; }
        this.emit({ t: 'fx', k: 'nova', x: p.x, y: p.y });
        for (const e of list) this.strike(p, e);
        this.say(t('lWhirl'), 'good');
        break;
      }
      case 'warcry':
        p.st.rage = Math.max(p.st.rage || 0, 4); p.st.cry = 4;
        this.emit({ t: 'fx', k: 'level', x: p.x, y: p.y });
        this.say(t('lWarcry'), 'good');
        break;
      case 'meteor': {
        this.emit({ t: 'fx', k: 'explode', x: target.x, y: target.y });
        const base = rint(18, 28) + Math.round(p.lvl * 1.5);
        for (const e of this.enemies.filter((e) => !e.ally && dist(e, target) <= 1)) {
          this.strike(p, e, { sure: true, kind: 'spell', base });
          if (e.hp > 0) { e.st.burn = 3; e.st.burnDmg = 3 + Math.floor(this.floor / 3); }
        }
        this.say(t('lMeteor'), 'good');
        break;
      }
      case 'blizzard': {
        const list = this.visibleEnemies().filter((e) => !e.ally);
        if (!list.length) { this.say(t('lNoTarget')); return false; }
        for (const e of list) {
          e.st.frozen = Math.max(e.st.frozen || 0, e.boss ? 1 : 2);
          this.strike(p, e, { sure: true, kind: 'spell', base: rint(6, 10) + Math.round(p.lvl) });
          this.emit({ t: 'fx', k: 'nova', x: e.x, y: e.y });
        }
        this.say(t('lBlizzard'), 'good');
        break;
      }
      case 'miasma': {
        this.hazards.push({ x: target.x, y: target.y, kind: 'miasma', turns: 4, dmg: 2 + Math.floor(p.lvl / 2) });
        this.emit({ t: 'fx', k: 'smoke', x: target.x, y: target.y });
        this.say(t('lMiasma'), 'good');
        break;
      }
      case 'radiance': {
        this.heal(Math.round(st.maxHp * 0.2));
        for (const e of this.enemies.filter((e) => !e.ally && dist(e, p) === 1)) {
          this.strike(p, e, { sure: true, kind: 'spell', base: rint(8, 12) + p.lvl });
          if (e.hp > 0) { e.st.burn = 2; e.st.burnDmg = 2 + Math.floor(this.floor / 3); }
        }
        this.emit({ t: 'fx', k: 'level', x: p.x, y: p.y });
        this.say(t('lRadiance'), 'good');
        break;
      }
      case 'rain': {
        const list = this.visibleEnemies().filter((e) => !e.ally && this.laneClear(p, e, 'arrow'));
        if (!list.length) { this.say(t('lNoTarget')); return false; }
        const bonus = F.has('marksman') ? 2 : 0;
        for (const e of list) for (let i = 0; i < 2; i++) {
          this.emit({ t: 'shot', a: p.id, d: e.id, k: 'arrow', x0: p.x, y0: p.y, x1: e.x, y1: e.y });
          this.strike(p, e, { flat: 3, ranged: true, hitBonus: bonus });
        }
        this.say(t('lRain'), 'good');
        break;
      }
      case 'beartrap':
        this.hazards.push({ x: target.x, y: target.y, kind: 'trap', dmg: Math.round((rint(10, 16) + Math.floor(p.lvl * 1.5)) * st.trap), hold: 2, owner: 'player' });
        this.emit({ t: 'fx', k: 'chest', x: target.x, y: target.y });
        this.say(t('lBeartrap'), 'good');
        break;
    }
    this.spend(id);
    // Quick Hands: every cooldown is a turn shorter (never below one turn)
    p.cds[id] = Math.max(1, SKILLS[id].cd - (this.bonus.swift || 0));
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
    const spend = () => { if ((it.n || 1) > 1) it.n--; else p.bag.splice(i, 1); };
    switch (it.kind) {
      case 'heal':
        if (p.hp >= st.maxHp && !p.st.poison && !p.st.burn) return false;
        this.say(t('lDrink'));
        this.heal(Math.round(Math.max(15, Math.round(st.maxHp / 2)) * (1 + (this.bonus.potency || 0))));
        p.st.poison = 0; p.st.burn = 0;
        this.emit({ t: 'fx', k: 'potion', x: p.x, y: p.y });
        break;
      case 'greatHeal':
        this.say(t('lDrink'));
        this.heal(Math.round(st.maxHp * (1 + (this.bonus.potency || 0)))); p.st.poison = 0; p.st.burn = 0;
        this.emit({ t: 'fx', k: 'potion', x: p.x, y: p.y });
        break;
      case 'food': {
        // eaten for a wound, or given to a wolf that is hurt
        const wolf = this.pets().find((w) => w.hp < w.maxHp);
        if (p.hp >= st.maxHp && !wolf) return false;
        this.heal(Math.round(Math.round(st.maxHp / 4) * (1 + (this.bonus.potency || 0))));
        for (const pet of this.pets()) pet.hp = Math.min(pet.maxHp, pet.hp + Math.round(pet.maxHp / 3));
        break;
      }
      case 'mana':
        if (p.mp >= this.manaPool()) return false;
        p.mp = Math.min(this.manaPool(), p.mp + Math.ceil(this.manaPool() / 2));
        this.say(t('lMana'), 'good');
        this.emit({ t: 'fx', k: 'potion', x: p.x, y: p.y });
        break;
      case 'antidote':
        if (!p.st.poison && !p.st.burn) return false;
        p.st.poison = 0; p.st.burn = 0; this.say(t('lAntidote'), 'good');
        break;
      // a scroll lands on the nearest enemy you can see, and catches whatever stands next to it
      case 'fire': {
        const near = (e) => dist(e, p) <= 1;
        const c = this.visibleEnemies().filter((e) => !e.ally && !near(e) && this.laneClear(p, e, 'arrow')).sort((a, b) => dist(a, p) - dist(b, p))[0];
        if (!c) { this.say(t('lNoTarget')); return false; }
        this.say(t('lScrollFire'), 'good');
        this.emit({ t: 'fx', k: 'explode', x: c.x, y: c.y });
        for (const e of this.enemies.filter((e) => !e.ally && e.hp > 0 && dist(e, c) <= 1)) {
          if (e !== c) this.emit({ t: 'fx', k: 'explode', x: e.x, y: e.y });
          this.strike(p, e, { sure: true, kind: 'spell', base: rint(8, 14) + this.floor * 2 });
        }
        break;
      }
      case 'frost': {
        const c = this.visibleEnemies().filter((e) => !e.ally && dist(e, p) > 1).sort((a, b) => dist(a, p) - dist(b, p))[0];
        if (!c) { this.say(t('lNoTarget')); return false; }
        for (const e of this.enemies.filter((e) => !e.ally && e.hp > 0 && dist(e, c) <= 1)) {
          e.st.frozen = e.boss ? 1 : 2; this.emit({ t: 'fx', k: 'nova', x: e.x, y: e.y });
        }
        this.say(t('lScrollFrost'), 'good');
        break;
      }
      case 'lightning': {
        const e = this.visibleEnemies().filter((x) => !x.ally).sort((a, b) => dist(a, p) - dist(b, p))[0];
        if (!e) { this.say(t('lNoTarget')); return false; }
        this.emit({ t: 'shot', a: p.id, d: e.id, k: 'zap', x0: p.x, y0: p.y, x1: e.x, y1: e.y });
        this.strike(p, e, { sure: true, kind: 'spell', base: rint(16, 26) + this.floor * 3 });
        this.say(t('lScrollBolt'), 'good');
        break;
      }
      case 'teleport': {
        const c = pick(this.freeCells(0).filter((c) => dist(c, p) > 10));
        if (!c) return false;
        this.emit({ t: 'fx', k: 'blink', x: p.x, y: p.y, x1: c.x, y1: c.y });
        p.x = c.x; p.y = c.y; this.say(t('lScrollTp'), 'good');
        break;
      }
      case 'map':
        this.map.seen.fill(1); this.say(t('lScrollMap'), 'good');
        this.emit({ t: 'fx', k: 'map', x: p.x, y: p.y });
        break;
      case 'identify':
        this.map.seen.fill(1);
        for (const e of this.enemies) if (!e.ally) { this.vis[e.y * this.map.w + e.x] = 1; e.seen = this.turn; }
        this.say(t('lScrollSight'), 'good');
        break;
      case 'ward':
        p.st.shield = (p.st.shield || 0) + Math.round(20 * st.shieldMax);
        this.say(t('lScrollWard'), 'good');
        break;
      case 'rage':
        p.st.rage = 6; this.say(t('lRage'), 'good');
        break;
      case 'stoneskin':
        p.st.stoneskin = 8; this.say(t('lStoneskin'), 'good');
        break;
      case 'smoke':
        p.st.invis = 3; this.say(t('lInvis'), 'good');
        this.emit({ t: 'fx', k: 'smoke', x: p.x, y: p.y });
        break;
      default: return false;
    }
    spend();
    return true;
  }

  quickPotion() { const it = this.player.bag.find((x) => x.kind === 'heal' || x.kind === 'greatHeal'); return it ? this.act({ type: 'use', uid: it.uid }) : false; }

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
    p.mp = Math.min(this.manaPool(), p.mp + this.manaRegen());
    if (p.st.poison > 0) {
      p.st.poison--;
      const n = p.st.poisonDmg || 2;
      this.say(t('lPoison', n), 'bad');
      this.damage(p, n, false, 'poison');
    }
    if (p.st.burn > 0) {
      p.st.burn--;
      const n = p.st.burnDmg || 2;
      this.say(t('lBurn', n), 'bad');
      this.damage(p, n, false, 'burn');
    }
    for (const k of ['stun', 'web', 'invis', 'rage', 'cry', 'stoneskin']) if (p.st[k] > 0) p.st[k]--;
    if (p.st.sanctuary > 0) { this.heal(3, true); p.st.sanctuary--; }
    if (p.st.consecrate > 0 && !this.over) {
      p.st.consecrate--;
      for (const e of this.enemies.filter((x) => !x.ally && dist(x, p) === 1)) {
        this.emit({ t: 'fx', k: 'explode', x: e.x, y: e.y });
        this.damage(e, p.st.consecrateDmg || 5, false, p);
      }
    }
    if (this.has('blessing') && p.hp === st.maxHp) this.heal(2, true);
    if (st.regen && this.turn % 3 === 0) this.heal(st.regen, true);
    if (st.regenRelic && !this.over) this.heal(1, true); // the Cold Heart at level 4: one HP every turn
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
      for (const [k, kd] of [['burn', 'burnDmg'], ['poison', 'poisonDmg'], ['bleed', 'bleedDmg']]) {
        if (e.st[k] > 0 && e.hp > 0) {
          e.st[k]--;
          this.emit({ t: 'dot', id: e.id, k });
          this.damage(e, e.st[kd] || 2, false, null);
        }
      }
      if (e.hp <= 0) continue;
      if (e.st.frozen > 0) { e.st.frozen--; continue; }
      // slowed: loses this turn, and cannot be slowed again before it has acted once
      if (e.st.slow > 0) { e.st.slow = 0; e.st.slowed = 1; continue; }
      e.st.slowed = 0;
      if (e.st.stun > 0) { e.st.stun--; continue; }
      if (e.st.web > 0) { e.st.web--; continue; } // caught in a snare
      if (e.ally) { this.petAct(e, dm); continue; }
      e.energy += ENEMIES[e.type].speed || 1;
      while (e.energy >= 1 && e.hp > 0 && !this.over) { e.energy--; this.enemyAct(e, dm); }
      if (e.st.fear > 0) e.st.fear--;
    }
  }

  // the hunter's wolf: walks to the nearest enemy and bites it
  petAct(e, dm) {
    const p = this.player;
    const foes = this.enemies.filter((x) => !x.ally && this.vis[x.y * this.map.w + x.x]).sort((a, b) => dist(a, e) - dist(b, e));
    if (!foes.length) { // nothing to bite: stay close to the hero
      if (dist(e, p) > 2) this.stepToward(e, p);
      return;
    }
    const t0 = foes[0];
    if (dist(t0, e) === 1) { this.strike(e, t0); if (this.has('frenzy') && this.turn % 2 && t0.hp > 0) this.strike(e, t0); return; }
    if (dist(t0, e) <= 6) this.stepToward(e, t0);
    else if (dist(e, p) > 3) this.stepToward(e, p);
  }

  stepToward(e, goal) {
    const m = this.map, d = distanceMap(m, goal.x, goal.y);
    let best = null, bv = d[e.y * m.w + e.x];
    if (bv < 0) return false;
    for (const [dx, dy] of [...DIRS].sort(() => Math.random() - 0.5)) {
      const nx = e.x + dx, ny = e.y + dy, v = d[ny * m.w + nx];
      if (v < 0 || v >= bv || this.blocked(nx, ny) || !canStep(m, e.x, e.y, dx, dy)) continue;
      best = [nx, ny]; bv = v;
    }
    if (!best) return false;
    [e.x, e.y] = best;
    return true;
  }

  // the wolf keeps up with the hero: its numbers come from his level, and the Companion talent
  // the wolf (or two, with Wolf Pack): summoned next to the hero and kept in this.pets
  pets() { return this.enemies.filter((e) => e.ally); }
  summonWolf(spot) {
    const e = this.spawn('wolf', spot.x, spot.y, false, 0);
    e.ally = true; e.awake = true; e.seen = this.turn;
    this.pet = e;
    this.tunePet();
    this.emit({ t: 'fx', k: 'summon', x: spot.x, y: spot.y });
    this.say(t('lBeast'), 'good');
    return e;
  }

  tunePet() {
    const p = this.player, F = this.flags();
    for (const e of this.pets()) this.tuneWolf(e, F);
  }

  tuneWolf(e, F = this.flags()) {
    const p = this.player;
    const c = (F.has('shelter') ? 1.35 : 1) * (F.has('packbond') ? 1.2 : 1) * this.ps().petPower * (this.relic === 'totem' ? 1 + 0.15 * this.rl() : 1);
    e.maxHp = Math.round((14 + p.lvl * 4) * c);
    e.hp = Math.min(e.hp > 1 ? e.hp : e.maxHp, e.maxHp);
    e.hit = 4 + Math.floor(p.lvl / 2) + (F.has('shelter') ? 2 : 0);
    e.dmg = [Math.round((3 + p.lvl * 0.6) * c), Math.round((6 + p.lvl * 1.1) * c)];
    e.ac = 12 + Math.floor(p.lvl / 3);
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
    // the hero gets one move to every enemy's one: a floor with nine of them is not nine times as hard
    if (!e.boss && !e.ally) { e.turn = (e.turn || 0) + 1; if (e.turn % 2) { if (chance(0.35)) this.wander(e); return; } }
    if (e.st.fear > 0) { this.stepBy(e, dm, 1); return; }
    if (e.boss && this.bossAct(e, d)) return;
    if (def.ai === 'erratic' && chance(0.4)) { this.wander(e); return; }
    const reach = d === 1 && (e.x === p.x || e.y === p.y || (tile(m, e.x, p.y) !== WALL && tile(m, p.x, e.y) !== WALL));
    if (def.ai === 'ranged') {
      if (reach && !e.boss && chance(0.5) && this.stepBy(e, dm, 1)) return;
      if (d > 1 && d <= def.range && los(m, e, p) && this.laneClear(e, p, def.shot)) { this.strike(e, p, { kind: def.shot }); return; }
    }
    if (reach) { this.strike(e, p); return; }
    this.stepBy(e, dm, -1);
  }

  // What a shot has to get through to land: walls stop everything, and so does the first body in the way
  // (a wall of friends, a summoned wolf, a hero hiding behind a pillar). Fire and frost burn the first thing
  // they meet instead of flying on; arrows and bolts are stopped by a body and nothing else.
  // The first body between a shooter and a target, or null if the way is clear. Wolves and enemies both count:
  // nothing shoots through a friend.
  bodyBetween(from, to) {
    const m = this.map;
    let x = from.x, y = from.y;
    const dx = Math.abs(to.x - x), dy = -Math.abs(to.y - y), sx = Math.sign(to.x - x), sy = Math.sign(to.y - y);
    let err = dx + dy;
    for (let guard = 0; guard < 200; guard++) {
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      if (x === to.x && y === to.y) return null;
      if (tile(m, x, y) === WALL) return null;
      const body = this.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y) || (this.player.x === x && this.player.y === y ? this.player : null);
      if (body) return body;
    }
    return null;
  }
  // Can the hero shoot at this enemy from where they stand? Range, line of sight, and no body in between.
  aimable(e, range = 99) {
    const p = this.player;
    if (!e || e.ally || e.hp <= 0) return false;
    if (!this.vis[e.y * this.map.w + e.x]) return false;
    if (dist(e, p) > range || dist(e, p) < 2) return false; // the next tile is a punch, not an arrow
    return this.laneClear(p, e, 'arrow');
  }
  // Why a click on an enemy did nothing: it is not there, it is too far, or a friend is standing in the way
  noTargetWhy(id, x, y) {
    const sk = SKILLS[id], p = this.player;
    const e = this.enemies.find((c) => !c.ally && c.hp > 0 && c.x === x && c.y === y);
    if (!e) return t('lNoTarget');
    if (dist(e, p) > (sk.range || 1)) return t('lNoTarget');
    return this.bodyBetween(p, e) ? t('lInTheWay') : t('lNoTarget');
  }

  laneClear(from, to, kind) {
    const m = this.map;
    let x = from.x, y = from.y;
    const dx = Math.abs(to.x - x), dy = -Math.abs(to.y - y), sx = Math.sign(to.x - x), sy = Math.sign(to.y - y);
    let err = dx + dy;
    const seeThrough = kind === 'shadow' || kind === 'bolt';
    for (;;) {
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      if (x === to.x && y === to.y) return true;
      if (tile(m, x, y) === WALL) return false;
      if (seeThrough) continue;
      const body = this.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y) || (this.player.x === x && this.player.y === y ? this.player : null);
      if (body) return false;
    }
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
    // at half health a boss hits a fifth harder, once, on top of what his floor already gives him
    const enrage = () => { if (half && !e.enraged) { e.enraged = true; e.dmg = e.dmg.map((v) => Math.round(v * 1.2)); } };
    const around = (r) => { const out = []; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) out.push({ x: p.x + x, y: p.y + y }); return out; };
    if (e.type === 'boneKing') {
      if (e.cd.a <= 0 && this.summon(e, 'skeleton', 2, 4)) { e.cd.a = 7; return true; }
      if (e.cd.b <= 0 && d <= 6) {
        this.telegraph([{ x: p.x, y: p.y }, ...DIRS.slice(0, 4).map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))], rint(6, 10) + f, 'bone');
        e.cd.b = half ? 3 : 4; return true;
      }
      enrage();
    } else if (e.type === 'broodmother') {
      if (e.cd.a <= 0 && this.summon(e, 'spiderling', 2, 4)) { e.cd.a = 6; return true; }
      if (e.cd.b <= 0 && d > 1 && d <= 7 && los(m, e, p) && this.laneClear(e, p, 'web')) {
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
          e.x = c.x; e.y = c.y; e.cd.c = 9; return true;
        }
      }
      if (e.cd.b <= 0 && d <= 8) {
        this.telegraph(around(1).concat(half ? around(2).filter(() => chance(0.25)) : []), rint(8, 13), 'fire');
        e.cd.b = half ? 3 : 5; return true;
      }
      if (e.cd.a <= 0 && this.summon(e, half ? 'wraith' : 'skeleton', 2, 3)) { e.cd.a = 9; return true; }
    } else if (e.type === 'chainLord') {
      // slams the anvil: a ring of fire, then the embers it throws off start walking
      if (e.cd.a <= 0 && this.summon(e, 'emberling', 3, 6)) { e.cd.a = 6; return true; }
      if (e.cd.b <= 0 && d <= 7) {
        this.telegraph(around(2).filter(() => chance(half ? 0.55 : 0.35)).concat([{ x: p.x, y: p.y }]), rint(14, 22), 'fire');
        e.cd.b = half ? 3 : 5; return true;
      }
      if (half && e.cd.c <= 0 && d <= 2) {
        p.st.burn = Math.max(p.st.burn || 0, 3); p.st.burnDmg = 6;
        this.say(t('lBurn', 6), 'bad');
        e.cd.c = 7; return true;
      }
      enrage();
    } else if (e.type === 'frostQueen') {
      // freezes the ground under the hero, and calls the drowned when the ice breaks
      if (e.cd.b <= 0 && d <= 8 && los(m, e, p) && this.laneClear(e, p, 'bolt')) {
        this.telegraph([{ x: p.x, y: p.y }, ...around(1).filter(() => chance(0.5))], rint(12, 18), 'frost');
        e.cd.b = half ? 3 : 4; return true;
      }
      if (e.cd.a <= 0 && this.summon(e, half ? 'paleGolem' : 'drowned', 1, 2)) { e.cd.a = 8; return true; }
      if (d <= 1 && e.cd.c <= 0) {
        const spots = this.freeCells(0).filter((c) => this.vis[c.y * m.w + c.x] && dist(c, p) >= 4 && dist(c, p) <= 8);
        if (spots.length) {
          const c = pick(spots);
          this.emit({ t: 'fx', k: 'blink', x: e.x, y: e.y, x1: c.x, y1: c.y });
          e.x = c.x; e.y = c.y; e.cd.c = 6; return true;
        }
      }
    } else if (e.type === 'firstKing') {
      // the last one: everything the other five did, at once
      if (e.cd.a <= 0 && this.summon(e, half ? 'firstKnight' : 'hollow', half ? 1 : 3, 4)) { e.cd.a = 7; return true; }
      if (e.cd.b <= 0 && d <= 8) {
        this.telegraph(around(2).filter(() => chance(half ? 0.5 : 0.3)).concat([{ x: p.x, y: p.y }]), rint(16, 24), 'bone');
        e.cd.b = half ? 3 : 5; return true;
      }
      if (e.cd.c <= 0 && d <= 2) {
        p.st.stun = 1; p.st.web = 1;
        this.say(t('lStunned'), 'bad');
        e.cd.c = 6; return true;
      }
      enrage();
    } else if (e.type === 'drownedDrake') {
      // breathes frost down a straight line that stops at the first wall, sinks when you close in, calls the drowned
      if (d <= 1 && e.cd.c <= 0) {
        const spots = this.freeCells(0).filter((c) => this.vis[c.y * m.w + c.x] && dist(c, p) >= 4 && dist(c, p) <= 7);
        if (spots.length) {
          const c = pick(spots);
          this.emit({ t: 'fx', k: 'blink', x: e.x, y: e.y, x1: c.x, y1: c.y });
          e.x = c.x; e.y = c.y; e.cd.c = half ? 5 : 7; return true;
        }
      }
      if (e.cd.b <= 0 && d <= 7 && los(m, e, p)) {
        const dx = p.x - e.x, dy = p.y - e.y, k = Math.max(Math.abs(dx), Math.abs(dy)) || 1, cells = [];
        for (let i = 1; i <= 10; i++) {
          const c = { x: e.x + Math.round((dx * i) / k), y: e.y + Math.round((dy * i) / k) };
          if (tile(m, c.x, c.y) === WALL) break;
          cells.push(c);
        }
        this.telegraph(cells, rint(18, 26), 'frost');
        e.cd.b = half ? 3 : 4; return true;
      }
      if (e.cd.a <= 0 && this.summon(e, 'drowned', half ? 2 : 1, 3)) { e.cd.a = 8; return true; }
    } else if (e.type === 'ashWyrm') {
      // beats its wings: ash falls around the hero; the cinders it sheds hunt; up close, it sets you alight
      if (e.cd.a <= 0 && this.summon(e, half ? 'emberling' : 'cinderHound', half ? 3 : 1, half ? 6 : 2)) { e.cd.a = 7; return true; }
      if (e.cd.b <= 0 && d <= 8) {
        this.telegraph(around(3).filter(() => chance(half ? 0.4 : 0.25)).concat([{ x: p.x, y: p.y }]), rint(20, 28), 'fire');
        e.cd.b = half ? 3 : 4; return true;
      }
      if (half && e.cd.c <= 0 && d <= 2) {
        p.st.burn = Math.max(p.st.burn || 0, 3); p.st.burnDmg = 8;
        this.say(t('lBurn', 8), 'bad');
        e.cd.c = 6; return true;
      }
      enrage();
    } else if (e.type === 'warden') {
      // the bars of the door: a cross through the hero, then an X, turn after turn. A step to the side always clears it.
      if (e.cd.a <= 0 && this.summon(e, half ? 'paleGolem' : 'hollow', half ? 1 : 2, half ? 2 : 4)) { e.cd.a = 8; return true; }
      if (e.cd.b <= 0 && d <= 8) {
        const r = half ? 5 : 3, lines = e.flip ? DIRS.slice(4) : DIRS.slice(0, 4), cells = [{ x: p.x, y: p.y }];
        for (const [dx, dy] of lines) for (let i = 1; i <= r; i++) cells.push({ x: p.x + dx * i, y: p.y + dy * i });
        e.flip = !e.flip;
        this.telegraph(cells, rint(22, 30), 'bone');
        e.cd.b = half ? 3 : 4; return true;
      }
    }
    return false;
  }

  hazardPhase() {
    const p = this.player;
    // traps the player laid and clouds he raised: they never go off by themselves, they wait for a foot
    for (const h of this.hazards) {
      if (h.kind === 'trap') for (const e of this.enemies) {
        if (e.ally || e.hp <= 0 || e.x !== h.x || e.y !== h.y) continue;
        this.emit({ t: 'fx', k: 'blast', x: h.x, y: h.y, kind: 'trap' });
        this.damage(e, h.dmg, false, p);
        e.st.stun = Math.max(e.st.stun || 0, h.hold + (this.flags().has('pittrap') ? 1 : 0));
        h.done = true;
      }
      if (h.kind === 'miasma') {
        for (const e of this.enemies) if (!e.ally && e.hp > 0 && dist(e, h) <= 1) this.poison(e, h.dmg, 3);
        h.turns--;
        if (h.turns <= 0) h.done = true;
      }
    }
    this.hazards = this.hazards.filter((h) => !h.done);
    const now = this.hazards.filter((h) => h.at <= this.turn);
    this.hazards = this.hazards.filter((h) => h.at > this.turn || h.kind === 'trap' || h.kind === 'miasma');
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
