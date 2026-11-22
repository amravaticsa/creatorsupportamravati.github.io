-- Apply only to the isolated legacy Editor Portal D1 (CSA_VIDEO_DB).
-- Stores one-time request nonces; no customer, editor, order, or media data.
CREATE TABLE IF NOT EXISTS legacy_bridge_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_legacy_bridge_nonces_expiry
  ON legacy_bridge_nonces(expires_at);
