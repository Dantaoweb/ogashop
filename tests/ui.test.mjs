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
