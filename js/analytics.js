// Counting players, in three modes the player controls:
//   'no' (the default until they answer): anonymous totals only, no code, nothing that identifies anyone.
//   'yes': the same counts, plus a random player code and game details, so we can follow how players get on.
//   'off': "Don't count me": nothing is sent.
// Never sent in any mode: names, phone numbers, sales records, account numbers, custom customer names or lines.
// Counting must never break the game, so everything here is wrapped.
import { ANALYTICS_URL } from './data.js';

const KEY = 'ogashop.analytics';
const MAX_QUEUE = 200;
const BATCH = 50;
const DAY_MS = 86400000;

const browserStore = () => (typeof localStorage === 'undefined' ? null : localStorage);

let url = ANALYTICS_URL;
let store = browserStore;
let clock = () => Date.now();
let post = (target, body) => fetch(target, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true }).then((r) => r.ok);
let state = null;
let sending = false;

// Tests and local checks can swap these.
export function configure(opts = {}) {
  if (opts.url !== undefined) url = opts.url;
  if (opts.storage) store = () => opts.storage;
  if (opts.now) clock = opts.now;
  if (opts.post) post = opts.post;
  state = null;
  sending = false;
}

function load() {
  if (state) return state;
  try {
    state = JSON.parse(store()?.getItem(KEY) || 'null');
  } catch { state = null; }
  state = { choice: null, first: null, pid: null, once: {}, queue: [], ...(state || {}) };
  return state;
}

function persist() {
  try { store()?.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked: keep playing */ }
}

function newCode() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

// False until the counter's address is set: then the game neither counts nor asks.
export const connected = () => !!url;

// null = not answered yet.
export const choice = () => load().choice;

export function setChoice(value) {
  try {
    const st = load();
    st.choice = value;
    st.pid = value === 'yes' ? (st.pid || newCode()) : null;
    if (value === 'off') st.queue = [];
    persist();
  } catch { /* never break the game */ }
}

// e: event name. k: short label. v: number. level/day/score: detail, sent only with "yes".
// once: a key that makes this event count one time per phone.
export function track(e, { k, v, level, day, score, once } = {}) {
  try {
    if (!url) return;
    const st = load();
    if (st.choice === 'off') return;
    if (once) {
      if (st.once[once]) return;
      st.once[once] = 1;
    }
    st.queue.push({ e, k, v, level, day, score });
    if (st.queue.length > MAX_QUEUE) st.queue.splice(0, st.queue.length - MAX_QUEUE);
    persist();
  } catch { /* never break the game */ }
}

// One call per app open. The phone works out "new" or "returning" itself, so no code is needed for it.
export function startVisit() {
  try {
    if (!url) return;
    const st = load();
    const now = clock();
    let k = 'new';
    if (st.first == null) st.first = now;
    else {
      const days = Math.floor((now - st.first) / DAY_MS);
      k = days === 0 ? 'same_day' : days <= 7 ? 'week' : 'later';
    }
    persist();
    track('visit', { k });
    if (k === 'week') track('returned', { k: 'week', once: 'returned_week' });
  } catch { /* never break the game */ }
}

// What actually leaves the phone. Without "yes", only the event, its label and its number.
export function payload(item, st = load()) {
  const out = { e: item.e };
  if (item.k != null) out.k = item.k;
  if (item.v != null) out.v = item.v;
  if (st.choice === 'yes' && st.pid) {
    out.pid = st.pid;
    if (item.level != null) out.level = item.level;
    if (item.day != null) out.day = item.day;
    if (item.score != null) out.score = item.score;
  }
  return out;
}

export async function flush() {
  try {
    const st = load();
    if (!url || sending || !st.queue.length || st.choice === 'off') return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    sending = true;
    const batch = st.queue.slice(0, BATCH);
    const ok = await post(url, JSON.stringify(batch.map((item) => payload(item, st))));
    sending = false;
    if (!ok) return false;
    st.queue.splice(0, batch.length);
    persist();
    return true;
  } catch {
    sending = false;
    return false; // offline or server down: the counts wait on the phone
  }
}
