import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/analytics.js';
import { normalize, summarize, statsPage } from '../worker/logic.mjs';

function setup({ url = 'https://x.test/e', ok = true, now = () => 1000 } = {}) {
  const data = {};
  const sent = [];
  A.configure({
    url, now,
    storage: { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } },
    post: async (_, body) => { sent.push(JSON.parse(body)); return ok; },
  });
  return { sent, data };
}

test('before answering and on "no": totals only, no code, no details', async () => {
  const { sent } = setup();
  assert.equal(A.choice(), null);
  A.track('day_done', { k: 'x', v: 3, level: 1, day: 2, score: 60 });
  await A.flush();
  assert.deepEqual(sent[0], [{ e: 'day_done', k: 'x', v: 3 }]);
  A.setChoice('no');
  A.track('quiz', { k: 'level', v: 80, level: 1 });
  await A.flush();
  assert.deepEqual(sent[1], [{ e: 'quiz', k: 'level', v: 80 }]);
});

test('"yes" adds a random code and details; changing to "no" removes them', async () => {
  const { sent } = setup();
  A.setChoice('yes');
  A.track('day_done', { level: 1, day: 2, score: 60 });
  await A.flush();
  assert.match(sent[0][0].pid, /^[a-z0-9]{16}$/);
  assert.equal(sent[0][0].score, 60);
  A.track('day_done', { level: 1, day: 3, score: 62 });
  A.setChoice('no');
  await A.flush();
  assert.deepEqual(sent[1], [{ e: 'day_done' }]);
});

test('"off" sends nothing and clears what was waiting', async () => {
  const { sent } = setup();
  A.track('visit', { k: 'new' });
  A.setChoice('off');
  A.track('visit', { k: 'same_day' });
  assert.equal(await A.flush(), false);
  assert.equal(sent.length, 0);
});

test('once-only events, returning visits, and counts wait when offline', async () => {
  let time = 1000;
  const { sent } = setup({ now: () => time, ok: false });
  A.startVisit();
  time += 86400000 * 3;
  A.startVisit();
  A.startVisit();
  A.track('level_start', { k: '1', once: 'ls1' });
  A.track('level_start', { k: '1', once: 'ls1' });
  assert.equal(await A.flush(), false, 'server down');
  const batch = sent[0].map((x) => `${x.e}:${x.k}`);
  assert.deepEqual(batch, ['visit:new', 'visit:week', 'returned:week', 'visit:week', 'level_start:1']);
  A.configure({ post: async (_, body) => { sent.push(JSON.parse(body)); return true; } });
});

test('no address set: nothing is queued or sent', async () => {
  const { sent, data } = setup({ url: '' });
  A.startVisit();
  A.track('visit');
  assert.equal(await A.flush(), false);
  assert.equal(sent.length, 0);
  assert.equal(Object.keys(data).length, 0);
});

test('the server keeps only known events and fields', () => {
  const out = normalize([
    { e: 'visit', k: 'new', name: 'Mama Bola', phone: '0801' },
    { e: 'hack', k: 'x' },
    { e: 'quiz', k: 'BAD KEY!', v: 70, pid: 'short' },
    { e: 'day_done', pid: 'abcdefghijklmnop', level: 2, day: 9, score: 500 },
  ]);
  assert.deepEqual(out[0], { e: 'visit', k: 'new', v: 0 });
  assert.equal(out.length, 3);
  assert.deepEqual(out[1], { e: 'quiz', k: '', v: 70 });
  assert.deepEqual(out[2], { e: 'day_done', k: '', v: 0, pid: 'abcdefghijklmnop', level: 2, day: 9, score: null });
  assert.deepEqual(normalize('nope'), []);
});

test('the results page works out the PRD measures', () => {
  const s = summarize([
    { event: 'visit', key: 'new', n: 100, sum: 0 },
    { event: 'visit', key: 'week', n: 50, sum: 0 },
    { event: 'returned', key: 'week', n: 35, sum: 0 },
    { event: 'level_start', key: '1', n: 80, sum: 0 },
    { event: 'level_done', key: '1', n: 40, sum: 0 },
    { event: 'quiz', key: 'level', n: 10, sum: 750 },
    { event: 'cv_click', key: '', n: 12, sum: 0 },
    { event: 'load', key: '', n: 4, sum: 16000 },
  ]);
  assert.equal(s.visitors, 100);
  assert.equal(s.visits, 150);
  assert.deepEqual(s.measures.map((m) => m.value), [50, 35, 75, 12, 4]);
  const html = statsPage(s);
  assert.match(html, /Below target/);
  assert.match(html, /On target/);
  assert.match(statsPage(summarize([])), /No data yet/);
});
