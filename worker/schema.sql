-- Daily totals: everyone counted, nothing that identifies anyone.
CREATE TABLE IF NOT EXISTS daily (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  key TEXT NOT NULL DEFAULT '',
  n INTEGER NOT NULL DEFAULT 0,
  sum REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, key)
);

-- Deeper detail: only players who said yes. pid is a random code made on the phone.
CREATE TABLE IF NOT EXISTS player_events (
  at INTEGER NOT NULL,
  pid TEXT NOT NULL,
  event TEXT NOT NULL,
  key TEXT NOT NULL DEFAULT '',
  value REAL NOT NULL DEFAULT 0,
  level INTEGER,
  game_day INTEGER,
  score INTEGER
);
CREATE INDEX IF NOT EXISTS player_events_pid ON player_events (pid, at);

-- Player accounts (only for players who create one). Age is a group, never a birth date.
CREATE TABLE IF NOT EXISTS users (
  key TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  age TEXT NOT NULL,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  hash TEXT PRIMARY KEY,
  user_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tokens_user ON tokens (user_key);

CREATE TABLE IF NOT EXISTS saves (
  user_key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
