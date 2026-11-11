-- Additive D1 migration for the catalog and subconscious telemetry schema.
-- Customer authentication already uses customer_sessions(token_hash, customer_id,
-- expires_at). Keep that table intact; this separate table stores only a hashed
-- token reference and ties sessions to existing customer accounts.

CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  vector_metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_category
  ON catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_catalog_created
  ON catalog_items(created_at DESC);

CREATE TABLE IF NOT EXISTS subconscious_telemetry_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  vector_type TEXT NOT NULL,
  composite_score REAL NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_user
  ON subconscious_telemetry_log(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_vector
  ON subconscious_telemetry_log(vector_type);

CREATE TABLE IF NOT EXISTS sovereign_customer_sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  scopes TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sovereign_sessions_customer
  ON sovereign_customer_sessions(customer_id);
