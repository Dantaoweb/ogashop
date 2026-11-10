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
  assert.match((await C.create(s, user('Ada'), rules({ levelFrom: 2, levelTo: 2, level: 1 }), at())).json.error, /Levels? 2/, 'the host must be in the levels');
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
  assert.match((await join(s, 'Bola', code, { level: 2 })).json.error, /Level 1\. Your shop is at Level 2/);
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

test('in the game: nothing counts before the start; game days and levels limit what counts', () => {
  const s = E.newGame('business', mulberry32(300));
  const view = (status, o = {}) => ({ cup: { code: 'ABCDEF', name: 'Market Cup', kind: 'game', length: 5, events: ['profit', 'money'], levelFrom: 1, levelTo: 1, startMode: 'host', status, endsAt: T0, ...o }, registered: true, players: [{ name: 'Me', you: true, days: 0 }], standings: [{ name: 'Me', you: true, points: 10, place: 1 }], events: {} });
  const cup = Cups.applyCupView(s, view('open'));
  s.stats.days = 4; s.totalProfit = 9000;
  assert.equal(cup.base, null);
  assert.equal(Cups.cupBiz(s, cup), null, 'before the start nothing counts');
  assert.equal(Cups.statusLine(cup), 'Waiting for the host to start');
  Cups.queueCupGame(s, { type: 'money', score: 4, ms: 30000 });
  assert.deepEqual(cup.games, [], 'no games before the start');
  Cups.applyCupView(s, view('running'));
  assert.equal(cup.base.days, 4, 'the start point is taken at the start');
  s.stats.days = 7; s.totalProfit = 15000;
  assert.deepEqual([Cups.bizToSend(s, cup).days, Cups.bizToSend(s, cup).profit], [3, 2000]);
  Cups.queueCupGame(s, { type: 'money', score: 4, ms: 30000 });
  assert.equal(cup.games.length, 1);
  s.level = 2;
  assert.equal(Cups.cupBiz(s, cup), null, 'outside the levels');
  assert.equal(Cups.bizToSend(s, cup).days, 3, 'the last numbers that counted are kept');
  assert.equal(Cups.gamesCount(s, cup), false);
  s.level = 1;
  s.stats.days = 20;
  assert.equal(Cups.cupBiz(s, cup), null, 'past the 5 game days');
  s.stats.days = 9;
  Cups.bizToSend(s, cup);
  assert.equal(Cups.gamesCount(s, cup), false, 'all 5 game days played');
  assert.equal(Cups.statusLine(cup), 'Game day 1 of 5', 'the line follows the server');
  const body = Cups.rulesBody({ ...Cups.STANDARD_RULES, start: 'tomorrow' }, 1, new Date(2026, 10, 10, 15, 0).getTime());
  assert.equal(new Date(body.startAt).getHours(), 8);
  assert.equal(body.startMode, 'time');
  assert.equal(Cups.rulesBody(Cups.STANDARD_RULES, 1).startMode, 'host');
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
