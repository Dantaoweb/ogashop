// The game rules: one day = morning → customers (+ one event) → evening → score.
// Pure state changes, no DOM, so it can be tested in Node.
import {
  GOODS, START_CASH, START_STOCK, RULES, LEVELS, BADGES, NOTE_ORDER, CUSTOMERS,
} from './data.js';
import {
  CUST, fmt, clamp, randInt, round50, pick, pickWeighted, goodsForLevel, buyPrice, refPrice,
  addStock, buyStock, waste, applySale, debtById, openDebts, owedToYou, debtPaid, debtLost,
  changeLoyalty, supplierOwed,
} from './core.js';
import { EVENT_BY_ID, drawEvent, morningEffects } from './events.js';
import { parseSale, checkSale, detectQuery, suggestMessage } from './parser.js';

export const SAVE_VERSION = 1;

export function newGame(path, rng = Math.random) {
  const s = {
    v: SAVE_VERSION, path, level: 1, day: 0, levelStartDay: 1, completed: false,
    cash: START_CASH, stock: {}, cost: {}, prices: {}, batches: [], market: {},
    customers: {}, debts: [], nextDebtId: 1, supplier: [],
    levelProfit: 0, totalProfit: 0, score: 50,
    stats: { recW: 0, totW: 0, dueAmt: 0, paidOnTime: 0, days: 0, cleanDays: 0, repaid: 0, lost: 0, noLateStreak: 0 },
    badges: [], seen: {}, eventLog: {}, mods: {}, history: [],
    phase: 'morning', today: null,
  };
  for (const id of Object.keys(GOODS)) {
    s.stock[id] = 0;
    s.cost[id] = GOODS[id].buy;
    s.prices[id] = GOODS[id].sell;
  }
  for (const [id, qty] of Object.entries(START_STOCK)) addStock(s, id, qty, GOODS[id].buy);
  for (const c of CUSTOMERS) s.customers[c.id] = { loyalty: 1, skipUntil: 0 };
  startDay(s, rng);
  return s;
}

// ---------- Morning ----------

export function startDay(s, rng = Math.random) {
  s.day++;
  for (const [item, m] of Object.entries(s.market)) {
    if (m.days == null) continue;
    m.days--;
    if (m.days <= 0) {
      // A temporary change is over: undo it.
      delete s.market[item];
      if (item === 'drinks' || item === 'garri') s.prices[item] = Math.max(s.prices[item], GOODS[item].sell);
    }
  }
  s.today = {
    queue: [], idx: 0, eventAt: 0, eventDone: false, event: null,
    moneyIn: 0, profit: 0, sales: 0, salesValue: 0, cogs: 0, recordedSales: 0, creditGiven: 0,
    unrecordedCredit: [], stockouts: [], wasted: [], expenses: [], repaid: [], lostDebts: [],
    belowCost: null, personal: false, notices: [], pending: null, chat: [], outcome: null, served: null,
  };
  const t = s.today;
  for (const d of s.supplier) {
    if (d.due > s.day) continue;
    if (s.cash >= d.amount) {
      s.cash -= d.amount;
      d.paid = true;
      t.notices.push(`You paid your supplier ${fmt(d.amount)}.`);
    } else if (!d.late) {
      d.late = true;
      t.notices.push(`You couldn't pay your supplier ${fmt(d.amount)}. No more supplier credit until you pay.`);
    }
  }
  s.supplier = s.supplier.filter((d) => !d.paid);
  t.notices.push(...morningEffects(s));
  t.queue = makeQueue(s, rng);
  t.eventAt = Math.max(2, Math.floor(t.queue.length / 2));
  s.phase = 'morning';
}

export function buy(s, item, qty, credit = false) {
  return buyStock(s, item, qty, { credit });
}

export function setPrice(s, item, price) {
  s.prices[item] = clamp(round50(price), 50, 100000);
}

export function paySupplier(s) {
  const owed = supplierOwed(s);
  if (s.cash < owed) return `You need ${fmt(owed)} but have ${fmt(s.cash)}.`;
  s.cash -= owed;
  s.supplier = [];
  return null;
}

export function remind(s, debtId) {
  const d = debtById(s, debtId);
  if (!d || s.level < 2 || !d.recorded || d.remindedDay === s.day) return false;
  d.remindedDay = s.day;
  return true;
}

export function openShop(s) {
  s.phase = 'selling';
  nextStep(s);
}

// ---------- Customers ----------

function makeQueue(s, rng) {
  let [lo, hi] = RULES.customersPerDay[s.level];
  if (s.mods.rush) { lo = Math.round(lo * 1.6); hi = Math.round(hi * 1.6); }
  const n = randInt(rng, lo, hi);
  const available = (type) => CUSTOMERS.filter((c) => c.type === type && s.customers[c.id].skipUntil <= s.day).map((c) => c.id);
  const ids = [];
  const take = (type, count) => {
    const pool = available(type).filter((id) => !ids.includes(id));
    for (let i = 0; i < count && pool.length; i++) ids.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  };
  if (rng() < (s.mods.rush ? 0.6 : RULES.bigBuyerChance)) take('big', 1);
  take('credit', 1);
  take('bargainer', randInt(rng, 1, 2));
  if (rng() < 0.5) take('neverpays', 1);
  take('regular', n - ids.length);
  // Regulars come back more than once on busy days.
  while (ids.length < n) {
    const pool = [...available('regular'), ...available('credit'), ...available('bargainer')];
    if (!pool.length) break;
    ids.push(pick(rng, pool));
  }
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  if (s.mods.rush) s.mods.rush--;
  return ids.map((cid) => makeRequest(s, cid, rng));
}

function pickItem(s, rng, exclude = []) {
  return pickWeighted(rng, goodsForLevel(s.level).filter((id) => !exclude.includes(id)).map((id) => [id, GOODS[id].weight]));
}

function makeRequest(s, cid, rng) {
  const type = CUST[cid].type;
  const items = [];
  if (type === 'big') {
    const a = pickItem(s, rng);
    items.push({ item: a, qty: randInt(rng, 4, 7) });
    const b = pickItem(s, rng, [a]);
    items.push({ item: b, qty: randInt(rng, 3, 5) });
  } else {
    const a = pickItem(s, rng);
    items.push({ item: a, qty: randInt(rng, ...GOODS[a].qty) });
    if (type === 'regular' && rng() < 0.2) {
      const b = pickItem(s, rng, [a]);
      items.push({ item: b, qty: 1 });
    }
  }
  let kind = 'cash';
  let frac = 1;
  if (type === 'regular' && rng() < 0.25) { kind = 'credit'; frac = 0.5; }
  if (type === 'credit' && rng() < 0.85) { kind = 'credit'; frac = 0.4 + rng() * 0.2; }
  if (type === 'neverpays') { kind = 'credit'; frac = rng() * 0.3; }
  if (type === 'big' && s.level >= 2 && rng() < 0.5) { kind = 'credit'; frac = 0.5; }
  if (type === 'bargainer') kind = 'discount';
  return { cid, items, kind, frac, disc: 0.1 + rng() * 0.05, walkRoll: rng(), acceptRoll: rng() };
}

// What the current customer wants, given today's stock and prices.
export function currentCustomer(s) {
  const t = s.today;
  const r = t.queue[t.idx];
  if (!r) return null;
  const c = CUST[r.cid];
  const wanted = r.items.map((it) => ({ ...it, have: s.stock[it.item] }));
  const items = wanted
    .filter((it) => it.have > 0)
    .map((it) => ({ item: it.item, qty: Math.min(it.qty, it.have), price: s.prices[it.item] }));
  const missing = wanted.filter((it) => it.have < it.qty).map((it) => it.item);
  const total = items.reduce((a, it) => a + it.qty * it.price, 0);
  // Price too high compared with the market? Some walk away. Bargainers walk sooner.
  let over = 0;
  for (const it of items) over = Math.max(over, s.prices[it.item] / refPrice(s, it.item) - 1);
  const walkChance = clamp(over * (c.type === 'bargainer' ? 3 : 2), 0, 0.8);
  const walks = over > 0.02 && r.walkRoll < walkChance;
  const paysNow = r.kind === 'credit' ? Math.min(total - 100, Math.max(0, Math.round((total * r.frac) / 100) * 100)) : total;
  const discTotal = Math.round((total * (1 - r.disc)) / 50) * 50;
  return {
    ...r, customer: c, items, missing, total, walks, paysNow, discTotal,
    clock: clockFor(t.idx, t.queue.length), number: t.idx + 1, of: t.queue.length,
  };
}

function clockFor(idx, n) {
  const mins = 8 * 60 + Math.round((idx * 10 * 60) / Math.max(1, n));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// action: sell | credit | cashonly | discount | fullprice | refuse | next
export function serve(s, action) {
  const t = s.today;
  const v = currentCustomer(s);
  const name = v.customer.name;
  if (action === 'next') return advance(s);

  if (!v.items.length) {
    t.stockouts.push(...v.missing);
    changeLoyalty(s, v.cid, -1);
    t.outcome = { text: `You have no ${v.missing.map((i) => GOODS[i].short.toLowerCase()).join(' or ')}. ${name} goes to another stall.`, tone: 'bad' };
    return;
  }
  if (action === 'refuse') {
    changeLoyalty(s, v.cid, -1);
    t.outcome = { text: `You said no. ${name} walks away.`, tone: 'neutral' };
    return;
  }
  if (v.walks) {
    t.outcome = { text: `"${fmt(v.total)}? Too much!" ${name} buys somewhere cheaper. Your prices may be too high.`, tone: 'bad' };
    return;
  }
  if (v.missing.length) t.stockouts.push(...v.missing);

  let paid = v.total;
  let items = v.items;
  if (action === 'credit') paid = v.paysNow;
  if (action === 'cashonly' && v.acceptRoll >= (RULES.acceptCashOnly[v.customer.type] ?? 0.5)) {
    t.outcome = { text: `${name} doesn't have the cash today and leaves.`, tone: 'neutral' };
    return;
  }
  if (action === 'fullprice' && v.acceptRoll >= RULES.acceptFullPrice) {
    t.outcome = { text: `${name} says "Too much" and goes to the next stall.`, tone: 'neutral' };
    return;
  }
  if (action === 'discount' || (v.kind === 'discount' && action === 'sell')) {
    const target = v.discTotal;
    items = scalePrices(items, target);
    paid = target;
    if (v.kind !== 'discount') changeLoyalty(s, v.cid, 1);
  } else {
    changeLoyalty(s, v.cid, 1);
  }
  const sale = applySale(s, v.cid, items, paid);
  if (!s.badges.includes('first_sale')) s.badges.push('first_sale');
  t.pending = sale;
  t.chat = [];
  if (v.missing.length) t.chat.push({ from: 'titi', text: `You didn't have enough ${v.missing.map((i) => GOODS[i].short.toLowerCase()).join(' or ')}, so you sold less.` });
  t.chat.push({ from: 'titi', text: sale.total > sale.paid
    ? `You gave ${name} credit. Tell me what happened, the way you'd say it.`
    : `${name} paid ${fmt(sale.paid)}. Record the sale.` });
  s.phase = 'record';
}

// Spread a discounted total across items, so each item's price is recorded.
function scalePrices(items, target) {
  const total = items.reduce((a, it) => a + it.qty * it.price, 0);
  let left = target;
  return items.map((it, i) => {
    if (i === items.length - 1) return { ...it, price: left / it.qty };
    const p = round50((it.price * target) / total);
    left -= p * it.qty;
    return { ...it, price: p };
  });
}

// ---------- Recording with tiTi ----------

export function titiMessage(s, text) {
  const t = s.today;
  const sale = t.pending;
  text = text.trim();
  if (!text) return;
  t.chat.push({ from: 'me', text });
  const q = detectQuery(text);
  if (q === 'owes') { t.chat.push({ from: 'titi', text: owesReply(s) }); return; }
  if (q === 'profit') { t.chat.push({ from: 'titi', text: `Today so far: money in ${fmt(t.moneyIn)}, profit ${fmt(t.profit)}.` }); return; }
  if (!sale || sale.recorded) { t.chat.push({ from: 'titi', text: 'Nothing to record right now. Tap "Next customer".' }); return; }

  const name = sale.cid ? CUST[sale.cid].name : null;
  const parsed = parseSale(text);
  if (parsed.error) {
    t.chat.push({ from: 'titi', text: `I didn't catch that. Try: "${suggestMessage(sale, name)}"`, suggest: true });
    return;
  }
  const problems = checkSale(parsed, sale, name);
  if (problems.length) {
    t.chat.push({ from: 'titi', text: `Almost! But ${problems.slice(0, 2).join(', and ')}. Try again.` });
    return;
  }
  sale.recorded = true;
  const w = sale.total > sale.paid ? 2 : 1;
  s.stats.recW += w;
  s.stats.totW += w;
  t.recordedSales++;
  const debt = sale.debtId ? debtById(s, sale.debtId) : null;
  if (debt) debt.recorded = true;
  t.chat.push({ from: 'titi', card: { name, what: sale.items, total: sale.total, paid: sale.paid, owes: sale.total - sale.paid, due: debt?.due } });
}

function owesReply(s) {
  const list = openDebts(s, { recordedOnly: true });
  if (!list.length) return 'Nobody owes you money (that I have a record of).';
  return 'These people owe you: ' + list.map((d) => `${CUST[d.cid].name} ${fmt(d.amount)}`).join(', ') + `. Total ${fmt(owedToYou(s))}.`;
}

export function skipRecord(s) {
  const t = s.today;
  const sale = t.pending;
  if (sale && !sale.recorded) {
    s.stats.totW += sale.total > sale.paid ? 2 : 1;
    if (sale.debtId) t.unrecordedCredit.push({ cid: sale.cid, amount: sale.total - sale.paid });
  }
  advance(s);
}

// ---------- Flow ----------

function advance(s) {
  const t = s.today;
  t.idx++;
  t.pending = null;
  t.chat = [];
  t.outcome = null;
  nextStep(s);
}

function nextStep(s, rng = Math.random) {
  const t = s.today;
  if (!t.eventDone && t.idx >= t.eventAt && t.idx < t.queue.length) {
    t.eventDone = true;
    const ev = drawEvent(s, rng);
    if (ev) {
      t.event = { ...ev, outcome: null, note: EVENT_BY_ID[ev.id].note || null };
      s.eventLog[ev.id] = s.day;
      s.phase = 'event';
      return;
    }
  }
  if (t.idx >= t.queue.length) return endDay(s, rng);
  s.phase = 'selling';
}

export function eventView(s) {
  const ev = s.today.event;
  const def = EVENT_BY_ID[ev.id];
  return {
    id: ev.id, icon: def.icon, title: def.title(s, ev.ctx), text: def.text(s, ev.ctx),
    choices: ev.outcome ? [] : def.choices(s, ev.ctx), outcome: ev.outcome,
  };
}

export function chooseEvent(s, index, rng = Math.random) {
  const ev = s.today.event;
  const choice = EVENT_BY_ID[ev.id].choices(s, ev.ctx)[index];
  if (!choice || choice.disabled) return;
  ev.outcome = choice.run(s, ev.ctx, rng);
}

export function continueAfterEvent(s, rng = Math.random) {
  nextStep(s, rng);
}

// ---------- Evening ----------

export function endDay(s, rng = Math.random) {
  const t = s.today;
  // Bread past its last day is thrown away.
  for (const b of s.batches.filter((x) => x.exp <= s.day)) waste(s, b.item, b.qty, 'went bad');

  for (const d of openDebts(s)) {
    if (s.day < d.due) continue;
    const never = CUST[d.cid].type === 'neverpays';
    const onDue = s.day === d.due;
    const reminded = d.remindedDay === s.day;
    if (onDue) s.stats.dueAmt += d.amount;
    if (!d.recorded) {
      const forget = onDue ? (never ? RULES.forgetUnrecorded.neverpays : RULES.forgetUnrecorded.normal) : RULES.forgetUnrecordedLate;
      if (rng() < forget) { debtLost(s, d); continue; }
    }
    const P = onDue ? RULES.payOnDue : RULES.payLate;
    const p = onDue
      ? (never ? (reminded ? P.neverpaysReminded : P.neverpays) : (reminded ? P.reminded : P.recorded))
      : (never ? (reminded ? P.neverpaysReminded : P.neverpays) : (reminded ? P.reminded : P.normal));
    if (rng() < p) debtPaid(s, d, { onTime: onDue });
    else if (s.day - d.due >= RULES.writeOffAfterLateDays) debtLost(s, d);
  }

  const st = s.stats;
  st.days++;
  const clean = t.stockouts.length === 0 && t.wasted.length === 0;
  if (clean) st.cleanDays++;
  const late = openDebts(s).some((d) => d.due < s.day);
  st.noLateStreak = late ? 0 : st.noLateStreak + 1;

  const allRecorded = t.sales > 0 && t.recordedSales >= t.sales;
  t.stars = (t.profit > 0 ? 1 : 0) + (allRecorded ? 1 : 0) + (clean && t.sales > 0 ? 1 : 0);

  const before = s.score;
  s.score = clamp(s.score + clamp(targetScore(s) - s.score, -RULES.scoreMaxStep, RULES.scoreMaxStep), 0, 100);
  t.scoreDelta = s.score - before;

  t.newBadges = [];
  const award = (id, cond) => { if (cond && !s.badges.includes(id)) { s.badges.push(id); t.newBadges.push(id); } };
  award('record_keeper', allRecorded && t.sales >= 3);
  award('fully_stocked', clean && t.sales >= 5);
  award('never_lost_debt', st.repaid >= 3 && st.lost === 0);
  award('debt_free_week', st.noLateStreak >= 7);

  t.tip = pickTip(s);
  t.noteKey = s.path === 'learning' ? (t.event?.note && !s.seen['note_' + t.event.note] ? t.event.note : NOTE_ORDER.find((k) => !s.seen['note_' + k])) : null;
  if (t.noteKey) s.seen['note_' + t.noteKey] = true;
  t.levelUp = !s.completed && levelGoalMet(s);
  s.history.push({ day: s.day, level: s.level, moneyIn: t.moneyIn, profit: t.profit, stars: t.stars });
  s.phase = 'evening';
}

export function scoreParts(s) {
  const st = s.stats;
  return {
    recording: st.totW ? st.recW / st.totW : 0.5,
    debts: st.dueAmt ? Math.min(1, st.paidOnTime / st.dueAmt) : 0.6,
    stock: st.days ? st.cleanDays / st.days : 0.6,
    profit: clamp(s.levelProfit / LEVELS[s.level].goalProfit, 0, 1),
  };
}

function targetScore(s) {
  const p = scoreParts(s);
  return Math.round(100 * (0.35 * p.recording + 0.25 * p.debts + 0.2 * p.stock + 0.2 * p.profit));
}

export function levelGoalMet(s) {
  const L = LEVELS[s.level];
  if (s.levelProfit < L.goalProfit || s.score < L.goalScore) return false;
  if (L.maxLateDays && openDebts(s).some((d) => s.day - d.due > L.maxLateDays)) return false;
  return true;
}

function pickTip(s) {
  const t = s.today;
  const name = (cid) => CUST[cid].name;
  if (t.unrecordedCredit.length) return `You didn't record ${name(t.unrecordedCredit[0].cid)}'s credit. Some customers "forget". Record every credit sale.`;
  if (t.lostDebts.some((d) => !d.recorded)) return 'An unrecorded debt was forgotten today. A record is what gets you paid.';
  if (t.belowCost) return `A discount on ${GOODS[t.belowCost.item].short.toLowerCase()} went below your buy price of ${fmt(t.belowCost.cost)}. That sale lost money.`;
  if (t.personal) return 'Business money paid for family needs today. Pay yourself a fixed amount instead.';
  if (t.stockouts.length) return `${GOODS[t.stockouts[0]].name} ran out. Running out means lost sales. Buy a little more tomorrow.`;
  const thrown = t.wasted.find((w) => w.label === 'went bad');
  if (thrown) return `You threw away ${thrown.qty} ${GOODS[thrown.item].unit === 'loaf' ? 'loaves' : GOODS[thrown.item].short.toLowerCase()}. Buy short-life goods in smaller amounts.`;
  const dueTomorrow = openDebts(s, { recordedOnly: true }).find((d) => d.due === s.day + 1);
  if (dueTomorrow && s.level >= 2) return `${name(dueTomorrow.cid)}'s debt is due tomorrow. Send a polite reminder in the morning.`;
  if (t.moneyIn > 0 && t.profit < t.moneyIn * 0.15) return 'Busy is not the same as profitable. Most of today\'s money only paid for your stock.';
  return 'Clean day! Every sale recorded and nothing ran out.';
}

// ---------- Levels ----------

export function levelUp(s) {
  if (s.level === 1) {
    s.level = 2;
    s.levelProfit = 0;
    s.levelStartDay = s.day + 1;
    return 'level2';
  }
  s.completed = true;
  return 'done';
}

export function morningSummary(s) {
  return { cash: s.cash, profit: s.levelProfit, owed: owedToYou(s), supplier: supplierOwed(s) };
}

export { buyPrice, refPrice, goodsForLevel, owedToYou, openDebts, supplierOwed, suggestMessage, BADGES };
