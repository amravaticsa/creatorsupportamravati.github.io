-- CSA Global staging: in-app notification preferences and client refund review records.
-- Safe to apply where these tables were created during earlier staging bootstrap.

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel IN ('in_app','email','whatsapp')),
  template_key TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed','read')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  in_app_enabled INTEGER NOT NULL DEFAULT 1 CHECK(in_app_enabled IN (0,1)),
  email_enabled INTEGER NOT NULL DEFAULT 1 CHECK(email_enabled IN (0,1)),
  whatsapp_enabled INTEGER NOT NULL DEFAULT 0 CHECK(whatsapp_enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK(attempt_number > 0),
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('accepted','sent','delivered','failed','unknown')),
  error_code TEXT,
  error_message TEXT,
  attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(notification_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS client_refund_requests (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  client_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  currency TEXT NOT NULL CHECK(length(currency)=3),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','under_review','approved','processing','processed','rejected','failed','cancelled','unknown')),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_refund_id TEXT UNIQUE,
  requested_by TEXT NOT NULL REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id),
  review_note TEXT,
  provider_response_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_dispatch ON notifications(status, channel, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_attempts_notification ON notification_delivery_attempts(notification_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_refunds_client_created ON client_refund_requests(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_refunds_payment ON client_refund_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_client_refunds_status_created ON client_refund_requests(status, created_at);
