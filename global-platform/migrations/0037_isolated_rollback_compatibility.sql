-- 0037: Forward-compatible additive schema alignment for the Global API staging rollback path.
-- Apply ONLY to the legacy Global staging D1 (470a81b8-3d36-4e2d-942c-5cbb2746a473).
-- The isolated Global staging D1 already contains these columns/objects.
-- This migration preserves older columns as compatibility aliases; it does not rename or drop data.
-- All added columns are nullable so existing rows remain valid and no actor/approval is fabricated.

ALTER TABLE projects ADD COLUMN client_approved_at TEXT;
ALTER TABLE projects ADD COLUMN client_approved_by TEXT;

ALTER TABLE client_refund_requests ADD COLUMN reviewed_by_source_admin_id TEXT;

ALTER TABLE editor_deposit_refunds ADD COLUMN requested_by_source_admin_id TEXT;
ALTER TABLE editor_deposit_refunds ADD COLUMN processed_by_source_admin_id TEXT;
ALTER TABLE editor_deposit_refunds ADD COLUMN settlement_reference TEXT;
ALTER TABLE editor_deposit_refunds ADD COLUMN processed_at TEXT;

ALTER TABLE legacy_editor_identity_links ADD COLUMN created_by_source_admin_id TEXT;
ALTER TABLE legacy_editor_identity_links ADD COLUMN reviewed_by_source_admin_id TEXT;

-- Match the isolated staging indexes. Partial unique indexes protect against duplicate
-- open revisions and duplicate deposit-refund ledger entries without rewriting existing rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_revision_requests_open_submission
  ON client_revision_requests(submission_id) WHERE status IN ('open','in_progress');
CREATE INDEX IF NOT EXISTS idx_client_revision_requests_project_status
  ON client_revision_requests(project_id,status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_ledger_unique_refund
  ON deposit_ledger(payment_id) WHERE payment_id IS NOT NULL AND entry_type='deposit_refunded';
CREATE INDEX IF NOT EXISTS idx_project_tenders_project_status
  ON project_tenders(project_id,status);
CREATE INDEX IF NOT EXISTS idx_users_verified_country
  ON users(country_verified_at,country_code);

-- These guards ensure a country cannot be activated for commerce without valid
-- currency and timezone metadata. Existing rows are not modified by trigger creation.
CREATE TRIGGER IF NOT EXISTS trg_global_country_metadata_gate_insert
BEFORE INSERT ON countries
WHEN (NEW.commercial_status='active' OR NEW.orders_enabled=1 OR NEW.payment_enabled=1 OR NEW.payout_enabled=1)
 AND (NEW.currency_code IS NULL OR length(NEW.currency_code)<>3 OR NEW.currency_code GLOB '*[^A-Z]*'
      OR NEW.timezone IS NULL OR length(trim(NEW.timezone))=0)
BEGIN
 SELECT RAISE(ABORT,'Global country activation and commercial features require valid currency and timezone');
END;

CREATE TRIGGER IF NOT EXISTS trg_global_country_metadata_gate_update
BEFORE UPDATE OF commercial_status,currency_code,timezone,orders_enabled,payment_enabled,payout_enabled ON countries
WHEN (NEW.commercial_status='active' OR NEW.orders_enabled=1 OR NEW.payment_enabled=1 OR NEW.payout_enabled=1)
 AND (NEW.currency_code IS NULL OR length(NEW.currency_code)<>3 OR NEW.currency_code GLOB '*[^A-Z]*'
      OR NEW.timezone IS NULL OR length(trim(NEW.timezone))=0)
BEGIN
 SELECT RAISE(ABORT,'Global country activation and commercial features require valid currency and timezone');
END;

CREATE VIEW IF NOT EXISTS v_tender_country_scope AS
SELECT t.id AS tender_id,t.project_id,v.client_user_id,v.country_code,v.country_scope_status,t.status AS tender_status
FROM project_tenders t
JOIN v_project_country_scope v ON v.project_id=t.project_id;

-- The isolated database also receives this harmless query index so the two
-- staging databases retain the same notification lookup optimization.
