-- 0039: Align Legacy Global staging payment-country scope with the verified-country policy.
-- Apply ONLY to Legacy Global staging D1 (470a81b8-3d36-4e2d-942c-5cbb2746a473).
-- This replaces the older self-reported-country view with the evidence-backed view
-- already used by isolated staging. It changes no rows and keeps unverified scope excluded.
DROP VIEW IF EXISTS v_payment_country_scope;

CREATE VIEW v_payment_country_scope AS
SELECT
  pay.id AS payment_id,
  pay.user_id AS payment_user_id,
  pay.project_id,
  CASE
    WHEN (
      u.country_verified_at IS NOT NULL
      AND u.country_verified_by IS NOT NULL
      AND trim(COALESCE(u.country_evidence_ref,''))<>''
      AND pu.country_verified_at IS NOT NULL
      AND pu.country_verified_by IS NOT NULL
      AND trim(COALESCE(pu.country_evidence_ref,''))<>''
      AND u.country_code<>pu.country_code
    ) THEN NULL
    WHEN u.country_verified_at IS NOT NULL
      AND u.country_verified_by IS NOT NULL
      AND trim(COALESCE(u.country_evidence_ref,''))<>'' THEN u.country_code
    WHEN pu.country_verified_at IS NOT NULL
      AND pu.country_verified_by IS NOT NULL
      AND trim(COALESCE(pu.country_evidence_ref,''))<>'' THEN pu.country_code
    ELSE NULL
  END AS country_code,
  CASE
    WHEN (
      u.country_verified_at IS NOT NULL
      AND u.country_verified_by IS NOT NULL
      AND trim(COALESCE(u.country_evidence_ref,''))<>''
      AND pu.country_verified_at IS NOT NULL
      AND pu.country_verified_by IS NOT NULL
      AND trim(COALESCE(pu.country_evidence_ref,''))<>''
      AND u.country_code<>pu.country_code
    ) THEN 'country_conflict'
    WHEN (
      u.country_code IS NOT NULL
      AND (u.country_verified_at IS NULL OR u.country_verified_by IS NULL OR trim(COALESCE(u.country_evidence_ref,''))='')
    ) OR (
      pu.country_code IS NOT NULL
      AND (pu.country_verified_at IS NULL OR pu.country_verified_by IS NULL OR trim(COALESCE(pu.country_evidence_ref,''))='')
    ) THEN 'country_unverified'
    WHEN COALESCE(
      CASE WHEN u.country_verified_at IS NOT NULL AND u.country_verified_by IS NOT NULL AND trim(COALESCE(u.country_evidence_ref,''))<>'' THEN u.country_code END,
      CASE WHEN pu.country_verified_at IS NOT NULL AND pu.country_verified_by IS NOT NULL AND trim(COALESCE(pu.country_evidence_ref,''))<>'' THEN pu.country_code END
    ) IS NULL THEN 'country_unassigned'
    ELSE 'assigned'
  END AS country_scope_status,
  pay.status AS payment_status
FROM payments pay
LEFT JOIN users u ON u.id=pay.user_id
LEFT JOIN projects p ON p.id=pay.project_id
LEFT JOIN users pu ON pu.id=p.client_id;
