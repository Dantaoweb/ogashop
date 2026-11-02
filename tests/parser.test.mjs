import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSale, checkSale, suggestMessage, detectQuery, nameMatches } from '../js/parser.js';

const sale = (items, total, paid, discount = 0) => ({ items, listTotal: total + discount, discount, total, paid });
const core = ({ items, name, total, paid }) => ({ items, name, total, paid });

test('reads the PRD example', () => {
  const p = parseSale('sold 2 rice to Mama Bola 5000, paid 3000');
  assert.deepEqual(core(p), { items: { rice: 2 }, name: 'mama bola', total: 5000, paid: 3000 });
});

test('cash sale without a name', () => {
  assert.deepEqual(core(parseSale('sold 3 garri 1650 cash')), { items: { garri: 3 }, name: null, total: 1650, paid: 1650 });
});

test('naira signs, commas and k', () => {
  assert.deepEqual(core(parseSale('Sold 2 rice to Mama Bola ₦5,000 paid ₦3k')), { items: { rice: 2 }, name: 'mama bola', total: 5000, paid: 3000 });
});

test('several items and unit words', () => {
  const p = parseSale('sold 5 buckets of rice and 4 bags of pure water to Pastor Femi 14500');
  assert.deepEqual(p.items, { rice: 5, water: 4 });
  assert.equal(p.name, 'pastor femi');
  assert.equal(p.total, 14500);
  assert.equal(p.paid, 14500);
});

test('owes instead of paid', () => {
  const p = parseSale('sold 2 rice to Iya Tunde 5000 owes 2000');
  assert.equal(p.paid, 3000);
});

test('full credit', () => {
  const p = parseSale('sold 1 rice to Chidi 2500 on credit');
  assert.equal(p.paid, 0);
  assert.equal(p.name, 'chidi');
});

test('errors', () => {
  assert.equal(parseSale('hello tiTi').error, 'nosold');
  assert.equal(parseSale('sold something').error, 'noitems');
  assert.equal(parseSale('sold 2 rice').error, 'nototal');
});

test('checkSale accepts a correct message and catches mistakes', () => {
  const real = sale([{ item: 'rice', qty: 2, price: 2500 }], 5000, 3000);
  assert.deepEqual(checkSale(parseSale('sold 2 rice to Bola 5000 paid 3000'), real, 'Mama Bola'), []);
  assert.equal(checkSale(parseSale('sold 3 rice to Mama Bola 7500 paid 3000'), real, 'Mama Bola').length, 2);
  assert.match(checkSale(parseSale('sold 2 rice 5000 paid 3000'), real, 'Mama Bola')[0], /name/);
  assert.match(checkSale(parseSale('sold 2 rice to Musa 5000 paid 3000'), real, 'Mama Bola')[0], /Mama Bola/);
});

test('suggested message always passes its own check', () => {
  const cases = [
    [sale([{ item: 'rice', qty: 2, price: 2500 }], 5000, 3000), 'Mama Bola'],
    [sale([{ item: 'water', qty: 3, price: 500 }], 1500, 1500), 'Musa'],
    [sale([{ item: 'recharge', qty: 2, price: 500 }, { item: 'palmoil', qty: 1, price: 1700 }], 2700, 2700), 'Mr Ade'],
    [sale([{ item: 'drinks', qty: 3, price: 400 }], 1200, 0), 'Chidi'],
    [sale([{ item: 'bread', qty: 2, price: 1200 }], 2400, 1200), 'Iya Tunde'],
    [sale([{ item: 'noodles', qty: 4, price: 320 }], 1280, 1280), null],
  ];
  for (const [s, name] of cases) {
    const msg = suggestMessage(s, name);
    assert.deepEqual(checkSale(parseSale(msg), s, name), [], msg);
  }
});

test('discounts: written out, or just the price after discount', () => {
  const real = sale([{ item: 'rice', qty: 2, price: 2500 }], 4500, 4500, 500);
  for (const msg of [
    'sold 2 rice to Aisha 5000, discount 500, paid 4500',
    'sold 2 rice to Aisha 5000 discount 500',
    'sold 2 rice to Aisha 5000 less 500',
    'sold 2 rice to Aisha 5000, 500 off',
    'sold 2 rice to Aisha 4500 cash',
    'sold 2 rice to Aisha 4500, discount 500',
  ]) assert.deepEqual(checkSale(parseSale(msg), real, 'Aisha'), [], msg);
  assert.match(checkSale(parseSale('sold 2 rice to Aisha 5000 discount 300'), real, 'Aisha')[0], /discount was 500/);
  assert.match(checkSale(parseSale('sold 2 rice to Aisha 5000 cash'), real, 'Aisha')[0], /after discount was 4500/);
  const noDisc = sale([{ item: 'rice', qty: 2, price: 2500 }], 5000, 5000);
  assert.match(checkSale(parseSale('sold 2 rice 5000 discount 500'), noDisc, 'Musa')[0], /no discount/);
  assert.equal(suggestMessage(real, 'Aisha'), 'sold 2 rice to Aisha 5000, discount 500, paid 4500');
});

test('questions to tiTi', () => {
  assert.equal(detectQuery('who owes me?'), 'owes');
  assert.equal(detectQuery("what's my profit today?"), 'profit');
  assert.equal(detectQuery('sold 2 rice 5000'), null);
});

test('name matching ignores titles', () => {
  assert.ok(nameMatches('bola', 'Mama Bola'));
  assert.ok(nameMatches('mama bola', 'Mama Bola'));
  assert.ok(!nameMatches('mama', 'Mama Bola'));
});
