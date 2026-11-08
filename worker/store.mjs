// Accounts and saves in the D1 database.
const toMember = (r) => r && { userKey: r.user_key, marketId: r.market_id, username: r.username, age: r.age, slot: r.slot, lastSeen: r.last_seen, customers: r.customers, sales: r.sales, price: r.price, advert: r.advert, level: r.level };
const toMarket = (r) => r && { id: r.id, code: r.code, size: r.size, level: r.level, kind: r.kind };
const toUser = (r) => r && { key: r.key, username: r.username, salt: r.salt, pinHash: r.pin_hash, age: r.age, fails: r.fails, lockedUntil: r.locked_until };

export function d1Store(db) {
  return {
    async getUser(key) { return toUser(await db.prepare('SELECT * FROM users WHERE key = ?').bind(key).first()); },
    async createUser({ key, username, salt, pinHash, age, now }) {
      const r = await db.prepare('INSERT INTO users (key, username, salt, pin_hash, age, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(key) DO NOTHING')
        .bind(key, username, salt, pinHash, age, now).run();
      return r.meta.changes === 1;
    },
    setFails(key, fails, lockedUntil) { return db.prepare('UPDATE users SET fails = ?, locked_until = ? WHERE key = ?').bind(fails, lockedUntil, key).run(); },
    addToken(hash, key, now) { return db.prepare('INSERT INTO tokens (hash, user_key, created_at) VALUES (?, ?, ?)').bind(hash, key, now).run(); },
    async keyForToken(hash) { return (await db.prepare('SELECT user_key FROM tokens WHERE hash = ?').bind(hash).first())?.user_key || null; },
    dropToken(hash) { return db.prepare('DELETE FROM tokens WHERE hash = ?').bind(hash).run(); },
    async getSave(key) {
      const r = await db.prepare('SELECT data, version, updated_at FROM saves WHERE user_key = ?').bind(key).first();
      return r && { data: r.data, version: r.version, updatedAt: r.updated_at };
    },
    putSave(key, data, version, now) {
      return db.prepare('INSERT INTO saves (user_key, data, version, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_key) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at')
        .bind(key, data, version, now).run();
    },
    deleteUser(key) {
      return db.batch([
        db.prepare('DELETE FROM saves WHERE user_key = ?').bind(key),
        db.prepare('DELETE FROM tokens WHERE user_key = ?').bind(key),
        db.prepare('DELETE FROM users WHERE key = ?').bind(key),
        db.prepare('DELETE FROM members WHERE user_key = ?').bind(key),
        db.prepare('DELETE FROM wins WHERE user_key = ?').bind(key),
      ]);
    },

    // Markets
    async getMember(key) { return toMember(await db.prepare('SELECT * FROM members WHERE user_key = ?').bind(key).first()); },
    addMember({ marketId, userKey, username, age, slot, now, level }) {
      return db.prepare('INSERT INTO members (user_key, market_id, username, age, slot, last_seen, level) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(userKey, marketId, username, age, slot, now, level).run();
    },
    removeMember(key) { return db.prepare('DELETE FROM members WHERE user_key = ?').bind(key).run(); },
    async membersOf(id) { return (await db.prepare('SELECT * FROM members WHERE market_id = ? ORDER BY slot').bind(id).all()).results.map(toMember); },
    async getMarket(id) { return toMarket(await db.prepare('SELECT * FROM markets WHERE id = ?').bind(id).first()); },
    async getMarketByCode(code) { return toMarket(await db.prepare('SELECT * FROM markets WHERE code = ?').bind(code).first()); },
    async createMarket({ id, code, size, level, kind, now }) {
      const r = await db.prepare('INSERT INTO markets (id, code, size, level, kind, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(code) DO NOTHING').bind(id, code, size, level, kind, now).run();
      return r.meta.changes === 1;
    },
    deleteMarket(id) { return db.prepare('DELETE FROM markets WHERE id = ?').bind(id).run(); },
    async findOpenQuick(size, level) {
      return toMarket(await db.prepare("SELECT m.* FROM markets m WHERE m.kind = 'quick' AND m.size = ? AND m.level = ? AND (SELECT COUNT(*) FROM members x WHERE x.market_id = m.id) < m.size ORDER BY m.created_at LIMIT 1").bind(size, level).first());
    },
    clearInactiveQuick(before) { return db.prepare("DELETE FROM members WHERE last_seen < ? AND market_id IN (SELECT id FROM markets WHERE kind = 'quick')").bind(before).run(); },
    touchMember(key, now) { return db.prepare('UPDATE members SET last_seen = ? WHERE user_key = ?').bind(now, key).run(); },
    saveResult(key, r) { return db.prepare('UPDATE members SET customers = ?, sales = ?, price = ?, advert = ?, level = ? WHERE user_key = ?').bind(r.customers, r.sales, r.price, r.advert ? 1 : 0, r.level, key).run(); },
    addWin(key, from, count, at) { return db.prepare('INSERT INTO wins (user_key, from_name, count, at) VALUES (?, ?, ?, ?)').bind(key, from, count, at).run(); },
    async takeWins(key) {
      const { results } = await db.prepare('SELECT from_name, count FROM wins WHERE user_key = ?').bind(key).all();
      if (results.length) await db.prepare('DELETE FROM wins WHERE user_key = ?').bind(key).run();
      return results.map((r) => ({ from: r.from_name, count: r.count }));
    },
  };
}
