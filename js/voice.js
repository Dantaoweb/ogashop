// Customer voices, using the phone's own text-to-speech. Nothing to download; works offline on most phones.
// The on/off choice is per device, kept apart from the saved game.
const KEY = 'ogashop.voice';
const PREFERRED_LANGS = ['en-ng', 'en-gb', 'en-za', 'en-ke', 'en-gh', 'en-in', 'en-us', 'en'];

export const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let voices = [];
function loadVoices() { voices = window.speechSynthesis.getVoices(); }
if (supported) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export function enabled() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setEnabled(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked: stays for this visit */ }
  if (!on) stop();
}

// A Nigerian English voice if the phone has one, else the closest English voice.
function pickVoice() {
  const norm = (l) => l.replace('_', '-').toLowerCase();
  for (const lang of PREFERRED_LANGS) {
    const v = voices.find((x) => norm(x.lang).startsWith(lang));
    if (v) return v;
  }
  return null;
}

// "₦5,000" reads badly aloud; say "5000 naira".
export function forSpeech(text) {
  return text
    .replace(/-?₦\s?([\d,]+)/g, (_, n) => `${n.replace(/,/g, '')} naira`)
    .replace(/[“”"]/g, '')
    .replace(/…/g, ', ');
}

function seedOf(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h;
}

// Each customer gets their own pitch and speed, so voices sound different.
export function speak(text, { who = '', she = false } = {}) {
  if (!supported || !enabled() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(forSpeech(text));
  const v = pickVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-NG';
  const vary = ((seedOf(who) % 5) - 2) * 0.05;
  u.pitch = (she ? 1.25 : 0.8) + vary;
  u.rate = 0.95 + vary / 2;
  synth.speak(u);
}

export function stop() {
  if (supported) window.speechSynthesis.cancel();
}
