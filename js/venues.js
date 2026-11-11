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
    about: 'Indoors: fewer customers who accept higher prices, no bargaining, mostly card and transfer, no rain, double rent.',
    customers: 0.8, prices: 1.25, noBargain: true, cash: 0.2, noRain: true, rent: 2,
  },
  bazaar: {
    name: 'Grand bazaar', inspired: 'Istanbul, Marrakech',
    about: 'Almost every customer bargains, but they ask for smaller discounts, so a good price keeps more profit.',
    bargainAll: 0.7, smallDiscount: true,
  },
};
export const VENUE_IDS = Object.keys(VENUES);

// The venue rules for a shop, or null for the classic market.
export const venueOf = (s) => (s?.venue && s.venue !== 'classic' ? VENUES[s.venue] || null : null);
