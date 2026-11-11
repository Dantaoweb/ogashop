// Market venues for championship shops, borrowed from real markets. Each changes the look and a few rules.
// Only championship shops have a venue; a player's own shop is the classic market.
export const VENUES = {
  classic: {
    name: 'Classic market', inspired: 'The usual Oga Shop market',
    about: 'The market you know from your own shop.',
  },
  open: {
    name: 'Open-air market', inspired: 'Balogun, Onitsha, Kumasi',
    about: 'A big crowd: more customers and more bargainers, more fake notes, a shorter queue temper, mostly cash. Rain hurts more.',
    customers: 1.4, extraBargainers: 1, fake: 1.5, cash: 0.8, queue: 0.75, rain: 3,
  },
  mall: {
    name: 'Shopping mall', inspired: 'Ikeja City Mall, Dubai Mall',
    about: 'Indoors: fewer customers who accept prices about 12% higher, no bargaining, mostly card and transfer, no rain, double rent.',
    customers: 0.75, prices: 1.12, noBargain: true, cash: 0.2, noRain: true, rent: 2,
  },
  bazaar: {
    name: 'Grand bazaar', inspired: 'Istanbul, Marrakech',
    about: 'Almost every customer bargains, but they ask for smaller discounts, so a good price keeps more profit.',
    bargainAll: 0.7, smallDiscount: true,
  },
  night: {
    name: 'Night market', inspired: 'Taipei, Lagos night stalls',
    about: 'A short, fast evening: fewer customers and an impatient queue who pay 10% more. Water, drinks and noodles sell more, and lighting costs ₦200 a night.',
    customers: 0.85, queue: 0.6, prices: 1.1, favour: { water: 2, drinks: 3, noodles: 2 }, nightly: { amount: 200, label: 'Lantern and generator fuel' },
  },
  floating: {
    name: 'Floating market', inspired: 'Bangkok, Makoko',
    about: 'You trade from a boat: goods cost 5% more to bring in (customers pay 5% more too), sending for goods costs double, rain comes more often and hits harder, and damp can spoil a cup of garri at night.',
    buy: 1.05, prices: 1.05, rushFee: 2, rainMore: 2, rain: 3, damp: { item: 'garri', chance: 0.2 },
  },
  wholesale: {
    name: 'Wholesale market', inspired: 'Alaba, Dawanu, Kano',
    about: 'Big buyers come often and everyone buys in bulk, but prices are lower: small profit on each item, big volume.',
    customers: 0.9, big: 0.7, qty: 2, prices: 0.9, buy: 0.95,
  },
  festive: {
    name: 'Festive market', inspired: 'Christmas and Sallah markets',
    about: 'The rush: a quarter more customers, each buying more, but suppliers charge 8% more, so each sale earns a bit less, and goods run out fast.',
    customers: 1.3, qty: 1.2, prices: 1.03, buy: 1.08,
  },
};
export const VENUE_IDS = Object.keys(VENUES);

// The venue rules for a shop, or null for the classic market.
export const venueOf = (s) => (s?.venue && s.venue !== 'classic' ? VENUES[s.venue] || null : null);
