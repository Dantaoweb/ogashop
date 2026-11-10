// Championships on the phone: the ones you registered for, your numbers since the start, and game results waiting
// to be sent. The server (worker/cups.mjs) keeps the tables, starts them and decides the points.
import { fmt } from './core.js';

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
};
export const CUP_EVENTS = Object.keys(EVENT_INFO);

// The standard rules: 7 real days, every event, up to 10 players, all levels, the host starts it.
export const STANDARD_RULES = { name: 0, kind: 'real', length: 7, size: 10, events: [...CUP_EVENTS], levelFrom: 1, levelTo: 7, start: 'host' };

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
    startMode: startAt ? 'time' : 'host', ...(startAt ? { startAt } : {}), level,
  };
}

// Where the player's numbers start: nothing before the start counts.
function baseOf(s) {
  const st = s.stats;
  return {
    days: st.days, totalProfit: s.totalProfit, recW: st.recW, totW: st.totW,
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
  Object.assign(cup, { name: c.name, kind: c.kind, length: c.length, events: c.events, levelFrom: c.levelFrom, levelTo: c.levelTo, endsAt: c.endsAt, view: v });
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
  };
}

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
