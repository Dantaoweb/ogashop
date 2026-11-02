// "Know your business": questions about the player's own shop, answered from their records,
// plus a few lesson questions. Never blocks moving up and never changes the score.
import { GOODS, LESSON_QUESTIONS } from './data.js';
import { CUST, fmt, goodsForLevel, openDebts, buyPrice } from './core.js';

const levelSales = (s, recordedOnly = false) =>
  s.sales.filter((x) => x.level === s.level && x.cid && (!recordedOnly || x.recorded));

function tally(list, key, weight = () => 1) {
  const m = new Map();
  for (const x of list) for (const k of [].concat(key(x))) m.set(k, (m.get(k) || 0) + weight(x, k));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const itemUnits = (list) => tally(list, (x) => x.items.map((it) => it.item), (x, k) => x.items.filter((it) => it.item === k).reduce((a, it) => a + it.qty, 0));
const customerVisits = (list) => tally(list, (x) => x.cid);

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Up to 4 options with the right one among them.
function options(correct, pool, rng) {
  const others = shuffle(pool.filter((p) => p !== correct), rng).slice(0, 3);
  const opts = shuffle([correct, ...others], rng);
  return { options: opts, answer: opts.indexOf(correct) };
}

function missingNote(s) {
  const n = levelSales(s).filter((x) => !x.recorded).length;
  return n ? ` ${n} sale${n > 1 ? 's were' : ' was'} not recorded, so ${n > 1 ? 'they are' : 'it is'} not here.` : '';
}

const top = (rows, label) => rows.slice(0, 4).map(([k, n]) => `${label(k)} ${n}`).join(', ');

const BUILDERS = {
  topItem(s, rng) {
    const real = itemUnits(levelSales(s));
    if (!real.length) return null;
    const rec = itemUnits(levelSales(s, true));
    const name = (id) => GOODS[id].name;
    const { options: opts, answer } = options(real[0][0], goodsForLevel(s.level), rng);
    return {
      text: `Which goods sold the most this level?`, options: opts.map(name), answer,
      explain: `${name(real[0][0])}: ${real[0][1]} sold.`,
      records: rec.length ? `Your records: ${top(rec, (id) => GOODS[id].short.toLowerCase())}.${missingNote(s)}` : `Your records are empty.${missingNote(s)}`,
    };
  },
  loyal(s, rng) {
    const real = customerVisits(levelSales(s));
    if (real.length < 2) return null;
    const rec = customerVisits(levelSales(s, true));
    const { options: opts, answer } = options(real[0][0], real.map(([c]) => c), rng);
    return {
      text: 'Who is your most loyal customer (bought from you most often)?', options: opts.map((c) => CUST[c].name), answer,
      explain: `${CUST[real[0][0]].name} bought from you ${real[0][1]} times.`,
      records: rec.length ? `Your records: ${top(rec, (c) => CUST[c].name)} times.${missingNote(s)}` : `Your records are empty.${missingNote(s)}`,
    };
  },
  owesMost(s, rng) {
    const byCustomer = tally(openDebts(s), (d) => d.cid, (d) => d.amount);
    const recorded = tally(openDebts(s, { recordedOnly: true }), (d) => d.cid, (d) => d.amount);
    const NOBODY = 'Nobody owes me';
    const correct = byCustomer.length ? CUST[byCustomer[0][0]].name : NOBODY;
    const pool = [...new Set([...byCustomer.map(([c]) => CUST[c].name), ...levelSales(s).map((x) => CUST[x.cid].name), NOBODY])];
    if (pool.length < 3) return null;
    const { options: opts, answer } = options(correct, pool, rng);
    return {
      text: 'Who owes you the most money right now?', options: opts, answer,
      explain: byCustomer.length ? `${correct} owes you ${fmt(byCustomer[0][1])}.` : 'Nobody owes you money right now.',
      records: recorded.length ? `Your records: ${recorded.slice(0, 4).map(([c, a]) => `${CUST[c].name} ${fmt(a)}`).join(', ')}.${byCustomer.length > recorded.length ? ' Some credit was never recorded, so it is not here.' : ''}` : `Your records show nobody owing you.${byCustomer.length ? ' But some credit was never recorded.' : ''}`,
    };
  },
  bestMargin(s, rng) {
    const goods = goodsForLevel(s.level);
    const margin = (id) => s.prices[id] - buyPrice(s, id);
    const best = [...goods].sort((a, b) => margin(b) - margin(a))[0];
    const { options: opts, answer } = options(best, goods, rng);
    return {
      text: 'Which item gives you the most profit on each one you sell?', options: opts.map((id) => GOODS[id].name), answer,
      explain: `${GOODS[best].name}: you buy at ${fmt(buyPrice(s, best))} and sell at ${fmt(s.prices[best])}, so ${fmt(margin(best))} each.`,
      records: `Your prices: ${goods.map((id) => `${GOODS[id].short.toLowerCase()} ${fmt(margin(id))} each`).join(', ')}.`,
    };
  },
  bestDay(s, rng) {
    const days = s.history.filter((h) => h.level === s.level);
    if (days.length < 3) return null;
    const best = [...days].sort((a, b) => b.profit - a.profit)[0];
    const label = (h) => `Day ${h.day}`;
    const { options: opts, answer } = options(best, days, rng);
    return {
      text: 'Which was your best day for profit this level?', options: opts.map(label), answer,
      explain: `Day ${best.day}: ${fmt(best.profit)} profit.`,
      records: `Your days: ${days.slice(-6).map((h) => `Day ${h.day} ${fmt(h.profit)}`).join(', ')}.`,
    };
  },
};

function lesson(q, rng) {
  const { options: opts, answer } = options(q.options[0], q.options, rng);
  return { text: q.text, options: opts, answer, explain: q.explain, records: null };
}

// kind: 'level' (end of level: 4 about your shop + 2 lessons) or 'quick' (one evening question).
export function makeQuiz(s, kind, rng = Math.random) {
  const ids = kind === 'quick'
    ? shuffle(['topItem', 'loyal', 'owesMost'], rng)
    : ['topItem', 'loyal', 'owesMost', 'bestMargin', 'bestDay'];
  const shop = ids.map((id) => BUILDERS[id](s, rng)).filter(Boolean).slice(0, kind === 'quick' ? 1 : 4);
  const lessons = kind === 'quick' ? [] : shuffle(LESSON_QUESTIONS, rng).slice(0, 2).map((q) => lesson(q, rng));
  const questions = [...shop, ...lessons].map((q) => ({ ...q, picked: null }));
  if (!questions.length) return null;
  return { kind, level: s.level, questions, index: 0, done: false };
}

export function answer(quiz, i) {
  const q = quiz?.questions[quiz.index];
  if (!q || q.picked != null || !(i >= 0 && i < q.options.length)) return;
  q.picked = i;
}

export function next(quiz) {
  if (!quiz) return;
  if (quiz.index < quiz.questions.length - 1) quiz.index++;
  else quiz.done = true;
}

export function result(quiz) {
  const correct = quiz.questions.filter((q) => q.picked === q.answer).length;
  return { correct, total: quiz.questions.length };
}

// Save the result on the phone; a good end-of-level result earns the badge.
export function finish(s, quiz) {
  const r = result(quiz);
  s.quizLog.push({ day: s.day, level: quiz.level, kind: quiz.kind, ...r });
  if (quiz.kind === 'level' && r.correct / r.total >= 0.8 && !s.badges.includes('know_business')) s.badges.push('know_business');
  return r;
}
