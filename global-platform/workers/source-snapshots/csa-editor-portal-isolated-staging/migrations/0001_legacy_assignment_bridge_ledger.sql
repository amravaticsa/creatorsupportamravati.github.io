-- DESIGN / STAGING-ONLY MIGRATION CANDIDATE.
-- Do not apply until the owner confirms the canonical legacy D1 database,
-- reviews its live schema, and explicitly approves a staging migration.
-- This additive ledger intentionally has no foreign keys to legacy tables:
-- their deployed key types/constraints have not yet been verified.
-- It stores identifiers and protocol metadata only; no credentials or PII.

CREATE TABLE IF NOT EXISTS legacy_assignment_bridge_ledger (
  id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL
    CHECK(length(request_hash) = 64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
  legacy_order_id TEXT NOT NULL UNIQUE,
  order_code TEXT NOT NULL,
  editor_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL UNIQUE,
  result_state TEXT NOT NULL DEFAULT 'created'
    CHECK(result_state = 'created'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(length(trim(id)) > 0),
  CHECK(length(trim(correlation_id)) >= 8),
  CHECK(length(trim(idempotency_key)) >= 8),
  CHECK(length(trim(legacy_order_id)) > 0),
  CHECK(length(trim(order_code)) > 0),
  CHECK(length(trim(editor_id)) > 0),
  CHECK(length(trim(assignment_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_legacy_assignment_bridge_ledger_created
  ON legacy_assignment_bridge_ledger(created_at);
