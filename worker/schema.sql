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

-- Multiplayer markets. A player is in one market at a time.
CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  size INTEGER NOT NULL,
  level INTEGER NOT NULL,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS markets_open ON markets (kind, size, level);

CREATE TABLE IF NOT EXISTS members (
  user_key TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  username TEXT NOT NULL,
  age TEXT NOT NULL,
  slot INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  customers INTEGER NOT NULL DEFAULT 0,
  sales INTEGER NOT NULL DEFAULT 0,
  price TEXT NOT NULL DEFAULT 'normal',
  advert INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL,
  money_score INTEGER,
  money_ms INTEGER,
  change_score INTEGER,
  change_ms INTEGER
);
CREATE INDEX IF NOT EXISTS members_market ON members (market_id);

CREATE TABLE IF NOT EXISTS wins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  from_name TEXT NOT NULL,
  count INTEGER NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wins_user ON wins (user_key);

-- Championships: made by players, with chosen events and a length in real days.
CREATE TABLE IF NOT EXISTS cups (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  days INTEGER NOT NULL,
  events TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cup_players (
  cup_id TEXT NOT NULL,
  user_key TEXT NOT NULL,
  username TEXT NOT NULL,
  age TEXT NOT NULL,
  slot INTEGER NOT NULL,
  joined_at INTEGER NOT NULL,
  stats TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (cup_id, user_key)
);
CREATE INDEX IF NOT EXISTS cup_players_user ON cup_players (user_key);
