-- Safely claim legacy Video Editing orders into a CSA Global client account.
ALTER TABLE projects ADD COLUMN legacy_payment_status TEXT;

CREATE TABLE IF NOT EXISTS legacy_video_order_claims (
  legacy_order_id TEXT PRIMARY KEY,
  legacy_order_code TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES client_profiles(user_id),
  claimed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS project_status_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  changed_by TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'csa_global',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_project_status_history_project ON project_status_history(project_id, created_at);
