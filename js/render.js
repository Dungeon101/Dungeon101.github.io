// Canvas renderer: painted floor textures, soft fog, dynamic torchlight, animated tokens, particles and the event timeline.
import { ENEMIES, CLASSES, CONSUMABLES, SLOT_ICON, RARITIES, actOf } from './data.js';
import { WALL, FLOOR, LAVA, WATER, tile } from './dungeon.js';
import { ICONS } from './icons.js';

const T = 48; // world pixels per tile
const rnd = (a, b) => a + Math.random() * (b - a);
const hash = (x, y, s = 0) => { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
const ease = (t) => 1 - (1 - t) ** 3;

const PALETTE = {
  crypt: { floor: [62, 60, 68], wall: [26, 25, 31], face: [84, 80, 90], mortar: [36, 34, 42], ambient: 0.42, dust: '#9aa4c8' },
  caves: { floor: [52, 64, 54], wall: [22, 30, 26], face: [64, 82, 70], mortar: [30, 40, 34], ambient: 0.44, dust: '#8cf0c0' },
  abyss: { floor: [62, 42, 46], wall: [24, 15, 18], face: [92, 52, 58], mortar: [40, 22, 26], ambient: 0.42, dust: '#ff9a5a' },
  forge: { floor: [70, 46, 38], wall: [32, 18, 16], face: [104, 58, 44], mortar: [46, 26, 22], ambient: 0.4, dust: '#ffb066' },
  cathedral: { floor: [44, 56, 66], wall: [20, 28, 38], face: [58, 76, 92], mortar: [26, 36, 46], ambient: 0.4, dust: '#bfe4ff' },
  throne: { floor: [54, 50, 60], wall: [22, 20, 28], face: [76, 70, 86], mortar: [32, 30, 40], ambient: 0.36, dust: '#d9c8ff' },
};
const rgb = (c, k = 1, a = 1) => `rgba(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)},${a})`;

const iconCache = new Map();
export function iconImage(name, color, size = 64, sw = 2) {
  const key = `${name}|${color}|${size}|${sw}`;
  if (!iconCache.has(key)) {
    const img = new Image();
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`);
    iconCache.set(key, img);
  }
  return iconCache.get(key);
}

export class Renderer {
  constructor(canvas, minimap) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.mini = minimap; this.mctx = minimap.getContext('2d');
    this.light = document.createElement('canvas'); this.lctx = this.light.getContext('2d');
    this.fog = document.createElement('canvas'); this.fctx = this.fog.getContext('2d');
    this.img = {}; this.vis = new Map(); this.parts = []; this.floats = []; this.shots = []; this.rings = [];
    this.queue = []; this.cam = { x: 0, y: 0 }; this.shakeP = 0; this.slow = 1; this.shakeOn = true;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.hover = null; this.targets = null; this.path = null;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  load(keys) {
    return Promise.all(keys.map((k) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { this.img[k] = im; res(); };
      im.onerror = () => res(); // a missing picture falls back to a plain token
      im.src = `assets/img/${k}.webp`;
    })));
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
    this.dpr = dpr; this.w = w; this.h = h;
    this.cv.width = w * dpr; this.cv.height = h * dpr;
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.light.width = Math.ceil(w / 2); this.light.height = Math.ceil(h / 2);
    // tile size on screen: about 11 tiles across a phone, up to 64px on a desktop
    this.tp = Math.max(34, Math.min(56, Math.round(Math.min(w / 11, h / 9))));
    this.z = this.tp / T;
  }

  setGame(g) {
    this.g = g; this.vis.clear(); this.parts = []; this.floats = []; this.shots = []; this.rings = []; this.queue = [];
    this.buildLevel();
    const p = g.player;
    this.cam.x = p.x * T + T / 2; this.cam.y = p.y * T + T / 2;
  }

  // ---------- static floor texture ----------
  buildLevel() {
    const g = this.g, m = g.map, act = actOf(g.floor), P = PALETTE[act.id];
    this.act = act; this.P = P;
    const cv = document.createElement('canvas');
    cv.width = m.w * T; cv.height = m.h * T;
    const c = cv.getContext('2d');
    c.fillStyle = rgb(P.wall, 0.6); c.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const k = tile(m, x, y), X = x * T, Y = y * T;
      if (k === WALL) this.paintWall(c, m, x, y, X, Y, P);
      else if (k === LAVA) this.paintLava(c, X, Y, x, y);
      else this.paintFloor(c, m, x, y, X, Y, P, k === WATER);
    }
    for (const d of m.deco) this.paintDeco(c, d, P);
    this.level = cv;
    this.fog.width = m.w; this.fog.height = m.h;
  }

  paintFloor(c, m, x, y, X, Y, P, water) {
    const v = 0.86 + hash(x, y) * 0.22;
    c.fillStyle = rgb(P.floor, v); c.fillRect(X, Y, T, T);
    if (this.act.id === 'caves') {
      for (let i = 0; i < 5; i++) { c.fillStyle = rgb(P.floor, 0.7 + hash(x, y, i) * 0.5, 0.8); c.beginPath(); c.arc(X + hash(x, y, i + 9) * T, Y + hash(x, y, i + 19) * T, 1.5 + hash(x, y, i + 29) * 3, 0, 7); c.fill(); }
    } else {
      // slabs with darker joints and a highlight on the top edge
      c.strokeStyle = rgb(P.mortar, 1, 0.9); c.lineWidth = 2;
      c.strokeRect(X + 1, Y + 1, T - 2, T - 2);
      if (hash(x, y, 3) < 0.5) { c.beginPath(); c.moveTo(X + T / 2, Y + 1); c.lineTo(X + T / 2, Y + T - 1); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.035)'; c.fillRect(X + 2, Y + 2, T - 4, 3);
      if (hash(x, y, 4) < 0.18) { // crack
        c.strokeStyle = rgb(P.mortar, 0.8); c.lineWidth = 1.2; c.beginPath();
        let cx = X + hash(x, y, 5) * T, cy = Y + 4; c.moveTo(cx, cy);
        for (let i = 0; i < 4; i++) { cx += (hash(x, y, 6 + i) - 0.5) * 16; cy += 10; c.lineTo(cx, cy); }
        c.stroke();
      }
      if (this.act.id === 'abyss' && hash(x, y, 7) < 0.12) { // glowing seams
        c.strokeStyle = 'rgba(255,90,30,0.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X + 6, Y + hash(x, y, 8) * T); c.lineTo(X + T - 6, Y + hash(x, y, 9) * T); c.stroke();
      }
    }
    for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(0,0,0,${0.08 + hash(x, y, 40 + i) * 0.1})`; c.fillRect(X + hash(x, y, 60 + i) * T, Y + hash(x, y, 80 + i) * T, 2, 2); }
    if (water) {
      const gr = c.createLinearGradient(X, Y, X + T, Y + T);
      gr.addColorStop(0, 'rgba(40,120,150,0.75)'); gr.addColorStop(1, 'rgba(20,70,100,0.75)');
      c.fillStyle = gr; c.fillRect(X, Y, T, T);
      c.strokeStyle = 'rgba(160,230,255,0.25)'; c.lineWidth = 1;
      for (let i = 0; i < 2; i++) { const yy = Y + 14 + i * 18 + hash(x, y, i) * 6; c.beginPath(); c.moveTo(X + 6, yy); c.quadraticCurveTo(X + T / 2, yy - 4, X + T - 6, yy); c.stroke(); }
    }
    // wall shadow on the floor (light comes from above)
    if (tile(m, x, y - 1) === WALL) { const gr = c.createLinearGradient(0, Y, 0, Y + T * 0.55); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(X, Y, T, T * 0.55); }
    if (tile(m, x - 1, y) === WALL) { const gr = c.createLinearGradient(X, 0, X + T * 0.3, 0); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(X, Y, T * 0.3, T); }
    if (tile(m, x + 1, y) === WALL) { const gr = c.createLinearGradient(X + T, 0, X + T * 0.7, 0); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(X + T * 0.7, Y, T * 0.3, T); }
  }

  paintWall(c, m, x, y, X, Y, P) {
    const face = tile(m, x, y + 1) !== WALL;
    const v = 0.85 + hash(x, y, 1) * 0.25;
    if (!face) {
      c.fillStyle = rgb(P.wall, v); c.fillRect(X, Y, T, T);
      for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(255,255,255,${0.02 + hash(x, y, i) * 0.03})`; c.fillRect(X + hash(x, y, i + 3) * T, Y + hash(x, y, i + 7) * T, 3, 3); }
      return;
    }
    // a visible wall face: cap on top, then masonry or rock
    c.fillStyle = rgb(P.wall, v * 1.1); c.fillRect(X, Y, T, T * 0.28);
    const gr = c.createLinearGradient(0, Y + T * 0.28, 0, Y + T);
    gr.addColorStop(0, rgb(P.face, v * 1.15)); gr.addColorStop(1, rgb(P.face, v * 0.6));
    c.fillStyle = gr; c.fillRect(X, Y + T * 0.28, T, T * 0.72);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(X, Y + T * 0.28, T, 2);
    if (this.act.id === 'caves') {
      for (let i = 0; i < 4; i++) { c.fillStyle = `rgba(0,0,0,${0.15 + hash(x, y, i) * 0.2})`; c.beginPath(); c.ellipse(X + hash(x, y, i + 2) * T, Y + T * 0.4 + hash(x, y, i + 5) * T * 0.55, 6 + hash(x, y, i + 8) * 8, 3 + hash(x, y, i + 11) * 4, 0, 0, 7); c.fill(); }
    } else {
      c.strokeStyle = rgb(P.mortar, 1, 0.85); c.lineWidth = 1.5;
      for (let r = 0; r < 3; r++) {
        const yy = Y + T * 0.28 + r * (T * 0.72 / 3);
        c.beginPath(); c.moveTo(X, yy); c.lineTo(X + T, yy); c.stroke();
        const off = (r + x) % 2 ? T / 2 : T / 4;
        for (let xx = X + off; xx < X + T; xx += T / 2) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + T * 0.24); c.stroke(); }
      }
    }
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(X, Y + T - 3, T, 3);
  }

  paintLava(c, X, Y, x, y) {
    const gr = c.createRadialGradient(X + T / 2, Y + T / 2, 2, X + T / 2, Y + T / 2, T * 0.75);
    gr.addColorStop(0, '#ffd27a'); gr.addColorStop(0.4, '#ff6a1f'); gr.addColorStop(1, '#8a1c08');
    c.fillStyle = gr; c.fillRect(X, Y, T, T);
    c.fillStyle = 'rgba(40,10,6,0.55)';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(X + hash(x, y, i) * T, Y + hash(x, y, i + 4) * T, 5 + hash(x, y, i + 8) * 7, 3 + hash(x, y, i + 12) * 4, hash(x, y, i + 16) * 3, 0, 7); c.fill(); }
  }

  paintDeco(c, d, P) {
    const X = d.x * T + T / 2, Y = d.y * T + T / 2, s = hash(d.x, d.y, 2);
    c.save(); c.translate(X, Y);
    switch (d.k) {
      case 'bones':
        c.strokeStyle = '#cfc6b0'; c.lineWidth = 3; c.lineCap = 'round';
        for (let i = 0; i < 2; i++) { c.rotate(0.9 + s * 2); c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.stroke(); c.fillStyle = '#cfc6b0'; for (const e of [-9, 9]) { c.beginPath(); c.arc(e, -2, 2.2, 0, 7); c.arc(e, 2, 2.2, 0, 7); c.fill(); } }
        break;
      case 'skull':
        c.fillStyle = '#d9d0ba'; c.beginPath(); c.arc(0, -2, 7, 0, 7); c.fill(); c.fillRect(-4, 2, 8, 6);
        c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(-2.6, -2, 1.9, 0, 7); c.arc(2.6, -2, 1.9, 0, 7); c.fill();
        break;
      case 'rubble':
        for (let i = 0; i < 4; i++) { c.fillStyle = rgb(P.face, 0.8 + hash(d.x, d.y, i) * 0.4); c.beginPath(); c.ellipse((hash(d.x, d.y, i + 3) - 0.5) * 22, (hash(d.x, d.y, i + 5) - 0.5) * 18, 4 + hash(d.x, d.y, i) * 4, 3 + hash(d.x, d.y, i + 1) * 3, 0, 0, 7); c.fill(); }
        break;
      case 'mushroom':
        for (let i = 0; i < 3; i++) {
          const mx = (hash(d.x, d.y, i) - 0.5) * 20, my = (hash(d.x, d.y, i + 4) - 0.5) * 16, r = 3 + hash(d.x, d.y, i + 8) * 4;
          c.fillStyle = '#d8f5e4'; c.fillRect(mx - 1, my, 2, r + 2);
          c.fillStyle = i % 2 ? '#3fe8a6' : '#7ff0ff'; c.beginPath(); c.ellipse(mx, my, r, r * 0.6, 0, Math.PI, 0); c.fill();
        }
        break;
      case 'seaweed':
        c.strokeStyle = 'rgba(90,180,150,0.75)'; c.lineWidth = 2; c.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const ox = (hash(d.x, d.y, i) - 0.5) * 20; c.beginPath(); c.moveTo(ox, 10); c.quadraticCurveTo(ox + 6, 0, ox - 2, -10); c.stroke(); }
        break;
      case 'ember':
        c.fillStyle = 'rgba(255,110,40,0.7)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc((hash(d.x, d.y, i) - 0.5) * 24, (hash(d.x, d.y, i + 2) - 0.5) * 20, 1.6, 0, 7); c.fill(); }
        break;
      case 'torch':
        c.translate(0, T * 0.15); c.fillStyle = '#3b2a1d'; c.fillRect(-2.5, -4, 5, 14); c.fillStyle = '#6b5b4d'; c.fillRect(-6, 8, 12, 3);
        break;
      case 'brazier':
        c.translate(0, T * 0.2); c.fillStyle = '#2a2224'; c.beginPath(); c.moveTo(-10, -4); c.lineTo(10, -4); c.lineTo(6, 6); c.lineTo(-6, 6); c.closePath(); c.fill(); c.fillRect(-2, 6, 4, 8);
        break;
      case 'lantern':
        c.translate(0, T * 0.15); c.fillStyle = '#243040'; c.fillRect(-3, -6, 6, 4); c.fillStyle = '#3a4a5e'; c.fillRect(-7, 4, 14, 4);
        c.fillStyle = 'rgba(160,215,255,0.9)'; c.beginPath(); c.moveTo(-5, -2); c.lineTo(5, -2); c.lineTo(4, 4); c.lineTo(-4, 4); c.closePath(); c.fill();
        break;
      case 'crystal':
        c.translate(0, T * 0.18); c.fillStyle = '#5fd0ff'; c.strokeStyle = 'rgba(220,250,255,0.8)'; c.lineWidth = 1;
        for (const [ox, h] of [[-6, 12], [0, 18], [6, 10]]) { c.beginPath(); c.moveTo(ox - 3, 6); c.lineTo(ox, 6 - h); c.lineTo(ox + 3, 6); c.closePath(); c.fill(); c.stroke(); }
        break;
    }
    c.restore();
  }

  // ---------- event timeline ----------
  // turns the game's events into timed visuals; returns when the last one will have started
  play(events) {
    const now = performance.now();
    let tl = Math.max(now, this.tl || 0), impact = null;
    const at = (time, fn) => this.queue.push({ time, fn });
    for (const e of events) {
      switch (e.t) {
        case 'atk': { const v = this.vis.get(e.a), d = this.vis.get(e.d); if (v && d) at(tl, () => { v.lunge = { dx: d.x - v.x, dy: d.y - v.y, t0: performance.now() }; this.sfx?.('swing'); }); impact = tl + 90; break; }
        case 'shot': {
          const dur = Math.min(320, 90 + Math.hypot(e.x1 - e.x0, e.y1 - e.y0) * 30);
          at(tl, () => { this.shots.push({ ...e, t0: performance.now(), dur }); this.sfx?.(e.k === 'fire' ? 'fire' : e.k === 'arrow' ? 'arrow' : 'zap'); });
          impact = tl + dur; break;
        }
        case 'hit': case 'miss': case 'heal': case 'dot': {
          const when = impact ?? tl;
          at(when, () => this.onHit(e));
          if (e.t !== 'heal' && e.t !== 'dot') { tl = when + 70; impact = null; }
          break;
        }
        case 'die': at(impact ?? tl, () => this.onDie(e)); break;
        case 'fx': at(tl, () => this.onFx(e)); if (e.k === 'blink' || e.k === 'charge') tl += 120; break;
        case 'shake': at(impact ?? tl, () => this.shake(e.p)); break;
        case 'level': at(tl, () => { this.burst(e.x, e.y, '#ffd36b', 40, 3); this.ring(e.x, e.y, '#ffd36b', 3); this.float(e.x, e.y, 'LEVEL UP', '#ffd36b', 22); this.sfx?.('level'); }); break;
        case 'step': at(tl, () => this.sfx?.('step')); break;
        default: break;
      }
    }
    this.tl = Math.max(tl, impact ?? 0);
    return this.tl;
  }

  flush() { // run whatever is still waiting, so a quick player never waits on animations
    const q = this.queue; this.queue = [];
    q.sort((a, b) => a.time - b.time).forEach((x) => x.fn());
    this.tl = performance.now();
  }
  busy() { return this.queue.length > 0; }

  onHit(e) {
    const v = this.vis.get(e.id), x = e.x, y = e.y;
    if (e.t === 'miss') { this.float(x, y, 'miss', '#c9c3b5', 16); this.sfx?.('miss'); return; }
    if (e.t === 'heal') { this.float(x, y, '+' + e.n, '#7cf29a', 18); this.burst(x, y, '#7cf29a', 12, 1.2, -0.6); return; }
    if (e.t === 'dot') { this.burst(x, y, e.k === 'burn' ? '#ff8a3c' : '#8cf05a', 8, 1, -0.5); return; }
    if (v) { v.flash = 1; v.kick = performance.now(); }
    const col = e.p ? '#ff5a5a' : e.crit ? '#ffd36b' : '#ffffff';
    this.float(x, y, String(e.n), col, e.crit ? 30 : 20, e.crit);
    this.burst(x, y, e.p ? '#ff4a4a' : '#ffcf8a', e.crit ? 26 : 12, e.crit ? 3 : 1.8);
    if (e.crit) { this.hitstop = performance.now() + 70; this.ring(x, y, '#ffd36b', 1.2); }
    this.sfx?.(e.p ? 'hurt' : e.crit ? 'crit' : 'hit');
  }

  onDie(e) {
    const v = this.vis.get(e.id);
    if (v) v.dead = performance.now();
    const col = e.boss ? '#ff6a3c' : e.player ? '#ff3b3b' : '#c9b9ff';
    this.burst(e.x, e.y, col, e.boss ? 120 : 34, e.boss ? 5 : 2.6);
    this.burst(e.x, e.y, '#2b2430', e.boss ? 60 : 18, 1.6, -0.2, false);
    this.ring(e.x, e.y, col, e.boss ? 5 : 1.6);
    if (e.boss || e.player) { this.slowUntil = performance.now() + 1200; this.shake(e.boss ? 18 : 10); }
    this.sfx?.(e.boss ? 'bossdie' : e.player ? 'death' : 'kill');
  }

  onFx(e) {
    const { x, y } = e;
    switch (e.k) {
      case 'cleave': this.ring(x, y, '#ffb35a', 1.6); this.burst(x, y, '#ffb35a', 24, 2.5); this.sfx?.('swing'); break;
      case 'bash': this.ring(x, y, '#e8e3d0', 1); this.shake(5); break;
      case 'charge': case 'blink': {
        const col = e.shadow ? '#7a5cff' : e.k === 'charge' ? '#ffcf6a' : '#8fd8ff';
        for (let i = 0; i <= 10; i++) { const k = i / 10; this.burst(x + (e.x1 - x) * k, y + (e.y1 - y) * k, col, 3, 1, 0, true); }
        this.ring(e.x1, e.y1, col, 1.2); this.sfx?.(e.k === 'charge' ? 'swing' : 'blink'); break;
      }
      case 'nova': this.ring(x, y, '#9fe4ff', 2.6); this.burst(x, y, '#cff4ff', 60, 4); this.sfx?.('frost'); break;
      case 'explode': this.ring(x, y, '#ff8a3c', 1.5); this.burst(x, y, '#ffb35a', 30, 3.2); this.sfx?.('boom'); break;
      case 'venom': this.burst(x, y, '#8cf05a', 24, 1.5, -0.6); this.sfx?.('pickup'); break;
      case 'smoke': this.burst(x, y, '#8d8a99', 70, 2.4, -0.25, false); this.sfx?.('smoke'); break;
      case 'summon': this.ring(x, y, '#b36bff', 1.1); this.burst(x, y, '#b36bff', 20, 2, -0.8); this.sfx?.('summon'); break;
      case 'blast': this.burst(x, y, e.kind === 'acid' ? '#9cf05a' : e.kind === 'bone' ? '#e8e0c8' : e.kind === 'frost' ? '#bfe4ff' : '#ff7a2c', 16, 2.6, -0.5); this.ring(x, y, e.kind === 'frost' ? '#8fd0ff' : '#ff5a3c', 0.6); this.sfx?.('boom'); break;
      case 'ward': this.ring(x, y, '#9fd0ff', 1); this.burst(x, y, '#cfe8ff', 18, 1.5); break;
      case 'gold': this.burst(x, y, '#ffd36b', 14, 1.6, -0.8); this.sfx?.('gold'); break;
      case 'pickup': this.burst(x, y, RARITIES[e.it.rarity || 0]?.color || '#ffffff', 14, 1.4, -0.8); this.sfx?.('pickup'); break;
      case 'chest': this.burst(x, y, '#ffd36b', 30, 2.4, -1); this.ring(x, y, '#ffd36b', 1); this.sfx?.('chest'); break;
      case 'fountain': this.burst(x, y, '#7fd3ff', 40, 2, -1); this.ring(x, y, '#7fd3ff', 1.6); this.sfx?.('heal'); break;
      case 'potion': this.burst(x, y, '#ff7070', 20, 1.4, -1); this.sfx?.('heal'); break;
      case 'stairs': this.ring(x, y, '#ffd36b', 3); this.burst(x, y, '#ffd36b', 50, 3, -1.4); this.sfx?.('stairs'); break;
      case 'map': this.ring(x, y, '#7fd3ff', 6); this.sfx?.('blink'); break;
      default: break;
    }
  }

  shake(p) { if (this.shakeOn && !this.reduced) this.shakeP = Math.max(this.shakeP, p); }
  float(x, y, s, c, size = 20, crit = false) {
    const now = performance.now(), stack = this.floats.filter((f) => f.tx === x && f.ty === y && now - f.t0 < 400).length; // numbers on the same tile climb instead of overlapping
    this.floats.push({ tx: x, ty: y, x: x * T + T / 2 + rnd(-6, 6), y: y * T + T * 0.2 - stack * 18, s, c, size, crit, t0: now });
  }
  ring(x, y, c, r) { this.rings.push({ x: x * T + T / 2, y: y * T + T / 2, c, r: r * T, t0: performance.now() }); }
  burst(x, y, c, n, sp = 2, up = 0, add = true) {
    if (this.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.3, 1) * sp * 60;
      this.parts.push({ x: x * T + T / 2, y: y * T + T / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s + up * 60, life: rnd(0.4, 0.9), max: 0, size: rnd(1.5, 3.5), c, add, g: up < 0 ? -20 : 60 });
    }
  }

  // ---------- per frame ----------
  frame(now) {
    const g = this.g;
    if (!g) return;
    const dt0 = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
    if (this.hitstop && now < this.hitstop) return;
    this.slow = this.slowUntil && now < this.slowUntil ? 0.35 : 1;
    const dt = dt0 * this.slow;
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].time <= now) { const q = this.queue.splice(i, 1)[0]; q.fn(); }
    const c = this.ctx, m = g.map, z = this.z, p = g.player;
    this.syncEntities(now, dt);
    // camera follows the hero's drawn position
    const pv = this.vis.get(p.id);
    const k = 1 - Math.exp(-dt * 8);
    this.cam.x += (pv.x + T / 2 - this.cam.x) * k; this.cam.y += (pv.y + T / 2 - this.cam.y) * k;
    this.shakeP *= Math.exp(-dt * 9);
    const sx = (Math.random() - 0.5) * this.shakeP, sy = (Math.random() - 0.5) * this.shakeP;
    const ox = this.w / 2 - this.cam.x * z + sx, oy = this.h / 2 - this.cam.y * z + sy;
    this.ox = ox; this.oy = oy;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#050407'; c.fillRect(0, 0, this.w, this.h);
    c.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * ox, this.dpr * oy);
    // visible part of the level
    const x0 = Math.max(0, Math.floor(-ox / z / T) - 1), y0 = Math.max(0, Math.floor(-oy / z / T) - 1);
    const x1 = Math.min(m.w, Math.ceil((this.w - ox) / z / T) + 1), y1 = Math.min(m.h, Math.ceil((this.h - oy) / z / T) + 1);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.level, x0 * T, y0 * T, (x1 - x0) * T, (y1 - y0) * T, x0 * T, y0 * T, (x1 - x0) * T, (y1 - y0) * T);
    this.drawLava(c, now, x0, y0, x1, y1);
    this.drawProps(c, now);
    this.drawHazards(c, now);
    this.drawOverlays(c, now);
    this.drawEntities(c, now);
    this.drawShots(c, now);
    this.drawParticles(c, dt, now);
    this.drawFog(c);
    this.drawLight(c, now, ox, oy);
    this.drawFloats(c, now);
    this.drawVignette();
  }

  syncEntities(now, dt) {
    const g = this.g, seen = new Set();
    const k = 1 - Math.exp(-dt * 18);
    for (const e of [g.player, ...g.enemies]) {
      seen.add(e.id);
      let v = this.vis.get(e.id);
      const tx = e.x * T, ty = e.y * T;
      if (!v) { v = { x: tx, y: ty, flash: 0, born: now, e }; this.vis.set(e.id, v); }
      v.e = e;
      if (Math.abs(tx - v.x) > T * 2.5 || Math.abs(ty - v.y) > T * 2.5) { v.x = tx; v.y = ty; } // teleports snap
      v.x += (tx - v.x) * k; v.y += (ty - v.y) * k;
      v.flash = Math.max(0, v.flash - dt * 5);
      if (e.kind === 'enemy' && e.awake && !v.awake && g.vis[e.y * g.map.w + e.x]) this.float(e.x, e.y - 0.4, '!', '#ff5a3c', 26);
      v.awake = e.awake;
    }
    for (const [id, v] of this.vis) if (!seen.has(id) && !v.dead) v.dead = now; // removed without a death event (stairs)
    for (const [id, v] of this.vis) if (v.dead && now - v.dead > 700 && v.e.kind !== 'player') this.vis.delete(id);
  }

  inView(x, y) { return this.g.vis[y * this.g.map.w + x]; }
  seenAt(x, y) { return this.g.map.seen[y * this.g.map.w + x]; }

  drawLava(c, now, x0, y0, x1, y1) {
    if (this.act.id !== 'abyss') return;
    const m = this.g.map;
    c.globalCompositeOperation = 'lighter';
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (tile(m, x, y) !== LAVA || !this.seenAt(x, y)) continue;
      const a = 0.12 + 0.1 * Math.sin(now / 400 + hash(x, y) * 6);
      c.fillStyle = `rgba(255,120,40,${a})`; c.fillRect(x * T, y * T, T, T);
      if (Math.random() < 0.01 && this.inView(x, y)) this.parts.push({ x: x * T + Math.random() * T, y: y * T + Math.random() * T, vx: 0, vy: -20, life: 1.2, size: 2, c: '#ffb35a', add: true, g: -10 });
    }
    c.globalCompositeOperation = 'source-over';
  }

  drawProps(c, now) {
    const g = this.g, m = g.map;
    // flames on torches and braziers, glowing crystals
    for (const d of m.deco) {
      if (!d.light || !this.seenAt(d.x, d.y)) continue;
      const X = d.x * T + T / 2, Y = d.y * T + T / 2 + (d.k === 'torch' ? T * 0.05 : T * 0.12);
      if (d.k === 'crystal') continue;
      if (d.k === 'lantern') {
        c.globalCompositeOperation = 'lighter';
        const lgr = c.createRadialGradient(X, Y - 6, 0, X, Y - 6, 26);
        lgr.addColorStop(0, 'rgba(200,235,255,0.55)'); lgr.addColorStop(1, 'rgba(120,190,255,0)');
        c.fillStyle = lgr; c.beginPath(); c.arc(X, Y - 6, 26, 0, 7); c.fill();
        c.globalCompositeOperation = 'source-over';
        continue;
      }
      const f = 1 + Math.sin(now / 90 + d.x) * 0.15 + Math.random() * 0.1;
      c.globalCompositeOperation = 'lighter';
      const gr = c.createRadialGradient(X, Y - 4, 0, X, Y - 4, 12 * f);
      gr.addColorStop(0, 'rgba(255,240,180,0.95)'); gr.addColorStop(0.4, 'rgba(255,140,40,0.8)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
      c.fillStyle = gr; c.beginPath(); c.ellipse(X, Y - 6, 7 * f, 12 * f, 0, 0, 7); c.fill();
      c.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.08 && this.inView(d.x, d.y)) this.parts.push({ x: X, y: Y - 10, vx: rnd(-8, 8), vy: -30, life: 0.9, size: 1.6, c: '#ffb35a', add: true, g: -10 });
    }
    // stairs
    const s = m.stairs;
    if (g.stairsOpen && this.seenAt(s.x, s.y)) {
      const X = s.x * T, Y = s.y * T;
      c.fillStyle = '#0b0809'; c.fillRect(X + 4, Y + 4, T - 8, T - 8);
      for (let i = 0; i < 4; i++) { c.fillStyle = `rgba(${120 - i * 22},${100 - i * 20},${90 - i * 20},1)`; c.fillRect(X + 6 + i * 3, Y + 8 + i * 9, T - 12 - i * 6, 6); }
      const gr = c.createRadialGradient(X + T / 2, Y + T * 0.75, 2, X + T / 2, Y + T * 0.75, T * 0.6);
      gr.addColorStop(0, `rgba(255,190,90,${0.35 + 0.15 * Math.sin(now / 300)})`); gr.addColorStop(1, 'rgba(255,190,90,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = gr; c.fillRect(X - T / 2, Y - T / 2, T * 2, T * 2); c.globalCompositeOperation = 'source-over';
      c.strokeStyle = 'rgba(255,211,107,0.5)'; c.lineWidth = 2; c.strokeRect(X + 4, Y + 4, T - 8, T - 8);
    }
    // fountain
    const f = g.fountain;
    if (f && this.seenAt(f.x, f.y)) {
      const X = f.x * T + T / 2, Y = f.y * T + T / 2;
      c.fillStyle = '#4a4f5c'; c.beginPath(); c.ellipse(X, Y + 6, 19, 12, 0, 0, 7); c.fill();
      c.fillStyle = f.used ? '#1d2a33' : '#2fa3d6'; c.beginPath(); c.ellipse(X, Y + 5, 15, 9, 0, 0, 7); c.fill();
      c.fillStyle = '#5b6170'; c.fillRect(X - 3, Y - 12, 6, 16); c.beginPath(); c.arc(X, Y - 13, 6, 0, 7); c.fill();
      if (!f.used) {
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgba(120,210,255,${0.25 + 0.1 * Math.sin(now / 250)})`; c.beginPath(); c.ellipse(X, Y + 5, 15, 9, 0, 0, 7); c.fill();
        c.globalCompositeOperation = 'source-over';
        if (Math.random() < 0.1 && this.inView(f.x, f.y)) this.parts.push({ x: X + rnd(-4, 4), y: Y - 14, vx: rnd(-14, 14), vy: -40, life: 0.6, size: 1.6, c: '#bfeaff', add: true, g: 120 });
      }
    }
    // chests
    for (const ch of g.chests) {
      if (!this.seenAt(ch.x, ch.y)) continue;
      const X = ch.x * T + T / 2, Y = ch.y * T + T / 2 + 4;
      c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(X, Y + 12, 18, 5, 0, 0, 7); c.fill();
      c.fillStyle = '#5a3a20'; c.fillRect(X - 16, Y - 6, 32, 18);
      c.fillStyle = '#d8a33a'; c.fillRect(X - 16, Y - 6, 32, 3); c.fillRect(X - 2, Y - 4, 4, 8);
      if (ch.open) { c.fillStyle = '#1a0f08'; c.fillRect(X - 14, Y - 16, 28, 10); c.fillStyle = '#6b4526'; c.fillRect(X - 16, Y - 20, 32, 5); }
      else {
        c.fillStyle = '#6b4526'; c.beginPath(); c.moveTo(X - 16, Y - 6); c.quadraticCurveTo(X, Y - 20, X + 16, Y - 6); c.fill();
        c.strokeStyle = '#d8a33a'; c.lineWidth = 2; c.beginPath(); c.moveTo(X - 16, Y - 6); c.quadraticCurveTo(X, Y - 20, X + 16, Y - 6); c.stroke();
        if (this.inView(ch.x, ch.y) && Math.random() < 0.04) this.parts.push({ x: X + rnd(-14, 14), y: Y - 10, vx: 0, vy: -16, life: 0.8, size: 1.5, c: '#ffd36b', add: true, g: -5 });
      }
    }
    // loot on the floor
    for (const o of g.items) {
      if (!this.seenAt(o.x, o.y)) continue;
      const it = o.it, X = o.x * T + T / 2, Y = o.y * T + T / 2 + Math.sin(now / 400 + o.x) * 2;
      const col = it.kind === 'gold' ? '#ffd36b' : it.slot === 'use' ? CONSUMABLES[it.kind].color : RARITIES[it.rarity].color;
      const name = it.kind === 'gold' ? 'coins' : it.slot === 'use' ? CONSUMABLES[it.kind].icon : SLOT_ICON[it.slot];
      c.globalCompositeOperation = 'lighter';
      const gr = c.createRadialGradient(X, Y, 0, X, Y, T * 0.45);
      gr.addColorStop(0, col + '66'); gr.addColorStop(1, col + '00');
      c.fillStyle = gr; c.fillRect(X - T / 2, Y - T / 2, T, T);
      c.globalCompositeOperation = 'source-over';
      const im = iconImage(name, col, 64, 2.2);
      if (im.complete) c.drawImage(im, X - 14, Y - 14, 28, 28);
    }
  }

  drawHazards(c, now) {
    for (const h of this.g.hazards) {
      if (!this.seenAt(h.x, h.y)) continue;
      const X = h.x * T, Y = h.y * T, a = 0.35 + 0.25 * Math.sin(now / 90);
      const col = h.kind === 'acid' ? '140,240,90' : h.kind === 'bone' ? '235,225,200' : h.kind === 'frost' ? '150,215,255' : '255,80,40';
      c.fillStyle = `rgba(${col},${a * 0.5})`; c.fillRect(X + 2, Y + 2, T - 4, T - 4);
      c.strokeStyle = `rgba(${col},${a + 0.3})`; c.lineWidth = 2.5; c.strokeRect(X + 4, Y + 4, T - 8, T - 8);
      const im = iconImage('skull', `rgb(${col})`, 64, 2.4);
      if (im.complete) { c.globalAlpha = a + 0.3; c.drawImage(im, X + T / 2 - 11, Y + T / 2 - 11, 22, 22); c.globalAlpha = 1; }
    }
  }

  // targeting highlights, hover and the walking path
  drawOverlays(c, now) {
    if (this.targets) {
      for (const tg of this.targets.list) {
        const X = tg.x * T, Y = tg.y * T, sel = this.targets.sel && tg.x === this.targets.sel.x && tg.y === this.targets.sel.y;
        c.strokeStyle = sel ? '#ffd36b' : 'rgba(255,211,107,0.45)'; c.lineWidth = sel ? 3 : 2;
        c.setLineDash(sel ? [] : [6, 5]); c.strokeRect(X + 3, Y + 3, T - 6, T - 6); c.setLineDash([]);
        if (sel) { c.fillStyle = `rgba(255,211,107,${0.12 + 0.08 * Math.sin(now / 120)})`; c.fillRect(X + 3, Y + 3, T - 6, T - 6); }
      }
    }
    if (this.path) for (const s of this.path) { c.fillStyle = 'rgba(255,211,107,0.35)'; c.beginPath(); c.arc(s.x * T + T / 2, s.y * T + T / 2, 3.5, 0, 7); c.fill(); }
    if (this.hover && this.seenAt(this.hover.x, this.hover.y)) { c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.5; c.strokeRect(this.hover.x * T + 2, this.hover.y * T + 2, T - 4, T - 4); }
  }

  drawEntities(c, now) {
    const g = this.g, list = [...this.vis.values()].sort((a, b) => a.y - b.y);
    for (const v of list) {
      const e = v.e, isP = e.kind === 'player';
      if (!isP && !v.dead && !this.inView(e.x, e.y)) continue;
      const d = isP ? CLASSES[e.cls] : ENEMIES[e.type];
      let alpha = 1, scale = 1;
      if (v.dead) { const k = Math.min(1, Math.max(0, (now - v.dead) / 700)); alpha = 1 - k; scale = 1 + k * 0.3; }
      if (isP && e.st.invis > 0) alpha *= 0.4;
      const born = Math.min(1, (now - v.born) / 300); scale *= 0.6 + 0.4 * ease(born);
      const big = e.boss ? 1.45 : d.small ? 0.7 : 1;
      const r = T * 0.43 * big * scale;
      let X = v.x + T / 2, Y = v.y + T / 2;
      if (v.lunge) { const k = Math.max(0, (now - v.lunge.t0) / 180); if (k >= 1) v.lunge = null; else { const s = Math.sin(k * Math.PI) * 0.32, n = Math.hypot(v.lunge.dx, v.lunge.dy) || 1; X += v.lunge.dx / n * T * s; Y += v.lunge.dy / n * T * s; } }
      if (v.kick && now - v.kick < 200) { const k = (now - v.kick) / 200; X += Math.sin(k * 40) * 3 * (1 - k); }
      const bob = Math.sin(now / 420 + e.id) * 1.6;
      Y += bob - (e.boss ? T * 0.2 : 0);
      c.globalAlpha = alpha;
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(X, v.y + T * 0.9, r * 0.85, r * 0.28, 0, 0, 7); c.fill();
      // aura for elites and bosses
      if (e.elite || e.boss) {
        c.globalCompositeOperation = 'lighter';
        const col = e.boss ? '255,70,40' : '190,110,255';
        const gr = c.createRadialGradient(X, Y, r * 0.8, X, Y, r * 1.6);
        gr.addColorStop(0, `rgba(${col},${0.35 + 0.15 * Math.sin(now / 200)})`); gr.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = gr; c.beginPath(); c.arc(X, Y, r * 1.6, 0, 7); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
      const im = this.img[d.art];
      c.save(); c.beginPath(); c.arc(X, Y, r, 0, 7); c.closePath();
      c.fillStyle = '#15121a'; c.fill(); c.clip();
      if (im) c.drawImage(im, X - r * 1.04, Y - r * 1.04, r * 2.08, r * 2.08);
      if (e.st?.frozen > 0) { c.fillStyle = 'rgba(140,210,255,0.45)'; c.fill(); }
      if (v.flash > 0) { c.fillStyle = `rgba(255,255,255,${v.flash * 0.75})`; c.fill(); }
      c.restore();
      c.lineWidth = e.boss ? 4 : 3;
      c.strokeStyle = isP ? d.color : e.boss ? '#ff5a3c' : e.elite ? '#c47bff' : '#9b2c2c';
      c.beginPath(); c.arc(X, Y, r, 0, 7); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1; c.beginPath(); c.arc(X, Y, r + 2, 0, 7); c.stroke();
      // health bar under hurt enemies
      if (!isP && e.hp < e.maxHp && !v.dead) {
        const w = r * 1.7, hy = Y + r + 5;
        c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(X - w / 2 - 1, hy - 1, w + 2, 6);
        c.fillStyle = e.boss ? '#ff5a3c' : '#e04848'; c.fillRect(X - w / 2, hy, w * Math.max(0, e.hp / e.maxHp), 4);
      }
      // statuses
      const icons = [];
      const st = e.st || {};
      if (st.stun > 0) icons.push(['zap', '#ffe46b']);
      if (st.frozen > 0) icons.push(['snowflake', '#9fe4ff']);
      if (st.poison > 0) icons.push(['droplet', '#8cf05a']);
      if (st.burn > 0) icons.push(['flame', '#ff8a3c']);
      if (st.fear > 0) icons.push(['ghost', '#d0c8ff']);
      if (st.web > 0) icons.push(['target', '#e8e8e8']);
      if (isP && e.venom > 0) icons.push(['droplet', '#8cf05a']);
      icons.forEach(([n, col], i) => { const ic = iconImage(n, col, 48, 2.4); if (ic.complete) c.drawImage(ic, X - icons.length * 8 + i * 16, Y - r - 18, 16, 16); });
      c.globalAlpha = 1;
    }
  }

  drawShots(c, now) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i], k = Math.max(0, (now - s.t0) / s.dur);
      if (k >= 1) { this.shots.splice(i, 1); this.burst(s.x1, s.y1, s.k === 'fire' ? '#ff8a3c' : s.k === 'frost' ? '#9fe4ff' : s.k === 'web' ? '#f0f0f0' : s.k === 'arrow' ? '#d8c8a0' : '#b36bff', 14, 2); continue; }
      const x = (s.x0 + (s.x1 - s.x0) * k) * T + T / 2, y = (s.y0 + (s.y1 - s.y0) * k) * T + T / 2 - Math.sin(k * Math.PI) * (s.k === 'arrow' ? 10 : 0);
      if (s.k === 'arrow' || s.k === 'web') {
        const a = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
        c.strokeStyle = s.k === 'web' ? '#f0f0f0' : '#e8d8b0'; c.lineWidth = s.k === 'web' ? 2 : 3;
        c.beginPath(); c.moveTo(x - Math.cos(a) * 14, y - Math.sin(a) * 14); c.lineTo(x, y); c.stroke();
        continue;
      }
      const col = s.k === 'fire' ? [255, 140, 50] : s.k === 'frost' ? [140, 210, 255] : s.k === 'shadow' ? [150, 80, 255] : [190, 90, 255];
      c.globalCompositeOperation = 'lighter';
      const gr = c.createRadialGradient(x, y, 0, x, y, 18);
      gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.3, `rgba(${col},0.9)`); gr.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, 18, 0, 7); c.fill();
      c.globalCompositeOperation = 'source-over';
      this.parts.push({ x, y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.35, size: 2.5, c: `rgb(${col})`, add: true, g: 0 });
    }
  }

  drawParticles(c, dt, now) {
    // ambient motes around the hero
    if (Math.random() < 0.3 && !this.reduced) {
      const p = this.g.player;
      this.parts.push({ x: (p.x + rnd(-6, 6)) * T, y: (p.y + rnd(-5, 5)) * T, vx: rnd(-6, 6), vy: rnd(-10, -3), life: rnd(2, 4), size: rnd(0.8, 1.8), c: this.P.dust, add: true, g: 0, mote: true });
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      if (!q.max) q.max = q.life;
      q.life -= dt;
      if (q.life <= 0) { this.parts.splice(i, 1); continue; }
      q.vx *= 1 - dt * 2; q.vy = q.vy * (1 - dt * 2) + q.g * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      const a = Math.min(1, q.life / q.max * 1.6) * (q.mote ? 0.35 : 1);
      c.globalCompositeOperation = q.add ? 'lighter' : 'source-over';
      c.globalAlpha = a; c.fillStyle = q.c;
      c.beginPath(); c.arc(q.x, q.y, q.size * (q.add ? 1 : 2.4), 0, 7); c.fill();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i], k = Math.max(0, (now - r.t0) / 450);
      if (k >= 1) { this.rings.splice(i, 1); continue; }
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k) * 0.9;
      c.strokeStyle = r.c; c.lineWidth = 4 * (1 - k) + 1;
      c.beginPath(); c.arc(r.x, r.y, r.r * ease(k), 0, 7); c.stroke();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  // one pixel per tile, scaled up with smoothing: soft fog edges for free
  drawFog(c) {
    const g = this.g, m = g.map, f = this.fctx;
    const img = f.createImageData(m.w, m.h), d = img.data;
    for (let i = 0; i < m.w * m.h; i++) d[i * 4 + 3] = g.vis[i] ? 0 : m.seen[i] ? 150 : 255;
    for (let i = 0; i < m.w * m.h; i++) { d[i * 4] = 5; d[i * 4 + 1] = 6; d[i * 4 + 2] = 14; }
    f.putImageData(img, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.fog, 0, 0, m.w * T, m.h * T);
  }

  drawLight(c, now, ox, oy) {
    const g = this.g, L = this.lctx, z = this.z / 2, P = this.P;
    const W = this.light.width, H = this.light.height;
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, W, H);
    L.fillStyle = `rgba(4,3,8,${P.ambient})`; L.fillRect(0, 0, W, H);
    L.globalCompositeOperation = 'destination-out';
    const sx = (x) => (x * T + T / 2) * z + ox / 2, sy = (y) => (y * T + T / 2) * z + oy / 2;
    const pv = this.vis.get(g.player.id);
    const flick = 1 + Math.sin(now / 130) * 0.02 + Math.sin(now / 57) * 0.015;
    const pr = g.ps().light * T * z * 0.95 * flick;
    const px = (pv.x + T / 2) * z + ox / 2, py = (pv.y + T / 2) * z + oy / 2;
    let gr = L.createRadialGradient(px, py, pr * 0.1, px, py, pr);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    L.fillStyle = gr; L.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    const lights = this.lightsInView(now);
    for (const l of lights) {
      const r = l.r * T * z * l.f, x = sx(l.x), y = sy(l.y);
      gr = L.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = gr; L.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.light, 0, 0, this.w, this.h);
    // colored glow on top
    c.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, col, a) => { const q = c.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, `rgba(${col},${a})`); q.addColorStop(1, `rgba(${col},0)`); c.fillStyle = q; c.fillRect(x - r, y - r, r * 2, r * 2); };
    glow(px * 2, py * 2, pr * 1.3, '255,160,80', 0.16 * flick);
    for (const l of lights) glow(sx(l.x) * 2, sy(l.y) * 2, l.r * T * this.z * l.f, l.c.join(','), 0.22);
    c.globalCompositeOperation = 'source-over';
  }

  lightsInView(now) {
    const g = this.g, out = [];
    for (const l of g.map.lights) {
      const x = Math.round(l.x), y = Math.round(l.y);
      if (!this.inView(x, Math.min(g.map.h - 1, y))) continue;
      out.push({ ...l, f: l.flicker ? 1 + Math.sin(now / 110 + l.x * 3) * 0.06 + Math.random() * 0.04 : 1 });
    }
    if (g.stairsOpen && this.inView(g.map.stairs.x, g.map.stairs.y)) out.push({ x: g.map.stairs.x, y: g.map.stairs.y, r: 2.5, c: [255, 190, 90], f: 1 });
    if (g.fountain && !g.fountain.used && this.inView(g.fountain.x, g.fountain.y)) out.push({ x: g.fountain.x, y: g.fountain.y, r: 3, c: [90, 190, 255], f: 1 });
    for (const s of this.shots) { const k = Math.min(1, (now - s.t0) / s.dur); out.push({ x: s.x0 + (s.x1 - s.x0) * k, y: s.y0 + (s.y1 - s.y0) * k, r: 2.5, c: s.k === 'fire' ? [255, 140, 50] : [170, 90, 255], f: 1 }); }
    for (const e of g.enemies) if ((e.boss || e.elite) && this.inView(e.x, e.y)) out.push({ x: e.x, y: e.y, r: e.boss ? 3 : 1.6, c: e.boss ? [255, 80, 40] : [190, 110, 255], f: 1 });
    return out;
  }

  drawFloats(c, now) {
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i], k = Math.max(0, (now - f.t0) / 1000);
      if (k >= 1) { this.floats.splice(i, 1); continue; }
      const pop = k < 0.12 ? 1 + (1 - k / 0.12) * (f.crit ? 0.9 : 0.5) : 1;
      const x = f.x * this.z + this.ox, y = f.y * this.z + this.oy - ease(k) * 34;
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.font = `800 ${Math.round(f.size * pop * Math.max(0.8, this.z))}px Cinzel, Georgia, serif`;
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.strokeText(f.s, x, y);
      c.fillStyle = f.c; c.fillText(f.s, x, y);
    }
    c.globalAlpha = 1;
  }

  drawVignette() {
    const c = this.ctx, w = this.w, h = this.h;
    if (!this.vig || this.vig.w !== w || this.vig.h !== h) {
      const gr = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.75)');
      this.vig = { w, h, gr };
    }
    c.fillStyle = this.vig.gr; c.fillRect(0, 0, w, h);
    const p = this.g.player, max = this.g.ps().maxHp;
    if (p.hp > 0 && p.hp < max * 0.3) { // low health pulse
      const a = (0.3 - p.hp / max) * 1.4 * (0.6 + 0.4 * Math.sin(performance.now() / 260));
      const gr = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(150,0,0,${a})`);
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }
  }

  screenToTile(px, py) { return { x: Math.floor((px - this.ox) / this.z / T), y: Math.floor((py - this.oy) / this.z / T) }; }

  // explored map in the corner
  drawMinimap(big = false) {
    const g = this.g, m = g.map, c = this.mctx, cv = this.mini;
    const s = big ? Math.max(4, Math.floor(Math.min(innerWidth * 0.9 / m.w, innerHeight * 0.7 / m.h))) : 3;
    if (cv.width !== m.w * s) { cv.width = m.w * s; cv.height = m.h * s; }
    c.clearRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const i = y * m.w + x;
      if (!m.seen[i]) continue;
      const k = m.t[i];
      c.fillStyle = k === WALL ? '#3b3640' : k === LAVA ? '#b4421c' : k === WATER ? '#2b6f8a' : g.vis[i] ? '#8b8496' : '#4f4a57';
      c.fillRect(x * s, y * s, s, s);
    }
    const dot = (x, y, col, r = 1) => { c.fillStyle = col; c.fillRect(x * s - (r - 1) * s / 2, y * s - (r - 1) * s / 2, s * r, s * r); };
    if (g.stairsOpen && m.seen[m.stairs.y * m.w + m.stairs.x]) dot(m.stairs.x, m.stairs.y, '#ffd36b', 2);
    for (const e of g.enemies) if (g.vis[e.y * m.w + e.x]) dot(e.x, e.y, e.boss ? '#ff5a3c' : '#e04848', e.boss ? 2 : 1);
    dot(g.player.x, g.player.y, '#ffffff', 2);
  }
}
