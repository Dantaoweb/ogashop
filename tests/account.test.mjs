import test from 'node:test';
import assert from 'node:assert/strict';
import { usernameError, pinError } from '../js/username.js';
import * as W from '../worker/accounts.mjs';
import * as Account from '../js/account.js';

const ctx = (now = 1000) => ({ pepper: 'test-pepper', now });

function fakeStore() {
  const users = new Map();
  const tokens = new Map();
  const saves = new Map();
  return {
    users, tokens, saves,
    async getUser(k) { return users.get(k) || null; },
    async createUser(u) { if (users.has(u.key)) return false; users.set(u.key, { ...u, fails: 0, lockedUntil: 0 }); return true; },
    async setFails(k, fails, lockedUntil) { Object.assign(users.get(k), { fails, lockedUntil }); },
    async addToken(h, k) { tokens.set(h, k); },
    async keyForToken(h) { return tokens.get(h) || null; },
    async dropToken(h) { tokens.delete(h); },
    async getSave(k) { return saves.get(k) || null; },
    async putSave(k, data, version, updatedAt) { saves.set(k, { data, version, updatedAt }); },
    async deleteUser(k) { users.delete(k); saves.delete(k); for (const [h, v] of tokens) if (v === k) tokens.delete(h); },
  };
}

const join = (s, name = 'Tunde_9', pin = '4827', age = '18+') => W.signup(s, { username: name, pin, age }, ctx());

test('username and PIN rules', () => {
  assert.equal(usernameError('Tunde_9'), null);
  assert.equal(usernameError('Modesty'), null, 'normal names containing short rude words are fine');
  assert.match(usernameError('ab'), /3 to 20/);
  assert.match(usernameError('has space'), /3 to 20/);
  assert.match(usernameError('creditvoice'), /not allowed/);
  assert.match(usernameError('bigfuckman'), /not allowed/);
  assert.match(usernameError('mumu_22'), /not allowed/);
  assert.equal(pinError('4827'), null);
  assert.match(pinError('12a4'), /4 numbers/);
  assert.match(pinError('1111'), /too easy/);
});

test('sign up: unique names, age rules, PIN never stored as typed', async () => {
  const s = fakeStore();
  const r = await join(s);
  assert.equal(r.status, 200);
  assert.ok(r.json.token.length >= 32);
  assert.notEqual(s.users.get('tunde_9').pinHash, '4827');
  assert.equal([...s.tokens.keys()].includes(r.json.token), false, 'tokens are stored hashed');
  assert.equal((await join(s, 'TUNDE_9')).status, 409, 'names are unique, ignoring case');
  assert.equal((await W.signup(s, { username: 'Kid_one', pin: '4827', age: 'under13' }, ctx())).status, 403);
  assert.equal((await W.signup(s, { username: 'Noage', pin: '4827' }, ctx())).status, 400);
});

test('login: right PIN works, wrong PIN fails, too many tries locks', async () => {
  const s = fakeStore();
  await join(s);
  assert.equal((await W.login(s, { username: 'tunde_9', pin: '4827' }, ctx())).status, 200);
  assert.equal((await W.login(s, { username: 'nobody', pin: '4827' }, ctx())).status, 401);
  for (let i = 0; i < 5; i++) assert.equal((await W.login(s, { username: 'tunde_9', pin: '0000' }, ctx())).status, 401);
  assert.equal((await W.login(s, { username: 'tunde_9', pin: '4827' }, ctx())).status, 429, 'locked even with the right PIN');
  assert.equal((await W.login(s, { username: 'tunde_9', pin: '4827' }, ctx(1000 + W.LOCK_MS + 1))).status, 200, 'unlocks after 15 minutes');
});

test('cloud save: versions, conflict from another phone, delete removes everything', async () => {
  const s = fakeStore();
  const { json } = await join(s);
  const user = await W.userFromToken(s, json.token);
  assert.equal(user.username, 'Tunde_9');
  assert.equal(await W.userFromToken(s, 'bad-token'), null);
  assert.deepEqual((await W.getSave(s, user)).json, { version: 0, data: null });
  assert.equal((await W.putSave(s, user, { data: '{"day":1}', base: 0 }, ctx())).json.version, 1);
  const conflict = await W.putSave(s, user, { data: '{"day":2}', base: 0 }, ctx());
  assert.equal(conflict.status, 409);
  assert.equal((await W.putSave(s, user, { data: '{"day":2}', base: 0, force: true }, ctx())).json.version, 2);
  assert.equal((await W.putSave(s, user, { data: 'x'.repeat(W.MAX_SAVE + 1), base: 2 }, ctx())).status, 413);
  assert.equal((await W.deleteAccount(s, user, { pin: '1357' }, ctx())).status, 401);
  assert.equal((await W.deleteAccount(s, user, { pin: '4827' }, ctx())).status, 200);
  assert.equal(s.users.size + s.tokens.size + s.saves.size, 0);
});

test('the game talks to the server, and no connection gives a clear message', async () => {
  const s = fakeStore();
  const data = {};
  const route = async (url, opts) => {
    const path = url.replace('https://x.test', '');
    const body = opts.body ? JSON.parse(opts.body) : {};
    const token = opts.headers.Authorization?.replace('Bearer ', '');
    const user = await W.userFromToken(s, token);
    let r;
    if (path === '/account/signup') r = await W.signup(s, body, ctx());
    else if (path === '/account/login') r = await W.login(s, body, ctx());
    else if (path === '/save' && opts.method === 'GET') r = await W.getSave(s, user);
    else if (path === '/save') r = await W.putSave(s, user, body, ctx());
    else if (path === '/account/logout') r = await W.logout(s, token);
    return { status: r.status, json: async () => r.json };
  };
  const phone = () => Account.configure({ base: 'https://x.test', request: route, storage: { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } } });
  phone();
  assert.equal(await Account.signup('Ada_1', '18+', '4827'), null);
  assert.equal(Account.current().username, 'Ada_1');
  assert.equal(await Account.push('{"day":3}'), 'ok');
  assert.equal(Account.current().dirty, false);
  phone(); // reopening keeps you logged in
  assert.equal(Account.loggedIn(), true);
  // a second phone saves a newer game
  const token = Account.current().token;
  const other = await W.userFromToken(s, token);
  await W.putSave(s, other, { data: '{"day":9}', base: 1 }, ctx());
  assert.equal(await Account.push('{"day":4}'), 'conflict');
  assert.equal((await Account.pull()).data, '{"day":9}');
  assert.equal(await Account.push('{"day":4}', { force: true }), 'ok');
  await Account.logout();
  assert.equal(Account.loggedIn(), false);
  assert.match(await Account.login('Ada_1', '0000'), /Wrong username or PIN/);
  Account.configure({ request: async () => { throw new Error('offline'); } });
  assert.match(await Account.login('Ada_1', '4827'), /No connection/);
});
