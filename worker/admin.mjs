// Admin: a separate page for the game's owner, served by the counter. Players' phones never download it.
// It works only when the ADMIN_KEY secret is set. 5 wrong keys lock it for 15 minutes. Every action is logged.
// Admins see the least possible: username, age group and game progress. Never PINs, salts or tokens.
import { usernameError, usernameKey, pinError } from '../js/username.js';
import { hashPin, sameText } from './accounts.mjs';

export const ADMIN_FAILS = 5;
export const ADMIN_LOCK_MS = 15 * 60000;
const DAY = 86400000;
const reply = (status, json) => ({ status, json });

function randomHex(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function randomPin() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(1000 + (b[0] % 9000));
}

// Checks the admin key. Returns null when it's right, or the reply to send.
export async function checkKey(store, given, adminKey, now) {
  if (!adminKey) return reply(404, { error: 'Not found.' });
  const guard = await store.adminGuard();
  if (guard.lockedUntil > now) return reply(429, { error: 'Too many wrong keys. Try again in 15 minutes.' });
  if (typeof given === 'string' && given.length && sameText(given, adminKey)) {
    if (guard.fails) await store.setAdminGuard(0, 0);
    return null;
  }
  const fails = guard.fails + 1;
  await store.setAdminGuard(fails >= ADMIN_FAILS ? 0 : fails, fails >= ADMIN_FAILS ? now + ADMIN_LOCK_MS : 0);
  return reply(401, { error: 'Wrong admin key.' });
}

// What a save says about the game, without sending the save itself.
function progress(save) {
  if (!save) return null;
  try {
    const g = JSON.parse(save.data);
    return { level: g.level, day: g.day, score: g.score, path: g.path, cash: Math.round(g.cash), championships: (g.cups || []).length, trophies: (g.trophies || []).length, savedAt: save.updatedAt };
  } catch {
    return { savedAt: save.updatedAt };
  }
}

export async function dashboard(store, body, { now, summary }) {
  return reply(200, { ...(await store.adminCounts(now - DAY, now - 7 * DAY, now)), measures: summary });
}

export async function player(store, body) {
  const user = await store.getUser(usernameKey(body?.username));
  if (!user) return reply(404, { error: 'No player with that username.' });
  const extra = await store.adminPlayer(user.key);
  return reply(200, {
    username: user.username, age: user.age, createdAt: user.createdAt, locked: user.lockedUntil > Date.now(),
    game: progress(extra.save), market: extra.market, cups: extra.cups,
  });
}

// A new PIN for a player who forgot theirs. The admin passes it on; it is shown once and never stored in plain text.
export async function resetPin(store, body, { pepper, now }) {
  const user = await store.getUser(usernameKey(body?.username));
  if (!user) return reply(404, { error: 'No player with that username.' });
  const pin = body?.pin ? String(body.pin) : randomPin();
  const bad = pinError(pin);
  if (bad) return reply(400, { error: bad });
  const salt = randomHex(16);
  await store.setPin(user.key, salt, await hashPin(pin, salt, pepper));
  await store.addAdminLog(now, 'reset PIN', user.username, '');
  return reply(200, { username: user.username, pin });
}

// A new username, for example when one is rude. Their game, markets and championships move with them.
export async function rename(store, body, { now }) {
  const user = await store.getUser(usernameKey(body?.username));
  if (!user) return reply(404, { error: 'No player with that username.' });
  const name = String(body?.newUsername || '').trim();
  const bad = usernameError(name);
  if (bad) return reply(400, { error: bad });
  const key = usernameKey(name);
  if (key !== user.key && await store.getUser(key)) return reply(409, { error: 'That username is taken.' });
  await store.renameUser(user.key, key, name);
  await store.addAdminLog(now, 'rename', user.username, name);
  return reply(200, { username: name });
}

// Removes an account that breaks the rules: their markets and championships are left first.
export async function remove(store, body, { now, beforeDelete }) {
  const user = await store.getUser(usernameKey(body?.username));
  if (!user) return reply(404, { error: 'No player with that username.' });
  if (body?.confirm !== user.username) return reply(400, { error: 'Type the username exactly to confirm.' });
  if (beforeDelete) await beforeDelete(user);
  await store.deleteUser(user.key);
  await store.addAdminLog(now, 'remove account', user.username, String(body?.reason || '').slice(0, 120));
  return reply(200, { removed: user.username });
}

export async function log(store) {
  return reply(200, { entries: await store.adminLog(50) });
}

// ---------- The page ----------

export function adminPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Oga Shop admin</title>
<style>
:root{--g:#0E6B43;--ink:#17231C;--mut:#55635A;--line:#DCE3DD;--bg:#F3F5F2;--red:#B3261E}
*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;background:var(--bg);color:var(--ink)}
header{background:var(--g);color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center}
main{max-width:760px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:14px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px}
h1{font-size:18px;margin:0}h2{font-size:16px;margin:0}
input,button,select{font:inherit}input{height:44px;border:1px solid #C3CEC6;border-radius:10px;padding:0 12px;width:100%}
button{min-height:44px;border:0;border-radius:10px;padding:0 14px;font-weight:700;background:var(--g);color:#fff;cursor:pointer}
button.sec{background:#fff;color:var(--ink);border:1px solid #C3CEC6}button.bad{background:var(--red)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.tile{background:var(--bg);border-radius:12px;padding:10px}.tile b{display:block;font-size:22px}.tile span{font-size:13px;color:var(--mut)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.row input{flex:1;min-width:140px}
.msg{padding:10px 12px;border-radius:10px;background:#E3F0E8;color:var(--g);font-weight:600}.msg.err{background:#FBE7E5;color:var(--red)}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:6px 4px;border-bottom:1px solid var(--line)}
.muted{color:var(--mut);font-size:13px}.hide{display:none}
</style></head><body>
<header><h1>Oga Shop admin</h1><button class="sec hide" id="out">Lock</button></header>
<main>
<section class="card" id="login"><h2>Admin key</h2><p class="muted">The ADMIN_KEY you set on Cloudflare. After 5 wrong tries the page locks for 15 minutes.</p>
<form id="lf" class="row"><input id="key" type="password" autocomplete="off" placeholder="Admin key"><button>Open</button></form><div id="lmsg"></div></section>
<div id="app" class="hide">
<section class="card"><div class="row" style="justify-content:space-between"><h2>Today</h2><button class="sec" id="refresh">Refresh</button></div><div class="grid" id="tiles"></div><table id="measures"></table></section>
<section class="card"><h2>Find a player</h2><form id="ff" class="row"><input id="uname" autocomplete="off" placeholder="Username"><button>Find</button></form><div id="pmsg"></div><div id="player"></div></section>
<section class="card"><h2>Admin log</h2><table id="log"></table></section>
</div></main>
<script>
const $=(id)=>document.getElementById(id);
let key=sessionStorage.getItem('ogashop.admin')||'';
const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=(t)=>t?new Date(t).toLocaleString():'–';
async function api(path,body={}){const r=await fetch('/admin/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Key':key},body:JSON.stringify(body)});const j=await r.json().catch(()=>({error:'Something went wrong.'}));return{ok:r.ok,status:r.status,...j};}
function say(el,text,bad){$(el).innerHTML=text?'<div class="msg'+(bad?' err':'')+'">'+esc(text)+'</div>':'';}
async function open(){const d=await api('dashboard');if(!d.ok){sessionStorage.removeItem('ogashop.admin');key='';$('app').classList.add('hide');$('login').classList.remove('hide');$('out').classList.add('hide');say('lmsg',d.error,true);return;}
sessionStorage.setItem('ogashop.admin',key);$('login').classList.add('hide');$('app').classList.remove('hide');$('out').classList.remove('hide');say('lmsg','');
const t=[['Players with accounts',d.users],['New today',d.newToday],['New this week',d.newWeek],['Aged 13–17',d.teens],['Played today',d.savedToday],['Markets',d.markets],['In markets',d.members],['Championships open',d.cupsOpen],['Championships running',d.cupsRunning]];
$('tiles').innerHTML=t.map(([l,v])=>'<div class="tile"><b>'+esc(v)+'</b><span>'+esc(l)+'</span></div>').join('');
$('measures').innerHTML=d.measures?'<tr><th>Measure</th><th>Now</th><th>Target</th></tr>'+d.measures.measures.map((m)=>'<tr><td>'+esc(m.name)+'</td><td>'+(m.value==null?'No data yet':esc(m.value+m.unit))+'</td><td>'+(m.better==='high'?'at least ':'at most ')+esc(m.target+m.unit)+'</td></tr>').join('')+'<tr><td>Visitors / visits</td><td>'+esc(d.measures.visitors)+' / '+esc(d.measures.visits)+'</td><td></td></tr>':'';
const l=await api('log');$('log').innerHTML='<tr><th>When</th><th>Action</th><th>Player</th><th>Detail</th></tr>'+(l.entries||[]).map((e)=>'<tr><td>'+esc(when(e.at))+'</td><td>'+esc(e.action)+'</td><td>'+esc(e.target)+'</td><td>'+esc(e.detail)+'</td></tr>').join('');}
function showPlayer(p){const g=p.game;$('player').innerHTML='<table>'+[['Username',p.username],['Age group',p.age],['Account made',when(p.createdAt)],['Locked out',p.locked?'Yes (wrong PINs)':'No'],['Level / day',g?g.level+' / day '+g.day:'No game saved'],['Score',g?g.score:'–'],['Last saved',g?when(g.savedAt):'–'],['Market',p.market?p.market.code+' ('+p.market.size+' shops)':'None'],['Championships',(p.cups||[]).map((c)=>c.name+' ('+c.status+')').join(', ')||'None']].map(([a,b])=>'<tr><td class="muted">'+esc(a)+'</td><td>'+esc(b)+'</td></tr>').join('')+'</table>'+
'<div class="row"><button id="pin">Reset PIN</button><input id="newname" placeholder="New username"><button class="sec" id="ren">Rename</button></div>'+
'<div class="row"><input id="why" placeholder="Reason for removing (for the log)"><input id="conf" placeholder="Type the username to confirm"><button class="bad" id="rem">Remove account</button></div>';
$('pin').onclick=async()=>{if(!confirm('Give '+p.username+' a new PIN?'))return;const r=await api('reset-pin',{username:p.username});say('pmsg',r.ok?'New PIN for '+r.username+': '+r.pin+'. Give it to the player privately; it will not be shown again.':r.error,!r.ok);open();};
$('ren').onclick=async()=>{const n=$('newname').value.trim();if(!n)return;const r=await api('rename',{username:p.username,newUsername:n});say('pmsg',r.ok?'Renamed to '+r.username+'. Tell the player their new username.':r.error,!r.ok);if(r.ok){$('uname').value=r.username;find();}open();};
$('rem').onclick=async()=>{if(!confirm('Remove '+p.username+' for good? Their game and account are deleted.'))return;const r=await api('remove',{username:p.username,confirm:$('conf').value.trim(),reason:$('why').value.trim()});say('pmsg',r.ok?'Removed '+r.removed+'.':r.error,!r.ok);if(r.ok)$('player').innerHTML='';open();};}
async function find(){const r=await api('player',{username:$('uname').value.trim()});if(!r.ok){say('pmsg',r.error,true);$('player').innerHTML='';return;}say('pmsg','');showPlayer(r);}
$('lf').onsubmit=(e)=>{e.preventDefault();key=$('key').value;open();};
$('ff').onsubmit=(e)=>{e.preventDefault();find();};
$('refresh').onclick=open;
$('out').onclick=()=>{sessionStorage.removeItem('ogashop.admin');location.reload();};
if(key)open();
</script></body></html>`;
}
