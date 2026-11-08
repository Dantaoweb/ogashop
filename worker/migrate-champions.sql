-- Market champions: run once on the live database.
ALTER TABLE members ADD COLUMN money_score INTEGER;
ALTER TABLE members ADD COLUMN money_ms INTEGER;
ALTER TABLE members ADD COLUMN change_score INTEGER;
ALTER TABLE members ADD COLUMN change_ms INTEGER;
