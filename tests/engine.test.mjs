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

test('bills: announced 3 days ahead, paid on the day, late fees if not', () => {
  const s = E.newGame('business', mulberry32(20));
  while (s.day < 2) { s.phase = 'evening'; E.startDay(s, mulberry32(s.day)); }
  assert.equal(s.bills.length, 1);
  assert.equal(s.bills[0].due, 5);
  assert.ok(s.today.notices.some((n) => /stall fee of ₦3,000, due on Day 5/.test(n)));
  assert.equal(E.cashNeededSoon(s), 3000);
  while (s.day < 5) E.startDay(s, mulberry32(s.day));
  s.cash = 1000;
  s.today.queue = []; E.openShop(s);
  assert.equal(s.phase, 'evening');
  assert.equal(s.bills.length, 1, 'not enough cash: still owed');
  E.startDay(s, mulberry32(6));
  assert.equal(E.billOwed(s.bills[0]), 3500);
  assert.equal(s.stats.billsLateDays, 1);
  s.cash = 5000;
  assert.equal(E.payBill(s, s.bills[0].id), null);
  assert.equal(s.cash, 1500);
  assert.equal(s.bills.length, 0);
  assert.ok(s.today.expenses.some((e) => /stall fee \(late\)/.test(e.label)));
});

test('stuck with no stock and no cash: pocket top-up, then restart', () => {
  const s = E.newGame('business', mulberry32(21));
  for (const id of Object.keys(s.stock)) s.stock[id] = 0;
  s.cash = 100;
  s.pocket = 1000;
  assert.equal(E.isStuck(s), false);
  E.topUp(s);
  assert.equal(s.cash, 1100);
  assert.equal(s.pocket, 0);
  s.cash = 100;
  assert.equal(E.isStuck(s), true);
  E.restartLevel(s, mulberry32(1));
  assert.equal(s.cash, 20000);
  assert.equal(s.stock.rice, 5);
  assert.equal(s.phase, 'morning');
});

test('savings goal: progress, how long, reached in the evening', async () => {
  const G = await import('../js/goals.js');
  const s = E.newGame('business', mulberry32(30));
  assert.match(G.setGoal(s, '', 5000), /name/);
  assert.equal(G.setGoal(s, 'Smartphone', 90000), null);
  s.pocket = 30000;
  s.pay = 1500;
  const g = G.goalStatus(s);
  assert.equal(g.pct, 33);
  assert.equal(g.days, 40);
  assert.match(g.when, /40 days/);
  G.setGoal(s, 'House', 35000000);
  assert.match(G.goalStatus(s).when, /about 64 years.*Grow the business/);
  s.pay = 0;
  assert.match(G.goalStatus(s).when, /never comes/);
  G.setGoal(s, 'School fees for one term', 40000);
  s.pay = 1000;
  s.pocket = 39500;
  s.today.queue = []; s.today.eventAt = 99;
  E.openShop(s);
  assert.equal(s.phase, 'evening');
  assert.equal(s.today.goalReached.name, 'School fees for one term');
  assert.equal(s.pocket, 500);
  assert.equal(s.goal, null);
  assert.ok(s.badges.includes('goal_reached'));
  assert.match(G.delayNote({ goal: { name: 'Car' }, pay: 1000 }, 2500), /3 days further away/);
});

test('market run: catch everything = no transport fee; not enough = customer leaves', () => {
  const setup = () => {
    const s = E.newGame('business', mulberry32(50));
    s.stock.rice = 0;
    s.today.queue = [{ cid: 'musa', items: [{ item: 'rice', qty: 2 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0, moodRoll: 0.99, changeRoll: 1 }];
    s.today.eventAt = 99;
    E.openShop(s);
    E.startRun(s);
    assert.equal(s.phase, 'run');
    return s;
  };
  const win = setup();
  const cash = win.cash;
  E.runDone(win, { rice: 3 });
  assert.equal(win.phase, 'selling');
  assert.equal(win.stock.rice, 3);
  assert.equal(win.cash, cash - 6000);
  assert.equal(win.today.profit, 0, 'no transport fee');
  assert.match(win.today.flash, /No transport fee/);
  const lose = setup();
  E.runDone(lose, { rice: 1 });
  assert.equal(lose.stock.rice, 1);
  assert.match(lose.today.outcome.text, /got tired of waiting/);
  assert.equal(lose.stats.unhappy, 1);
  const boy = setup();
  E.runSendBoy(boy);
  assert.equal(boy.stock.rice, 3);
  assert.equal(boy.today.profit, -300);
});

test('quiz: questions from the real sales; records leave out unrecorded sales', async () => {
  const Q = await import('../js/quiz.js');
  const s = E.newGame('business', mulberry32(60));
  const sell = (cid, item, qty, recorded) => s.sales.push({ day: 1, level: 1, cid, items: [{ item, qty, price: 500 }], total: qty * 500, paid: qty * 500, recorded });
  sell('mamabola', 'rice', 3, true); sell('mamabola', 'garri', 1, true); sell('musa', 'rice', 2, false); sell('ngozi', 'water', 1, true);
  s.history = [{ day: 1, level: 1, profit: 500 }, { day: 2, level: 1, profit: 2000 }, { day: 3, level: 1, profit: 900 }];
  const quiz = Q.makeQuiz(s, 'level', mulberry32(1));
  assert.equal(quiz.questions.length, 6);
  const top = quiz.questions[0];
  assert.equal(top.options[top.answer], 'Rice');
  assert.match(top.records, /rice 3/);
  assert.match(top.records, /1 sale was not recorded/);
  const loyal = quiz.questions[1];
  assert.equal(loyal.options[loyal.answer], 'Mama Bola');
  for (const q of quiz.questions) { Q.answer(quiz, q.answer); Q.next(quiz); }
  assert.ok(quiz.done);
  assert.deepEqual(Q.finish(s, quiz), { correct: 6, total: 6 });
  assert.ok(s.badges.includes('know_business'));
  assert.equal(s.quizLog.length, 1);
});

test('recording a sale marks it in the sales log', () => {
  const s = E.newGame('business', mulberry32(61));
  s.today.queue = [{ cid: 'musa', items: [{ item: 'garri', qty: 2 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0, moodRoll: 0.99, changeRoll: 1 }];
  E.openShop(s);
  E.serve(s, 'sell');
  assert.equal(s.sales.length, 1);
  assert.equal(s.sales[0].recorded, false);
  E.titiMessage(s, 'sold 2 garri 1100 cash');
  assert.equal(s.sales[0].recorded, true);
});

test('spot the fake note: only in Level 2; spotted, missed, wrong accusation', () => {
  const setup = (level = 2) => {
    const s = E.newGame('business', mulberry32(70));
    s.level = level;
    s.today.queue = [{ cid: 'musa', items: [{ item: 'rice', qty: 1 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0, moodRoll: 0.99, changeRoll: 1, fakeRoll: 0 }];
    s.today.eventAt = 99;
    E.openShop(s);
    E.serve(s, 'sell');
    return s;
  };
  assert.equal(setup(1).phase, 'record', 'not in Level 1');
  const s = setup();
  assert.equal(s.phase, 'fake');
  const withFake = (st) => { st.today.fake = { cid: 'musa', total: 2500, notes: [{ value: 1000, fake: false }, { value: 1000, fake: true, flaw: 'print' }, { value: 500, fake: false }], fakeIdx: 1, light: false }; };
  withFake(s);
  E.fakeLight(s);
  assert.equal(s.today.fake.light, true);
  E.fakeDone(s, 1);
  assert.equal(s.phase, 'record');
  assert.equal(s.stats.goodChecks, 1);
  assert.match(s.today.reaction.note, /spotted the fake/);
  const missed = setup(); withFake(missed);
  const profit = missed.today.profit;
  E.fakeDone(missed, -1);
  assert.equal(missed.today.profit, profit - 1000);
  assert.ok(missed.today.expenses.some((e) => e.label === 'Fake note taken'));
  const accused = setup(); withFake(accused);
  E.fakeDone(accused, 0);
  assert.equal(accused.stats.unhappy, 1);
  assert.match(accused.today.reaction.text, /thief/);
  const allReal = setup(); allReal.today.fake = { cid: 'musa', total: 2500, notes: [{ value: 1000, fake: false }, { value: 1000, fake: false }, { value: 500, fake: false }], fakeIdx: -1, light: false };
  E.fakeDone(allReal, -1);
  assert.equal(allReal.stats.goodChecks, 1);
  // not again the next day
  const again = setup();
  E.fakeDone(again, 'skip'); E.skipRecord(again);
  assert.equal(again.lastFakeDay, again.day);
  const notes = E.makeNotes(3000, mulberry32(3));
  assert.equal(notes.notes.length, 4);
});

test('transfer and POS: CreditVoice records automatically, another bank does not', () => {
  const play = (method, provider) => {
    const s = E.newGame('business', mulberry32(80));
    if (provider !== 'creditvoice') E.setPayments(s, method === 'transfer' ? { account: provider } : { pos: provider });
    const payRoll = method === 'transfer' ? 0.7 : 0.99;
    s.today.queue = [{ cid: 'musa', items: [{ item: 'rice', qty: 1 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0, moodRoll: 0.99, changeRoll: 1, fakeRoll: 1, payRoll }];
    s.today.eventAt = 99;
    E.openShop(s);
    assert.equal(E.currentCustomer(s).method, method);
    E.serve(s, 'sell');
    assert.equal(s.phase, 'pay');
    while (s.phase === 'pay') E.payNext(s);
    assert.equal(s.phase, 'record');
    return s;
  };
  const cvT = play('transfer', 'creditvoice');
  assert.equal(cvT.today.pending.recorded, true);
  assert.match(cvT.today.chat.at(-1).auto, /CreditVoice recorded this transfer/);
  const other = play('transfer', 'otherbank');
  assert.equal(other.today.pending.recorded, false);
  assert.equal(other.today.pending.method, 'transfer');
  const cvPos = play('pos', 'creditvoice');
  assert.equal(cvPos.today.pending.recorded, true);
  const otherPos = play('pos', 'otherpos');
  assert.equal(otherPos.today.pending.recorded, false);
  const s = E.newGame('business', mulberry32(81));
  assert.match(E.setPayments(s, { accountNumber: '123' }), /10 digits/);
  assert.equal(E.setPayments(s, { accountNumber: '0123456789' }), null);
  assert.equal(s.payments.accountNumber, '0123456789');
});

test('broken leg in Market run: hospital ride, pocket first, debt if short, no running while healing', () => {
  const s = E.newGame('business', mulberry32(90));
  s.stock.rice = 0;
  s.pocket = 4000;
  s.cash = 5000;
  const q = () => ({ cid: 'musa', items: [{ item: 'rice', qty: 1 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0, moodRoll: 0.99, changeRoll: 1, fakeRoll: 1, payRoll: 0 });
  s.today.queue = [q(), q()];
  s.today.eventAt = 99;
  E.openShop(s);
  s.cash = 10000;
  E.startRun(s);
  s.cash = 5000;
  E.runDone(s, { rice: 0 }, { injured: true });
  assert.equal(s.phase, 'injury');
  const sp = E.hospitalSplit(s, 'taxi');
  assert.deepEqual([sp.total, sp.pocket, sp.business, sp.debt], [16000, 4000, 5000, 7000]);
  E.chooseHospital(s, 'taxi');
  assert.equal(s.phase, 'selling');
  assert.equal(s.pocket, 0);
  assert.equal(s.cash, 0);
  assert.equal(s.bills.at(-1).label, 'Hospital debt');
  assert.equal(s.bills.at(-1).amount, 7000);
  assert.match(s.today.outcome.text, /heals in 3 days/);
  assert.equal(E.isInjured(s), true);
  E.serve(s, 'next');
  s.cash = 50000;
  E.startRun(s);
  assert.equal(s.phase, 'selling', 'cannot run while injured');
  s.day += 3;
  assert.equal(E.isInjured(s), false);
});

test('count the change: right, short, too much, skip', () => {
  const play = (taps, result = 'give') => {
    const s = E.newGame('business', mulberry32(40));
    s.today.queue = [{ cid: 'musa', items: [{ item: 'garri', qty: 3 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0, moodRoll: 0.99, changeRoll: 0 }];
    s.today.eventAt = 99;
    E.openShop(s);
    E.serve(s, 'sell');
    assert.equal(s.phase, 'change');
    assert.deepEqual([s.today.change.handed, s.today.change.due], [2000, 350]);
    for (const n of taps) E.changeTap(s, n);
    E.changeDone(s, result);
    assert.equal(s.phase, 'record');
    return s;
  };
  const right = play([200, 100, 50]);
  assert.equal(right.stats.changeRight, 1);
  assert.match(right.today.reaction.text, /Correct change/);
  const short = play([200, 100]);
  assert.equal(short.stats.unhappy, 1);
  assert.match(short.today.reaction.text, /short-changed/);
  const much = play([500]);
  assert.equal(much.today.profit, 1650 - 3 * 400 - 150);
  const skip = play([], 'skip');
  assert.equal(skip.stats.unhappy + skip.stats.changeRight, 0);
  // only once a day
  const s = E.newGame('business', mulberry32(41));
  const q = () => ({ cid: 'musa', items: [{ item: 'garri', qty: 3 }], kind: 'cash', frac: 1, disc: 0.1, walkRoll: 0.99, acceptRoll: 0, moodRoll: 0.99, changeRoll: 0 });
  s.today.queue = [q(), q()]; s.today.eventAt = 99;
  E.openShop(s);
  E.serve(s, 'sell'); E.changeDone(s, 'skip'); E.skipRecord(s);
  E.serve(s, 'sell');
  assert.equal(s.phase, 'record');
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
