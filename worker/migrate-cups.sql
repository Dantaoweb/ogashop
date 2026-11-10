-- Championships, second design (registration and a common start). Run once on the live database.
-- The first design had no real players, so its tables are replaced.
DROP TABLE IF EXISTS cup_players;
DROP TABLE IF EXISTS cups;
-- Championships: a host sets the rules, players register, everyone starts together.
CREATE TABLE IF NOT EXISTS cups (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  kind TEXT NOT NULL,
  length INTEGER NOT NULL,
  events TEXT NOT NULL,
  level_from INTEGER NOT NULL,
  level_to INTEGER NOT NULL,
  start_mode TEXT NOT NULL,
  start_at INTEGER,
  started_at INTEGER,
  ends_at INTEGER,
  cancelled INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
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
