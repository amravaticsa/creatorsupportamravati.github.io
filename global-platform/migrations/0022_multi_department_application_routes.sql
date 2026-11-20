-- Multi-department routing for one central CSA Global application record.
CREATE TABLE IF NOT EXISTS project_department_routes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES global_departments(id),
  route_key TEXT NOT NULL CHECK(route_key IN ('intake','tender','finance')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','active','completed','blocked')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(project_id,route_key)
);
CREATE INDEX IF NOT EXISTS idx_project_department_routes_department
 ON project_department_routes(department_id,status,created_at);

-- Existing applications stay in the same projects table and receive linked department work queues.
INSERT OR IGNORE INTO project_department_routes(id,project_id,department_id,route_key)
SELECT 'route_intake_' || id,id,'dept-content-video','intake' FROM projects;
INSERT OR IGNORE INTO project_department_routes(id,project_id,department_id,route_key)
SELECT 'route_tender_' || id,id,'dept-operations-events','tender' FROM projects;
INSERT OR IGNORE INTO project_department_routes(id,project_id,department_id,route_key)
SELECT 'route_finance_' || id,id,'dept-finance-accounts','finance' FROM projects;

CREATE TRIGGER IF NOT EXISTS trg_project_create_department_routes
AFTER INSERT ON projects
BEGIN
 INSERT OR IGNORE INTO project_department_routes(id,project_id,department_id,route_key)
 VALUES('route_intake_' || NEW.id,NEW.id,'dept-content-video','intake');
 INSERT OR IGNORE INTO project_department_routes(id,project_id,department_id,route_key)
 VALUES('route_tender_' || NEW.id,NEW.id,'dept-operations-events','tender');
 INSERT OR IGNORE INTO project_department_routes(id,project_id,department_id,route_key)
 VALUES('route_finance_' || NEW.id,NEW.id,'dept-finance-accounts','finance');
END;

-- Editor Admin is responsible for editor onboarding and KYC, so it receives only the HR/editor-verification queue in addition to its content queue.
INSERT OR IGNORE INTO global_admin_department_access(id,source_admin_id,department_id,access_level,granted_by)
SELECT 'deptaccess_hr_' || lower(hex(randomblob(8))),source_admin_id,'dept-hr-admin','manage','editor_admin_role_mapping'
FROM global_admin_authorizations WHERE source_role='editor_admin' AND status='active';
