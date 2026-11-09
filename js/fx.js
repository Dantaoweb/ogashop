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
