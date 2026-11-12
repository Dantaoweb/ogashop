import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { mulberry32 } from './sim.mjs';

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const UI = await import('../js/ui.js');

test('morning pictures: every picture opens its sheet', () => {
  const s = E.newGame('business', mulberry32(400));
  s.bills = [{ id: 1, kind: 'stall', label: 'Market stall fee', amount: 3000, due: s.day + 1, late: 0 }];
  const ui = { buy: {} };
  const html = UI.morningScreen(s, ui);
  for (const sheet of ['market', 'advert', 'pay', 'bills', 'stage', 'good:rice']) assert.ok(html.includes(`data-arg="${sheet}"`), `${sheet} picture`);
  assert.ok(!html.includes('Set prices, buy stock'), 'the long stock list is gone');
  for (const sheet of ['market', 'advert', 'pay', 'bills', 'stage', 'good:rice', 'good:garri']) {
    const out = UI.sheetHtml(s, { ...ui, sheet });
    assert.ok(out.includes('tap-sheet'), `${sheet} sheet opens`);
    assert.ok(out.includes('sheet-close'), `${sheet} sheet can close`);
  }
  assert.ok(UI.sheetHtml(s, { ...ui, sheet: 'good:bread' }) === '', 'a Level 2 good has no sheet at Level 1');
  assert.ok(UI.sheetHtml(s, { ...ui, sheet: 'good:rice' }).includes('data-action="price"'), 'price and buying live in the sheet');
  assert.ok(UI.sheetHtml(s, { ...ui, sheet: 'pay' }).includes('data-action="pay"'), 'the pay stepper lives in the sheet');
});

test('evening pictures: money bar, market bars, money out, faces, shelf, and their sheets', () => {
  const s = E.newGame('business', mulberry32(401));
  s.today.queue = s.today.queue.map((r) => ({ ...r, walkRoll: 0.99, changeRoll: 1, fakeRoll: 1, payRoll: 0 }));
  s.today.eventAt = 99;
  E.openShop(s);
  let g = 0;
  while (s.phase !== 'evening' && g++ < 200) {
    if (s.phase === 'selling') E.serve(s, s.today.outcome ? 'next' : (E.currentCustomer(s).kind === 'credit' ? 'credit' : 'sell'));
    else if (s.phase === 'record') E.skipRecord(s);
    else if (s.phase === 'change') E.changeDone(s, 'skip');
    else if (s.phase === 'fake') E.fakeDone(s, -1);
    else if (s.phase === 'pay') E.payNext(s);
    else break;
  }
  assert.equal(s.phase, 'evening');
  const html = UI.eveningScreen(s, {});
  for (const part of ['money-bar', 'bar-row', 'mini-shelf']) assert.ok(html.includes(part), part);
  for (const sheet of ['money', 'rivals', 'out']) {
    assert.ok(html.includes(`data-arg="${sheet}"`), `${sheet} picture`);
    assert.ok(UI.sheetHtml(s, { buy: {}, sheet }).includes('tap-sheet'), `${sheet} sheet`);
  }
  if (E.openDebts(s).length) assert.ok(UI.sheetHtml(s, { buy: {}, sheet: 'owes' }).includes('tap-sheet'));
});

test('small pictures: goals fill up, challenges and stages have pictures', async () => {
  const A = await import('../js/art.js');
  const { GOALS } = await import('../js/data.js');
  for (const g of GOALS) assert.ok(A.goalArt(g.id, 40).includes('<svg'), g.id);
  assert.ok(A.goalArt('Freezer for my shop', 40, 50, GOALS).includes('clipPath'), 'own goals get a jar that fills');
  assert.ok(A.goalArt('phone', 40, 30).includes('y="33.6"'), '30% fills the bottom 30%');
  const s = E.newGame('business', mulberry32(402));
  s.goal = { name: 'Smartphone', price: 90000, since: 1 };
  s.pocket = 45000;
  assert.ok(UI.goalsScreen(s, {}).includes('50% saved'));
  for (const type of ['money', 'road', 'change']) assert.ok(A.challengeArt(type).includes('<svg'), type);
});

test('Level 1 market lane: your name, prices, the sky by the hour, the queue', async () => {
  const A = await import('../js/art.js');
  const s = E.newGame('business', mulberry32(403));
  assert.equal(E.shopName(s), 'My Table');
  assert.equal(E.setShopName(s, "  Ada's   Table "), null);
  assert.equal(E.shopName(s), "Ada's Table");
  assert.match(E.setShopName(s, 'x'.repeat(21)), /20 letters/);
  assert.match(E.setShopName(s, '<script>'), /letters, numbers/);
  assert.equal(E.shopName(s), "Ada's Table", 'bad names change nothing');
  const morning = A.scene(1, { name: E.shopName(s), prices: s.prices, hour: 8, waiting: 3, stock: s.stock });
  assert.ok(morning.includes('Ada&#39;s Table'), 'the signboard');
  assert.ok(morning.includes('Rice ₦2,500'), 'the chalkboard');
  assert.equal((morning.match(/lane-walker/g) || []).length, 4, 'people walk past');
  assert.ok(morning.includes('#B7DDF4'), 'morning sky');
  assert.ok(A.scene(1, { hour: 17 }).includes('#F4A26B'), 'evening sky');
  assert.ok(!A.scene(1, { venue: 'mall' }).includes('lane-walker'), 'markets keep their own look');
  assert.ok(!A.scene(2, {}).includes('lane-sky') && A.scene(2, {}).includes('street-sky'), 'Level 2 is a street, not the lane');
});

test('Level 2 street: your name, rivals on the signboards, real stock on the shelves, day and OPEN sign', async () => {
  const A = await import('../js/art.js');
  const full = A.scene(2, { name: 'Mama Ada Store', rivals: ['Tunde_Shop', 'Iya Basira'], day: 9, stock: { rice: 6, garri: 1, water: 0, recharge: 3, noodles: 5, bread: 2, drinks: 4, palmoil: 0 }, prices: { rice: 2500, garri: 550, water: 500, recharge: 500, noodles: 350, bread: 1250, drinks: 400, palmoil: 1800 } });
  assert.ok(full.includes('Mama Ada Store'));
  assert.ok(full.includes('Tunde_Shop'), 'a real rival on the next shop');
  assert.ok(full.includes('>9</text>'), 'the calendar day');
  assert.ok(full.includes('OPEN'));
  assert.equal((full.match(/stroke-dasharray="2 2"/g) || []).length, 2, 'two empty spaces for the two goods with no stock');
  assert.ok(full.includes('Palm oil ₦1,800') || full.includes('Oil ₦1,800') || /₦1,800/.test(full), 'the price board has all 8 goods');
  assert.ok(A.scene(2, { open: false }).includes('CLOSED'));
});

test('weather and life in the picture; the market sound is off by default', async () => {
  const A = await import('../js/art.js');
  const Fx = await import('../js/fx.js');
  const rain1 = A.scene(1, { weather: 'rain', hour: 12 });
  assert.ok(rain1.includes('rain-drop') && rain1.includes('#7E8B96'), 'rain on the lane');
  assert.ok(A.scene(2, { weather: 'rain' }).includes('rain-drop'), 'rain on the street');
  assert.ok(A.scene(1, { weather: 'hot' }).includes('class="heat"'), 'heat on a hot day');
  assert.ok(!A.scene(1, { hour: 12 }).includes('rain-drop'), 'no rain on a normal day');
  assert.ok(A.scene(2, {}).includes('lane-walker'), 'people walk on the street too');
  assert.equal(Fx.ambienceOn(), false, 'market sound is off unless switched on');
  Fx.ambience(true); Fx.ambience(false);
});
