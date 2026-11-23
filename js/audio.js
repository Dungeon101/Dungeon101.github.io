// Sound effects synthesized with Web Audio (no files) and a low ambient drone per act.
let ac = null, master = null, drone = null, on = true;
try { on = localStorage.getItem('d101_sound') !== '0'; } catch { /* default on */ }

function ctx() {
  if (!ac) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ac = new A(); master = ac.createGain(); master.gain.value = on ? 0.55 : 0; master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

export const soundOn = () => on;
export function setSound(v) {
  on = v;
  try { localStorage.setItem('d101_sound', v ? '1' : '0'); } catch { /* not remembered */ }
  if (master) master.gain.setTargetAtTime(v ? 0.55 : 0, ac.currentTime, 0.05);
}

function tone({ f = 440, f2 = f, d = 0.15, type = 'sine', v = 0.3, at = 0, q = 0 }) {
  const c = ctx(); if (!c || !on) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  let node = o;
  if (q) { const b = c.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = q; o.connect(b); node = b; }
  node.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}

function noise({ d = 0.2, v = 0.3, f = 1200, type = 'bandpass', at = 0, f2 }) {
  const c = ctx(); if (!c || !on) return;
  const t = c.currentTime + at, len = Math.ceil(c.sampleRate * d), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), b = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; b.type = type; b.frequency.setValueAtTime(f, t); if (f2) b.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(b); b.connect(g); g.connect(master); s.start(t);
}

const FX = {
  step: () => noise({ d: 0.05, v: 0.05, f: 400 }),
  swing: () => noise({ d: 0.12, v: 0.18, f: 2500, f2: 600 }),
  hit: () => { noise({ d: 0.08, v: 0.35, f: 900 }); tone({ f: 160, f2: 60, d: 0.12, type: 'triangle', v: 0.35 }); },
  crit: () => { noise({ d: 0.18, v: 0.45, f: 1500, f2: 300 }); tone({ f: 220, f2: 50, d: 0.25, type: 'sawtooth', v: 0.25, q: 900 }); tone({ f: 880, f2: 1320, d: 0.12, v: 0.1, at: 0.02 }); },
  miss: () => noise({ d: 0.14, v: 0.12, f: 3000, f2: 1200 }),
  hurt: () => { tone({ f: 200, f2: 90, d: 0.2, type: 'square', v: 0.16, q: 700 }); noise({ d: 0.1, v: 0.25, f: 600 }); },
  kill: () => { noise({ d: 0.3, v: 0.25, f: 800, f2: 120 }); tone({ f: 330, f2: 110, d: 0.3, type: 'triangle', v: 0.2 }); },
  bossdie: () => { noise({ d: 1.4, v: 0.5, f: 600, f2: 60, type: 'lowpass' }); tone({ f: 110, f2: 30, d: 1.6, type: 'sawtooth', v: 0.35, q: 400 }); },
  death: () => { tone({ f: 220, f2: 55, d: 1.6, type: 'sawtooth', v: 0.3, q: 600 }); tone({ f: 165, f2: 41, d: 1.8, type: 'triangle', v: 0.25 }); },
  fire: () => noise({ d: 0.3, v: 0.25, f: 700, f2: 2400, type: 'lowpass' }),
  arrow: () => noise({ d: 0.12, v: 0.15, f: 4000, f2: 2000 }),
  zap: () => tone({ f: 600, f2: 200, d: 0.2, type: 'sawtooth', v: 0.12, q: 2000 }),
  boom: () => { noise({ d: 0.45, v: 0.45, f: 500, f2: 60, type: 'lowpass' }); tone({ f: 90, f2: 35, d: 0.4, type: 'sine', v: 0.4 }); },
  frost: () => { [1200, 1600, 2100].forEach((f, i) => tone({ f, f2: f * 1.2, d: 0.35, v: 0.07, at: i * 0.04 })); noise({ d: 0.3, v: 0.15, f: 5000 }); },
  blink: () => { tone({ f: 300, f2: 1800, d: 0.25, v: 0.12, type: 'triangle' }); },
  smoke: () => noise({ d: 0.6, v: 0.3, f: 300, f2: 1500, type: 'lowpass' }),
  summon: () => { tone({ f: 70, f2: 140, d: 0.6, type: 'sawtooth', v: 0.18, q: 500 }); },
  gold: () => { tone({ f: 1320, d: 0.08, v: 0.1, type: 'triangle' }); tone({ f: 1760, d: 0.12, v: 0.1, type: 'triangle', at: 0.06 }); },
  pickup: () => { tone({ f: 660, f2: 990, d: 0.12, v: 0.12, type: 'triangle' }); },
  chest: () => { noise({ d: 0.15, v: 0.2, f: 300 }); [523, 659, 784, 1047].forEach((f, i) => tone({ f, d: 0.2, v: 0.09, type: 'triangle', at: 0.08 + i * 0.06 })); },
  heal: () => { [440, 554, 659].forEach((f, i) => tone({ f, d: 0.35, v: 0.08, at: i * 0.07 })); },
  level: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone({ f, d: 0.45, v: 0.1, type: 'triangle', at: i * 0.08 })); },
  stairs: () => { [196, 247, 294, 392].forEach((f, i) => tone({ f, d: 0.6, v: 0.1, type: 'triangle', at: i * 0.1 })); },
  descend: () => { noise({ d: 0.8, v: 0.2, f: 200, f2: 60, type: 'lowpass' }); tone({ f: 220, f2: 110, d: 0.8, v: 0.15, type: 'triangle' }); },
  boss: () => { tone({ f: 55, f2: 45, d: 2.2, type: 'sawtooth', v: 0.35, q: 300 }); tone({ f: 82, f2: 70, d: 2.2, type: 'sawtooth', v: 0.25, q: 300 }); noise({ d: 1.5, v: 0.3, f: 150, type: 'lowpass' }); },
  click: () => tone({ f: 880, d: 0.04, v: 0.06, type: 'triangle' }),
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, d: 0.9, v: 0.1, type: 'triangle', at: i * 0.12 })); },
};
export const sfx = (name) => { try { FX[name]?.(); } catch { /* audio is optional */ } };

// a quiet two-oscillator drone, a different chord per act
export function ambient(act) {
  if (!ac && !act) return; // nothing playing yet: don't create the audio context before the first click
  const c = ctx(); if (!c) return;
  if (drone) { drone.g.gain.setTargetAtTime(0, c.currentTime, 0.5); const old = drone; setTimeout(() => old.o.forEach((o) => o.stop()), 2000); drone = null; }
  if (!act) return;
  const notes = { crypt: [55, 82.4], caves: [61.7, 92.5], abyss: [49, 73.4], forge: [46.2, 69.3], cathedral: [65.4, 98], throne: [43.7, 65.4], cistern: [41.2, 61.7], kiln: [38.9, 58.3], door: [36.7, 55] }[act] || [55, 82.4];
  const g = c.createGain(); g.gain.value = 0; g.connect(master);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.connect(g);
  const o = notes.map((f, i) => { const x = c.createOscillator(); x.type = i ? 'triangle' : 'sawtooth'; x.frequency.value = f; x.detune.value = i * 6; x.connect(lp); x.start(); return x; });
  g.gain.setTargetAtTime(0.05, c.currentTime, 2);
  drone = { g, o };
}
