ALTER TABLE editor_profiles ADD COLUMN phone_encrypted TEXT;
ALTER TABLE editor_profiles ADD COLUMN payout_provider_account_ref TEXT;
ALTER TABLE editor_profiles ADD COLUMN payout_profile_status TEXT NOT NULL DEFAULT 'not_started' CHECK(payout_profile_status IN ('not_started','pending','verified','restricted'));
ALTER TABLE editor_profiles ADD COLUMN tax_profile_status TEXT NOT NULL DEFAULT 'not_started' CHECK(tax_profile_status IN ('not_started','pending','verified','restricted'));

CREATE TABLE IF NOT EXISTS project_disputes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  opened_by TEXT NOT NULL REFERENCES users(id),
  dispute_type TEXT NOT NULL CHECK(dispute_type IN ('scope','quality','deadline','payment','deposit','conduct','other')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','under_review','resolved','rejected')),
  resolution_notes TEXT,
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_disputes_project_status ON project_disputes(project_id,status,created_at);