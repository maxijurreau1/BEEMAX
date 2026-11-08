-- The earlier nonce table referenced sovereign_identities, while the existing
-- access verifier authenticates identities against sovereign_licenses. Keep
-- replay keys globally unique without requiring a second identity registry.
ALTER TABLE sovereign_nonces RENAME TO sovereign_nonces_legacy;

CREATE TABLE sovereign_nonces (
  req_id TEXT PRIMARY KEY NOT NULL,
  identity TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO sovereign_nonces(req_id, identity, created_at)
SELECT req_id, identity, created_at FROM sovereign_nonces_legacy;

DROP TABLE sovereign_nonces_legacy;

CREATE INDEX idx_sovereign_nonces_created
  ON sovereign_nonces(created_at);
CREATE INDEX idx_sovereign_nonces_identity_created
  ON sovereign_nonces(identity, created_at);
