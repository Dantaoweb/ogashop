// The event deck — CONTENT.md section 3.
// eligible(s) returns a plain context object (saved with the game) or null.
// choices(s, ctx) returns buttons; run(s, ctx, rng) applies the choice and returns tiTi's outcome text.
import { GOODS, FAMILY_NEEDS } from './data.js';
import {
  CUST, fmt, pick, randInt, buyPrice, refPrice, setMarket, expense, waste, buyStock,
  supplierCreditError, applySale, openDebts, debtPaid, debtLost, changeLoyalty, personal,
} from './core.js';

const remaining = (s) => s.today.queue.length - s.today.idx;

// Remove customers from the end of today's queue.
function fewerCustomers(s, n) {
  const cut = Math.min(n, Math.max(0, remaining(s) - 1));
  s.today.queue.splice(s.today.queue.length - cut, cut);
  return cut;
}

const firstName = (cid) => CUST[cid].name;
const pron = (cid) => (CUST[cid].she ? 'she' : 'he');
const obj = (cid) => (CUST[cid].she ? 'her' : 'him');

function buyChoices(s, label, items, extraSub = '') {
  const total = items.reduce((a, [item, qty]) => a + qty * buyPrice(s, item), 0);
  const out = [{
    label: `${label} (cash)`,
    sub: `${fmt(total)} now${extraSub}`,
    disabled: s.cash < total ? `You have ${fmt(s.cash)}.` : null,
    run: (st) => {
      for (const [item, qty] of items) buyStock(st, item, qty);
      return `You bought it for ${fmt(total)} cash.`;
    },
  }];
  if (s.level >= 2) {
    out.push({
      label: `${label} (supplier credit)`,
      sub: `Pay ${fmt(total)} in 3 days`,
      disabled: supplierCreditError(s, total),
      run: (st) => {
        for (const [item, qty] of items) buyStock(st, item, qty, { credit: true });
        return `Bought on supplier credit. You owe your supplier ${fmt(total)} in 3 days.`;
      },
    });
  }
  return out;
}

export const EVENTS = [
  {
    id: 'price_rise', levels: [1, 2], once: true, icon: 'trend',
    eligible: () => ({}),
    title: () => 'Rice price goes up',
    text: (s) => `Your supplier calls: a bucket of rice now costs ${fmt(buyPrice(s, 'rice') + 300)}, up from ${fmt(buyPrice(s, 'rice'))}. Your next restock will cost more.`,
    choices: (s) => {
      const newBuy = buyPrice(s, 'rice') + 300;
      const raised = s.prices.rice + 300;
      return [
        { label: `Raise my price to ${fmt(raised)}`, sub: `Profit per bucket stays ${fmt(raised - newBuy)}. Some bargainers may walk away.`,
          run: (st) => { setMarket(st, 'rice', { buy: 300, sell: 150 }); st.prices.rice = raised; st.today.eventRaised.rice = true; return `Rice now sells at ${fmt(raised)}.`; } },
        { label: `Keep ${fmt(s.prices.rice)} for now`, sub: `Profit per bucket falls to ${fmt(s.prices.rice - newBuy)} after restock.`,
          run: (st) => { setMarket(st, 'rice', { buy: 300, sell: 150 }); return 'Price kept. Remember: new stock costs more, so each sale earns less.'; } },
      ];
    },
    note: 'margin',
  },
  {
    id: 'family', levels: [1, 2], icon: 'person',
    // The first one is always the sister's school fees; after that, any family need.
    eligible: (s) => {
      // Not on Day 1: the player's pocket only fills after the first evening.
      if (s.day < 2 || s.today.moneyIn < 1000) return null;
      const seen = s.eventLog.family;
      return { need: seen ? Math.floor((s.day * 7 + s.today.idx) % FAMILY_NEEDS.length) : 0 };
    },
    title: (s, ctx) => `${FAMILY_NEEDS[ctx.need].who} needs money`,
    text: (s, ctx) => { const n = FAMILY_NEEDS[ctx.need]; return `${n.who} asks you for ${fmt(n.amount)} for ${n.what}.`; },
    choices: (s, ctx) => {
      const n = FAMILY_NEEDS[ctx.need];
      const label = `${n.who.replace('Your ', '')}: ${n.what}`;
      const cap = label[0].toUpperCase() + label.slice(1);
      return [
        { label: `Pay from my pocket (${fmt(n.amount)})`, sub: `You have ${fmt(s.pocket)} from your own pay.`,
          disabled: s.pocket < n.amount ? `Your pocket has only ${fmt(s.pocket)}. Your daily pay goes in each evening.` : null,
          run: (st) => { personal(st, n.amount, cap, 'pocket'); return `Paid from your own pay. The business money is safe for restocking.`; } },
        { label: 'Take it from the business money', sub: `Cash for stock goes down by ${fmt(n.amount)}.`,
          run: (st) => { personal(st, n.amount, cap, 'business'); return `You took ${fmt(n.amount)} from the business money. That money was meant for restocking.`; } },
        { label: 'Not today', sub: 'Explain that it has to wait.',
          run: () => 'OK. Family needs are real: that is why you pay yourself a fixed amount every day.' },
      ];
    },
    note: 'personal',
  },
  {
    id: 'rain', levels: [1, 2], icon: 'rain',
    eligible: (s) => (remaining(s) >= 3 ? {} : null),
    title: () => 'Heavy rain',
    text: (s) => `Rain all afternoon. Fewer customers will come.${s.stock.garri >= 2 ? ' Your garri is open to the rain.' : ''}`,
    choices: (s) => [
      { label: 'Cover the garri with nylon', sub: 'Costs ₦300.',
        run: (st) => { const n = fewerCustomers(st, 2); expense(st, 300, 'Nylon cover'); return `Garri kept dry. ${n} customers stayed home.`; } },
      { label: 'Leave it', sub: s.stock.garri >= 2 ? '2 cups may get damp.' : 'Nothing to cover.',
        run: (st) => { const n = fewerCustomers(st, 2); const lost = waste(st, 'garri', 2, 'damp in the rain'); return lost ? `${lost} cups of garri got damp and can't be sold. ${n} customers stayed home.` : `${n} customers stayed home.`; } },
    ],
    note: 'stock',
  },
  {
    id: 'hot_day', levels: [1, 2], icon: 'sun',
    eligible: (s) => (remaining(s) >= 3 ? {} : null),
    title: () => 'Very hot day',
    text: () => 'The sun is strong. Everyone wants sachet water.',
    choices: (s) => [
      ...buyChoices(s, 'Buy 5 more bags', [['water', 5]]),
      { label: 'Sell what I have', sub: `You have ${s.stock.water} bags.`, run: () => 'OK. Let\'s see if it lasts.' },
    ].map((c) => ({ ...c, run: (st, ctx, rng) => {
      const msg = c.run(st, ctx, rng);
      for (const r of st.today.queue.slice(st.today.idx)) {
        if (CUST[r.cid].type !== 'big' && rng() < 0.6) r.items = [{ item: 'water', qty: randInt(rng, 2, 3) }];
      }
      return msg;
    } })),
    note: 'stock',
  },
  {
    id: 'levy', levels: [1, 2], icon: 'receipt',
    eligible: (s) => (remaining(s) >= 2 ? {} : null),
    title: () => 'Market levy',
    text: () => 'The council collector asks for the ₦500 daily levy.',
    choices: () => [
      { label: 'Pay ₦500', sub: 'A running cost of the business.', run: (st) => { expense(st, 500, 'Market levy'); return 'Paid. Running costs come off your profit, so tiTi records them too.'; } },
      { label: 'Argue with him', sub: 'Takes time. A customer may leave.', run: (st) => { fewerCustomers(st, 1); expense(st, 500, 'Market levy'); return 'You argued for 20 minutes and still paid. One customer got tired of waiting and left.'; } },
    ],
  },
  {
    id: 'paid_already', levels: [1, 2], icon: 'person',
    eligible: (s) => {
      const d = openDebts(s).find((x) => ['regular', 'credit'].includes(CUST[x.cid].type) && x.created < s.day);
      return d ? { debtId: d.id } : null;
    },
    title: () => '"I paid you already"',
    text: (s, ctx) => { const d = s.debts.find((x) => x.id === ctx.debtId); return `${firstName(d.cid)} says ${pron(d.cid)} already paid the ${fmt(d.amount)} ${pron(d.cid)} owed you.`; },
    choices: (s, ctx) => {
      const d = s.debts.find((x) => x.id === ctx.debtId);
      return [
        { label: 'Check my records', sub: 'Ask tiTi.',
          run: (st) => {
            const dd = st.debts.find((x) => x.id === ctx.debtId);
            if (dd.recorded) { debtPaid(st, dd); return `tiTi shows the sale: ${dd.what}, ${fmt(dd.amount)} still owed. ${firstName(dd.cid)} looks again and pays.`; }
            debtLost(st, dd); return `There is no record. You can't show ${obj(dd.cid)} anything, so you lose ${fmt(dd.amount)}.`;
          } },
        { label: `Accept ${obj(d.cid)} word`, sub: 'Keep the peace.', run: (st) => { const dd = st.debts.find((x) => x.id === ctx.debtId); debtLost(st, dd); return `You lose ${fmt(dd.amount)}.`; } },
      ];
    },
    note: 'record',
  },
  {
    id: 'bulk_offer', levels: [1, 2], icon: 'box',
    eligible: () => ({}),
    title: () => 'Supplier bulk offer',
    text: (s) => `Your supplier offers 10 buckets of rice at ${fmt(buyPrice(s, 'rice') - 200)} each, ${fmt(200)} cheaper than usual.`,
    choices: (s) => {
      const unit = buyPrice(s, 'rice') - 200;
      const total = unit * 10;
      const out = [{ label: `Take the deal (${fmt(total)} cash)`, sub: 'Cheaper stock, but your cash is tied up.', disabled: s.cash < total ? `You have ${fmt(s.cash)}.` : null,
        run: (st) => { buyStock(st, 'rice', 10, { unitCost: unit }); return `You have ${st.stock.rice} buckets of rice now. Sell them before you need the cash.`; } }];
      if (s.level >= 2) out.push({ label: 'Take it on supplier credit', sub: `Pay ${fmt(total)} in 3 days.`, disabled: supplierCreditError(s, total),
        run: (st) => { buyStock(st, 'rice', 10, { unitCost: unit, credit: true }); return `Bought on credit. You owe ${fmt(total)} in 3 days.`; } });
      out.push({ label: 'Buy only what I need', sub: 'Keep your cash free.', run: () => 'Cash kept free. Cheap stock is only good if you can sell it soon.' });
      return out;
    },
    note: 'stock',
  },
  {
    id: 'neighbour', levels: [1, 2], icon: 'store',
    eligible: (s) => (s.market.garri?.days ? null : {}),
    title: () => 'Neighbour cuts prices',
    text: (s) => `The stall next to you sells garri at ${fmt(refPrice(s, 'garri') - 50)} a cup.`,
    choices: (s) => {
      const match = refPrice(s, 'garri') - 50;
      return [
        { label: `Match ${fmt(match)}`, sub: `Profit per cup: ${fmt(match - s.cost.garri)}.`, run: (st) => { setMarket(st, 'garri', { sell: -50, days: 3 }); st.prices.garri = match; return `Garri now sells at ${fmt(match)}.`; } },
        { label: `Keep ${fmt(s.prices.garri)}, give better service`, sub: 'Some customers may go next door.', run: (st) => { setMarket(st, 'garri', { sell: -50, days: 3 }); return 'Price kept. Friendly service keeps regulars, but bargainers may leave.'; } },
      ];
    },
    note: 'margin',
  },
  {
    id: 'festive', levels: [2], icon: 'star',
    eligible: (s) => (s.mods.rush ? null : {}),
    title: () => 'Festive rush coming',
    text: () => 'The festive season starts tomorrow. For 2 days, expect many more customers.',
    choices: (s) => [
      ...buyChoices(s, 'Stock up now', [['rice', 5], ['water', 5], ['drinks', 5]], ' · 5 rice, 5 water, 5 drinks'),
      { label: 'Keep normal stock', sub: 'Save your cash.', run: () => 'OK. Watch your stock tomorrow.' },
    ].map((c) => ({ ...c, run: (st, ctx, rng) => { st.mods.rush = 2; return c.run(st, ctx, rng); } })),
    note: 'stock',
  },
  {
    id: 'nepa', levels: [2], icon: 'bolt',
    eligible: (s) => (s.stock.drinks > 0 ? {} : null),
    title: () => 'NEPA took light',
    text: () => 'No power for 2 days. Your soft drinks are getting warm.',
    choices: (s) => [
      { label: 'Pay to cool drinks at the neighbour\'s generator', sub: '₦1,000 a day for 2 days.',
        run: (st) => { expense(st, 1000, 'Cooling drinks'); st.mods.coolingDays = 1; return 'Drinks stay cold. ₦1,000 today and ₦1,000 tomorrow.'; } },
      { label: `Sell warm drinks at ${fmt(s.prices.drinks - 50)}`, sub: 'Less profit per bottle.',
        run: (st) => { setMarket(st, 'drinks', { sell: -50, days: 2 }); st.prices.drinks -= 50; return `Warm drinks now sell at ${fmt(st.prices.drinks)}. Raise the price again when light comes back.`; } },
    ],
  },
  {
    id: 'bread_expiry', levels: [2], icon: 'clock',
    eligible: (s) => {
      const qty = s.batches.filter((b) => b.item === 'bread' && b.exp === s.day + 1).reduce((a, b) => a + b.qty, 0);
      return qty >= 2 ? { qty } : null;
    },
    title: () => 'Bread close to expiry',
    text: (s, ctx) => `${ctx.qty} loaves of bread go bad tomorrow.`,
    choices: (s, ctx) => {
      const price = Math.round(s.cost.bread / 50) * 50;
      return [
        { label: `Sell them today at ${fmt(price)}`, sub: 'No profit, but no loss.',
          run: (st) => { const qty = Math.min(ctx.qty, st.stock.bread); applySale(st, null, [{ item: 'bread', qty, price }], qty * price, { recorded: true }); return `Sold ${qty} loaves at ${fmt(price)}. Next time, buy bread in smaller amounts.`; } },
        { label: 'Keep full price', sub: 'Unsold loaves are thrown away tomorrow.', run: () => 'OK. Any loaves left tomorrow night go in the bin.' },
      ];
    },
    note: 'stock',
  },
  {
    id: 'fake_noodles', levels: [2], once: true, icon: 'alert',
    eligible: () => ({}),
    title: () => 'Very cheap noodles',
    text: () => 'A seller you don\'t know offers noodles at ₦150 a pack. That\'s much cheaper than your supplier.',
    choices: (s) => [
      { label: 'Buy 20 packs for ₦3,000', sub: 'Big profit if they\'re real.', disabled: s.cash < 3000 ? `You have ${fmt(s.cash)}.` : null,
        run: (st) => { buyStock(st, 'noodles', 20, { unitCost: 150 }); st.mods.fakeNoodles = 20; return 'You bought 20 packs. Let\'s see how customers like them.'; } },
      { label: 'No, thank you', sub: 'Stick with your supplier.', run: () => 'Good call. Very cheap stock from a stranger is a risk.' },
    ],
  },
  {
    id: 'relocate', levels: [2], icon: 'truck',
    eligible: (s) => {
      const d = openDebts(s).find((x) => ['credit', 'regular'].includes(CUST[x.cid].type));
      return d ? { debtId: d.id } : null;
    },
    title: (s, ctx) => `${firstName(s.debts.find((x) => x.id === ctx.debtId).cid)} is moving away`,
    text: (s, ctx) => { const d = s.debts.find((x) => x.id === ctx.debtId); return `${firstName(d.cid)} is moving to Abuja this week. ${pron(d.cid)[0].toUpperCase() + pron(d.cid).slice(1)} owes you money.`; },
    choices: (s, ctx) => [
      { label: 'Remind them today', sub: 'Use your records.',
        run: (st, c, rng) => {
          const d = st.debts.find((x) => x.id === ctx.debtId);
          if (!d.recorded) { debtLost(st, d); return `You have no record of how much ${pron(d.cid)} owes. ${firstName(d.cid)} says "I'll send it" and leaves. ${fmt(d.amount)} lost.`; }
          if (rng() < 0.7) { debtPaid(st, d); return `You showed ${obj(d.cid)} the record. ${firstName(d.cid)} paid ${fmt(d.amount)} before leaving.`; }
          debtLost(st, d); return `${firstName(d.cid)} left without paying. You tried. ${fmt(d.amount)} lost.`;
        } },
      { label: 'Do nothing', sub: 'Hope they pay.', run: (st) => { const d = st.debts.find((x) => x.id === ctx.debtId); debtLost(st, d); return `${firstName(d.cid)} left. ${fmt(d.amount)} lost.`; } },
    ],
    note: 'reminders',
  },
  {
    id: 'missing', levels: [2], icon: 'search',
    eligible: (s) => {
      if (s.day - s.levelStartDay < 3) return null;
      const item = ['rice', 'palmoil', 'garri'].find((i) => s.stock[i] >= 3);
      return item ? { item } : null;
    },
    title: () => 'Stock goes missing',
    text: (s, ctx) => `You count your stock: 3 ${GOODS[ctx.item].short.toLowerCase()} are missing.`,
    choices: () => [
      { label: 'Check against my records', sub: 'tiTi compares sales with stock.',
        run: (st, ctx) => {
          const rate = st.stats.totW ? st.stats.recW / st.stats.totW : 0;
          if (rate >= 0.8) return 'tiTi shows exactly what was sold. The 3 missing were taken by the boy who "helps" at the shop. He brings them back.';
          waste(st, ctx.item, 3, 'missing');
          return 'Too many sales were not recorded, so you can\'t tell what was sold and what was taken. The loss stays.';
        } },
      { label: 'Forget it', sub: 'Maybe you counted wrong.', run: (st, ctx) => { waste(st, ctx.item, 3, 'missing'); return 'The 3 are gone. Good records would have shown what happened.'; } },
    ],
    note: 'record',
  },
  {
    id: 'big_party', levels: [2], once: true, icon: 'bag',
    eligible: () => ({}),
    title: () => 'Big order for a wedding',
    text: (s) => `Madam Caro wants 10 rice and 10 palm oil for a wedding: ${fmt(10 * s.prices.rice + 10 * s.prices.palmoil)}. She'll pay ${fmt(20000)} now and the rest after the event.`,
    choices: (s) => {
      const total = 10 * s.prices.rice + 10 * s.prices.palmoil;
      const need = [['rice', Math.max(0, 10 - s.stock.rice)], ['palmoil', Math.max(0, 10 - s.stock.palmoil)]].filter(([, q]) => q > 0);
      const needCost = need.reduce((a, [i, q]) => a + q * buyPrice(s, i), 0);
      const canBuy = needCost === 0 || s.cash >= needCost || !supplierCreditError(s, needCost);
      const restock = (st) => {
        if (!needCost) return '';
        const credit = st.cash < needCost;
        for (const [i, q] of need) buyStock(st, i, q, { credit });
        return `You bought the missing stock (${fmt(needCost)}${credit ? ' on supplier credit' : ''}). `;
      };
      const items = (st) => [{ item: 'rice', qty: 10, price: st.prices.rice }, { item: 'palmoil', qty: 10, price: st.prices.palmoil }];
      return [
        { label: 'Accept and record it with a due date', sub: `${fmt(20000)} now, ${fmt(total - 20000)} in 3 days.`, disabled: canBuy ? null : 'Not enough stock or cash.',
          run: (st) => { const pre = restock(st); applySale(st, 'madamcaro', items(st), 20000, { recorded: true, dueDays: 3 }); st.today.recordedSales++; st.stats.recW += 2; st.stats.totW += 2; return `${pre}Recorded: Madam Caro owes ${fmt(total - 20000)}, due in 3 days.`; } },
        { label: 'Ask for full payment', sub: 'She may go elsewhere.', disabled: canBuy ? null : 'Not enough stock or cash.',
          run: (st, c, rng) => {
            if (rng() < 0.5) { const pre = restock(st); applySale(st, 'madamcaro', items(st), total, { recorded: true }); st.today.recordedSales++; st.stats.recW += 1; st.stats.totW += 1; return `${pre}She agreed and paid ${fmt(total)} in full!`; }
            return 'She went to another shop.';
          } },
        { label: 'Refuse', sub: 'Too big for now.', run: () => 'You said no. Big orders need stock and cash ready.' },
      ];
    },
    note: 'credit',
  },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// Always shown once in Level 1, when they become possible.
export const MUST_SEE = { 1: ['family', 'paid_already'] };

export function drawEvent(s, rng) {
  const recent = (id) => s.eventLog[id] && s.day - s.eventLog[id] < 3;
  const ok = (e) => e.levels.includes(s.level) && !recent(e.id) && !(e.once && s.eventLog[e.id]);
  for (const id of MUST_SEE[s.level] || []) {
    const e = EVENT_BY_ID[id];
    if (ok(e)) { const ctx = e.eligible(s); if (ctx) return { id, ctx }; }
  }
  const pool = EVENTS.filter(ok).map((e) => ({ e, ctx: e.eligible(s) })).filter((x) => x.ctx);
  if (!pool.length) return null;
  // Level 2 leans toward its own events.
  const weighted = pool.flatMap((x) => (s.level === 2 && !x.e.levels.includes(1) ? [x, x] : [x]));
  const { e, ctx } = pick(rng, weighted);
  return { id: e.id, ctx };
}

// Effects that carry into the next morning.
export function morningEffects(s) {
  const notes = [];
  if (s.mods.fakeNoodles) {
    const lost = waste(s, 'noodles', s.mods.fakeNoodles, 'fake, returned');
    delete s.mods.fakeNoodles;
    for (const cid of ['mamabola', 'ngozi']) changeLoyalty(s, cid, -1);
    notes.push(`The cheap noodles were fake. Customers brought back ${lost} packs, and two regulars are upset.`);
  }
  if (s.mods.coolingDays) {
    expense(s, 1000, 'Cooling drinks');
    s.mods.coolingDays--;
    if (!s.mods.coolingDays) delete s.mods.coolingDays;
    notes.push('Paid ₦1,000 to keep drinks cold.');
  }
  return notes;
}
