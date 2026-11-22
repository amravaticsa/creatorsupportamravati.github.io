-- Make Regional Admin project scope depend on evidence-backed country verification.
-- This intentionally mirrors the stronger isolated-staging view and protects legacy rows.
DROP VIEW IF EXISTS v_project_country_scope;

CREATE VIEW v_project_country_scope AS
SELECT
  p.id AS project_id,
  p.client_id AS client_user_id,
  CASE
    WHEN u.country_code IS NOT NULL
      AND u.country_verified_at IS NOT NULL
      AND u.country_verified_by IS NOT NULL
      AND trim(COALESCE(u.country_evidence_ref,''))<>''
      AND length(trim(u.country_code))=2
      AND u.country_code=upper(u.country_code)
    THEN u.country_code
    ELSE NULL
  END AS country_code,
  CASE
    WHEN u.country_code IS NULL OR trim(u.country_code)='' THEN 'country_unassigned'
    WHEN u.country_verified_at IS NULL
      OR u.country_verified_by IS NULL
      OR trim(COALESCE(u.country_evidence_ref,''))=''
    THEN 'country_unverified'
    WHEN length(trim(u.country_code))<>2 OR u.country_code<>upper(u.country_code)
    THEN 'country_code_invalid'
    ELSE 'assigned'
  END AS country_scope_status,
  p.status AS project_status,
  p.department_id
FROM projects p
LEFT JOIN users u ON u.id=p.client_id;
