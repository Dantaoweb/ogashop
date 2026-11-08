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
