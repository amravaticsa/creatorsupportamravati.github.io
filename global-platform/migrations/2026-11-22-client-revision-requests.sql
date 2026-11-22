-- CSA Global staging migration: client revision requests and included-revision tracking.
-- Apply to the staging D1 database only. Production migration requires a separate release.
CREATE TABLE IF NOT EXISTS client_revision_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  submission_id TEXT NOT NULL REFERENCES work_submissions(id),
  client_id TEXT NOT NULL REFERENCES users(id),
  request_number INTEGER NOT NULL CHECK(request_number > 0),
  notes TEXT NOT NULL CHECK(length(notes) BETWEEN 5 AND 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at TEXT,
  handled_by TEXT REFERENCES users(id),
  UNIQUE(project_id, request_number)
);
CREATE INDEX IF NOT EXISTS idx_client_revision_requests_project_created
  ON client_revision_requests(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_revision_requests_assignment_status
  ON client_revision_requests(assignment_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_revision_requests_one_open_per_project
  ON client_revision_requests(project_id)
  WHERE status IN ('open','in_progress');
