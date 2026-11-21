-- CSA Super Admin production schema bootstrap
-- Generated from csa-superadmin-staging D1 schema on 2026-11-21.
-- SCHEMA ONLY: no rows, passwords, tokens, sessions, or personal data copied.
-- REVIEW REQUIRED before applying to a production database.
-- Confirm schema version against deployed Worker code and test in a disposable D1 first.
-- Source database UUID: 99bc81fc-e97e-488b-a380-eb0237ff8ffc
-- Extracted objects: 75

-- table: admin_accounts
CREATE TABLE admin_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','project_admin','editor_admin','finance_admin','support_admin')),
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','deactivated')),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0,1)),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT, phone_number TEXT, phone_verified INTEGER NOT NULL DEFAULT 0 CHECK (phone_verified IN (0,1)), sms_login_enabled INTEGER NOT NULL DEFAULT 0 CHECK (sms_login_enabled IN (0,1)),
  FOREIGN KEY (created_by) REFERENCES admin_accounts(id)
);

-- table: admin_audit_logs
CREATE TABLE admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_admin_id TEXT,
  action TEXT NOT NULL,
  target_admin_id TEXT,
  metadata_json TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (actor_admin_id) REFERENCES admin_accounts(id),
  FOREIGN KEY (target_admin_id) REFERENCES admin_accounts(id)
);

-- table: admin_enrollment_tokens
CREATE TABLE admin_enrollment_tokens (id TEXT PRIMARY KEY, admin_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL CHECK (purpose IN ('super_admin_enrollment','admin_invitation','password_reset')), expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE);

-- table: admin_login_attempts
CREATE TABLE admin_login_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  ip_hash TEXT,
  success INTEGER NOT NULL DEFAULT 0 CHECK (success IN (0,1)),
  attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- table: admin_otp_challenges
CREATE TABLE admin_otp_challenges (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','enrollment','password_reset')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE
);

-- table: admin_permissions
CREATE TABLE admin_permissions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  granted_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(admin_id,permission_key),
  FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES admin_accounts(id)
);

-- table: admin_sessions
CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  session_token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE
);

-- table: csa_activity_events
CREATE TABLE csa_activity_events (
   id TEXT PRIMARY KEY,
   actor_admin_id TEXT,
   module_key TEXT NOT NULL,
   action TEXT NOT NULL,
   entity_type TEXT,
   entity_id TEXT,
   summary TEXT,
   metadata_json TEXT,
   source_table TEXT,
   source_record_id TEXT,
   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   FOREIGN KEY(actor_admin_id) REFERENCES admin_accounts(id),
   FOREIGN KEY(module_key) REFERENCES csa_module_registry(module_key)
 );

-- table: csa_admin_module_access
CREATE TABLE csa_admin_module_access (
   id TEXT PRIMARY KEY,
   admin_id TEXT NOT NULL,
   module_key TEXT NOT NULL,
   access_level TEXT NOT NULL DEFAULT 'read' CHECK(access_level IN ('none','read','write','manage')),
   granted_by TEXT NOT NULL,
   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   UNIQUE(admin_id,module_key),
   FOREIGN KEY(admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE,
   FOREIGN KEY(module_key) REFERENCES csa_module_registry(module_key) ON DELETE CASCADE,
   FOREIGN KEY(granted_by) REFERENCES admin_accounts(id)
 );

-- table: csa_attendance
CREATE TABLE csa_attendance (
 id TEXT PRIMARY KEY,
 employee_id TEXT NOT NULL,
 work_date TEXT NOT NULL,
 check_in_at TEXT,
 check_out_at TEXT,
 status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','late','half_day','absent','leave','holiday')),
 late_minutes INTEGER NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
 check_in_note TEXT,
 check_out_note TEXT,
 captured_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(employee_id,work_date),
 FOREIGN KEY (employee_id) REFERENCES csa_employees(id) ON DELETE CASCADE,
 FOREIGN KEY (captured_by) REFERENCES admin_accounts(id)
);

-- table: csa_attendance_punches
CREATE TABLE csa_attendance_punches (
 id TEXT PRIMARY KEY,
 employee_id TEXT NOT NULL,
 work_date TEXT NOT NULL,
 punch_type TEXT NOT NULL CHECK(punch_type IN ('check_in','check_out')),
 work_mode TEXT NOT NULL CHECK(work_mode IN ('office','field')),
 latitude REAL NOT NULL,
 longitude REAL NOT NULL,
 accuracy_m REAL NOT NULL,
 distance_from_office_m REAL NOT NULL,
 selfie_object_key TEXT NOT NULL,
 review_status TEXT NOT NULL DEFAULT 'approved' CHECK(review_status IN ('pending','approved','rejected')),
 reviewed_by TEXT,
 reviewed_at TEXT,
 review_note TEXT,
 captured_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(employee_id) REFERENCES csa_employees(id) ON DELETE CASCADE,
 FOREIGN KEY(reviewed_by) REFERENCES admin_accounts(id)
);

-- table: csa_clients
CREATE TABLE csa_clients (id TEXT PRIMARY KEY, client_code TEXT UNIQUE, name TEXT NOT NULL, company TEXT, email TEXT, phone TEXT, source TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('lead','active','inactive','archived')), created_by TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), lead_stage TEXT NOT NULL DEFAULT 'new', next_follow_up TEXT, estimated_value_paise INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(created_by) REFERENCES admin_accounts(id));

-- table: csa_department_modules
CREATE TABLE csa_department_modules (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL,
  module_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(department_id,module_key),
  FOREIGN KEY(department_id) REFERENCES csa_departments(id) ON DELETE CASCADE,
  FOREIGN KEY(module_key) REFERENCES csa_module_registry(module_key) ON DELETE CASCADE
 );

-- table: csa_departments
CREATE TABLE csa_departments (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

-- table: csa_employee_auth
CREATE TABLE csa_employee_auth (employee_id TEXT PRIMARY KEY,password_hash TEXT NOT NULL,must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN (0,1)),failed_attempts INTEGER NOT NULL DEFAULT 0,locked_until TEXT,last_login_at TEXT,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),FOREIGN KEY(employee_id) REFERENCES csa_employees(id) ON DELETE CASCADE);

-- table: csa_employee_events
CREATE TABLE csa_employee_events (
 id TEXT PRIMARY KEY,
 employee_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK (event_type IN ('joined','department_changed','designation_changed','status_changed','exited')),
 event_date TEXT NOT NULL,
 details TEXT,
 recorded_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY (employee_id) REFERENCES csa_employees(id) ON DELETE CASCADE,
 FOREIGN KEY (recorded_by) REFERENCES admin_accounts(id)
);

-- table: csa_employee_login_attempts
CREATE TABLE csa_employee_login_attempts (id TEXT PRIMARY KEY,employee_code TEXT NOT NULL,ip_hash TEXT NOT NULL,success INTEGER NOT NULL DEFAULT 0,attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

-- table: csa_employee_recovery_challenges
CREATE TABLE csa_employee_recovery_challenges (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, email_hash TEXT NOT NULL, otp_hash TEXT NOT NULL, ip_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY(employee_id) REFERENCES csa_employees(id) ON DELETE CASCADE);

-- table: csa_employee_sessions
CREATE TABLE csa_employee_sessions (id TEXT PRIMARY KEY,employee_id TEXT NOT NULL,session_token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),revoked_at TEXT,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),FOREIGN KEY(employee_id) REFERENCES csa_employees(id) ON DELETE CASCADE);

-- table: csa_employee_work_media
CREATE TABLE csa_employee_work_media (id TEXT PRIMARY KEY, update_id TEXT NOT NULL, employee_id TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, media_type TEXT NOT NULL CHECK(media_type IN ('image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime')), file_name TEXT NOT NULL, file_size INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY(update_id) REFERENCES csa_employee_work_updates(id) ON DELETE CASCADE, FOREIGN KEY(employee_id) REFERENCES csa_employees(id) ON DELETE CASCADE);

-- table: csa_employee_work_updates
CREATE TABLE csa_employee_work_updates (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, task_id TEXT, title TEXT NOT NULL, update_text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('pending','in_progress','completed','blocked')), minutes_spent INTEGER NOT NULL DEFAULT 0, review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','changes_requested')), review_note TEXT, reviewed_by TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY(employee_id) REFERENCES csa_employees(id) ON DELETE CASCADE, FOREIGN KEY(task_id) REFERENCES csa_tasks(id), FOREIGN KEY(reviewed_by) REFERENCES admin_accounts(id));

-- table: csa_employees
CREATE TABLE csa_employees (
 id TEXT PRIMARY KEY,
 employee_code TEXT NOT NULL UNIQUE,
 full_name TEXT NOT NULL,
 phone TEXT,
 email TEXT,
 designation TEXT,
 department_id TEXT,
 employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','intern','freelance')),
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','exited')),
 joined_on TEXT NOT NULL,
 exited_on TEXT,
 linked_admin_id TEXT,
 emergency_contact TEXT,
 notes TEXT,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY (department_id) REFERENCES csa_departments(id),
 FOREIGN KEY (linked_admin_id) REFERENCES admin_accounts(id),
 FOREIGN KEY (created_by) REFERENCES admin_accounts(id)
);

-- table: csa_expenses
CREATE TABLE csa_expenses (id TEXT PRIMARY KEY, category TEXT NOT NULL, description TEXT, amount_paise INTEGER NOT NULL CHECK(amount_paise>=0), expense_date TEXT NOT NULL, vendor TEXT, reference TEXT, recorded_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY(recorded_by) REFERENCES admin_accounts(id));

-- table: csa_invoices
CREATE TABLE csa_invoices (id TEXT PRIMARY KEY, invoice_no TEXT NOT NULL UNIQUE, client_id TEXT NOT NULL, project_id TEXT, amount_paise INTEGER NOT NULL CHECK(amount_paise>=0), tax_paise INTEGER NOT NULL DEFAULT 0 CHECK(tax_paise>=0), status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','partially_paid','paid','overdue','cancelled')), issue_date TEXT, due_date TEXT, notes TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY(client_id) REFERENCES csa_clients(id), FOREIGN KEY(project_id) REFERENCES csa_projects(id), FOREIGN KEY(created_by) REFERENCES admin_accounts(id));

-- table: csa_lead_followups
CREATE TABLE csa_lead_followups (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, followup_at TEXT NOT NULL, outcome TEXT, notes TEXT, next_follow_up TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY(client_id) REFERENCES csa_clients(id));

-- table: csa_leave_requests
CREATE TABLE csa_leave_requests (
 id TEXT PRIMARY KEY,
 employee_id TEXT NOT NULL,
 leave_type TEXT NOT NULL DEFAULT 'casual' CHECK (leave_type IN ('casual','sick','earned','unpaid','other')),
 start_date TEXT NOT NULL,
 end_date TEXT NOT NULL,
 reason TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
 reviewed_by TEXT,
 reviewed_at TEXT,
 review_note TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY (employee_id) REFERENCES csa_employees(id) ON DELETE CASCADE,
 FOREIGN KEY (reviewed_by) REFERENCES admin_accounts(id)
);

-- table: csa_module_registry
CREATE TABLE csa_module_registry (
   module_key TEXT PRIMARY KEY,
   module_name TEXT NOT NULL UNIQUE,
   description TEXT,
   route_path TEXT NOT NULL,
   status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('active','planned','maintenance','disabled')),
   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 );

-- table: csa_payments
CREATE TABLE csa_payments (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, amount_paise INTEGER NOT NULL CHECK(amount_paise>0), method TEXT, reference TEXT, paid_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), recorded_by TEXT NOT NULL, notes TEXT, FOREIGN KEY(invoice_id) REFERENCES csa_invoices(id), FOREIGN KEY(recorded_by) REFERENCES admin_accounts(id));

-- table: csa_permission_catalog
CREATE TABLE csa_permission_catalog (
   permission_key TEXT PRIMARY KEY,
   module_key TEXT NOT NULL,
   description TEXT NOT NULL,
   risk_level TEXT NOT NULL DEFAULT 'standard' CHECK(risk_level IN ('standard','sensitive','critical')),
   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   FOREIGN KEY(module_key) REFERENCES csa_module_registry(module_key) ON DELETE CASCADE
 );

-- table: csa_projects
CREATE TABLE csa_projects (id TEXT PRIMARY KEY, project_code TEXT UNIQUE, title TEXT NOT NULL, client_id TEXT, department_id TEXT, owner_admin_id TEXT, description TEXT, status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','on_hold','review','completed','cancelled')), priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')), start_date TEXT, due_date TEXT, budget_paise INTEGER NOT NULL DEFAULT 0 CHECK(budget_paise>=0), created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY(client_id) REFERENCES csa_clients(id), FOREIGN KEY(department_id) REFERENCES csa_departments(id), FOREIGN KEY(owner_admin_id) REFERENCES admin_accounts(id), FOREIGN KEY(created_by) REFERENCES admin_accounts(id));

-- table: csa_task_activity
CREATE TABLE csa_task_activity (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, actor_admin_id TEXT, action TEXT NOT NULL, note TEXT, old_status TEXT, new_status TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY(task_id) REFERENCES csa_tasks(id) ON DELETE CASCADE, FOREIGN KEY(actor_admin_id) REFERENCES admin_accounts(id));

-- table: csa_tasks
CREATE TABLE csa_tasks (id TEXT PRIMARY KEY, task_code TEXT UNIQUE, title TEXT NOT NULL, details TEXT, project_id TEXT, client_id TEXT, department_id TEXT, assigned_to TEXT, assigned_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','blocked','review','completed','cancelled')), priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')), due_at TEXT, completed_at TEXT, estimated_minutes INTEGER, actual_minutes INTEGER, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY(project_id) REFERENCES csa_projects(id), FOREIGN KEY(client_id) REFERENCES csa_clients(id), FOREIGN KEY(department_id) REFERENCES csa_departments(id), FOREIGN KEY(assigned_to) REFERENCES admin_accounts(id), FOREIGN KEY(assigned_by) REFERENCES admin_accounts(id));

-- table: global_admin_sync_logs
CREATE TABLE global_admin_sync_logs (id TEXT PRIMARY KEY, trigger_type TEXT NOT NULL CHECK(trigger_type IN ('scheduled','manual','lifecycle')), outcome TEXT NOT NULL CHECK(outcome IN ('success','failed')), synced_count INTEGER NOT NULL DEFAULT 0, error_code TEXT, actor_admin_id TEXT, started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), finished_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY(actor_admin_id) REFERENCES admin_accounts(id));

-- index: idx_admin_accounts_phone_number
CREATE UNIQUE INDEX idx_admin_accounts_phone_number ON admin_accounts(phone_number) WHERE phone_number IS NOT NULL AND phone_number <> '';

-- index: idx_admin_audit_created
CREATE INDEX idx_admin_audit_created ON admin_audit_logs(created_at);

-- index: idx_admin_enrollment_admin
CREATE INDEX idx_admin_enrollment_admin ON admin_enrollment_tokens(admin_id,purpose,created_at);

-- index: idx_admin_login_attempts_user_time
CREATE INDEX idx_admin_login_attempts_user_time ON admin_login_attempts(user_id,attempted_at);

-- index: idx_admin_otp_admin
CREATE INDEX idx_admin_otp_admin ON admin_otp_challenges(admin_id,purpose,created_at);

-- index: idx_admin_sessions_admin
CREATE INDEX idx_admin_sessions_admin ON admin_sessions(admin_id);

-- index: idx_csa_access_admin
CREATE INDEX idx_csa_access_admin ON csa_admin_module_access(admin_id,module_key);

-- index: idx_csa_activity_created
CREATE INDEX idx_csa_activity_created ON csa_activity_events(created_at DESC);

-- index: idx_csa_activity_module
CREATE INDEX idx_csa_activity_module ON csa_activity_events(module_key,created_at DESC);

-- index: idx_csa_attendance_date
CREATE INDEX idx_csa_attendance_date ON csa_attendance(work_date,status);

-- index: idx_csa_attendance_punch_employee
CREATE INDEX idx_csa_attendance_punch_employee ON csa_attendance_punches(employee_id,work_date);

-- index: idx_csa_attendance_punch_review
CREATE INDEX idx_csa_attendance_punch_review ON csa_attendance_punches(review_status,work_date,created_at);

-- index: idx_csa_employee_events_employee
CREATE INDEX idx_csa_employee_events_employee ON csa_employee_events(employee_id,event_date DESC);

-- index: idx_csa_employee_login_attempts_ip
CREATE INDEX idx_csa_employee_login_attempts_ip ON csa_employee_login_attempts(ip_hash,attempted_at);

-- index: idx_csa_employee_login_attempts_recent
CREATE INDEX idx_csa_employee_login_attempts_recent ON csa_employee_login_attempts(employee_code,attempted_at);

-- index: idx_csa_employee_recovery_email
CREATE INDEX idx_csa_employee_recovery_email ON csa_employee_recovery_challenges(email_hash,created_at);

-- index: idx_csa_employee_recovery_ip
CREATE INDEX idx_csa_employee_recovery_ip ON csa_employee_recovery_challenges(ip_hash,created_at);

-- index: idx_csa_employee_sessions_employee
CREATE INDEX idx_csa_employee_sessions_employee ON csa_employee_sessions(employee_id);

-- index: idx_csa_employee_sessions_hash
CREATE INDEX idx_csa_employee_sessions_hash ON csa_employee_sessions(session_token_hash);

-- index: idx_csa_employees_department_status
CREATE INDEX idx_csa_employees_department_status ON csa_employees(department_id,status);

-- index: idx_csa_employees_joined
CREATE INDEX idx_csa_employees_joined ON csa_employees(joined_on);

-- index: idx_csa_expenses_date
CREATE INDEX idx_csa_expenses_date ON csa_expenses(expense_date);

-- index: idx_csa_invoices_status_due
CREATE INDEX idx_csa_invoices_status_due ON csa_invoices(status,due_date);

-- index: idx_csa_lead_followups_client
CREATE INDEX idx_csa_lead_followups_client ON csa_lead_followups(client_id, created_at DESC);

-- index: idx_csa_leave_status_dates
CREATE INDEX idx_csa_leave_status_dates ON csa_leave_requests(status,start_date,end_date);

-- index: idx_csa_payments_paid_at
CREATE INDEX idx_csa_payments_paid_at ON csa_payments(paid_at);

-- index: idx_csa_projects_status
CREATE INDEX idx_csa_projects_status ON csa_projects(status);

-- index: idx_csa_task_activity_task
CREATE INDEX idx_csa_task_activity_task ON csa_task_activity(task_id,created_at);

-- index: idx_csa_tasks_assigned_status
CREATE INDEX idx_csa_tasks_assigned_status ON csa_tasks(assigned_to,status);

-- index: idx_csa_tasks_due
CREATE INDEX idx_csa_tasks_due ON csa_tasks(due_at);

-- index: idx_csa_tasks_project
CREATE INDEX idx_csa_tasks_project ON csa_tasks(project_id);

-- index: idx_csa_work_media_update
CREATE INDEX idx_csa_work_media_update ON csa_employee_work_media(update_id);

-- index: idx_csa_work_updates_employee_date
CREATE INDEX idx_csa_work_updates_employee_date ON csa_employee_work_updates(employee_id,created_at DESC);

-- index: idx_csa_work_updates_review
CREATE INDEX idx_csa_work_updates_review ON csa_employee_work_updates(review_status,created_at DESC);

-- index: idx_global_admin_sync_logs_started
CREATE INDEX idx_global_admin_sync_logs_started ON global_admin_sync_logs(started_at DESC);

-- index: one_super_admin_only
CREATE UNIQUE INDEX one_super_admin_only ON admin_accounts(role) WHERE role = 'super_admin';

-- trigger: trg_csa_admin_default_access
CREATE TRIGGER trg_csa_admin_default_access AFTER INSERT ON admin_accounts
 BEGIN
 INSERT OR IGNORE INTO csa_admin_module_access(id,admin_id,module_key,access_level,granted_by)
 SELECT lower(hex(randomblob(16))),NEW.id,m.module_key,
 CASE WHEN NEW.role='super_admin' THEN 'manage'
 WHEN NEW.role='project_admin' AND m.module_key='projects' THEN 'manage'
 WHEN NEW.role='project_admin' AND m.module_key IN ('overview','clients') THEN 'read'
 WHEN NEW.role='editor_admin' AND m.module_key='content' THEN 'manage'
 WHEN NEW.role='editor_admin' AND m.module_key IN ('overview','projects') THEN 'read'
 WHEN NEW.role='finance_admin' AND m.module_key='finance' THEN 'manage'
 WHEN NEW.role='finance_admin' AND m.module_key IN ('overview','analytics') THEN 'read'
 WHEN NEW.role='support_admin' AND m.module_key='clients' THEN 'manage'
 WHEN NEW.role='support_admin' AND m.module_key='overview' THEN 'read'
 ELSE 'none' END,
 COALESCE(NEW.created_by,(SELECT id FROM admin_acco --- TRUNCATED --- 28,017 chars
