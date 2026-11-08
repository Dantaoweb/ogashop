// Junior way to play (ages 8–12): the same game made gentler. Round numbers, no timers, simpler words.

export const isJunior = (s) => s?.path === 'junior';
// Paths where tiTi explains things and nothing is timed.
export const isGuided = (s) => s?.path === 'learning' || isJunior(s);

// Round prices, so the sums are easy.
export const JUNIOR_PRICES = {
  rice: { buy: 2000, sell: 2500 },
  garri: { buy: 400, sell: 600 },
  water: { buy: 300, sell: 500 },
  recharge: { buy: 400, sell: 500 },
  noodles: { buy: 200, sell: 300 },
  bread: { buy: 800, sell: 1000 },
  drinks: { buy: 300, sell: 400 },
  palmoil: { buy: 1200, sell: 1600 },
};

export const JUNIOR_CUSTOMERS = [3, 4];
export const JUNIOR_RUN_SECONDS = 40;
export const JUNIOR_PAY = 500;
export const JUNIOR_PRICE_STEP = 100;

// Smaller stage goals, to match fewer customers. level -> stage -> changes to the goal.
export const JUNIOR_STAGE_GOALS = {
  1: {
    0: { n: 4, text: 'Serve 4 customers' },
    1: { n: 3, text: 'Record 3 sales yourself' },
    2: { n: 1000, text: 'Make ₦1,000 profit' },
  },
  2: { 1: { n: 1, text: 'Give credit and record it' } },
};

// Goals that make a level take about 7 days with fewer customers (checked with the pacing sim).
export const JUNIOR_GOALS = { 1: { goalProfit: 8000, goalScore: 60 }, 2: { goalProfit: 5500, goalScore: 62 } };

// One small bill per level. No late fees.
export const JUNIOR_BILLS = {
  1: { recurring: [{ id: 'stall', label: 'Market table fee', amount: 1000, every: 7, first: 5 }], oneOff: [] },
  2: { recurring: [{ id: 'rent', label: 'Shop rent', amount: 2000, every: 7, first: 5 }], oneOff: [] },
};

// Events left out for children.
export const JUNIOR_NO_EVENTS = new Set(['missing', 'fake_noodles', 'nepa', 'relocate', 'big_party', 'bulk_offer', 'neighbour']);

// Which family needs can come up: school fees, transport, naming ceremony, a contribution.
export const JUNIOR_FAMILY = [0, 2, 3, 5];

export const EXPLAIN_JUNIOR = {
  morning: "Welcome! This is your table. Cash is the money you have. Profit is the extra you made after paying for your goods.",
  credit: "This customer wants to pay later. That is called credit. Write it down, so nobody forgets!",
  record: 'After each sale, tap the one that says what really happened. That is how we keep good records.',
  discount: 'A discount means a lower price. You make less money on that sale.',
  event: 'Something happened! Pick what you think is best.',
  level2: 'You have a shop now! There are new things to sell. Bread goes bad after 3 days, so buy just a little.',
  pay: 'This is your pay. Each evening it goes in your pocket. Your pocket is your own money.',
  personal: 'Money you take for yourself is not a cost of the shop. Your cash goes down, but your profit stays the same.',
};

export const NOTES_JUNIOR = {
  cashprofit: 'Cash is the money in your hand. Profit is what is left after you pay for your goods.',
  margin: 'If you buy something for ₦400 and sell it for ₦600, you made ₦200.',
  record: 'If you write down every sale, you never forget.',
  credit: 'Credit means "take it now, pay later". Always write it down.',
  reminders: 'A kind reminder helps people remember to pay.',
  stock: 'If you run out, people go to another shop. If you buy too much, your money is stuck.',
  personal: 'Shop money is for the shop. Your pocket money is for you.',
  supplier: 'If you buy now and pay later, remember to pay on time.',
};
