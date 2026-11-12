import test from 'node:test';
import assert from 'node:assert/strict';
import * as Admin from '../worker/admin.mjs';
import * as A from '../worker/accounts.mjs';

function fakeStore() {
  const users = new Map();
  const log = [];
  let guard = { fails: 0, lockedUntil: 0 };
  const removed = [];
  return {
    users, log, removed,
    async getUser(k) { return users.get(k) || null; },
    async createUser({ key, username, salt, pinHash, age, now }) { if (users.has(key)) return false; users.set(key, { key, username, salt, pinHash, age, fails: 0, lockedUntil: 0, createdAt: now }); return true; },
    async setFails(k, fails, lockedUntil) { Object.assign(users.get(k), { fails, lockedUntil }); },
    async addToken() {},
    async adminGuard() { return { ...guard }; },
    async setAdminGuard(fails, lockedUntil) { guard = { fails, lockedUntil }; },
    async addAdminLog(at, action, target, detail) { log.push({ at, action, target, detail }); },
    async adminLog() { return log.slice().reverse(); },
    async adminCounts() { return { users: users.size, newToday: 1, newWeek: 1, teens: 0, savedToday: 0, markets: 0, members: 0, cupsOpen: 0, cupsRunning: 0 }; },
    async adminPlayer() { return { save: { data: JSON.stringify({ level: 2, day: 9, score: 71, path: 'business', cash: 12345.6, cups: [1], trophies: [] }), updatedAt: 5 }, market: null, cups: [] }; },
    async setPin(k, salt, pinHash) { Object.assign(users.get(k), { salt, pinHash, fails: 0, lockedUntil: 0 }); },
    async renameUser(oldKey, newKey, username) { const u = users.get(oldKey); users.delete(oldKey); users.set(newKey, { ...u, key: newKey, username }); },
    async deleteUser(k) { removed.push(k); users.delete(k); },
  };
}
const ctx = { pepper: 'pepper', now: 1000 };

test('admin key: off without the secret, right key opens, 5 wrong keys lock it', async () => {
  const s = fakeStore();
  assert.equal((await Admin.checkKey(s, 'anything', '', 0)).status, 404, 'no secret: no admin at all');
  assert.equal(await Admin.checkKey(s, 'right-key', 'right-key', 0), null);
  for (let i = 0; i < 4; i++) assert.equal((await Admin.checkKey(s, 'wrong', 'right-key', 0)).status, 401);
  assert.equal((await Admin.checkKey(s, 'wrong', 'right-key', 0)).status, 401);
  assert.equal((await Admin.checkKey(s, 'right-key', 'right-key', 10)).status, 429, 'locked, even with the right key');
  assert.equal(await Admin.checkKey(s, 'right-key', 'right-key', Admin.ADMIN_LOCK_MS + 10), null, 'open again after 15 minutes');
  assert.equal((await Admin.checkKey(s, '', 'right-key', Admin.ADMIN_LOCK_MS + 20)).status, 401, 'an empty key never works');
});

test('admin: look up a player, reset a forgotten PIN, rename, remove; all logged, no secrets shown', async () => {
  const s = fakeStore();
  await A.signup(s, { username: 'Ngozi_Shop', age: '18+', pin: '4827' }, ctx);
  const p = await Admin.player(s, { username: 'ngozi_shop' });
  assert.deepEqual([p.json.username, p.json.age, p.json.game.level, p.json.game.day, p.json.game.cash], ['Ngozi_Shop', '18+', 2, 9, 12346]);
  const shown = JSON.stringify(p.json);
  for (const secret of ['salt', 'pinHash', 'token', 'data']) assert.equal(shown.includes(secret), false, `${secret} never shown`);
  assert.equal((await Admin.player(s, { username: 'nobody' })).status, 404);

  const r = await Admin.resetPin(s, { username: 'Ngozi_Shop' }, ctx);
  assert.match(r.json.pin, /^\d{4}$/);
  assert.equal((await A.login(s, { username: 'Ngozi_Shop', pin: '4827' }, ctx)).status, 401, 'the old PIN no longer works');
  assert.equal((await A.login(s, { username: 'Ngozi_Shop', pin: r.json.pin }, ctx)).status, 200, 'the new PIN works');
  assert.equal((await Admin.resetPin(s, { username: 'Ngozi_Shop', pin: '12' }, ctx)).status, 400);

  await A.signup(s, { username: 'Taken_Name', age: '18+', pin: '4827' }, ctx);
  assert.equal((await Admin.rename(s, { username: 'Ngozi_Shop', newUsername: 'Taken_Name' }, ctx)).status, 409);
  assert.equal((await Admin.rename(s, { username: 'Ngozi_Shop', newUsername: 'x' }, ctx)).status, 400);
  assert.equal((await Admin.rename(s, { username: 'Ngozi_Shop', newUsername: 'Ngozi_Store' }, ctx)).status, 200);
  assert.equal((await A.login(s, { username: 'Ngozi_Store', pin: r.json.pin }, ctx)).status, 200, 'logs in with the new name');

  assert.equal((await Admin.remove(s, { username: 'Ngozi_Store', confirm: 'wrong' }, ctx)).status, 400, 'must type the name');
  let left = null;
  assert.equal((await Admin.remove(s, { username: 'Ngozi_Store', confirm: 'Ngozi_Store', reason: 'rude name' }, { ...ctx, beforeDelete: (u) => { left = u.username; } })).status, 200);
  assert.equal(left, 'Ngozi_Store', 'leaves markets and championships first');
  assert.deepEqual(s.removed, ['ngozi_store']);
  assert.deepEqual(s.log.map((e) => e.action), ['reset PIN', 'rename', 'remove account']);
  assert.equal(JSON.stringify(s.log).includes(r.json.pin), false, 'the new PIN is never in the log');
});

test('admin page: no admin code in the game itself', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  for (const f of readdirSync('js')) assert.equal(readFileSync(`js/${f}`, 'utf8').includes('/admin/api'), false, f);
  assert.ok(Admin.adminPage().includes('noindex'));
});
