-- CSA schema-only snapshot generated from staging D1 on 2026-11-21.
-- Schema only: no application rows, password hashes, sessions, OTPs, or enrollment tokens.
-- Extracted from sqlite_master in bounded chunks; compare object counts and test before migration.
PRAGMA foreign_keys = ON;

-- table: rush_delivery_audit
CREATE TABLE rush_delivery_audit (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('quote_created','approved','rejected','payment_created','payment_verified','expired','cancelled')),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES rush_delivery_quotes(id)
);

-- table: rush_delivery_quotes
CREATE TABLE rush_delivery_quotes (
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
, payment_type TEXT CHECK (payment_type IN ('advance','full') OR payment_type IS NULL));

-- table: video_editing_orders
CREATE TABLE video_editing_orders (
 id TEXT PRIMARY KEY,
 order_code TEXT NOT NULL UNIQUE,
 customer_email TEXT NOT NULL,
 customer_access_hash TEXT NOT NULL,
 project_budget_paise INTEGER NOT NULL CHECK(project_budget_paise >= 10000),
 is_draft INTEGER NOT NULL DEFAULT 1 CHECK(is_draft IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- index: idx_rush_audit_quote
CREATE INDEX idx_rush_audit_quote ON rush_delivery_audit(quote_id, created_at DESC);

-- index: idx_rush_quotes_draft
CREATE INDEX idx_rush_quotes_draft ON rush_delivery_quotes(draft_code, created_at DESC);

-- index: idx_rush_quotes_status
CREATE INDEX idx_rush_quotes_status ON rush_delivery_quotes(approval_status, quote_status);

-- index: idx_staging_video_draft_code
CREATE INDEX idx_staging_video_draft_code ON video_editing_orders(order_code,is_draft);
