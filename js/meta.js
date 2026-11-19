// Sanctuary progress and the run in progress, kept in localStorage; merged with the cloud copy after sign-in.
import { RELICS } from './data.js';

const KEY = 'd101_meta', RUN = 'd101_run';
export const blankMeta = () => ({ v: 1, embers: 0, earned: 0, upgrades: {}, relics: {}, vault: null, stats: { runs: 0, wins: 0, best: 0, kills: 0, bestScore: 0 }, history: [], name: '', at: 0 });

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export function loadMeta() { const m = read(KEY) || {}; return { ...blankMeta(), ...m, stats: { ...blankMeta().stats, ...(m.stats || {}) } }; }
export function saveMeta(m) { m.at = Date.now(); write(KEY, m); }
export const loadRun = () => read(RUN);
export const saveRun = (g) => write(RUN, g);
export const clearRun = () => { try { localStorage.removeItem(RUN); } catch { /* nothing to clear */ } };

export const upgradeCost = (u, meta) => u.cost[meta.upgrades[u.id] || 0];

export function buy(meta, u) {
  const lvl = meta.upgrades[u.id] || 0, cost = u.cost[lvl];
  if (lvl >= u.max || meta.embers < cost) return false;
  meta.embers -= cost; meta.upgrades[u.id] = lvl + 1;
  return true;
}

// apply the end of a run to the sanctuary; returns what the end screen shows
export function finishRun(meta, g) {
  const embers = g.embers(), score = g.score(), win = g.over === 'win', s = meta.stats;
  meta.embers += embers; meta.earned += embers;
  s.runs++; if (win) s.wins++;
  s.best = Math.max(s.best, g.floor); s.kills += g.stats.kills; s.bestScore = Math.max(s.bestScore, score);
  const newRelics = [];
  for (const [id, r] of Object.entries(RELICS)) if (g.stats.bosses.includes(r.boss) && !meta.relics[id]) { meta.relics[id] = 1; newRelics.push(id); }
  if (meta.upgrades.heirloom) { const it = g.bestItem(); if (it) meta.vault = { ...it }; }
  meta.history.unshift({ name: g.player.name, cls: g.player.cls, floor: g.floor, score, win, at: Date.now() });
  meta.history = meta.history.slice(0, 12);
  return { embers, score, win, newRelics };
}

// local and cloud copies: the one that earned more embers wins, relics and records are combined
export function mergeMeta(a, b) {
  if (!b) return a;
  if (!a) return b;
  const [hi, lo] = (a.earned || 0) >= (b.earned || 0) ? [a, b] : [b, a];
  const out = { ...blankMeta(), ...hi, relics: { ...lo.relics, ...hi.relics }, stats: { ...blankMeta().stats, ...hi.stats } };
  for (const k of Object.keys(out.stats)) out.stats[k] = Math.max(hi.stats?.[k] || 0, lo.stats?.[k] || 0);
  const seen = new Set();
  out.history = [...(hi.history || []), ...(lo.history || [])].filter((r) => !seen.has(r.at) && seen.add(r.at)).sort((x, y) => y.at - x.at).slice(0, 12);
  return out;
}
