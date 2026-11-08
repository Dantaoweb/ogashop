// Oga Shop counter, on Cloudflare Workers with a D1 database.
// POST /e    receives counts from the game. IP addresses are never stored.
// GET /stats?key=...    the private results page.
import { normalize, summarize, statsPage } from './logic.mjs';
import * as Accounts from './accounts.mjs';
import { d1Store } from './store.mjs';

const ORIGINS = ['https://dantaoweb.github.io', 'http://127.0.0.1:8765', 'http://localhost:8080'];

function cors(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

async function receive(request, env) {
  const text = await request.text();
  if (text.length > 20000) return new Response('Too large', { status: 413, headers: cors(request) });
  let body;
  try { body = JSON.parse(text); } catch { return new Response('Bad JSON', { status: 400, headers: cors(request) }); }
  const items = normalize(body);
  const today = new Date().toISOString().slice(0, 10);
  const statements = [];
  for (const it of items) {
    // Everyone goes into the daily totals.
    statements.push(env.DB.prepare(
      'INSERT INTO daily (day, event, key, n, sum) VALUES (?, ?, ?, 1, ?) ON CONFLICT(day, event, key) DO UPDATE SET n = n + 1, sum = sum + excluded.sum',
    ).bind(today, it.e, it.k, it.v));
    // Only players who said yes have a code and a detailed row.
    if (it.pid) {
      statements.push(env.DB.prepare(
        'INSERT INTO player_events (at, pid, event, key, value, level, game_day, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).bind(Date.now(), it.pid, it.e, it.k, it.v, it.level ?? null, it.day ?? null, it.score ?? null));
    }
  }
  if (statements.length) await env.DB.batch(statements);
  return new Response('ok', { headers: cors(request) });
}

async function stats(url, env) {
  if (!env.STATS_KEY || url.searchParams.get('key') !== env.STATS_KEY) return new Response('Not found', { status: 404 });
  const { results } = await env.DB.prepare('SELECT event, key, SUM(n) AS n, SUM(sum) AS sum FROM daily GROUP BY event, key').all();
  return new Response(statsPage(summarize(results)), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// Accounts and cloud saves.
async function account(request, url, env) {
  const store = d1Store(env.DB);
  const ctx = { pepper: env.PIN_PEPPER, now: Date.now() };
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const text = request.method === 'POST' ? await request.text() : '';
  if (text.length > Accounts.MAX_SAVE + 2000) return { status: 413, json: { error: 'Too large.' } };
  let body = {};
  if (text) { try { body = JSON.parse(text); } catch { return { status: 400, json: { error: 'Bad request.' } }; } }
  if (url.pathname === '/account/signup') return Accounts.signup(store, body, ctx);
  if (url.pathname === '/account/login') return Accounts.login(store, body, ctx);
  const user = await Accounts.userFromToken(store, token);
  if (!user) return { status: 401, json: { error: 'Please log in again.' } };
  if (url.pathname === '/account/logout') return Accounts.logout(store, token);
  if (url.pathname === '/account/delete') return Accounts.deleteAccount(store, user, body, ctx);
  if (url.pathname === '/save' && request.method === 'GET') return Accounts.getSave(store, user);
  if (url.pathname === '/save' && request.method === 'POST') return Accounts.putSave(store, user, body, ctx);
  return { status: 404, json: { error: 'Not found.' } };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'OPTIONS' && (url.pathname.startsWith('/account/') || url.pathname === '/save')) {
      const { status, json } = await account(request, url, env);
      return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(request) } });
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request) });
    if (request.method === 'POST' && url.pathname === '/e') return receive(request, env);
    if (request.method === 'GET' && url.pathname === '/stats') return stats(url, env);
    return new Response('Not found', { status: 404 });
  },
};
