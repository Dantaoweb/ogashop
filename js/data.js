// Game content for Stage 1 (Levels 1–2). Source of truth: CONTENT.md.
// Prices are estimates to check with traders; numbers marked (tune) in CONTENT.md live here.

export const CREDITVOICE_URL = 'https://creditvoiceai.com/?utm_source=ogashop&utm_medium=game';

export const START_CASH = 20000;
export const START_STOCK = { rice: 5, garri: 10, water: 4, recharge: 10 };
export const SUPPLIER_CREDIT_LIMIT = 15000;
export const START_PAY = 1000; // daily pay the player gives themselves; they can change it
export const PAY_STEP = 500;
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
  // Business score weights (sum to 1). CONTENT.md section 7.
  weights: { recording: 0.32, debts: 0.20, stock: 0.15, profit: 0.17, money: 0.07, customers: 0.09 },
  // Raising a price during the day: chance a later buyer of that item complains.
  complainChance: { regular: 1, other: 0.6 },
  complainChanceEvent: { regular: 0.5, other: 0.3 }, // milder when your supplier's price went up
  overpayWarnDays: 3,
  // Sending for stock in the middle of the day: normal price plus transport, at least this many units.
  billNoticeDays: 3,
  billLateFee: 500,
  rushFee: 300,
  rushMinQty: 3,
  // Customers asking for something you don't have: warn at 2, word spreads at 3.
  asksWarn: 2,
  asksWordSpreads: 3,
  wordSpreadFewerCustomers: 2,
  wordSpreadRegularsAway: 2,
};

// Things to save for, at real Nigerian prices (estimates to check). Small ones are reachable in Stage 1.
export const GOALS = [
  { id: 'fees', name: 'School fees for one term', price: 40000 },
  { id: 'phone', name: 'Smartphone', price: 90000 },
  { id: 'sewing', name: 'Sewing machine', price: 120000 },
  { id: 'okada', name: 'Motorcycle (okada)', price: 1200000 },
  { id: 'land', name: 'Plot of land', price: 5000000 },
  { id: 'keke', name: 'Keke (tricycle)', price: 5000000 },
  { id: 'car', name: 'Car (used)', price: 9000000 },
  { id: 'bus', name: 'Bus', price: 25000000 },
  { id: 'house', name: 'House', price: 35000000 },
];

// Big bills (tune). first/day count from the level's first day; announced RULES.billNoticeDays ahead.
export const BILLS = {
  1: { recurring: [{ id: 'stall', label: 'Market stall fee', amount: 3000, every: 7, first: 5 }], oneOff: [] },
  2: {
    recurring: [{ id: 'rent', label: 'Shop rent', amount: 8000, every: 7, first: 7 }],
    oneOff: [{ id: 'nepa', label: 'NEPA bill', amount: 2500, day: 4 }, { id: 'repair', label: 'Padlock and door repair', amount: 2000, day: 10 }],
  },
};

// Family needs that come up during the day. Paid from your pocket (good) or the business money (capital).
export const FAMILY_NEEDS = [
  { who: 'Your sister', what: 'school fees', amount: 3000 },
  { who: 'Your mother', what: 'hospital bill', amount: 2500 },
  { who: 'Your brother', what: 'transport to Lagos', amount: 1500 },
  { who: 'Your aunty', what: 'naming ceremony', amount: 2000 },
  { who: 'Your landlord', what: 'part of the house rent', amount: 3000 },
  { who: 'Your church or mosque', what: 'a contribution', amount: 1000 },
];

export const LEVELS = {
  1: { name: 'The Table', goalProfit: 13000, goalScore: 68,
       blurb: 'A small market table. Learn cash vs profit, and record every sale.' },
  2: { name: 'The Shop', goalProfit: 28000, goalScore: 70, maxLateDays: 7,
       blurb: 'A small shop. Restock on time, give credit carefully and get your debts back.' },
};

export const BADGES = {
  first_sale:      { name: 'First sale',        desc: 'Made your first sale.' },
  record_keeper:   { name: 'Record keeper',     desc: 'Recorded every sale in a day.' },
  fully_stocked:   { name: 'Fully stocked',     desc: 'A whole day without running out.' },
  never_lost_debt: { name: 'Never lost a debt', desc: 'Got 3 debts back and lost none.' },
  debt_free_week:  { name: 'Debt-free week',    desc: '7 days in a row with no late debts.' },
  goal_reached:    { name: 'Goal reached',      desc: 'Saved up and bought your goal.' },
};

// What customers say after a sale. {due} becomes the day credit is due.
export const REACTIONS = {
  sell: ['Thank you!', 'Thank you, see you tomorrow.', 'Nice doing business with you.'],
  big: ['The party will be sweet. Thank you!', 'Good! Everything is ready now. Thank you.'],
  discount: ['Ah, thank you o! I\'ll come back tomorrow.', 'You\'re a good person. I\'ll tell my neighbours.', 'Thank you! Your shop is the best.'],
  bargainDiscount: ['Ehen! Thank you, my friend.', 'Thank you! You see, we can do business.', 'Good! Next time reduce it more, eh?'],
  fullprice: ['Hmm… OK, take it.', 'You\'re a hard seller! Here.', 'OK o. Next time, reduce it for me.'],
  cashonly: ['OK, here\'s your money.', 'Fine, I\'ll pay it all now.'],
  credit: ['God bless you! I\'ll bring the rest on Day {due}.', 'Thank you! I\'ll pay on Day {due}, I promise.'],
  creditNeverpays: ['Thank you, my friend! I\'ll pay… soon.', 'You\'re too kind. Don\'t worry, I\'ll pay.'],
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
  pay: 'Set your daily pay: the amount you take for yourself at the end of each day. Family needs come out of your pocket, not the business money.',
  personal: 'Personal money is not a business cost. It makes your cash go down, but not your profit. That\'s why it\'s listed apart from expenses.',
  level2: 'You have a shop now! New goods, supplier credit, and reminders for people who owe you. Bread goes bad after 3 days, so buy it in small amounts.',
};
