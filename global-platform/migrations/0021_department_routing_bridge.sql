-- CSA Global department routing bridge.
-- Mirrors the existing Super Admin department IDs; does not create departments there.
CREATE TABLE IF NOT EXISTS global_departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  source_system TEXT NOT NULL DEFAULT 'csa_superadmin',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO global_departments(id,name) VALUES
 ('dept-content-video','Content & Video Production'),
 ('dept-design-creative','Design & Creative'),
 ('dept-digital-marketing','Digital Marketing'),
 ('dept-finance-accounts','Finance & Accounts'),
 ('dept-hr-admin','HR & Administration'),
 ('dept-operations-events','Operations & Events'),
 ('dept-sales-client','Sales & Client Success'),
 ('dept-web-tech','Web & Technology');

ALTER TABLE projects ADD COLUMN department_id TEXT REFERENCES global_departments(id);
ALTER TABLE editor_profiles ADD COLUMN department_id TEXT REFERENCES global_departments(id);

-- Existing applications are preserved and routed into the existing Video Production department.
UPDATE projects SET department_id='dept-content-video' WHERE department_id IS NULL;
UPDATE editor_profiles SET department_id='dept-hr-admin' WHERE department_id IS NULL;

CREATE TABLE IF NOT EXISTS global_admin_department_access (
  id TEXT PRIMARY KEY,
  source_admin_id TEXT NOT NULL,
  department_id TEXT NOT NULL REFERENCES global_departments(id),
  access_level TEXT NOT NULL DEFAULT 'manage' CHECK(access_level IN ('read','manage')),
  granted_by TEXT NOT NULL DEFAULT 'system_role_mapping',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(source_admin_id,department_id)
);

CREATE INDEX IF NOT EXISTS idx_projects_department_status
 ON projects(department_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_editor_profiles_department_status
 ON editor_profiles(department_id,verification_status);
CREATE INDEX IF NOT EXISTS idx_admin_department_access_source
 ON global_admin_department_access(source_admin_id,department_id);

-- Default least-privilege department mapping from existing Super Admin roles.
INSERT OR IGNORE INTO global_admin_department_access(id,source_admin_id,department_id,access_level)
SELECT 'deptaccess_' || lower(hex(randomblob(12))), source_admin_id,
 CASE source_role
  WHEN 'editor_admin' THEN 'dept-content-video'
  WHEN 'project_admin' THEN 'dept-operations-events'
  WHEN 'finance_admin' THEN 'dept-finance-accounts'
  WHEN 'support_admin' THEN 'dept-sales-client'
 END,
 'manage'
FROM global_admin_authorizations
WHERE status='active'
 AND source_role IN ('editor_admin','project_admin','finance_admin','support_admin');

-- New client applications and editor profiles receive a department automatically.
CREATE TRIGGER IF NOT EXISTS trg_projects_default_department
AFTER INSERT ON projects
WHEN NEW.department_id IS NULL
BEGIN
  UPDATE projects SET department_id='dept-content-video' WHERE id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_editor_profiles_default_department
AFTER INSERT ON editor_profiles
WHEN NEW.department_id IS NULL
BEGIN
  UPDATE editor_profiles SET department_id='dept-hr-admin' WHERE user_id=NEW.user_id;
END;
