// Accounts and saves in the D1 database.
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
      ]);
    },
  };
}
