import test from 'node:test';
import assert from 'node:assert/strict';
import { forSpeech, supported } from '../js/voice.js';

test('prices are spoken as naira, quotes and dots dropped', () => {
  assert.equal(forSpeech('“I\'ll pay ₦3,000 now.”'), 'I\'ll pay 3000 naira now.');
  assert.equal(forSpeech('"₦12,500? Too much!"'), '12500 naira? Too much!');
  assert.equal(forSpeech('I\'ll pay… soon.'), 'I\'ll pay,  soon.');
});

test('voice module loads outside a browser and does nothing', () => {
  assert.equal(supported, false);
});
