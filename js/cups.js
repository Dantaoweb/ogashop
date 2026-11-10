// Championships on the phone: the ones you registered for, your numbers since the start, and game results waiting
// to be sent. The server (worker/cups.mjs) keeps the tables, starts them and decides the points.
import { fmt } from './core.js';
import { GOALS } from './data.js';

export const CUP_NAMES = ['Market Cup', 'Naira Masters', 'Oga Shop League', 'Traders Trophy', 'Golden Till Cup', 'Big Market Challenge', 'Friday Cup', 'Family Cup', 'Class Cup', 'Friends Cup'];
export const CUP_KINDS = { real: [3, 7, 14], game: [5, 7, 14] };
export const CUP_MAX_SIZE = 20;
export const CUP_MIN_START = 2;
export const CUP_MIN_DAYS = 3;
export const CUP_MIN_QUIZ = 3;
export const CUP_BACKSTOP_DAYS = 14;
export const PLAYABLE_LEVEL = 2; // levels above this are coming soon

const pct = (v) => `${Math.round(v * 100)}%`;
const secs = (ms) => `${Math.round(ms / 1000)}s`;

export const EVENT_INFO = {
  score: { group: 'Business', label: 'Business score', about: 'Your business score (good habits).', show: (v) => String(v) },
  profit: { group: 'Business', label: 'Profit per day', about: 'Average profit for each day played.', show: (v) => fmt(v) },
  recording: { group: 'Business', label: 'Sales recorded', about: 'How many of your sales you recorded.', show: pct },
  debts: { group: 'Business', label: 'Debts paid on time', about: 'Money owed to you that came back on time.', show: pct },
  stocked: { group: 'Business', label: 'Days fully stocked', about: 'Days nothing ran out.', show: pct },
  money: { group: 'Games', label: 'Money check', about: 'Spot the fake notes. Best of 6, then fastest.', show: (v) => `${v.score} of 6 · ${secs(v.ms)}`, game: true },
  change: { group: 'Games', label: 'Change master', about: 'Give the right change. Best of 5, then fastest.', show: (v) => `${v.score} of 5 · ${secs(v.ms)}`, game: true },
  road: { group: 'Games', label: 'Road safety', about: 'Dodge the road. Fewest bumps wins.', show: (v) => `${v.hits} bump${v.hits === 1 ? '' : 's'}`, game: true },
  quiz: { group: 'Knowledge', label: 'Quiz', about: 'Right answers in quizzes about your shop.', show: pct },
  goal: { group: 'House rules', label: 'Savings for the goal', about: 'Biggest share of the agreed goal saved.', show: pct, needs: 'goal' },
  keeper: { group: 'House rules', label: 'Rule keeper', about: 'Most days with every house rule kept.', show: (v) => `${v} day${v === 1 ? '' : 's'}`, needs: 'rules' },
};
export const CUP_EVENTS = Object.keys(EVENT_INFO);
const BASE_EVENTS = CUP_EVENTS.filter((e) => !EVENT_INFO[e].needs);

// House rules: habits each player keeps every game day. Checked each evening on the phone.
// Amount rules: [smallest, largest, step, starting amount].
export const HOUSE_RULES = {
  save: { label: 'Save daily', amount: [500, 20000, 500, 1000], text: (v) => `Put at least ${fmt(v)} into your pocket each day` },
  goal: { label: 'Agreed goal', text: (id) => { const g = GOALS.find((x) => x.id === id); return g ? `Save for ${g.name} (${fmt(g.price)})` : 'Save for the agreed goal'; } },
  record: { label: 'Record every sale', text: () => 'Record every sale you make' },
  pocket: { label: 'Family money from your pocket', text: () => 'Never take family money from the business money' },
  bills: { label: 'Pay bills on time', text: () => 'No bill left unpaid after its day' },
  prices: { label: 'No mid-day price rises', text: () => "Don't raise a price after opening the shop" },
  cash: { label: 'Keep a cash cushion', amount: [0, 200000, 500, 5000], text: (v) => `Keep at least ${fmt(v)} cash at the end of the day` },
  discount: { label: 'Discount limit', amount: [0, 50000, 50, 500], text: (v) => `Give no more than ${fmt(v)} in discounts a day` },
};
export const KEPT_BONUS = 1;
export const BROKEN_COST = 2;
export const STRICT_OUT = 3;
export const houseList = (h = {}) => Object.keys(HOUSE_RULES).filter((k) => h[k] != null && h[k] !== false);
export const goalById = (id) => GOALS.find((g) => g.id === id) || null;

// The standard rules: 7 real days, every event, up to 10 players, all levels, the host starts it, no house rules.
export const STANDARD_RULES = { name: 0, kind: 'real', length: 7, size: 10, events: [...BASE_EVENTS], levelFrom: 1, levelTo: 7, start: 'host', house: {} };

export const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
export const levelsText = (c) => (c.levelFrom === c.levelTo ? `Level ${c.levelFrom}` : `Levels ${c.levelFrom}–${c.levelTo}`);
export const lengthText = (c) => (c.kind === 'game' ? `${c.length} game days each` : `${c.length} real days`);

// When it starts, as a time: "in 1 hour", "tomorrow at 8 am", or the host's button.
export function startTime(choice, now = Date.now()) {
  if (choice === 'hour') return now + 3600000;
  if (choice === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.getTime();
  }
  return null;
}

// The form's rules as the server wants them.
export function rulesBody(f, level, now = Date.now()) {
  const startAt = startTime(f.start, now);
  return {
    name: f.name, kind: f.kind, length: f.length, size: f.size, events: f.events, levelFrom: f.levelFrom, levelTo: f.levelTo,
    startMode: startAt ? 'time' : 'host', ...(startAt ? { startAt } : {}), level, house: f.house || {},
  };
}

// Where the player's numbers start: nothing before the start counts.
function baseOf(s) {
  const st = s.stats;
  return {
    day: s.day, days: st.days, totalProfit: s.totalProfit, recW: st.recW, totW: st.totW,
    paidOnTime: st.paidOnTime, dueAmt: st.dueAmt, cleanDays: st.cleanDays, quizN: s.quizLog.length,
  };
}

export const findCup = (s, code) => (s.cups || []).find((c) => c.code === code);
export const cupStatus = (cup) => cup?.view?.cup?.status || 'open';

// After registering, or any news from the server: remember the championship; take the starting point when it starts.
export function applyCupView(s, v) {
  s.cups ??= [];
  let cup = findCup(s, v.cup.code);
  if (!cup) {
    cup = { code: v.cup.code, base: null, games: [] };
    s.cups.push(cup);
  }
  const c = v.cup;
  Object.assign(cup, { name: c.name, kind: c.kind, length: c.length, events: c.events, levelFrom: c.levelFrom, levelTo: c.levelTo, endsAt: c.endsAt, house: c.house || {}, view: v });
  if (c.status !== 'open' && !cup.base) cup.base = baseOf(s);
  return cup;
}

export function removeCup(s, code) {
  s.cups = (s.cups || []).filter((c) => c.code !== code);
}

export const cupOver = (cup) => ['ended', 'cancelled'].includes(cupStatus(cup));
export const activeCups = (s) => (s.cups || []).filter((c) => !cupOver(c));
export const inLevels = (s, cup) => s.level >= cup.levelFrom && s.level <= cup.levelTo;

// The business numbers since the start, or null when they no longer count
// (before the start, after your game days, or while your shop is outside the championship's levels).
export function cupBiz(s, cup) {
  if (!cup.base || cupStatus(cup) !== 'running' || !inLevels(s, cup)) return null;
  const st = s.stats;
  const b = cup.base;
  const days = Math.max(0, st.days - b.days);
  if (cup.kind === 'game' && days > cup.length) return null;
  const ratio = (a, c) => (c > 0 ? Math.round(Math.min(1, Math.max(0, a / c)) * 1000) / 1000 : null);
  const quiz = s.quizLog.slice(b.quizN);
  return {
    days,
    score: Math.round(Math.min(100, Math.max(0, s.score))),
    profit: days ? Math.max(-200000, Math.min(200000, Math.round((s.totalProfit - b.totalProfit) / days))) : 0,
    recording: ratio(st.recW - b.recW, st.totW - b.totW),
    debts: ratio(st.paidOnTime - b.paidOnTime, st.dueAmt - b.dueAmt),
    stocked: ratio(st.cleanDays - b.cleanDays, days),
    quizRight: quiz.reduce((a, q) => a + (q.correct || 0), 0),
    quizTotal: quiz.reduce((a, q) => a + (q.total || 0), 0),
    ...ruleCounts(cup),
    goalPct: goalShare(s, cup),
  };
}

const ruleCounts = (cup) => {
  const log = cup.ruleLog || [];
  return { ruleDays: log.length, keptDays: log.filter((d) => !d.broken.length).length, brokenDays: log.filter((d) => d.broken.length).length };
};

// How much of the agreed goal is saved: reached since the start counts as all of it.
function goalShare(s, cup) {
  const g = goalById(cup.house?.goal);
  if (!g) return null;
  if ((s.goalsReached || []).some((r) => r.name === g.name && r.day >= (cup.base?.day ?? 0))) return 1;
  if (s.goal?.name !== g.name) return 0;
  return Math.round(Math.min(1, s.pocket / g.price) * 1000) / 1000;
}

// Today's house rules, checked in the evening: which were kept and which broken.
export function checkRules(s, h) {
  const t = s.today;
  const ok = {
    save: () => (t.paidSelf || 0) >= h.save,
    goal: () => { const g = goalById(h.goal); return !!g && (s.goal?.name === g.name || (s.goalsReached || []).some((r) => r.name === g.name && r.day === s.day)); },
    record: () => t.recordedSales >= t.sales,
    pocket: () => !(t.personal || []).some((x) => x.from !== 'pocket'),
    bills: () => !s.bills.some((b) => b.due <= s.day),
    prices: () => !Object.keys(s.prices).some((id) => t.morningPrices && s.prices[id] > t.morningPrices[id] && !t.eventRaised?.[id]),
    cash: () => s.cash >= h.cash,
    discount: () => (t.discounts || 0) <= h.discount,
  };
  const kept = [];
  const broken = [];
  for (const k of houseList(h)) (ok[k]() ? kept : broken).push(k);
  return { kept, broken };
}

// Each evening: note every running championship's house rules, once per game day that counts.
export function dayRules(s) {
  const out = [];
  for (const cup of activeCups(s)) {
    const h = cup.house || {};
    if (!houseList(h).length || cupStatus(cup) !== 'running' || !cup.base || !cupBiz(s, cup)) continue;
    cup.ruleLog ??= [];
    if (cup.ruleLog.some((d) => d.day === s.day)) continue;
    const r = checkRules(s, h);
    cup.ruleLog.push({ day: s.day, ...r });
    out.push({ code: cup.code, name: cup.name, ...r });
  }
  if (s.today) s.today.cupRules = out;
  return out;
}

// Can the player still be on the table? (Strict championships: 3 broken days and you're out.)
export const isOut = (cup) => !!cup.house?.strict && ruleCounts(cup).brokenDays >= STRICT_OUT;

// What to send now: the latest numbers that still count.
export function bizToSend(s, cup) {
  const b = cupBiz(s, cup);
  if (b) cup.lastBiz = b;
  return cup.lastBiz || null;
}

const gameDaysUsed = (cup) => cup.kind === 'game' && (cup.lastBiz?.days ?? 0) >= cup.length;

// Can a game played now count for this championship?
export const gamesCount = (s, cup) => cupStatus(cup) === 'running' && inLevels(s, cup) && !gameDaysUsed(cup);

const beats = (a, b) => (a.type === 'road' ? a.hits < b.hits : a.score > b.score || (a.score === b.score && a.ms < b.ms));

// A finished game goes to every running championship that has it; only the best per game waits.
export function queueCupGame(s, result) {
  if (!result) return;
  for (const cup of activeCups(s)) {
    if (!cup.events.includes(result.type) || !gamesCount(s, cup)) continue;
    const same = cup.games.find((g) => g.type === result.type);
    if (!same || beats(result, same)) cup.games = [...cup.games.filter((g) => g !== same), result];
  }
}

const spell = (ms) => {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h${mins % 60 ? ` ${mins % 60} min` : ''}`;
  const d = Math.round(h / 24);
  return `${d} day${d > 1 ? 's' : ''}`;
};

// One line about where it is: "Starts in 2 h", "Waiting for the host", "3 days left", "Day 4 of 7", "Finished".
export function statusLine(cup, now = Date.now()) {
  const v = cup.view;
  const c = v.cup;
  if (c.status === 'cancelled') return 'Cancelled';
  if (c.status === 'ended') return 'Finished';
  if (c.status === 'open') return c.startMode === 'time' ? `Starts in ${spell(c.startAt - now)}` : 'Waiting for the host to start';
  if (c.kind === 'game') {
    const mine = v.players.find((p) => p.you)?.days ?? 0;
    return mine >= c.length ? `You played all ${c.length} game days` : `Game day ${Math.min(c.length, mine + 1)} of ${c.length}`;
  }
  return `${spell(c.endsAt - now)} left`;
}

// The player's line in the overall table.
export function myPlace(cup) {
  const v = cup.view;
  const me = v?.standings?.find((x) => x.you);
  return me ? { place: me.place, of: v.standings.length, points: me.points } : null;
}

// When a championship ends: a trophy for the cabinet and any new badges. Once only.
export function awardCup(s, cup) {
  const v = cup.view;
  if (cup.awarded || v?.cup?.status !== 'ended') return null;
  cup.awarded = true;
  const me = myPlace(cup);
  const eventsWon = cup.events.filter((e) => v.events?.[e]?.some((r) => r.you && r.place === 1));
  const scored = !!me && me.points > 0;
  const kind = scored && me.place <= 3 ? ['gold', 'silver', 'bronze'][me.place - 1] : 'part';
  const trophy = { code: cup.code, name: cup.name, kind, place: me?.place ?? null, of: me?.of ?? v.standings.length, points: me?.points ?? 0, eventsWon, endedAt: Date.now(), days: cup.length, type: cup.kind };
  s.trophies ??= [];
  s.trophies.push(trophy);
  const earned = [];
  const give = (id) => { if (!s.badges.includes(id)) { s.badges.push(id); earned.push(id); } };
  if (kind === 'gold') give('cup_champion');
  if (kind !== 'part') give('cup_podium');
  if ((cup.lastBiz?.days || 0) >= CUP_MIN_DAYS) give('cup_full');
  trophy.badges = earned;
  s.trophyNews = [...(s.trophyNews || []), trophy];
  return trophy;
}
