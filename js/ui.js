// Screens. Each returns an HTML string; buttons carry data-action (and data-arg) handled in main.js.
import { GOODS, LEVELS, BADGES, NOTES, EXPLAIN, TYPE_LABEL, CREDITVOICE_URL, RULES, GOALS } from './data.js';
import { CUST, fmt, goodsForLevel, buyPrice, supplierOwed, owedToYou, openDebts, supplierCreditError } from './core.js';
import { currentCustomer, eventView, scoreParts, suggestMessage, billsDueSoon, billOwed, cashNeededSoon, isStuck } from './engine.js';
import { face, good, scene } from './art.js';
import { goalStatus, daysToGoal, howLong } from './goals.js';
import * as Voice from './voice.js';
import { runnerSvg } from './run.js';
import { result as quizResult } from './quiz.js';

export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
const PATHS = {
  stall: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v1.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9z"/><path d="M5 13.5V20h14v-6.5"/><path d="M10 20v-4h4v4"/>',
  case: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  cap: '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/><path d="M22 8v6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  rain: '<path d="M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17.5 15z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  store: '<path d="M4 10v10h16V10"/><path d="M2 10l2-6h16l2 6z"/><path d="M9 20v-6h6v6"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
  truck: '<path d="M2 6h12v10H2z"/><path d="M14 9h4l4 4v3h-8"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M9 13l2 2 4-4"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3h5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a3 3 0 0 1 0 6M18.5 6.5a7 7 0 0 1 0 11"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
};
export const icon = (name, size = 24, sw = 1.8) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${P} stroke-width="${sw}" aria-hidden="true">${PATHS[name] || ''}</svg>`;

const BADGE_ICON = { first_sale: 'coin', record_keeper: 'doc', fully_stocked: 'box', never_lost_debt: 'check', debt_free_week: 'calendar', goal_reached: 'star', know_business: 'search' };

const stockChip = (s, id, lowAt) => `<span class="chip${s.stock[id] <= lowAt ? ' low' : ''}">${good(id, 18)}${esc(GOODS[id].short)} ${s.stock[id]}</span>`;
const items = (list) => list.map((it) => `${it.qty} ${GOODS[it.item].short.toLowerCase()}`).join(' and ');
const btn = (action, label, cls = 'primary', arg = '', extra = '') =>
  `<button type="button" class="btn ${cls}" data-action="${action}"${arg !== '' ? ` data-arg="${esc(arg)}"` : ''} ${extra}>${label}</button>`;

// Marks what a customer says, so main.js can speak it; adds a button to hear it again.
const sayAttrs = (text, cid) => `data-say="${esc(text)}" data-who="${cid}"`;
const sayBtn = () => (Voice.supported && Voice.enabled()
  ? `<button type="button" class="icon-btn say-btn" data-action="say" aria-label="Hear it again">${icon('sound', 20)}</button>` : '');
const quoted = (text) => (text.match(/"([^"]+)"/) || [])[1] || '';

function titi(text, extra = '') {
  return `<div class="titi-tip"${extra}><span class="avatar">tiTi</span><p>${text}</p></div>`;
}

function explain(s, key) {
  if (s.path !== 'learning' || s.seen['ex_' + key]) return '';
  return `<div class="card explain"><div class="row"><span class="avatar">tiTi</span><b>New idea</b></div>
    <p style="margin:0;font-size:15px">${esc(EXPLAIN[key])}</p>
    <button type="button" class="btn small secondary" data-action="seen" data-arg="ex_${key}">Got it</button></div>`;
}

function topBar(s, { title, kicker, tiles = true, dark = false } = {}) {
  const owed = openDebts(s, { recordedOnly: true }).length;
  return `<header class="top${dark ? ' dark' : ''}">
    <div class="between">
      <div class="grow"><div class="kicker">${esc(kicker || `Level ${s.level} · ${LEVELS[s.level].name}`)}</div>
        <h1 class="title display">${esc(title)}</h1></div>
      <span class="pill" aria-label="Business score ${s.score}">Score ${s.score}</span>
      <button type="button" class="icon-btn" data-action="open" data-arg="records" aria-label="My records">${icon('doc')}</button>
      <button type="button" class="icon-btn" data-action="open" data-arg="debts" aria-label="Who owes you">${icon('people')}${owed ? `<span class="badge-dot">${owed}</span>` : ''}</button>
      <button type="button" class="icon-btn" data-action="open" data-arg="settings" aria-label="Settings">${icon('gear')}</button>
    </div>
    ${tiles ? `<div class="grid3">
      <div class="tile"><span>Cash</span><span>${fmt(s.cash)}</span></div>
      <div class="tile"><span>Profit (level)</span><span>${fmt(s.levelProfit)}</span></div>
      <div class="tile"><span>Owed to you</span><span>${fmt(owedToYou(s))}</span></div>
    </div>` : ''}
  </header>`;
}

// ---------- Start ----------

export function startScreen(ui, hasSave, saveInfo) {
  const choice = (path, ico, bg, color, title, desc) => `
    <button type="button" class="path-btn" data-action="pick-path" data-arg="${path}" aria-pressed="${ui.startPath === path}">
      <span class="ico" style="background:${bg};color:${color}">${icon(ico, 26)}</span>
      <span><b>${title}</b><span class="d">${desc}</span></span>
    </button>`;
  return `<main class="screen">
    <div class="body" style="gap:24px;padding-top:40px">
      <div class="center" style="display:flex;flex-direction:column;gap:12px">
        <div class="scene-card">${scene(1, { cid: 'mamabola', stock: { rice: 1, garri: 1, water: 1, recharge: 1 } })}</div>
        <h1 class="display" style="font-size:42px">Oga Shop</h1>
        <p class="muted" style="margin:0;font-size:17px">Grow from a small market table to a big company.</p>
      </div>
      ${hasSave ? `<div class="card strong"><b>Continue your business</b><span class="muted small">${esc(saveInfo)}</span>
        ${btn('continue', 'Continue', 'primary block')}</div>
        <h2 class="small muted" style="text-transform:uppercase;letter-spacing:.06em">Or start again</h2>` :
        '<h2 class="small muted" style="text-transform:uppercase;letter-spacing:.06em">How do you want to play?</h2>'}
      <div style="display:flex;flex-direction:column;gap:12px">
        ${choice('business', 'case', 'var(--green-soft)', 'var(--green)', 'I run a business', 'Real market situations. Fewer explanations, faster days.')}
        ${choice('learning', 'cap', 'var(--amber-soft)', 'var(--amber-ink)', 'I\'m learning business', 'A gentle start. tiTi explains each new idea as you go.')}
        <p class="small muted center" style="margin:0">Same levels and score either way. Switch any time in Settings.</p>
      </div>
    </div>
    <div class="foot">
      ${ui.confirmNew ? '<div class="toast">This replaces your saved game. Tap again to confirm.</div>' : ''}
      ${btn('new-game', hasSave ? 'Start a new game' : 'Start my first day', hasSave ? 'secondary block' : 'primary block', '', ui.startPath ? '' : 'disabled')}
      <p class="small muted center" style="margin:0">A learning game by CreditVoice. No real money. Your progress is saved on this phone.</p>
    </div>
  </main>`;
}

// ---------- Morning ----------

function billsCard(s) {
  const bills = billsDueSoon(s);
  if (!bills.length) return '';
  const rows = bills.map((b) => {
    const days = b.due - s.day;
    const when = b.due < s.day ? `<span style="color:var(--red);font-weight:700">Late · +${fmt(RULES.billLateFee)} a day</span>`
      : days === 0 ? '<span style="color:var(--amber-ink);font-weight:700">Due tonight</span>' : `Due Day ${b.due} (in ${days} day${days > 1 ? 's' : ''})`;
    return `<div class="between"><div><b>${esc(b.label)} · ${fmt(billOwed(b))}</b><div class="small muted">${when}</div></div>
      ${btn('pay-bill', 'Pay now', 'secondary small', b.id, s.cash < billOwed(b) ? 'disabled' : '')}</div>`;
  }).join('');
  return `<div class="card warn"><h3>Bills coming</h3>${rows}<span class="small muted">Bills are paid from the business cash. Keep money aside for them.</span></div>`;
}

// The savings goal inside the daily pay card.
function goalBox(s) {
  const g = goalStatus(s);
  if (!g) return `<div class="between" style="padding-top:10px;border-top:1px dashed var(--line)"><span class="small muted">Saving for something? Your pocket can be your savings.</span>${btn('open', 'Choose a goal', 'secondary small', 'goals')}</div>`;
  return `<div style="display:flex;flex-direction:column;gap:6px;padding-top:10px;border-top:1px dashed var(--line)">
    <div class="between"><b class="small">My goal: ${esc(g.name)}</b><button type="button" class="link" data-action="open" data-arg="goals" style="padding:4px 0">Change</button></div>
    <div class="progress lg"><div style="width:${g.pct}%"></div></div>
    <div class="between small"><span class="muted">${fmt(g.saved)} of ${fmt(g.price)} (${g.pct}%)</span></div>
    <span class="small" style="color:var(--ink-2)">${esc(g.when)}</span></div>`;
}

// Warn when buying stock would leave too little for bills due soon.
function billWarning(s, cost) {
  const need = cashNeededSoon(s);
  const left = s.cash - cost;
  if (!need || left >= need) return '';
  const next = billsDueSoon(s)[0];
  return `<span class="small" style="color:var(--red);font-weight:600">After buying you'll have ${fmt(left)}, but the ${esc(next.label.toLowerCase())} (${fmt(billOwed(next))}) is due on Day ${next.due}.</span>`;
}

export function morningScreen(s, ui) {
  const t = s.today;
  const goods = goodsForLevel(s.level);
  const draft = ui.buy;
  const cost = goods.reduce((a, id) => a + (draft[id] || 0) * buyPrice(s, id), 0);
  const credErr = s.level >= 2 && cost ? supplierCreditError(s, cost) : null;
  const expiring = (id) => s.batches.filter((b) => b.item === id && b.exp === s.day).reduce((a, b) => a + b.qty, 0);
  const rows = goods.map((id) => {
    const g = GOODS[id];
    const low = s.stock[id] <= 2;
    const asked = (s.lastAsks || {})[id] || 0;
    const exp = expiring(id);
    const margin = s.prices[id] - buyPrice(s, id);
    return `<div class="stock-row${low ? ' low' : ''}">
      <div class="between"><span class="good-ico">${good(id, 36)}</span><div class="grow"><b>${esc(g.name)}</b> <span class="muted small">(${esc(g.unit)})</span>
        <div class="small ${low ? '' : 'muted'}" style="${low ? 'color:var(--amber-ink);font-weight:600' : ''}">${s.stock[id]} in stock · buy ${fmt(buyPrice(s, id))}${exp ? ` · <span style="color:var(--red);font-weight:700">${exp} go bad tonight</span>` : ''}${asked ? `<div class="small" style="color:var(--red);font-weight:700">Customers asked for this ${asked}× yesterday</div>` : ''}</div></div>
        ${low ? '<span class="tag solid">Low</span>' : `<span class="small" style="font-weight:700;color:${margin > 0 ? 'var(--green)' : 'var(--red)'}">${margin >= 0 ? '+' : ''}${fmt(margin)} each</span>`}
      </div>
      <div class="controls">
        <div><div class="ctl-label">Sell price</div><div class="stepper">
          <button type="button" class="step" data-action="price" data-arg="${id}:-50" aria-label="Lower ${esc(g.name)} price">−</button>
          <output>${fmt(s.prices[id])}</output>
          <button type="button" class="step" data-action="price" data-arg="${id}:50" aria-label="Raise ${esc(g.name)} price">+</button></div></div>
        <div><div class="ctl-label">Buy more</div><div class="stepper">
          <button type="button" class="step" data-action="buy-qty" data-arg="${id}:-1" aria-label="Buy one less ${esc(g.name)}" ${draft[id] ? '' : 'disabled'}>−</button>
          <output>${draft[id] || 0}</output>
          <button type="button" class="step" data-action="buy-qty" data-arg="${id}:1" aria-label="Buy one more ${esc(g.name)}">+</button></div></div>
      </div>
    </div>`;
  }).join('');
  const sup = supplierOwed(s);
  return `<main class="screen">
    ${topBar(s, { title: `Day ${s.day} · Morning` })}
    <div class="body">
      ${explain(s, s.level === 2 ? 'level2' : 'morning')}
      ${t.notices.map((n) => `<div class="notice">${esc(n)}</div>`).join('')}
      ${sup ? `<div class="card warn"><div class="between"><div><b>You owe your supplier ${fmt(sup)}</b>
        <div class="small muted">${s.supplier.some((d) => d.late) ? 'Late! Pay to get credit again.' : `Due Day ${Math.min(...s.supplier.map((d) => d.due))}`}</div></div>
        ${btn('pay-supplier', 'Pay', 'secondary small')}</div></div>` : ''}
      ${billsCard(s)}
      ${isStuck(s) ? `<div class="card bad"><b>You have no stock and no money to buy any.</b>
        <span class="small">tiTi: "This happens when all the cash goes to stock and bills come. Next time keep some cash aside."</span>
        ${btn('restart-level', `Start Level ${s.level} again`, 'primary small block')}</div>` : ''}
      ${explain(s, 'pay')}
      <div class="card"><div class="between"><div><b>Your daily pay</b><div class="small muted">Moves to your pocket each evening · Pocket: <b style="color:var(--ink)">${fmt(s.pocket)}</b></div>
        ${s.pocket > 0 ? `<button type="button" class="link" data-action="topup" style="padding:6px 0;color:var(--green)">Put ${fmt(s.pocket)} into the business${s.goal ? ' (takes it from your goal)' : ''}</button>` : ''}</div>
        <div class="stepper"><button type="button" class="step" data-action="pay" data-arg="-500" aria-label="Lower your daily pay" ${s.pay <= 0 ? 'disabled' : ''}>−</button>
          <output>${fmt(s.pay)}</output>
          <button type="button" class="step" data-action="pay" data-arg="500" aria-label="Raise your daily pay">+</button></div></div>
        ${goalBox(s)}</div>
      <div class="between"><h2 style="font-size:18px">Your stock</h2><span class="small muted">Set prices, buy stock</span></div>
      <div class="list">${rows}</div>
      ${ui.error ? `<div class="toast" role="alert">${esc(ui.error)}</div>` : ''}
      ${s.level >= 2 && cost && credErr ? `<span class="small muted">${esc(credErr)}</span>` : ''}
    </div>
    <div class="foot">
      ${cost ? `<div class="card strong" style="gap:8px"><div class="between"><b>Buy stock</b><b>${fmt(cost)}</b></div>
        <div class="${s.level >= 2 ? 'grid2' : ''}">
          ${btn('buy', s.cash < cost ? `Need ${fmt(cost - s.cash)} more` : 'Pay cash', 'primary small block', 'cash', s.cash < cost ? 'disabled' : '')}
          ${s.level >= 2 ? btn('buy', 'Supplier credit', 'secondary small block', 'credit', credErr ? 'disabled' : '') : ''}
        </div>
        ${s.level >= 2 && !credErr ? '<span class="small muted">Supplier credit: pay in 3 days.</span>' : ''}
        ${billWarning(s, cost)}</div>`
      : btn('open-shop', 'Open shop', 'primary block')}
    </div>
  </main>`;
}

// ---------- Selling ----------

// "Send for more now": normal price plus transport. The customer waits.
function rushButton(s, v, cls) {
  const r = v.rush;
  const short = s.cash < r.cost;
  return `<button type="button" class="choice ${cls}" data-action="serve" data-arg="restock" ${short ? 'disabled' : ''}>
    <b>${icon('truck', 16)} Send for more now (${fmt(r.cost)})</b>
    <span>${short ? `You have only ${fmt(s.cash)}.` : `${esc(r.items.map((it) => `${it.qty} ${GOODS[it.item].short.toLowerCase()}`).join(' and '))} at normal price + ${fmt(r.fee)} transport. ${v.customer.name} waits.`}</span></button>`;
}

// "Run to the market yourself": no transport fee, if you catch everything in time.
function runButton(s, v) {
  const r = v.rush;
  const short = s.cash < r.goods;
  const what = r.items.map((it) => `${it.qty} ${GOODS[it.item].short.toLowerCase()}`).join(' and ');
  return `<button type="button" class="choice" data-action="run-start" ${short ? 'disabled' : ''}>
    <b>${icon('person', 16)} Run to the market yourself (${fmt(r.goods)})</b>
    <span>${short ? `You have only ${fmt(s.cash)}.` : `No transport fee. Catch ${esc(what)} in ${RULES.runSeconds} seconds, or ${esc(v.customer.name)} leaves.`}</span></button>`;
}

function askedNote(t, missing) {
  const n = Math.max(...missing.map((i) => t.asks[i] || 0));
  return n ? ` ${n} customer${n > 1 ? 's' : ''} already asked today.` : '';
}

export function customerScreen(s) {
  const v = currentCustomer(s);
  const t = s.today;
  const c = v.customer;
  const mood = t.outcome ? (t.outcome.tone === 'bad' ? 'sad' : 'neutral') : 'happy';
  const loyal = s.customers[c.id].loyalty === 2;
  const wanted = items(v.items.length ? v.items : t.queue[t.idx].items);
  let speech;
  if (v.kind === 'credit') {
    speech = v.paysNow > 0
      ? `Give me ${wanted}. I'll pay ${fmt(v.paysNow)} now and bring the rest on Day ${s.day + 2}.`
      : `Give me ${wanted}. I'll pay you everything on Day ${s.day + 2}, I promise.`;
  } else if (v.kind === 'discount') {
    speech = `${wanted} for ${fmt(v.discTotal)}? Abeg, reduce it small.`;
  } else if (c.type === 'big') {
    speech = `I need ${wanted} for a party.`;
  } else {
    speech = `Good morning! Give me ${wanted}, please.`;
  }

  let actions;
  if (t.outcome) {
    const words = quoted(t.outcome.text);
    actions = `<div class="card ${t.outcome.tone === 'bad' ? 'bad' : ''}" ${words ? sayAttrs(words, c.id) : ''}><p style="margin:0">${esc(t.outcome.text)}</p></div>
      ${btn('serve', 'Next customer', 'primary block', 'next')}`;
  } else if (!v.items.length) {
    actions = `<div class="card warn"><b>You have no ${esc(v.missing.map((i) => GOODS[i].short.toLowerCase()).join(' or '))}.</b><span class="small muted">Running out means lost sales.${askedNote(t, v.missing)}</span></div>
      ${rushButton(s, v, 'primary')}
      ${runButton(s, v)}
      ${btn('serve', 'Sorry, I don\'t have it', 'secondary block', 'sell')}`;
  } else {
    const ch = (action, cls, title, sub) => `<button type="button" class="choice ${cls}" data-action="serve" data-arg="${action}"><b>${title}</b><span>${sub}</span></button>`;
    const parts = [];
    if (v.kind === 'credit') {
      parts.push(ch('cashonly', 'primary', 'Cash only', `Ask for ${fmt(v.total)} now`));
      parts.push(ch('credit', 'credit', 'Give credit', `${fmt(v.paysNow)} now, owes ${fmt(v.total - v.paysNow)}`));
    } else if (v.kind === 'discount') {
      parts.push(ch('sell', 'primary', 'Give discount', `${fmt(v.discTotal)} (you lose ${fmt(v.total - v.discTotal)})`));
      parts.push(ch('fullprice', '', 'Full price', `Ask for ${fmt(v.total)}. ${c.she ? 'She' : 'He'} may leave.`));
    } else {
      parts.push(ch('sell', 'primary', `Sell for ${fmt(v.total)}`, 'Cash now'));
      parts.push(ch('discount', '', 'Give discount', `${fmt(v.discTotal)}: less profit, happier customer`));
    }
    parts.push(ch('refuse', '', 'Refuse', `${c.she ? 'She' : 'He'} may not come back`));
    actions = `${v.rush ? rushButton(s, v, '') + runButton(s, v) : ''}<div class="grid2">${parts.join('')}</div>`;
  }

  const order = v.items.length ? `<div class="between small" style="padding-top:10px;border-top:1px dashed var(--line)">
      <span class="muted" style="display:flex;flex-direction:column;gap:4px">${v.items.map((it) => `<span class="row" style="gap:6px">${good(it.item, 22)}${it.qty} × ${esc(GOODS[it.item].short)} @ ${fmt(it.price)}</span>`).join('')}</span><b>${fmt(v.total)}</b></div>
      ${v.missing.length ? `<span class="small" style="color:var(--amber-ink);font-weight:600">Not enough ${esc(v.missing.map((i) => GOODS[i].short.toLowerCase()).join(', '))}: you can only sell what you have.</span>` : ''}` : '';

  return `<main class="screen">
    <header class="top" style="flex-direction:row;align-items:center;justify-content:space-between">
      <div><div class="kicker">Day ${s.day} · Selling</div><div class="title display">${v.clock}</div></div>
      <div class="row"><div style="text-align:right"><div class="kicker">Cash</div><b>${fmt(s.cash)}</b></div>
        <button type="button" class="icon-btn" data-action="open" data-arg="prices" aria-label="Change prices">${icon('tag')}</button>
        <button type="button" class="icon-btn" data-action="open" data-arg="debts" aria-label="Who owes you">${icon('people')}</button></div>
    </header>
    <div style="padding:10px 16px 0" class="row"><span class="small muted" style="font-weight:600">Customer ${v.number} of ${v.of}</span>
      <div class="progress grow"><div style="width:${Math.round(((v.number - 1) / v.of) * 100)}%"></div></div></div>
    <div class="body">
      ${v.kind === 'credit' ? explain(s, 'credit') : v.kind === 'discount' || c.type === 'bargainer' ? explain(s, 'discount') : ''}
      <div class="center" style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div class="scene-card">${scene(s.level, { cid: c.id, mood, stock: s.stock })}</div>
        <b style="font-size:21px">${esc(c.name)}</b>
        <div class="wrap" style="justify-content:center"><span class="tag ${c.type === 'regular' ? 'green' : 'amber'}">${TYPE_LABEL[c.type]}</span>${loyal ? '<span class="tag green">Loyal</span>' : ''}</div>
      </div>
      <div class="card" ${t.outcome ? '' : sayAttrs(speech, c.id)}><div class="between" style="align-items:flex-start"><p class="speech">“${esc(speech)}”</p>${t.outcome ? '' : sayBtn()}</div>${order}</div>
      ${t.flash ? `<div class="notice" data-animate>${icon('truck', 16)} ${esc(t.flash)}</div>` : ''}
      ${actions}
    </div>
    <div class="foot" style="background:none;position:static"><span class="small muted" style="font-weight:600">Stock now</span>
      <div class="wrap">${goodsForLevel(s.level).map((id) => stockChip(s, id, 2)).join('')}</div></div>
  </main>`;
}

// ---------- Record with tiTi ----------

// The customer's face and what they say after a sale.
function reaction(r) {
  if (!r) return '';
  return `<div class="reaction" data-animate ${sayAttrs(r.text, r.cid)}>
    <span class="mini-face lg">${face(r.cid, { size: 56, mood: r.mood })}</span>
    <div class="grow"><b class="small">${esc(CUST[r.cid].name)}</b><div class="say">“${esc(r.text)}”</div>
      ${r.note ? (r.mood === 'sad'
        ? `<div class="small" style="color:var(--red);font-weight:700">${esc(r.note)}</div>`
        : `<div class="small" style="color:var(--green);font-weight:700">${icon('check', 14, 3)} ${esc(r.note)}</div>`) : ''}</div>
    ${sayBtn()}
  </div>`;
}

export function recordScreen(s, ui) {
  const t = s.today;
  const sale = t.pending;
  const name = sale.cid ? CUST[sale.cid].name : null;
  const msgs = t.chat.map((m) => {
    if (m.card) {
      const c = m.card;
      return `<div class="bubble titi card-msg"><div class="row"><span class="avatar" style="width:24px;height:24px">${icon('check', 14, 3)}</span><b>Sale recorded</b></div>
        <dl class="kv">${c.name ? `<dt>Customer</dt><dd>${esc(c.name)}</dd>` : ''}<dt>Items</dt><dd>${esc(items(c.what))}</dd>
        ${c.discount ? `<dt>Price</dt><dd>${fmt(c.listTotal)}</dd><dt>Discount</dt><dd style="color:var(--red)">−${fmt(c.discount)}</dd>` : ''}
        <dt>Total</dt><dd>${fmt(c.total)}</dd><dt>Paid</dt><dd>${fmt(c.paid)}</dd>
        ${c.owes ? `<dt>Owes</dt><dd style="color:var(--amber-ink);font-weight:700">${fmt(c.owes)}</dd><dt>Due</dt><dd>Day ${c.due}</dd>` : ''}</dl>
        ${c.owes ? `<p class="small" style="margin:0;padding-top:8px;border-top:1px dashed var(--line)">${s.level >= 2 ? 'You can remind them from "Who owes you" on the due day.' : 'Recorded debts get paid back far more often.'}</p>` : ''}</div>`;
    }
    return `<div class="bubble ${m.from}">${esc(m.text)}</div>`;
  }).join('');
  const done = sale.recorded;
  const suggestion = suggestMessage(sale, name);
  return `<main class="screen">
    <header class="row" style="background:var(--surface);border-bottom:1px solid var(--line);padding:12px 16px">
      <span class="avatar lg">tiTi</span>
      <div class="grow"><b style="font-size:18px">tiTi</b><div class="small muted">Your shop assistant · records your sales</div></div>
      <span class="small muted" style="font-weight:600">Day ${s.day}</span>
    </header>
    <div class="body">
      ${reaction(t.reaction)}
      ${explain(s, 'record')}
      <div class="chat" aria-live="polite">${msgs}</div>
      <div class="wrap">
        <button type="button" class="chip" data-action="titi-ask" data-arg="who owes me?" style="color:var(--green);font-weight:600;min-height:40px">Who owes me?</button>
        <button type="button" class="chip" data-action="titi-ask" data-arg="what's my profit today?" style="color:var(--green);font-weight:600;min-height:40px">My profit today?</button>
        <button type="button" class="chip" data-action="open" data-arg="records" style="color:var(--green);font-weight:600;min-height:40px">My records</button>
      </div>
    </div>
    <div class="composer">
      ${done ? btn('record-next', 'Next customer →', 'primary block') : `
        <button type="button" class="suggest" data-action="titi-fill">Type it for me: “${esc(suggestion)}”</button>
        <form data-form="titi"><label for="titi-in" class="sr-only">Tell tiTi what you sold</label>
          <input id="titi-in" name="msg" type="text" autocomplete="off" autocapitalize="off" placeholder="e.g. sold 3 garri 1650 cash" value="${esc(ui.msg)}">
          <button type="submit" class="btn primary" style="width:48px;min-height:48px;padding:0;border-radius:14px" aria-label="Send to tiTi">${icon('send', 22, 2)}</button></form>
        <div class="between"><button type="button" class="link" data-action="record-next">Skip recording</button>
          <span class="small muted">${sale.total > sale.paid ? 'Unrecorded credit can be forgotten.' : 'Unrecorded sales lower your score.'}</span></div>`}
    </div>
  </main>`;
}

// ---------- Market run ----------

export function runScreen(s) {
  const r = s.today.run;
  const total = r.items.reduce((a, it) => a + it.qty, 0);
  const what = r.items.map((it) => `${it.qty} ${GOODS[it.item].short.toLowerCase()}`).join(' and ');
  return `<main class="screen">
    <header class="top" style="flex-direction:row;align-items:center;justify-content:space-between">
      <div><div class="kicker">Market run · ${esc(CUST[r.cid].name)} is waiting</div><div class="title display">Catch ${esc(what)}</div></div>
      <div style="text-align:right"><div class="kicker">Time</div><b id="run-time" style="font-size:22px">${RULES.runSeconds}s</b></div></header>
    <div class="body" style="gap:10px">
      <div class="between"><span class="wrap">${r.items.map((it) => `<span class="chip">${good(it.item, 18)}${esc(GOODS[it.item].short)}</span>`).join('')}</span>
        <b id="run-got">0 / ${total}</b></div>
      <div id="run-field" class="run-field" role="application" aria-label="Market run. Tap left or right to change lane.">
        <div class="runner">${runnerSvg()}</div></div>
      <div class="grid2"><button type="button" id="run-left" class="btn secondary" aria-label="Move left">${icon('back', 22, 2.4)} Left</button>
        <button type="button" id="run-right" class="btn secondary" aria-label="Move right">Right <span style="display:inline-block;transform:scaleX(-1)">${icon('back', 22, 2.4)}</span></button></div>
      <span class="small muted">Catch the goods. Dodge puddles, okadas and wheelbarrows: each bump costs 2 seconds.</span>
    </div>
    <div class="foot"><button type="button" class="link" data-action="run-boy" style="align-self:center">Send the boy instead (+${fmt(RULES.rushFee)} transport)</button></div>
  </main>`;
}

// ---------- Count the change ----------

export function changeScreen(s, ui) {
  const c = s.today.change;
  const given = c.given.reduce((a, n) => a + n, 0);
  const timed = s.path !== 'learning';
  const notes = RULES.changeNotes.map((n) => `<button type="button" class="note-btn" data-action="change-tap" data-arg="${n}" aria-label="Add ${fmt(n)}">${fmt(n)}</button>`).join('');
  return `<main class="screen">
    <header class="top" style="flex-direction:row;align-items:center;justify-content:space-between">
      <div><div class="kicker">Day ${s.day} · Count the change</div><div class="title display">Give the right change</div></div></header>
    <div class="body">
      <div class="reaction" ${sayAttrs(`Here is ${fmt(c.handed)}.`, c.cid)}><span class="mini-face lg">${face(c.cid, { size: 56 })}</span>
        <div class="grow"><b class="small">${esc(CUST[c.cid].name)}</b><div class="say">“Here is ${fmt(c.handed)}.”</div></div>${sayBtn()}</div>
      ${timed ? `<div class="progress lg" aria-hidden="true"><div class="patience" style="animation-duration:${RULES.changeSeconds}s"></div></div>
        <span class="small muted">${esc(CUST[c.cid].name)} is waiting…</span>` : ''}
      <div class="card"><div class="between"><span class="muted">The sale</span><b>${fmt(c.total)}</b></div>
        <div class="between"><span class="muted">Customer paid</span><b>${fmt(c.handed)}</b></div>
        <div class="between" style="padding-top:8px;border-top:1px dashed var(--line)"><span>You are giving</span><b style="font-size:22px">${fmt(given)}</b></div>
        ${c.given.length ? `<div class="wrap">${c.given.map((n) => `<span class="chip">${fmt(n)}</span>`).join('')}</div>` : '<span class="small muted">Tap the notes below to count the change.</span>'}
        ${s.path === 'learning' ? `<span class="small" style="color:var(--green)">Change = what they paid − the sale.</span>` : ''}</div>
      <div class="grid2">${notes}</div>
    </div>
    <div class="foot">
      <div class="grid2">${btn('change-undo', 'Undo', 'secondary small', '', c.given.length ? '' : 'disabled')}${btn('change-give', 'Give change', 'primary small', '', c.given.length ? '' : 'disabled')}</div>
      <button type="button" class="link" data-action="change-skip" style="align-self:center">Let tiTi count it</button>
    </div>
  </main>`;
}

// ---------- Event ----------

export function eventScreen(s) {
  const v = eventView(s);
  const choices = v.choices.map((c, i) => `<button type="button" class="choice${i === 0 ? ' primary' : ''}" data-action="event" data-arg="${i}" ${c.disabled ? 'disabled' : ''}>
      <b>${esc(c.label)}</b><span>${esc(c.disabled || c.sub || '')}</span></button>`).join('');
  return `<main class="screen"><div class="event-wrap"><div class="sheet" role="dialog" aria-labelledby="ev-title">
    <div class="between"><span class="tag solid" style="text-transform:uppercase;letter-spacing:.08em">Event</span><span class="small muted" style="font-weight:600">Day ${s.day}</span></div>
    <div class="ev-icon">${icon(v.icon, 36)}</div>
    <div style="display:flex;flex-direction:column;gap:8px"><h1 id="ev-title" class="display" style="font-size:28px">${esc(v.title)}</h1>
      <p style="margin:0;font-size:16px;color:var(--ink-2)">${esc(v.text)}</p></div>
    ${explain(s, 'event')}
    ${v.outcome ? `${titi(esc(v.outcome))}${btn('event-continue', 'Continue', 'primary block')}` : `<div style="display:flex;flex-direction:column;gap:10px">${choices}</div>`}
  </div></div></main>`;
}

// ---------- Evening ----------

function stars(n) {
  return `<div class="row" style="gap:4px" role="img" aria-label="${n} of 3 stars">${[0, 1, 2].map((i) =>
    `<svg width="28" height="28" viewBox="0 0 24 24" fill="${i < n ? '#F5B70A' : 'none'}" stroke="${i < n ? '#F5B70A' : '#6B7B71'}" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">${PATHS.star}</svg>`).join('')}</div>`;
}

// Everything that left the business today: costs (lower profit) and personal money (lower cash only).
function moneyOut(s) {
  const t = s.today;
  const row = (label, amount, tag, color) => `<div class="between small"><span>${esc(label)}${tag ? ` <span class="tag ${color}">${tag}</span>` : ''}</span><b>${fmt(amount)}</b></div>`;
  const rows = [
    ...t.expenses.map((e) => row(e.label, e.amount, 'Business cost', 'amber')),
    ...t.personal.map((p) => row(p.label, p.amount, p.from === 'pocket' ? 'From your pocket' : 'From business money', p.from === 'pocket' ? 'green' : 'red')),
    ...(t.paidSelf ? [row('Your daily pay', t.paidSelf, 'To your pocket', 'green')] : []),
  ];
  if (!rows.length) return '';
  return `<div class="card"><h3>Money out</h3>${rows.join('')}
    <span class="small muted">Business costs lower your profit. Personal money and your pay only lower your cash. Pocket now: <b style="color:var(--ink)">${fmt(s.pocket)}</b></span></div>
    ${t.personal.length ? explain(s, 'personal') : ''}`;
}

export function eveningScreen(s, ui = {}) {
  const t = s.today;
  const debts = openDebts(s);
  const debtRows = debts.map((d) => `<div class="between" style="${d.recorded ? '' : 'background:var(--red-soft);margin:0 -8px;padding:8px;border-radius:10px'}">
      <span>${esc(CUST[d.cid].name)} <span class="small ${d.recorded ? 'muted' : ''}" style="${d.recorded ? '' : 'color:var(--red);font-weight:700'}">· ${d.recorded ? (d.due < s.day ? `late since Day ${d.due}` : `due Day ${d.due}`) : 'not recorded'}</span></span>
      <b style="${d.recorded ? '' : 'color:var(--red)'}">${fmt(d.amount)}${d.recorded ? '' : '?'}</b></div>`).join('');
  const happened = [
    ...t.repaid.map((r) => `${CUST[r.cid].name} paid back ${fmt(r.amount)}.`),
    ...t.lostDebts.map((r) => `${CUST[r.cid].name}'s ${fmt(r.amount)} is lost${r.recorded ? '' : ' (it was never recorded)'}.`),
    ...t.wasted.map((w) => `${w.qty} ${GOODS[w.item].short.toLowerCase()} ${w.label}.`),
    ...(t.billNotes || []),
    ...(t.complaints.length ? [`${t.complaints.length} customer${t.complaints.length > 1 ? 's' : ''} complained about prices you raised during the day.`] : []),
    ...(t.creditWalkouts.length ? [`${t.creditWalkouts.length} trusted customer${t.creditWalkouts.length > 1 ? 's' : ''} left because you refused credit.`] : []),
    ...(t.goodCalls.length ? [`Good call: you refused credit to ${[...new Set(t.goodCalls)].map((c) => CUST[c].name).join(' and ')}.`] : []),
    ...(t.discounts ? [`Discounts given today: ${fmt(t.discounts)}. That came straight off your profit.`] : []),
  ];
  return `<main class="screen">
    <header class="top dark" style="flex-direction:row;align-items:center;justify-content:space-between">
      <div><div class="kicker">Evening</div><h1 class="title display">Day ${s.day} results</h1></div>${stars(t.stars)}
    </header>
    <div class="body">
      <div class="grid2">
        <div class="card"><span class="small muted" style="font-weight:600">Money in</span><b class="display" style="font-size:26px">${fmt(t.moneyIn)}</b></div>
        <div class="card soft"><span class="small" style="font-weight:600;color:var(--green)">Profit</span><b class="display" style="font-size:26px;color:${t.profit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(t.profit)}</b></div>
      </div>
      ${t.salesValue > 0 ? `<p class="small" style="margin:0;color:var(--ink-2)">You sold goods worth ${fmt(t.salesValue)}, but they cost you ${fmt(t.cogs)}. Busy is not the same as profitable.${t.creditGiven ? ` ${fmt(t.creditGiven)} of today's sales were on credit: profit, but not cash yet.` : ''}</p>` : ''}
      ${t.quick ? quickCard(t.quick, ui) : ''}
      ${moneyOut(s)}
      ${happened.length ? `<div class="card"><h3>Today</h3>${happened.map((h) => `<span class="small">${esc(h)}</span>`).join('')}</div>` : ''}
      <div class="card"><h3>Who owes you</h3>${debtRows || '<span class="small muted">Nobody owes you money.</span>'}</div>
      <div class="card"><h3>Stock left</h3><div class="wrap">${goodsForLevel(s.level).map((id) => stockChip(s, id, 0)).join('')}</div></div>
      ${t.goalReached ? `<div class="card soft pop" style="align-items:center;text-align:center"><span class="badge"><span class="disc">${icon('star', 26)}</span></span>
        <b style="font-size:20px">Goal reached: ${esc(t.goalReached.name)}!</b>
        <span class="small">You saved ${fmt(t.goalReached.price)} from your own pay${t.goalReached.days ? ` in ${t.goalReached.days} days` : ''}, without touching the business money.</span>
        ${btn('open', 'Choose your next goal', 'primary small', 'goals')}</div>` : ''}
      ${titi(`<b>Tip:</b> ${esc(t.tip)}`)}
      ${t.noteKey ? `<div class="card warn"><b>Did you know?</b><span style="font-size:15px">${esc(NOTES[t.noteKey])}</span></div>` : ''}
    </div>
    <div class="foot">${btn('evening-next', 'See my score', 'primary block')}</div>
  </main>`;
}

// ---------- Score ----------

export function scoreScreen(s) {
  const t = s.today;
  const L = LEVELS[s.level];
  const p = scoreParts(s);
  const C = 2 * Math.PI * 52;
  const bar = (label, v) => `<div style="display:flex;flex-direction:column;gap:5px"><div class="between small"><span style="font-weight:600">${label}</span><b>${Math.round(v * 100)}</b></div>
    <div class="progress lg ${v < 0.5 ? 'amber' : ''}"><div style="width:${Math.round(v * 100)}%"></div></div></div>`;
  const goal = (label, now, of, txt) => `<div class="between small"><span class="muted">${label}</span><b>${txt}</b></div>
    <div class="progress lg"><div style="width:${Math.min(100, Math.round((now / of) * 100))}%"></div></div>`;
  const delta = t.scoreDelta || 0;
  return `<main class="screen">
    <div class="body">
      <div class="between"><h1 class="display" style="font-size:24px">Business score</h1><span class="small muted" style="font-weight:600">Level ${s.level} · Day ${s.day}</span></div>
      <div class="card row" style="flex-direction:row;gap:16px">
        <div class="ring"><svg width="112" height="112" viewBox="0 0 120 120" role="img" aria-label="Score ${s.score} out of 100">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#E3F0E8" stroke-width="12"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="#0E6B43" stroke-width="12" stroke-linecap="round" stroke-dasharray="${((s.score / 100) * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/></svg>
          <div class="num"><b>${s.score}</b><span class="small muted">of 100</span></div></div>
        <div style="display:flex;flex-direction:column;gap:6px"><b style="color:${delta >= 0 ? 'var(--green)' : 'var(--red)'}">${delta >= 0 ? '+' : ''}${delta} today</b>
          <span class="small" style="color:var(--ink-2)">Your score comes from good habits, not just cash.</span></div>
      </div>
      <div class="card">${bar('Recording sales', p.recording)}${bar('Debt recovery', p.debts)}${bar('Stock management', p.stock)}${bar('Profit', p.profit)}${bar('Money habits', p.money)}${bar('Happy customers', p.customers)}</div>
      <div class="card strong"><h3>${s.completed ? 'Free play' : `Goal to finish Level ${s.level}`}</h3>
        ${goal('Profit this level', Math.max(0, s.levelProfit), L.goalProfit, `${fmt(s.levelProfit)} / ${fmt(L.goalProfit)}`)}
        ${goal('Business score', s.score, L.goalScore, `${s.score} / ${L.goalScore}`)}
        ${L.maxLateDays ? `<span class="small muted">And no debt more than ${L.maxLateDays} days late.</span>` : ''}</div>
      <div style="display:flex;flex-direction:column;gap:8px"><h3 style="font-size:16px">Badges</h3>
        <div class="badges">${Object.entries(BADGES).map(([id, b]) => {
          const has = s.badges.includes(id);
          return `<div class="badge${has ? '' : ' locked'}" title="${esc(b.desc)}"><span class="disc">${icon(has ? BADGE_ICON[id] : 'lock', 24)}</span>${esc(b.name)}${t.newBadges?.includes(id) ? '<span class="tag solid">New</span>' : ''}</div>`;
        }).join('')}</div></div>
    </div>
    <div class="foot">${btn('score-next', t.levelUp ? `Finish Level ${s.level}!` : `Start Day ${s.day + 1}`, t.levelUp ? 'amber block' : 'primary block')}</div>
  </main>`;
}

// ---------- Quiz and records ----------

// One question with its options; after answering, right/wrong and the explanation.
function questionBlock(q, { answerAction, checkAction, showRecords }) {
  const answered = q.picked != null;
  const opts = q.options.map((o, i) => {
    let cls = '';
    if (answered && i === q.answer) cls = ' right';
    else if (answered && i === q.picked) cls = ' wrong';
    return `<button type="button" class="choice quiz-opt${cls}" data-action="${answerAction}" data-arg="${i}" ${answered ? 'disabled' : ''}><b>${esc(o)}</b></button>`;
  }).join('');
  return `<b style="font-size:18px">${esc(q.text)}</b>
    <div style="display:flex;flex-direction:column;gap:8px">${opts}</div>
    ${q.records && !answered ? (showRecords ? titi(`<b>Your records:</b> ${esc(q.records.replace(/^Your records: |^Your prices: |^Your days: /, ''))}`) : `<button type="button" class="link" data-action="${checkAction}" style="align-self:flex-start;color:var(--green)">${icon('doc', 16)} Check my records</button>`) : ''}
    ${answered ? titi(`${q.picked === q.answer ? '<b>Correct!</b>' : '<b>Not quite.</b>'} ${esc(q.explain)}`) : ''}`;
}

function quickCard(quiz, ui) {
  const q = quiz.questions[0];
  return `<div class="card strong"><span class="tag solid" style="align-self:flex-start">Quick question</span>
    ${questionBlock(q, { answerAction: 'quick-answer', checkAction: 'quick-check', showRecords: ui.quickRecords })}</div>`;
}

export function quizScreen(s, ui) {
  const quiz = s.quiz;
  const header = `<header class="top"><div class="kicker">Level ${quiz.level} · ${esc(LEVELS[quiz.level].name)}</div><h1 class="title display">Know your business</h1></header>`;
  if (quiz.done) {
    const r = quizResult(quiz);
    const good = r.correct / r.total >= 0.8;
    return `<main class="screen">${header}<div class="body">
      <div class="card ${good ? 'soft' : ''} pop" style="align-items:center;text-align:center">
        <b class="display" style="font-size:40px">${r.correct} of ${r.total}</b>
        <b>${good ? 'You know your business!' : 'Good try. Your records can answer these questions.'}</b>
        ${good && s.badges.includes('know_business') ? `<span class="tag solid">${icon('search', 14)} Know your business badge</span>` : ''}
        <span class="small muted">This doesn't change your score. Moving up is never blocked.</span></div>
      ${titi('In real life, your records answer these questions for you: who buys most, what sells most, who owes you. Record every sale.')}
    </div><div class="foot">${btn('quiz-finish', 'Continue', 'primary block')}</div></main>`;
  }
  const q = quiz.questions[quiz.index];
  return `<main class="screen">${header}
    <div style="padding:10px 16px 0" class="row"><span class="small muted" style="font-weight:600">Question ${quiz.index + 1} of ${quiz.questions.length}</span>
      <div class="progress grow"><div style="width:${Math.round((quiz.index / quiz.questions.length) * 100)}%"></div></div></div>
    <div class="body">${questionBlock(q, { answerAction: 'quiz-answer', checkAction: 'quiz-check', showRecords: ui.quizRecords })}</div>
    <div class="foot">${q.picked != null ? btn('quiz-next', quiz.index < quiz.questions.length - 1 ? 'Next question' : 'See my result', 'primary block') : ''}</div>
  </main>`;
}

export function recordsScreen(s) {
  const mine = s.sales.filter((x) => x.level === s.level && x.cid);
  const rec = mine.filter((x) => x.recorded);
  const missing = mine.length - rec.length;
  const byItem = {};
  const byCust = {};
  for (const x of rec) {
    for (const it of x.items) {
      byItem[it.item] = byItem[it.item] || { qty: 0, money: 0 };
      byItem[it.item].qty += it.qty;
      byItem[it.item].money += it.qty * it.price;
    }
    byCust[x.cid] = byCust[x.cid] || { times: 0, money: 0 };
    byCust[x.cid].times++;
    byCust[x.cid].money += x.total;
  }
  const items = Object.entries(byItem).sort((a, b) => b[1].qty - a[1].qty);
  const custs = Object.entries(byCust).sort((a, b) => b[1].times - a[1].times);
  const days = s.history.filter((h) => h.level === s.level);
  const best = [...days].sort((a, b) => b.profit - a.profit)[0];
  return `<main class="screen">
    <header class="top"><div class="row"><button type="button" class="icon-btn" data-action="close" aria-label="Back" style="margin-left:-10px">${icon('back', 22, 2)}</button>
      <div><div class="kicker">Level ${s.level} · ${esc(LEVELS[s.level].name)}</div><h1 class="title display">My records</h1></div></div></header>
    <div class="body">
      ${titi(`${rec.length} recorded sale${rec.length === 1 ? '' : 's'} this level.${missing ? ` ${missing} sale${missing > 1 ? 's were' : ' was'} not recorded, so ${missing > 1 ? 'they are' : 'it is'} missing here.` : ' Nothing missing.'}`)}
      <div class="card"><h3>What sells most</h3>${items.length ? items.map(([id, v]) => `<div class="between small"><span class="row" style="gap:6px">${good(id, 22)}${esc(GOODS[id].name)}</span><b>${v.qty} sold · ${fmt(v.money)}</b></div>`).join('') : '<span class="small muted">No recorded sales yet.</span>'}</div>
      <div class="card"><h3>Your customers</h3>${custs.length ? custs.map(([c, v]) => `<div class="between small"><span class="row" style="gap:8px"><span class="mini-face" style="width:32px;height:32px">${face(c, { size: 32 })}</span>${esc(CUST[c].name)}</span><b>${v.times}× · ${fmt(v.money)}</b></div>`).join('') : '<span class="small muted">No recorded sales yet.</span>'}</div>
      ${days.length ? `<div class="card"><h3>Your days</h3>${days.slice(-7).map((h) => `<div class="between small"><span>Day ${h.day}${best && h === best ? ' <span class="tag green">Best</span>' : ''}</span><b style="color:${h.profit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(h.profit)} profit</b></div>`).join('')}</div>` : ''}
    </div>
  </main>`;
}

// ---------- Savings goals ----------

export function goalsScreen(s, ui) {
  const days = (price) => {
    const d = daysToGoal(s, price);
    if (d === 0) return 'You have enough';
    if (d == null) return 'Set a daily pay first';
    return `${d <= 1 ? 'Tomorrow' : `In ${howLong(d)}`} at ${fmt(s.pay)} a day`;
  };
  const rows = GOALS.map((g) => `<button type="button" class="choice${s.goal?.name === g.name ? ' credit' : ''}" data-action="set-goal" data-arg="${g.id}">
      <span class="between" style="width:100%"><b>${esc(g.name)}</b><b style="color:var(--ink)">${fmt(g.price)}</b></span><span>${days(g.price)}</span></button>`).join('');
  return `<main class="screen">
    <header class="top"><div class="row"><button type="button" class="icon-btn" data-action="close" aria-label="Back" style="margin-left:-10px">${icon('back', 22, 2)}</button><h1 class="title display">Save for a goal</h1></div></header>
    <div class="body">
      ${titi(`Your daily pay goes into your pocket. Pick something to save for: these are real prices, so big goals take a long time. A bigger business means bigger pay. Pocket now: <b>${fmt(s.pocket)}</b>.`)}
      ${ui.error ? `<div class="toast" role="alert">${esc(ui.error)}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px">${rows}</div>
      <form data-form="goal" class="card"><h3>Or your own goal</h3>
        <label class="small muted" for="goal-name">What is it?</label>
        <input id="goal-name" name="name" type="text" maxlength="40" placeholder="e.g. Freezer for my shop" style="height:44px;border:1px solid var(--line-2);border-radius:12px;padding:0 12px;font-size:16px">
        <label class="small muted" for="goal-price">Price (₦)</label>
        <input id="goal-price" name="price" type="number" inputmode="numeric" min="1000" step="500" placeholder="e.g. 150000" style="height:44px;border:1px solid var(--line-2);border-radius:12px;padding:0 12px;font-size:16px">
        <button type="submit" class="btn primary small">Save for this</button></form>
      ${s.goal ? btn('clear-goal', 'Stop saving for a goal', 'secondary small block') : ''}
      ${s.goalsReached.length ? `<div class="card"><h3>Goals reached</h3>${s.goalsReached.map((g) => `<div class="between small"><span>${esc(g.name)}</span><b>${fmt(g.price)} · Day ${g.day}</b></div>`).join('')}</div>` : ''}
    </div>
  </main>`;
}

// ---------- Change prices during the day ----------

export function pricesScreen(s) {
  const t = s.today;
  const rows = goodsForLevel(s.level).map((id) => {
    const g = GOODS[id];
    const was = t.morningPrices?.[id] ?? s.prices[id];
    const up = s.prices[id] > was;
    return `<div class="stock-row"><div class="between"><span class="good-ico">${good(id, 32)}</span>
      <div class="grow"><b>${esc(g.name)}</b><div class="small muted">This morning ${fmt(was)} · buy ${fmt(buyPrice(s, id))}</div>
        ${up ? '<div class="small" style="color:var(--red);font-weight:700">Raised: customers will notice</div>' : ''}</div>
      <div class="stepper"><button type="button" class="step" data-action="price" data-arg="${id}:-50" aria-label="Lower ${esc(g.name)} price">−</button>
        <output>${fmt(s.prices[id])}</output>
        <button type="button" class="step" data-action="price" data-arg="${id}:50" aria-label="Raise ${esc(g.name)} price">+</button></div></div></div>`;
  }).join('');
  return `<main class="screen">
    <header class="top"><div class="row"><button type="button" class="icon-btn" data-action="close" aria-label="Back" style="margin-left:-10px">${icon('back', 22, 2)}</button><h1 class="title display">Prices</h1></div></header>
    <div class="body">
      ${titi('Customers notice when a price goes up during the day. Some will complain, and that lowers your score. Lowering a price is fine.')}
      <div class="list">${rows}</div>
    </div>
    <div class="foot">${btn('close', 'Back to customers', 'primary block')}</div>
  </main>`;
}

// ---------- Who owes you ----------

export function debtsScreen(s) {
  const debts = openDebts(s, { recordedOnly: true }).sort((a, b) => a.due - b.due);
  const unrecorded = openDebts(s).filter((d) => !d.recorded).length;
  const rows = debts.map((d) => {
    const c = CUST[d.cid];
    const late = s.day - d.due;
    const status = late > 0 ? `<span style="color:var(--red);font-weight:600">${late} day${late > 1 ? 's' : ''} late</span>` : late === 0 ? '<span style="color:var(--amber-ink);font-weight:600">Due today</span>' : `Due Day ${d.due}`;
    const reminded = d.remindedDay === s.day;
    const action = s.level < 2
      ? `<span class="tag" style="background:#E8EDE9;color:var(--muted)">${icon('lock', 12)} Level 2</span>`
      : reminded ? '<span class="tag green">Reminded</span>'
      : btn('remind', 'Remind', late >= 0 ? 'primary small' : 'secondary small', d.id);
    return `<div class="debt-row"><span class="mini-face">${face(c.id, { size: 44, mood: late > 0 ? 'neutral' : 'happy' })}</span>
      <div class="grow"><b>${esc(c.name)} · ${fmt(d.amount)}</b><div class="small muted">${status} · ${esc(d.what)}, Day ${d.created}</div></div>${action}</div>`;
  }).join('');
  const sup = supplierOwed(s);
  return `<main class="screen">
    <header class="top">
      <div class="row"><button type="button" class="icon-btn" data-action="close" aria-label="Back" style="margin-left:-10px">${icon('back', 22, 2)}</button>
        <span class="kicker grow">Level ${s.level} · ${esc(LEVELS[s.level].name)} · Day ${s.day}</span></div>
      <div class="between"><div><h1 class="title display">Who owes you</h1><span class="kicker">${debts.length} customer${debts.length === 1 ? '' : 's'}</span></div>
        <b class="display" style="font-size:26px">${fmt(owedToYou(s))}</b></div>
    </header>
    <div class="body">
      ${rows ? `<div class="list">${rows}</div>` : '<div class="card"><span class="muted">Nobody owes you money, as far as your records show.</span></div>'}
      ${unrecorded ? `<div class="card bad"><span class="small">Some credit you gave was never recorded, so it isn't on this list. You'll have to hope they remember.</span></div>` : ''}
      ${s.level >= 2 && sup ? `<div class="card" style="border-style:dashed"><div class="between"><div><span class="small muted" style="font-weight:600">You owe your supplier</span><div><b>${fmt(sup)}</b></div></div>${btn('pay-supplier', 'Pay', 'secondary small')}</div></div>` : ''}
      ${titi(s.level >= 2 ? 'A polite reminder on the due day gets money back more often than waiting.' : 'Only recorded debts show here. Reminders open at Level 2.')}
    </div>
  </main>`;
}

// ---------- Level screens ----------

export function level2Screen() {
  const item = (ico, title, desc) => `<div class="row" style="align-items:flex-start"><span class="avatar" style="background:var(--green-dark)">${icon(ico, 16)}</span><div><b>${title}</b><div class="small" style="color:var(--green-text-on)">${desc}</div></div></div>`;
  return `<main class="screen hero"><div class="body center">
      <span class="tag solid" style="align-self:center;text-transform:uppercase;letter-spacing:.08em">Level 1 complete</span>
      <div class="scene-card">${scene(2, { stock: { noodles: 1, bread: 1, drinks: 1, palmoil: 1, rice: 1 } })}</div>
      <h1 class="display" style="font-size:32px">Welcome to The Shop!</h1>
      <p class="lead">Your table did well. Now you have a small shop with more goods and more customers.</p>
      <div style="display:flex;flex-direction:column;gap:14px;text-align:left;background:var(--green-dark);border-radius:18px;padding:16px">
        ${item('box', 'New goods', 'Noodles, bread, soft drinks and palm oil. Bread goes bad after 3 days.')}
        ${item('truck', 'Supplier credit', 'Buy stock now, pay in 3 days.')}
        ${item('people', 'Reminders', 'Remind people who owe you, on the day it\'s due.')}
      </div>
    </div>
    <div class="foot" style="background:none">${btn('levelup-continue', 'Open my shop', 'amber block')}</div></main>`;
}

export function doneScreen(s) {
  const st = s.stats;
  return `<main class="screen hero"><div class="body center">
      <span class="tag solid" style="align-self:center;text-transform:uppercase;letter-spacing:.08em">Level 2 complete</span>
      <div class="scene-card">${scene(2, { cid: 'mamabola', stock: { rice: 1, bread: 1, drinks: 1, palmoil: 1, water: 1 } })}</div>
      <h1 class="display" style="font-size:32px">You built The Shop!</h1>
      <p class="lead">From a ₦20,000 table to a shop that restocks on time and gets its debts back.</p>
      <div class="grid3">
        <div class="tile" style="align-items:center"><span>Score</span><span class="display" style="font-size:22px">${s.score}</span></div>
        <div class="tile" style="align-items:center"><span>Sales recorded</span><span class="display" style="font-size:22px">${st.totW ? Math.round((st.recW / st.totW) * 100) : 0}%</span></div>
        <div class="tile" style="align-items:center"><span>Badges</span><span class="display" style="font-size:22px">${s.badges.length}</span></div>
      </div>
      <div class="card" style="color:var(--ink);text-align:left">
        <span class="small muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.06em">Do this with your real shop</span>
        <b style="font-size:17px">Record sales, track who owes you and send reminders with tiTi in CreditVoice.</b>
        <a class="btn amber" href="${CREDITVOICE_URL}" target="_blank" rel="noopener" data-action="cv-click">Start free on CreditVoice</a>
      </div>
    </div>
    <div class="foot" style="background:none">${btn('done-continue', 'Keep playing', 'ghost-light block')}
      <p class="small center" style="margin:0;color:var(--green-text-on)">Level 3 · Bigger Shop (staff and expenses) is coming soon.</p></div></main>`;
}

// ---------- Settings ----------

export function settingsScreen(s, ui) {
  const opt = (path, label, desc) => `<label class="settings-opt"><input type="radio" name="path" value="${path}" data-action="set-path" ${s.path === path ? 'checked' : ''}><span><b>${label}</b><div class="small muted">${desc}</div></span></label>`;
  return `<main class="screen">
    <header class="top"><div class="row"><button type="button" class="icon-btn" data-action="close" aria-label="Back" style="margin-left:-10px">${icon('back', 22, 2)}</button><h1 class="title display">Settings</h1></div></header>
    <div class="body">
      <div class="card"><h3>How you play</h3>
        ${opt('business', 'I run a business', 'Fewer explanations.')}
        ${opt('learning', 'I\'m learning business', 'tiTi explains new ideas and adds "Did you know?" notes.')}</div>
      ${Voice.supported ? `<div class="card"><h3>Sound</h3>
        <label class="settings-opt"><input type="checkbox" data-action="set-voice" ${Voice.enabled() ? 'checked' : ''}><span><b>Customers speak</b><div class="small muted">Customers say what they want out loud, using your phone's voice. Their words also stay on screen.</div></span></label></div>` : ''}
      ${ui.canInstall ? `<div class="card"><h3>Add to home screen</h3><span class="small muted">Play like an app, even without data.</span>${btn('install', 'Install Oga Shop', 'secondary small')}</div>` : ''}
      <div class="card"><h3>About</h3>
        <span class="small">Oga Shop is a free learning game by CreditVoice. There is no real money in the game. Your progress is saved only on this phone; nothing is sent anywhere.</span>
        <span class="small">CreditVoice does not lend money. Anything about loans or finance in the game is fiction.</span>
        <a class="small" href="${CREDITVOICE_URL}" target="_blank" rel="noopener">Visit CreditVoice</a></div>
      <div class="card"><h3>Start over</h3>
        ${ui.confirmReset ? '<div class="toast">This deletes your saved game. Tap again to confirm.</div>' : ''}
        ${btn('reset', 'Delete my game and start again', 'secondary small')}</div>
    </div>
  </main>`;
}
