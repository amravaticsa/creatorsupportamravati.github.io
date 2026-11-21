-- CSA Global Admin sync monitoring history (staging and production migration artifact)
CREATE TABLE IF NOT EXISTS global_admin_sync_logs (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled','manual','lifecycle')),
  outcome TEXT NOT NULL CHECK (outcome IN ('success','failed')),
  synced_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  actor_admin_id TEXT,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (actor_admin_id) REFERENCES admin_accounts(id)
);
CREATE INDEX IF NOT EXISTS idx_global_admin_sync_logs_started
  ON global_admin_sync_logs(started_at DESC);
