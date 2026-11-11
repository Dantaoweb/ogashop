// App shell: saving, which screen to show, and button handling.
import * as E from './engine.js';
import * as UI from './ui.js';
import { LEVELS } from './data.js';
import { CUST, fmt, setCustom, resetCustom, applyCustom } from './core.js';
import * as Voice from './voice.js';
import * as Fx from './fx.js';
import * as Cups from './cups.js';
import { VENUES, venueOf } from './venues.js';
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

// home: the player's own game, the one that is saved. s: the shop on screen (home, or a championship shop inside it).
let home = load();
let s = home;
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

// A shared championship link (?cup=ABCDEF) opens Championships with that code ready.
function readCupInvite() {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has('cup')) return null;
    const code = (url.searchParams.get('cup') || '').trim().toUpperCase();
    url.searchParams.delete('cup');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    return /^[A-Z]{6}$/.test(code) ? code : null;
  } catch { return null; }
}
const cupInvite = readCupInvite();
if (cupInvite && !isJunior(s)) {
  ui.cupInvite = cupInvite;
  if (s) ui.screen = 'cups';
}
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
  if (!home) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(home)); } catch { /* storage full or blocked: keep playing */ }
  if (Account.loggedIn()) { Account.markDirty(); pushSoon(); }
}

// ---------- Cloud save ----------

let pushTimer = null;
function pushSoon() {
  if (!pushTimer) pushTimer = setTimeout(() => { pushTimer = null; pushNow(); }, 8000);
}

const summary = (g) => g && { level: g.level, day: g.day, score: g.score };

async function pushNow({ force = false } = {}) {
  if (!home || !Account.loggedIn()) return 'failed';
  if (!force && !Account.current().dirty) return 'ok';
  const result = await Account.push(JSON.stringify(home), { force });
  if (result === 'conflict') await offerChoice();
  return result;
}

function useCloud(cloud) {
  const data = JSON.parse(cloud.data);
  home = data.v === E.SAVE_VERSION ? E.migrate(data) : home;
  s = home;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(home)); } catch { /* keep playing */ }
  Account.adopted(cloud.version);
  ui.buy = {};
  ui.screen = s?.quiz ? 'quiz' : null;
}

async function offerChoice() {
  const cloud = await Account.pull();
  if (!cloud?.data) return;
  ui.conflict = { cloud, cloudGame: summary(JSON.parse(cloud.data)), local: summary(home) };
  ui.screen = 'conflict';
  render();
}

// After logging in, or on opening the app: bring this phone and the account together.
async function syncNow() {
  const me = Account.current();
  if (!me) return;
  const cloud = await Account.pull();
  if (!cloud) return;
  if (!cloud.data) { if (home) await pushNow({ force: true }); return; }
  if (cloud.version === Account.current()?.base) { if (Account.current()?.dirty) await pushNow(); return; }
  if (!home || (!Account.current().dirty && Account.current().base > 0)) { useCloud(cloud); render(); return; }
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
  if (!home?.mp || !Account.loggedIn()) return;
  const sent = home.mp.champQueue || [];
  const r = await Market.sync(result, sent);
  if (!home?.mp) return;
  if (r.view) {
    E.applyMarketView(home, r.view);
    home.mp.champQueue = home.mp.champQueue.filter((c) => !sent.includes(c));
  }
  else if (r.status === 404) E.leaveMarketLocal(home);
  else return;
  save();
  if (s.phase === 'morning' || ui.screen === 'multi') render();
}

// ---------- Championships ----------

async function cupCall(fn) {
  ui.cupBusy = true;
  ui.cupError = null;
  render();
  const r = await fn();
  ui.cupBusy = false;
  if (r.error) ui.cupError = r.error;
  else if (home) {
    const cup = Cups.applyCupView(home, r.view);
    ui.cupCode = cup.code;
    ui.screen = 'cup';
    save();
  }
  render();
  return r;
}

// Send each championship your numbers and new games, and get the latest tables back.
let cupSyncing = false;
async function cupSyncAll() {
  if (!home?.cups?.length || !Account.loggedIn() || isJunior(home) || cupSyncing) return;
  cupSyncing = true;
  try {
    for (const cup of [...home.cups]) {
      if (cup.final) continue;
      const sent = cup.games;
      const was = Cups.cupStatus(cup);
      const r = await Market.cupSync(cup.code, Cups.bizToSend(home, cup), sent);
      if (r.view) {
        Cups.applyCupView(home, r.view);
        cup.games = cup.games.filter((g) => !sent.includes(g));
        const now = r.view.cup.status;
        if (now === 'running' && was === 'open') home.today?.notices.push(`${cup.name} has started! Your championship shop is ready: same cash, stock and customers for everyone.`);
        if (now === 'ended') { cup.final = true; Cups.awardCup(home, cup); }
        if (now === 'cancelled') { cup.final = true; home.today?.notices.push(`${cup.name} was cancelled before it started. Your game is not affected.`); }
      } else if (r.status === 404) Cups.removeCup(home, cup.code);
    }
    if (s?.cupCode && !Cups.findCup(home, s.cupCode)) s = home;
    save();
    if (s.phase === 'morning' || ['cups', 'cup'].includes(ui.screen)) render();
  } finally {
    cupSyncing = false;
  }
}

function cupLink(code) {
  return `${location.origin}${location.pathname}?cup=${code}`;
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
    ui.screen = ['multi', 'cups'].includes(ui.accountFrom) ? ui.accountFrom : s ? null : 'start';
    await syncNow();
    await marketSync();
    await cupSyncAll();
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
  if (s?.trophyNews?.length && ((s.phase === 'morning' && !ui.screen) || ['cups', 'cup', 'trophies'].includes(ui.screen))) return UI.trophyScreen(s, s.trophyNews[0]);
  if (ui.screen === 'trophies' && s) return UI.trophiesScreen(s);
  if (ui.screen === 'cups' && s) return UI.cupsScreen(s, ui);
  if (ui.screen === 'cup-new' && s && ui.cupForm) return UI.cupNewScreen(s, ui);
  if (ui.screen === 'cup-preview' && s && ui.cupPreview) return UI.cupPreviewScreen(s, ui);
  if (ui.screen === 'cup' && s && Cups.findCup(s, ui.cupCode)) return UI.cupScreen(s, ui);
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
  secs *= venueOf(s)?.queue || 1;
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
  if (ui.sheet && (ui.screen || s?.phase !== 'morning')) ui.sheet = null;
  UI.startRender();
  UI.setShops(home && s ? (home.cups || []).filter((c) => c.shop && !Cups.cupOver(c)).map((c) => ({ code: c.code, name: c.name })) : [], s?.cupCode || 'home');
  if (s?.cupCode) s.cupDone = Cups.shopDone(Cups.findCup(home, s.cupCode));
  app.innerHTML = view() + (ui.sheet && s ? UI.sheetHtml(s, ui) : '');
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
    s = home = E.newGame(ui.startPath);
    ui.screen = ui.startPath === 'junior' ? null : ui.cupInvite ? 'cups' : ui.startMode === 'multi' ? 'multi' : null;
    ui.confirmNew = false;
    ui.buy = {};
  },
  open: (arg) => {
    // Settings, markets and championships belong to your own shop.
    if (['settings', 'multi', 'cups', 'trophies', 'levels'].includes(arg) && s !== home && home) { s = home; applyCustom(home); } if (arg === 'levels') ui.levelsFrom = ui.screen; ui.screen = arg; ui.confirmReset = false; },
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
  'open-shop': () => {
    if (s.cupCode && Cups.shopDone(Cups.findCup(home, s.cupCode))) return;
    ui.buy = {}; ui.error = null; E.openShop(s);
  },
  sheet: (arg) => { ui.sheet = arg; ui.topUpOpen = false; ui.topUpError = null; },
  'sheet-close': () => { ui.sheet = null; ui.topUpOpen = false; },
  'shop-switch': (arg) => {
    const cup = arg === 'home' ? null : Cups.findCup(home, arg);
    s = cup?.shop || home;
    applyCustom(s);
    ui.screen = null;
    ui.buy = {};
    ui.msg = '';
    ui.error = null;
  },

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
    s = home = null;
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
    ui.screen = g.practice ? g.from || 'multi' : null;
    Cups.queueCupGame(home, Ch.cupResult(g), g.cupCode || s.cupCode);
    cupSyncAll();
    if (!s.mp) return;
    E.queueChampion(s, Ch.championResult(g));
    marketSync();
  },
  'cup-play': (arg) => {
    const cup = Cups.findCup(home, ui.cupCode);
    if (!cup || !Cups.gamesCount(cup) || !cup.events.includes(arg) || !Cups.EVENT_INFO[arg]?.game) return;
    s.today.challengeGame = { ...Ch.startChallenge(arg, Math.random, { practice: true }), from: 'cup', cupCode: cup.code };
    ui.screen = 'challenge';
  },
  'trophy-continue': () => { s.trophyNews.shift(); },
  'trophy-cabinet': () => { s.trophyNews.shift(); ui.screen = 'trophies'; },
  'cup-new': () => {
    ui.cupForm = { ...Cups.STANDARD_RULES, events: [...Cups.STANDARD_RULES.events], house: {} };
    ui.cupEditing = null;
    ui.cupError = null;
    ui.screen = 'cup-new';
  },
  'cup-standard': () => { cupCall(() => Market.cupCreate(Cups.rulesBody(Cups.STANDARD_RULES, home.level))); },
  'cup-edit': () => {
    const c = Cups.findCup(home, ui.cupCode)?.view?.cup;
    if (!c) return;
    ui.cupForm = { name: Math.max(0, Cups.CUP_NAMES.indexOf(c.name)), kind: c.kind, length: c.length, size: c.size, events: [...c.events], levelFrom: c.levelFrom, levelTo: c.levelTo, start: c.startMode === 'host' ? 'host' : 'hour', house: { ...(c.house || {}) }, venue: c.venue || 'classic' };
    ui.cupEditing = ui.cupCode;
    ui.cupError = null;
    ui.screen = 'cup-new';
  },
  'cup-name': (arg) => { ui.cupForm.name = Number(arg); },
  'cup-rule': (arg) => {
    const r = Cups.HOUSE_RULES[arg];
    if (!r) return;
    const h = { ...ui.cupForm.house };
    if (h[arg] != null) delete h[arg];
    else h[arg] = r.amount ? r.amount[3] : arg === 'goal' ? 'fees' : true;
    if (!Cups.houseList(h).length) delete h.strict;
    ui.cupForm.house = h;
    // Events that need a house rule go when it goes.
    ui.cupForm.events = ui.cupForm.events.filter((e) => !(e === 'goal' && !h.goal) && !(e === 'keeper' && !Cups.houseList(h).length));
  },
  'cup-rule-amt': (arg) => {
    const [k, d] = String(arg).split(':');
    const r = Cups.HOUSE_RULES[k];
    const h = ui.cupForm.house;
    if (!r?.amount || h[k] == null) return;
    const [min, max, step] = r.amount;
    h[k] = Math.min(max, Math.max(min, h[k] + Number(d) * step));
  },
  'cup-goal': (arg) => { if (Cups.goalById(arg)) ui.cupForm.house.goal = arg; },
  'cup-strict': (arg) => { ui.cupForm.house.strict = !!arg; },

  'cup-kind': (arg) => { if (Cups.CUP_KINDS[arg]) { ui.cupForm.kind = arg; ui.cupForm.length = 7; } },
  'cup-length': (arg) => { ui.cupForm.length = Number(arg); },
  'cup-size': (arg) => { ui.cupForm.size = Math.min(Cups.CUP_MAX_SIZE, Math.max(Cups.CUP_MIN_START, ui.cupForm.size + Number(arg))); },
  'cup-from': (arg) => { ui.cupForm.levelFrom = Math.min(ui.cupForm.levelTo, Math.max(1, ui.cupForm.levelFrom + Number(arg))); },
  'cup-to': (arg) => { ui.cupForm.levelTo = Math.min(7, Math.max(ui.cupForm.levelFrom, ui.cupForm.levelTo + Number(arg))); },
  'cup-event': (arg) => {
    const ev = ui.cupForm.events;
    ui.cupForm.events = ev.includes(arg) ? ev.filter((e) => e !== arg) : Cups.CUP_EVENTS.filter((e) => e === arg || ev.includes(e));
  },
  'cup-create': () => {
    const f = ui.cupForm;
    if (!f.events.length) { ui.cupError = 'Choose at least one event.'; return; }
    const body = Cups.rulesBody(f, home.level);
    cupCall(() => (ui.cupEditing ? Market.cupUpdate(ui.cupEditing, body) : Market.cupCreate(body)));
  },
  'cup-preview': async (arg) => {
    const code = String(arg || ui.cupInvite || '').trim().toUpperCase();
    if (!code) return;
    ui.cupBusy = true;
    ui.cupError = null;
    render();
    const r = await Market.cupInfo(code);
    ui.cupBusy = false;
    if (r.error) ui.cupError = r.error;
    else if (r.view.registered) { Cups.applyCupView(home, r.view); ui.cupCode = code; ui.cupInvite = null; ui.screen = 'cup'; save(); }
    else { ui.cupPreview = r.view; ui.screen = 'cup-preview'; }
    render();
  },
  'cup-register': async () => {
    const code = ui.cupPreview?.cup?.code;
    if (!code) return;
    const r = await cupCall(() => Market.cupJoin(code, home.level));
    if (!r.error) { ui.cupInvite = null; ui.cupPreview = null; render(); }
  },
  'cup-venue': (arg) => { if (VENUES[arg]) ui.cupForm.venue = arg; },
  'cup-start': (arg) => {
    if (ui.screen === 'cup-new') { ui.cupForm.start = arg; return; }
    cupCall(() => Market.cupStart(ui.cupCode));
  },
  'cup-open': (arg) => { ui.cupCode = arg; ui.cupError = null; ui.copied = false; ui.confirmCupLeave = false; ui.screen = 'cup'; cupSyncAll(); },
  'cup-back': () => { ui.screen = 'cups'; ui.copied = false; ui.cupError = null; ui.confirmCupLeave = false; },
  'cup-share': async () => {
    const code = ui.cupCode;
    const cup = Cups.findCup(home, code);
    if (!cup) return;
    const text = `Register for my ${cup.name} in Oga Shop! Read the rules and join with the link, or enter code ${code} in Championships.`;
    if (navigator.share) {
      try { await navigator.share({ title: cup.name, text, url: cupLink(code) }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${cupLink(code)}`)}`, '_blank', 'noopener');
  },
  'cup-copy': async () => {
    try {
      await navigator.clipboard.writeText(cupLink(ui.cupCode));
      ui.copied = true;
    } catch {
      ui.cupError = "Copying didn't work on this phone. Send the code instead.";
    }
    render();
  },
  'cup-leave': async () => {
    if (!ui.confirmCupLeave) { ui.confirmCupLeave = true; return; }
    ui.confirmCupLeave = false;
    const code = ui.cupCode;
    ui.cupBusy = true;
    render();
    const r = await Market.cupLeave(code);
    ui.cupBusy = false;
    if (r.error && r.status !== 401) ui.cupError = r.error;
    else { if (s.cupCode === code) s = home; Cups.removeCup(home, code); ui.screen = 'cups'; save(); }
    render();
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
    s = home = null;
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
  // A championship shop: check its house rules in the evening and send its numbers; it isn't counted as your game.
  if (s !== home) {
    if (was && was.phase !== 'evening' && s.phase === 'evening') { Cups.dayRules(home, s); cupSyncAll(); }
    return;
  }
  const detail = { level: s.level, day: s.day, score: s.score };
  if (name === 'new-game' && was?.game !== s) {
    Analytics.track('path', { k: s.path, ...detail });
    Analytics.track('level_start', { k: '1', once: 'level_start_1', ...detail });
  }
  if (!was) return;
  if (was.phase !== 'evening' && s.phase === 'evening') {
    Analytics.track('day_done', { ...detail });
    marketSync(E.dayResult(s));
    cupSyncAll();
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
  if (el.matches('input[type="checkbox"][data-action]')) run(el.dataset.action, ['cup-event', 'cup-rule'].includes(el.dataset.action) ? el.value : el.checked);
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
  const cupForm = e.target.closest('[data-form="cup-code"]');
  if (cupForm) {
    e.preventDefault();
    actions['cup-preview'](cupForm.elements.code.value);
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
syncNow().then(() => marketSync()).then(() => cupSyncAll());
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
