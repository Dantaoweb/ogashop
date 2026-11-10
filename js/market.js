// Talking to the server about multiplayer markets. Each returns { view } or { error }.
import { call } from './account.js';

async function ask(path, body) {
  const { status, json } = await call(path, { body, auth: true });
  if (status === 200) return { view: json };
  return { error: json.error || 'Something went wrong. Please try again.', status };
}

export const quickJoin = (size, level) => ask('/market/quick', { size, level });
export const createMarket = (size, level) => ask('/market/create', { size, level });
export const joinCode = (code) => ask('/market/join', { code });
export const sync = (result, challenges = []) => ask('/market/sync', { ...(result ? { result } : {}), ...(challenges.length ? { challenges } : {}) });
export const leave = () => ask('/market/leave', {});

// Championships
export const cupCreate = (rules) => ask('/cup/create', rules);
export const cupUpdate = (code, rules) => ask('/cup/update', { ...rules, code });
export const cupInfo = (code) => ask('/cup/info', { code });
export const cupJoin = (code, level) => ask('/cup/join', { code, level, agree: true });
export const cupStart = (code) => ask('/cup/start', { code });
export const cupSync = (code, biz, games) => ask('/cup/sync', { code, ...(biz ? { biz } : {}), games });
export const cupLeave = (code) => ask('/cup/leave', { code });
