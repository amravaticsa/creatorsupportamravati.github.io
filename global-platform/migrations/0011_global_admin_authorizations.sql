-- Super Admin-controlled authorization registry for CSA Global portal administrators.
-- Rows are written only by the authenticated server-to-server identity bridge.
CREATE TABLE IF NOT EXISTS global_admin_authorizations (
  id TEXT PRIMARY KEY,
  source_admin_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  source_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','revoked')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  synced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_global_admin_authorizations_status_email
  ON global_admin_authorizations(status,email);
