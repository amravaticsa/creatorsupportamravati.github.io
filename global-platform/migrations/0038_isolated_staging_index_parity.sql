-- 0038: Non-destructive index parity for the isolated Global staging D1.
-- Apply ONLY to csa-global-platform-isolated-staging (6a32dda3-b8c5-413c-9f51-58f0a9fa0712).
-- These indexes already exist in legacy staging. No rows are modified.
CREATE INDEX IF NOT EXISTS idx_finance_bridge_audit_actor_created
  ON finance_bridge_audit_logs(actor_source_admin_id,created_at);
CREATE INDEX IF NOT EXISTS idx_finance_bridge_audit_created
  ON finance_bridge_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_balance_reminder_dedupe
  ON notifications(user_id,template_key,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_regional_admin_permissions_key
  ON regional_admin_permissions(permission_key);
