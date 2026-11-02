import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { EVENTS, EVENT_BY_ID } from '../js/events.js';
import { CUST } from '../js/core.js';
import { play, mulberry32 } from './sim.mjs';

test('new game starts on Day 1 morning with ₦20,000', () => {
  const s = E.newGame('learning', mulberry32(1));
  assert.equal(s.day, 1);
  assert.equal(s.phase, 'morning');
  assert.equal(s.cash, 20000);
  assert.ok(s.today.queue.length >= 6 && s.today.queue.length <= 8);
});

test('save survives JSON round trip', () => {
  const s = E.newGame('business', mulberry32(2));
  const copy = JSON.parse(JSON.stringify(s));
  assert.deepEqual(copy, s);
});

test('credit sale: cash in, profit counted, debt created; recording marks it', () => {
  const s = E.newGame('business', mulberry32(3));
  s.today.queue = [{ cid: 'mamabola', items: [{ item: 'rice', qty: 2 }], kind: 'credit', frac: 0.6, disc: 0.1, walkRoll: 0.99, acceptRoll: 0 }];
  E.openShop(s);
  assert.equal(s.phase, 'selling');
  const cash = s.cash;
  E.serve(s, 'credit');
  assert.equal(s.phase, 'record');
  assert.equal(s.cash, cash + 3000);
  assert.equal(s.today.profit, 1000);
  const debt = s.debts[0];
  assert.equal(debt.amount, 2000);
  assert.equal(debt.recorded, false);
  E.titiMessage(s, 'sold 2 rice to Mama Bola 5000, paid 3000');
  assert.equal(debt.recorded, true);
  assert.equal(s.today.pending.recorded, true);
});

test('wrong message is not recorded', () => {
  const s = E.newGame('business', mulberry32(4));
  s.today.queue = [{ cid: 'musa', items: [{ item: 'garri', qty: 3 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0 }];
  E.openShop(s);
  E.serve(s, 'sell');
  E.titiMessage(s, 'sold 2 garri 1100 cash');
  assert.equal(s.today.pending.recorded, false);
  assert.match(s.today.chat.at(-1).text, /Almost/);
});

test('discount: shown on the record, customer reacts, evening counts it', () => {
  const s = E.newGame('business', mulberry32(6));
  s.today.queue = [{ cid: 'mamabola', items: [{ item: 'rice', qty: 2 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0 }];
  E.openShop(s);
  E.serve(s, 'discount');
  const sale = s.today.pending;
  assert.equal(sale.listTotal, 5000);
  assert.equal(sale.discount, 500);
  assert.equal(sale.total, 4500);
  assert.equal(s.today.discounts, 500);
  assert.equal(s.today.reaction.cid, 'mamabola');
  assert.equal(s.today.reaction.mood, 'happy');
  assert.match(s.today.reaction.note, /Mama Bola/);
  E.titiMessage(s, 'sold 2 rice to Mama Bola 5000, discount 500, paid 4500');
  const card = s.today.chat.at(-1).card;
  assert.equal(card.discount, 500);
  assert.equal(card.listTotal, 5000);
});

test('every sale gets a customer reaction', () => {
  for (const [kind, action, cid] of [['cash', 'sell', 'musa'], ['credit', 'credit', 'iyatunde'], ['credit', 'credit', 'chidi'], ['discount', 'sell', 'aisha'], ['discount', 'fullprice', 'aisha'], ['credit', 'cashonly', 'mrokon']]) {
    const s = E.newGame('business', mulberry32(8));
    s.today.queue = [{ cid, items: [{ item: 'garri', qty: 2 }], kind, frac: 0.5, disc: 0.1, walkRoll: 0.99, acceptRoll: 0 }];
    E.openShop(s);
    E.serve(s, action);
    assert.equal(s.phase, 'record', `${kind}/${action}`);
    assert.ok(s.today.reaction.text.length > 3 && !s.today.reaction.text.includes('{due}'), s.today.reaction.text);
  }
});

test('family needs: pocket counts for you, business money against', () => {
  const pocket = E.newGame('business', mulberry32(9));
  const capital = E.newGame('business', mulberry32(9));
  pocket.stats.pocketPays = 3;
  capital.stats.capitalTakes = 3;
  assert.ok(E.scoreParts(pocket).money > 0.8);
  assert.ok(E.scoreParts(capital).money < 0.3);
});

test('daily pay moves to the pocket in the evening; family event records the money', () => {
  const s = E.newGame('business', mulberry32(10));
  s.today.queue = [{ cid: 'musa', items: [{ item: 'garri', qty: 2 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0 }];
  s.today.eventAt = 99;
  E.openShop(s);
  E.serve(s, 'sell');
  E.skipRecord(s);
  assert.equal(s.phase, 'evening');
  assert.equal(s.pocket, 1000);
  assert.equal(s.today.paidSelf, 1000);
  // A family need paid from the pocket is listed and doesn't touch business cash or profit.
  s.pocket = 5000;
  const cash = s.cash;
  const profit = s.today.profit;
  s.today.event = { id: 'family', ctx: { need: 0 }, outcome: null };
  E.chooseEvent(s, 0);
  assert.equal(s.pocket, 2000);
  assert.equal(s.cash, cash);
  assert.equal(s.today.profit, profit);
  assert.deepEqual(s.today.personal[0], { label: 'Sister: school fees', amount: 3000, from: 'pocket' });
  E.chooseEvent(s, 1); // already answered: ignored
  s.today.event = { id: 'family', ctx: { need: 1 }, outcome: null };
  E.chooseEvent(s, 1);
  assert.equal(s.cash, cash - 2500);
  assert.equal(s.today.personal[1].from, 'business');
});

test('old saves get daily pay fields', () => {
  const s = E.newGame('business', mulberry32(11));
  delete s.pay; delete s.pocket; delete s.stats.pocketPays; s.today.personal = false;
  E.migrate(s);
  assert.equal(s.pay, 1000);
  assert.equal(s.pocket, 0);
  assert.equal(s.stats.pocketPays, 0);
  assert.deepEqual(s.today.personal, []);
});

test('send for more: buys at normal price plus transport, customer stays', () => {
  const s = E.newGame('business', mulberry32(12));
  s.stock.rice = 0;
  s.today.queue = [{ cid: 'musa', items: [{ item: 'rice', qty: 2 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0 }];
  E.openShop(s);
  const v = E.currentCustomer(s);
  assert.deepEqual(v.rush.items, [{ item: 'rice', qty: 3 }]);
  assert.equal(v.rush.cost, 3 * 2000 + 300);
  const cash = s.cash;
  E.serve(s, 'restock');
  assert.equal(s.phase, 'selling');
  assert.equal(s.stock.rice, 3);
  assert.equal(s.cash, cash - 6300);
  assert.equal(s.today.profit, -300);
  assert.match(s.today.flash, /Musa waited/);
  E.serve(s, 'sell');
  assert.equal(s.phase, 'record');
  assert.equal(s.stock.rice, 1);
});

test('refusing the same item 3 times: warning, then word spreads', () => {
  const s = E.newGame('business', mulberry32(13));
  s.stock.water = 0;
  const ask = (cid) => ({ cid, items: [{ item: 'water', qty: 1 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0 });
  s.today.queue = [ask('iyatunde'), ask('mrokon'), ask('aisha'), ask('chidi')];
  s.today.eventAt = 99;
  E.openShop(s);
  E.serve(s, 'sell'); E.serve(s, 'next');
  E.serve(s, 'sell');
  assert.match(s.today.outcome.text, /2 customers asking for water/);
  E.serve(s, 'next');
  E.serve(s, 'sell');
  assert.match(s.today.outcome.text, /Word is spreading/);
  const away = Object.values(s.customers).filter((c) => c.skipUntil > s.day).length;
  assert.ok(away >= 2);
  E.serve(s, 'next');
  E.serve(s, 'sell'); E.serve(s, 'next');
  assert.equal(s.phase, 'evening');
  E.startDay(s, mulberry32(1));
  assert.ok(s.today.queue.length <= 6);
  assert.ok(s.today.notices.some((n) => /asked for water/.test(n)));
  assert.ok(s.today.notices.some((n) => /Word spread/.test(n)));
});

const ask = (cid, item, qty, kind = 'cash', moodRoll = 0) => ({ cid, items: [{ item, qty }], kind, frac: 0.5, disc: 0.1, walkRoll: 0.99, acceptRoll: 0.99, moodRoll });

test('raising a price during the day: buyers complain, bargainers leave', () => {
  const s = E.newGame('business', mulberry32(14));
  s.today.queue = [ask('musa', 'rice', 1), ask('aisha', 'rice', 1, 'discount'), ask('mrade', 'garri', 1)];
  s.today.eventAt = 99;
  E.openShop(s);
  E.setPrice(s, 'rice', 2600);
  E.serve(s, 'sell');
  assert.equal(s.phase, 'record');
  assert.match(s.today.reaction.text, /Rice was ₦2,500 this morning/);
  assert.equal(s.today.reaction.mood, 'sad');
  E.skipRecord(s);
  E.serve(s, 'sell');
  assert.match(s.today.outcome.text, /goes to another stall/);
  E.serve(s, 'next');
  E.serve(s, 'sell'); // garri price unchanged: no complaint
  assert.doesNotMatch(s.today.reaction.text, /this morning/);
  assert.equal(s.today.complaints.length, 2);
  assert.equal(s.stats.unhappy, 2);
  assert.ok(E.scoreParts(s).customers < 0.5);
});

test('lowering a price during the day is fine', () => {
  const s = E.newGame('business', mulberry32(15));
  s.today.queue = [ask('musa', 'rice', 1)];
  E.openShop(s);
  E.setPrice(s, 'rice', 2400);
  E.serve(s, 'sell');
  assert.equal(s.today.complaints.length, 0);
});

test('refusing credit: trusted customers count against you, non-payers are a good call', () => {
  const s = E.newGame('business', mulberry32(16));
  s.today.queue = [ask('mrade', 'rice', 1, 'credit'), ask('chidi', 'rice', 1, 'credit'), ask('iyatunde', 'rice', 1, 'credit')];
  s.today.eventAt = 99;
  E.openShop(s);
  E.serve(s, 'cashonly');
  assert.match(s.today.outcome.text, /You don't trust me/);
  assert.equal(s.stats.unhappy, 1);
  E.serve(s, 'next');
  E.serve(s, 'cashonly');
  assert.match(s.today.outcome.text, /Good call/);
  assert.equal(s.stats.unhappy, 1);
  E.serve(s, 'next');
  s.debts.push({ id: 50, cid: 'iyatunde', amount: 1000, due: 0, created: 0, recorded: true, remindedDay: 0, status: 'open', what: '1 rice' });
  E.serve(s, 'refuse');
  assert.match(s.today.outcome.text, /still owes you ₦1,000/);
  assert.equal(s.stats.unhappy, 1);
  assert.deepEqual(s.today.creditWalkouts, ['mrade']);
});

test('out of stock loses the sale', () => {
  const s = E.newGame('business', mulberry32(5));
  s.stock.rice = 0;
  s.today.queue = [{ cid: 'musa', items: [{ item: 'rice', qty: 1 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0 }];
  E.openShop(s);
  E.serve(s, 'sell');
  assert.equal(s.today.sales, 0);
  assert.deepEqual(s.today.stockouts, ['rice']);
});

test('every event can be shown and every choice runs', () => {
  for (const ev of EVENTS) {
    for (let i = 0; i < 4; i++) {
      const s = E.newGame('business', mulberry32(100 + i));
      s.level = ev.levels.at(-1);
      s.day = 10;
      s.levelStartDay = 1;
      Object.assign(s.stock, { rice: 12, garri: 10, water: 5, drinks: 5, bread: 4, palmoil: 12 });
      s.batches = [{ item: 'bread', qty: 4, exp: s.day + 1 }];
      s.cash = 60000;
      s.today.moneyIn = 5000;
      s.debts.push({ id: 99, cid: 'iyatunde', amount: 2000, due: 11, created: 9, recorded: i % 2 === 0, remindedDay: 0, status: 'open', what: '2 rice' });
      const ctx = ev.eligible(s);
      assert.ok(ctx, `${ev.id} should be eligible in test setup`);
      s.today.event = { id: ev.id, ctx, outcome: null };
      const choices = EVENT_BY_ID[ev.id].choices(s, ctx);
      const idx = i % choices.length;
      if (choices[idx].disabled) continue;
      E.chooseEvent(s, idx, mulberry32(i));
      assert.equal(typeof s.today.event.outcome, 'string', `${ev.id} choice ${idx}`);
      assert.ok(Number.isFinite(s.cash) && Object.values(s.stock).every((q) => q >= 0), ev.id);
    }
  }
});

test('a full day ends in the evening with stars and a tip', () => {
  const { s } = play(7, { record: 1, remind: true, credit: true, restock: true }, 1);
  assert.ok(s.history.length >= 1);
  const h = s.history[0];
  assert.ok(h.stars >= 0 && h.stars <= 3);
});

test('good habits beat bad habits', () => {
  const runs = (h) => Array.from({ length: 15 }, (_, i) => play(500 + i, h, 30));
  const good = runs({ record: 1, remind: true, credit: true, restock: true });
  const bad = runs({ record: 0, remind: false, credit: true, restock: true });
  assert.ok(good.filter((r) => r.l1Day).length >= 13, 'most good players finish Level 1 in 30 days');
  assert.equal(bad.filter((r) => r.l1Day).length, 0, 'players who never record cannot finish Level 1');
  const avg = (rs) => rs.reduce((a, r) => a + r.s.score, 0) / rs.length;
  assert.ok(avg(good) > avg(bad) + 20);
});

test('customer names in the data are all reachable', () => {
  for (const id of Object.keys(CUST)) assert.ok(CUST[id].name);
});
