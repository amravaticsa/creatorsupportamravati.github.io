-- Append-only administrative incident and resolution events for multipart upload support.
CREATE TABLE IF NOT EXISTS multipart_upload_incidents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES multipart_upload_sessions(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  incident_type TEXT NOT NULL CHECK (incident_type IN ('upload_failed','unknown_completion','stale_completion','expired_session','integrity_issue','other')),
  resolution_status TEXT NOT NULL CHECK (resolution_status IN ('reviewed','awaiting_user','reupload_requested','resolved','escalated')),
  notes TEXT NOT NULL CHECK (length(notes) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_multipart_upload_incidents_session_created
  ON multipart_upload_incidents(session_id, created_at DESC);
