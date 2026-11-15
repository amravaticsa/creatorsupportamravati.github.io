CREATE TABLE IF NOT EXISTS payment_webhook_events (
 id TEXT PRIMARY KEY,
 provider TEXT NOT NULL,
 event_id TEXT NOT NULL UNIQUE,
 event_type TEXT NOT NULL,
 payment_id TEXT REFERENCES payments(id),
 payload_json TEXT NOT NULL DEFAULT '{}',
 processed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_webhook_events(payment_id,processed_at);