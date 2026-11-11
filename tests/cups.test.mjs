import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../worker/cups.mjs';
import * as Cups from '../js/cups.js';
import * as E from '../js/engine.js';
import { mulberry32 } from './sim.mjs';

const DAY = 86400000;
const T0 = 1_000_000;

function fakeStore() {
  const cups = new Map();
  let players = [];
  return {
    cups,
    get players() { return players; },
    async createCup(c) { if ([...cups.values()].some((x) => x.code === c.code)) return false; cups.set(c.id, { ...c }); return true; },
    async updateCup(id, rules) { Object.assign(cups.get(id), rules); },
    async startCup(id, at, endsAt) { const c = cups.get(id); if (!c.startedAt) Object.assign(c, { startedAt: at, endsAt }); },
    async cancelCup(id) { cups.get(id).cancelled = 1; },
    async getCupByCode(code) { const c = [...cups.values()].find((x) => x.code === code); return c ? { ...c } : null; },
    async cupPlayers(id) { return players.filter((p) => p.cupId === id).sort((a, b) => a.slot - b.slot).map((p) => ({ ...p, stats: JSON.parse(JSON.stringify(p.stats)) })); },
    async addCupPlayer({ cupId, userKey, username, age, slot, now }) { players.push({ cupId, userKey, username, age, slot, joinedAt: now, stats: {} }); },
    async removeCupPlayer(id, key) { players = players.filter((p) => !(p.cupId === id && p.userKey === key)); },
    async deleteCup(id) { cups.delete(id); players = players.filter((p) => p.cupId !== id); },
    async saveCupStats(id, key, stats) { players.find((p) => p.cupId === id && p.userKey === key).stats = stats; },
    async activeCupCount(key, now) { return players.filter((p) => { const c = cups.get(p.cupId); return p.userKey === key && c && !c.cancelled && (!c.startedAt || c.endsAt > now); }).length; },
    async deleteOldCups(before) { for (const [id, c] of cups) if (c.createdAt < before) { cups.delete(id); players = players.filter((p) => p.cupId !== id); } },
  };
}

const user = (name, age = '18+') => ({ key: name.toLowerCase(), username: name, age });
const at = (now = T0) => ({ now });
const rules = (o = {}) => ({ name: 0, kind: 'real', length: 7, size: 5, events: ['score'], levelFrom: 1, levelTo: 7, startMode: 'host', level: 1, ...o });
const biz = (o = {}) => ({ days: 3, score: 60, profit: 2000, recording: 0.8, debts: 1, stocked: 0.5, quizRight: 4, quizTotal: 5, ...o });
const join = (s, name, code, o = {}, now = T0) => C.register(s, user(name, o.age), { code, level: 1, agree: true, ...o }, at(now));

test('create: rules are checked, the host is registered, registration is open', async () => {
  const s = fakeStore();
  const bad = async (o) => (await C.create(s, user('Ada'), rules(o), at())).status;
  assert.equal(await bad({ kind: 'weekly' }), 400);
  assert.equal(await bad({ kind: 'game', length: 3 }), 400, 'game days are 5, 7 or 14');
  assert.equal(await bad({ levelFrom: 3, levelTo: 2 }), 400);
  assert.equal(await bad({ levelTo: 8 }), 400);
  assert.equal(await bad({ startMode: 'time', startAt: T0 + 1000 }), 400, 'too soon');
  assert.equal(await bad({ startMode: 'time', startAt: T0 + 8 * DAY }), 400, 'too far');
  assert.match((await C.create(s, user('Ada'), rules({ levelFrom: 3, levelTo: 5 }), at())).json.error, /Start at Level 1 or 2/, 'levels 3-7 are coming soon');
  assert.equal((await C.create(s, user('Ada'), rules({ levelFrom: 2, levelTo: 2, level: 1 }), at())).status, 200, 'the host\'s own level does not matter: everyone gets a fresh shop');
  const r = await C.create(s, user('Ada'), rules({ kind: 'game', length: 5, events: ['quiz', 'score'], levelTo: 2 }), at());
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.cup.status, r.json.cup.host, r.json.registered, r.json.cup.kind, r.json.cup.length], ['open', true, true, 'game', 5]);
  assert.deepEqual(r.json.cup.events, ['score', 'quiz']);
  assert.deepEqual(r.json.standings, [], 'no table before the start');
});

test('register: see the rules first, agree, levels, full, teens hidden; rules lock once someone agrees', async () => {
  const s = fakeStore();
  const { json } = await C.create(s, user('Ada'), rules({ size: 3, levelFrom: 1, levelTo: 1 }), at());
  const code = json.cup.code;
  const info = await C.info(s, user('Bola'), { code }, at());
  assert.deepEqual([info.json.registered, info.json.cup.status, info.json.players.length], [false, 'open', 1]);
  assert.match((await C.register(s, user('Bola'), { code, level: 1 }, at())).json.error, /agree/);
  assert.equal((await C.info(s, user('Bola'), { code }, at())).json.registered, false);
  assert.equal((await C.update(s, user('Ada'), { ...rules({ size: 4, levelTo: 1 }), code }, at())).status, 200, 'host alone: can change');
  const v = await join(s, 'TeenName', code, { age: '13-17' });
  assert.deepEqual(v.json.players.map((p) => p.name), ['Ada', 'Player 2']);
  assert.equal(JSON.stringify(v.json).includes('TeenName'), false);
  assert.equal(v.json.cup.locked, true);
  assert.match((await C.update(s, user('Ada'), { ...rules(), code }, at())).json.error, /agreed/);
  assert.equal((await C.update(s, user('TeenName', '13-17'), { ...rules(), code }, at())).status, 403);
  await join(s, 'Chi', code);
  await join(s, 'Dan', code);
  assert.match((await join(s, 'Eze', code)).json.error, /full/);
});

test('start: host presses Start with 2+, or at the set time; too few means cancelled; late joiners refused', async () => {
  const s = fakeStore();
  const a = (await C.create(s, user('Ada'), rules(), at())).json.cup.code;
  assert.match((await C.start(s, user('Ada'), { code: a }, at())).json.error, /At least 2/);
  await join(s, 'Bola', a);
  assert.equal((await C.start(s, user('Bola'), { code: a }, at())).status, 403);
  const started = await C.start(s, user('Ada'), { code: a }, at(T0 + 500));
  assert.deepEqual([started.json.cup.status, started.json.cup.startedAt, started.json.cup.endsAt], ['running', T0 + 500, T0 + 500 + 7 * DAY]);
  assert.match((await join(s, 'Chi', a)).json.error, /already started/);

  const b = (await C.create(s, user('Dan'), rules({ startMode: 'time', startAt: T0 + 3600000 }), at())).json.cup.code;
  await join(s, 'Eze', b);
  assert.equal((await C.info(s, user('Eze'), { code: b }, at(T0 + 1000))).json.cup.status, 'open');
  const v = await C.info(s, user('Eze'), { code: b }, at(T0 + 3600000 + 5));
  assert.deepEqual([v.json.cup.status, v.json.cup.startedAt], ['running', T0 + 3600000], 'starts exactly at its time');

  const c = (await C.create(s, user('Fola'), rules({ startMode: 'time', startAt: T0 + 3600000 }), at())).json.cup.code;
  assert.equal((await C.info(s, user('Fola'), { code: c }, at(T0 + 3600001))).json.cup.status, 'cancelled', 'nobody registered');
  const d = (await C.create(s, user('Gbenga'), rules(), at())).json.cup.code;
  assert.equal((await C.info(s, user('Gbenga'), { code: d }, at(T0 + 7 * DAY))).json.cup.status, 'cancelled', 'never started in a week');
  const e = (await C.create(s, user('Hadi'), rules(), at())).json.cup.code;
  await join(s, 'Ife', e);
  await C.leave(s, user('Hadi'), { code: e }, at());
  assert.equal((await C.info(s, user('Ife'), { code: e }, at())).json.cup.status, 'cancelled', 'the host left before the start');
});

async function running(s, o) {
  const code = (await C.create(s, user('Ada'), rules(o), at())).json.cup.code;
  for (const n of ['Bola', 'Chi']) await join(s, n, code);
  await C.start(s, user('Ada'), { code }, at());
  return code;
}

test('points: by place with ties shared, business needs 3 days, games best then fastest, frozen at the end', async () => {
  const s = fakeStore();
  const code = await running(s, { events: ['score', 'profit', 'money', 'road', 'quiz'] });
  await C.sync(s, user('Ada'), { code, biz: biz({ score: 70, profit: 3000 }), games: [{ type: 'money', score: 6, ms: 30000 }, { type: 'road', hits: 2 }] }, at());
  await C.sync(s, user('Bola'), { code, biz: biz({ score: 70, profit: 1000, quizRight: 5 }), games: [{ type: 'money', score: 6, ms: 20000 }, { type: 'change', score: 5, ms: 20000 }] }, at());
  let v = await C.sync(s, user('Chi'), { code, biz: biz({ days: 2, score: 99, profit: 99999 }), games: [{ type: 'road', hits: 0 }] }, at());
  const table = (e) => v.json.events[e].map((r) => [r.name, r.place, r.points]);
  assert.deepEqual(table('score'), [['Ada', 1, 10], ['Bola', 1, 10]]);
  assert.deepEqual(table('profit'), [['Ada', 1, 10], ['Bola', 2, 8]]);
  assert.deepEqual(table('money'), [['Bola', 1, 10], ['Ada', 2, 8]]);
  assert.deepEqual(table('road'), [['Chi', 1, 10], ['Ada', 2, 8]]);
  assert.equal(v.json.events.change, undefined);
  assert.deepEqual(table('quiz'), [['Bola', 1, 10], ['Ada', 2, 8], ['Chi', 2, 8]]);
  assert.deepEqual(v.json.standings.map((x) => [x.name, x.points, x.place]), [['Ada', 44, 1], ['Bola', 38, 2], ['Chi', 18, 3]]);
  await C.sync(s, user('Ada'), { code, biz: biz({ score: 101 }) }, at());
  assert.equal((await C.info(s, user('Ada'), { code }, at())).json.events.score[0].value, 70, 'impossible numbers ignored');
  v = await C.sync(s, user('Chi'), { code, biz: biz({ score: 100, profit: 99999 }) }, at(T0 + 7 * DAY));
  assert.equal(v.json.cup.status, 'ended');
  assert.equal(v.json.standings.find((x) => x.name === 'Chi').points, 18, 'nothing changes after the end');
});

test('by game days: numbers stop after your game days; it ends when everyone has played them', async () => {
  const s = fakeStore();
  const code = await running(s, { kind: 'game', length: 5, events: ['profit', 'money'] });
  await C.sync(s, user('Ada'), { code, biz: biz({ days: 5, profit: 3000 }) }, at());
  await C.sync(s, user('Ada'), { code, biz: biz({ days: 6, profit: 9000 }), games: [{ type: 'money', score: 6, ms: 9000 }] }, at());
  let v = await C.info(s, user('Ada'), { code }, at());
  assert.equal(v.json.events.profit[0].value, 3000, 'a 6th game day is not counted');
  assert.equal(v.json.events.money.length, 0, 'no games after your days are used');
  assert.deepEqual(v.json.players.map((p) => p.days), [5, 0, 0]);
  assert.equal(v.json.cup.status, 'running');
  await C.sync(s, user('Bola'), { code, biz: biz({ days: 5 }) }, at());
  v = await C.sync(s, user('Chi'), { code, biz: biz({ days: 5 }) }, at());
  assert.equal(v.json.cup.status, 'ended');
  assert.equal(v.json.cup.endsAt, T0 + 14 * DAY, 'with a 14-day backstop');
});

test('in the game: a fresh championship shop at the start, the same customers for everyone, own shop untouched', () => {
  const home = E.newGame('business', mulberry32(300));
  home.cash = 77777;
  home.level = 2;
  const view = (status, o = {}) => ({ cup: { code: 'ABCDEF', name: 'Market Cup', kind: 'game', length: 5, events: ['profit', 'money'], levelFrom: 1, levelTo: 1, startMode: 'host', status, endsAt: T0, house: { goal: 'phone' }, ...o }, registered: true, players: [{ name: 'Me', you: true, days: 0 }], standings: [{ name: 'Me', you: true, points: 10, place: 1 }], events: {} });
  const cup = Cups.applyCupView(home, view('open'));
  assert.equal(cup.shop, null, 'no shop before the start');
  assert.equal(Cups.cupBiz(home, cup), null);
  assert.equal(Cups.statusLine(cup), 'Waiting for the host to start');
  Cups.queueCupGame(home, { type: 'money', score: 4, ms: 30000 }, 'ABCDEF');
  assert.deepEqual(cup.games, [], 'no games before the start');
  Cups.applyCupView(home, view('running'));
  const shop = cup.shop;
  assert.deepEqual([shop.cash, shop.level, shop.day, shop.cupCode, shop.maxLevel], [20000, 1, 1, 'ABCDEF', 1], 'same start for everyone');
  assert.equal(home.cash, 77777, 'your own shop is not touched');
  assert.equal(shop.goal.name, 'Smartphone', 'the agreed goal is set in the championship shop');
  const other = Cups.applyCupView(E.newGame('learning', mulberry32(9)), view('running')).shop;
  assert.deepEqual(shop.today.queue.map((r) => r.cid), other.today.queue.map((r) => r.cid), 'the same customers for every player');
  E.startDay(shop); E.startDay(other);
  assert.deepEqual(shop.today.queue.map((r) => r.cid), other.today.queue.map((r) => r.cid), 'and on the next day too');
  shop.stats.days = 3; shop.totalProfit = 6000;
  assert.deepEqual([Cups.bizToSend(home, cup).days, Cups.bizToSend(home, cup).profit], [3, 2000]);
  Cups.queueCupGame(home, { type: 'money', score: 4, ms: 30000 }, 'ABCDEF');
  Cups.queueCupGame(home, { type: 'money', score: 6, ms: 30000 }, 'OTHERS');
  assert.deepEqual(cup.games, [{ type: 'money', score: 4, ms: 30000 }], 'only games for this championship');
  shop.stats.days = 6;
  assert.equal(Cups.cupBiz(home, cup), null, 'past the 5 game days');
  shop.stats.days = 5;
  Cups.bizToSend(home, cup);
  assert.equal(Cups.gamesCount(cup), false, 'all 5 game days played');
  assert.equal(Cups.shopDone(cup), true, 'nothing more to play');
  const body = Cups.rulesBody({ ...Cups.STANDARD_RULES, start: 'tomorrow' }, 1, new Date(2026, 10, 10, 15, 0).getTime());
  assert.equal(new Date(body.startAt).getHours(), 8);
  assert.equal(Cups.rulesBody(Cups.STANDARD_RULES, 1).startMode, 'host');
});

test('a championship shop stops at its top level', () => {
  const shop = E.newGame('business', mulberry32(5), { seed: 1, code: 'TOPLVL', level: 1, maxLevel: 1 });
  shop.levelProfit = 999999;
  shop.score = 100;
  shop.today.queue = [];
  shop.today.eventAt = 99;
  E.openShop(shop);
  assert.equal(shop.phase, 'evening');
  assert.equal(shop.today.levelUp, false);
  const two = E.newGame('business', mulberry32(5), { seed: 1, code: 'LEVEL2', level: 2, maxLevel: 2 });
  assert.equal(two.level, 2);
  assert.ok(E.goodsForLevel(2).every((id) => id in two.stock));
});

test('house rules: checked, +1 a kept day, -2 a broken day, strict puts you out, goal and keeper events', async () => {
  const s = fakeStore();
  const make = (o) => C.create(s, user('Zed'), rules(o), at());
  assert.equal((await make({ house: { save: 750 } })).status, 400, 'amounts on their step');
  assert.equal((await make({ house: { fly: true } })).status, 400, 'unknown rule');
  assert.equal((await make({ house: { record: 'yes' } })).status, 400);
  assert.equal((await make({ events: ['goal'] })).status, 400, 'the savings event needs a goal');
  assert.equal((await make({ events: ['keeper'] })).status, 400, 'the keeper event needs a rule');
  const code = await running(s, { events: ['profit', 'goal', 'keeper'], house: { save: 1000, record: true, goal: 'fees', strict: true } });
  const info = await C.info(s, user('Ada'), { code }, at());
  assert.deepEqual(info.json.cup.house, { save: 1000, record: true, goal: 'fees', strict: true });
  await C.sync(s, user('Ada'), { code, biz: biz({ profit: 3000, ruleDays: 3, keptDays: 3, brokenDays: 0, goalPct: 0.5 }) }, at());
  await C.sync(s, user('Bola'), { code, biz: biz({ profit: 1000, ruleDays: 3, keptDays: 1, brokenDays: 2, goalPct: 0.9 }) }, at());
  let v = await C.sync(s, user('Chi'), { code, biz: biz({ profit: 2000, ruleDays: 3, keptDays: 0, brokenDays: 3, goalPct: 0.1 }) }, at());
  const rows = v.json.standings.map((r) => [r.name, r.points, r.place, r.out]);
  // Ada: profit 10 + goal 8 + keeper 10 + 3 kept = 31. Bola: 6 + 10 + 8 + 1 - 4 = 21. Chi: out.
  assert.deepEqual(rows, [['Ada', 31, 1, false], ['Bola', 21, 2, false], ['Chi', 0, null, true]]);
  assert.equal(v.json.events.goal[0].name, 'Bola', 'biggest share of the goal');
  await C.sync(s, user('Ada'), { code, biz: biz({ ruleDays: 2, keptDays: 3, brokenDays: 0 }) }, at());
  assert.equal((await C.info(s, user('Ada'), { code }, at())).json.standings[0].kept, 3, 'impossible rule counts ignored');
});

test('house rules in the game: checked in the championship shop each evening, once a day', () => {
  const home = E.newGame('business', mulberry32(302));
  const view = { cup: { code: 'HOUSEX', name: 'Family Cup', kind: 'real', length: 7, events: ['goal'], levelFrom: 1, levelTo: 2, startMode: 'host', status: 'running', endsAt: Date.now() + DAY, house: { save: 1000, record: true, pocket: true, prices: true, cash: 5000, discount: 200, bills: true, goal: 'fees' } }, registered: true, players: [], standings: [], events: {} };
  const cup = Cups.applyCupView(home, view);
  const s = cup.shop;
  const t = s.today;
  Object.assign(t, { paidSelf: 1000, sales: 3, recordedSales: 3, personal: [{ from: 'pocket' }], morningPrices: { ...s.prices }, discounts: 100 });
  s.cash = 6000;
  s.bills = [];
  assert.deepEqual(Cups.checkRules(s, cup.house).broken, [], 'the agreed goal is already set');
  s.goal = null;
  assert.deepEqual(Cups.checkRules(s, cup.house).broken, ['goal']);
  s.goal = { name: 'School fees for one term', price: 40000, since: 1 };
  Object.assign(t, { paidSelf: 500, recordedSales: 2, personal: [{ from: 'business' }], discounts: 300 });
  s.prices.rice += 100;
  s.cash = 100;
  s.bills = [{ due: s.day }];
  const r = Cups.checkRules(s, cup.house);
  assert.deepEqual(r.broken.sort(), ['bills', 'cash', 'discount', 'pocket', 'prices', 'record', 'save']);
  t.eventRaised = { rice: true };
  assert.equal(Cups.checkRules(s, cup.house).broken.includes('prices'), false, 'a price raised by an event is fine');
  s.stats.days += 1;
  assert.equal(Cups.dayRules(home, s).length, 1);
  assert.equal(Cups.dayRules(home, s).length, 0, 'once per game day');
  assert.equal(Cups.dayRules(home, home).length, 0, 'your own shop has no house rules');
  s.pocket = 10000;
  const b = Cups.bizToSend(home, cup);
  assert.deepEqual([b.ruleDays, b.keptDays, b.brokenDays, b.goalPct], [1, 0, 1, 0.25]);
});

test('the end: a trophy and badges once; no points means taking part', () => {
  const s = E.newGame('business', mulberry32(301));
  const end = (code, standings, events = {}) => ({ cup: { code, name: 'Family Cup', kind: 'real', length: 7, endsAt: 5, status: 'ended', events: ['money', 'score'], levelFrom: 1, levelTo: 7 }, standings, events, players: [] });
  const cup = Cups.applyCupView(s, end('CUPCUP', [{ name: 'Me', you: true, points: 18, wins: 2, place: 1 }, { name: 'B', you: false, points: 8, place: 2 }], { money: [{ you: true, place: 1 }], score: [{ you: true, place: 1 }] }));
  cup.lastBiz = { days: 4 };
  const tr = Cups.awardCup(s, cup);
  assert.deepEqual([tr.kind, tr.place, tr.of, tr.points, tr.eventsWon], ['gold', 1, 2, 18, ['money', 'score']]);
  assert.deepEqual(tr.badges, ['cup_champion', 'cup_podium', 'cup_full']);
  assert.equal(Cups.awardCup(s, cup), null, 'once only');
  const t2 = Cups.awardCup(s, Cups.applyCupView(s, end('OTHERS', [{ name: 'Me', you: true, points: 0, wins: 0, place: 1 }])));
  assert.equal(t2.kind, 'part');
  assert.equal(Cups.awardCup(s, Cups.applyCupView(s, { ...end('RUNNIN', []), cup: { ...end('RUNNIN', []).cup, status: 'running' } })), null);
  assert.equal(Cups.ordinal(23), '23rd');
});

test('markets: each venue changes the day the way it says', async () => {
  const C2 = await import('../js/core.js');
  const shopIn = (venue, seed = 7) => E.newGame('business', mulberry32(seed), { seed: 42, code: 'VENUEX', level: 1, maxLevel: 2, venue });
  const classic = shopIn('classic');
  assert.equal(C2.buyPrice(shopIn('floating'), 'rice'), Math.round(C2.buyPrice(classic, 'rice') * 1.05 / 10) * 10, 'boat transport');
  assert.ok(C2.refPrice(shopIn('mall'), 'rice') > C2.refPrice(classic, 'rice'), 'mall customers accept more');
  assert.ok(C2.refPrice(shopIn('wholesale'), 'rice') < C2.refPrice(classic, 'rice'), 'wholesale prices are lower');
  const avgQty = (venue) => {
    let n = 0, q = 0;
    for (let i = 0; i < 20; i++) { const s = shopIn(venue, i); s.seed = 1000 + i; E.startDay(s); for (const r of s.today.queue) for (const it of r.items) { n++; q += it.qty; } }
    return q / n;
  };
  assert.ok(avgQty('wholesale') > avgQty('classic') * 1.5, 'wholesale buyers buy in bulk');
  const night = shopIn('night');
  night.today.queue = [];
  night.today.eventAt = 99;
  E.openShop(night);
  assert.ok(night.today.expenses.some((e) => e.label === 'Lantern and generator fuel' && e.amount === 200), 'lights cost money at night');
  const mall = shopIn('mall');
  assert.ok(mall.today.queue.every((r) => r.kind !== 'discount'), 'no bargaining in a mall');
  const counts = (venue) => { const s = shopIn(venue); let n = 0; for (let d = 0; d < 15; d++) { s.seed = 500 + d; E.startDay(s); n += s.today.queue.length; } return n; };
  assert.ok(counts('festive') > counts('classic'), 'festive rush');
});

test('market events: only in their own market, each choice works', async () => {
  const Ev = await import('../js/events.js');
  const ids = { open: 'pickpocket', mall: 'mall_inspection', bazaar: 'bazaar_spot', night: 'generator', floating: 'wave', wholesale: 'bulk_credit', festive: 'helper' };
  for (const [venue, id] of Object.entries(ids)) {
    const seen = new Set();
    for (let seed = 0; seed < 120; seed++) {
      const s = E.newGame('business', mulberry32(seed), { seed: 3, code: 'EVENTS', level: 1, maxLevel: 2, venue });
      s.today.moneyIn = 5000; s.stock.garri = 10; s.stock.water = 5; s.today.idx = 0;
      s.eventLog = {};
      const e = Ev.drawEvent(s, mulberry32(seed + 1));
      if (e) seen.add(e.id);
    }
    assert.ok(seen.has(id), `${id} comes up in the ${venue} market`);
    for (const other of Object.values(ids)) if (other !== id) assert.ok(!seen.has(other), `${other} never comes up in the ${venue} market`);
    const def = Ev.EVENT_BY_ID[id];
    const s = E.newGame('business', mulberry32(9), { seed: 3, code: 'EVENTS', level: 1, maxLevel: 2, venue });
    s.today.moneyIn = 5000; s.stock.garri = 10; s.stock.water = 5;
    s.today.queue = s.today.queue.concat(s.today.queue, s.today.queue);
    const ctx = def.eligible(s);
    assert.ok(ctx, `${id} can happen`);
    def.choices(s, ctx).forEach((c, i) => {
      const copy = JSON.parse(JSON.stringify(s));
      const out = c.run(copy, ctx, () => 0.1);
      assert.equal(typeof out, 'string', `${id} choice ${i} says what happened`);
    });
  }
  const classic = E.newGame('business', mulberry32(1));
  for (let seed = 0; seed < 60; seed++) assert.ok(!Object.values(ids).includes(Ev.drawEvent({ ...classic, eventLog: {} }, mulberry32(seed))?.id), 'never in your own shop');
});

test('festive helper: nobody leaves the queue that day', () => {
  const s = E.newGame('business', mulberry32(11), { seed: 3, code: 'HELPER', level: 1, maxLevel: 2, venue: 'festive' });
  s.today.helper = true;
  assert.equal(E.queueLeave(s), false);
});
