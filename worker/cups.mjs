// Championships. A player creates one: a name from a list, a length in real days, up to 20 players and the events.
// Each event gives points by place; the most points wins. Business events need 3 game days in the championship,
// so nobody wins on one lucky day. The game runs on the phone, so numbers are checked but are not proof.
import { CHAMPION_ROUNDS, goodChallenge } from './markets.mjs';

export const CUP_NAMES = ['Market Cup', 'Naira Masters', 'Oga Shop League', 'Traders Trophy', 'Golden Till Cup', 'Big Market Challenge', 'Friday Cup', 'Family Cup', 'Class Cup', 'Friends Cup'];
export const CUP_EVENTS = ['score', 'profit', 'recording', 'debts', 'stocked', 'money', 'change', 'road', 'quiz'];
export const CUP_DAYS = [3, 7, 14];
export const CUP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
export const MIN_DAYS = 3;
export const MIN_QUIZ = 3;
export const MAX_ACTIVE = 3;
export const MAX_SIZE = 20;
const DAY = 86400000;
const KEEP_ENDED = 30 * DAY;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const BUSINESS = ['score', 'profit', 'recording', 'debts', 'stocked'];
const reply = (status, json) => ({ status, json });

// Players aged 13 to 17 appear as "Player 3", never by username.
export const playerName = (p) => (p.age === '13-17' ? `Player ${p.slot}` : p.username);

function newCode() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => CODE_LETTERS[x % CODE_LETTERS.length]).join('');
}

// ---------- Scoring ----------

// A player's number for one event, or null if they can't be ranked in it yet.
export function eventValue(event, st = {}) {
  const b = st.biz;
  if (BUSINESS.includes(event)) return b && b.days >= MIN_DAYS && b[event] != null ? b[event] : null;
  if (event === 'quiz') return b && b.quizTotal >= MIN_QUIZ ? b.quizRight / b.quizTotal : null;
  return st[event] || null;
}

// Positive when a is better than b.
function better(event, a, b) {
  if (event === 'money' || event === 'change') return a.score - b.score || b.ms - a.ms;
  if (event === 'road') return b.hits - a.hits;
  return a - b;
}

// One event's table. Equal results share a place and its points.
export function rankEvent(event, players) {
  const rows = players.map((p) => ({ p, v: eventValue(event, p.stats) })).filter((r) => r.v != null);
  return rows
    .map((r) => {
      const place = 1 + rows.filter((o) => better(event, o.v, r.v) > 0).length;
      return { p: r.p, value: r.v, place, points: CUP_POINTS[place - 1] ?? 1 };
    })
    .sort((a, b) => a.place - b.place || a.p.slot - b.p.slot);
}

export function standings(cup, players) {
  const tables = Object.fromEntries(cup.events.map((e) => [e, rankEvent(e, players)]));
  const total = new Map(players.map((p) => [p.userKey, { p, points: 0, wins: 0 }]));
  for (const rows of Object.values(tables)) {
    for (const r of rows) {
      const t = total.get(r.p.userKey);
      t.points += r.points;
      if (r.place === 1) t.wins++;
    }
  }
  const list = [...total.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.p.slot - b.p.slot);
  for (const t of list) t.place = 1 + list.filter((o) => o.points > t.points || (o.points === t.points && o.wins > t.wins)).length;
  return { tables, list };
}

async function view(store, cup, user, now) {
  const players = await store.cupPlayers(cup.id);
  const { tables, list } = standings(cup, players);
  const me = (p) => p.userKey === user.key;
  return reply(200, {
    cup: { code: cup.code, name: cup.name, size: cup.size, days: cup.days, events: cup.events, startsAt: cup.startsAt, endsAt: cup.endsAt, ended: now >= cup.endsAt },
    players: players.length,
    standings: list.map((t) => ({ name: playerName(t.p), you: me(t.p), points: t.points, wins: t.wins, place: t.place })),
    events: Object.fromEntries(Object.entries(tables).map(([e, rows]) => [e, rows.map((r) => ({ name: playerName(r.p), you: me(r.p), value: r.value, place: r.place, points: r.points }))])),
  });
}

// ---------- Checking what the phone sends ----------

const ratio = (v) => v === null || (typeof v === 'number' && v >= 0 && v <= 1);

export function goodBiz(b) {
  return !!b && Number.isInteger(b.days) && b.days >= 0 && b.days <= 2000
    && Number.isInteger(b.score) && b.score >= 0 && b.score <= 100
    && Number.isInteger(b.profit) && Math.abs(b.profit) <= 200000
    && ratio(b.recording) && ratio(b.debts) && ratio(b.stocked)
    && Number.isInteger(b.quizTotal) && b.quizTotal >= 0 && b.quizTotal <= 5000
    && Number.isInteger(b.quizRight) && b.quizRight >= 0 && b.quizRight <= b.quizTotal;
}

const goodRoad = (g) => g?.type === 'road' && Number.isInteger(g.hits) && g.hits >= 0 && g.hits <= 60;

// ---------- Handlers ----------

function badSettings(body) {
  if (!Number.isInteger(body?.name) || !CUP_NAMES[body.name]) return 'Choose a name.';
  if (!CUP_DAYS.includes(body.days)) return 'Choose 3, 7 or 14 days.';
  if (!Number.isInteger(body.size) || body.size < 2 || body.size > MAX_SIZE) return `Choose 2 to ${MAX_SIZE} players.`;
  const ev = body.events;
  if (!Array.isArray(ev) || !ev.length || ev.some((e) => !CUP_EVENTS.includes(e)) || new Set(ev).size !== ev.length) return 'Choose at least one event.';
  return null;
}

async function enter(store, cup, user, now) {
  const players = await store.cupPlayers(cup.id);
  if (players.some((p) => p.userKey === user.key)) return view(store, cup, user, now);
  if (now >= cup.endsAt) return reply(409, { error: 'That championship has finished.' });
  if (players.length >= cup.size) return reply(409, { error: 'That championship is full.' });
  if (await store.activeCupCount(user.key, now) >= MAX_ACTIVE) return reply(409, { error: `You can be in ${MAX_ACTIVE} championships at a time.` });
  const used = new Set(players.map((p) => p.slot));
  let slot = 1;
  while (used.has(slot)) slot++;
  await store.addCupPlayer({ cupId: cup.id, userKey: user.key, username: user.username, age: user.age, slot, now });
  return view(store, cup, user, now);
}

export async function create(store, user, body, { now }) {
  const bad = badSettings(body);
  if (bad) return reply(400, { error: bad });
  if (await store.activeCupCount(user.key, now) >= MAX_ACTIVE) return reply(409, { error: `You can be in ${MAX_ACTIVE} championships at a time.` });
  await store.deleteEndedCups(now - KEEP_ENDED);
  const events = CUP_EVENTS.filter((e) => body.events.includes(e));
  for (let i = 0; i < 6; i++) {
    const cup = { id: crypto.randomUUID(), code: newCode(), name: CUP_NAMES[body.name], size: body.size, days: body.days, events, startsAt: now, endsAt: now + body.days * DAY, by: user.key };
    if (await store.createCup(cup)) return enter(store, cup, user, now);
  }
  return reply(500, { error: 'Please try again.' });
}

async function cupFrom(store, body) {
  const code = String(body?.code || '').trim().toUpperCase();
  return /^[A-Z]{6}$/.test(code) ? store.getCupByCode(code) : null;
}

export async function join(store, user, body, { now }) {
  const cup = await cupFrom(store, body);
  if (!cup) return reply(404, { error: "We couldn't find that championship code." });
  return enter(store, cup, user, now);
}

export async function leave(store, user, body) {
  const cup = await cupFrom(store, body);
  if (cup) {
    await store.removeCupPlayer(cup.id, user.key);
    if (!(await store.cupPlayers(cup.id)).length) await store.deleteCup(cup.id);
  }
  return reply(200, { ok: true });
}

// The phone sends its numbers since joining, and new game results. After the end nothing changes.
export async function sync(store, user, body, { now }) {
  const cup = await cupFrom(store, body);
  const me = cup && (await store.cupPlayers(cup.id)).find((p) => p.userKey === user.key);
  if (!me) return reply(404, { error: 'none' });
  if (now < cup.endsAt) {
    const st = { ...me.stats };
    let changed = false;
    if (goodBiz(body.biz)) { st.biz = { ...body.biz }; changed = true; }
    for (const g of Array.isArray(body.games) ? body.games.slice(0, 3) : []) {
      if (!cup.events.includes(g?.type)) continue;
      if (CHAMPION_ROUNDS[g.type] && goodChallenge(g)) {
        const old = st[g.type];
        if (!old || g.score > old.score || (g.score === old.score && g.ms < old.ms)) { st[g.type] = { score: g.score, ms: g.ms }; changed = true; }
      } else if (goodRoad(g) && (!st.road || g.hits < st.road.hits)) {
        st.road = { hits: g.hits };
        changed = true;
      }
    }
    if (changed) await store.saveCupStats(cup.id, user.key, st);
  }
  return view(store, cup, user, now);
}
