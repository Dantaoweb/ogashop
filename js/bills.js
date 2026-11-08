// Big bills, announced a few days ahead: the market stall fee, shop rent and one-off bills.
// They are business costs, paid from the business cash. Unpaid bills get a late fee each day.
import { BILLS, RULES } from './data.js';
import { fmt, expense } from './core.js';
import { isJunior, JUNIOR_BILLS } from './junior.js';

export const billOwed = (b) => b.amount + b.late * RULES.billLateFee;
export const billsDueSoon = (s) => s.bills.filter((b) => b.due - s.day <= RULES.billNoticeDays).sort((a, b) => a.due - b.due);
export const cashNeededSoon = (s) => billsDueSoon(s).reduce((a, b) => a + billOwed(b), 0);

// Put this level's bills on the list once they are close enough to announce.
export function scheduleBills(s) {
  const plan = (isJunior(s) ? JUNIOR_BILLS : BILLS)[s.level];
  if (!plan) return;
  const announce = (kind, label, amount, due) => s.bills.push({ id: s.nextBillId++, kind, label, amount, due, late: 0 });
  for (const r of plan.recurring) {
    let next = s.billNext[r.id] ?? s.levelStartDay + r.first - 1;
    while (next < s.day) next += r.every;
    if (next - s.day <= RULES.billNoticeDays) {
      announce(r.id, r.label, r.amount, next);
      next += r.every;
    }
    s.billNext[r.id] = next;
  }
  for (const o of plan.oneOff) {
    const due = s.levelStartDay + o.day - 1;
    if (s.billNext[o.id] === 'done' || due < s.day) continue;
    if (due - s.day <= RULES.billNoticeDays) {
      announce(o.id, o.label, o.amount, due);
      s.billNext[o.id] = 'done';
    }
  }
}

export function payBill(s, id) {
  const b = s.bills.find((x) => x.id === id);
  if (!b) return null;
  const owed = billOwed(b);
  if (s.cash < owed) return `You need ${fmt(owed)} but have ${fmt(s.cash)}.`;
  expense(s, owed, b.late ? `${b.label} (late)` : b.label);
  s.stats.billsPaid++;
  s.bills = s.bills.filter((x) => x !== b);
  return null;
}

// Pay bills that are due, if there is cash: in the evening everything due by today,
// in the morning only bills already late. Returns notes for the player.
export function payDueBills(s, { lateOnly = false } = {}) {
  const notes = [];
  for (const b of s.bills.filter((x) => (lateOnly ? x.due < s.day : x.due <= s.day))) {
    const owed = billOwed(b);
    if (!payBill(s, b.id)) notes.push(`You paid the ${b.label.toLowerCase()}: ${fmt(owed)}.`);
  }
  return notes;
}

// Each morning a bill is still unpaid after its day, the late fee grows.
export function chargeLateFees(s) {
  const notes = [];
  if (isJunior(s)) return notes;
  for (const b of s.bills.filter((x) => x.due < s.day)) {
    b.late++;
    s.stats.billsLateDays++;
    notes.push(`The ${b.label.toLowerCase()} is late. You now owe ${fmt(billOwed(b))} with late fees.`);
  }
  return notes;
}

// Bills for the old level that aren't due yet are dropped when the player moves up.
export function dropFutureBills(s) {
  s.bills = s.bills.filter((b) => b.due <= s.day);
  s.billNext = {};
}
