// Multiplayer markets. Shops play day by day; each posts its latest results and wins customers others lose.
// `store` holds the data (D1 in production, a simple fake in tests). Every handler returns { status, json }.

export const SIZES = [2, 3, 4, 5, 6];
const DAY = 86400000;
export const INACTIVE_MS = 3 * DAY; // shown as away, and replaced by a computer shop on other phones
export const REMOVE_MS = 7 * DAY; // quick markets free up the place
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const reply = (status, json) => ({ status, json });

// Market champions: the two games that show who knows money best.
export const CHAMPION_ROUNDS = { money: 6, change: 5 };
const MIN_MS_PER_ROUND = 1000; // nobody can answer a round faster than this
const MAX_MS = 30 * 60000;

// Players aged 13 to 17 appear to others as "Shop 3", never by username.
export const shopName = (m) => (m.age === '13-17' ? `Shop ${m.slot}` : m.username);

function newCode() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => CODE_LETTERS[x % CODE_LETTERS.length]).join('');
}

const validLevel = (l) => Number.isInteger(l) && l >= 1 && l <= 7;

// Best score first; the faster time wins a tie. Names follow the same rule as shops.
function board(members, type, user) {
  return members.filter((m) => m.best?.[type])
    .map((m) => ({ name: shopName(m), you: m.userKey === user.key, score: m.best[type].score, ms: m.best[type].ms }))
    .sort((a, b) => b.score - a.score || a.ms - b.ms);
}

async function view(store, market, user, now, wins = []) {
  const members = await store.membersOf(market.id);
  const me = members.find((m) => m.userKey === user.key);
  return reply(200, {
    market: { code: market.kind === 'code' ? market.code : null, size: market.size, kind: market.kind, level: market.level },
    you: me?.slot,
    shops: members.map((m) => ({
      slot: m.slot, name: shopName(m), you: m.userKey === user.key,
      active: m.userKey === user.key || now - m.lastSeen < INACTIVE_MS,
      customers: m.customers, sales: m.sales, price: m.price, advert: !!m.advert, level: m.level,
    })),
    wins,
    champions: { money: board(members, 'money', user), change: board(members, 'change', user) },
  });
}

// Takes the lowest free place in the market.
async function enter(store, market, user, now) {
  const old = await store.getMember(user.key);
  if (old) await leaveMarket(store, old);
  const members = await store.membersOf(market.id);
  if (members.length >= market.size) return reply(409, { error: 'That market is full.' });
  const used = new Set(members.map((m) => m.slot));
  let slot = 1;
  while (used.has(slot)) slot++;
  await store.addMember({ marketId: market.id, userKey: user.key, username: user.username, age: user.age, slot, now, level: market.level });
  return view(store, market, user, now);
}

async function leaveMarket(store, member) {
  await store.removeMember(member.userKey);
  if (!(await store.membersOf(member.marketId)).length) await store.deleteMarket(member.marketId);
}

async function makeMarket(store, { size, level, kind, now }) {
  for (let i = 0; i < 6; i++) {
    const market = { id: crypto.randomUUID(), code: newCode(), size, level, kind, now };
    if (await store.createMarket(market)) return market;
  }
  return null;
}

const badChoice = (body) => (!SIZES.includes(body?.size) ? reply(400, { error: 'Choose 2 to 6 players.' }) : !validLevel(body?.level) ? reply(400, { error: 'Bad level.' }) : null);

export async function quick(store, user, body, { now }) {
  const bad = badChoice(body);
  if (bad) return bad;
  const old = await store.getMember(user.key);
  if (old) await leaveMarket(store, old);
  await store.clearInactiveQuick(now - REMOVE_MS);
  const market = await store.findOpenQuick(body.size, body.level) || await makeMarket(store, { size: body.size, level: body.level, kind: 'quick', now });
  return market ? enter(store, market, user, now) : reply(500, { error: 'Please try again.' });
}

export async function create(store, user, body, { now }) {
  const bad = badChoice(body);
  if (bad) return bad;
  const market = await makeMarket(store, { size: body.size, level: body.level, kind: 'code', now });
  return market ? enter(store, market, user, now) : reply(500, { error: 'Please try again.' });
}

export async function join(store, user, body, { now }) {
  const code = String(body?.code || '').trim().toUpperCase();
  const market = /^[A-Z]{6}$/.test(code) ? await store.getMarketByCode(code) : null;
  if (!market || market.kind !== 'code') return reply(404, { error: "We couldn't find that market code." });
  const me = await store.getMember(user.key);
  if (me?.marketId === market.id) return view(store, market, user, now);
  return enter(store, market, user, now);
}

export async function leave(store, user) {
  const me = await store.getMember(user.key);
  if (me) await leaveMarket(store, me);
  return reply(200, { ok: true });
}

// Numbers no real day could produce are ignored. The game runs on the phone, so results are not proof.
function goodResult(r) {
  if (!r) return false;
  return Number.isInteger(r.customers) && r.customers >= 0 && r.customers <= 60
    && Number.isInteger(r.sales) && r.sales >= 0 && r.sales <= r.customers * 60000
    && ['low', 'normal', 'high'].includes(r.price) && typeof r.advert === 'boolean'
    && validLevel(r.level) && Number.isInteger(r.gameDay) && r.gameDay >= 1;
}

export function goodChallenge(c) {
  const rounds = CHAMPION_ROUNDS[c?.type];
  if (!rounds || !Object.hasOwn(CHAMPION_ROUNDS, c.type)) return false;
  return Number.isInteger(c.score) && c.score >= 1 && c.score <= rounds
    && Number.isInteger(c.ms) && c.ms >= rounds * MIN_MS_PER_ROUND && c.ms <= MAX_MS;
}

const beats = (c, best) => !best || c.score > best.score || (c.score === best.score && c.ms < best.ms);

async function saveChallenges(store, me, list) {
  const best = { ...(me.best || {}) };
  for (const c of Array.isArray(list) ? list.slice(0, 2) : []) {
    if (!goodChallenge(c) || !beats(c, best[c.type])) continue;
    best[c.type] = { score: c.score, ms: c.ms };
    await store.saveBest(me.userKey, c.type, c.score, c.ms);
  }
}

// Called when a day ends (with a result) and when the app opens (without). Hands over any customers won.
export async function sync(store, user, body, { now }) {
  const me = await store.getMember(user.key);
  if (!me) return reply(404, { error: 'none' });
  const market = await store.getMarket(me.marketId);
  await store.touchMember(user.key, now);
  if (goodResult(body?.result)) {
    await store.saveResult(user.key, body.result);
    const members = await store.membersOf(me.marketId);
    const seen = new Set();
    for (const l of Array.isArray(body.result.lost) ? body.result.lost.slice(0, 6) : []) {
      const target = members.find((m) => m.slot === l?.slot && m.userKey !== user.key);
      if (!target || seen.has(target.slot) || !Number.isInteger(l.count) || l.count < 1) continue;
      seen.add(target.slot);
      await store.addWin(target.userKey, shopName(me), Math.min(l.count, 5), now);
    }
  }
  await saveChallenges(store, me, body?.challenges);
  return view(store, market, user, now, await store.takeWins(user.key));
}
