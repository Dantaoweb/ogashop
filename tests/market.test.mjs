import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../worker/markets.mjs';
import * as E from '../js/engine.js';
import { RULES } from '../js/data.js';
import { mulberry32 } from './sim.mjs';

RULES.lowStockAsk = 0;
const ctx = (now = 1000) => ({ now });

function fakeStore() {
  const markets = new Map();
  const members = new Map();
  let wins = [];
  return {
    markets, members,
    async getMember(k) { return members.get(k) || null; },
    async addMember({ marketId, userKey, username, age, slot, now, level }) { members.set(userKey, { marketId, userKey, username, age, slot, joinedAt: now, lastSeen: now, customers: 0, sales: 0, price: 'normal', advert: 0, level }); },
    async removeMember(k) { members.delete(k); },
    async membersOf(id) { return [...members.values()].filter((m) => m.marketId === id).sort((a, b) => a.slot - b.slot); },
    async getMarket(id) { return markets.get(id) || null; },
    async getMarketByCode(code) { return [...markets.values()].find((m) => m.code === code) || null; },
    async createMarket(m) { if ([...markets.values()].some((x) => x.code === m.code)) return false; markets.set(m.id, m); return true; },
    async deleteMarket(id) { markets.delete(id); },
    async findOpenQuick(size, level) { return [...markets.values()].find((m) => m.kind === 'quick' && m.size === size && m.level === level && [...members.values()].filter((x) => x.marketId === m.id).length < size) || null; },
    async clearInactiveQuick(before) { for (const [k, x] of members) if (markets.get(x.marketId)?.kind === 'quick' && x.lastSeen < before) members.delete(k); },
    async touchMember(k, now) { members.get(k).lastSeen = now; },
    async saveResult(k, r) { Object.assign(members.get(k), { customers: r.customers, sales: r.sales, price: r.price, advert: r.advert ? 1 : 0, level: r.level }); },
    async addWin(k, from, count, at) { wins.push({ k, from, count, at }); },
    async takeWins(k) { const mine = wins.filter((w) => w.k === k).map(({ from, count }) => ({ from, count })); wins = wins.filter((w) => w.k !== k); return mine; },
  };
}

const user = (name, age = '18+') => ({ key: name.toLowerCase(), username: name, age });
const result = (o = {}) => ({ customers: 6, sales: 12000, price: 'normal', advert: false, level: 1, gameDay: 2, lost: [], ...o });

test('quick join fills a market of the chosen size, then opens a new one', async () => {
  const s = fakeStore();
  const a = await M.quick(s, user('Ada'), { size: 2, level: 1 }, ctx());
  assert.equal(a.json.market.size, 2);
  assert.equal(a.json.market.code, null);
  const b = await M.quick(s, user('Bola'), { size: 2, level: 1 }, ctx());
  assert.equal(b.json.shops.length, 2);
  const c = await M.quick(s, user('Chi'), { size: 2, level: 1 }, ctx());
  assert.equal(c.json.shops.length, 1, 'first market full: a new one');
  assert.equal((await M.quick(s, user('Dan'), { size: 3, level: 1 }, ctx())).json.shops.length, 1, 'different size, different market');
  assert.equal((await M.quick(s, user('Eze'), { size: 9, level: 1 }, ctx())).status, 400);
});

test('market codes: join, full, wrong code, leave empties the market', async () => {
  const s = fakeStore();
  const made = await M.create(s, user('Ada'), { size: 2, level: 1 }, ctx());
  const { code } = made.json.market;
  assert.match(code, /^[A-Z]{6}$/);
  assert.equal((await M.join(s, user('Bola'), { code: code.toLowerCase() }, ctx())).json.shops.length, 2);
  assert.equal((await M.join(s, user('Chi'), { code }, ctx())).status, 409);
  assert.equal((await M.join(s, user('Chi'), { code: 'NOPE' }, ctx())).status, 404);
  await M.leave(s, user('Ada'));
  await M.leave(s, user('Bola'));
  assert.equal(s.markets.size, 0);
});

test('deleting an account leaves its market, and an empty market is removed', async () => {
  const A = await import('../worker/accounts.mjs');
  const s = fakeStore();
  const made = await M.create(s, user('Ada'), { size: 2, level: 1 }, ctx());
  assert.equal(s.markets.size, 1);
  const salted = { key: 'ada', username: 'Ada', fails: 0, lockedUntil: 0, salt: 'x', pinHash: 'bad' };
  s.setFails = async () => {};
  s.deleteUser = async () => {};
  assert.equal((await A.deleteAccount(s, salted, { pin: '4827' }, { pepper: 'p', now: 1, beforeDelete: () => M.leave(s, user('Ada')) })).status, 401);
  assert.equal(s.markets.size, 1, 'a wrong PIN changes nothing');
  await M.leave(s, user('Ada'));
  assert.equal(s.markets.size, 0);
  assert.ok(made.json.market.code);
});

test('ages 13-17 appear as "Shop N"; adults by username', async () => {
  const s = fakeStore();
  const { json } = await M.create(s, user('Ada'), { size: 3, level: 1 }, ctx());
  const v = await M.join(s, user('TeenName', '13-17'), { code: json.market.code }, ctx());
  assert.deepEqual(v.json.shops.map((x) => x.name), ['Ada', 'Shop 2']);
  assert.equal(JSON.stringify(v.json).includes('TeenName'), false);
});

test('results and won customers; impossible numbers ignored; away after 3 days', async () => {
  const s = fakeStore();
  const { json } = await M.create(s, user('Ada'), { size: 2, level: 1 }, ctx());
  await M.join(s, user('Bola'), { code: json.market.code }, ctx());
  await M.sync(s, user('Ada'), { result: result({ lost: [{ slot: 2, count: 9 }, { slot: 1, count: 1 }] }) }, ctx());
  const bola = await M.sync(s, user('Bola'), {}, ctx());
  assert.deepEqual(bola.json.wins, [{ from: 'Ada', count: 5 }], 'capped, and never from yourself');
  assert.equal(bola.json.shops[0].customers, 6);
  assert.deepEqual((await M.sync(s, user('Bola'), {}, ctx())).json.wins, [], 'handed over once');
  await M.sync(s, user('Ada'), { result: result({ customers: 6, sales: 99999999 }) }, ctx());
  assert.equal(s.members.get('ada').sales, 12000, 'impossible day ignored');
  const later = await M.sync(s, user('Bola'), {}, ctx(1000 + M.INACTIVE_MS + 1));
  assert.equal(later.json.shops.find((x) => x.name === 'Ada').active, false);
  assert.equal((await M.sync(s, user('Nobody'), {}, ctx())).status, 404);
});

function view(shops, wins = [], size = 4) {
  return { market: { code: 'ABCDEF', size, kind: 'code', level: 1 }, you: 1, shops: [{ slot: 1, name: 'Me', you: true, active: true, customers: 0, sales: 0, price: 'normal', advert: false }, ...shops], wins };
}
const rival = (slot, name, o = {}) => ({ slot, name, you: false, active: true, customers: 7, sales: 15000, price: 'normal', advert: false, ...o });
const shopper = { cid: 'musa', items: [{ item: 'rice', qty: 1 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0, moodRoll: 0.99, changeRoll: 1, fakeRoll: 1, payRoll: 0 };

test('in the game: real shops plus computer fillers, lost customers go to real shops', () => {
  const s = E.newGame('business', mulberry32(200));
  E.applyMarketView(s, view([rival(2, 'Tunde_Shop')], [{ from: 'Tunde_Shop', count: 3 }]));
  E.startDay(s, mulberry32(1));
  const names = s.today.market.rivals.map((r) => r.name);
  assert.equal(names.length, 3, 'size 4 means 3 rivals');
  assert.ok(names.includes('Tunde_Shop'));
  assert.ok(s.today.notices.some((n) => /You won 2 customers from Tunde_Shop|You won .* from Tunde_Shop/.test(n)));
  assert.deepEqual(s.mp.pendingWins, []);
  s.today.market.rivals = s.today.market.rivals.filter((r) => r.real);
  s.stock.rice = 0;
  s.today.queue = [{ ...shopper }, { ...shopper }];
  s.today.eventAt = 99;
  E.openShop(s);
  E.serve(s, 'sell');
  assert.match(s.today.outcome.text, /Tunde_Shop/);
  const r = E.dayResult(s);
  assert.deepEqual(r.lost, [{ slot: 2, count: 1 }]);
  assert.equal(r.gameDay, s.day);
  E.leaveMarketLocal(s);
  assert.equal(s.mp, null);
});

test('joining in the morning refreshes the market, keeping your customers', () => {
  const s = E.newGame('business', mulberry32(202));
  const mine = s.today.market.mine;
  E.applyMarketView(s, view([rival(2, 'Tunde_Shop')]));
  assert.ok(s.today.market.rivals.some((r) => r.name === 'Tunde_Shop' && r.real));
  assert.equal(s.today.market.mine, mine);
  assert.equal(s.today.queue.length, mine);
  E.leaveMarketLocal(s);
  assert.equal(s.today.market.rivals.some((r) => r.real), false);
});

test('rivals can change your share only a limited amount; away players become computer shops', () => {
  const s = E.newGame('business', mulberry32(201));
  const base = E.attraction(s).factor;
  E.applyMarketView(s, view([rival(2, 'A', { price: 'low', advert: true }), rival(3, 'B', { price: 'low', advert: true }), rival(4, 'C', { price: 'low', advert: true }), rival(5, 'D', { price: 'low', advert: true }), rival(6, 'E', { price: 'low', advert: true })], [], 6));
  assert.ok(base - E.attraction(s).factor <= 0.2 + 1e-9);
  E.applyMarketView(s, view([rival(2, 'Away', { active: false })]));
  E.startDay(s, mulberry32(2));
  assert.equal(s.today.market.rivals.some((r) => r.name === 'Away'), false);
  assert.equal(s.today.market.rivals.length, 3);
});
