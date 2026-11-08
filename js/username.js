// Rules for usernames, PINs and age groups. Used by the game and by the server.

export const AGE_GROUPS = { under13: 'Under 13', '13-17': '13 to 17', '18+': '18 or older' };

const RESERVED = ['admin', 'administrator', 'moderator', 'support', 'creditvoice', 'titi', 'ogashop', 'oga_shop'];
// Blocked anywhere in a name.
const RUDE_ANYWHERE = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dickhead', 'pussy', 'nigger', 'whore', 'cunt', 'porn'];
// Blocked only as a whole word, because they can sit inside normal names (e.g. "ode" in "Modesty").
const RUDE_WORDS = ['ass', 'sex', 'slut', 'dick', 'mumu', 'ode', 'olodo', 'yeye', 'werey', 'ashawo', 'oloshi'];

export const usernameKey = (name) => String(name || '').trim().toLowerCase();

export function usernameError(name) {
  const clean = String(name || '').trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(clean)) return 'A username has 3 to 20 letters or numbers, with no spaces.';
  const key = clean.toLowerCase();
  if (RESERVED.includes(key)) return 'That username is not allowed. Please choose another.';
  const words = key.split(/[_0-9]+/).filter(Boolean);
  if (RUDE_ANYWHERE.some((w) => key.includes(w)) || words.some((w) => RUDE_WORDS.includes(w))) return 'That username is not allowed. Please choose another.';
  return null;
}

export function pinError(pin) {
  const p = String(pin || '');
  if (!/^\d{4}$/.test(p)) return 'A PIN is exactly 4 numbers.';
  if (/^(\d)\1{3}$/.test(p) || p === '1234' || p === '4321') return 'That PIN is too easy to guess. Please choose another.';
  return null;
}
