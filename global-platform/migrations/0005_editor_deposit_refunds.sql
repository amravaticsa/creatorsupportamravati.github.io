-- Full security-deposit refunds are only requested after CSA records quality approval.
-- One refund request per captured editor deposit prevents duplicate refunds.
CREATE TABLE IF NOT EXISTS editor_deposit_refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id),
  editor_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_refund_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('requesting','pending','processed','failed','unknown')),
  provider_response TEXT,
  requested_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_editor_deposit_refunds_editor_created
  ON editor_deposit_refunds(editor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_editor_deposit_refunds_status
  ON editor_deposit_refunds(status, created_at);

-- A single processed-refund ledger entry per original deposit, even if API and webhook race.
CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_ledger_refund_once
  ON deposit_ledger(payment_id)
  WHERE entry_type = 'deposit_refunded' AND payment_id IS NOT NULL;
