-- Championship house rules: run once on the live database.
ALTER TABLE cups ADD COLUMN house TEXT NOT NULL DEFAULT '{}';
