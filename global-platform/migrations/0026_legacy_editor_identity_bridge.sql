-- Explicit identity and assignment links between CSA Global and the legacy Video Editing queue.
-- Additive only: no legacy accounts, credentials, orders, or assignments are copied.
-- Apply only to the isolated Global API staging D1 after review.

CREATE TABLE IF NOT EXISTS legacy_editor_identity_links (
  editor_user_id TEXT PRIMARY KEY REFERENCES editor_profiles(user_id) ON DELETE CASCADE,
  legacy_editor_id TEXT NOT NULL UNIQUE,
  link_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(link_status IN ('pending','active','revoked')),
  link_method TEXT NOT NULL DEFAULT 'admin_verified'
    CHECK(link_method IN ('admin_verified','migration_reconciled')),
  created_by TEXT NOT NULL REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  revoked_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(
    (link_status='pending' AND reviewed_at IS NULL AND revoked_at IS NULL)
    OR (link_status='active' AND reviewed_at IS NOT NULL AND revoked_at IS NULL)
    OR (link_status='revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_legacy_editor_links_status
  ON legacy_editor_identity_links(link_status,updated_at);

CREATE TABLE IF NOT EXISTS legacy_assignment_links (
  global_assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
  legacy_order_id TEXT NOT NULL UNIQUE,
  legacy_assignment_id TEXT UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  bridge_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(bridge_status IN ('pending','created','failed','revoked')),
  last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(
    (bridge_status='created' AND legacy_assignment_id IS NOT NULL AND last_error_code IS NULL)
    OR (bridge_status IN ('pending','failed','revoked'))
  )
);

CREATE INDEX IF NOT EXISTS idx_legacy_assignment_links_status
  ON legacy_assignment_links(bridge_status,updated_at);
