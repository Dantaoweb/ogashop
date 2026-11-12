// Game feel: short sounds made in code (nothing to download), a little phone vibration,
// numbers that count up, and confetti. Sounds and vibration can be switched off in Settings.
// Movement is skipped when the phone asks for reduced motion. Nothing here can break the game.
const KEY = 'ogashop.sounds';

export function enabled() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setEnabled(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked: stays for this visit */ }
}

const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let ctx = null;
function audio() {
  if (!ctx) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ctx = new A();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(a, freq, start, dur, type = 'sine', vol = 0.12) {
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// [frequency, start, length, wave, volume]
const SOUNDS = {
  sale: [[1318, 0, 0.09, 'triangle'], [1760, 0.08, 0.22, 'triangle']], // the till: ka-ching
  right: [[880, 0, 0.08], [1175, 0.07, 0.14]],
  wrong: [[196, 0, 0.2, 'square', 0.04]], // a soft buzz, never harsh
  star: [[1568, 0, 0.12, 'triangle', 0.1]],
  level: [[523, 0, 0.12], [659, 0.11, 0.12], [784, 0.22, 0.12], [1047, 0.33, 0.35]],
};

export function play(name) {
  try {
    if (!enabled()) return;
    const a = audio();
    if (!a) return;
    for (const [f, st, d, type, vol] of SOUNDS[name] || []) tone(a, f, st, d, type, vol);
  } catch { /* no sound on this phone */ }
}

export function buzz(pattern) {
  try { if (enabled() && navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(pattern); } catch { /* no vibration */ }
}

// A number on screen rolls from its old value to the new one.
export function countUp(el, from, to, format) {
  if (calm() || from === to) return;
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / 600);
    const eased = 1 - (1 - k) ** 3;
    if (!el.isConnected) return;
    el.textContent = format(k < 1 ? from + (to - from) * eased : to);
    if (k < 1) requestAnimationFrame(step);
  };
  el.textContent = format(from);
  requestAnimationFrame(step);
}

// "+₦1,500" rises and fades in the middle of the screen.
export function floatText(text, good = true) {
  const el = document.createElement('div');
  el.className = `float-text${good ? '' : ' bad'}`;
  el.textContent = text;
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

export function confetti() {
  if (calm()) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  box.setAttribute('aria-hidden', 'true');
  const colors = ['#F5B70A', '#0E6B43', '#E85D3F', '#2F80ED', '#FFFFFF'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    p.style.setProperty('--x', `${Math.round(Math.random() * 120 - 60)}px`);
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3000);
}

// ---------- Market sound: a soft crowd murmur, off unless the player switches it on ----------

const AMB_KEY = 'ogashop.ambience';
export function ambienceOn() {
  try { return localStorage.getItem(AMB_KEY) === 'on'; } catch { return false; }
}
export function setAmbience(on) {
  try { localStorage.setItem(AMB_KEY, on ? 'on' : 'off'); } catch { /* stays for this visit */ }
  if (!on) ambience(false);
}

let amb = null;
// Brown noise through a band filter, with a slow swell, sounds like a crowd far away.
export function ambience(play) {
  try {
    if (!play) {
      if (amb) { amb.gain.gain.setTargetAtTime(0, amb.ctx.currentTime, 0.3); const old = amb; setTimeout(() => { try { old.src.stop(); } catch { /* done */ } }, 1200); amb = null; }
      return;
    }
    if (amb) return;
    const a = audio();
    if (!a) return;
    const len = a.sampleRate * 4;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; }
    const src = a.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const band = a.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    band.Q.value = 0.6;
    const gain = a.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.06, a.currentTime, 0.8);
    const lfo = a.createOscillator();
    const depth = a.createGain();
    lfo.frequency.value = 0.15;
    depth.gain.value = 0.02;
    lfo.connect(depth).connect(gain.gain);
    src.connect(band).connect(gain).connect(a.destination);
    src.start();
    lfo.start();
    amb = { ctx: a, src, gain };
  } catch { /* no sound on this phone */ }
}
