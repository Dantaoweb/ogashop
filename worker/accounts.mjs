// Accounts and cloud saves. `store` holds the data (D1 in production, a simple fake in tests).
// Every handler returns { status, json }.
import { usernameError, usernameKey, pinError, AGE_GROUPS } from '../js/username.js';

export const MAX_SAVE = 300000;
export const MAX_FAILS = 5;
export const LOCK_MS = 15 * 60000;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const reply = (status, json) => ({ status, json });
const WRONG = reply(401, { error: 'Wrong username or PIN.' });

function randomHex(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return hex(b);
}

export const sha256 = async (text) => hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));

// A 4-digit PIN is short, so it's mixed with a per-user salt and a server-only secret.
export async function hashPin(pin, salt, pepper) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${salt}:${pin}`)));
}

export function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function newToken(store, key, now) {
  const token = randomHex(32);
  await store.addToken(await sha256(token), key, now);
  return token;
}

export async function signup(store, body, { pepper, now }) {
  const nameError = usernameError(body?.username);
  if (nameError) return reply(400, { error: nameError });
  const badPin = pinError(body?.pin);
  if (badPin) return reply(400, { error: badPin });
  if (body?.age === 'under13') return reply(403, { error: 'Players under 13 can play as guests.' });
  if (!AGE_GROUPS[body?.age]) return reply(400, { error: 'Please choose your age group.' });
  const username = String(body.username).trim();
  const key = usernameKey(username);
  const salt = randomHex(16);
  const created = await store.createUser({ key, username, salt, pinHash: await hashPin(body.pin, salt, pepper), age: body.age, now });
  if (!created) return reply(409, { error: 'That username is taken. Please choose another.' });
  return reply(200, { username, age: body.age, token: await newToken(store, key, now) });
}

// Checks the PIN and locks the account for a while after too many wrong tries.
async function checkPin(store, user, pin, { pepper, now }) {
  if (user.lockedUntil > now) return reply(429, { error: 'Too many wrong tries. Please wait 15 minutes.' });
  if (sameText(await hashPin(String(pin || ''), user.salt, pepper), user.pinHash)) {
    if (user.fails) await store.setFails(user.key, 0, 0);
    return null;
  }
  const fails = user.fails + 1;
  await store.setFails(user.key, fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? now + LOCK_MS : 0);
  return WRONG;
}

export async function login(store, body, ctx) {
  const user = await store.getUser(usernameKey(body?.username));
  if (!user) return WRONG;
  const problem = await checkPin(store, user, body?.pin, ctx);
  if (problem) return problem;
  return reply(200, { username: user.username, age: user.age, token: await newToken(store, user.key, ctx.now) });
}

export async function userFromToken(store, token) {
  if (!token) return null;
  const key = await store.keyForToken(await sha256(token));
  return key ? store.getUser(key) : null;
}

export async function getSave(store, user) {
  const row = await store.getSave(user.key);
  return reply(200, row ? { version: row.version, updatedAt: row.updatedAt, data: row.data } : { version: 0, data: null });
}

// base: the version this phone last saw. Someone else's newer save is never overwritten unless forced.
export async function putSave(store, user, body, { now }) {
  if (typeof body?.data !== 'string' || body.data.length > MAX_SAVE) return reply(413, { error: 'Save is too large.' });
  const row = await store.getSave(user.key);
  const current = row?.version || 0;
  if (!body.force && body.base !== current) return reply(409, { error: 'conflict', version: current, updatedAt: row?.updatedAt });
  const version = current + 1;
  await store.putSave(user.key, body.data, version, now);
  return reply(200, { version });
}

export async function logout(store, token) {
  await store.dropToken(await sha256(token));
  return reply(200, { ok: true });
}

export async function deleteAccount(store, user, body, ctx) {
  const problem = await checkPin(store, user, body?.pin, ctx);
  if (problem) return problem;
  await ctx.beforeDelete?.();
  await store.deleteUser(user.key);
  return reply(200, { ok: true });
}
