// Screens, HUD, overlays and input. Wires the rules (game.js) to the renderer and to saving.
import { CLASSES, SKILLS, TALENTS, BRANCHES, ENEMIES, RELIC_MAX, RARITIES, UPGRADES, RELICS, CONSUMABLES, SLOT_ICON, HERO_NAMES, actOf, isBossFloor, FLOORS } from './data.js';
import { Game, itemName, itemLines, itemScore, xpNext } from './game.js';
import { Renderer } from './render.js';
import { path as findPath, walkable, DIRS, dist } from './dungeon.js';
import { t, L, lang, setLang } from './i18n.js';
import { icon } from './icons.js';
import { sfx, ambient, soundOn, setSound } from './audio.js';
import { loadMeta, saveMeta, loadRun, saveRun, clearRun, finishRun, mergeMeta, buy } from './meta.js';
import { Cloud } from './cloud.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } };

let meta = loadMeta();
let g = null, R = null, screen = 'title', overlay = null;
let targeting = null, walk = null, focusId = null, held = null, endShown = false;
const BRANCH_ICONS = Object.fromEntries(Object.entries(BRANCHES).map(([id, bs]) => [id, bs.map((b) => b.icon)]));
// every picture the renderer may need; a file that is missing falls back to a plain token
const ART = [...new Set([
  ...Object.values(CLASSES).map((c) => c.art),
  ...Object.values(ENEMIES).map((e) => e.art),
  'death', 'victory',
])];

// ---------- screens ----------
function show(id) {
  screen = id;
  $$('.screen').forEach((s) => s.classList.toggle('on', s.id === `s-${id}`));
  document.body.dataset.screen = id;
  if (id !== 'game') { closeOverlay(); ambient(null); }
  ({ title: renderTitle, select: renderSelect, sanctuary: renderSanctuary, hall: renderHall }[id])?.();
}

function renderTitle() {
  const saved = loadRun();
  $('#s-title .menu').innerHTML = `
    ${saved ? `<button class="btn gold" data-go="continue">${icon('play')}<span>${t('continue')}</span><small>${esc(saved.player?.name || '')} · ${t('floor', saved.floor)}</small></button>` : ''}
    <button class="btn ${saved ? '' : 'gold'}" data-go="new">${icon('swords')}<span>${t('newRun')}</span></button>
    <button class="btn" data-go="sanctuary">${icon('flame')}<span>${t('sanctuary')}</span><small>${meta.embers} ${t('embers').toLowerCase()}</small></button>
    <button class="btn" data-go="hall">${icon('trophy')}<span>${t('hall')}</span></button>`;
  $('#s-title .tagline').textContent = t('tagline');
  renderAccount();
  renderToggles();
}

function renderAccount() {
  const box = $('#account');
  if (!Cloud.ready) { box.innerHTML = `<p class="muted">${t('offline')}</p>`; return; }
  box.innerHTML = Cloud.user
    ? `<p>${icon('check')} ${esc(t('signedAs', Cloud.firstName()))}</p><button class="link" data-go="signout">${t('signOut')}</button>`
    : `<button class="btn small google" data-go="signin">${icon('log-in')}<span>${t('signIn')}</span></button><p class="muted">${t('offline')}</p>`;
}

function renderToggles() {
  $('#toggles').innerHTML = `
    <button class="chip" data-go="lang" aria-label="${t('language')}">${lang === 'it' ? 'IT · <b>EN</b>' : '<b>EN</b> · IT'}</button>
    <button class="chip icon-only" data-go="sound" aria-label="${t('sound')}">${icon(soundOn() ? 'volume-2' : 'volume-x')}</button>
    <button class="chip icon-only" data-go="info" aria-label="${t('controls')}">${icon('circle-help')}</button>`;
}

let pick = { cls: read('d101_cls', 'warrior'), relic: null, heir: false, name: '' };
function renderSelect() {
  pick.name = pick.name || meta.name || HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)];
  const stat = (v, max) => `<i style="--v:${Math.min(1, v / max)}"></i>`;
  const relics = Object.entries(RELICS).filter(([id]) => meta.relics[id]);
  const vault = meta.upgrades.heirloom && meta.vault;
  $('#s-select .body').innerHTML = `
    <h2>${t('chooseClass')}</h2>
    <div class="classes">${Object.entries(CLASSES).map(([id, c]) => `
      <button class="card class ${pick.cls === id ? 'sel' : ''}" data-cls="${id}" style="--c:${c.color}">
        <img src="assets/img/${c.art}.webp" alt="" width="160" height="160">
        <h3>${L(c.name)}</h3><p>${L(c.blurb)}</p>
        <div class="bars"><span>PV ${stat(c.hp, 42)}</span><span>${t('armor')} ${stat(c.ac - 8, 9)}</span><span>${lang === 'it' ? 'Danni' : 'Damage'} ${stat(c.dmg[1] + (SKILLS[c.skills[0]].target === 'enemy' ? 6 : 0), 13)}</span></div>
        <div class="skill">${icon(SKILLS[c.skills[0]].icon)}<div><b>${L(SKILLS[c.skills[0]].name)}</b><small>${L(SKILLS[c.skills[0]].desc)}</small></div></div>
      </button>`).join('')}</div>
    <div class="row">
      <label class="field"><span>${t('heroName')}</span><input id="hero-name" maxlength="16" value="${esc(pick.name)}" autocomplete="off" spellcheck="false"></label>
      <button class="btn icon-only" data-go="reroll" aria-label="Random">${icon('rotate-ccw')}</button>
    </div>
    ${relics.length ? `<div class="pickrow"><span>${t('relic')}</span>
      <button class="chip ${!pick.relic ? 'sel' : ''}" data-relic="">${t('noRelic')}</button>
      ${relics.map(([id, r]) => `<button class="chip ${pick.relic === id ? 'sel' : ''}" data-relic="${id}" title="${esc(L(r.desc))}">${icon(r.icon)} ${L(r.name)} <em class="lv">${'★'.repeat(meta.relics[id] || 1)}</em></button>`).join('')}</div>` : ''}
    ${vault ? `<div class="pickrow"><span>${t('heirloom')}</span>
      <button class="chip ${pick.heir ? 'sel' : ''}" data-heir="1" style="color:${RARITIES[vault.rarity].color}">${icon(SLOT_ICON[vault.slot])} ${esc(itemName(vault))}</button>
      <button class="chip ${!pick.heir ? 'sel' : ''}" data-heir="">${t('noHeirloom')}</button></div>` : ''}
    <div class="actions"><button class="btn" data-go="title">${icon('x')}<span>${t('back')}</span></button>
    <button class="btn gold big" data-go="begin">${icon('arrow-down-to-line')}<span>${t('begin')}</span></button></div>`;
}

function renderSanctuary() {
  const s = meta.stats;
  $('#s-sanctuary .body').innerHTML = `
    <h2>${t('sanctuary')}</h2>
    <p class="embers">${icon('flame')} <b>${meta.embers}</b> ${t('embers')}</p>
    <div class="upgrades">${UPGRADES.map((u) => {
      const lvl = meta.upgrades[u.id] || 0, cost = u.cost[lvl], max = lvl >= u.max;
      return `<div class="card up ${max ? 'max' : ''}">
        <div class="ic">${icon(u.icon)}</div>
        <div><h3>${L(u.name)}</h3><p>${L(u.desc)}</p><div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn small ${!max && meta.embers >= cost ? 'gold' : ''}" data-buyup="${u.id}" ${max || meta.embers < cost ? 'disabled' : ''}>${max ? t('maxed') : `${icon('flame')} ${cost}`}</button>
      </div>`;
    }).join('')}</div>
    <h3 class="sub">${t('relics')}</h3>
    <div class="relics">${Object.entries(RELICS).map(([id, r]) => {
      const lv = meta.relics[id] || 0;
      return `<div class="card relic ${lv ? 'on' : ''}">${icon(lv ? r.icon : 'lock')}<div><b>${L(r.name)}${lv ? ` <em class="stars">${'★'.repeat(lv)}${'☆'.repeat(RELIC_MAX - lv)}</em>` : ''}</b><small>${lv ? L(r.desc) : t('relicLocked', L(ENEMIES[r.boss].name))}</small>${lv && lv < RELIC_MAX ? `<small class="muted">${t('relicNext', lv + 1, L(r.per))}</small>` : ''}</div></div>`;
    }).join('')}</div>
    <h3 class="sub">${t('lifetime')}</h3>
    <div class="lifetime"><span><b>${s.runs}</b>${t('runs')}</span><span><b>${s.best}</b>${t('bestFloor')}</span><span><b>${s.wins}</b>${t('wins')}</span><span><b>${s.kills}</b>${t('totalKills')}</span></div>
    <div class="actions"><button class="btn" data-go="title">${icon('x')}<span>${t('back')}</span></button><button class="btn gold" data-go="new">${icon('swords')}<span>${t('newRun')}</span></button></div>`;
}

let hallTab = 'global';
async function renderHall() {
  const body = $('#s-hall .body');
  const row = (r, i) => `<tr class="${r.win ? 'win' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td>${L(CLASSES[r.cls]?.name)}</td><td>${r.win ? icon('crown') : r.floor}</td><td>${r.score}</td></tr>`;
  const table = (rows) => rows.length ? `<table><thead><tr><th>#</th><th>${t('heroName')}</th><th></th><th>${t('statFloor')}</th><th>${t('statScore')}</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table>` : `<p class="muted center">${t('hallEmpty')}</p>`;
  body.innerHTML = `<h2>${t('hall')}</h2>
    <div class="tabs"><button class="chip ${hallTab === 'global' ? 'sel' : ''}" data-tab="global">${t('hallGlobal')}</button><button class="chip ${hallTab === 'mine' ? 'sel' : ''}" data-tab="mine">${t('hallMine')}</button></div>
    <div class="board">${hallTab === 'mine' ? table(meta.history) : `<p class="muted center">${t(Cloud.ready ? 'hallLoading' : 'hallError')}</p>`}</div>
    ${hallTab === 'global' && Cloud.ready && !Cloud.user ? `<p class="muted center">${t('hallSignIn')}</p>` : ''}
    <div class="actions"><button class="btn" data-go="title">${icon('x')}<span>${t('back')}</span></button></div>`;
  if (hallTab === 'global' && Cloud.ready) {
    try { const rows = await Cloud.top(25); if (screen === 'hall' && hallTab === 'global') $('#s-hall .board').innerHTML = table(rows); }
    catch (e) { console.warn(e); if (screen === 'hall') $('#s-hall .board').innerHTML = `<p class="muted center">${t('hallError')}</p>`; }
  }
}

// ---------- run lifecycle ----------
function startRun(game) {
  g = game; endShown = false; targeting = null; walk = null; focusId = null;
  R.setGame(g);
  show('game');
  floorIntro();
  hud();
}

function newRun() {
  const name = ($('#hero-name')?.value || pick.name).trim().slice(0, 16) || 'Hero';
  meta.name = name; write('d101_cls', pick.cls);
  const heirloom = pick.heir && meta.vault ? meta.vault : null;
  if (heirloom) meta.vault = null;
  saveMeta(meta); pushMeta();
  const run = Game.create({ cls: pick.cls, name, relic: pick.relic, relicLvl: pick.relic ? meta.relics[pick.relic] || 1 : 1, heirloom, meta });
  if (CLASSES[pick.cls].skills.includes('beast')) run.useSkill('beast'); // the hunter's wolf is there from the first turn
  run.ev.length = 0;
  startRun(run);
  saveRun(g);
}

function floorIntro() {
  const act = actOf(g.floor);
  ambient(act.id);
  const box = $('#floor-card');
  box.innerHTML = `<small>${t('floorOf', g.floor, FLOORS)}</small><b>${L(act.name)}</b>${isBossFloor(g.floor) ? `<small class="danger">${icon('skull')}</small>` : ''}`;
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
}

// ---------- actions ----------
function act(a) {
  if (!g || g.over || overlay) return false;
  if (R.busy()) R.flush();
  const ok = g.act(a);
  after();
  return ok;
}

function after() {
  const ev = g.ev.splice(0);
  const fi = ev.findIndex((e) => e.t === 'floor');
  if (fi >= 0) { sfx('descend'); R.setGame(g); floorIntro(); R.play(ev.slice(fi + 1)); }
  else R.play(ev);
  for (const e of ev) {
    if (e.t === 'boss') bossIntro(e.id);
    if (e.t === 'shop') setTimeout(() => { if (!g.over && !overlay) shop(); }, 260);
    if (e.t === 'level') toast(`${t('levelUp', e.lvl)} <small>${t('talentPoint')}</small>`, 'gold');
    if ((e.t === 'atk' || e.t === 'shot') && (e.a === g.player.id ? e.d : e.a) !== g.player.id) focusId = e.a === g.player.id ? e.d : e.a;
    if (e.t === 'fx' && e.k === 'pickup' && e.it.slot !== 'use') toast(`${icon(SLOT_ICON[e.it.slot])} <span style="color:${RARITIES[e.it.rarity].color}">${esc(t('newItem', itemName(e.it)))}</span>`);
  }
  if (g.over) { walk = null; targeting = null; R.targets = null; R.path = null; return endRun(); }
  saveRun(g);
  hud();
}

function endRun() {
  if (endShown) return;
  endShown = true;
  clearRun();
  const res = finishRun(meta, g);
  saveMeta(meta);
  pushMeta();
  if (Cloud.user && res.score > 0) Cloud.submit({ name: g.player.name, cls: g.player.cls, floor: g.floor, score: res.score, win: res.win, kills: g.stats.kills, turns: g.turn }).catch((e) => console.warn(e));
  hud();
  setTimeout(() => {
    if (res.win) sfx('win');
    const s = g.stats;
    openOverlay('end', `
      <div class="end ${res.win ? 'win' : ''}">
        <img class="art" src="assets/img/${res.win ? 'victory' : 'death'}.webp" alt="">
        <h2>${t(res.win ? 'victory' : 'youDied')}</h2>
        <p>${res.win ? t('winText') : esc(t('slainBy', byName(g.killer), g.floor))}</p>
        <div class="lifetime"><span><b>${g.floor}</b>${t('statFloor')}</span><span><b>${g.player.lvl}</b>${t('statLevel')}</span><span><b>${s.kills}</b>${t('statKills')}</span><span><b>${s.gold}</b>${t('statGold')}</span><span><b>${res.score}</b>${t('statScore')}</span></div>
        <p class="embers">${icon('flame')} ${t('embersEarned', res.embers)}</p>
        ${res.newRelics.map((id) => `<p class="relic-new">${icon(RELICS[id].icon)} ${t('newRelic', L(RELICS[id].name))}</p>`).join('')}
        <div class="actions"><button class="btn" data-go="title">${t('menu')}</button><button class="btn" data-go="sanctuary">${icon('flame')}<span>${t('toSanctuary')}</span></button><button class="btn gold" data-go="new">${icon('swords')}<span>${t('again')}</span></button></div>
      </div>`, true);
  }, res.win ? 2400 : 1700);
}

// Italian: "da" + article becomes "dal", "dalla", "dall'"
const byName = (n) => (lang !== 'it' ? n : n === 'Veleno' ? 'l veleno' : /^Il /.test(n) ? n.replace(/^Il /, 'l ') : /^La /.test(n) ? n.replace(/^La /, 'lla ') : /^L'/.test(n) ? n.replace(/^L'/, "ll'") : ' ' + n);

function useSkill(id) {
  if (!g || g.over || overlay) return;
  const sk = SKILLS[id];
  if (!g.skills().includes(id)) return;
  if ((g.player.cds[id] || 0) > 0) { pulse(`[data-skill="${id}"]`); return; }
  if (g.player.mp < g.skillCost(id)) { g.say(t('lNoMana')); hud(); pulse(`[data-skill="${id}"]`); return; }
  if (!sk.target) { act({ type: 'skill', id }); return; }
  if (targeting && targeting.id === id) { confirmTarget(); return; }
  const list = g.targets(id);
  if (!list.length) { g.say(t('lNoTarget')); hud(); pulse(`[data-skill="${id}"]`); return; }
  if (list.length === 1 && sk.target !== 'tile') { act({ type: 'skill', id, x: list[0].x, y: list[0].y }); return; }
  let sel = list[0];
  if (sk.target === 'tile') { // default: the reachable tile farthest from the closest enemy
    const foes = g.visibleEnemies();
    const score = (c) => (foes.length ? Math.min(...foes.map((e) => dist(e, c))) : 0) * 10 + dist(c, g.player);
    sel = [...list].sort((a, b) => score(b) - score(a))[0];
  }
  targeting = { id, list, sel };
  R.targets = { list, sel };
  $('#hint').textContent = t('targetHint'); $('#hint').classList.add('on');
  hud();
}
function confirmTarget(c) {
  const tg = targeting; if (!tg) return;
  const sel = c || tg.sel;
  cancelTarget();
  act({ type: 'skill', id: tg.id, x: sel.x, y: sel.y });
}
function cancelTarget() { targeting = null; R.targets = null; $('#hint').classList.remove('on'); hud(); }
function cycleTarget(dir = 1) {
  if (!targeting) return;
  const i = targeting.list.indexOf(targeting.sel);
  targeting.sel = targeting.list[(i + dir + targeting.list.length) % targeting.list.length];
  R.targets.sel = targeting.sel;
}

// tap or click on the map
function tapTile(tx, ty) {
  if (!g || g.over || overlay) return;
  const p = g.player, m = g.map;
  if (targeting) { const c = targeting.list.find((q) => q.x === tx && q.y === ty); if (c) confirmTarget(c); else cancelTarget(); return; }
  if (tx === p.x && ty === p.y) { if (g.onStairs()) act({ type: 'descend' }); else act({ type: 'wait' }); return; }
  const dx = tx - p.x, dy = ty - p.y;
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) { act({ type: 'move', dx, dy }); return; }
  if (!m.seen[ty * m.w + tx]) return;
  const enemy = g.enemyAt(tx, ty);
  const route = findPath(m, p, { x: tx, y: ty }, (x, y) => !m.seen[y * m.w + x] || ((g.enemyAt(x, y) || g.chestAt(x, y)) && !(x === tx && y === ty)));
  if (!route) return;
  walk = { route, enemies: new Set(g.visibleEnemies().map((e) => e.id)), hp: p.hp, attack: !!enemy, next: 0 };
  R.path = route;
}

function stepWalk(now) {
  if (!walk || now < walk.next || !g || overlay) return;
  const p = g.player;
  const fresh = g.visibleEnemies().some((e) => !walk.enemies.has(e.id) || (e.awake && !walk.attack));
  if (!walk.route.length || p.hp < walk.hp || (fresh && !walk.attack)) { walk = null; R.path = null; return; }
  const s = walk.route[0];
  const before = p.x + ',' + p.y;
  const ok = act({ type: 'move', dx: s.x - p.x, dy: s.y - p.y });
  if (!ok) { walk = null; R.path = null; return; }
  if (before !== p.x + ',' + p.y) walk.route.shift(); else if (!g.enemyAt(s.x, s.y)) walk.route.shift();
  if (walk) { walk.next = now + 95; R.path = walk.route; walk.hp = p.hp; }
}

// ---------- HUD ----------
function hud() {
  if (!g) return;
  const p = g.player, st = g.ps(), c = CLASSES[p.cls], act = actOf(g.floor);
  $('#hero').style.setProperty('--c', c.color);
  $('#hero .face').src = `assets/img/${c.art}.webp`;
  $('#hero .name').textContent = p.name;
  $('#hero .lvl').textContent = t('level', p.lvl);
  setBar('#hp', p.hp, st.maxHp, `${p.hp} / ${st.maxHp}`);
  setBar('#xp', p.xp, xpNext(p.lvl), '');
  setBar('#mp', p.mp, g.manaPool(), `${p.mp} / ${g.manaPool()}`);
  $('#mp').classList.toggle('low', p.mp < g.manaRegen());
  const sts = [];
  if (p.st.poison > 0) sts.push(['droplet', '#8cf05a', p.st.poison]);
  if (p.st.stun > 0) sts.push(['zap', '#ffe46b', p.st.stun]);
  if (p.st.web > 0) sts.push(['target', '#e8e8e8', p.st.web]);
  if (p.st.invis > 0) sts.push(['eye', '#b9a9ff', p.st.invis]);
  if (p.venom > 0) sts.push(['droplet', '#5ee08a', p.venom]);
  if (g.relic) sts.push([RELICS[g.relic].icon, '#ffd36b', '']);
  $('#hero .st').innerHTML = sts.map(([n, col, v]) => `<span style="color:${col}">${icon(n)}${v}</span>`).join('');
  $('#where').innerHTML = `<b>${L(act.name)}</b><span>${t('floorOf', g.floor, FLOORS)}</span><span class="gold">${icon('coins')} ${p.gold}</span>`;
  // skills
  const known = g.skills();
  $('#skills').innerHTML = c.skills.map((id, i) => {
    const sk = SKILLS[id], k = known.includes(id), cd = p.cds[id] || 0, cost = g.skillCost(id), poor = k && !cd && p.mp < cost;
    return `<button class="act ${!k ? 'locked' : ''} ${cd || poor ? 'cd' : ''} ${targeting?.id === id ? 'aim' : ''}" data-skill="${id}" ${!k ? 'disabled' : ''} title="${esc(L(sk.name) + ' · ' + L(sk.desc))}">
      ${icon(k ? sk.icon : 'lock')}<kbd>${i + 1}</kbd>${cd ? `<em>${cd}</em>` : `<em class="cost ${poor ? 'poor' : ''}">${cost}</em>`}<span>${L(sk.name)}</span></button>`;
  }).join('') + `
    <button class="act potion" data-go="potion" title="${esc(L(CONSUMABLES.heal.name))}">${icon('flask-conical')}<kbd>4</kbd><em class="n">${p.bag.filter((x) => x.kind === 'heal').length}</em><span>${t('potion')}</span></button>
    <button class="act" data-go="wait" title="${t('wait')}">${icon('hourglass')}<kbd>5</kbd><span>${t('wait')}</span></button>
    ${g.onStairs() ? `<button class="act stairs" data-go="descend">${icon('arrow-down-to-line')}<kbd>↵</kbd><span>${t('descend')}</span></button>` : ''}`;
  $('#btn-talents').classList.toggle('glow', p.points > 0);
  $('#btn-talents em').textContent = p.points || '';
  // boss bar
  const boss = g.enemies.find((e) => e.boss && e.awake);
  $('#bossbar').classList.toggle('on', !!boss);
  if (boss) { $('#bossbar .n').textContent = L(ENEMIES[boss.type].name); setBar('#bossbar', boss.hp, boss.maxHp, ''); }
  // focus: the last enemy you traded blows with, else the closest awake one
  let f = g.enemies.find((e) => e.id === focusId && g.vis[e.y * g.map.w + e.x] && !e.boss);
  if (!f) f = g.visibleEnemies().filter((e) => e.awake && !e.boss).sort((a, b) => dist(a, p) - dist(b, p))[0];
  $('#focus').classList.toggle('on', !!f);
  if (f) {
    $('#focus .face').src = `assets/img/${ENEMIES[f.type].art}.webp`;
    $('#focus .n').innerHTML = `${esc(L(ENEMIES[f.type].name))}${f.elite ? ` <i>${lang === 'it' ? 'élite' : 'elite'}</i>` : ''}`;
    setBar('#focus', f.hp, f.maxHp, `${f.hp} / ${f.maxHp}`);
  }
  $('#log').innerHTML = g.log.slice(-5).map((l, i, a) => `<p class="${l.c}" style="opacity:${0.35 + 0.65 * (i + 1) / a.length}">${esc(l.s)}</p>`).join('');
  R.drawMinimap(overlay === 'map');
}

function setBar(sel, v, max, txt) {
  const el = $(sel), k = Math.max(0, Math.min(1, v / max));
  el.style.setProperty('--k', k);
  const tx = $('.bt', el); if (tx) tx.textContent = txt;
}

function toast(html, cls = '') {
  const el = document.createElement('div');
  el.className = `toast ${cls}`; el.innerHTML = html;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 2600);
}
function pulse(sel) { const el = $(sel); if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } }

function bossIntro(id) {
  const e = g.enemies.find((x) => x.id === id); if (!e) return;
  const d = ENEMIES[e.type];
  sfx('boss'); R.shake(12);
  const box = $('#boss-card');
  box.innerHTML = `<img src="assets/img/${d.art}.webp" alt=""><div><small>${L(d.title)}</small><b>${L(d.name)}</b></div>`;
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
}

// ---------- overlays ----------
function openOverlay(id, html, locked = false) {
  overlay = id;
  const o = $('#overlay');
  o.className = `overlay on o-${id}`;
  o.innerHTML = `<div class="panel">${locked ? '' : `<button class="close" data-go="close" aria-label="${t('back')}">${icon('x')}</button>`}${html}</div>`;
  o.dataset.locked = locked ? '1' : '';
  if (held) held = null;
}
function closeOverlay() {
  if (!overlay || $('#overlay').dataset.locked) { if (screen !== 'game') { overlay = null; $('#overlay').className = 'overlay'; } return; }
  overlay = null; $('#overlay').className = 'overlay';
  if (g) hud();
}

let invSel = null;
// the bag: stacks show their count, gear shows a green corner when it beats what you wear
function inventory() {
  const p = g.player, st = g.ps();
  const slot = (s) => {
    const it = p.equip[s];
    return `<button class="slot ${invSel === it?.uid && it ? 'sel' : ''}" ${it ? `data-item="${it.uid}"` : 'disabled'} style="--r:${it ? RARITIES[it.rarity].color : '#555'}">${icon(SLOT_ICON[s])}<span>${it ? esc(itemName(it)) : t('empty')}</span><small>${t(s)}</small></button>`;
  };
  const all = [...Object.values(p.equip).filter(Boolean), ...p.bag];
  const sel = all.find((x) => x.uid === invSel) || null;
  let detail = '';
  if (sel) {
    const isEq = Object.values(p.equip).includes(sel), use = sel.slot === 'use';
    const cur = !use && !isEq ? p.equip[sel.slot] : null;
    const color = use ? CONSUMABLES[sel.kind].color : RARITIES[sel.rarity].color;
    const diff = cur ? itemScore(sel) - itemScore(cur) : 0;
    detail = `<div class="detail" style="--r:${color}">
      <h3>${icon(use ? CONSUMABLES[sel.kind].icon : SLOT_ICON[sel.slot])} ${esc(itemName(sel))}${use && (sel.n || 1) > 1 ? ` <em class="x">×${sel.n}</em>` : ''}</h3>
      <small>${use ? '' : `${L(RARITIES[sel.rarity].name)} · ${t(sel.slot)} · T${sel.tier}${cur ? ` · <b class="${diff >= 0 ? 'good' : 'bad'}">${diff >= 0 ? '+' : ''}${diff}</b>` : ''}`}</small>
      <ul>${itemLines(sel).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      ${cur ? `<p class="muted">${t('equipped')}: ${esc(itemName(cur))}</p><ul class="cmp">${itemLines(cur).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      <div class="actions">
        ${use ? `<button class="btn gold small" data-inv="use">${t('use')}</button>` : isEq ? '' : `<button class="btn gold small" data-inv="equip">${t('equip')}</button>`}
        ${isEq ? '' : `<button class="btn small" data-inv="drop">${t('drop')}</button>`}
      </div></div>`;
  }
  openOverlay('inv', `
    <h2>${icon('backpack')} ${t('inventory')}</h2>
    <div class="stats"><span>${icon('heart')} ${p.hp}/${st.maxHp}</span><span>${icon('droplet')} ${p.mp}/${g.manaPool()}</span><span>${icon('shield')} ${st.ac}</span><span>${icon('target')} +${st.hit}</span><span>${icon('sword')} ${st.dmg[0] + st.power}-${st.dmg[1] + st.power}</span><span>${icon('coins')} ${p.gold}</span></div>
    <div class="pane"><div class="left">
    <h4>${t('equipped')}</h4><div class="slots">${['weapon', 'armor', 'trinket'].map(slot).join('')}</div>
    <h4>${t('bag')} <small>${p.bag.length}/16</small></h4>
    <div class="bag">${p.bag.map((it) => {
      const use = it.slot === 'use', col = use ? CONSUMABLES[it.kind].color : RARITIES[it.rarity].color;
      const better = !use && itemScore(it) > itemScore(p.equip[it.slot]);
      const n = it.n || 1;
      return `<button class="cell ${invSel === it.uid ? 'sel' : ''}" data-item="${it.uid}" style="--r:${col}" title="${esc(itemName(it))}">${icon(use ? CONSUMABLES[it.kind].icon : SLOT_ICON[it.slot])}${n > 1 ? `<em class="n">${n}</em>` : ''}${better ? '<i class="up"></i>' : ''}</button>`;
    }).join('')}${Array.from({ length: Math.max(0, 16 - p.bag.length) }, () => '<span class="cell empty"></span>').join('')}</div>
    </div><div class="right">${detail || `<p class="hint">${icon('hand-pointer')} ${t('invHint')}</p>`}</div></div>`);
}

// the merchant: his stock on the left, what he pays for your things on the right
function shop() {
  const p = g.player, sh = g.shop();
  const line = (it, price, act) => {
    const use = it.slot === 'use', col = use ? CONSUMABLES[it.kind].color : RARITIES[it.rarity].color;
    return `<button class="trade" ${act} style="--r:${col}">${icon(use ? CONSUMABLES[it.kind].icon : SLOT_ICON[it.slot])}
      <span>${esc(itemName(it))}${(it.n || 1) > 1 ? ` ×${it.n}` : ''}<small>${use ? '' : L(RARITIES[it.rarity].name)}</small></span>
      <b>${icon('coins')}${price}</b></button>`;
  };
  openOverlay('shop', `
    <h2>${icon('store')} ${t('merchant')}</h2>
    <p class="muted">${t('lMerchant')} · ${icon('coins')} <b class="gold">${p.gold}</b></p>
    <div class="shop">
      <div><h4>${t('lBuy')}</h4><div class="trades">${sh.stock.filter((x) => !x.sold).map((x) => line(x.it, x.price, `data-buy="${x.i}" ${x.can ? '' : 'disabled'}`)).join('') || `<p class="muted">${t('lMerchantLeft')}</p>`}</div></div>
      <div><h4>${t('lSell')}</h4><div class="trades">${sh.sell.map((x) => line(x.it, x.price, `data-sell="${x.it.uid}"`)).join('') || `<p class="muted">${t('lNothingToSell')}</p>`}</div></div>
    </div>
    <div class="actions"><button class="btn small" data-close="1">${t('back')}</button></div>`);
}

let talSel = null;
function talents() {
  const p = g.player, tree = TALENTS[p.cls], names = BRANCHES[p.cls];
  const lvlOf = (n) => Number(n.id.slice(1).replace(/[ab]$/, ''));
  const has = (n) => !!p.talents[n.id];
  // a node is open when the level above in the same branch is bought, or when it is the first level
  const open = (n) => lvlOf(n) === 1 || tree[n.id.charCodeAt(0) - 65].some((x) => lvlOf(x) === lvlOf(n) - 1 && has(x));
  const spent = Object.values(p.talents).filter(Boolean).length;
  const node = (n) => {
    const state = has(n) ? 'has' : open(n) && p.points > 0 ? 'can' : open(n) ? 'open' : 'lock';
    const sk = Object.keys(n.eff || {}).find((k) => k.startsWith('skill:'));
    return `<button class="node ${state} ${talSel === n.id ? 'sel' : ''}" data-tal="${n.id}" title="${esc(L(n.name))}">${icon(sk ? SKILLS[sk.slice(6)].icon : BRANCH_ICONS[p.cls][n.id.charCodeAt(0) - 65])}<span>${L(n.name)}</span></button>`;
  };
  const sel = tree.flat().find((n) => n.id === talSel);
  let detail = '';
  if (sel) {
    const isOpen = open(sel), hasIt = has(sel);
    detail = `<div class="detail"><h3>${L(sel.name)}</h3><p>${L(sel.desc)}</p>
      <p class="muted">${L(names[sel.id.charCodeAt(0) - 65].name)} · ${t('talLevel', lvlOf(sel))}</p>
      <div class="actions">${hasIt ? `<span class="muted">${icon('check')} ${t('learned')}</span>` : !isOpen ? `<span class="muted">${icon('lock')} ${t('locked')}</span>` : p.points <= 0 ? `<span class="muted">${t('needPoint')}</span>` : `<button class="btn gold small" data-learn="${sel.id}">${t('learn')}</button>`}</div></div>`;
  }
  openOverlay('tal', `
    <h2>${icon('sparkles')} ${t('talents')}</h2>
    <p class="points">${t('points', p.points)} <small class="muted">${t('talSpent', spent)}</small></p>
    <div class="branches">${tree.map((br, b) => `<div class="branch">
      <h4>${icon(BRANCH_ICONS[p.cls][b])} ${L(names[b].name)}</h4>
      <div class="levels">${Array.from({ length: 10 }, (_, i) => `<div class="lvl"><i>${i + 1}</i>${br.filter((n) => lvlOf(n) === i + 1).map(node).join('')}</div>`).join('')}</div>
    </div>`).join('')}</div>
    ${detail}`);
}

function pauseMenu() {
  openOverlay('pause', `
    <h2>${t('pause')}</h2>
    <div class="menu">
      <button class="btn gold" data-go="close">${icon('play')}<span>${t('resume')}</span></button>
      <button class="btn" data-go="sound">${icon(soundOn() ? 'volume-2' : 'volume-x')}<span>${t('sound')}: ${t(soundOn() ? 'on' : 'off')}</span></button>
      <button class="btn" data-go="shake">${icon('move')}<span>${t('motion')}: ${t(R.shakeOn ? 'on' : 'off')}</span></button>
      <button class="btn" data-go="lang">${icon('settings')}<span>${t('language')}: ${lang.toUpperCase()}</span></button>
      <button class="btn" data-go="info">${icon('circle-help')}<span>${t('controls')}</span></button>
      <button class="btn" data-go="title">${icon('castle')}<span>${t('menu')}</span></button>
      <button class="btn danger" data-go="abandon">${icon('skull')}<span>${t('abandon')}</span></button>
    </div>`);
}

function info() {
  openOverlay('info', `<h2>${t('controls')}</h2><p>${t('controlsText')}</p><h2>${t('privacy')}</h2><p>${t('privacyText')}</p>
    <p class="muted">Dungeon101 · Davide Mariotti · <a href="https://github.com/Dungeon101/Dungeon101.github.io" target="_blank" rel="noopener">GitHub</a> · <a href="https://ko-fi.com/Z0X32ATNHL" target="_blank" rel="noopener">Ko-fi</a></p>`);
}

function mapView() {
  openOverlay('map', `<h2>${icon('map')} ${t('map')}</h2><div class="bigmap"></div>`);
  const holder = $('#overlay .bigmap');
  holder.append($('#minimap'));
  R.drawMinimap(true);
}
function restoreMinimap() { if ($('#minimap').parentElement !== $('#mapbox')) $('#mapbox').append($('#minimap')); }

// ---------- cloud ----------
async function pullMeta() {
  if (!Cloud.user) return;
  try {
    const remote = await Cloud.pull();
    meta = mergeMeta(meta, remote);
    saveMeta(meta);
    await Cloud.push(meta);
  } catch (e) { console.warn(e); toast(t('cloudOff')); }
  if (screen !== 'game') show(screen);
}
function pushMeta() { if (Cloud.user) Cloud.push(meta).catch((e) => console.warn(e)); }

// ---------- events ----------
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('button, [data-go]');
  if (!el) return;
  const go = el.dataset.go;
  if (el.dataset.close) { closeOverlay(); return; }
  if (el.dataset.cls) { pick.cls = el.dataset.cls; pick.name = $('#hero-name').value; sfx('click'); renderSelect(); return; }
  if (el.dataset.relic != null) { pick.relic = el.dataset.relic || null; pick.name = $('#hero-name').value; renderSelect(); return; }
  if (el.dataset.heir != null) { pick.heir = !!el.dataset.heir; pick.name = $('#hero-name').value; renderSelect(); return; }
  if (el.dataset.buyup) { if (buy(meta, UPGRADES.find((u) => u.id === el.dataset.buyup))) { saveMeta(meta); pushMeta(); sfx('level'); renderSanctuary(); } return; }
  if (el.dataset.tab) { hallTab = el.dataset.tab; renderHall(); return; }
  if (el.dataset.skill) { useSkill(el.dataset.skill); return; }
  if (el.dataset.item) { invSel = Number(el.dataset.item); inventory(); return; }
  if (el.dataset.inv) {
    const a = el.dataset.inv, uid = invSel;
    if (a === 'equip') { g.equip(uid); sfx('pickup'); invSel = null; saveRun(g); inventory(); }
    else if (a === 'drop') { g.drop(uid); invSel = null; saveRun(g); inventory(); }
    else if (a === 'use') { overlay = null; $('#overlay').className = 'overlay'; invSel = null; act({ type: 'use', uid }); }
    return;
  }
  if (el.dataset.tal) { talSel = el.dataset.tal; talents(); return; }
  if (el.dataset.buy) { if (g && g.buy(Number(el.dataset.buy))) { sfx('pickup'); saveRun(g); } if (overlay === 'shop') shop(); return; }
  if (el.dataset.sell) { if (g.sell(Number(el.dataset.sell))) { sfx('pickup'); saveRun(g); } shop(); return; }
  if (el.dataset.learn) { if (g.learn(el.dataset.learn)) { sfx('level'); saveRun(g); } talents(); return; }
  switch (go) {
    case 'continue': { const s = loadRun(); if (s) { try { startRun(new Game(s)); } catch (e) { console.error(e); clearRun(); show('title'); } } break; }
    case 'new': closeOverlay(); overlay = null; pick.name = ''; show('select'); break;
    case 'sanctuary': overlay = null; show('sanctuary'); break;
    case 'hall': show('hall'); break;
    case 'title': if (g && !g.over) saveRun(g); g = null; overlay = null; restoreMinimap(); show('title'); break;
    case 'begin': sfx('descend'); newRun(); break;
    case 'reroll': pick.name = HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)]; $('#hero-name').value = pick.name; break;
    case 'lang': setLang(lang === 'it' ? 'en' : 'it'); document.documentElement.lang = lang; staticText(); if (overlay === 'pause') pauseMenu(); else show(screen); if (g) hud(); break;
    case 'sound': setSound(!soundOn()); if (overlay === 'pause') pauseMenu(); else renderToggles(); break;
    case 'shake': R.shakeOn = !R.shakeOn; write('d101_shake', R.shakeOn ? '1' : '0'); pauseMenu(); break;
    case 'info': info(); break;
    case 'close': restoreMinimap(); closeOverlay(); break;
    case 'potion': if (!g.quickPotion()) pulse('[data-go="potion"]'); after(); break;
    case 'wait': act({ type: 'wait' }); break;
    case 'descend': act({ type: 'descend' }); break;
    case 'inv': if (overlay === 'inv') closeOverlay(); else { invSel = null; inventory(); } break;
    case 'shop': if (overlay === 'shop') closeOverlay(); else shop(); break;
    case 'tal': if (overlay === 'tal') closeOverlay(); else { talSel = null; talents(); } break;
    case 'map': if (overlay === 'map') { restoreMinimap(); closeOverlay(); } else mapView(); break;
    case 'pause': if (overlay === 'pause') closeOverlay(); else pauseMenu(); break;
    case 'abandon': if (confirm(t('confirmAbandon'))) { closeOverlay(); g.over = 'dead'; g.killer = g.player.name; endShown = false; endRun(); } break;
    case 'signin':
      try { await Cloud.signIn(); } catch (e) { console.warn(e); if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') toast(t('cloudOff')); }
      break;
    case 'signout': await Cloud.signOut(); renderAccount(); break;
    default: break;
  }
});

document.addEventListener('input', (e) => { if (e.target.id === 'hero-name') pick.name = e.target.value; });

const MOVES = {
  ArrowUp: [0, -1], KeyW: [0, -1], Numpad8: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], Numpad2: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], Numpad4: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], Numpad6: [1, 0],
  KeyQ: [-1, -1], Numpad7: [-1, -1], KeyE: [1, -1], Numpad9: [1, -1], KeyZ: [-1, 1], Numpad1: [-1, 1], KeyC: [1, 1], Numpad3: [1, 1],
};
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') { if (e.key === 'Enter' && screen === 'select') newRun(); return; }
  if (screen !== 'game' || !g) { if (e.key === 'Escape' && overlay) closeOverlay(); return; }
  const k = e.code;
  if (k === 'Escape') { if (targeting) cancelTarget(); else if (overlay) { restoreMinimap(); closeOverlay(); } else pauseMenu(); return; }
  if (k === 'KeyI') { $('[data-go="inv"]').click(); return; }
  if (k === 'KeyT') { $('[data-go="tal"]').click(); return; }
  if (k === 'KeyM') { $('[data-go="map"]').click(); return; }
  if (overlay || g.over) return;
  if (targeting) {
    if (k === 'Tab' || k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); cycleTarget(e.shiftKey ? -1 : 1); return; }
    if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); cycleTarget(-1); return; }
    if (k === 'Enter' || k === 'Space') { e.preventDefault(); confirmTarget(); return; }
  }
  const skills = CLASSES[g.player.cls].skills;
  if (k === 'Digit1' || k === 'Digit2' || k === 'Digit3') { useSkill(skills[Number(k[5]) - 1]); return; }
  if (k === 'Digit4' || k === 'KeyH') { if (!g.quickPotion()) pulse('[data-go="potion"]'); after(); return; }
  if (k === 'Space' || k === 'Digit5' || k === 'Numpad5' || k === 'Period') { e.preventDefault(); walk = null; act({ type: 'wait' }); return; }
  if (k === 'Enter' || k === 'NumpadEnter') { act({ type: 'descend' }); return; }
  if (MOVES[k] && !e.repeat) {
    e.preventDefault(); walk = null; R.path = null;
    if (targeting) cancelTarget();
    held = { k, dir: MOVES[k], next: performance.now() + 210 };
    act({ type: 'move', dx: MOVES[k][0], dy: MOVES[k][1] });
  } else if (MOVES[k]) e.preventDefault();
});
addEventListener('keyup', (e) => { if (held && held.k === e.code) held = null; });
addEventListener('blur', () => { held = null; });

function bindCanvas() {
  const cv = $('#game');
  const tileOf = (e) => { const r = cv.getBoundingClientRect(); return R.screenToTile(e.clientX - r.left, e.clientY - r.top); };
  cv.addEventListener('pointerdown', (e) => { if (e.button === 0) { const c = tileOf(e); tapTile(c.x, c.y); } });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !g) return;
    const c = tileOf(e); R.hover = c;
    const tip = $('#tip'), m = g.map, i = c.y * m.w + c.x;
    const en = g.vis[i] && g.enemyAt(c.x, c.y), it = m.seen[i] && g.items.find((o) => o.x === c.x && o.y === c.y);
    if (en) tip.innerHTML = `<b>${esc(L(ENEMIES[en.type].name))}</b>${en.elite ? ' · élite' : ''}<br>${icon('heart')} ${en.hp}/${en.maxHp} · ${icon('shield')} ${en.ac}`;
    else if (it) tip.innerHTML = `<b style="color:${it.it.kind === 'gold' ? '#ffd36b' : it.it.slot === 'use' ? CONSUMABLES[it.it.kind].color : RARITIES[it.it.rarity].color}">${esc(itemName(it.it))}</b>`;
    tip.classList.toggle('on', !!(en || it));
    tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
  });
  cv.addEventListener('pointerleave', () => { R.hover = null; $('#tip').classList.remove('on'); });
}

function staticText() {
  document.title = 'Dungeon101';
  for (const b of $$('[data-icon]')) if (!b.querySelector('svg')) b.insertAdjacentHTML('afterbegin', icon(b.dataset.icon));
  $('#btn-talents').title = t('talents'); $('[data-go="inv"]').title = t('inventory'); $('[data-go="map"]').title = t('map'); $('[data-go="pause"]').title = t('pause');
}

// title screen embers
function embers() {
  const cv = $('#embers'), c = cv.getContext('2d'), parts = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = () => {
    requestAnimationFrame(tick);
    if (screen === 'game') return;
    const w = cv.width = innerWidth, h = cv.height = innerHeight;
    if (!reduced && parts.length < 90 && Math.random() < 0.6) parts.push({ x: Math.random() * w, y: h + 10, vx: (Math.random() - 0.5) * 0.4, vy: -0.4 - Math.random() * 1.1, r: 0.6 + Math.random() * 2, l: 1 });
    c.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.x += p.vx + Math.sin((p.y + i) / 60) * 0.3; p.y += p.vy; p.l -= 0.0025;
      if (p.y < -10 || p.l <= 0) { parts.splice(i, 1); continue; }
      const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      gr.addColorStop(0, `rgba(255,190,100,${0.8 * p.l})`); gr.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = gr; c.fillRect(p.x - p.r * 4, p.y - p.r * 4, p.r * 8, p.r * 8);
    }
  };
  tick();
}

// ---------- boot ----------
async function boot() {
  document.documentElement.lang = lang;
  R = new Renderer($('#game'), $('#minimap'));
  R.sfx = sfx;
  R.shakeOn = read('d101_shake', '1') !== '0';
  bindCanvas();
  staticText();
  embers();
  show('title');
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (screen !== 'game' || !g) return;
    if (held && !overlay && !g.over && now >= held.next && !targeting) { held.next = now + 120; act({ type: 'move', dx: held.dir[0], dy: held.dir[1] }); }
    stepWalk(now);
    R.frame(now);
  };
  requestAnimationFrame(loop);
  if (/[?&]debug/.test(location.search)) window.d101 = { get g() { return g; }, R, after, hud, startRun, Game, shop, inventory, talents };
  await R.load(ART);
  Cloud.onChange((u) => { renderAccount(); if (u) pullMeta(); });
  Cloud.restore();
}
boot();
