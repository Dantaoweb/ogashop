// The game rules: one day = morning → customers (+ one event) → evening → score.
// Pure state changes, no DOM, so it can be tested in Node.
import {
  GOODS, START_CASH, START_STOCK, START_PAY, PAY_STEP, RULES, LEVELS, BADGES, NOTE_ORDER, CUSTOMERS, REACTIONS,
} from './data.js';
import {
  CUST, fmt, clamp, randInt, round50, pick, pickWeighted, goodsForLevel, buyPrice, refPrice, expense, describeItems,
  addStock, buyStock, waste, applySale, debtById, openDebts, owedToYou, debtPaid, debtLost,
  changeLoyalty, supplierOwed, supplierCreditError,
} from './core.js';
import { EVENT_BY_ID, drawEvent, morningEffects } from './events.js';
import { checkGoal } from './goals.js';
import { scheduleBills, payDueBills, chargeLateFees, dropFutureBills, payBill, cashNeededSoon, billsDueSoon, billOwed } from './bills.js';
import { parseSale, checkSale, detectQuery, suggestMessage } from './parser.js';

export const SAVE_VERSION = 1;

export function newGame(path, rng = Math.random) {
  const s = {
    v: SAVE_VERSION, path, level: 1, day: 0, levelStartDay: 1, completed: false,
    cash: START_CASH, pay: START_PAY, pocket: 0, stock: {}, cost: {}, prices: {}, batches: [], market: {},
    customers: {}, debts: [], nextDebtId: 1, supplier: [], bills: [], nextBillId: 1, billNext: {},
    levelProfit: 0, totalProfit: 0, score: 50,
    stats: { recW: 0, totW: 0, dueAmt: 0, paidOnTime: 0, days: 0, cleanDays: 0, repaid: 0, lost: 0, noLateStreak: 0, pocketPays: 0, capitalTakes: 0, overpayStreak: 0, served: 0, unhappy: 0, billsPaid: 0, billsLateDays: 0, changeRight: 0 },
    badges: [], seen: {}, eventLog: {}, mods: {}, history: [], goal: null, goalsReached: [],
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
    moneyIn: 0, profit: 0, sales: 0, salesValue: 0, cogs: 0, discounts: 0, recordedSales: 0, creditGiven: 0,
    unrecordedCredit: [], stockouts: [], wasted: [], expenses: [], repaid: [], lostDebts: [],
    belowCost: null, personal: [], paidSelf: 0, asks: {}, wordSpread: [], flash: null, morningPrices: null, eventRaised: {}, complaints: [], creditWalkouts: [], goodCalls: [], billNotes: [], notices: [], pending: null, chat: [], outcome: null, reaction: null,
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
  t.notices.push(...chargeLateFees(s), ...payDueBills(s, { lateOnly: true }));
  const known = new Set(s.bills.map((b) => b.id));
  scheduleBills(s);
  for (const b of s.bills.filter((x) => !known.has(x.id))) {
    t.notices.push(`Coming up: ${b.label.toLowerCase()} of ${fmt(b.amount)}, due on Day ${b.due}. Keep cash aside for it.`);
  }
  t.notices.push(...morningEffects(s));
  for (const [item, n] of Object.entries(s.lastAsks || {})) {
    if (n >= RULES.asksWarn) t.notices.push(`Yesterday ${n} customers asked for ${GOODS[item].short.toLowerCase()} and you didn't have enough. Buy more today.`);
  }
  if (s.mods.fewer) t.notices.push('Word spread that your shop runs out of goods. Fewer customers are coming today.');
  t.queue = makeQueue(s, rng);
  t.eventAt = Math.max(2, Math.floor(t.queue.length / 2));
  s.phase = 'morning';
}

export function buy(s, item, qty, credit = false) {
  return buyStock(s, item, qty, { credit });
}

// Saves from before daily pay existed get the new fields.
export function migrate(s) {
  s.pay ??= START_PAY;
  s.pocket ??= 0;
  Object.assign(s.stats, { pocketPays: 0, capitalTakes: 0, overpayStreak: 0, served: 0, unhappy: 0, billsPaid: 0, billsLateDays: 0, changeRight: 0, ...s.stats });
  s.bills ??= [];
  s.goal ??= null;
  s.goalsReached ??= [];
  s.nextBillId ??= 1;
  s.billNext ??= {};
  if (s.today && !Array.isArray(s.today.personal)) s.today.personal = [];
  s.today && (s.today.paidSelf ??= 0);
  if (s.today) {
    Object.assign(s.today, { asks: {}, wordSpread: [], eventRaised: {}, complaints: [], creditWalkouts: [], goodCalls: [], billNotes: [], ...s.today });
    if (s.phase !== 'morning') s.today.morningPrices ??= { ...s.prices };
  }
  return s;
}

// Put your own pay back into the business. It's your money, not a loan.
export function topUp(s) {
  if (s.pocket <= 0) return;
  s.cash += s.pocket;
  s.today.notices.push(`You put ${fmt(s.pocket)} from your pocket into the business.`);
  s.pocket = 0;
}

// No stock, and not enough money (or supplier credit) to buy even one item.
export function isStuck(s) {
  const goods = goodsForLevel(s.level);
  if (goods.some((id) => s.stock[id] > 0)) return false;
  const cheapest = Math.min(...goods.map((id) => buyPrice(s, id)));
  if (s.cash + s.pocket >= cheapest) return false;
  return s.level < 2 || !!supplierCreditError(s, cheapest);
}

// A fresh start for this level: starting cash and stock, bills and supplier debts cleared.
export function restartLevel(s, rng = Math.random) {
  s.cash = START_CASH;
  for (const id of Object.keys(GOODS)) s.stock[id] = 0;
  s.batches = [];
  for (const [id, qty] of Object.entries(START_STOCK)) addStock(s, id, qty, GOODS[id].buy);
  s.levelProfit = 0;
  s.bills = [];
  s.billNext = {};
  s.supplier = [];
  s.levelStartDay = s.day + 1;
  startDay(s, rng);
  s.today.notices.unshift(`A fresh start for Level ${s.level}. Keep cash aside for bills this time.`);
}

export function setPay(s, amount) {
  s.pay = clamp(Math.round(amount / PAY_STEP) * PAY_STEP, 0, 20000);
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
  s.today.morningPrices = { ...s.prices }; // raising a price after this, customers notice
  s.phase = 'selling';
  nextStep(s);
}

// ---------- Customers ----------

function makeQueue(s, rng) {
  let [lo, hi] = RULES.customersPerDay[s.level];
  if (s.mods.rush) { lo = Math.round(lo * 1.6); hi = Math.round(hi * 1.6); }
  let n = randInt(rng, lo, hi);
  if (s.mods.fewer) { n = Math.max(3, n - s.mods.fewer); delete s.mods.fewer; }
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
  return { cid, items, kind, frac, disc: 0.1 + rng() * 0.05, walkRoll: rng(), acceptRoll: rng(), moodRoll: rng(), changeRoll: rng() };
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
    ...r, customer: c, items, missing, total, walks, paysNow, discTotal, rush: rushOrder(s, wanted),
    clock: clockFor(t.idx, t.queue.length), number: t.idx + 1, of: t.queue.length,
  };
}

// Sending someone to the market for what's missing: normal price plus transport.
function rushOrder(s, wanted) {
  const items = wanted.filter((it) => it.have < it.qty)
    .map((it) => ({ item: it.item, qty: Math.max(RULES.rushMinQty, it.qty - it.have) }));
  if (!items.length) return null;
  const goods = items.reduce((a, it) => a + it.qty * buyPrice(s, it.item), 0);
  return { items, goods, fee: RULES.rushFee, cost: goods + RULES.rushFee };
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
  t.flash = null;

  if (action === 'restock') {
    const r = v.rush;
    if (!r || s.cash < r.cost) return;
    for (const it of r.items) buyStock(s, it.item, it.qty);
    expense(s, r.fee, 'Transport for quick restock');
    t.flash = `You sent a boy to the market. He brought ${describeItems(r.items)} (${fmt(r.cost)} with transport). ${name} waited.`;
    return;
  }

  if (!v.items.length) {
    t.stockouts.push(...v.missing);
    changeLoyalty(s, v.cid, -1);
    t.outcome = { text: `You have no ${v.missing.map((i) => GOODS[i].short.toLowerCase()).join(' or ')}. ${name} goes to another stall.${askedAgain(s, v.missing)}`, tone: 'bad' };
    return;
  }
  if (action === 'refuse') {
    if (v.kind === 'credit' && !trusted(s, v.cid)) {
      t.goodCalls.push(v.cid);
      t.outcome = { text: `You said no. ${name} walks away. ${goodCall(s, v.cid)}`, tone: 'neutral' };
      return;
    }
    changeLoyalty(s, v.cid, -1);
    unhappy(s);
    t.outcome = { text: `You said no. ${name} walks away unhappy.`, tone: 'neutral' };
    return;
  }
  if (v.walks) {
    t.outcome = { text: `"${fmt(v.total)}? Too much!" ${name} buys somewhere cheaper. Your prices may be too high.`, tone: 'bad' };
    return;
  }
  // Price raised since the shop opened? Later buyers notice and complain.
  const complaint = priceComplaint(s, v);
  if (complaint && v.customer.type === 'bargainer') {
    changeLoyalty(s, v.cid, -1);
    unhappy(s);
    t.complaints.push({ cid: v.cid, item: complaint.item });
    t.outcome = { text: `"${complaint.text}" ${name} goes to another stall.`, tone: 'bad' };
    return;
  }

  let shortNote = '';
  if (v.missing.length) {
    t.stockouts.push(...v.missing);
    shortNote = askedAgain(s, v.missing);
  }

  let paid = v.total;
  let discount = 0;
  let said = 'sell';
  if (action === 'credit') { paid = v.paysNow; said = 'credit'; }
  if (action === 'cashonly') said = 'cashonly';
  if (action === 'fullprice') said = 'fullprice';
  if (action === 'cashonly' && v.acceptRoll >= (RULES.acceptCashOnly[v.customer.type] ?? 0.5)) {
    if (!trusted(s, v.cid)) {
      t.goodCalls.push(v.cid);
      t.outcome = { text: `${name} doesn't have the cash today and leaves. ${goodCall(s, v.cid)}`, tone: 'neutral' };
      return;
    }
    changeLoyalty(s, v.cid, -1);
    unhappy(s);
    t.creditWalkouts.push(v.cid);
    const paidBefore = s.debts.some((d) => d.cid === v.cid && d.status === 'paid');
    t.outcome = { text: `"You don't trust me?" ${name} leaves without buying. ${CUST[v.cid].she ? 'She' : 'He'} ${paidBefore ? 'has always paid you back' : 'has a good name in the market'}.`, tone: 'bad' };
    return;
  }
  if (action === 'fullprice' && v.acceptRoll >= RULES.acceptFullPrice) {
    t.outcome = { text: `${name} says "Too much" and goes to the next stall.`, tone: 'neutral' };
    return;
  }
  let note = null;
  if (action === 'discount' || (v.kind === 'discount' && action === 'sell')) {
    discount = v.total - v.discTotal;
    paid = v.discTotal;
    said = v.kind === 'discount' ? 'bargainDiscount' : 'discount';
  }
  if (v.kind !== 'discount') {
    const before = s.customers[v.cid].loyalty;
    changeLoyalty(s, v.cid, 1);
    if (said === 'discount') note = s.customers[v.cid].loyalty === 2 && before < 2 ? `${name} is now a loyal customer.` : `${name} likes your shop more.`;
  }
  const sale = applySale(s, v.cid, v.items, paid, { discount });
  if (!s.badges.includes('first_sale')) s.badges.push('first_sale');
  t.pending = sale;
  t.reaction = reactionFor(v, said, sale, s.day + RULES.creditDueDays, note);
  s.stats.served++;
  if (complaint) {
    changeLoyalty(s, v.cid, -1);
    unhappy(s);
    t.complaints.push({ cid: v.cid, item: complaint.item });
    t.reaction = { cid: v.cid, text: `${complaint.text} OK, I'll take it this time.`, mood: 'sad', note: `${name} is unhappy about the price.` };
  }
  t.chat = [];
  if (v.missing.length) t.chat.push({ from: 'titi', text: `You didn't have enough ${v.missing.map((i) => GOODS[i].short.toLowerCase()).join(' or ')}, so you sold less.${shortNote}` });
  t.chat.push({ from: 'titi', text: sale.total > sale.paid
    ? `You gave ${name} credit. Tell me what happened, the way you'd say it.`
    : `${name} paid ${fmt(sale.paid)}. Record the sale.` });
  s.phase = 'record';
  // Sometimes a cash customer pays with ₦1,000 notes and you count the change.
  const notes = Math.ceil(sale.total / 1000) * 1000;
  if (sale.paid === sale.total && notes > sale.total && !t.changeDone && (v.changeRoll ?? 1) < RULES.changeChance) {
    t.changeDone = true;
    t.change = { cid: v.cid, total: sale.total, handed: notes, due: notes - sale.total, given: [] };
    s.phase = 'change';
  }
}

// ---------- Count the change ----------

export function changeTap(s, note) {
  const c = s.today.change;
  if (c && RULES.changeNotes.includes(note) && c.given.length < 20) c.given.push(note);
}

export function changeUndo(s) {
  s.today.change?.given.pop();
}

// result: 'give' (count what the player picked), 'skip' (tiTi counts), 'timeout' (customer got tired of waiting)
export function changeDone(s, result) {
  const t = s.today;
  const c = t.change;
  if (!c) return;
  const name = CUST[c.cid].name;
  const given = c.given.reduce((a, n) => a + n, 0);
  let r;
  if (result === 'skip') {
    r = { text: 'Thank you!', mood: 'happy', note: `tiTi counted ${fmt(c.due)} change for you.` };
  } else if (result === 'timeout') {
    unhappy(s);
    r = { text: 'Ah, you are too slow! Give me my change, I have to go.', mood: 'sad', note: `${name} got tired of waiting. The change was ${fmt(c.due)}.` };
  } else if (given === c.due) {
    s.stats.changeRight++;
    r = { text: 'Correct change. Thank you, my friend!', mood: 'happy', note: `Right change: ${fmt(c.due)}. ${name} trusts your shop.` };
  } else if (given < c.due) {
    unhappy(s);
    r = { text: `You short-changed me! I paid ${fmt(c.handed)}.`, mood: 'sad', note: `You gave ${fmt(given)}, but the change was ${fmt(c.due)}. You had to give the rest.` };
  } else {
    expense(s, given - c.due, 'Too much change given');
    r = { text: 'Thank you o!', mood: 'happy', note: `You gave ${fmt(given)}, but the change was ${fmt(c.due)}. You lost ${fmt(given - c.due)}.` };
  }
  t.reaction = { cid: c.cid, ...r };
  t.change = null;
  s.phase = 'record';
}

function unhappy(s) {
  s.stats.unhappy++;
}

// Customers with a good record: not the kind who never pays, nothing late, nothing lost.
export function trusted(s, cid) {
  if (CUST[cid].type === 'neverpays') return false;
  return !s.debts.some((d) => d.cid === cid && (d.status === 'lost' || (d.status === 'open' && d.due < s.day)));
}

function goodCall(s, cid) {
  const late = s.debts.find((d) => d.cid === cid && d.status === 'open' && d.due < s.day);
  if (late) return `Good call: ${CUST[cid].name} still owes you ${fmt(late.amount)} from Day ${late.created}.`;
  return `Good call: ${CUST[cid].name} rarely pays back.`;
}

// A later buyer of an item whose price went up since the shop opened may complain.
function priceComplaint(s, v) {
  const t = s.today;
  if (!t.morningPrices) return null;
  const raised = v.items.find((it) => s.prices[it.item] > t.morningPrices[it.item]);
  if (!raised) return null;
  const fromEvent = t.eventRaised[raised.item];
  const chances = fromEvent ? RULES.complainChanceEvent : RULES.complainChance;
  const chance = v.customer.type === 'regular' ? chances.regular : chances.other;
  if ((v.moodRoll ?? 0.5) >= chance) return null;
  const nm = GOODS[raised.item].short.toLowerCase();
  const was = fmt(t.morningPrices[raised.item]);
  return {
    item: raised.item,
    text: fromEvent ? `Hmm, ${nm} is ${fmt(s.prices[raised.item])} now? It was ${was} this morning.` : `Ah! ${GOODS[raised.item].short} was ${was} this morning!`,
  };
}

// Count customers asking for goods you don't have. Warn at 2; at 3 word spreads and regulars stay away.
function askedAgain(s, missing) {
  const t = s.today;
  let msg = '';
  for (const item of new Set(missing)) {
    const n = (t.asks[item] = (t.asks[item] || 0) + 1);
    const nm = GOODS[item].short.toLowerCase();
    if (n === RULES.asksWarn) msg += ` That's ${n} customers asking for ${nm} today. Send for more, or buy more tomorrow morning.`;
    if (n === RULES.asksWordSpreads && !t.wordSpread.includes(item)) {
      t.wordSpread.push(item);
      s.mods.fewer = (s.mods.fewer || 0) + RULES.wordSpreadFewerCustomers;
      const away = CUSTOMERS.filter((c) => c.type === 'regular' && s.customers[c.id].skipUntil <= s.day)
        .slice(0, RULES.wordSpreadRegularsAway);
      for (const c of away) s.customers[c.id].skipUntil = s.day + 2;
      msg += ` Word is spreading: "that shop never has ${nm}". ${away.map((c) => c.name).join(' and ')} will buy elsewhere for a few days.`;
    }
  }
  return msg;
}

// What the customer says after a sale. The line rotates so the same words don't repeat every time.
function reactionFor(v, said, sale, due, note) {
  const type = v.customer.type;
  const key = said === 'credit' && type === 'neverpays' ? 'creditNeverpays' : said === 'sell' && type === 'big' ? 'big' : said;
  const lines = REACTIONS[key] || REACTIONS.sell;
  const line = lines[(v.number + Math.floor(sale.total / 50)) % lines.length].replace('{due}', due);
  const text = v.missing.length ? `You don't have enough? OK, I'll take what you have. ${line}` : line;
  const mood = said === 'fullprice' || said === 'cashonly' ? 'neutral' : 'happy';
  return { cid: v.cid, text, mood, note };
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
  t.chat.push({ from: 'titi', card: { name, what: sale.items, listTotal: sale.listTotal, discount: sale.discount, total: sale.total, paid: sale.paid, owes: sale.total - sale.paid, due: debt?.due } });
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
  t.reaction = null;
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
  if (!ev || ev.outcome) return; // already answered (e.g. a double tap)
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

  // Bills due today are paid from the day's cash, before your own pay.
  t.billNotes = payDueBills(s);
  for (const b of s.bills.filter((x) => x.due === s.day)) t.billNotes.push(`You couldn't pay the ${b.label.toLowerCase()} (${fmt(b.amount)}). From tomorrow it costs ${fmt(RULES.billLateFee)} more each day.`);

  // Your daily pay moves from the business cash to your pocket.
  t.paidSelf = Math.max(0, Math.min(s.pay, s.cash));
  s.cash -= t.paidSelf;
  s.pocket += t.paidSelf;

  const st = s.stats;
  st.overpayStreak = s.pay > 0 && s.pay > t.profit ? st.overpayStreak + 1 : 0;
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
  t.goalReached = checkGoal(s);

  t.tip = pickTip(s);
  t.noteKey = s.path === 'learning' ? (t.event?.note && !s.seen['note_' + t.event.note] ? t.event.note : NOTE_ORDER.find((k) => !s.seen['note_' + k])) : null;
  if (t.noteKey) s.seen['note_' + t.noteKey] = true;
  t.levelUp = !s.completed && levelGoalMet(s);
  s.lastAsks = { ...t.asks };
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
    // Family needs paid from your own pay count for you; taking from the business counts against.
    money: (st.pocketPays + st.billsPaid + 1.2) / (st.pocketPays + st.billsPaid + st.capitalTakes + st.billsLateDays + 2),
    // Complaints, refused trusted customers and refusals count against; good sales for.
    customers: clamp((st.served + st.changeRight - 2 * st.unhappy + 4) / (st.served + st.changeRight + 5), 0, 1),
  };
}

function targetScore(s) {
  const p = scoreParts(s);
  const w = RULES.weights;
  return Math.round(100 * Object.keys(w).reduce((a, k) => a + w[k] * p[k], 0));
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
  const unpaid = s.bills.find((b) => b.due <= s.day);
  if (unpaid) return `The ${unpaid.label.toLowerCase()} is unpaid, and late fees grow every day. Keep cash aside for bills: don't spend it all on stock.`;
  const soon = billsDueSoon(s).find((b) => b.due > s.day);
  if (soon && s.cash < cashNeededSoon(s)) return `The ${soon.label.toLowerCase()} (${fmt(billOwed(soon))}) is due on Day ${soon.due} and you have ${fmt(s.cash)}. Buy less stock tomorrow so you can pay it.`;
  if (t.complaints.length) return `${t.complaints.length} customer${t.complaints.length > 1 ? 's' : ''} complained that you raised the price of ${GOODS[t.complaints[0].item].short.toLowerCase()} during the day. Set prices in the morning, and raise them only when your costs go up.`;
  if (t.creditWalkouts.length) return `${CUST[t.creditWalkouts[0]].name} left when you refused credit, but has a good record with you. Trusted customers are worth credit, as long as you record it.`;
  const fromBusiness = t.personal.find((p) => p.from === 'business');
  if (fromBusiness) return `You took ${fmt(fromBusiness.amount)} from the business money for family needs. Pay from your pocket instead: that is what your daily pay is for.`;
  if (s.stats.overpayStreak >= RULES.overpayWarnDays) return `You're paying yourself more than the business earns. Lower your daily pay, or your cash for stock will run down.`;
  if (t.stockouts.length) {
    const [item, n] = Object.entries(t.asks).sort((a, b) => b[1] - a[1])[0] || [t.stockouts[0], 1];
    return `${GOODS[item].name} ran out: ${n} customer${n > 1 ? 's' : ''} asked for it. Running out means lost sales. Buy a little more tomorrow, or send for more when it happens.`;
  }
  const thrown = t.wasted.find((w) => w.label === 'went bad');
  if (thrown) return `You threw away ${thrown.qty} ${GOODS[thrown.item].unit === 'loaf' ? 'loaves' : GOODS[thrown.item].short.toLowerCase()}. Buy short-life goods in smaller amounts.`;
  const dueTomorrow = openDebts(s, { recordedOnly: true }).find((d) => d.due === s.day + 1);
  if (dueTomorrow && s.level >= 2) return `${name(dueTomorrow.cid)}'s debt is due tomorrow. Send a polite reminder in the morning.`;
  if (t.moneyIn > 0 && t.profit < t.moneyIn * 0.15) return 'Busy is not the same as profitable. Most of today\'s money only paid for your stock.';
  if (t.personal.some((p) => p.from === 'pocket')) return 'Good: family needs came from your own pay, not the business money.';
  return 'Clean day! Every sale recorded and nothing ran out.';
}

// ---------- Levels ----------

export function levelUp(s) {
  if (s.level === 1) {
    s.level = 2;
    s.levelProfit = 0;
    s.levelStartDay = s.day + 1;
    dropFutureBills(s);
    return 'level2';
  }
  s.completed = true;
  return 'done';
}

export function morningSummary(s) {
  return { cash: s.cash, profit: s.levelProfit, owed: owedToYou(s), supplier: supplierOwed(s) };
}

export { buyPrice, refPrice, goodsForLevel, owedToYou, openDebts, supplierOwed, suggestMessage, BADGES, payBill, cashNeededSoon, billsDueSoon, billOwed };
