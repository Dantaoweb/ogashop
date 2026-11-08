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
export const sync = (result) => ask('/market/sync', result ? { result } : {});
export const leave = () => ask('/market/leave', {});
