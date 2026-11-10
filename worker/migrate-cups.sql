-- Championships: run once on the live database.
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
