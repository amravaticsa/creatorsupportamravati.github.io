-- Private editor identity verification records. Identity documents are stored only in the private R2 bucket.
CREATE TABLE IF NOT EXISTS editor_kyc_documents (
  id TEXT PRIMARY KEY,
  editor_id TEXT NOT NULL REFERENCES editor_profiles(user_id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK(document_type IN ('passport','national_id','pan','voter_id','driving_licence')),
  r2_object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png')),
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 10485760),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_review','verified','rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_editor_kyc_review ON editor_kyc_documents(status,created_at);
CREATE INDEX IF NOT EXISTS idx_editor_kyc_editor ON editor_kyc_documents(editor_id,created_at);
