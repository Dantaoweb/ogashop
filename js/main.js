// App shell: saving, which screen to show, and button handling.
import * as E from './engine.js';
import * as UI from './ui.js';
import { LEVELS } from './data.js';
import { CUST, fmt, setCustom, resetCustom } from './core.js';
import * as Voice from './voice.js';
import * as Fx from './fx.js';
import * as Analytics from './analytics.js';
import * as Account from './account.js';
import * as Market from './market.js';
import { setGoal, clearGoal } from './goals.js';
import { startRun } from './run.js';
import { isJunior, isGuided } from './junior.js';
import * as Quiz from './quiz.js';
import * as Ch from './challenge.js';
import { GOALS, RULES } from './data.js';

const SAVE_KEY = 'ogashop.save.v1';
const app = document.getElementById('app');

let s = load();
// Screens on top of the day loop: start | settings | debts | score | level2 | done
const ui = { screen: s ? (s.quiz ? 'quiz' : null) : 'start', startPath: null, buy: {}, msg: '', error: null, confirmNew: false, confirmReset: false, canInstall: false };
let installPrompt = null;

// A shared link (?market=ABCDEF) opens the market screen with that code ready to join.
function readInvite() {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has('market')) return null;
    const code = (url.searchParams.get('market') || '').trim().toUpperCase();
    url.searchParams.delete('market');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    return /^[A-Z]{6}$/.test(code) ? code : null;
  } catch { return null; }
}
const invite = readInvite();
if (invite && !isJunior(s)) {
  ui.invite = invite;
  if (s) ui.screen = 'multi';
  else ui.startMode = 'multi';
}

function inviteLink(code) {
  return `${location.origin}${location.pathname}?market=${code}`;
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const data = raw && JSON.parse(raw);
    return data && data.v === E.SAVE_VERSION ? E.migrate(data) : null;
  } catch {
    return null;
  }
}

function save() {
  if (!s) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage full or blocked: keep playing */ }
  if (Account.loggedIn()) { Account.markDirty(); pushSoon(); }
}

// ---------- Cloud save ----------

let pushTimer = null;
function pushSoon() {
  if (!pushTimer) pushTimer = setTimeout(() => { pushTimer = null; pushNow(); }, 8000);
}

const summary = (g) => g && { level: g.level, day: g.day, score: g.score };

async function pushNow({ force = false } = {}) {
  if (!s || !Account.loggedIn()) return 'failed';
  if (!force && !Account.current().dirty) return 'ok';
  const result = await Account.push(JSON.stringify(s), { force });
  if (result === 'conflict') await offerChoice();
  return result;
}

function useCloud(cloud) {
  const data = JSON.parse(cloud.data);
  s = data.v === E.SAVE_VERSION ? E.migrate(data) : s;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* keep playing */ }
  Account.adopted(cloud.version);
  ui.buy = {};
  ui.screen = s?.quiz ? 'quiz' : null;
}

async function offerChoice() {
  const cloud = await Account.pull();
  if (!cloud?.data) return;
  ui.conflict = { cloud, cloudGame: summary(JSON.parse(cloud.data)), local: summary(s) };
  ui.screen = 'conflict';
  render();
}

// After logging in, or on opening the app: bring this phone and the account together.
async function syncNow() {
  const me = Account.current();
  if (!me) return;
  const cloud = await Account.pull();
  if (!cloud) return;
  if (!cloud.data) { if (s) await pushNow({ force: true }); return; }
  if (cloud.version === Account.current()?.base) { if (Account.current()?.dirty) await pushNow(); return; }
  if (!s || (!Account.current().dirty && Account.current().base > 0)) { useCloud(cloud); render(); return; }
  await offerChoice();
}

// ---------- Multiplayer ----------

async function marketCall(fn) {
  ui.mpBusy = true;
  ui.mpError = null;
  render();
  const r = await fn();
  ui.mpBusy = false;
  if (r.error) ui.mpError = r.error;
  else if (s) { E.applyMarketView(s, r.view); save(); }
  render();
}

// Share today's result, and pick up the latest from the other shops.
async function marketSync(result) {
  if (!s?.mp || !Account.loggedIn()) return;
  const sent = s.mp.champQueue || [];
  const r = await Market.sync(result, sent);
  if (!s?.mp) return;
  if (r.view) {
    E.applyMarketView(s, r.view);
    s.mp.champQueue = s.mp.champQueue.filter((c) => !sent.includes(c));
  }
  else if (r.status === 404) E.leaveMarketLocal(s);
  else return;
  save();
  if (s.phase === 'morning' || ui.screen === 'multi') render();
}

async function accountForm(mode, f) {
  ui.accountError = null;
  if (mode === 'signup' && !f.age.value) { ui.accountError = 'Please choose your age group.'; render(); return; }
  if (mode === 'signup' && f.age.value === 'under13') { ui.accountError = 'Players under 13 can play as guests.'; render(); return; }
  ui.accountBusy = true;
  render();
  const err = mode === 'signup' ? await Account.signup(f.username.value, f.age.value, f.pin.value) : await Account.login(f.username.value, f.pin.value);
  ui.accountBusy = false;
  ui.accountError = err;
  if (!err) {
    ui.screen = ui.accountFrom === 'multi' ? 'multi' : s ? null : 'start';
    await syncNow();
    await marketSync();
  }
  render();
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

function view() {
  if (ui.screen === 'levels') return UI.levelsScreen(s);
  if (ui.screen === 'account') return UI.accountScreen(ui);
  if (ui.screen === 'conflict' && ui.conflict) return UI.conflictScreen({ cloud: ui.conflict.cloudGame, local: ui.conflict.local });
  if (ui.screen === 'start' || !s) {
    const info = s ? `Level ${s.level} · ${LEVELS[s.level].name} · Day ${s.day} · Score ${s.score}` : '';
    return UI.startScreen(ui, !!s, info);
  }
  if (ui.screen === 'settings') return UI.settingsScreen(s, ui);
  if (ui.screen === 'debts') return UI.debtsScreen(s);
  if (ui.screen === 'prices') return UI.pricesScreen(s);
  if (ui.screen === 'goals') return UI.goalsScreen(s, ui);
  if (ui.screen === 'records') return UI.recordsScreen(s);
  if (ui.screen === 'multi' && s) return UI.multiScreen(s, ui);
  if (ui.screen === 'stage' && s?.today?.stageDone) return UI.stageScreen(s);
  if (ui.screen === 'customers') return UI.customersScreen(s, ui);
  if (ui.screen === 'challenge' && s.today.challengeGame) return UI.challengeScreen(s, s.today.challengeGame);
  if (ui.screen === 'levels') return UI.levelsScreen(s);
  if (ui.screen === 'quiz' && s.quiz) return UI.quizScreen(s, ui);
  if (ui.screen === 'score') return UI.scoreScreen(s);
  if (ui.screen === 'level2') return UI.level2Screen(s);
  if (ui.screen === 'done') return UI.doneScreen(s);
  switch (s.phase) {
    case 'morning': return UI.morningScreen(s, ui);
    case 'selling': return UI.customerScreen(s);
    case 'record': return UI.recordScreen(s, ui);
    case 'event': return UI.eventScreen(s);
    case 'change': return UI.changeScreen(s, ui);
    case 'run': return UI.runScreen(s);
    case 'fake': return UI.fakeScreen(s);
    case 'pay': return UI.payScreen(s);
    case 'injury': return UI.injuryScreen(s);
    case 'evening': return UI.eveningScreen(s, ui);
    default: return UI.morningScreen(s, ui);
  }
}

let lastKey = '';
let lastSaid = '';
let changeTimer = null;
let runStop = null;

function stopRun() {
  runStop?.();
  runStop = null;
}

// Road safety: the same run, no goods, just dodging.
function watchRoad() {
  const g = s?.today?.challengeGame;
  if (ui.screen !== 'challenge' || g?.type !== 'road' || g.finished || runStop) return;
  const field = app.querySelector('#run-field');
  if (!field) return;
  const timeEl = app.querySelector('#run-time');
  const hitsEl = app.querySelector('#run-got');
  runStop = startRun(field, {
    items: [], training: true, seconds: Ch.CHALLENGES.road.seconds,
    onTick: ({ timeLeft, hits }) => { timeEl.textContent = `${Math.ceil(timeLeft / 1000)}s`; hitsEl.textContent = String(hits); },
    onEnd: (got, info) => { runStop = null; run('ch-road-done', info.hits); },
  });
}

// The market run plays on its own (no re-render until it ends).
// Cheap supplier offers: if you don't decide in time, a rival grabs the deal.
let dealTimer = null;
let dealKey = '';
function watchDeal() {
  const ev = s?.today?.event;
  const timed = s?.phase === 'event' && !ui.screen && ev && !ev.outcome && UI.isTimedEvent(ev.id) && !isJunior(s);
  const key = timed ? `${s.day}|${s.today.idx}|${ev.id}|${!!ev.ctx?.thought}` : '';
  if (key === dealKey) return;
  dealKey = key;
  clearTimeout(dealTimer);
  dealTimer = null;
  if (!timed) return;
  const secs = isGuided(s) ? RULES.dealSecondsLearning : RULES.dealSeconds;
  dealTimer = setTimeout(() => { dealTimer = null; run('event-timeout'); }, secs * 1000);
}

// While you're busy with a customer, the waiting line gets restless.
let queueTimer = null;
let queueKey = '';
function watchQueue() {
  const slow = ['record', 'change', 'fake', 'pay'].includes(s?.phase) && !ui.screen && !isJunior(s);
  const key = slow ? `${s.day}|${s.today.idx}|${s.phase}` : '';
  if (key === queueKey) return;
  queueKey = key;
  clearInterval(queueTimer);
  queueTimer = null;
  if (!slow || E.waiting(s) < 1) return;
  let secs = isGuided(s) ? RULES.queueWaitSecondsLearning : RULES.queueWaitSeconds;
  if (s.phase === 'record') secs *= RULES.queueRecordFactor;
  queueTimer = setInterval(() => {
    if (!E.queueLeave(s)) { clearInterval(queueTimer); queueTimer = null; return; }
    const input = app.querySelector('#titi-in');
    ui.msg = input ? input.value : ui.msg;
    save();
    render();
  }, secs * 1000);
}

function watchRun() {
  if (ui.screen === 'challenge') { watchRoad(); return; }
  if (s?.phase !== 'run' || ui.screen) { stopRun(); return; }
  const field = app.querySelector('#run-field');
  if (!field || runStop) return;
  const timeEl = app.querySelector('#run-time');
  const gotEl = app.querySelector('#run-got');
  const total = s.today.run.items.reduce((a, it) => a + it.qty, 0);
  runStop = startRun(field, {
    items: s.today.run.items,
    seconds: E.runSettings(s).seconds,
    onTick: ({ timeLeft, got }) => {
      timeEl.textContent = `${Math.ceil(timeLeft / 1000)}s`;
      gotEl.textContent = `${Object.values(got).reduce((a, n) => a + n, 0)} / ${total}`;
    },
    injuryChance: E.runSettings(s).injuryChance,
    onEnd: (got, info) => { runStop = null; run('run-done', { got, ...info }); },
  });
}

// The customer's patience while you count the change (not on the learning path).
// Also used for Spot the fake note.
let timerPhase = null;
function watchChangeTimer() {
  const phase = s?.phase;
  const counting = (phase === 'change' || phase === 'fake') && !ui.screen && !isGuided(s) && !s.today.change?.demand && !s.today.change?.extra;
  if (changeTimer && (!counting || timerPhase !== phase)) { clearTimeout(changeTimer); changeTimer = null; }
  if (counting && !changeTimer) {
    timerPhase = phase;
    const secs = phase === 'change' ? E.changeSeconds(s) : RULES.fakeSeconds;
    changeTimer = setTimeout(() => { changeTimer = null; run(phase === 'change' ? 'change-timeout' : 'fake-timeout'); }, secs * 1000);
  }
}

function sayFrom(el) {
  const cid = el.dataset.who;
  Voice.speak(el.dataset.say, { who: cid, she: !!CUST[cid]?.she });
}
function render() {
  UI.startRender();
  app.innerHTML = view();
  // Scroll to top when the screen changes, and keep the chat in view on the tiTi screen.
  const key = `${ui.screen}|${s?.phase}|${s?.day}|${s?.today?.idx}`;
  if (key !== lastKey) {
    window.scrollTo(0, 0);
    app.querySelector('[data-animate]')?.classList.add('enter');
    celebrate();
  }
  lastKey = key;
  rollNumbers();
  // Speak what the customer says, once per new line on screen.
  const say = app.querySelector('[data-say]');
  const said = say ? `${key}|${say.dataset.say}` : '';
  if (say && said !== lastSaid) sayFrom(say);
  lastSaid = said;
  watchChangeTimer();
  watchRun();
  watchQueue();
  watchDeal();
  if (s?.phase === 'record' && !ui.screen) {
    const chat = app.querySelector('.chat');
    chat?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }
}

// Children are only ever counted in anonymous totals.
function juniorCounting() {
  if (Analytics.choice() !== 'off') Analytics.setChoice('no');
}

const actions = {
  'pick-path': (arg) => {
    ui.startPath = arg;
    ui.confirmNew = false;
    if (arg === 'junior') juniorCounting();
  },
  continue: () => { ui.screen = null; },
  'new-game': () => {
    if (!ui.startPath) return;
    if (s && !ui.confirmNew) { ui.confirmNew = true; return; }
    s = E.newGame(ui.startPath);
    ui.screen = ui.startMode === 'multi' && ui.startPath !== 'junior' ? 'multi' : null;
    ui.confirmNew = false;
    ui.buy = {};
  },
  open: (arg) => { if (arg === 'levels') ui.levelsFrom = ui.screen; ui.screen = arg; ui.confirmReset = false; },
  close: () => { ui.editing = null; ui.copied = false;  ui.screen = ui.screen === 'levels' && !s ? 'start' : ui.screen === 'levels' && ui.levelsFrom ? ui.levelsFrom : null; ui.levelsFrom = null; },
  seen: (arg) => { s.seen[arg] = true; },

  pay: (arg) => { E.setPay(s, s.pay + Number(arg)); },
  'pay-bill': (arg) => { ui.error = E.payBill(s, Number(arg)); },
  'topup-open': () => { ui.topUpOpen = true; ui.topUpAmt = ''; ui.topUpError = null; },
  'topup-close': () => { ui.topUpOpen = false; ui.topUpError = null; },
  'topup-set': (arg) => {
    ui.topUpError = null;
    ui.topUpAmt = arg === 'all' ? s.pocket : arg === 'half' ? Math.floor(s.pocket / 100) * 50 : Number(arg);
  },
  'set-goal': (arg) => { const g = GOALS.find((x) => x.id === arg); if (g) { setGoal(s, g.name, g.price); ui.screen = null; ui.error = null; } },
  'clear-goal': () => { clearGoal(s); ui.screen = null; },
  'restart-level': () => { E.restartLevel(s); ui.buy = {}; },
  price: (arg) => {
    const [item, d] = arg.split(':');
    E.setPrice(s, item, s.prices[item] + Number(d));
  },
  'buy-qty': (arg) => {
    const [item, d] = arg.split(':');
    ui.buy[item] = Math.max(0, (ui.buy[item] || 0) + Number(d));
    ui.error = null;
  },
  buy: (arg) => {
    const credit = arg === 'credit';
    const list = Object.entries(ui.buy).filter(([, q]) => q > 0);
    const total = list.reduce((a, [id, q]) => a + q * E.buyPrice(s, id), 0);
    if (!credit && s.cash < total) { ui.error = `You need ${fmt(total)} but have ${fmt(s.cash)}.`; return; }
    for (const [id, q] of list) {
      const err = E.buy(s, id, q, credit);
      if (err) { ui.error = err; return; }
    }
    ui.buy = {};
    ui.error = null;
  },
  'pay-supplier': () => { ui.error = E.paySupplier(s); },
  'open-shop': () => { ui.buy = {}; ui.error = null; E.openShop(s); },

  serve: (arg) => { E.serve(s, arg); ui.msg = ''; },
  'titi-fill': () => {
    const sale = s.today.pending;
    ui.msg = E.suggestMessage(sale, sale.cid ? CUST[sale.cid].name : null);
  },
  'titi-ask': (arg) => { E.titiMessage(s, arg); },
  'record-next': () => { ui.msg = ''; E.skipRecord(s); },

  event: (arg) => { E.chooseEvent(s, Number(arg)); },
  'event-timeout': () => { E.eventTimeout(s); },
  'event-continue': () => { E.continueAfterEvent(s); },

  'evening-next': () => { ui.screen = 'score'; },
  'stage-continue': () => { s.today.stageShown = true; actions['score-next'](); },
  'score-next': () => {
    if (s.today.stageDone && !s.today.stageShown) { ui.screen = 'stage'; return; }
    if (s.today.levelUp) {
      // End-of-level quiz first. It never blocks moving up.
      s.quiz = Quiz.makeQuiz(s, 'level');
      ui.screen = s.quiz ? 'quiz' : E.levelUp(s);
      return;
    }
    E.startDay(s);
    ui.screen = null;
  },
  'levelup-continue': () => { E.startDay(s); ui.screen = null; },
  'done-continue': () => { E.startDay(s); ui.screen = null; },
  'cv-click': () => { /* link opens in a new tab; nothing to track without a backend */ },

  remind: (arg) => { E.remind(s, Number(arg)); },
  'set-path': (arg) => {
    E.setPath(s, arg);
    ui.buy = {};
    if (arg !== 'junior') return;
    juniorCounting();
    if (s.mp) Market.leave().catch(() => {}).finally(() => { E.leaveMarketLocal(s); save(); render(); });
  },
  'record-tap': (arg) => { E.recordTap(s, Number(arg)); },
  'set-voice': (arg) => { Voice.setEnabled(arg); },
  'set-sounds': (arg) => { Fx.setEnabled(arg); if (arg) Fx.play('right'); },
  'challenge-play': () => { const c = s.today.challenge; if (c && !c.done) { s.today.challengeGame = Ch.startChallenge(c.type, Math.random, { roundTo: isJunior(s) ? 100 : 0 }); ui.screen = 'challenge'; } },
  'challenge-skip': () => { E.skipChallenge(s); },
  'pick-mode': (arg) => { ui.startMode = arg; },
  'mp-size': (arg) => { ui.mpSize = Number(arg); },
  'mp-quick': () => { marketCall(() => Market.quickJoin(ui.mpSize || 4, s.level)); },
  'mp-create': () => { marketCall(() => Market.createMarket(ui.mpSize || 4, s.level)); },
  'mp-join-invite': async () => {
    const code = ui.invite;
    if (!code) return;
    await marketCall(() => Market.joinCode(code));
    if (!ui.mpError) { ui.invite = null; render(); }
  },
  'mp-share': async () => {
    const code = s.mp?.code;
    if (!code) return;
    const link = inviteLink(code);
    const text = `Join my market in Oga Shop and let's see whose shop does best! Tap the link, or enter code ${code} in Multiplayer.`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Oga Shop market', text, url: link }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, '_blank', 'noopener');
  },
  'mp-copy': async () => {
    const code = s.mp?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      ui.copied = true;
    } catch {
      ui.mpError = "Copying didn't work on this phone. Send the code instead.";
    }
    render();
  },
  'mp-leave': async () => {
    ui.mpBusy = true;
    render();
    const r = await Market.leave();
    ui.mpBusy = false;
    if (r.error) ui.mpError = r.error;
    else { E.leaveMarketLocal(s); save(); }
    render();
  },
  'account-open': (arg) => { ui.accountFrom = ui.screen === 'account' ? ui.accountFrom : ui.screen; ui.accountMode = arg; ui.accountError = null; ui.screen = 'account'; },
  'account-back': () => { ui.accountError = null; ui.screen = ui.accountFrom ?? (s ? null : 'start'); ui.accountFrom = undefined; },
  conflict: (arg) => {
    const c = ui.conflict;
    ui.conflict = null;
    ui.screen = null;
    if (arg === 'cloud') useCloud(c.cloud);
    else pushNow({ force: true });
  },
  'account-logout': async () => {
    ui.accountError = null;
    if (s && Account.current().dirty && (await pushNow()) !== 'ok') { ui.accountError = "Couldn't save your game. Connect to data, then log out."; render(); return; }
    await Account.logout();
    clearSave();
    s = null;
    Object.assign(ui, { screen: 'start', startPath: null, confirmDelete: false, buy: {} });
    render();
  },
  'account-delete': () => { ui.confirmDelete = true; ui.accountError = null; },
  consent: (arg) => { Analytics.setChoice(arg); },
  advert: () => { ui.error = E.putAdvert(s); },
  'edit-customer': (arg) => { ui.editing = arg || null; ui.error = null; },
  'reset-customer': (arg) => { resetCustom(s, arg); ui.editing = null; },
  'ch-light': () => { const g = s.today.challengeGame; g.rounds[g.round].light = true; },
  'ch-money-pick': (arg) => { Ch.moneyPick(s.today.challengeGame, Number(arg)); },
  'ch-change-tap': (arg) => { Ch.changeTapNote(s.today.challengeGame, Number(arg)); },
  'ch-change-undo': () => { Ch.changeUndoNote(s.today.challengeGame); },
  'ch-change-check': () => { Ch.changeCheck(s.today.challengeGame); },
  'ch-next': () => { Ch.nextRound(s.today.challengeGame); },
  'ch-road-done': (hits) => { Ch.roadResult(s.today.challengeGame, hits); },
  'challenge-finish': () => {
    const g = s.today.challengeGame;
    if (!g.practice) Ch.finishChallenge(s, g);
    s.today.challengeGame = null;
    ui.screen = g.practice ? 'multi' : null;
    if (!s.mp) return;
    E.queueChampion(s, Ch.championResult(g));
    marketSync();
  },
  'champ-play': (arg) => {
    if (!s.mp || !Ch.CHAMPION_TITLES[arg]) return;
    s.today.challengeGame = Ch.startChallenge(arg, Math.random, { practice: true });
    ui.screen = 'challenge';
  },
  'quiz-answer': (arg) => { Quiz.answer(s.quiz, Number(arg)); ui.quizRecords = false; },
  'quiz-check': () => { ui.quizRecords = true; },
  'quiz-next': () => { Quiz.next(s.quiz); ui.quizRecords = false; if (s.quiz.done) Quiz.finish(s, s.quiz); },
  'quiz-finish': () => { s.quiz = null; ui.screen = E.levelUp(s); },
  'quick-answer': (arg) => { const q = s.today.quick; if (q && q.questions[0].picked == null) { Quiz.answer(q, Number(arg)); Quiz.finish(s, q); } ui.quickRecords = false; },
  'quick-check': () => { ui.quickRecords = true; },
  'run-start': () => { E.startRun(s); },
  'run-done': (arg) => { E.runDone(s, arg.got, { injured: arg.injured, by: arg.by }); },
  hospital: (arg) => { E.chooseHospital(s, arg); },
  'run-boy': () => { stopRun(); E.runSendBoy(s); },
  'change-tap': (arg) => { E.changeTap(s, Number(arg)); },
  'change-undo': () => { E.changeUndo(s); },
  'change-give': () => { E.changeDone(s, 'give'); },
  'change-skip': () => { E.changeDone(s, 'skip'); },
  'change-timeout': () => { if (s.phase === 'change' && !s.today.change?.demand && !s.today.change?.extra) E.changeDone(s, 'timeout'); },
  'change-askback': () => { E.changeAskBack(s); },
  'change-letgo': () => { E.changeLetGo(s); },
  'change-balance': () => { E.changeBalance(s); },
  'fake-light': () => { E.fakeLight(s); },
  'pay-next': () => { E.payNext(s); },
  'set-account': (arg) => { E.setPayments(s, { account: arg }); },
  'set-pos': (arg) => { E.setPayments(s, { pos: arg }); },
  'set-account-number': (arg) => { ui.error = E.setPayments(s, { accountNumber: arg }); },
  'fake-pick': (arg) => { E.fakeDone(s, Number(arg)); },
  'fake-skip': () => { E.fakeDone(s, 'skip'); },
  'fake-timeout': () => { if (s.phase === 'fake') E.fakeDone(s, 'timeout'); },
  say: () => { const el = app.querySelector('[data-say]'); if (el) sayFrom(el); },
  reset: () => {
    if (!ui.confirmReset) { ui.confirmReset = true; return; }
    clearSave();
    s = null;
    Object.assign(ui, { screen: 'start', startPath: null, confirmReset: false, buy: {}, msg: '' });
  },
  install: async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    ui.canInstall = false;
    render();
  },
};

const snapshot = () => (s ? { game: s, level: s.level, phase: s.phase, completed: s.completed, quiz: s.quizLog.length, ch: s.challengeLog.length } : null);

// Turn what just happened in the game into counts.
function countProgress(name, was) {
  if (!s) return;
  const detail = { level: s.level, day: s.day, score: s.score };
  if (name === 'new-game' && was?.game !== s) {
    Analytics.track('path', { k: s.path, ...detail });
    Analytics.track('level_start', { k: '1', once: 'level_start_1', ...detail });
  }
  if (!was) return;
  if (was.phase !== 'evening' && s.phase === 'evening') {
    Analytics.track('day_done', { ...detail });
    marketSync(E.dayResult(s));
  }
  if (s.level > was.level) {
    if (s.mp?.kind === 'quick') marketCall(() => Market.quickJoin(s.mp.size, s.level));
    Analytics.track('level_done', { k: String(was.level), once: `level_done_${was.level}`, ...detail });
    Analytics.track('level_start', { k: String(s.level), once: `level_start_${s.level}`, ...detail });
  }
  if (s.completed && !was.completed) Analytics.track('level_done', { k: String(s.level), once: `level_done_${s.level}`, ...detail });
  if (s.quizLog.length > was.quiz) {
    const q = s.quizLog.at(-1);
    Analytics.track('quiz', { k: q.kind, v: Math.round((q.correct / q.total) * 100), ...detail });
  }
  if (s.challengeLog.length > was.ch) {
    const c = s.challengeLog.at(-1);
    Analytics.track('challenge', { k: c.type, v: c.ok ? 1 : 0, ...detail });
  }
}

let flushTimer = null;
function flushSoon() {
  if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; Analytics.flush(); }, 5000);
}

// ---------- Game feel ----------

// A screen that has just appeared: stars ring one by one, big wins get confetti.
function celebrate() {
  try {
    app.querySelectorAll('.star-on').forEach((_, i) => setTimeout(() => Fx.play('star'), 150 + i * 300));
    if (app.querySelector('[data-confetti]')) { Fx.confetti(); Fx.play('level'); Fx.buzz([40, 60, 40]); }
  } catch { /* never break the game */ }
}

// Cash and profit roll to their new value instead of jumping.
const shown = {};
function rollNumbers() {
  try {
    for (const el of app.querySelectorAll('[data-count]')) {
      const name = el.dataset.count;
      const now = Number(el.dataset.value);
      if (shown[name] != null && shown[name] !== now) Fx.countUp(el, shown[name], now, fmt);
      shown[name] = now;
    }
  } catch { /* never break the game */ }
}

function chState() {
  const g = s?.today?.challengeGame;
  const r = g?.rounds?.[g.round];
  return r ? { round: g.round, correct: g.correct, answered: r.picked != null || r.done != null } : null;
}

const feelBefore = () => (s?.today ? {
  sales: s.today.sales, moneyIn: s.today.moneyIn, reaction: s.today.reaction, pending: s.today.pending,
  recorded: s.today.pending?.recorded, chat: s.today.chat?.length || 0, ch: chState(),
} : null);

// Sounds and the little "+N" after what the player just did.
function feel(b) {
  try {
    const t = s?.today;
    if (!t || !b) return;
    if (t.sales > b.sales) {
      Fx.play('sale');
      Fx.buzz(20);
      if (t.moneyIn > b.moneyIn) Fx.floatText(`+${fmt(t.moneyIn - b.moneyIn)}`);
    } else if (t.reaction && t.reaction !== b.reaction && t.reaction.mood === 'sad') {
      Fx.play('wrong');
      Fx.buzz([30, 40, 30]);
    }
    const c = chState();
    if (c && b.ch && c.round === b.ch.round && c.answered && !b.ch.answered) Fx.play(c.correct > b.ch.correct ? 'right' : 'wrong');
    if (t.pending && t.pending === b.pending && !b.recorded && t.pending.recorded) Fx.play('right');
    else if ((t.chat?.length || 0) > b.chat && /^(Not quite|Almost)/.test(t.chat.at(-1)?.text || '')) Fx.play('wrong');
  } catch { /* never break the game */ }
}

function run(name, arg) {
  const fn = actions[name];
  if (!fn) return;
  const was = snapshot();
  const before = feelBefore();
  fn(arg);
  feel(before);
  countProgress(name, was);
  flushSoon();
  save();
  render();
}

app.addEventListener('click', (e) => {
  if (e.target.closest('a[href*="creditvoiceai.com"]')) { Analytics.track('cv_click', { once: 'cv_click' }); Analytics.flush(); }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  if (el.tagName === 'INPUT') return; // radios use "change"
  if (el.tagName !== 'A') e.preventDefault();
  run(el.dataset.action, el.dataset.arg);
});

app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('input[type="radio"][data-action]')) run(el.dataset.action, el.value);
  if (el.matches('input[type="checkbox"][data-action]')) run(el.dataset.action, el.checked);
  if (el.matches('input[data-action="set-account-number"]')) run(el.dataset.action, el.value);
});

app.addEventListener('input', (e) => {
  if (e.target.id === 'titi-in') ui.msg = e.target.value;
  if (e.target.id === 'topup-amt') {
    ui.topUpAmt = e.target.value;
    const preview = app.querySelector('#topup-preview');
    if (preview) preview.textContent = UI.topUpPreview(s, e.target.value);
  }
});

app.addEventListener('submit', (e) => {
  const accountFormEl = e.target.closest('[data-form="signup"], [data-form="login"]');
  if (accountFormEl) {
    e.preventDefault();
    accountForm(accountFormEl.dataset.form, accountFormEl.elements);
    return;
  }
  const deleteForm = e.target.closest('[data-form="delete-account"]');
  if (deleteForm) {
    e.preventDefault();
    Account.remove(deleteForm.elements.pin.value).then((err) => {
      ui.accountError = err;
      if (!err) ui.confirmDelete = false;
      render();
    });
    return;
  }
  const codeForm = e.target.closest('[data-form="mp-code"]');
  if (codeForm) {
    e.preventDefault();
    marketCall(() => Market.joinCode(codeForm.elements.code.value));
    return;
  }
  const customerForm = e.target.closest('[data-form="customer"]');
  if (customerForm) {
    e.preventDefault();
    const f = customerForm.elements;
    ui.error = setCustom(s, ui.editing, { name: f.name.value, she: f.she.value === '1', happy: f.happy.value, unhappy: f.unhappy.value });
    if (!ui.error) ui.editing = null;
    save();
    render();
    return;
  }
  const topUpForm = e.target.closest('[data-form="topup"]');
  if (topUpForm) {
    e.preventDefault();
    ui.topUpError = E.topUp(s, topUpForm.elements.amount.value);
    if (!ui.topUpError) { ui.topUpOpen = false; ui.topUpAmt = ''; }
    save();
    render();
    return;
  }
  const goalForm = e.target.closest('[data-form="goal"]');
  if (goalForm) {
    e.preventDefault();
    ui.error = setGoal(s, goalForm.elements.name.value, goalForm.elements.price.value);
    if (!ui.error) ui.screen = null;
    save();
    render();
    return;
  }
  const form = e.target.closest('[data-form="titi"]');
  if (!form) return;
  e.preventDefault();
  const text = form.elements.msg.value;
  ui.msg = '';
  E.titiMessage(s, text);
  save();
  render();
  if (!s.today.pending?.recorded) app.querySelector('#titi-in')?.focus();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  ui.canInstall = true;
  if (ui.screen === 'settings') render();
});

// Counting: this visit, how long it took to load, and send what's waiting when there's data.
Analytics.startVisit();
syncNow().then(() => marketSync());
window.addEventListener('online', () => pushNow());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushNow(); });
window.addEventListener('load', () => setTimeout(() => {
  const nav = performance.getEntriesByType?.('navigation')?.[0];
  if (nav?.loadEventEnd > 0) Analytics.track('load', { v: Math.round(nav.loadEventEnd), once: 'first_load' });
  Analytics.flush();
}, 0));
window.addEventListener('online', () => Analytics.flush());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Analytics.flush(); });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

render();
