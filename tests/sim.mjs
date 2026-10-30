// Plays many games with simple bots to check pacing and that good habits win.
// Run: node tests/sim.mjs
import { GOODS } from '../js/data.js';
import * as E from '../js/engine.js';
import { CUST } from '../js/core.js';
import { suggestMessage } from '../js/parser.js';

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// habits: { record: 0..1, remind: bool, credit: bool, restock: bool }
export function play(seed, habits, maxDays = 60) {
  const rng = mulberry32(seed);
  const realRandom = Math.random;
  Math.random = rng; // engine's internal steps use Math.random by default
  try {
    const s = E.newGame('business', rng);
    let l1Day = null;
    while (s.day <= maxDays) {
      // Morning: restock toward a target, remind debts due today.
      if (habits.restock) {
        for (const id of E.goodsForLevel(s.level)) {
          const target = { rice: 6, garri: 10, water: 8, recharge: 8, noodles: 8, bread: 3, drinks: 8, palmoil: 4 }[id];
          const need = target - s.stock[id];
          if (need > 0) E.buy(s, id, Math.min(need, Math.floor(s.cash / E.buyPrice(s, id))));
        }
      }
      if (habits.remind) for (const d of E.openDebts(s)) if (d.due <= s.day) E.remind(s, d.id);
      E.openShop(s);
      let guard = 0;
      while (s.phase !== 'evening' && guard++ < 200) {
        if (s.phase === 'selling') {
          const v = E.currentCustomer(s);
          if (s.today.outcome) { E.serve(s, 'next'); continue; }
          if (!v.items.length || v.walks) { E.serve(s, 'sell'); continue; }
          const type = v.customer.type;
          if (v.kind === 'credit') E.serve(s, habits.credit && type !== 'neverpays' ? 'credit' : 'cashonly');
          else E.serve(s, 'sell');
        } else if (s.phase === 'record') {
          const sale = s.today.pending;
          if (rng() < habits.record) E.titiMessage(s, suggestMessage(sale, sale.cid ? CUST[sale.cid].name : null));
          E.skipRecord(s);
        } else if (s.phase === 'event') {
          const v = E.eventView(s);
          const i = v.choices.findIndex((c) => !c.disabled);
          E.chooseEvent(s, i, rng);
          E.continueAfterEvent(s, rng);
        }
      }
      if (s.today.levelUp) {
        if (s.level === 1) l1Day = s.day;
        else return { l1Day, l2Day: s.day, s };
        E.levelUp(s);
      }
      E.startDay(s, rng);
    }
    return { l1Day, l2Day: null, s };
  } finally {
    Math.random = realRandom;
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('sim.mjs')) {
  const profiles = {
    good: { record: 1, remind: true, credit: true, restock: true },
    noRecord: { record: 0, remind: false, credit: true, restock: true },
    halfRecord: { record: 0.5, remind: false, credit: true, restock: true },
    noRestock: { record: 1, remind: true, credit: true, restock: false },
  };
  for (const [name, h] of Object.entries(profiles)) {
    const runs = Array.from({ length: 40 }, (_, i) => play(1000 + i, h));
    const l1 = runs.map((r) => r.l1Day).filter(Boolean);
    const l2 = runs.map((r) => r.l2Day).filter(Boolean);
    const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-');
    const score = avg(runs.map((r) => r.s.score));
    console.log(`${name.padEnd(11)} L1 done ${String(l1.length).padStart(2)}/40 avg day ${avg(l1).padStart(5)} | L2 done ${String(l2.length).padStart(2)}/40 avg day ${avg(l2).padStart(5)} | final score ${score}`);
  }
}
