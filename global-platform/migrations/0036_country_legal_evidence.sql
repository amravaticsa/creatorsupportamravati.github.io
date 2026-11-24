-- Country legal evidence metadata used by the isolated Global API canonical schema.
-- Evidence objects are stored privately in the isolated Global API MEDIA R2 bucket.
-- This additive migration is safe on fresh or existing staging D1 databases.
CREATE TABLE IF NOT EXISTS country_legal_evidence (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL REFERENCES countries(country_code) ON DELETE CASCADE,
  uploaded_by_source_admin_id TEXT NOT NULL,
  evidence_category TEXT NOT NULL CHECK(evidence_category IN ('corporate_registration','tax_registration','privacy_data_protection','consumer_protection','payments_regulatory','licensing','other')),
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png')),
  size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
  r2_object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
