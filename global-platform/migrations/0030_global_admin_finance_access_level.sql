-- Add the per-admin Finance access scope consumed by Global API RBAC.
-- Existing staging D1 databases already have this column; apply only where absent.
ALTER TABLE global_admin_authorizations
  ADD COLUMN finance_access_level TEXT NOT NULL DEFAULT 'none'
  CHECK(finance_access_level IN ('none','read','write','manage'));
