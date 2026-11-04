// Challenge days: a short game at the start of every other day of a level, then back to business.
// Money check (spot fakes among many kinds of notes), Road safety (dodge bikes), Change master (make change).
// Doing well earns a badge and a lasting skill. Never money for luck; always skippable.

export const LEVEL_DAYS = 7; // target length of a level; extra days if the goal isn't reached yet

export const CHALLENGES = {
  money: { name: 'Money check', badge: 'money_checker', skill: 'eagleEye', pass: 5,
    about: 'Spot the fake among different notes: old and new designs, all sizes.',
    reward: 'Eagle eye: from now on, the light check is already on when you spot fake notes.' },
  road: { name: 'Road safety', badge: 'fast_runner', skill: 'fastRunner', pass: 3, seconds: 25,
    about: 'Practise the market road: dodge bicycles, okadas and everything in the way.',
    reward: 'Fast runner: your Market run gets 5 more seconds, and accidents happen half as often.' },
  change: { name: 'Change master', badge: 'change_master', skill: 'patience', pass: 4,
    about: 'The buyer bought something and paid more. Make the right change.',
    reward: 'Patient customers: they wait 5 seconds longer while you count change.' },
};

const ORDER = ['money', 'road', 'change'];
export const MONEY_ROUNDS = 6;
export const CHANGE_ROUNDS = 5;
export const CHANGE_NOTES = [1000, 500, 200, 100, 50, 20, 10, 5];

export const levelDay = (s) => s.day - s.levelStartDay + 1;
export const daysLeft = (s) => LEVEL_DAYS - levelDay(s);

// Which challenge today's morning offers (every other day of the level).
export function challengeForDay(s) {
  const d = levelDay(s);
  if (d < 2 || d % 2) return null;
  return ORDER[(d / 2 - 1) % ORDER.length];
}

// ---------- Money check ----------

const FLAWS = ['colour', 'print', 'serial', 'thread', 'size', 'copy', 'movie'];
export const FLAW_HINT = {
  colour: 'the colour was wrong',
  print: 'the print was faded',
  serial: 'it had no serial number',
  thread: 'it had no security thread (check against the light)',
  size: 'it was smaller than a real note',
  copy: 'it was a black-and-white photocopy',
  movie: 'it said "For movie use"',
};

function serial(rng) {
  const L = 'ABCDEFGHJK';
  return `${L[Math.floor(rng() * 10)]}${L[Math.floor(rng() * 10)]} ${Math.floor(rng() * 9000000) + 1000000}`;
}

export function moneyRound(rng) {
  const notes = Array.from({ length: 4 }, () => ({
    value: [100, 200, 500, 1000][Math.floor(rng() * 4)],
    design: rng() < 0.5 ? 'old' : 'new',
    fake: false, flaw: null, serial: serial(rng),
  }));
  let fakeIdx = -1;
  if (rng() < 0.75) {
    fakeIdx = Math.floor(rng() * 4);
    notes[fakeIdx].fake = true;
    notes[fakeIdx].flaw = FLAWS[Math.floor(rng() * FLAWS.length)];
  }
  return { notes, fakeIdx, light: false, picked: null };
}

// ---------- Change master ----------

// Rounds get harder: from round prices and one note, to odd amounts paid with several notes.
export function changeRound(i, rng) {
  const step = i < 2 ? 50 : i < 4 ? 10 : 5;
  const max = 600 + i * 900;
  const total = Math.max(step, Math.round((150 + rng() * max) / step) * step);
  const paid = Math.ceil((total + 1) / 1000) * 1000;
  return { total, paid, due: paid - total, given: [], done: null };
}

// ---------- Playing a challenge ----------

export function startChallenge(type, rng = Math.random) {
  if (type === 'money') return { type, round: 0, correct: 0, rounds: Array.from({ length: MONEY_ROUNDS }, () => moneyRound(rng)) };
  if (type === 'change') return { type, round: 0, correct: 0, rounds: Array.from({ length: CHANGE_ROUNDS }, (_, i) => changeRound(i, rng)) };
  return { type, hits: null };
}

export function moneyPick(c, pick) {
  const r = c.rounds[c.round];
  if (r.picked != null) return;
  r.picked = pick;
  if (pick === r.fakeIdx) c.correct++;
}

export function changeTapNote(c, note) {
  const r = c.rounds[c.round];
  if (r.done == null && CHANGE_NOTES.includes(note) && r.given.length < 25) r.given.push(note);
}

export function changeUndoNote(c) {
  const r = c.rounds[c.round];
  if (r.done == null) r.given.pop();
}

export function changeCheck(c) {
  const r = c.rounds[c.round];
  if (r.done != null) return;
  r.done = r.given.reduce((a, n) => a + n, 0) === r.due;
  if (r.done) c.correct++;
}

export function nextRound(c) {
  if (c.round < c.rounds.length - 1) c.round++;
  else c.finished = true;
}

export function roadResult(c, hits) {
  c.hits = hits;
  c.finished = true;
}

export function passed(c) {
  const def = CHALLENGES[c.type];
  return c.type === 'road' ? c.hits != null && c.hits <= def.pass : c.correct >= def.pass;
}

// Record the result; a pass earns the badge and the skill (once).
export function finishChallenge(s, c) {
  const def = CHALLENGES[c.type];
  const ok = passed(c);
  s.challengeLog.push({ day: s.day, type: c.type, ok, score: c.type === 'road' ? c.hits : c.correct });
  let earned = null;
  if (ok && !s.skills[def.skill]) {
    s.skills[def.skill] = true;
    if (!s.badges.includes(def.badge)) s.badges.push(def.badge);
    earned = def.reward;
  }
  s.today.challenge = { type: c.type, done: true, ok, earned };
  return { ok, earned };
}
