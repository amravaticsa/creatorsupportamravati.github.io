-- CSA Video Editing: Rush delivery staging schema
-- Apply only to the isolated csa-video-rush-staging D1 database.
-- Standard: 0%; Priority (1 day): 25%; Same-day: 50% and Super Admin approval required.

CREATE TABLE IF NOT EXISTS rush_delivery_quotes (
  id TEXT PRIMARY KEY,
  draft_code TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  rush_level TEXT NOT NULL CHECK (rush_level IN ('standard','priority_1_day','same_day')),
  base_amount_paise INTEGER NOT NULL CHECK (base_amount_paise >= 10000),
  surcharge_bps INTEGER NOT NULL CHECK (surcharge_bps IN (0,2500,5000)),
  surcharge_amount_paise INTEGER NOT NULL CHECK (surcharge_amount_paise >= 0),
  total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise = base_amount_paise + surcharge_amount_paise),
  approval_status TEXT NOT NULL CHECK (approval_status IN ('not_required','pending','approved','rejected')),
  approved_by TEXT,
  approved_at TEXT,
  approval_note TEXT,
  quote_status TEXT NOT NULL DEFAULT 'active' CHECK (quote_status IN ('active','expired','superseded','paid','cancelled')),
  payment_order_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rush_quotes_draft
  ON rush_delivery_quotes(draft_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rush_quotes_status
  ON rush_delivery_quotes(approval_status, quote_status);

CREATE TABLE IF NOT EXISTS rush_delivery_audit (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('quote_created','approved','rejected','payment_created','payment_verified','expired','cancelled')),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES rush_delivery_quotes(id)
);

CREATE INDEX IF NOT EXISTS idx_rush_audit_quote
  ON rush_delivery_audit(quote_id, created_at DESC);
