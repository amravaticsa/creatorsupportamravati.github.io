-- Record explicit consent version and timestamp for every submitted identity document.
ALTER TABLE editor_kyc_documents ADD COLUMN consent_version TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE editor_kyc_documents ADD COLUMN consented_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
