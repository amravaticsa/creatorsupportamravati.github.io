-- Expand KYC document types for international editor identities.
-- Preserve existing document metadata and private R2 object keys.
CREATE TABLE editor_kyc_documents_new (
  id TEXT PRIMARY KEY,
  editor_id TEXT NOT NULL REFERENCES editor_profiles(user_id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK(document_type IN ('passport','national_id','pan','voter_id','driving_licence','aadhaar','residence_permit','tax_id','other_government_id')),
  r2_object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png')),
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 10485760),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_review','verified','rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  consent_version TEXT,
  consented_at TEXT
);
INSERT INTO editor_kyc_documents_new (id,editor_id,document_type,r2_object_key,mime_type,size_bytes,status,reviewed_by,reviewed_at,review_note,created_at,consent_version,consented_at)
SELECT id,editor_id,document_type,r2_object_key,mime_type,size_bytes,status,reviewed_by,reviewed_at,review_note,created_at,consent_version,consented_at FROM editor_kyc_documents;
DROP TABLE editor_kyc_documents;
ALTER TABLE editor_kyc_documents_new RENAME TO editor_kyc_documents;
CREATE INDEX idx_editor_kyc_review ON editor_kyc_documents(status,created_at);
CREATE INDEX idx_editor_kyc_editor ON editor_kyc_documents(editor_id,created_at);
