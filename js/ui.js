// Screens. Each returns an HTML string; buttons carry data-action (and data-arg) handled in main.js.
import { GOODS, LEVELS, BADGES, NOTES, EXPLAIN, TYPE_LABEL, CREDITVOICE_URL } from './data.js';
import { CUST, fmt, goodsForLevel, buyPrice, supplierOwed, owedToYou, openDebts, supplierCreditError } from './core.js';
import { currentCustomer, eventView, scoreParts, suggestMessage } from './engine.js';

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
};
export const icon = (name, size = 24, sw = 1.8) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${P} stroke-width="${sw}" aria-hidden="true">${PATHS[name] || ''}</svg>`;

const BADGE_ICON = { first_sale: 'coin', record_keeper: 'doc', fully_stocked: 'box', never_lost_debt: 'check', debt_free_week: 'calendar' };

const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const items = (list) => list.map((it) => `${it.qty} ${GOODS[it.item].short.toLowerCase()}`).join(' and ');
const btn = (action, label, cls = 'primary', arg = '', extra = '') =>
  `<button type="button" class="btn ${cls}" data-action="${action}"${arg !== '' ? ` data-arg="${esc(arg)}"` : ''} ${extra}>${label}</button>`;

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
        <div class="logo">${icon('stall', 48, 1.6)}</div>
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
    const exp = expiring(id);
    const margin = s.prices[id] - buyPrice(s, id);
    return `<div class="stock-row${low ? ' low' : ''}">
      <div class="between"><div class="grow"><b>${esc(g.name)}</b> <span class="muted small">(${esc(g.unit)})</span>
        <div class="small ${low ? '' : 'muted'}" style="${low ? 'color:var(--amber-ink);font-weight:600' : ''}">${s.stock[id]} in stock · buy ${fmt(buyPrice(s, id))}${exp ? ` · <span style="color:var(--red);font-weight:700">${exp} go bad tonight</span>` : ''}</div></div>
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
        ${s.level >= 2 && !credErr ? '<span class="small muted">Supplier credit: pay in 3 days.</span>' : ''}</div>`
      : btn('open-shop', 'Open shop', 'primary block')}
    </div>
  </main>`;
}

// ---------- Selling ----------

export function customerScreen(s) {
  const v = currentCustomer(s);
  const t = s.today;
  const c = v.customer;
  const tone = c.type === 'neverpays' ? 'red' : c.type === 'regular' ? 'green' : '';
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
    actions = `<div class="card ${t.outcome.tone === 'bad' ? 'bad' : ''}"><p style="margin:0">${esc(t.outcome.text)}</p></div>
      ${btn('serve', 'Next customer', 'primary block', 'next')}`;
  } else if (!v.items.length) {
    actions = `<div class="card warn"><b>You have no ${esc(v.missing.map((i) => GOODS[i].short.toLowerCase()).join(' or '))}.</b><span class="small muted">Running out means lost sales.</span></div>
      ${btn('serve', 'Sorry, I don\'t have it', 'primary block', 'sell')}`;
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
    actions = `<div class="grid2">${parts.join('')}</div>`;
  }

  const order = v.items.length ? `<div class="between small" style="padding-top:10px;border-top:1px dashed var(--line)">
      <span class="muted">${v.items.map((it) => `${it.qty} × ${esc(GOODS[it.item].short)} @ ${fmt(it.price)}`).join('<br>')}</span><b>${fmt(v.total)}</b></div>
      ${v.missing.length ? `<span class="small" style="color:var(--amber-ink);font-weight:600">Not enough ${esc(v.missing.map((i) => GOODS[i].short.toLowerCase()).join(', '))}: you can only sell what you have.</span>` : ''}` : '';

  return `<main class="screen">
    <header class="top" style="flex-direction:row;align-items:center;justify-content:space-between">
      <div><div class="kicker">Day ${s.day} · Selling</div><div class="title display">${v.clock}</div></div>
      <div class="row"><div style="text-align:right"><div class="kicker">Cash</div><b>${fmt(s.cash)}</b></div>
        <button type="button" class="icon-btn" data-action="open" data-arg="debts" aria-label="Who owes you">${icon('people')}</button></div>
    </header>
    <div style="padding:10px 16px 0" class="row"><span class="small muted" style="font-weight:600">Customer ${v.number} of ${v.of}</span>
      <div class="progress grow"><div style="width:${Math.round(((v.number - 1) / v.of) * 100)}%"></div></div></div>
    <div class="body">
      ${v.kind === 'credit' ? explain(s, 'credit') : v.kind === 'discount' || c.type === 'bargainer' ? explain(s, 'discount') : ''}
      <div class="center" style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div class="face ${tone}" aria-hidden="true">${initials(c.name)}</div>
        <b style="font-size:21px">${esc(c.name)}</b>
        <div class="wrap" style="justify-content:center"><span class="tag ${c.type === 'regular' ? 'green' : 'amber'}">${TYPE_LABEL[c.type]}</span>${loyal ? '<span class="tag green">Loyal</span>' : ''}</div>
      </div>
      <div class="card"><p class="speech">“${esc(speech)}”</p>${order}</div>
      ${actions}
    </div>
    <div class="foot" style="background:none;position:static"><span class="small muted" style="font-weight:600">Stock now</span>
      <div class="wrap">${goodsForLevel(s.level).map((id) => `<span class="chip${s.stock[id] <= 2 ? ' low' : ''}">${esc(GOODS[id].short)} ${s.stock[id]}</span>`).join('')}</div></div>
  </main>`;
}

// ---------- Record with tiTi ----------

export function recordScreen(s, ui) {
  const t = s.today;
  const sale = t.pending;
  const name = sale.cid ? CUST[sale.cid].name : null;
  const msgs = t.chat.map((m) => {
    if (m.card) {
      const c = m.card;
      return `<div class="bubble titi card-msg"><div class="row"><span class="avatar" style="width:24px;height:24px">${icon('check', 14, 3)}</span><b>Sale recorded</b></div>
        <dl class="kv">${c.name ? `<dt>Customer</dt><dd>${esc(c.name)}</dd>` : ''}<dt>Items</dt><dd>${esc(items(c.what))}</dd>
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
      ${explain(s, 'record')}
      <div class="chat" aria-live="polite">${msgs}</div>
      <div class="wrap">
        <button type="button" class="chip" data-action="titi-ask" data-arg="who owes me?" style="color:var(--green);font-weight:600;min-height:40px">Who owes me?</button>
        <button type="button" class="chip" data-action="titi-ask" data-arg="what's my profit today?" style="color:var(--green);font-weight:600;min-height:40px">My profit today?</button>
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

export function eveningScreen(s) {
  const t = s.today;
  const debts = openDebts(s);
  const debtRows = debts.map((d) => `<div class="between" style="${d.recorded ? '' : 'background:var(--red-soft);margin:0 -8px;padding:8px;border-radius:10px'}">
      <span>${esc(CUST[d.cid].name)} <span class="small ${d.recorded ? 'muted' : ''}" style="${d.recorded ? '' : 'color:var(--red);font-weight:700'}">· ${d.recorded ? (d.due < s.day ? `late since Day ${d.due}` : `due Day ${d.due}`) : 'not recorded'}</span></span>
      <b style="${d.recorded ? '' : 'color:var(--red)'}">${fmt(d.amount)}${d.recorded ? '' : '?'}</b></div>`).join('');
  const happened = [
    ...t.repaid.map((r) => `${CUST[r.cid].name} paid back ${fmt(r.amount)}.`),
    ...t.lostDebts.map((r) => `${CUST[r.cid].name}'s ${fmt(r.amount)} is lost${r.recorded ? '' : ' (it was never recorded)'}.`),
    ...t.wasted.map((w) => `${w.qty} ${GOODS[w.item].short.toLowerCase()} ${w.label}.`),
    ...t.expenses.map((e) => `${e.label}: ${fmt(e.amount)}.`),
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
      ${happened.length ? `<div class="card"><h3>Today</h3>${happened.map((h) => `<span class="small">${esc(h)}</span>`).join('')}</div>` : ''}
      <div class="card"><h3>Who owes you</h3>${debtRows || '<span class="small muted">Nobody owes you money.</span>'}</div>
      <div class="card"><h3>Stock left</h3><div class="wrap">${goodsForLevel(s.level).map((id) => `<span class="chip${s.stock[id] === 0 ? ' low' : ''}">${esc(GOODS[id].short)} ${s.stock[id]}</span>`).join('')}</div></div>
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
      <div class="card">${bar('Recording sales', p.recording)}${bar('Debt recovery', p.debts)}${bar('Stock management', p.stock)}${bar('Profit', p.profit)}</div>
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
    return `<div class="debt-row"><span class="initials">${initials(c.name)}</span>
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
      <div class="hero-icon">${icon('store', 64, 1.4)}</div>
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
      <div class="hero-icon">${icon('stall', 64, 1.4)}</div>
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
