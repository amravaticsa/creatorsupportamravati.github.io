-- 0023: Tender bidding, CSA pricing controls and client quotations (staging rollout).
-- Pricing remains UNCONFIGURED by default. No margin is invented or activated.
CREATE TABLE IF NOT EXISTS project_tenders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scope_summary TEXT NOT NULL,
  bid_deadline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed','awarded','cancelled')),
  published_by TEXT,
  published_at TEXT,
  closed_at TEXT,
  awarded_bid_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_project_tenders_status_deadline ON project_tenders(status,bid_deadline);

CREATE TABLE IF NOT EXISTS editor_tender_bids (
  id TEXT PRIMARY KEY,
  tender_id TEXT NOT NULL REFERENCES project_tenders(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  editor_id TEXT NOT NULL REFERENCES users(id),
  bid_amount_minor INTEGER NOT NULL CHECK(bid_amount_minor > 0),
  currency TEXT NOT NULL CHECK(length(currency)=3),
  delivery_days INTEGER NOT NULL CHECK(delivery_days BETWEEN 1 AND 365),
  proposal TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','shortlisted','withdrawn','won','rejected')),
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tender_id,editor_id)
);
CREATE INDEX IF NOT EXISTS idx_editor_tender_bids_tender ON editor_tender_bids(tender_id,status,bid_amount_minor);

CREATE TABLE IF NOT EXISTS csa_pricing_policies (
  currency TEXT PRIMARY KEY CHECK(length(currency)=3),
  margin_bps INTEGER CHECK(margin_bps BETWEEN 0 AND 10000),
  minimum_margin_minor INTEGER NOT NULL DEFAULT 0 CHECK(minimum_margin_minor>=0),
  status TEXT NOT NULL DEFAULT 'unconfigured' CHECK(status IN ('unconfigured','active','inactive')),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS client_quotes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tender_id TEXT REFERENCES project_tenders(id),
  winning_bid_id TEXT REFERENCES editor_tender_bids(id),
  client_id TEXT NOT NULL REFERENCES users(id),
  base_cost_minor INTEGER NOT NULL CHECK(base_cost_minor>0),
  margin_minor INTEGER NOT NULL CHECK(margin_minor>=0),
  total_amount_minor INTEGER NOT NULL CHECK(total_amount_minor>=base_cost_minor),
  currency TEXT NOT NULL CHECK(length(currency)=3),
  pricing_margin_bps INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','rejected','expired','superseded')),
  valid_until TEXT,
  created_by TEXT NOT NULL,
  sent_at TEXT,
  client_decision_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_client_quotes_client ON client_quotes(client_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_client_quotes_project ON client_quotes(project_id,created_at);

CREATE TABLE IF NOT EXISTS client_quote_events (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES client_quotes(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('created','sent','accepted','rejected','expired','superseded')),
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
