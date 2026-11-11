-- Beerculator 2000 - SQLite schema (applied automatically on startup)
-- IDs are UUID strings, timestamps are ISO-8601 UTC strings.

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- debtor_id owes creditor_id `amount` beers
CREATE TABLE IF NOT EXISTS beer_debts (
  id          TEXT PRIMARY KEY,
  debtor_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creditor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (debtor_id, creditor_id),
  CHECK (debtor_id != creditor_id)
);

CREATE TABLE IF NOT EXISTS beer_log (
  id          TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL CHECK (event_type IN ('transaction', 'cancellation', 'rationalization', 'manual_debt')),
  description TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS beer_log_created_at ON beer_log (created_at);
