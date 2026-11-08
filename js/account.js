// Player accounts and cloud save. Guests never use this.
// On this phone the player stays logged in with a token; the PIN is only for a new phone.
import { API_BASE } from './data.js';

const KEY = 'ogashop.account';
let base = API_BASE;
let store = () => (typeof localStorage === 'undefined' ? null : localStorage);
let request = (url, opts) => fetch(url, opts);
let me = null;
let pushing = false;

export function configure(opts = {}) {
  if (opts.base !== undefined) base = opts.base;
  if (opts.storage) store = () => opts.storage;
  if (opts.request) request = opts.request;
  me = null;
  pushing = false;
}

function read() {
  if (me) return me;
  try { me = JSON.parse(store()?.getItem(KEY) || 'null'); } catch { me = null; }
  return me;
}

function write() {
  try {
    if (me) store()?.setItem(KEY, JSON.stringify(me));
    else store()?.removeItem(KEY);
  } catch { /* storage blocked */ }
}

export const current = () => read();
export const loggedIn = () => !!read()?.token;

async function call(path, { method = 'POST', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${read()?.token}`;
  try {
    const res = await request(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = {};
    try { json = await res.json(); } catch { /* no body */ }
    return { status: res.status, json };
  } catch {
    return { status: 0, json: { error: 'No connection. Please try again when you have data.' } };
  }
}

function signedIn(json) {
  me = { username: json.username, age: json.age, token: json.token, base: 0, dirty: false };
  write();
}

// Each returns an error message, or null when it worked.
export async function signup(username, age, pin) {
  const { status, json } = await call('/account/signup', { body: { username, age, pin } });
  if (status !== 200) return json.error || 'Something went wrong. Please try again.';
  signedIn(json);
  return null;
}

export async function login(username, pin) {
  const { status, json } = await call('/account/login', { body: { username, pin } });
  if (status !== 200) return json.error || 'Something went wrong. Please try again.';
  signedIn(json);
  return null;
}

export function forget() {
  me = null;
  write();
}

export async function logout() {
  await call('/account/logout', { auth: true });
  forget();
}

export async function remove(pin) {
  const { status, json } = await call('/account/delete', { body: { pin }, auth: true });
  if (status !== 200) return json.error || 'Something went wrong. Please try again.';
  forget();
  return null;
}

// Fetches the cloud save: { version, data } (data is null if there is none), or null if unreachable.
export async function pull() {
  if (!loggedIn()) return null;
  const { status, json } = await call('/save', { method: 'GET', auth: true });
  if (status === 401) { forget(); return null; }
  return status === 200 ? json : null;
}

export function adopted(version) {
  if (!read()) return;
  me.base = version;
  me.dirty = false;
  write();
}

export function markDirty() {
  if (!read() || me.dirty) return;
  me.dirty = true;
  write();
}

// Upload the game. Returns 'ok', 'conflict' (another phone saved a newer game) or 'failed'.
export async function push(data, { force = false } = {}) {
  if (!loggedIn() || pushing) return 'failed';
  pushing = true;
  const { status, json } = await call('/save', { body: { data, base: me.base, force }, auth: true });
  pushing = false;
  if (status === 200) {
    me.base = json.version;
    me.dirty = false;
    write();
    return 'ok';
  }
  if (status === 401) forget();
  return status === 409 ? 'conflict' : 'failed';
}
