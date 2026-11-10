// Championships on the phone: the ones you are in, your numbers since joining, and game results waiting to be sent.
// The server (worker/cups.mjs) keeps the tables and decides the points.
import { fmt } from './core.js';

export const CUP_NAMES = ['Market Cup', 'Naira Masters', 'Oga Shop League', 'Traders Trophy', 'Golden Till Cup', 'Big Market Challenge', 'Friday Cup', 'Family Cup', 'Class Cup', 'Friends Cup'];
export const CUP_DAYS = [3, 7, 14];
export const CUP_MAX_SIZE = 20;
export const CUP_MIN_DAYS = 3;
export const CUP_MIN_QUIZ = 3;
export const CUP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];

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
};
export const CUP_EVENTS = Object.keys(EVENT_INFO);

export const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

// Where the player's numbers start: everything before joining is left out.
function baseOf(s) {
  const st = s.stats;
  return {
    days: st.days, totalProfit: s.totalProfit, recW: st.recW, totW: st.totW,
    paidOnTime: st.paidOnTime, dueAmt: st.dueAmt, cleanDays: st.cleanDays, quizN: s.quizLog.length,
  };
}

export const findCup = (s, code) => (s.cups || []).find((c) => c.code === code);

// After creating or joining: remember the championship, or refresh it.
export function applyCupView(s, v) {
  s.cups ??= [];
  let cup = findCup(s, v.cup.code);
  if (!cup) {
    cup = { code: v.cup.code, base: baseOf(s), games: [], joinedDay: s.day };
    s.cups.push(cup);
  }
  Object.assign(cup, { name: v.cup.name, endsAt: v.cup.endsAt, events: v.cup.events, view: v });
  return cup;
}

export function removeCup(s, code) {
  s.cups = (s.cups || []).filter((c) => c.code !== code);
}

export const cupEnded = (cup, now = Date.now()) => now >= cup.endsAt;
export const activeCups = (s, now = Date.now()) => (s.cups || []).filter((c) => !cupEnded(c, now));

// The business numbers since joining, as the server expects them.
export function cupBiz(s, cup) {
  const st = s.stats;
  const b = cup.base;
  const days = Math.max(0, st.days - b.days);
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
  };
}

const beats = (a, b) => (a.type === 'road' ? a.hits < b.hits : a.score > b.score || (a.score === b.score && a.ms < b.ms));

// A finished game goes to every running championship that has it; only the best per game waits.
export function queueCupGame(s, result, now = Date.now()) {
  if (!result) return;
  for (const cup of activeCups(s, now)) {
    if (!cup.events.includes(result.type)) continue;
    const same = cup.games.find((g) => g.type === result.type);
    if (!same || beats(result, same)) cup.games = [...cup.games.filter((g) => g !== same), result];
  }
}

// When a championship ends: a trophy for the cabinet and any new badges. Once only.
export function awardCup(s, cup) {
  const v = cup.view;
  if (cup.awarded || !v?.cup?.ended) return null;
  cup.awarded = true;
  const me = myPlace(cup);
  const eventsWon = cup.events.filter((e) => v.events?.[e]?.some((r) => r.you && r.place === 1));
  const scored = !!me && me.points > 0;
  const kind = scored && me.place <= 3 ? ['gold', 'silver', 'bronze'][me.place - 1] : 'part';
  const trophy = { code: cup.code, name: cup.name, kind, place: me?.place ?? null, of: me?.of ?? v.standings.length, points: me?.points ?? 0, eventsWon, endedAt: cup.endsAt, days: v.cup.days };
  s.trophies ??= [];
  s.trophies.push(trophy);
  const earned = [];
  const give = (id) => { if (!s.badges.includes(id)) { s.badges.push(id); earned.push(id); } };
  if (kind === 'gold') give('cup_champion');
  if (kind !== 'part') give('cup_podium');
  if ((cup.daysIn || 0) >= CUP_MIN_DAYS) give('cup_full');
  trophy.badges = earned;
  s.trophyNews = [...(s.trophyNews || []), trophy];
  return trophy;
}

// "3 days left", "5 hours left" or "Finished".
export function timeLeft(cup, now = Date.now()) {
  const ms = cup.endsAt - now;
  if (ms <= 0) return 'Finished';
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days} day${days > 1 ? 's' : ''} left`;
  const hours = Math.max(1, Math.round(ms / 3600000));
  return `${hours} hour${hours > 1 ? 's' : ''} left`;
}

// The player's line in the overall table.
export function myPlace(cup) {
  const v = cup.view;
  const me = v?.standings?.find((x) => x.you);
  return me ? { place: me.place, of: v.standings.length, points: me.points } : null;
}
