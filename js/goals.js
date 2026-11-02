// Saving for something real from your pocket (your own pay). Prices are real Nigerian prices,
// so small goals are reachable in Stage 1 and big ones show how long saving really takes.
import { fmt } from './core.js';

export function setGoal(s, name, price) {
  name = String(name || '').trim().slice(0, 40);
  price = Math.round(Number(price));
  if (!name || !(price >= 1000) || price > 1e9) return 'Give the goal a name and a price of at least ₦1,000.';
  s.goal = { name, price, since: s.day };
  return null;
}

export function clearGoal(s) {
  s.goal = null;
}

// "about 4 years" style wording for a number of days.
export function howLong(days) {
  if (days <= 1) return 'tomorrow';
  if (days < 60) return `${days} days`;
  if (days < 730) return `about ${Math.round(days / 30)} months`;
  return `about ${Math.round(days / 365)} years`;
}

export function daysToGoal(s, price = s.goal?.price) {
  if (!price) return null;
  const left = Math.max(0, price - s.pocket);
  if (!left) return 0;
  return s.pay > 0 ? Math.ceil(left / s.pay) : null;
}

export function goalStatus(s) {
  const g = s.goal;
  if (!g) return null;
  const saved = Math.min(s.pocket, g.price);
  const days = daysToGoal(s);
  let when;
  if (days === 0) when = 'You have enough!';
  else if (days == null) when = 'Your daily pay is ₦0, so this goal never comes. Pay yourself something.';
  else {
    when = `At ${fmt(s.pay)} a day, you'll reach it ${days <= 1 ? 'tomorrow' : `in ${howLong(days)}`}.`;
    if (days > 365) when += ' Grow the business to grow your pay.';
  }
  return { ...g, saved, pct: Math.floor((saved / g.price) * 100), days, when };
}

// Evening: when the pocket covers the goal, the player buys it.
export function checkGoal(s) {
  const g = s.goal;
  if (!g || s.pocket < g.price) return null;
  s.pocket -= g.price;
  const got = { name: g.name, price: g.price, day: s.day, days: s.day - g.since };
  s.goalsReached.push(got);
  s.goal = null;
  if (!s.badges.includes('goal_reached')) {
    s.badges.push('goal_reached');
    s.today.newBadges?.push('goal_reached');
  }
  return got;
}

// How much later the goal comes after spending from the pocket.
export function delayNote(s, amount) {
  if (!s.goal || !(s.pay > 0)) return '';
  const days = Math.ceil(amount / s.pay);
  return ` This puts your ${s.goal.name.toLowerCase()} ${days} day${days > 1 ? 's' : ''} further away.`;
}
