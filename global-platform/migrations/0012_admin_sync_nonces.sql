-- Replay protection for signed Super Admin -> Global authorization snapshots.
CREATE TABLE IF NOT EXISTS admin_sync_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sync_nonces_expiry ON admin_sync_nonces(expires_at);
