-- Audit actual executions of the scheduled multipart upload cleanup.
CREATE TABLE IF NOT EXISTS multipart_cleanup_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','success','partial','failed')),
  checked INTEGER NOT NULL DEFAULT 0,
  aborted INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_multipart_cleanup_runs_started
  ON multipart_cleanup_runs(started_at DESC);
