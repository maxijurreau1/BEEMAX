-- ============================================================================
-- PRODUCTION UNIFIED SQL MIGRATION: BEEMAX / PORTAL-OS1 / DAT PROTOCOL
-- Pre-Tier Index: IDX-PRETIER-001
-- Target Runtime: Cloudflare D1 (SQLite Edge Dialect)
-- Aesthetic & Economic Doctrine: JURREAUISM / DAT ("Done All To That")
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. SOVEREIGN IDENTITY & ROLE-BASED ACCESS CONTROL (USERS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'collector' CHECK (role IN ('collector', 'artist', 'admin')),
  display_name TEXT,
  public_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- 2. MASTER ARTWORK CATALOG & EDITION CONFIGURATION (ARTWORKS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL,
  title TEXT NOT NULL,
  medium TEXT NOT NULL,
  dimensions TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'DAT',
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold', 'archived')),
  edition_number INTEGER NOT NULL DEFAULT 1 CHECK (edition_number >= 1),
  total_editions INTEGER NOT NULL DEFAULT 1 CHECK (total_editions >= 1),
  metadata_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE RESTRICT,
  CHECK (edition_number <= total_editions)
);

CREATE INDEX IF NOT EXISTS idx_artworks_artist_id ON artworks(artist_id);
CREATE INDEX IF NOT EXISTS idx_artworks_status ON artworks(status);

-- ----------------------------------------------------------------------------
-- 3. NORMALIZED LIMITED EDITION SLOTS (ARTWORK_EDITIONS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artwork_editions (
  id TEXT PRIMARY KEY,
  artwork_base_id TEXT NOT NULL,
  edition_number INTEGER NOT NULL CHECK (edition_number >= 1),
  total_editions INTEGER NOT NULL CHECK (total_editions >= 1),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold')),
  owner_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (artwork_base_id) REFERENCES artworks(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (artwork_base_id, edition_number),
  CHECK (edition_number <= total_editions)
);

CREATE INDEX IF NOT EXISTS idx_artwork_editions_base_id ON artwork_editions(artwork_base_id);
CREATE INDEX IF NOT EXISTS idx_artwork_editions_owner_id ON artwork_editions(owner_id);
CREATE INDEX IF NOT EXISTS idx_artwork_editions_status ON artwork_editions(status);

-- ----------------------------------------------------------------------------
-- 4. SOVEREIGN MARKETPLACE ORDERS & ESCROW STATE MACHINE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id TEXT PRIMARY KEY,
  artwork_id TEXT NOT NULL,
  edition_id TEXT,
  buyer_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'DAT',
  payment_status TEXT NOT NULL DEFAULT 'reserved' CHECK (
    payment_status IN ('reserved', 'escrow_held', 'confirmed', 'released', 'cancelled')
  ),
  edition_number INTEGER NOT NULL DEFAULT 1 CHECK (edition_number >= 1),
  escrow_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (artwork_id) REFERENCES artworks(id) ON DELETE RESTRICT,
  FOREIGN KEY (edition_id) REFERENCES artwork_editions(id) ON DELETE RESTRICT,
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_orders_artwork_id ON marketplace_orders(artwork_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON marketplace_orders(payment_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_active_edition
  ON marketplace_orders(artwork_id, edition_number)
  WHERE payment_status != 'cancelled';

-- ----------------------------------------------------------------------------
-- 5. MULTI-SIGNATURE ESCROW APPROVALS (ESCROW_SIGNATURES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escrow_signatures (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  signer_id TEXT NOT NULL,
  signer_role TEXT NOT NULL CHECK (signer_role IN ('buyer', 'artist', 'admin')),
  signature_hash TEXT NOT NULL,
  signed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (order_id) REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (signer_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (order_id, signer_id)
);

CREATE INDEX IF NOT EXISTS idx_escrow_signatures_order_id ON escrow_signatures(order_id);

-- ----------------------------------------------------------------------------
-- 6. CRYPTOGRAPHIC PROVENANCE CERTIFICATES (DAT PROTOCOL LEDGER)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provenance_certificates (
  id TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  artwork_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  edition_string TEXT NOT NULL,
  protocol_version TEXT NOT NULL DEFAULT 'DAT-JURREAUISM-v1',
  hash_signature TEXT UNIQUE NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (order_id) REFERENCES marketplace_orders(id) ON DELETE RESTRICT,
  FOREIGN KEY (artwork_id) REFERENCES artworks(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_provenance_artwork_id ON provenance_certificates(artwork_id);
CREATE INDEX IF NOT EXISTS idx_provenance_owner_id ON provenance_certificates(owner_id);
CREATE INDEX IF NOT EXISTS idx_provenance_hash ON provenance_certificates(hash_signature);

-- ----------------------------------------------------------------------------
-- 7. MAX GAMES FACTORY & APP SHOWROOM REGISTRY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS showroom_apps (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('game', 'app', 'quantum_sim', 'agent')),
  version TEXT NOT NULL DEFAULT '3.0.0',
  runtime_target TEXT NOT NULL DEFAULT 'cloudflare-edge',
  manifest_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'beta', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 8. BEEMAX MICROKERNEL INDICES & AUDIT TELEMETRY LOGS (IDX-PRETIER-001)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beemax_ledger_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT,
  payload_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_beemax_events_entity ON beemax_ledger_events(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS kernel_thread_indices (
  id TEXT PRIMARY KEY,
  pre_tier_index TEXT NOT NULL DEFAULT 'IDX-PRETIER-001',
  namespace TEXT NOT NULL,
  command TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  telemetry_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
