// App shell: saving, which screen to show, and button handling.
import * as E from './engine.js';
import * as UI from './ui.js';
import { LEVELS } from './data.js';
import { CUST, fmt } from './core.js';

const SAVE_KEY = 'ogashop.save.v1';
const app = document.getElementById('app');

let s = load();
// Screens on top of the day loop: start | settings | debts | score | level2 | done
const ui = { screen: s ? null : 'start', startPath: null, buy: {}, msg: '', error: null, confirmNew: false, confirmReset: false, canInstall: false };
let installPrompt = null;

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const data = raw && JSON.parse(raw);
    return data && data.v === E.SAVE_VERSION ? data : null;
  } catch {
    return null;
  }
}

function save() {
  if (!s) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage full or blocked: keep playing */ }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

function view() {
  if (ui.screen === 'start' || !s) {
    const info = s ? `Level ${s.level} · ${LEVELS[s.level].name} · Day ${s.day} · Score ${s.score}` : '';
    return UI.startScreen(ui, !!s, info);
  }
  if (ui.screen === 'settings') return UI.settingsScreen(s, ui);
  if (ui.screen === 'debts') return UI.debtsScreen(s);
  if (ui.screen === 'score') return UI.scoreScreen(s);
  if (ui.screen === 'level2') return UI.level2Screen(s);
  if (ui.screen === 'done') return UI.doneScreen(s);
  switch (s.phase) {
    case 'morning': return UI.morningScreen(s, ui);
    case 'selling': return UI.customerScreen(s);
    case 'record': return UI.recordScreen(s, ui);
    case 'event': return UI.eventScreen(s);
    case 'evening': return UI.eveningScreen(s);
    default: return UI.morningScreen(s, ui);
  }
}

let lastKey = '';
function render() {
  app.innerHTML = view();
  // Scroll to top when the screen changes, and keep the chat in view on the tiTi screen.
  const key = `${ui.screen}|${s?.phase}|${s?.day}|${s?.today?.idx}`;
  if (key !== lastKey) window.scrollTo(0, 0);
  lastKey = key;
  if (s?.phase === 'record' && !ui.screen) {
    const chat = app.querySelector('.chat');
    chat?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }
}

const actions = {
  'pick-path': (arg) => { ui.startPath = arg; ui.confirmNew = false; },
  continue: () => { ui.screen = null; },
  'new-game': () => {
    if (!ui.startPath) return;
    if (s && !ui.confirmNew) { ui.confirmNew = true; return; }
    s = E.newGame(ui.startPath);
    ui.screen = null;
    ui.confirmNew = false;
    ui.buy = {};
  },
  open: (arg) => { ui.screen = arg; ui.confirmReset = false; },
  close: () => { ui.screen = null; },
  seen: (arg) => { s.seen[arg] = true; },

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
  'event-continue': () => { E.continueAfterEvent(s); },

  'evening-next': () => { ui.screen = 'score'; },
  'score-next': () => {
    if (s.today.levelUp) { ui.screen = E.levelUp(s); return; }
    E.startDay(s);
    ui.screen = null;
  },
  'levelup-continue': () => { E.startDay(s); ui.screen = null; },
  'done-continue': () => { E.startDay(s); ui.screen = null; },
  'cv-click': () => { /* link opens in a new tab; nothing to track without a backend */ },

  remind: (arg) => { E.remind(s, Number(arg)); },
  'set-path': (arg) => { s.path = arg; },
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

function run(name, arg) {
  const fn = actions[name];
  if (!fn) return;
  fn(arg);
  save();
  render();
}

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  if (el.tagName === 'INPUT') return; // radios use "change"
  if (el.tagName !== 'A') e.preventDefault();
  run(el.dataset.action, el.dataset.arg);
});

app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('input[type="radio"][data-action]')) run(el.dataset.action, el.value);
});

app.addEventListener('input', (e) => {
  if (e.target.id === 'titi-in') ui.msg = e.target.value;
});

app.addEventListener('submit', (e) => {
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

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

render();
