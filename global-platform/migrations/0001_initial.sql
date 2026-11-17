PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  auth_subject TEXT UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('client','editor','admin','staff')),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email_verified_at TEXT,
  account_status TEXT NOT NULL DEFAULT 'pending' CHECK(account_status IN ('pending','active','suspended','closed')),
  country_code TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS client_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  company_name TEXT,
  phone_encrypted TEXT,
  country TEXT,
  timezone TEXT,
  preferred_language TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS editor_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_editor_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT,
  languages_json TEXT NOT NULL DEFAULT '[]',
  experience_level TEXT,
  software_json TEXT NOT NULL DEFAULT '[]',
  specializations_json TEXT NOT NULL DEFAULT '[]',
  portfolio_url TEXT,
  sample_url TEXT,
  rate_amount_minor INTEGER,
  rate_currency TEXT,
  rate_basis TEXT CHECK(rate_basis IN ('hour','video','project')),
  availability TEXT,
  timezone TEXT,
  bio TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','in_review','verified','rejected')),
  reliability_score REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS editor_skills (
  id TEXT PRIMARY KEY,
  editor_id TEXT NOT NULL REFERENCES editor_profiles(user_id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  skill_level TEXT,
  UNIQUE(editor_id, skill_name)
);

CREATE TABLE IF NOT EXISTS editor_portfolio_items (
  id TEXT PRIMARY KEY,
  editor_id TEXT NOT NULL REFERENCES editor_profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  url TEXT NOT NULL,
  permission_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(permission_confirmed IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  public_project_code TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES client_profiles(user_id),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  brief TEXT NOT NULL,
  raw_footage_minutes INTEGER,
  final_duration_minutes INTEGER,
  video_count INTEGER,
  resolution TEXT,
  aspect_ratio TEXT,
  requirements_json TEXT NOT NULL DEFAULT '{}',
  reference_url TEXT,
  budget_amount_minor INTEGER,
  budget_currency TEXT,
  budget_type TEXT NOT NULL CHECK(budget_type IN ('fixed','flexible','recommend')),
  preferred_deadline TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','urgent','flexible')),
  revisions_included INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','under_review','quotation_pending','approved','matching','assigned','in_progress','quality_check','client_review','revision','completed','cancelled','disputed')),
  client_visible_status TEXT NOT NULL DEFAULT 'submitted',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  r2_object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  access_scope TEXT NOT NULL CHECK(access_scope IN ('admin_only','assigned_editor','client_and_admin')),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS project_offers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  editor_id TEXT NOT NULL REFERENCES editor_profiles(user_id),
  offer_message TEXT,
  proposed_fee_minor INTEGER NOT NULL,
  fee_currency TEXT NOT NULL,
  delivery_days INTEGER NOT NULL,
  deposit_amount_minor INTEGER NOT NULL,
  deposit_currency TEXT NOT NULL,
  offer_expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','accepted_pending_terms','terms_accepted_pending_deposit','deposit_pending','ready_for_assignment','assigned','declined','expired','withdrawn')),
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(project_id, editor_id, created_at)
);

CREATE TABLE IF NOT EXISTS agreement_versions (
  id TEXT PRIMARY KEY,
  agreement_type TEXT NOT NULL CHECK(agreement_type IN ('editor_master','project_specific','client_service')),
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(agreement_type, version)
);

CREATE TABLE IF NOT EXISTS agreement_acceptances (
  id TEXT PRIMARY KEY,
  agreement_version_id TEXT NOT NULL REFERENCES agreement_versions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  offer_id TEXT REFERENCES project_offers(id),
  accepted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ip_hash TEXT,
  user_agent_hash TEXT,
  UNIQUE(agreement_version_id, user_id, offer_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  offer_id TEXT REFERENCES project_offers(id),
  payment_type TEXT NOT NULL CHECK(payment_type IN ('client_advance','client_balance','editor_security_deposit','editor_payout','deposit_refund','client_refund')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
  currency TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT UNIQUE,
  provider_event_id TEXT UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','pending','succeeded','failed','refunded','partially_refunded','reversed')),
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS deposit_ledger (
  id TEXT PRIMARY KEY,
  editor_id TEXT NOT NULL REFERENCES editor_profiles(user_id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  offer_id TEXT NOT NULL REFERENCES project_offers(id),
  payment_id TEXT REFERENCES payments(id),
  entry_type TEXT NOT NULL CHECK(entry_type IN ('deposit_received','deposit_locked','deposit_released','deposit_refunded','adjustment_pending','adjustment_approved','adjustment_reversed')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
  currency TEXT NOT NULL,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  offer_id TEXT NOT NULL UNIQUE REFERENCES project_offers(id),
  editor_id TEXT NOT NULL REFERENCES editor_profiles(user_id),
  assigned_by TEXT NOT NULL REFERENCES users(id),
  assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','submitted','quality_check','revision','approved','completed','cancelled','reassigned'))
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES assignments(id),
  title TEXT NOT NULL,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','submitted','approved','rejected')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS work_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  submitted_by TEXT NOT NULL REFERENCES users(id),
  r2_object_key TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  notes TEXT,
  qc_status TEXT NOT NULL DEFAULT 'pending' CHECK(qc_status IN ('pending','approved','changes_requested','rejected')),
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(assignment_id, version_number)
);

CREATE TABLE IF NOT EXISTS revision_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  submission_id TEXT REFERENCES work_submissions(id),
  requested_by TEXT NOT NULL REFERENCES users(id),
  instructions TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','disputed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  recipient_role TEXT NOT NULL CHECK(recipient_role IN ('admin','client','editor')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

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

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_client_status ON projects(client_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_projects_status_deadline ON projects(status, preferred_deadline);
CREATE INDEX IF NOT EXISTS idx_offers_editor_status ON project_offers(editor_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_offers_project_status ON project_offers(project_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_editor_status ON assignments(editor_id, status);
CREATE INDEX IF NOT EXISTS idx_files_project_scope ON project_files(project_id, access_scope);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_deposit_ledger_editor_project ON deposit_ledger(editor_id, project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON work_submissions(assignment_id, version_number);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at);
