// Shared helpers that change game state. Used by engine.js and events.js.
import { GOODS, CUSTOMERS, RULES, SUPPLIER_CREDIT_LIMIT, SUPPLIER_CREDIT_DAYS } from './data.js';

export const CUST = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c]));

export function fmt(n) {
  const r = Math.round(n);
  const s = Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (r < 0 ? '-₦' : '₦') + s;
}

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
export const round50 = (n) => Math.round(n / 50) * 50;
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

export function pickWeighted(rng, entries) {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r < 0) return v;
  }
  return entries[entries.length - 1][0];
}

export function goodsForLevel(level) {
  return Object.keys(GOODS).filter((id) => GOODS[id].level <= level);
}

export function buyPrice(s, item) {
  return GOODS[item].buy + (s.market[item]?.buy || 0);
}

// The price customers expect to pay. Selling far above it makes some walk away.
export function refPrice(s, item) {
  return GOODS[item].sell + (s.market[item]?.sell || 0);
}

// Changes to the market. days = null means permanent.
export function setMarket(s, item, { buy = 0, sell = 0, days = null }) {
  const m = s.market[item] || { buy: 0, sell: 0, days: null };
  s.market[item] = { buy: m.buy + buy, sell: m.sell + sell, days };
}

export function addStock(s, item, qty, unitCost) {
  if (qty <= 0) return;
  const have = s.stock[item];
  s.cost[item] = (have * s.cost[item] + qty * unitCost) / (have + qty);
  s.stock[item] = have + qty;
  if (GOODS[item].shelfLife) s.batches.push({ item, qty, exp: s.day + GOODS[item].shelfLife - 1 });
}

export function removeStock(s, item, qty) {
  qty = Math.min(qty, s.stock[item]);
  s.stock[item] -= qty;
  if (GOODS[item].shelfLife) {
    let left = qty;
    for (const b of s.batches) {
      if (b.item !== item || left === 0) continue;
      const take = Math.min(b.qty, left);
      b.qty -= take;
      left -= take;
    }
    s.batches = s.batches.filter((b) => b.qty > 0);
  }
  return qty;
}

function addProfit(s, amount) {
  s.today.profit += amount;
  s.levelProfit += amount;
  s.totalProfit += amount;
}

export function expense(s, amount, label) {
  s.cash -= amount;
  addProfit(s, -amount);
  s.today.expenses.push({ label, amount });
}

// Goods lost or thrown away: their cost comes off profit.
export function waste(s, item, qty, label) {
  const lost = removeStock(s, item, qty);
  if (!lost) return 0;
  addProfit(s, -lost * s.cost[item]);
  s.today.wasted.push({ item, qty: lost, label });
  return lost;
}

export function cashIn(s, amount) {
  s.cash += amount;
  s.today.moneyIn += amount;
}

// Buy stock now, with cash or (Level 2) supplier credit. Returns an error message or null.
export function buyStock(s, item, qty, { credit = false, unitCost = buyPrice(s, item) } = {}) {
  const total = qty * unitCost;
  if (qty <= 0) return null;
  if (credit) {
    const err = supplierCreditError(s, total);
    if (err) return err;
    s.supplier.push({ amount: total, due: s.day + SUPPLIER_CREDIT_DAYS, late: false });
  } else {
    if (s.cash < total) return `You need ${fmt(total)} but have ${fmt(s.cash)}.`;
    s.cash -= total;
  }
  addStock(s, item, qty, unitCost);
  return null;
}

export function supplierOwed(s) {
  return s.supplier.reduce((a, d) => a + d.amount, 0);
}

export function supplierCreditError(s, amount) {
  if (s.level < 2) return 'Supplier credit opens at Level 2.';
  if (s.supplier.some((d) => d.late)) return 'Your supplier wants the late payment first.';
  if (supplierOwed(s) + amount > SUPPLIER_CREDIT_LIMIT) return `Your supplier only gives up to ${fmt(SUPPLIER_CREDIT_LIMIT)} on credit.`;
  return null;
}

// A sale: items [{item, qty, price}], paid now. Unpaid part becomes a debt (unrecorded until tiTi records it).
export function applySale(s, cid, items, paid, { recorded = false, dueDays = RULES.creditDueDays } = {}) {
  let total = 0;
  let cogs = 0;
  for (const it of items) {
    removeStock(s, it.item, it.qty);
    total += it.qty * it.price;
    cogs += it.qty * s.cost[it.item];
    if (it.price < s.cost[it.item] && !s.today.belowCost) s.today.belowCost = { item: it.item, cost: s.cost[it.item] };
  }
  paid = Math.min(paid, total);
  cashIn(s, paid);
  addProfit(s, total - cogs);
  s.today.sales++;
  s.today.salesValue += total;
  s.today.cogs += cogs;
  const sale = { cid, items, total, paid, recorded, debtId: null };
  if (total > paid) {
    const debt = {
      id: s.nextDebtId++, cid, amount: total - paid, due: s.day + dueDays, created: s.day,
      recorded, remindedDay: 0, status: 'open', what: describeItems(items),
    };
    s.debts.push(debt);
    sale.debtId = debt.id;
    s.today.creditGiven += debt.amount;
  }
  return sale;
}

export function describeItems(items) {
  return items.map((it) => `${it.qty} ${GOODS[it.item].short.toLowerCase()}`).join(' and ');
}

export function debtById(s, id) {
  return s.debts.find((d) => d.id === id);
}

export function openDebts(s, { recordedOnly = false } = {}) {
  return s.debts.filter((d) => d.status === 'open' && (!recordedOnly || d.recorded));
}

export function owedToYou(s) {
  return openDebts(s, { recordedOnly: true }).reduce((a, d) => a + d.amount, 0);
}

export function debtPaid(s, d, { onTime = false } = {}) {
  d.status = 'paid';
  cashIn(s, d.amount);
  s.stats.repaid++;
  if (onTime) s.stats.paidOnTime += d.amount;
  s.today.repaid.push({ cid: d.cid, amount: d.amount });
}

export function debtLost(s, d) {
  d.status = 'lost';
  addProfit(s, -d.amount);
  s.stats.lost++;
  s.today.lostDebts.push({ cid: d.cid, amount: d.amount, recorded: d.recorded });
}

export function changeLoyalty(s, cid, delta) {
  const c = s.customers[cid];
  c.loyalty = clamp(c.loyalty + delta, 0, 2);
  if (c.loyalty === 0) {
    c.skipUntil = s.day + 2;
    c.loyalty = 1;
  }
}
