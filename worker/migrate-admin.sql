-- Admin tables: run once on the live database.
-- Admin: a lock after wrong admin keys, and a log of every admin action.
CREATE TABLE IF NOT EXISTS admin_guard (
  id INTEGER PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_log (
  at INTEGER NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
