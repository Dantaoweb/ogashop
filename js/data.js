// Game content for Stage 1 (Levels 1–2). Source of truth: CONTENT.md.
// Prices are estimates to check with traders; numbers marked (tune) in CONTENT.md live here.

export const CREDITVOICE_URL = 'https://creditvoiceai.com/?utm_source=ogashop&utm_medium=game';

export const START_CASH = 20000;
export const START_STOCK = { rice: 5, garri: 10, water: 4, recharge: 10 };
export const SUPPLIER_CREDIT_LIMIT = 15000;
export const SUPPLIER_CREDIT_DAYS = 3;

export const GOODS = {
  rice:     { name: 'Rice',          short: 'Rice',     unit: 'paint bucket', level: 1, buy: 2000, sell: 2500, weight: 3, qty: [1, 2], aliases: ['rice'] },
  garri:    { name: 'Garri',         short: 'Garri',    unit: 'cup',          level: 1, buy: 400,  sell: 550,  weight: 3, qty: [1, 4], aliases: ['garri', 'gari'] },
  water:    { name: 'Sachet water',  short: 'Water',    unit: 'bag',          level: 1, buy: 350,  sell: 500,  weight: 3, qty: [1, 3], aliases: ['sachet water', 'pure water', 'water'] },
  recharge: { name: 'Recharge card', short: 'Recharge', unit: '₦500 card',    level: 1, buy: 480,  sell: 500,  weight: 2, qty: [1, 3], aliases: ['recharge cards', 'recharge card', 'recharge', 'airtime', 'cards', 'card'] },
  noodles:  { name: 'Noodles',       short: 'Noodles',  unit: 'pack',         level: 2, buy: 250,  sell: 320,  weight: 2, qty: [1, 4], aliases: ['noodles', 'noodle', 'indomie'] },
  bread:    { name: 'Bread',         short: 'Bread',    unit: 'loaf',         level: 2, buy: 900,  sell: 1200, weight: 2, qty: [1, 2], shelfLife: 3, aliases: ['bread', 'loaves', 'loaf'] },
  drinks:   { name: 'Soft drinks',   short: 'Drinks',   unit: 'bottle',       level: 2, buy: 300,  sell: 400,  weight: 2, qty: [1, 3], aliases: ['soft drinks', 'soft drink', 'drinks', 'drink', 'minerals', 'mineral'] },
  palmoil:  { name: 'Palm oil',      short: 'Palm oil', unit: 'bottle',       level: 2, buy: 1300, sell: 1700, weight: 1, qty: [1, 2], aliases: ['palm oil', 'oil'] },
};

// type: regular | bargainer | credit | neverpays | big
export const CUSTOMERS = [
  { id: 'mamabola',   name: 'Mama Bola',    type: 'regular',   she: true },
  { id: 'mrade',      name: 'Mr Ade',       type: 'regular' },
  { id: 'unclesule',  name: 'Uncle Sule',   type: 'regular' },
  { id: 'ngozi',      name: 'Ngozi',        type: 'regular',   she: true },
  { id: 'musa',       name: 'Musa',         type: 'regular' },
  { id: 'aisha',      name: 'Aisha',        type: 'bargainer', she: true },
  { id: 'babakunle',  name: 'Baba Kunle',   type: 'bargainer' },
  { id: 'iyatunde',   name: 'Iya Tunde',    type: 'credit',    she: true },
  { id: 'mrokon',     name: 'Mr Okon',      type: 'credit' },
  { id: 'chidi',      name: 'Chidi',        type: 'neverpays' },
  { id: 'pastorfemi', name: 'Pastor Femi',  type: 'big' },
  { id: 'madamcaro',  name: 'Madam Caro',   type: 'big',       she: true },
];

export const TYPE_LABEL = {
  regular: 'Regular',
  bargainer: 'Bargainer',
  credit: 'Asks for credit',
  neverpays: 'Asks for credit',
  big: 'Big buyer',
};

// (tune) Behaviour rules — CONTENT.md section 2.
export const RULES = {
  customersPerDay: { 1: [6, 8], 2: [8, 10] },
  bigBuyerChance: 0.2,
  creditDueDays: 2,
  forgetUnrecorded: { normal: 0.4, neverpays: 0.9 },
  forgetUnrecordedLate: 0.3,
  payOnDue: { recorded: 0.6, reminded: 0.85, neverpays: 0.15, neverpaysReminded: 0.25 },
  payLate: { normal: 0.35, reminded: 0.6, neverpays: 0.08, neverpaysReminded: 0.18 },
  writeOffAfterLateDays: 10,
  acceptCashOnly: { regular: 0.7, credit: 0.4, neverpays: 0.25, big: 0.5, bargainer: 0.7 },
  acceptFullPrice: 0.5,
  scoreMaxStep: 6,
};

export const LEVELS = {
  1: { name: 'The Table', goalProfit: 30000, goalScore: 65,
       blurb: 'A small market table. Learn cash vs profit, and record every sale.' },
  2: { name: 'The Shop', goalProfit: 45000, goalScore: 70, maxLateDays: 7,
       blurb: 'A small shop. Restock on time, give credit carefully and get your debts back.' },
};

export const BADGES = {
  first_sale:      { name: 'First sale',        desc: 'Made your first sale.' },
  record_keeper:   { name: 'Record keeper',     desc: 'Recorded every sale in a day.' },
  fully_stocked:   { name: 'Fully stocked',     desc: 'A whole day without running out.' },
  never_lost_debt: { name: 'Never lost a debt', desc: 'Got 3 debts back and lost none.' },
  debt_free_week:  { name: 'Debt-free week',    desc: '7 days in a row with no late debts.' },
};

// "Did you know?" notes — learning path only. CONTENT.md section 5.
export const NOTES = {
  cashprofit: 'Cash is all the money in your hand. Profit is what is left after you take away what your goods cost.',
  margin: 'If you buy rice for ₦2,000 and sell for ₦2,500, your margin is ₦500 for each bucket.',
  record: 'A sale you don\'t write down is easy to forget, for you and for your customer.',
  credit: 'Selling on credit means the customer takes the goods now and pays later. It can grow sales, but only if you get paid.',
  reminders: 'A short, polite reminder on the due day is the easiest way to get your money back.',
  stock: 'Too little stock loses sales. Too much ties up your cash or goes bad.',
  personal: 'Pay yourself a fixed amount. Don\'t take from the till whenever you need money.',
  supplier: 'Supplier credit lets you buy now and pay later. It is a debt too: pay it on time to keep their trust.',
};

export const NOTE_ORDER = ['cashprofit', 'record', 'margin', 'credit', 'stock', 'personal', 'reminders', 'supplier'];

// tiTi explains a new idea the first time it comes up (learning path).
export const EXPLAIN = {
  morning: 'Good morning! This is your table. Cash is the money in your hand. Profit is what you keep after paying for your goods. Watch both.',
  credit: 'This customer wants credit: goods now, money later. Credit brings more sales, but only if you get paid. If you give credit, record it so nobody forgets.',
  record: 'After every sale, tell me what happened in a short message. I\'ll keep the record. A sale you don\'t record is easy to forget.',
  discount: 'A discount means less profit on that sale. Check your buy price first: never sell below what you paid.',
  event: 'Things happen in business. There is no wrong answer here, but each choice has a cost.',
  level2: 'You have a shop now! New goods, supplier credit, and reminders for people who owe you. Bread goes bad after 3 days, so buy it in small amounts.',
};
