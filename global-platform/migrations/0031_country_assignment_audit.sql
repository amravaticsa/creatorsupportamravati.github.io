-- Enforce audited, immutable country assignment in the canonical Global D1.
-- User-provided profile country remains self-reported; users.country_code is verified only by Super Admin.
ALTER TABLE users ADD COLUMN country_verified_at TEXT;
ALTER TABLE users ADD COLUMN country_verified_by TEXT;
ALTER TABLE users ADD COLUMN country_evidence_ref TEXT;

CREATE TABLE country_user_assignment_audit (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  country_code TEXT NOT NULL,
  actor_admin_id TEXT NOT NULL,
  evidence_reference TEXT NOT NULL,
  verification_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_country_user_assignment_audit_once
  ON country_user_assignment_audit(user_id);
CREATE INDEX idx_country_user_assignment_audit_user
  ON country_user_assignment_audit(user_id,created_at);

CREATE TRIGGER trg_country_user_assignment_audit_insert_guard
BEFORE INSERT ON country_user_assignment_audit
WHEN length(NEW.country_code)<>2
  OR NEW.country_code<>upper(NEW.country_code)
  OR NEW.country_code GLOB '*[^A-Z]*'
  OR length(trim(NEW.actor_admin_id))<3
  OR length(trim(NEW.evidence_reference))<3
  OR length(NEW.evidence_reference)>1000
  OR length(COALESCE(NEW.verification_note,''))>2000
  OR NOT EXISTS(
    SELECT 1 FROM users
    WHERE id=NEW.user_id AND country_code IS NULL AND country_verified_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT,'country_assignment_audit_requires_unassigned_user_and_valid_evidence');
END;

CREATE TRIGGER trg_country_user_assignment_audit_no_delete
BEFORE DELETE ON country_user_assignment_audit
BEGIN
  SELECT RAISE(ABORT,'country_assignment_audit_is_immutable');
END;

CREATE TRIGGER trg_country_user_assignment_audit_no_update
BEFORE UPDATE ON country_user_assignment_audit
BEGIN
  SELECT RAISE(ABORT,'country_assignment_audit_is_immutable');
END;

CREATE TRIGGER trg_users_country_assignment_audit_required
BEFORE UPDATE OF country_code ON users
WHEN OLD.country_code IS NULL
  AND NEW.country_code IS NOT NULL
  AND NOT EXISTS(
    SELECT 1 FROM country_user_assignment_audit
    WHERE user_id=NEW.id
      AND country_code=NEW.country_code
      AND actor_admin_id=NEW.country_verified_by
      AND evidence_reference=NEW.country_evidence_ref
  )
BEGIN
  SELECT RAISE(ABORT,'country_assignment_requires_immutable_audit_record');
END;

CREATE TRIGGER trg_users_country_verify_insert
BEFORE INSERT ON users
WHEN NEW.country_code IS NOT NULL
  OR NEW.country_verified_at IS NOT NULL
  OR NEW.country_verified_by IS NOT NULL
  OR NEW.country_evidence_ref IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'new_accounts_require_post_creation_superadmin_country_assignment');
END;

CREATE TRIGGER trg_users_country_verify_update
BEFORE UPDATE OF country_code,country_verified_at,country_verified_by,country_evidence_ref ON users
WHEN (
  NEW.country_code IS NOT NULL
  AND (
    length(NEW.country_code)<>2
    OR NEW.country_code<>upper(NEW.country_code)
    OR NEW.country_code GLOB '*[^A-Z]*'
    OR NEW.country_verified_at IS NULL
    OR NEW.country_verified_by IS NULL
    OR trim(COALESCE(NEW.country_evidence_ref,''))=''
  )
)
OR (
  NEW.country_code IS NULL
  AND (
    NEW.country_verified_at IS NOT NULL
    OR NEW.country_verified_by IS NOT NULL
    OR NEW.country_evidence_ref IS NOT NULL
  )
)
OR (
  OLD.country_code IS NOT NULL
  AND (
    NEW.country_code IS NOT OLD.country_code
    OR NEW.country_verified_at IS NOT OLD.country_verified_at
    OR NEW.country_verified_by IS NOT OLD.country_verified_by
    OR NEW.country_evidence_ref IS NOT OLD.country_evidence_ref
  )
)
BEGIN
  SELECT RAISE(ABORT,'verified_country_assignment_is_immutable');
END;

DROP VIEW IF EXISTS v_country_assignment_review;
CREATE VIEW v_country_assignment_review AS
SELECT
  u.id AS user_id,
  u.role AS account_role,
  u.account_status,
  u.email,
  u.email_verified_at,
  u.created_at,
  COALESCE(cp.display_name,ep.display_name) AS display_name,
  u.country_code AS verified_country_code,
  u.country_verified_at,
  u.country_verified_by,
  u.country_evidence_ref,
  COALESCE(cp.country,ep.country) AS profile_country_text,
  CASE
    WHEN u.country_code IS NULL OR trim(u.country_code)='' THEN 'needs_verified_country'
    WHEN u.country_verified_at IS NULL OR u.country_verified_by IS NULL OR trim(COALESCE(u.country_evidence_ref,''))='' THEN 'country_unverified'
    WHEN length(trim(u.country_code))<>2 OR u.country_code<>upper(u.country_code) THEN 'invalid_country_code'
    ELSE 'assigned'
  END AS assignment_status,
  ep.verification_status AS editor_verification_status,
  (
    SELECT k.status
    FROM editor_kyc_documents k
    WHERE k.editor_id=u.id
    ORDER BY k.created_at DESC
    LIMIT 1
  ) AS editor_kyc_status
FROM users u
LEFT JOIN client_profiles cp ON cp.user_id=u.id
LEFT JOIN editor_profiles ep ON ep.user_id=u.id
WHERE u.role IN ('client','editor');
