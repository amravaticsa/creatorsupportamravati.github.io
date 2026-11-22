-- Complete the isolated Regional API schema with tables used by the current API.
-- Safe to apply to canonical and isolated Staging databases; catalogue seed is idempotent.
CREATE TABLE IF NOT EXISTS regional_admin_permission_catalog (
  permission_key TEXT PRIMARY KEY CHECK(permission_key IN (
    'projects.manage','content.manage','finance.read','finance.refunds',
    'support.manage','clients.read','editors.manage','tenders.manage'
  )),
  module_key TEXT NOT NULL,
  description TEXT NOT NULL,
  default_access_level TEXT NOT NULL DEFAULT 'none',
  is_sensitive INTEGER NOT NULL DEFAULT 0 CHECK(is_sensitive IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS finance_bridge_audit_logs (
  id TEXT PRIMARY KEY,
  actor_source_admin_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO regional_admin_permission_catalog
(permission_key,module_key,description,default_access_level,is_sensitive)
VALUES
('clients.read','clients','View client accounts in the assigned country.','none',0),
('content.manage','content','Review latest submissions and approve, request changes or reject.','none',0),
('editors.manage','editors','Review editor profiles and update verification status.','none',0),
('finance.read','finance','View country-scoped payments and finance summaries.','none',1),
('finance.refunds','finance','View country refund requests; final review and provider processing remain with Finance Admin.','none',1),
('projects.manage','projects','Triage project status through validated country-scoped transitions.','none',0),
('support.manage','support','View country support messages; responses remain in the CSA Support workflow.','none',0),
('tenders.manage','tenders','Publish, close or cancel country tenders with deadline checks.','none',0);
