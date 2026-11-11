-- Championship markets (venues): run once on the live database.
ALTER TABLE cups ADD COLUMN venue TEXT NOT NULL DEFAULT 'classic';
