import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../worker/cups.mjs';
import * as Cups from '../js/cups.js';
import * as E from '../js/engine.js';
import { mulberry32 } from './sim.mjs';

const DAY = 86400000;

function fakeStore() {
  const cups = new Map();
  let players = [];
  return {
    cups,
    get players() { return players; },
    async createCup(c) { if ([...cups.values()].some((x) => x.code === c.code)) return false; cups.set(c.id, c); return true; },
    async getCupByCode(code) { return [...cups.values()].find((c) => c.code === code) || null; },
    async cupPlayers(id) { return players.filter((p) => p.cupId === id).sort((a, b) => a.slot - b.slot).map((p) => ({ ...p, stats: JSON.parse(JSON.stringify(p.stats)) })); },
    async addCupPlayer({ cupId, userKey, username, age, slot, now }) { players.push({ cupId, userKey, username, age, slot, joinedAt: now, stats: {} }); },
    async removeCupPlayer(id, key) { players = players.filter((p) => !(p.cupId === id && p.userKey === key)); },
    async deleteCup(id) { cups.delete(id); players = players.filter((p) => p.cupId !== id); },
    async saveCupStats(id, key, stats) { players.find((p) => p.cupId === id && p.userKey === key).stats = stats; },
    async activeCupCount(key, now) { return players.filter((p) => p.userKey === key && cups.get(p.cupId)?.endsAt > now).length; },
    async deleteEndedCups(before) { for (const [id, c] of cups) if (c.endsAt < before) { cups.delete(id); players = players.filter((p) => p.cupId !== id); } },
  };
}

const user = (name, age = '18+') => ({ key: name.toLowerCase(), username: name, age });
const ctx = (now = 1000) => ({ now });
const biz = (o = {}) => ({ days: 3, score: 60, profit: 2000, recording: 0.8, debts: 1, stocked: 0.5, quizRight: 4, quizTotal: 5, ...o });

test('create: settings are checked, events kept in order, creator joins', async () => {
  const s = fakeStore();
  assert.equal((await C.create(s, user('Ada'), { name: 99, days: 7, size: 5, events: ['score'] }, ctx())).status, 400);
  assert.equal((await C.create(s, user('Ada'), { name: 0, days: 5, size: 5, events: ['score'] }, ctx())).status, 400);
  assert.equal((await C.create(s, user('Ada'), { name: 0, days: 7, size: 21, events: ['score'] }, ctx())).status, 400);
  assert.equal((await C.create(s, user('Ada'), { name: 0, days: 7, size: 5, events: [] }, ctx())).status, 400);
  assert.equal((await C.create(s, user('Ada'), { name: 0, days: 7, size: 5, events: ['score', 'hack'] }, ctx())).status, 400);
  const r = await C.create(s, user('Ada'), { name: 1, days: 3, size: 4, events: ['quiz', 'score', 'money'] }, ctx());
  assert.equal(r.status, 200);
  assert.equal(r.json.cup.name, 'Naira Masters');
  assert.deepEqual(r.json.cup.events, ['score', 'money', 'quiz']);
  assert.equal(r.json.cup.endsAt, 1000 + 3 * DAY);
  assert.match(r.json.cup.code, /^[A-Z]{6}$/);
  assert.deepEqual(r.json.standings.map((x) => [x.name, x.you, x.points]), [['Ada', true, 0]]);
});

test('join: full, finished, wrong code, at most 3 at a time; teens hidden; leaving empties it', async () => {
  const s = fakeStore();
  const { json } = await C.create(s, user('Ada'), { name: 0, days: 7, size: 2, events: ['score'] }, ctx());
  const v = await C.join(s, user('TeenName', '13-17'), { code: json.cup.code.toLowerCase() }, ctx());
  assert.deepEqual(v.json.standings.map((x) => x.name), ['Ada', 'Player 2']);
  assert.equal(JSON.stringify(v.json).includes('TeenName'), false);
  assert.equal((await C.join(s, user('Chi'), { code: json.cup.code }, ctx())).status, 409, 'full');
  assert.equal((await C.join(s, user('Chi'), { code: 'NOPE' }, ctx())).status, 404);
  for (let i = 0; i < 2; i++) await C.create(s, user('Ada'), { name: 0, days: 7, size: 5, events: ['score'] }, ctx());
  assert.match((await C.create(s, user('Ada'), { name: 0, days: 7, size: 5, events: ['score'] }, ctx())).json.error, /3 championships/);
  const late = await C.create(s, user('Dan'), { name: 0, days: 3, size: 5, events: ['score'] }, ctx());
  assert.equal((await C.join(s, user('Eze'), { code: late.json.cup.code }, ctx(1000 + 3 * DAY))).status, 409, 'finished');
  await C.leave(s, user('Dan'), { code: late.json.cup.code });
  assert.equal(await s.getCupByCode(late.json.cup.code), null, 'empty championship removed');
});

test('points: by place with ties shared, business needs 3 days, games best then fastest, nothing after the end', async () => {
  const s = fakeStore();
  const { json } = await C.create(s, user('Ada'), { name: 0, days: 7, size: 5, events: ['score', 'profit', 'money', 'road', 'quiz'] }, ctx());
  const code = json.cup.code;
  for (const n of ['Bola', 'Chi']) await C.join(s, user(n), { code }, ctx());
  await C.sync(s, user('Ada'), { code, biz: biz({ score: 70, profit: 3000 }), games: [{ type: 'money', score: 6, ms: 30000 }, { type: 'road', hits: 2 }] }, ctx());
  await C.sync(s, user('Bola'), { code, biz: biz({ score: 70, profit: 1000, quizRight: 5 }), games: [{ type: 'money', score: 6, ms: 20000 }, { type: 'change', score: 5, ms: 20000 }] }, ctx());
  let v = await C.sync(s, user('Chi'), { code, biz: biz({ days: 2, score: 99, profit: 99999 }), games: [{ type: 'road', hits: 0 }] }, ctx());
  const table = (e) => v.json.events[e].map((r) => [r.name, r.place, r.points]);
  assert.deepEqual(table('score'), [['Ada', 1, 10], ['Bola', 1, 10]], 'a tie shares 1st; Chi has only 2 days');
  assert.deepEqual(table('profit'), [['Ada', 1, 10], ['Bola', 2, 8]]);
  assert.deepEqual(table('money'), [['Bola', 1, 10], ['Ada', 2, 8]], 'same score: faster wins');
  assert.deepEqual(table('road'), [['Chi', 1, 10], ['Ada', 2, 8]], 'fewest bumps');
  assert.equal(v.json.events.change, undefined, 'events not chosen are not played');
  assert.deepEqual(table('quiz'), [['Bola', 1, 10], ['Ada', 2, 8], ['Chi', 2, 8]], 'the quiz needs questions, not days');
  assert.deepEqual(v.json.standings.map((x) => [x.name, x.points, x.place]), [['Ada', 44, 1], ['Bola', 38, 2], ['Chi', 18, 3]]);
  v = await C.sync(s, user('Ada'), { code, games: [{ type: 'money', score: 2, ms: 5000 }, { type: 'money', score: 9, ms: 50000 }, { type: 'road', hits: -1 }] }, ctx());
  assert.deepEqual(v.json.events.money[1].value, { score: 6, ms: 30000 }, 'worse or impossible games are ignored');
  await C.sync(s, user('Ada'), { code, biz: biz({ score: 101 }) }, ctx());
  assert.equal((await s.cupPlayers(s.players[0].cupId))[0].stats.biz.score, 70, 'impossible business numbers ignored');
  v = await C.sync(s, user('Chi'), { code, biz: biz({ score: 100, profit: 99999 }) }, ctx(1000 + 7 * DAY));
  assert.equal(v.json.cup.ended, true);
  assert.equal(v.json.standings.find((x) => x.name === 'Chi').points, 18, 'after the end nothing changes');
  assert.equal((await C.sync(s, user('Nobody'), { code }, ctx())).status, 404);
});

test('the end: a trophy and badges once; no points means taking part', () => {
  const s = E.newGame('business', mulberry32(301));
  const end = (standings, events = {}) => ({ cup: { code: 'CUPCUP', name: 'Family Cup', endsAt: 5, days: 7, ended: true, events: ['money', 'score'] }, standings, events, players: standings.length });
  const cup = Cups.applyCupView(s, end([{ name: 'Me', you: true, points: 18, wins: 2, place: 1 }, { name: 'B', you: false, points: 8, place: 2 }], { money: [{ you: true, place: 1 }], score: [{ you: true, place: 1 }] }));
  cup.daysIn = 4;
  const tr = Cups.awardCup(s, cup);
  assert.deepEqual([tr.kind, tr.place, tr.of, tr.points, tr.eventsWon], ['gold', 1, 2, 18, ['money', 'score']]);
  assert.deepEqual(tr.badges, ['cup_champion', 'cup_podium', 'cup_full']);
  assert.equal(Cups.awardCup(s, cup), null, 'once only');
  assert.equal(s.trophies.length, 1);
  assert.equal(s.trophyNews.length, 1);
  const c2 = Cups.applyCupView(s, { ...end([{ name: 'Me', you: true, points: 0, wins: 0, place: 1 }]), cup: { code: 'OTHERS', name: 'Friday Cup', endsAt: 5, days: 3, ended: true, events: ['score'] } });
  const t2 = Cups.awardCup(s, c2);
  assert.equal(t2.kind, 'part', 'first with no points is not a gold');
  assert.deepEqual(t2.badges, []);
  const running = Cups.applyCupView(s, { ...end([]), cup: { code: 'RUNNIN', name: 'Market Cup', endsAt: Date.now() + DAY, days: 7, ended: false, events: ['score'] } });
  assert.equal(Cups.awardCup(s, running), null, 'nothing before the end');
});

test('in the game: numbers count from joining, as averages; best game waits to be sent', () => {
  const s = E.newGame('business', mulberry32(300));
  s.stats.days = 4; s.totalProfit = 9000; s.stats.recW = 5; s.stats.totW = 10; s.quizLog = [{ correct: 1, total: 5 }];
  const view = { cup: { code: 'ABCDEF', name: 'Market Cup', endsAt: Date.now() + DAY, events: ['profit', 'money'] }, standings: [{ name: 'Me', you: true, points: 10, place: 1 }, { name: 'B', you: false, points: 8, place: 2 }], events: {}, players: 2 };
  const cup = Cups.applyCupView(s, view);
  assert.deepEqual(Cups.cupBiz(s, cup), { days: 0, score: s.score, profit: 0, recording: null, debts: null, stocked: null, quizRight: 0, quizTotal: 0 });
  s.stats.days = 7; s.totalProfit = 15000; s.stats.recW = 11; s.stats.totW = 16; s.stats.cleanDays += 3;
  s.quizLog.push({ correct: 4, total: 5 });
  const b = Cups.cupBiz(s, cup);
  assert.deepEqual([b.days, b.profit, b.recording, b.stocked, b.quizRight, b.quizTotal], [3, 2000, 1, 1, 4, 5]);
  Cups.queueCupGame(s, { type: 'money', score: 4, ms: 30000 });
  Cups.queueCupGame(s, { type: 'money', score: 4, ms: 40000 });
  Cups.queueCupGame(s, { type: 'road', hits: 1 });
  assert.deepEqual(cup.games, [{ type: 'money', score: 4, ms: 30000 }], 'only chosen events, only the best');
  assert.deepEqual(Cups.myPlace(cup), { place: 1, of: 2, points: 10 });
  assert.equal(Cups.ordinal(2), '2nd');
  assert.equal(Cups.ordinal(11), '11th');
  assert.equal(Cups.ordinal(23), '23rd');
  Cups.applyCupView(s, view);
  assert.equal(s.cups.length, 1, 'joining again keeps one entry');
});
