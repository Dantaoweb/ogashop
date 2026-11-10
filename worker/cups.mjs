// Championships. A host sets the rules (or takes the standard ones) and opens registration. Players read the rules,
// agree and register. Everyone starts together, at a set time or when the host presses Start; nobody joins late.
// Type "real": ends after 3, 7 or 14 real days. Type "game": everyone gets 5, 7 or 14 game days, with a backstop.
// Each event gives points by place; the most points wins. The game runs on the phone, so numbers are checked, not proven.
import { CHAMPION_ROUNDS, goodChallenge } from './markets.mjs';

export const CUP_NAMES = ['Market Cup', 'Naira Masters', 'Oga Shop League', 'Traders Trophy', 'Golden Till Cup', 'Big Market Challenge', 'Friday Cup', 'Family Cup', 'Class Cup', 'Friends Cup'];
export const CUP_EVENTS = ['score', 'profit', 'recording', 'debts', 'stocked', 'money', 'change', 'road', 'quiz'];
export const CUP_KINDS = { real: [3, 7, 14], game: [5, 7, 14] };
export const CUP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
export const MIN_DAYS = 3;
export const MIN_QUIZ = 3;
export const MAX_ACTIVE = 3;
export const MAX_SIZE = 20;
export const MIN_START = 2;
export const OPEN_DAYS = 7; // registration stays open at most this long
export const BACKSTOP_DAYS = 14; // a game-day championship closes after this many real days anyway
const DAY = 86400000;
const KEEP = 45 * DAY;
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

export function eventValue(event, st = {}) {
  const b = st.biz;
  if (BUSINESS.includes(event)) return b && b.days >= MIN_DAYS && b[event] != null ? b[event] : null;
  if (event === 'quiz') return b && b.quizTotal >= MIN_QUIZ ? b.quizRight / b.quizTotal : null;
  return st[event] || null;
}

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

// ---------- Where a championship is: open, running, ended or cancelled ----------

const daysPlayed = (p) => p.stats?.biz?.days || 0;

export function status(cup, players, now) {
  if (cup.cancelled) return 'cancelled';
  if (!cup.startedAt) return 'open';
  if (now >= cup.endsAt) return 'ended';
  if (cup.kind === 'game' && players.length && players.every((p) => daysPlayed(p) >= cup.length)) return 'ended';
  return 'running';
}

async function startCup(store, cup, at) {
  const endsAt = at + (cup.kind === 'real' ? cup.length : BACKSTOP_DAYS) * DAY;
  await store.startCup(cup.id, at, endsAt);
  return { ...cup, startedAt: at, endsAt };
}

// Starts it at its time, or cancels it if too few registered or nobody started it within a week.
async function settle(store, cup, now) {
  if (cup.cancelled || cup.startedAt) return cup;
  const timeUp = cup.startMode === 'time' && now >= cup.startAt;
  const tooOld = now >= cup.createdAt + OPEN_DAYS * DAY;
  if (!timeUp && !tooOld) return cup;
  const n = (await store.cupPlayers(cup.id)).length;
  if (timeUp && n >= MIN_START) return startCup(store, cup, cup.startAt);
  await store.cancelCup(cup.id);
  return { ...cup, cancelled: 1 };
}

async function view(store, cup, user, now) {
  const players = await store.cupPlayers(cup.id);
  const st = status(cup, players, now);
  const me = (p) => p.userKey === user.key;
  const started = !!cup.startedAt;
  const { tables, list } = started ? standings(cup, players) : { tables: {}, list: [] };
  return reply(200, {
    cup: {
      code: cup.code, name: cup.name, size: cup.size, kind: cup.kind, length: cup.length, events: cup.events,
      levelFrom: cup.levelFrom, levelTo: cup.levelTo, startMode: cup.startMode, startAt: cup.startAt,
      startedAt: cup.startedAt, endsAt: cup.endsAt, openUntil: cup.createdAt + OPEN_DAYS * DAY, status: st,
      host: cup.by === user.key, locked: players.length > 1,
    },
    registered: players.some(me),
    players: players.map((p) => ({ name: playerName(p), you: me(p), host: p.userKey === cup.by, days: started ? Math.min(daysPlayed(p), cup.kind === 'game' ? cup.length : Infinity) : null })),
    standings: list.map((t) => ({ name: playerName(t.p), you: me(t.p), points: t.points, wins: t.wins, place: t.place })),
    events: Object.fromEntries(Object.entries(tables).map(([e, rows]) => [e, rows.map((r) => ({ name: playerName(r.p), you: me(r.p), value: r.value, place: r.place, points: r.points }))])),
  });
}

// ---------- Checking what the phone sends ----------

const ratio = (v) => v === null || (typeof v === 'number' && v >= 0 && v <= 1);
const validLevel = (l) => Number.isInteger(l) && l >= 1 && l <= 7;

export function goodBiz(b) {
  return !!b && Number.isInteger(b.days) && b.days >= 0 && b.days <= 2000
    && Number.isInteger(b.score) && b.score >= 0 && b.score <= 100
    && Number.isInteger(b.profit) && Math.abs(b.profit) <= 200000
    && ratio(b.recording) && ratio(b.debts) && ratio(b.stocked)
    && Number.isInteger(b.quizTotal) && b.quizTotal >= 0 && b.quizTotal <= 5000
    && Number.isInteger(b.quizRight) && b.quizRight >= 0 && b.quizRight <= b.quizTotal;
}

const goodRoad = (g) => g?.type === 'road' && Number.isInteger(g.hits) && g.hits >= 0 && g.hits <= 60;

export function badSettings(body, now) {
  if (!Number.isInteger(body?.name) || !CUP_NAMES[body.name]) return 'Choose a name.';
  if (!CUP_KINDS[body.kind] || !Object.hasOwn(CUP_KINDS, body.kind)) return 'Choose real days or game days.';
  if (!CUP_KINDS[body.kind].includes(body.length)) return 'Choose how long it lasts.';
  if (!Number.isInteger(body.size) || body.size < MIN_START || body.size > MAX_SIZE) return `Choose ${MIN_START} to ${MAX_SIZE} players.`;
  if (!validLevel(body.levelFrom) || !validLevel(body.levelTo) || body.levelFrom > body.levelTo) return 'Choose the levels, from 1 to 7.';
  const ev = body.events;
  if (!Array.isArray(ev) || !ev.length || ev.some((e) => !CUP_EVENTS.includes(e)) || new Set(ev).size !== ev.length) return 'Choose at least one event.';
  if (body.startMode === 'time') {
    if (!Number.isInteger(body.startAt) || body.startAt < now + 60000 || body.startAt > now + OPEN_DAYS * DAY) return 'Choose a start time within the next 7 days.';
  } else if (body.startMode !== 'host') return 'Choose when it starts.';
  return null;
}

const rulesOf = (body) => ({
  name: CUP_NAMES[body.name], size: body.size, kind: body.kind, length: body.length,
  events: CUP_EVENTS.filter((e) => body.events.includes(e)), levelFrom: body.levelFrom, levelTo: body.levelTo,
  startMode: body.startMode, startAt: body.startMode === 'time' ? body.startAt : null,
});

const levelError = (cup, level) => (!validLevel(level) || level < cup.levelFrom || level > cup.levelTo
  ? `This championship is for ${cup.levelTo > cup.levelFrom ? `Levels ${cup.levelFrom}–${cup.levelTo}` : `Level ${cup.levelFrom}`}. Your shop is at Level ${level}.`
  : null);

// ---------- Handlers ----------

export async function create(store, user, body, { now }) {
  const bad = badSettings(body, now);
  if (bad) return reply(400, { error: bad });
  const rules = rulesOf(body);
  const lvl = levelError(rules, body.level);
  if (lvl) return reply(400, { error: lvl });
  if (await store.activeCupCount(user.key, now) >= MAX_ACTIVE) return reply(409, { error: `You can be in ${MAX_ACTIVE} championships at a time.` });
  await store.deleteOldCups(now - KEEP);
  for (let i = 0; i < 6; i++) {
    const cup = { id: crypto.randomUUID(), code: newCode(), ...rules, by: user.key, createdAt: now, startedAt: null, endsAt: null, cancelled: 0 };
    if (await store.createCup(cup)) {
      await store.addCupPlayer({ cupId: cup.id, userKey: user.key, username: user.username, age: user.age, slot: 1, now });
      return view(store, cup, user, now);
    }
  }
  return reply(500, { error: 'Please try again.' });
}

async function cupFrom(store, body, now) {
  const code = String(body?.code || '').trim().toUpperCase();
  const cup = /^[A-Z]{6}$/.test(code) ? await store.getCupByCode(code) : null;
  return cup && settle(store, cup, now);
}

const notFound = () => reply(404, { error: "We couldn't find that championship code." });

// The rules page, before registering.
export async function info(store, user, body, { now }) {
  const cup = await cupFrom(store, body, now);
  return cup ? view(store, cup, user, now) : notFound();
}

// Agreeing to the rules and registering. Only while registration is open.
export async function register(store, user, body, { now }) {
  const cup = await cupFrom(store, body, now);
  if (!cup) return notFound();
  const players = await store.cupPlayers(cup.id);
  if (players.some((p) => p.userKey === user.key)) return view(store, cup, user, now);
  const st = status(cup, players, now);
  if (st === 'cancelled') return reply(409, { error: 'That championship was cancelled.' });
  if (st !== 'open') return reply(409, { error: 'That championship has already started. Registration is closed.' });
  if (body.agree !== true) return reply(400, { error: 'Please agree to the rules first.' });
  if (players.length >= cup.size) return reply(409, { error: 'That championship is full.' });
  const lvl = levelError(cup, body.level);
  if (lvl) return reply(409, { error: lvl });
  if (await store.activeCupCount(user.key, now) >= MAX_ACTIVE) return reply(409, { error: `You can be in ${MAX_ACTIVE} championships at a time.` });
  const used = new Set(players.map((p) => p.slot));
  let slot = 1;
  while (used.has(slot)) slot++;
  await store.addCupPlayer({ cupId: cup.id, userKey: user.key, username: user.username, age: user.age, slot, now });
  return view(store, cup, user, now);
}

// The host changes the rules, only until someone else registers.
export async function update(store, user, body, { now }) {
  const cup = await cupFrom(store, body, now);
  if (!cup) return notFound();
  if (cup.by !== user.key) return reply(403, { error: 'Only the host can change the rules.' });
  const players = await store.cupPlayers(cup.id);
  if (status(cup, players, now) !== 'open') return reply(409, { error: 'The championship has started; the rules are fixed.' });
  if (players.length > 1) return reply(409, { error: 'Players have registered and agreed to these rules, so they can no longer change.' });
  const bad = badSettings(body, now);
  if (bad) return reply(400, { error: bad });
  const rules = rulesOf(body);
  const lvl = levelError(rules, body.level);
  if (lvl) return reply(400, { error: lvl });
  await store.updateCup(cup.id, rules);
  return view(store, { ...cup, ...rules }, user, now);
}

// The host starts it now (needs at least 2 players).
export async function start(store, user, body, { now }) {
  const cup = await cupFrom(store, body, now);
  if (!cup) return notFound();
  if (cup.by !== user.key) return reply(403, { error: 'Only the host can start it.' });
  const players = await store.cupPlayers(cup.id);
  if (status(cup, players, now) !== 'open') return view(store, cup, user, now);
  if (players.length < MIN_START) return reply(409, { error: `At least ${MIN_START} players need to register first.` });
  return view(store, await startCup(store, cup, now), user, now);
}

// Leaving. If the host leaves before the start, the championship is cancelled for everyone.
export async function leave(store, user, body, { now }) {
  const cup = await cupFrom(store, body, now);
  if (cup) {
    const players = await store.cupPlayers(cup.id);
    if (cup.by === user.key && status(cup, players, now) === 'open') await store.cancelCup(cup.id);
    await store.removeCupPlayer(cup.id, user.key);
    if (players.length <= 1) await store.deleteCup(cup.id);
  }
  return reply(200, { ok: true });
}

// While it runs: the phone sends its numbers since the start, and new game results. Before and after, just the view.
export async function sync(store, user, body, { now }) {
  const cup = await cupFrom(store, body, now);
  const players = cup ? await store.cupPlayers(cup.id) : [];
  const me = players.find((p) => p.userKey === user.key);
  if (!me) return reply(404, { error: 'none' });
  if (status(cup, players, now) === 'running') {
    const st = { ...me.stats };
    const done = cup.kind === 'game' && daysPlayed(me) >= cup.length;
    let changed = false;
    const b = body.biz;
    if (goodBiz(b) && !(cup.kind === 'game' && b.days > cup.length) && b.days >= daysPlayed(me)) { st.biz = { ...b }; changed = true; }
    for (const g of done ? [] : Array.isArray(body.games) ? body.games.slice(0, 3) : []) {
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
