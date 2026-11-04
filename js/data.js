// Game content for Stage 1 (Levels 1–2). Source of truth: CONTENT.md.
// Prices are estimates to check with traders; numbers marked (tune) in CONTENT.md live here.

export const CREDITVOICE_URL = 'https://creditvoiceai.com/?utm_source=ogashop&utm_medium=game';

export const START_CASH = 20000;
export const START_STOCK = { rice: 5, garri: 10, water: 4, recharge: 10 };
export const SUPPLIER_CREDIT_LIMIT = 15000;
// How customers pay. CreditVoice is the default: with it, tiTi records transfer and POS sales automatically.
export const PAYMENTS = {
  accounts: { creditvoice: 'CreditVoice account', otherbank: 'Another bank' },
  pos: { creditvoice: 'CreditVoice POS', otherpos: 'Another POS' },
  defaultAccountNumber: '0081234567',
};
// Broken leg in Market run: how you get to hospital, and the hospital bill (tune).
export const HOSPITAL = {
  bill: 10000,
  debtDays: 3,
  rides: [
    { id: 'horse', name: 'Horse', cost: 2000, heal: 5 },
    { id: 'keke', name: 'Keke', cost: 3000, heal: 4 },
    { id: 'taxi', name: 'Taxi', cost: 6000, heal: 3 },
    { id: 'ambulance', name: 'Ambulance', cost: 15000, heal: 2 },
  ],
};
// Rival shops in your market (computer-run for now; real players need a server, later).
// price: how their prices compare with the market price; ticket: average sale per customer.
export const RIVALS = [
  { id: 'emeka', name: 'Emeka Stores', price: 1.0, ticket: { 1: 2200, 2: 2800 } },
  { id: 'basira', name: "Iya Basira's Stall", price: 0.95, ticket: { 1: 1800, 2: 2400 } },
];
export const ADVERT = { cost: { 1: 1000, 2: 2000 }, days: 2, boost: 0.35 };
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
  customersPerDay: { 1: [5, 6], 2: [6, 8] },
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
  // Count the change: chance a cash sale is paid with ₦1,000 notes that need change (once a day at most).
  runSeconds: 20,
  injuryChance: 1 / 3, // hitting a bicycle or okada in Market run
  // The waiting line: while you're busy, the last person leaves for a rival every so many seconds.
  queueWaitSeconds: 10, queueWaitSecondsLearning: 20, queueRecordFactor: 2,
  lowStockAsk: 0.3, // chance an arriving customer asks for something you're running low on (1 or 2 left)
  // Share of customers paying by cash / transfer / POS (the rest).
  payMix: { 1: { cash: 0.6, transfer: 0.3 }, 2: { cash: 0.45, transfer: 0.3 } },
  recommendChance: 0.5, // with another bank or POS, how often tiTi suggests CreditVoice (once a day at most)
  quickQuestionChance: 0.35, // some evenings ask one question about your shop
  changeChance: 0.35,
  extraBack: { honest: 0.85, neverpays: 0.25 }, // chance a customer returns extra change when asked
  changeSeconds: 15,
  changeNotes: [500, 200, 100, 50],
  // Spot the fake note (Level 2): at most every 2 days, a cash sale may be paid in notes to check.
  fakeChance: 0.4,
  fakeSeconds: 15,
  fakeOdds: 0.65, // chance one of the notes really is fake
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

// Lesson questions for the end-of-level quiz. The first option is the right one (options are shuffled).
export const LESSON_QUESTIONS = [
  { text: 'You sold goods worth ₦10,000. They cost you ₦8,000. What is your profit?', options: ['₦2,000', '₦10,000', '₦8,000', '₦18,000'],
    explain: 'Profit is what you sold for minus what the goods cost: ₦10,000 − ₦8,000 = ₦2,000.' },
  { text: 'Why should you record every credit sale?', options: ['So nobody forgets what is owed', 'To make customers happy', 'Only big sales need recording', 'It is not needed'],
    explain: 'Unrecorded credit is easy to forget, for you and the customer. A record is what gets you paid.' },
  { text: 'Is the cash in your hand the same as your profit?', options: ['No: part of it paid for your stock', 'Yes, always', 'Only on busy days', 'Only in the evening'],
    explain: 'Cash includes money that only paid back what your goods cost. Profit is what is left after that.' },
  { text: 'Your family needs money. Where should it come from?', options: ['Your own pay (your pocket)', 'The business money', 'Your stock money', 'Money saved for rent'],
    explain: 'Pay yourself a fixed amount and spend from that. The business money is for stock and bills.' },
  { text: 'A bill is due in 3 days. What should you do when you buy stock?', options: ['Keep enough cash aside for the bill', 'Spend it all on stock', 'Wait until the bill is late', 'Give credit to everyone'],
    explain: 'Plan your cash, not just your stock. Late bills cost more every day.' },
];

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
    recurring: [{ id: 'rent', label: 'Shop rent', amount: 8000, every: 7, first: 5 }],
    oneOff: [{ id: 'nepa', label: 'NEPA bill', amount: 2500, day: 3 }, { id: 'repair', label: 'Padlock and door repair', amount: 2000, day: 6 }],
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
  1: { name: 'The Table', goalProfit: 11000, goalScore: 68,
       blurb: 'A small market table. Learn cash vs profit, and record every sale.' },
  2: { name: 'The Shop', goalProfit: 7000, goalScore: 70, maxLateDays: 7,
       blurb: 'A small shop. Restock on time, give credit carefully and get your debts back.' },
};

// All 7 levels from the PRD. Stage 1 plays levels 1 and 2; the rest are shown as coming soon.
export const ALL_LEVELS = [
  { n: 1, name: 'The Table', size: 'A small market table, ₦20,000 to start', learn: 'Cash vs profit, and record every sale.', feature: 'Recording sales with tiTi', playable: true },
  { n: 2, name: 'The Shop', size: 'A small shop', learn: 'Restocking, credit and chasing debts, rent and bills.', feature: 'Stock, debts and reminders', playable: true },
  { n: 3, name: 'Bigger Shop', size: 'A shop with staff', learn: 'Hiring, honest staff, expenses, pricing and margins.', feature: 'Staff accounts, expenses, profit reports', playable: false },
  { n: 4, name: 'Branches', size: 'A second and third branch', learn: 'Trusting others to run a branch, comparing branches.', feature: 'Branches and permissions', playable: false },
  { n: 5, name: 'Money to Grow', size: 'Loans and partners', learn: 'Loans for a freezer or generator, your business score, investors.', feature: 'Business scorecard, financing, partners', playable: false },
  { n: 6, name: 'Big Business', size: 'Wholesale or supermarket', learn: 'Invoices, quotations, suppliers and purchase orders, VAT.', feature: 'Invoices, quotations, purchase orders, VAT', playable: false },
  { n: 7, name: 'Enterprise', size: 'A mall or a chain', learn: 'Systems, data and growing big.', feature: 'Enterprise plan', playable: false },
];

export const BADGES = {
  first_sale:      { name: 'First sale',        desc: 'Made your first sale.' },
  record_keeper:   { name: 'Record keeper',     desc: 'Recorded every sale in a day.' },
  fully_stocked:   { name: 'Fully stocked',     desc: 'A whole day without running out.' },
  never_lost_debt: { name: 'Never lost a debt', desc: 'Got 3 debts back and lost none.' },
  debt_free_week:  { name: 'Debt-free week',    desc: '7 days in a row with no late debts.' },
  goal_reached:    { name: 'Goal reached',      desc: 'Saved up and bought your goal.' },
  money_checker:   { name: 'Eagle eye',         desc: 'Passed the Money check challenge.' },
  fast_runner:     { name: 'Fast runner',       desc: 'Passed the Road safety challenge.' },
  change_master:   { name: 'Change master',     desc: 'Passed the Change master challenge.' },
  know_business:   { name: 'Know your business', desc: '4 out of 5 or better in an end-of-level quiz.' },
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
