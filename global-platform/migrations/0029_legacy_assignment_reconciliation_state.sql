-- Add durable uncertain-outcome and reconciliation metadata to assignment links.
-- Rebuild preserves all existing rows and stable unique identifiers.
-- Apply only to an isolated Global API staging D1 after schema/backup review.
-- This migration does not call the legacy Worker or transfer any assignments.

DROP INDEX IF EXISTS idx_legacy_assignment_links_status;

CREATE TABLE legacy_assignment_links_0029_new (
  global_assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
  legacy_order_id TEXT NOT NULL UNIQUE,
  legacy_assignment_id TEXT UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  bridge_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(bridge_status IN ('pending','created','failed','revoked','reconciliation_required')),
  last_error_code TEXT,
  request_hash TEXT,
  correlation_id TEXT UNIQUE,
  remote_result_state TEXT NOT NULL DEFAULT 'not_attempted'
    CHECK(remote_result_state IN (
      'not_attempted','confirmed_created','definite_failure','unknown',
      'reconciled_created','reconciled_absent'
    )),
  reconciled_at TEXT,
  reconciled_by TEXT REFERENCES users(id),
  reconciliation_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(
    (bridge_status='created'
      AND legacy_assignment_id IS NOT NULL
      AND last_error_code IS NULL
      AND remote_result_state IN ('confirmed_created','reconciled_created'))
    OR
    (bridge_status='reconciliation_required'
      AND legacy_assignment_id IS NULL
      AND last_error_code='remote_result_uncertain'
      AND remote_result_state='unknown'
      AND request_hash IS NOT NULL
      AND length(trim(request_hash)) >= 32
      AND correlation_id IS NOT NULL
      AND length(trim(correlation_id)) >= 8)
    OR
    (bridge_status='failed'
      AND legacy_assignment_id IS NULL
      AND remote_result_state IN ('definite_failure','reconciled_absent'))
    OR
    (bridge_status IN ('pending','revoked')
      AND remote_result_state='not_attempted')
  ),
  CHECK(
    remote_result_state NOT IN ('reconciled_created','reconciled_absent')
    OR (
      reconciled_at IS NOT NULL AND length(trim(reconciled_at)) > 0
      AND reconciled_by IS NOT NULL
      AND reconciliation_note IS NOT NULL
      AND length(trim(reconciliation_note)) >= 3
    )
  )
);

INSERT INTO legacy_assignment_links_0029_new (
  global_assignment_id, legacy_order_id, legacy_assignment_id,
  idempotency_key, bridge_status, last_error_code,
  remote_result_state, created_at, updated_at
)
SELECT
  global_assignment_id, legacy_order_id, legacy_assignment_id,
  idempotency_key, bridge_status, last_error_code,
  CASE
    WHEN bridge_status='created' THEN 'confirmed_created'
    WHEN bridge_status='failed' THEN 'definite_failure'
    ELSE 'not_attempted'
  END,
  created_at, updated_at
FROM legacy_assignment_links;

DROP TABLE legacy_assignment_links;
ALTER TABLE legacy_assignment_links_0029_new RENAME TO legacy_assignment_links;

CREATE INDEX idx_legacy_assignment_links_status
  ON legacy_assignment_links(bridge_status,updated_at);

CREATE TRIGGER trg_legacy_assignment_link_transition_guard
BEFORE UPDATE OF bridge_status,remote_result_state ON legacy_assignment_links
WHEN
  (OLD.bridge_status='created' AND NEW.bridge_status<>'created')
  OR (OLD.bridge_status='revoked' AND NEW.bridge_status<>'revoked')
  OR (OLD.bridge_status='failed' AND NEW.bridge_status<>'failed')
  OR (OLD.bridge_status='reconciliation_required'
      AND NEW.bridge_status NOT IN ('reconciliation_required','created','failed','revoked'))
  OR (OLD.bridge_status='pending'
      AND NEW.bridge_status NOT IN ('pending','created','failed','revoked','reconciliation_required'))
BEGIN
  SELECT RAISE(ABORT,'legacy_assignment_bridge_transition_invalid');
END;

CREATE TRIGGER trg_legacy_assignment_reconciliation_audit_guard
BEFORE UPDATE ON legacy_assignment_links
WHEN
  (OLD.bridge_status='reconciliation_required'
    AND NEW.bridge_status='created'
    AND NEW.remote_result_state='reconciled_created'
    AND (
      NEW.reconciled_at IS NULL OR length(trim(NEW.reconciled_at))=0 OR
      NEW.reconciled_by IS NULL OR
      NEW.reconciliation_note IS NULL OR length(trim(NEW.reconciliation_note))<3
    ))
  OR
  (OLD.bridge_status='reconciliation_required'
    AND NEW.bridge_status='failed'
    AND NEW.remote_result_state='reconciled_absent'
    AND (
      NEW.reconciled_at IS NULL OR length(trim(NEW.reconciled_at))=0 OR
      NEW.reconciled_by IS NULL OR
      NEW.reconciliation_note IS NULL OR length(trim(NEW.reconciliation_note))<3
    ))
BEGIN
  SELECT RAISE(ABORT,'legacy_assignment_reconciliation_audit_required');
END;
