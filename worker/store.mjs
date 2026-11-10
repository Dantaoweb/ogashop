// Accounts and saves in the D1 database.
const toBest = (score, ms) => (score == null ? null : { score, ms });
const toMember = (r) => r && { userKey: r.user_key, marketId: r.market_id, username: r.username, age: r.age, slot: r.slot, lastSeen: r.last_seen, customers: r.customers, sales: r.sales, price: r.price, advert: r.advert, level: r.level, best: { money: toBest(r.money_score, r.money_ms), change: toBest(r.change_score, r.change_ms) } };
const toCup = (r) => r && { id: r.id, code: r.code, name: r.name, size: r.size, kind: r.kind, length: r.length, events: JSON.parse(r.events), levelFrom: r.level_from, levelTo: r.level_to, startMode: r.start_mode, startAt: r.start_at, startedAt: r.started_at, endsAt: r.ends_at, cancelled: r.cancelled, by: r.created_by, createdAt: r.created_at, house: JSON.parse(r.house || '{}') };
const toCupPlayer = (r) => ({ userKey: r.user_key, username: r.username, age: r.age, slot: r.slot, joinedAt: r.joined_at, stats: JSON.parse(r.stats || '{}') });
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
        db.prepare('DELETE FROM cup_players WHERE user_key = ?').bind(key),
        db.prepare('DELETE FROM cups WHERE id NOT IN (SELECT cup_id FROM cup_players)'),
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
    saveBest(key, type, score, ms) {
      const sql = type === 'money' ? 'UPDATE members SET money_score = ?, money_ms = ? WHERE user_key = ?' : 'UPDATE members SET change_score = ?, change_ms = ? WHERE user_key = ?';
      return db.prepare(sql).bind(score, ms, key).run();
    },
    // Championships
    async createCup(c) {
      const r = await db.prepare('INSERT INTO cups (id, code, name, size, kind, length, events, level_from, level_to, start_mode, start_at, created_by, created_at, house) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(code) DO NOTHING')
        .bind(c.id, c.code, c.name, c.size, c.kind, c.length, JSON.stringify(c.events), c.levelFrom, c.levelTo, c.startMode, c.startAt, c.by, c.createdAt, JSON.stringify(c.house || {})).run();
      return r.meta.changes === 1;
    },
    updateCup(id, c) {
      return db.prepare('UPDATE cups SET name = ?, size = ?, kind = ?, length = ?, events = ?, level_from = ?, level_to = ?, start_mode = ?, start_at = ?, house = ? WHERE id = ?')
        .bind(c.name, c.size, c.kind, c.length, JSON.stringify(c.events), c.levelFrom, c.levelTo, c.startMode, c.startAt, JSON.stringify(c.house || {}), id).run();
    },
    startCup(id, at, endsAt) { return db.prepare('UPDATE cups SET started_at = ?, ends_at = ? WHERE id = ? AND started_at IS NULL').bind(at, endsAt, id).run(); },
    cancelCup(id) { return db.prepare('UPDATE cups SET cancelled = 1 WHERE id = ?').bind(id).run(); },
    async getCupByCode(code) { return toCup(await db.prepare('SELECT * FROM cups WHERE code = ?').bind(code).first()); },
    async cupPlayers(id) { return (await db.prepare('SELECT * FROM cup_players WHERE cup_id = ? ORDER BY slot').bind(id).all()).results.map(toCupPlayer); },
    addCupPlayer({ cupId, userKey, username, age, slot, now }) {
      return db.prepare('INSERT INTO cup_players (cup_id, user_key, username, age, slot, joined_at) VALUES (?, ?, ?, ?, ?, ?)').bind(cupId, userKey, username, age, slot, now).run();
    },
    removeCupPlayer(id, key) { return db.prepare('DELETE FROM cup_players WHERE cup_id = ? AND user_key = ?').bind(id, key).run(); },
    deleteCup(id) { return db.batch([db.prepare('DELETE FROM cup_players WHERE cup_id = ?').bind(id), db.prepare('DELETE FROM cups WHERE id = ?').bind(id)]); },
    saveCupStats(id, key, stats) { return db.prepare('UPDATE cup_players SET stats = ? WHERE cup_id = ? AND user_key = ?').bind(JSON.stringify(stats), id, key).run(); },
    // Championships not yet over: open, or running and before their end.
    async activeCupCount(key, now) {
      return (await db.prepare('SELECT COUNT(*) AS n FROM cup_players p JOIN cups c ON c.id = p.cup_id WHERE p.user_key = ? AND c.cancelled = 0 AND (c.started_at IS NULL OR c.ends_at > ?)').bind(key, now).first()).n;
    },
    deleteOldCups(before) {
      return db.batch([
        db.prepare('DELETE FROM cup_players WHERE cup_id IN (SELECT id FROM cups WHERE created_at < ?)').bind(before),
        db.prepare('DELETE FROM cups WHERE created_at < ?').bind(before),
      ]);
    },
    addWin(key, from, count, at) { return db.prepare('INSERT INTO wins (user_key, from_name, count, at) VALUES (?, ?, ?, ?)').bind(key, from, count, at).run(); },
    async takeWins(key) {
      const { results } = await db.prepare('SELECT from_name, count FROM wins WHERE user_key = ?').bind(key).all();
      if (results.length) await db.prepare('DELETE FROM wins WHERE user_key = ?').bind(key).run();
      return results.map((r) => ({ from: r.from_name, count: r.count }));
    },
  };
}
