// tiTi reads short sale messages, the CreditVoice way:
//   "sold 2 rice to Mama Bola 5000, paid 3000"
//   "sold 3 garri 1650 cash"
//   "sold 5 rice and 4 water to Pastor Femi 14500"
import { GOODS } from './data.js';

const UNIT_WORDS = '(?:buckets?|cups?|bags?|packs?|bottles?|loaves|loaf|cards?|pieces?|pcs)';
const TITLES = new Set(['mama', 'mr', 'mrs', 'iya', 'baba', 'uncle', 'aunty', 'auntie', 'pastor', 'madam', 'oga', 'brother', 'sister']);

const ALIASES = Object.entries(GOODS)
  .flatMap(([id, g]) => g.aliases.map((a) => [a, id]))
  .sort((a, b) => b[0].length - a[0].length);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function normalise(text) {
  return (' ' + text.toLowerCase() + ' ')
    .replace(/₦|naira|\bngn\b/g, ' ')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/(\d+(?:\.\d+)?)\s*k\b/g, (_, n) => String(Math.round(parseFloat(n) * 1000)))
    .replace(/\s+/g, ' ');
}

export function detectQuery(text) {
  const t = text.toLowerCase();
  if (/\b(sold|sell)\b/.test(t)) return null;
  if (/who.*owe|owes? me|debt|owing/.test(t)) return 'owes';
  if (/profit|how much|money/.test(t)) return 'profit';
  return null;
}

// Returns { items: {id: qty}, name, total, paid } or { error }.
export function parseSale(text) {
  let t = normalise(text);
  if (!/\b(sold|sell|sale)\b/.test(t)) return { error: 'nosold' };

  const items = {};
  for (const [alias, id] of ALIASES) {
    const re = new RegExp(`(\\d+)\\s*(?:x\\s*)?(?:${UNIT_WORDS}\\s+(?:of\\s+)?)?${esc(alias)}\\b`, 'g');
    t = t.replace(re, (_, n) => {
      items[id] = (items[id] || 0) + parseInt(n, 10);
      return ' ';
    });
  }
  if (!Object.keys(items).length) return { error: 'noitems' };

  let paid = null;
  let owes = null;
  let discount = null;
  t = t.replace(/\b(?:discount(?:ed)?|less|minus|reduced?(?: by)?)\s+(\d+)/, (_, n) => { discount = parseInt(n, 10); return ' '; });
  if (discount == null) t = t.replace(/\b(\d+)\s+off\b/, (_, n) => { discount = parseInt(n, 10); return ' '; });
  t = t.replace(/\b(?:paid|pay|gave|deposit(?:ed)?)\s+(\d+)/, (_, n) => { paid = parseInt(n, 10); return ' '; });
  t = t.replace(/\b(?:owes?|owing|balance|remaining)\s+(\d+)/, (_, n) => { owes = parseInt(n, 10); return ' '; });

  let name = null;
  const nm = t.match(/\bto\s+([a-z][a-z' .-]*?)(?=\s*(?:\d|,|\bfor\b|\bat\b|\bcash\b|\bon\b|\bcredit\b|$))/);
  if (nm) {
    name = nm[1].trim();
    t = t.replace(nm[0], ' ');
  }

  const nums = [...t.matchAll(/\d+/g)].map((m) => parseInt(m[0], 10));
  let total = nums.length ? nums[0] : null;
  if (total == null && paid != null && owes != null) total = paid + owes;
  if (total == null) return { error: 'nototal', items, name };

  const onCredit = /\b(credit|later|owing)\b/.test(t);
  const paidGiven = paid != null;
  paid = resolvePaid(paid, owes, onCredit, total - (discount || 0));
  return { items, name, total, discount, paid, paidGiven, owes, onCredit };
}

function resolvePaid(paid, owes, onCredit, net) {
  if (paid != null) return paid;
  if (owes != null) return net - owes;
  return onCredit ? 0 : net;
}

export function nameMatches(said, fullName) {
  if (!said) return false;
  const a = said.toLowerCase().trim();
  const b = fullName.toLowerCase();
  if (a === b) return true;
  const words = b.split(/\s+/).filter((w) => !TITLES.has(w) && w.length >= 3);
  return words.some((w) => a.split(/[\s.]+/).includes(w));
}

// The message tiTi suggests, so players learn the format.
export function suggestMessage(sale, customerName) {
  const items = sale.items.map((it) => `${it.qty} ${GOODS[it.item].aliases[0]}`).join(' and ');
  const who = customerName ? ` to ${customerName}` : '';
  if (sale.discount) return `sold ${items}${who} ${sale.listTotal}, discount ${sale.discount}, paid ${sale.paid}`;
  if (sale.paid >= sale.total) return `sold ${items}${who} ${sale.total} cash`;
  return `sold ${items}${who} ${sale.total}, paid ${sale.paid}`;
}

// Compare what the player typed with what really happened. Returns a list of problems (empty = correct).
export function checkSale(parsed, sale, customerName) {
  const problems = [];
  const want = {};
  for (const it of sale.items) want[it.item] = (want[it.item] || 0) + it.qty;
  for (const id of new Set([...Object.keys(want), ...Object.keys(parsed.items)])) {
    const w = want[id] || 0;
    const p = parsed.items[id] || 0;
    if (w !== p) {
      const nm = GOODS[id].short.toLowerCase();
      problems.push(w === 0 ? `${nm} wasn't part of this sale` : `the customer took ${w} ${nm}, not ${p}`);
    }
  }
  // A discount can be written as "5000, discount 500" or as the price after it, "4500".
  const disc = sale.discount || 0;
  let net = parsed.total;
  let paid = parsed.paid;
  if (parsed.discount) {
    if (parsed.discount !== disc) problems.push(disc ? `the discount was ${disc}, not ${parsed.discount}` : 'there was no discount on this sale');
    else if (parsed.total !== sale.total) net = parsed.total - parsed.discount;
    paid = resolvePaid(parsed.paidGiven ? parsed.paid : null, parsed.owes, parsed.onCredit, net);
  }
  if (net !== sale.total) problems.push(disc && !parsed.discount ? `the price after discount was ${sale.total}, not ${net}` : `the total was ${disc ? sale.listTotal : sale.total}, not ${parsed.total}`);
  if (paid !== sale.paid) problems.push(`they paid ${sale.paid}, not ${paid}`);
  const credit = sale.paid < sale.total;
  if (credit && !parsed.name) problems.push('I need the customer\'s name for credit, e.g. "to ' + customerName + '"');
  else if (parsed.name && customerName && !nameMatches(parsed.name, customerName)) problems.push(`this was ${customerName}, not "${parsed.name}"`);
  return problems;
}
