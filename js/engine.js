// The game rules: one day = morning → customers (+ one event) → evening → score.
// Pure state changes, no DOM, so it can be tested in Node.
import {
  GOODS, START_CASH, START_STOCK, START_PAY, PAY_STEP, PAYMENTS, HOSPITAL, RIVALS, RIVAL_POOL, ADVERT, RULES, LEVELS, BADGES, NOTE_ORDER, CUSTOMERS, REACTIONS,
} from './data.js';
import {
  CUST, fmt, clamp, randInt, round50, pick, pickWeighted, goodsForLevel, buyPrice, refPrice, expense, describeItems,
  addStock, buyStock, waste, applySale, debtById, openDebts, owedToYou, debtPaid, debtLost,
  changeLoyalty, supplierOwed, supplierCreditError, applyCustom, baseBuy, baseSell, priceStep,
} from './core.js';
import { venueOf } from './venues.js';
import { isJunior, isGuided, JUNIOR_CUSTOMERS, JUNIOR_GOALS, JUNIOR_PAY, JUNIOR_RUN_SECONDS } from './junior.js';
import { EVENT_BY_ID, drawEvent, morningEffects, rivalGrab } from './events.js';
import { checkGoal } from './goals.js';
import { makeQuiz } from './quiz.js';
import { enterStage, finishStageDay, tiTiRecordsForYou, creditAllowed } from './stages.js';
import { challengeForDay, levelDay, LEVEL_DAYS, CHAMPION_TITLES } from './challenge.js';
import { scheduleBills, payDueBills, chargeLateFees, dropFutureBills, payBill, cashNeededSoon, billsDueSoon, billOwed } from './bills.js';
import { parseSale, checkSale, detectQuery, suggestMessage } from './parser.js';

export const SAVE_VERSION = 1;

// A championship shop (cup): everyone gets the same seed (same customers each day), a start level and a top level.
export function newGame(path, rng = Math.random, cup = null) {
  const s = {
    v: SAVE_VERSION, path, level: cup?.level || 1, day: 0, levelStartDay: 1, completed: false,
    cash: START_CASH, pay: path === 'junior' ? JUNIOR_PAY : START_PAY, pocket: 0, stock: {}, cost: {}, prices: {}, batches: [], market: {},
    customers: {}, debts: [], nextDebtId: 1, supplier: [], bills: [], nextBillId: 1, billNext: {},
    levelProfit: 0, totalProfit: 0, score: 50,
    stats: { recW: 0, totW: 0, dueAmt: 0, paidOnTime: 0, days: 0, cleanDays: 0, repaid: 0, lost: 0, noLateStreak: 0, pocketPays: 0, capitalTakes: 0, overpayStreak: 0, served: 0, unhappy: 0, billsPaid: 0, billsLateDays: 0, changeRight: 0, goodChecks: 0 },
    badges: [], seen: {}, eventLog: {}, mods: {}, history: [], goal: null, goalsReached: [], sales: [], quizLog: [], quiz: null,
    payments: { account: 'creditvoice', accountNumber: PAYMENTS.defaultAccountNumber, pos: 'creditvoice' },
    skills: {}, challengeLog: [], mp: null, stage: null, stageLog: [], cups: [], trophies: [],
    phase: 'morning', today: null,
  };
  for (const id of Object.keys(GOODS)) {
    s.stock[id] = 0;
    s.cost[id] = baseBuy(s, id);
    s.prices[id] = baseSell(s, id);
  }
  for (const [id, qty] of Object.entries(START_STOCK)) addStock(s, id, qty, baseBuy(s, id));
  for (const c of CUSTOMERS) s.customers[c.id] = { loyalty: 1, skipUntil: 0 };
  s.custom = {};
  if (cup) Object.assign(s, { seed: cup.seed, cupCode: cup.code, maxLevel: cup.maxLevel || null, venue: cup.venue || null });
  // A market's shop opens at that market's usual prices.
  if (venueOf(s)) for (const id of Object.keys(GOODS)) s.prices[id] = refPrice(s, id);
  applyCustom(s);
  startDay(s, rng);
  return s;
}

// The same random numbers for every player on the same day of a championship shop.
function seeded(seed, day) {
  let a = (seed ^ Math.imul(day + 1, 0x9e3779b1)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Morning ----------

export function startDay(s, rng = Math.random) {
  s.day++;
  if (s.seed != null) rng = seeded(s.seed, s.day);
  for (const [item, m] of Object.entries(s.market)) {
    if (m.days == null) continue;
    m.days--;
    if (m.days <= 0) {
      // A temporary change is over: undo it.
      delete s.market[item];
      if (item === 'drinks' || item === 'garri') s.prices[item] = Math.max(s.prices[item], baseSell(s, item));
    }
  }
  s.today = {
    queue: [], idx: 0, eventAt: 0, eventDone: false, event: null,
    moneyIn: 0, profit: 0, sales: 0, salesValue: 0, cogs: 0, discounts: 0, recordedSales: 0, creditGiven: 0,
    unrecordedCredit: [], stockouts: [], wasted: [], expenses: [], repaid: [], lostDebts: [],
    belowCost: null, personal: [], paidSelf: 0, asks: {}, wordSpread: [], flash: null, morningPrices: null, eventRaised: {}, complaints: [], creditWalkouts: [], goodCalls: [], billNotes: [], lostTo: [], market: null, notices: [], pending: null, chat: [], outcome: null, reaction: null,
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
  // Every other day starts with a short challenge.
  const ch = challengeForDay(s);
  t.challenge = ch ? { type: ch, done: false } : null;
  if (levelDay(s) > LEVEL_DAYS && !levelGoalMet(s)) t.notices.unshift(`Extra day ${levelDay(s) - LEVEL_DAYS}: reach your Level ${s.level} goal to move up. Check your score card for what's missing.`);
  enterStage(s);
  showChampionNews(s);
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
  Object.assign(s.stats, { pocketPays: 0, capitalTakes: 0, overpayStreak: 0, served: 0, unhappy: 0, billsPaid: 0, billsLateDays: 0, changeRight: 0, goodChecks: 0, ...s.stats });
  s.bills ??= [];
  s.goal ??= null;
  s.custom ??= {};
  applyCustom(s);
  s.mp ??= null;
  s.stage ??= null;
  s.stageLog ??= [];
  s.cups ??= [];
  s.trophies ??= [];
  s.trophyNews ??= [];
  s.skills ??= {};
  if (s.today) { s.today.lostTo ??= []; s.today.market ??= null; }
  s.challengeLog ??= [];
  s.payments ??= { account: 'creditvoice', accountNumber: PAYMENTS.defaultAccountNumber, pos: 'creditvoice' };
  s.sales ??= [];
  s.quizLog ??= [];
  s.quiz ??= null;
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
// Some or all of your own pay goes back into the business. Returns an error message, or null.
export function topUp(s, amount = s.pocket) {
  const a = Math.round(Number(amount));
  if (!Number.isFinite(a) || a <= 0 || (a < 50 && a !== s.pocket)) return `Put in at least ${fmt(50)}.`;
  if (a > s.pocket) return `You only have ${fmt(s.pocket)} in your pocket.`;
  s.pocket -= a;
  s.cash += a;
  s.today.topUps = [...(s.today.topUps || []), a];
  s.today.notices.push(`You put ${fmt(a)} from your pocket into the business.`);
  return null;
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
  for (const [id, qty] of Object.entries(START_STOCK)) addStock(s, id, qty, baseBuy(s, id));
  s.levelProfit = 0;
  s.bills = [];
  s.stage = null;
  s.billNext = {};
  s.supplier = [];
  s.levelStartDay = s.day + 1;
  startDay(s, rng);
  s.today.notices.unshift(`A fresh start for Level ${s.level}. Keep cash aside for bills this time.`);
}

export { levelDay, LEVEL_DAYS };

// Skills from challenge days change the mini-games a little.
export function runSettings(s) {
  if (isJunior(s)) return { seconds: JUNIOR_RUN_SECONDS, injuryChance: 0 };
  return {
    seconds: RULES.runSeconds + (s.skills?.fastRunner ? 5 : 0),
    injuryChance: RULES.injuryChance * (s.skills?.fastRunner ? 0.5 : 1),
  };
}
export const changeSeconds = (s) => RULES.changeSeconds + (s.skills?.patience ? 5 : 0);

export function skipChallenge(s) {
  if (s.today.challenge) s.today.challenge = { ...s.today.challenge, done: true, skipped: true };
}

export function setPay(s, amount) {
  s.pay = clamp(Math.round(amount / PAY_STEP) * PAY_STEP, 0, 20000);
}

// The name on your signboard. Shown only on your own phone.
export const shopName = (s) => s.shopName || (s.level >= 2 ? 'My Shop' : 'My Table');

export function setShopName(s, name) {
  const n = String(name || '').trim().replace(/\s+/g, ' ');
  if (!n) { s.shopName = null; return null; }
  if (n.length > 20) return 'A shop name can have up to 20 letters.';
  if (!/^[\p{L}\p{N} '&.-]+$/u.test(n)) return 'Use letters, numbers, spaces and simple marks only.';
  s.shopName = n;
  return null;
}

export function setPrice(s, item, price) {
  const step = priceStep(s);
  s.prices[item] = clamp(Math.round(price / step) * step, step, 100000);
}

// Changing how you play. Moving to or from Junior changes to that way's prices.
export function setPath(s, path) {
  const was = isJunior(s);
  s.path = path;
  if (was === isJunior(s)) return;
  for (const id of Object.keys(GOODS)) {
    s.cost[id] = baseBuy(s, id);
    s.prices[id] = baseSell(s, id);
  }
  if (isJunior(s)) s.pay = Math.min(s.pay, JUNIOR_PAY);
  if (s.today?.morningPrices) s.today.morningPrices = { ...s.prices };
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

// How attractive your shop is today compared with the rivals: adverts, prices, loyal customers, stock.
export function attraction(s) {
  const parts = [];
  if ((s.mods.advertUntil ?? 0) >= s.day) parts.push(['Your advert', ADVERT.boost]);
  const goods = goodsForLevel(s.level);
  const cheaper = goods.reduce((a, id) => a + (refPrice(s, id) - s.prices[id]) / refPrice(s, id), 0) / goods.length;
  if (Math.abs(cheaper) >= 0.02) parts.push([cheaper > 0 ? 'Your lower prices' : 'Your higher prices', clamp(cheaper * 1.5, -0.3, 0.3)]);
  const regulars = CUSTOMERS.filter((c) => c.type === 'regular');
  const loyal = regulars.reduce((a, c) => a + s.customers[c.id].loyalty, 0) / regulars.length - 1;
  if (loyal > 0.1) parts.push(['Loyal customers', loyal * 0.2]);
  const asked = Object.values(s.lastAsks || {}).reduce((a, n) => a + n, 0);
  if (asked >= 3) parts.push(['Goods ran out yesterday', -0.15]);
  // Real rival shops: their low prices and adverts pull customers away, up to a limit.
  const real = marketRivals(s).filter((r) => r.real);
  if (real.length) {
    const effect = clamp(real.reduce((a, r) => a + (r.priceWord === 'low' ? -0.07 : r.priceWord === 'high' ? 0.05 : 0) + (r.advert ? -0.05 : 0), 0), -0.2, 0.2);
    if (effect) parts.push(['Rival shops', effect]);
  }
  for (const d of s.mods.rivalDeals || []) {
    if (d.fake && d.from === s.day - 1) parts.push([`${d.name} sold fake goods`, 0.1]);
    else if (!d.fake && d.until >= s.day) parts.push([`${d.name} has ${d.what}`, -0.1]);
  }
  return { factor: clamp(1 + parts.reduce((a, [, v]) => a + v, 0), 0.6, 1.6), parts };
}

// Today's market: how many customers come to the market, and how many choose your shop.
// The other shops in your market: real players first, computer shops in any empty place.
export function marketRivals(s) {
  if (!s.mp?.shops) return RIVALS.map((r) => ({ ...r, real: false }));
  const real = s.mp.shops.filter((x) => !x.you && x.active).map((x) => ({
    id: `slot${x.slot}`, slot: x.slot, name: x.name, real: true, priceWord: x.price, advert: x.advert,
    price: x.price === 'low' ? 0.92 : x.price === 'high' ? 1.08 : 1, lastCustomers: x.customers, lastSales: x.sales,
  }));
  const bots = RIVAL_POOL.slice(0, Math.max(0, s.mp.size - 1 - real.length)).map((r) => ({ ...r, real: false }));
  return [...real, ...bots];
}

// What the server tells us about the market.
export function applyMarketView(s, v) {
  const news = [...(s.mp?.champNews || []), ...championNews(s.mp?.champions, v.champions)];
  s.mp = {
    size: v.market.size, kind: v.market.kind, code: v.market.code, level: v.market.level, you: v.you, shops: v.shops,
    pendingWins: [...(s.mp?.pendingWins || []), ...(v.wins || [])],
    champions: v.champions || { money: [], change: [] }, champQueue: s.mp?.champQueue || [], champNews: news,
  };
  if (s.phase === 'morning') showChampionNews(s);
  refreshMorningMarket(s);
}

// Before the shop opens, show the current shops; your customer count for today stays the same.
function refreshMorningMarket(s) {
  const t = s.today;
  if (s.phase !== 'morning' || !t?.market) return;
  const mine = t.market.mine;
  t.market = { ...planMarket(s, mine, Math.random), mine };
}

// Only news about you: taking a title, or losing one. Nothing when you've just joined.
function championNews(before, after) {
  if (!before || !after) return [];
  const news = [];
  for (const [type, title] of Object.entries(CHAMPION_TITLES)) {
    const was = before[type]?.[0];
    const now = after[type]?.[0];
    if (now?.you && !was?.you) news.push(`You are now the ${title} in your market!`);
    else if (was?.you && now && !now.you) news.push(`${now.name} took the ${title} title from you. You can win it back in My market.`);
  }
  return news;
}

function showChampionNews(s) {
  if (!s.mp?.champNews?.length || !s.today) return;
  s.today.notices.push(...s.mp.champNews);
  s.mp.champNews = [];
}

// Keep a finished game until the server has it; only the best per game needs to go.
export function queueChampion(s, result) {
  if (!s.mp || !result || result.score < 1) return;
  const same = s.mp.champQueue.find((c) => c.type === result.type);
  const better = !same || result.score > same.score || (result.score === same.score && result.ms < same.ms);
  if (better) s.mp.champQueue = [...s.mp.champQueue.filter((c) => c !== same), result];
}

export function leaveMarketLocal(s) {
  s.mp = null;
  refreshMorningMarket(s);
}

// Today's result to share with the market.
export function dayResult(s) {
  const t = s.today;
  const goods = goodsForLevel(s.level);
  const cheaper = goods.reduce((a, id) => a + (refPrice(s, id) - s.prices[id]) / refPrice(s, id), 0) / goods.length;
  const lost = {};
  for (const l of t.lostTo) if (String(l.rival).startsWith('slot')) { const slot = Number(String(l.rival).slice(4)); lost[slot] = (lost[slot] || 0) + 1; }
  return {
    customers: t.sales, sales: Math.round(t.salesValue), price: cheaper >= 0.02 ? 'low' : cheaper <= -0.02 ? 'high' : 'normal',
    advert: (s.mods.advertUntil ?? 0) >= s.day, level: s.level, gameDay: s.day,
    lost: Object.entries(lost).map(([slot, count]) => ({ slot: Number(slot), count })),
  };
}

function planMarket(s, n, rng) {
  const list = marketRivals(s);
  const size = Math.round(n * (1 + list.length) + randInt(rng, 0, 2));
  const att = attraction(s);
  const most = isJunior(s) ? JUNIOR_CUSTOMERS[1] : Infinity;
  const mine = Math.min(most, Math.max(3, Math.min(size - 2, Math.round(n * att.factor))));
  const rest = Math.max(0, size - mine - list.reduce((a, r) => a + (r.real ? r.lastCustomers || 0 : 0), 0));
  const bots = list.filter((r) => !r.real);
  const weights = bots.map((r) => 1 / r.price);
  const total = weights.reduce((a, w) => a + w, 0);
  let left = rest;
  const shares = new Map(bots.map((r, i) => {
    const c = i === bots.length - 1 ? left : Math.round((rest * weights[i]) / total);
    left -= c;
    return [r.id, c];
  }));
  // Real shops show their latest day; computer shops share out the rest of the market.
  const rivals = list.map((r) => ({
    id: r.id, name: r.name, real: r.real, price: r.price, won: 0,
    ...(r.real ? { customers: r.lastCustomers || 0, sales: r.lastSales || 0 } : { customers: shares.get(r.id), ticket: r.ticket }),
  }));
  return { size, mine, rivals, parts: att.parts };
}

// A customer who leaves without buying goes to a rival (the cheaper rival a bit more often).
function pickRival(s) {
  const list = s.today?.market?.rivals?.length ? s.today.market.rivals : RIVALS;
  const w = list.map((r) => 1 / (r.price || 1));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { x -= w[i]; if (x < 0) return list[i]; }
  return list[0];
}

function tagLost(s) {
  const t = s.today;
  const o = t.outcome;
  const r = t.queue[t.idx];
  if (!o || o.rival || !r || !t.market) return;
  const rival = pickRival(s);
  const name = CUST[r.cid].name;
  // The player's own unhappy line for this customer.
  if (CUST[r.cid].unhappy && !o.text.startsWith('"')) o.text = `"${CUST[r.cid].unhappy}" ${o.text}`;
  o.rival = rival.name;
  const m = t.market.rivals.find((x) => x.id === rival.id);
  if (m) m.won++;
  t.lostTo.push({ cid: r.cid, rival: rival.id });
  o.text = o.text.includes('another stall') || o.text.includes('next stall') || o.text.includes('somewhere cheaper') || o.text.includes('another shop')
    ? o.text.replace(/another stall|the next stall|somewhere cheaper|another shop/, rival.name)
    : `${o.text} ${name} went to ${rival.name}.`;
}

export function putAdvert(s) {
  const cost = ADVERT.cost[s.level] || ADVERT.cost[1];
  if (s.cash < cost) return `An advert costs ${fmt(cost)}. You have ${fmt(s.cash)}.`;
  if ((s.mods.advertUntil ?? 0) >= s.day) return 'Your advert is already up.';
  expense(s, cost, 'Advert at the shop front');
  s.mods.advertUntil = s.day + ADVERT.days - 1;
  // More customers today: add them to the queue now.
  const extra = Math.max(1, Math.round(s.today.queue.length * ADVERT.boost));
  for (let i = 0; i < extra; i++) s.today.queue.push(makeRequest(s, pick(Math.random, CUSTOMERS.filter((c) => c.type === 'regular' || c.type === 'bargainer')).id, Math.random));
  if (s.today.market) { s.today.market.mine += extra; s.today.market.size += extra; }
  return null;
}

function makeQueue(s, rng) {
  let [lo, hi] = isJunior(s) ? JUNIOR_CUSTOMERS : RULES.customersPerDay[s.level];
  if (s.mods.rush) { lo = Math.round(lo * 1.6); hi = Math.round(hi * 1.6); }
  if (venueOf(s)?.customers) { lo = Math.max(3, Math.round(lo * venueOf(s).customers)); hi = Math.max(lo, Math.round(hi * venueOf(s).customers)); }
  let n = randInt(rng, lo, hi);
  if (s.mods.fewer) { n = Math.max(3, n - s.mods.fewer); delete s.mods.fewer; }
  // Customers won from other players yesterday (up to 2 extra a day).
  if (s.mp?.pendingWins?.length) {
    const total = s.mp.pendingWins.reduce((a, w) => a + w.count, 0);
    for (const w of s.mp.pendingWins) s.today.notices.push(`You won ${w.count} customer${w.count > 1 ? 's' : ''} from ${w.from} yesterday.`);
    s.mp.pendingWins = [];
    n += Math.min(2, total);
  }
  s.today.market = planMarket(s, n, rng);
  n = s.today.market.mine;
  const available = (type) => CUSTOMERS.filter((c) => c.type === type && s.customers[c.id].skipUntil <= s.day).map((c) => c.id);
  const ids = [];
  const take = (type, count) => {
    const pool = available(type).filter((id) => !ids.includes(id));
    for (let i = 0; i < count && pool.length; i++) ids.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  };
  const junior = isJunior(s);
  if (rng() < (s.mods.rush ? 0.6 : venueOf(s)?.big ?? RULES.bigBuyerChance) && !junior) take('big', 1);
  take('credit', 1);
  take('bargainer', junior ? 1 : randInt(rng, 1, 2) + (venueOf(s)?.extraBargainers || 0));
  if (rng() < 0.5 && !junior) take('neverpays', 1);
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
  const favour = venueOf(s)?.favour || {};
  return pickWeighted(rng, goodsForLevel(s.level).filter((id) => !exclude.includes(id)).map((id) => [id, GOODS[id].weight * (favour[id] || 1)]));
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
  // Venues where people buy more at a time (wholesale, festive).
  const more = venueOf(s)?.qty;
  if (more) for (const it of items) it.qty = Math.max(1, Math.round(it.qty * more));
  let kind = 'cash';
  let frac = 1;
  if (type === 'regular' && rng() < 0.25) { kind = 'credit'; frac = 0.5; }
  if (type === 'credit' && rng() < 0.85) { kind = 'credit'; frac = 0.4 + rng() * 0.2; }
  if (type === 'neverpays') { kind = 'credit'; frac = rng() * 0.3; }
  if (type === 'big' && s.level >= 2 && rng() < 0.5) { kind = 'credit'; frac = 0.5; }
  if (type === 'bargainer') kind = 'discount';
  // Venues: everyone haggles in a bazaar; nobody does in a mall.
  const venue = venueOf(s);
  if (venue?.bargainAll && kind === 'cash' && rng() < venue.bargainAll) kind = 'discount';
  if (venue?.noBargain && kind === 'discount') kind = 'cash';
  if (kind === 'credit' && !creditAllowed(s)) { kind = 'cash'; frac = 1; }
  return { cid, items, kind, frac, disc: venueOf(s)?.smallDiscount ? 0.05 + rng() * 0.04 : 0.1 + rng() * 0.05, walkRoll: rng(), acceptRoll: rng(), moodRoll: rng(), changeRoll: rng(), fakeRoll: rng(), payRoll: rng() };
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
  const paysOf = (sum) => (r.kind === 'credit' ? Math.max(0, Math.min(sum - 100, Math.round((sum * r.frac) / 100) * 100)) : sum);
  const discOf = (sum) => {
    if (!isJunior(s)) return Math.round((sum * (1 - r.disc)) / 50) * 50;
    return Math.max(100, Math.min(sum - 100, Math.round((sum * (1 - r.disc)) / 100) * 100));
  };
  const paysNow = paysOf(total);
  const discTotal = discOf(total);
  // What the customer asks for in words: the goods they want, even if you don't have them all.
  const wantTotal = r.items.reduce((a, it) => a + it.qty * s.prices[it.item], 0);
  const said = { total: wantTotal, paysNow: paysOf(wantTotal), discTotal: discOf(wantTotal) };
  return {
    ...r, customer: c, items, missing, total, walks, paysNow, discTotal, said, rush: rushOrder(s, wanted),
    clock: clockFor(t.idx, t.queue.length), hour: hourFor(t.idx, t.queue.length), number: t.idx + 1, of: t.queue.length,
    method: payMethod(s, r),
  };
}

// Sending someone to the market for what's missing: normal price plus transport.
function rushOrder(s, wanted) {
  const items = wanted.filter((it) => it.have < it.qty)
    .map((it) => ({ item: it.item, qty: Math.max(RULES.rushMinQty, it.qty - it.have) }));
  if (!items.length) return null;
  const goods = items.reduce((a, it) => a + it.qty * buyPrice(s, it.item), 0);
  const fee = RULES.rushFee * (venueOf(s)?.rushFee || 1);
  return { items, goods, fee, cost: goods + fee };
}

// How this customer pays: cash, transfer or POS (old saves: cash).
function payMethod(s, r) {
  if (isJunior(s)) return 'cash';
  const venue = venueOf(s);
  if (venue?.cash != null && r.kind !== 'discount') {
    const roll = r.payRoll ?? 0;
    return roll < venue.cash ? 'cash' : roll < venue.cash + (1 - venue.cash) / 2 ? 'transfer' : 'pos';
  }
  const mix = RULES.payMix[s.level] || RULES.payMix[1];
  const roll = r.payRoll ?? 0;
  if (r.kind === 'discount' || roll < mix.cash) return 'cash';
  return roll < mix.cash + mix.transfer ? 'transfer' : 'pos';
}

function hourFor(idx, n) {
  return Math.floor((8 * 60 + Math.round((idx * 10 * 60) / Math.max(1, n))) / 60);
}

function clockFor(idx, n) {
  const mins = 8 * 60 + Math.round((idx * 10 * 60) / Math.max(1, n));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// action: sell | credit | cashonly | discount | fullprice | refuse | next
export function serve(s, action) {
  serveCustomer(s, action);
  tagLost(s);
}

function serveCustomer(s, action) {
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
  sale.method = sale.paid > 0 ? v.method : 'cash';
  if (sale.logId != null) s.sales[sale.logId].method = sale.method;
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
    : `${name} paid ${fmt(sale.paid)}${sale.method === 'transfer' ? ' by transfer' : sale.method === 'pos' ? ' by card' : ''}. Record the sale.` });
  s.phase = 'record';
  // Transfer or card: the payment steps come first.
  if (sale.method !== 'cash') {
    const provider = sale.method === 'transfer' ? s.payments.account : s.payments.pos;
    t.payment = { method: sale.method, provider, cid: v.cid, amount: sale.paid, step: 0 };
    s.phase = 'pay';
    return;
  }
  // Sometimes a cash customer pays with ₦1,000 notes and you count the change.
  const notes = Math.ceil(sale.total / 1000) * 1000;
  if (tiTiRecordsForYou(s)) {
    // First days of the learning path: tiTi records, so the player can watch how it's done.
    t.chat = [];
    markRecorded(s, sale, 'tiTi recorded this one for you. From Stage 2, you do it yourself.');
    return;
  }
  if (sale.paid === sale.total && notes > sale.total && !t.changeDone && (v.changeRoll ?? 1) < RULES.changeChance) {
    t.changeDone = true;
    t.change = { cid: v.cid, total: sale.total, handed: notes, due: notes - sale.total, given: [] };
    s.phase = 'change';
  }
  // Level 2: sometimes the cash needs checking for a fake note.
  if (s.phase === 'record' && s.level >= 2 && sale.paid === sale.total && sale.total >= 500 && !t.fakeDone
      && s.day - (s.lastFakeDay ?? -99) >= 2 && (v.fakeRoll ?? 1) < RULES.fakeChance * (venueOf(s)?.fake || 1)) {
    t.fakeDone = true;
    s.lastFakeDay = s.day;
    t.fake = { cid: v.cid, total: sale.total, ...makeNotes(sale.total) };
    if (s.skills?.eagleEye) t.fake.light = true;
    s.phase = 'fake';
  }
}

// ---------- Spot the fake note ----------

// 3 or 4 cartoon notes; maybe one fake, with a visible flaw. Under the light only real notes show
// the watermark and security thread.
export function makeNotes(total, rng = Math.random) {
  const count = total >= 2000 ? 4 : 3;
  const notes = Array.from({ length: count }, () => ({ value: rng() < 0.6 ? 1000 : 500, fake: false, flaw: null,
    serial: `${'ABCDEFGHJK'[Math.floor(rng() * 10)]}${'ABCDEFGHJK'[Math.floor(rng() * 10)]} ${String(Math.floor(rng() * 9000000) + 1000000)}` }));
  let fakeIdx = -1;
  if (rng() < RULES.fakeOdds) {
    fakeIdx = Math.floor(rng() * count);
    notes[fakeIdx].fake = true;
    notes[fakeIdx].flaw = ['colour', 'print', 'serial'][Math.floor(rng() * 3)];
  }
  return { notes, fakeIdx, light: false };
}

export function fakeLight(s) {
  if (s.today.fake) s.today.fake.light = true;
}

// pick: a note's index (that one is fake), -1 (all are real), 'skip' (tiTi checks), 'timeout'.
export function fakeDone(s, pick) {
  const t = s.today;
  const f = t.fake;
  if (!f) return;
  const name = CUST[f.cid].name;
  const fakeNote = f.notes[f.fakeIdx];
  const loseFake = () => expense(s, fakeNote.value, 'Fake note taken');
  let r;
  if (pick === 'skip') {
    r = { text: 'Thank you!', mood: 'happy', note: fakeNote ? `tiTi found a fake ${fmt(fakeNote.value)} note and ${name} changed it.` : 'tiTi checked: all the notes are real.' };
  } else if (pick === 'timeout') {
    unhappy(s);
    if (fakeNote) loseFake();
    r = { text: 'Why are you looking at my money so long? I have to go.', mood: 'sad', note: fakeNote ? `You took the money without checking. One ${fmt(fakeNote.value)} note was fake: lost.` : 'All the notes were real, but you were too slow.' };
  } else if (pick === -1) {
    if (fakeNote) {
      loseFake();
      r = { text: 'Thank you!', mood: 'happy', note: `One ${fmt(fakeNote.value)} note was fake, and you took it. ${fmt(fakeNote.value)} lost.` };
      r.mood = 'neutral';
      r.bad = true;
    } else {
      s.stats.goodChecks++;
      r = { text: 'Thank you. You check your money well!', mood: 'happy', note: 'Right: all the notes were real.' };
    }
  } else if (pick === f.fakeIdx) {
    s.stats.goodChecks++;
    r = { text: "Ah, sorry! I didn't know. Take this one.", mood: 'happy', note: `You spotted the fake ${fmt(fakeNote.value)} note. No loss.` };
  } else {
    unhappy(s);
    changeLoyalty(s, f.cid, -1);
    if (fakeNote) loseFake();
    r = { text: "You're calling me a thief? That note is real!", mood: 'sad', note: fakeNote ? `That note was real, and you missed the fake one: ${fmt(fakeNote.value)} lost.` : 'That note was real. All the notes were real.' };
  }
  t.reaction = { cid: f.cid, text: r.text, mood: r.bad ? 'sad' : r.mood, note: r.note };
  t.fake = null;
  s.phase = 'record';
}

// ---------- Market run ----------

// Run to the market yourself: goods at the normal price, no transport fee, but the customer is waiting.
export const isInjured = (s) => (s.injuredUntil ?? 0) >= s.day;

export function startRun(s) {
  const v = currentCustomer(s);
  const r = v?.rush;
  if (!r || s.cash < r.goods || isInjured(s)) return;
  s.today.flash = null;
  s.today.run = { cid: v.cid, items: r.items };
  s.phase = 'run';
}

// got: { item: caught }. You keep what you caught; if it's not all, the customer has gone.
export function runDone(s, got, opts = {}) {
  runFinished(s, got, opts);
  tagLost(s);
}

function runFinished(s, got, { injured = false, by = 'bicycle' } = {}) {
  const t = s.today;
  const run = t.run;
  if (!run) return;
  const name = CUST[run.cid].name;
  if (injured) {
    // The goods drop, the customer can't wait, and you need to get to hospital.
    t.run = null;
    t.injury = { cid: run.cid, by: by === 'okada' ? 'An okada' : 'A bicycle' };
    s.phase = 'injury';
    return;
  }
  const bought = [];
  let all = true;
  for (const it of run.items) {
    const q = Math.min(it.qty, Math.max(0, Math.floor(Number(got?.[it.item]) || 0)));
    if (q < it.qty) all = false;
    if (q && !buyStock(s, it.item, q)) bought.push({ item: it.item, qty: q });
  }
  t.run = null;
  s.phase = 'selling';
  if (all) {
    t.flash = `You ran to the market and back with ${describeItems(bought)}. No transport fee! ${name} waited.`;
    return;
  }
  if (!isJunior(s)) {
    changeLoyalty(s, run.cid, -1);
    unhappy(s);
  }
  t.outcome = { text: `You came back with ${bought.length ? describeItems(bought) : 'nothing'}, not enough. ${name} got tired of waiting and left.`, tone: 'bad' };
}

// How the hospital bill and the ride would be paid: your pocket first (it's personal), then the
// business cash, and anything left becomes a hospital debt.
export function hospitalSplit(s, rideId) {
  const ride = HOSPITAL.rides.find((r) => r.id === rideId);
  if (!ride) return null;
  const total = ride.cost + HOSPITAL.bill;
  const pocket = Math.min(s.pocket, total);
  const business = Math.min(Math.max(0, s.cash), total - pocket);
  return { ride, total, pocket, business, debt: total - pocket - business };
}

export function chooseHospital(s, rideId) {
  const t = s.today;
  const inj = t.injury;
  const sp = hospitalSplit(s, rideId);
  if (!inj || !sp) return;
  s.pocket -= sp.pocket;
  s.cash -= sp.business;
  const label = `Hospital: ${sp.ride.name.toLowerCase()} and bill`;
  if (sp.pocket) t.personal.push({ label, amount: sp.pocket, from: 'pocket' });
  if (sp.business) t.personal.push({ label, amount: sp.business, from: 'business' });
  if (sp.debt) s.bills.push({ id: s.nextBillId++, kind: 'hospital', label: 'Hospital debt', amount: sp.debt, due: s.day + HOSPITAL.debtDays, late: 0 });
  s.injuredUntil = s.day + sp.ride.heal - 1;
  t.injured = { ride: sp.ride.name, heal: sp.ride.heal, ...sp };
  t.injury = null;
  s.phase = 'selling';
  const name = CUST[inj.cid].name;
  t.outcome = {
    text: `You went to hospital by ${sp.ride.name.toLowerCase()} (${fmt(sp.total)} with the bill). ${name} could not wait and left. Your leg heals in ${sp.ride.heal} days.${sp.debt ? ` You couldn't pay ${fmt(sp.debt)}: it's now a hospital debt, due on Day ${s.day + HOSPITAL.debtDays}.` : ''}`,
    tone: 'bad',
  };
  tagLost(s);
}

// Changed your mind: send the boy after all (normal ₦300 transport).
export function runSendBoy(s) {
  s.today.run = null;
  s.phase = 'selling';
  serve(s, 'restock');
}

// ---------- Count the change ----------

// Junior prices are in hundreds, so no small notes are needed.
export const changeNotes = (s) => (isJunior(s) ? RULES.changeNotes.filter((n) => n >= 100) : RULES.changeNotes);

export function changeTap(s, note) {
  const c = s.today.change;
  if (c && changeNotes(s).includes(note) && c.given.length < 20) c.given.push(note);
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
    // The customer demands the balance before leaving.
    unhappy(s);
    c.demand = c.due - given;
    return;
  } else {
    // Too much: the customer is happy and starts to leave; you can ask for the extra back.
    c.extra = given - c.due;
    return;
  }
  t.reaction = { cid: c.cid, ...r };
  t.change = null;
  s.phase = 'record';
}

// Too much change given: ask for the extra back (honest customers usually return it).
export function changeAskBack(s, rng = Math.random) {
  const t = s.today;
  const c = t.change;
  if (!c?.extra) return;
  const never = CUST[c.cid].type === 'neverpays';
  const back = rng() < (never ? RULES.extraBack.neverpays : RULES.extraBack.honest);
  if (back) {
    t.reaction = { cid: c.cid, text: `Ah, sorry! Here's your ${fmt(c.extra)}.`, mood: 'happy', note: `You asked politely and got your ${fmt(c.extra)} back.` };
  } else {
    expense(s, c.extra, 'Too much change given');
    t.reaction = { cid: c.cid, text: "I didn't see any extra o!", mood: 'sad', note: `${fmt(c.extra)} lost. Count before you give: getting money back is harder than giving the right change.` };
  }
  t.change = null;
  s.phase = 'record';
}

// Or let it go: the money is lost, but the customer likes your shop a bit more.
export function changeLetGo(s) {
  const t = s.today;
  const c = t.change;
  if (!c?.extra) return;
  expense(s, c.extra, 'Too much change given');
  changeLoyalty(s, c.cid, 1);
  t.reaction = { cid: c.cid, text: 'Thank you o! God bless you.', mood: 'happy', note: `You let ${fmt(c.extra)} go. ${CUST[c.cid].name} likes your shop more.` };
  t.change = null;
  s.phase = 'record';
}

// After short-changing: give the customer the balance from the till.
export function changeBalance(s) {
  const t = s.today;
  const c = t.change;
  if (!c?.demand) return;
  t.balances = [...(t.balances || []), { cid: c.cid, amount: c.demand }];
  t.reaction = { cid: c.cid, text: 'Hmm. Next time, count my change well.', mood: 'sad', note: `You gave ${fmt(c.demand)} balance from the till. Count carefully: short change makes customers angry.` };
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
      msg += ` Word is spreading: "that shop never has ${nm}". ${away.map((c) => CUST[c.id].name).join(' and ')} will buy elsewhere for a few days.`;
    }
  }
  return msg;
}

// What the customer says after a sale. The line rotates so the same words don't repeat every time.
function reactionFor(v, said, sale, due, note) {
  const type = v.customer.type;
  const key = said === 'credit' && type === 'neverpays' ? 'creditNeverpays' : said === 'sell' && type === 'big' ? 'big' : said;
  const lines = REACTIONS[key] || REACTIONS.sell;
  let line = lines[(v.number + Math.floor(sale.total / 50)) % lines.length].replace('{due}', due);
  // The player's own happy line, mixed in with the usual ones.
  if (CUST[v.cid].happy && mood(said) === 'happy' && v.number % 2 === 0) line = CUST[v.cid].happy;
  const text = v.missing.length ? `You don't have enough? OK, I'll take what you have. ${line}` : line;
  return { cid: v.cid, text, mood: mood(said), note };
}

const mood = (said) => (said === 'fullprice' || said === 'cashonly' ? 'neutral' : 'happy');

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
  markRecorded(s, sale);
}

// The sale goes into the records (typed to tiTi, or automatically with CreditVoice).
// Junior records by tapping: the right line plus two that are wrong.
export function recordChoices(s) {
  const t = s.today;
  const sale = t.pending;
  if (!sale) return [];
  const name = sale.cid ? CUST[sale.cid].name : null;
  const owes = sale.total - sale.paid;
  const line = (items, paid, due) => `Sold ${describeItems(items)}${name ? ` to ${name}` : ''}. Paid ${fmt(paid)}.${due > 0 ? ` Owes ${fmt(due)}.` : ''}`;
  const oneMore = sale.items.map((it, i) => (i === 0 ? { ...it, qty: it.qty + 1 } : it));
  const wrong = owes > 0
    ? [line(sale.items, sale.total, 0), line(oneMore, sale.paid, owes)]
    : [line(sale.items, sale.paid + 200, 0), line(oneMore, sale.paid, 0)];
  const at = (s.day * 7 + t.idx) % 3;
  const texts = [...wrong];
  texts.splice(at, 0, line(sale.items, sale.paid, owes));
  return texts.map((text, i) => ({ text, right: i === at }));
}

export function recordTap(s, index) {
  const t = s.today;
  const sale = t.pending;
  if (!sale || sale.recorded) return;
  const choice = recordChoices(s)[index];
  if (!choice) return;
  if (choice.right) markRecorded(s, sale);
  else t.chat.push({ from: 'titi', text: 'Not quite. Look again at what was sold and what was paid.' });
}

function markRecorded(s, sale, auto = null) {
  const t = s.today;
  const name = sale.cid ? CUST[sale.cid].name : null;
  sale.recorded = true;
  if (sale.logId != null && s.sales[sale.logId]) s.sales[sale.logId].recorded = true;
  // The recording score only counts sales the player had to record themselves.
  if (!auto) {
    const w = sale.total > sale.paid ? 2 : 1;
    s.stats.recW += w;
    s.stats.totW += w;
  }
  t.recordedSales++;
  if (auto) t.autoRecorded = (t.autoRecorded || 0) + 1;
  else if (sale.total > sale.paid) t.creditRecorded = (t.creditRecorded || 0) + 1;
  const debt = sale.debtId ? debtById(s, sale.debtId) : null;
  if (debt) debt.recorded = true;
  t.chat.push({ from: 'titi', auto, card: { name, what: sale.items, listTotal: sale.listTotal, discount: sale.discount, total: sale.total, paid: sale.paid, owes: sale.total - sale.paid, due: debt?.due, method: sale.method } });
}

// ---------- Transfer and POS ----------

// Transfer: give account → customer sends → check account. POS: enter amount → card approved.
export function payNext(s) {
  const t = s.today;
  const p = t.payment;
  if (!p) return;
  p.step++;
  const last = p.method === 'transfer' ? 2 : 1;
  if (p.step <= last) return;
  const sale = t.pending;
  t.payment = null;
  s.phase = 'record';
  if (tiTiRecordsForYou(s) && p.provider !== 'creditvoice') {
    t.chat = [];
    markRecorded(s, sale, 'tiTi recorded this one for you. From Stage 2, you do it yourself.');
    return;
  }
  if (p.provider === 'creditvoice') {
    t.chat = [];
    markRecorded(s, sale, p.method === 'transfer' ? 'CreditVoice recorded this transfer for you automatically.' : 'CreditVoice POS recorded this sale for you automatically.');
    return;
  }
  if (!t.recommended && Math.random() < RULES.recommendChance) {
    t.recommended = true;
    t.chat.push({ from: 'titi', text: `Tip: with a ${p.method === 'transfer' ? 'CreditVoice account' : 'CreditVoice POS'}, I record ${p.method === 'transfer' ? 'transfers' : 'card sales'} for you automatically, no typing. Set it in Settings → Payments.` });
  }
}

export function setPayments(s, change) {
  const p = s.payments;
  if (change.account && PAYMENTS.accounts[change.account]) p.account = change.account;
  if (change.pos && PAYMENTS.pos[change.pos]) p.pos = change.pos;
  if (change.accountNumber != null) {
    const digits = String(change.accountNumber).replace(/\D/g, '').slice(0, 10);
    if (digits.length !== 10) return 'An account number has 10 digits.';
    p.accountNumber = digits;
  }
  return null;
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
  t.queueNote = null;
  nextStep(s);
}

function nextStep(s, rng = Math.random) {
  const t = s.today;
  // An offer the player wanted to think about comes back once.
  if (t.retryEvent && t.idx >= t.retryEvent.at && t.idx < t.queue.length) {
    const { id, ctx } = t.retryEvent;
    t.retryEvent = null;
    t.event = { id, ctx, outcome: null, note: EVENT_BY_ID[id].note || null };
    s.phase = 'event';
    return;
  }
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
  arrive(s, rng);
  s.phase = 'selling';
}

// When a customer reaches the front, they may ask for something you're running low on.
function arrive(s, rng = Math.random) {
  const r = s.today.queue[s.today.idx];
  if (!r || r.arrived) return;
  r.arrived = true;
  if (CUST[r.cid].type === 'big') return;
  const low = goodsForLevel(s.level).filter((id) => s.stock[id] >= 1 && s.stock[id] <= 2 && !r.items.some((it) => it.item === id));
  if (low.length && rng() < RULES.lowStockAsk) {
    const item = pick(rng, low);
    r.items[0] = { item, qty: randInt(rng, ...GOODS[item].qty) };
  }
}

// The waiting line: customers behind the one you're serving.
export const waiting = (s) => Math.max(0, s.today.queue.length - s.today.idx - 1);

// Too slow: the last person in the line leaves for a rival.
export function queueLeave(s) {
  if (s.today.helper) return false; // a helper keeps the queue moving
  const t = s.today;
  if (!['selling', 'record', 'change', 'fake', 'pay'].includes(s.phase) || waiting(s) < 1) return null;
  const r = t.queue.pop();
  const rival = pickRival(s);
  const m = t.market?.rivals.find((x) => x.id === rival.id);
  if (m) m.won++;
  t.lostTo.push({ cid: r.cid, rival: rival.id, waited: true });
  t.queueNote = `${CUST[r.cid].name} got tired of waiting and went to ${rival.name}.`;
  return t.queueNote;
}

export function eventView(s) {
  const ev = s.today.event;
  const def = EVENT_BY_ID[ev.id];
  return {
    id: ev.id, icon: def.icon, title: def.title(s, ev.ctx), text: def.text(s, ev.ctx),
    choices: ev.outcome ? [] : def.choices(s, ev.ctx), outcome: ev.outcome, timed: !!def.timed && !ev.outcome && !isJunior(s),
  };
}

// Too slow on a cheap offer: a rival takes it.
export function eventTimeout(s, rng = Math.random) {
  const ev = s.today.event;
  const def = ev && EVENT_BY_ID[ev.id];
  if (!def?.timed || ev.outcome) return;
  const name = rivalGrab(s, rng, def.grab);
  ev.outcome = `Too slow! ${name} took the ${def.grab.what}.${def.grab.fake ? ' Let\'s see how that goes for them.' : ' Good deals don\'t wait.'}`;
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
    if (isJunior(s)) {
      // The lesson, kept simple: written down gets paid, not written down gets forgotten.
      if (d.recorded) debtPaid(s, d, { onTime: onDue });
      else debtLost(s, d);
      continue;
    }
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

  // Venue costs of the night: lights at a night market, damp on a floating market.
  const venue = venueOf(s);
  if (venue?.nightly) expense(s, venue.nightly.amount, venue.nightly.label);
  if (venue?.damp && s.stock[venue.damp.item] > 0 && rng() < venue.damp.chance) waste(s, venue.damp.item, 1, 'damp from the river');

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
  // Some evenings: one quick question about your shop.
  const levelDays = s.history.filter((h) => h.level === s.level).length;
  t.quick = !t.levelUp && levelDays >= 2 && rng() < RULES.quickQuestionChance ? makeQuiz(s, 'quick', rng) : null;

  t.tip = pickTip(s);
  t.noteKey = isGuided(s) ? (t.event?.note && !s.seen['note_' + t.event.note] ? t.event.note : NOTE_ORDER.find((k) => !s.seen['note_' + k])) : null;
  if (t.noteKey) s.seen['note_' + t.noteKey] = true;
  t.levelUp = !s.completed && !(s.maxLevel && s.level >= s.maxLevel) && levelGoalMet(s);
  t.stageDone = finishStageDay(s);
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
    profit: clamp(s.levelProfit / levelGoal(s).goalProfit, 0, 1),
    // Family needs paid from your own pay count for you; taking from the business counts against.
    money: (st.pocketPays + st.billsPaid + 1.2) / (st.pocketPays + st.billsPaid + st.capitalTakes + st.billsLateDays + 2),
    // Complaints, refused trusted customers and refusals count against; good sales for.
    customers: clamp((st.served + st.changeRight + st.goodChecks - 2 * st.unhappy + 4) / (st.served + st.changeRight + st.goodChecks + 5), 0, 1),
  };
}

function targetScore(s) {
  const p = scoreParts(s);
  const w = RULES.weights;
  return Math.round(100 * Object.keys(w).reduce((a, k) => a + w[k] * p[k], 0));
}

// What this level asks for. Junior asks for less, because there are fewer customers.
export function levelGoal(s) {
  const L = LEVELS[s.level];
  return isJunior(s) ? { ...L, ...(JUNIOR_GOALS[s.level] || {}) } : L;
}

export function levelGoalMet(s) {
  const L = levelGoal(s);
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
  if (t.injured) return `Running to the market yourself saves ₦${RULES.rushFee}, but your injury cost ${fmt(t.injured.total)}. Sometimes it's worth paying to send someone. Savings in your pocket help when emergencies come.`;
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
