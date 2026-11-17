-- Resumable multipart uploads for large source files and editor submissions.
CREATE TABLE IF NOT EXISTS multipart_upload_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  assignment_id TEXT REFERENCES assignments(id),
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('project_file','submission')),
  r2_object_key TEXT NOT NULL UNIQUE,
  r2_upload_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  total_size_bytes INTEGER NOT NULL CHECK (total_size_bytes > 0),
  part_size_bytes INTEGER NOT NULL CHECK (part_size_bytes >= 5242880),
  expected_parts INTEGER NOT NULL CHECK (expected_parts > 0 AND expected_parts <= 1000),
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('open','completing','completed','aborted','unknown')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_multipart_upload_sessions_owner
  ON multipart_upload_sessions(uploaded_by,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_multipart_upload_sessions_expiry
  ON multipart_upload_sessions(status,expires_at);
CREATE TABLE IF NOT EXISTS multipart_upload_parts (
  session_id TEXT NOT NULL REFERENCES multipart_upload_sessions(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL CHECK (part_number > 0),
  etag TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(session_id,part_number)
);
