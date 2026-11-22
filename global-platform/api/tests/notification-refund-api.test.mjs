import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("notification API is authenticated and scoped to the signed-in user", () => {
  assert.match(source, /if\(m==="GET"&&p==="\/v1\/notifications"\)\{\s*const a=await user\(req,env,\["client","admin","editor"\]\)/);
  assert.match(source, /WHERE user_id=\? AND channel='in_app'/);
  assert.match(source, /UPDATE notifications SET status='read' WHERE id=\? AND user_id=\?/);
});

test("notification preferences persist all channels and keep WhatsApp opt-in explicit", () => {
  assert.match(source, /INSERT OR IGNORE INTO notification_preferences\(user_id\)/);
  assert.match(source, /whatsapp_enabled/);
  assert.match(source, /All notification preference values must be true or false/);
  assert.match(source, /whatsapp_opt_in/);
  assert.match(source, /Email\/WhatsApp are preference-only until providers are configured/);
});

test("admin notification sending is support-permission gated and in-app only", () => {
  assert.match(source, /p==="\/v1\/admin\/notifications"\)return "support\.manage"/);
  assert.match(source, /INSERT INTO notifications\(id,user_id,channel,template_key,payload_json,status,sent_at\) VALUES\(\?,\?,'in_app'/);
  assert.match(source, /\["client","editor"\]\.includes\(target\.role\)/);
});

test("client refunds require own successful client payments and an idempotency key", () => {
  assert.match(source, /p==="\/v1\/client\/refunds"\)\{\s*const a=await user\(req,env,\["client"\]\)/);
  assert.match(source, /FROM payments WHERE id=\? AND user_id=\?/);
  assert.match(source, /\["client_advance","client_balance"\]\.includes\(payment\.payment_type\)/);
  assert.match(source, /Idempotency-Key/);
  assert.match(source, /refund_amount_exceeded/);
  assert.match(source, /INSERT INTO client_refund_requests/);
});

test("finance queue and review actions are separate least-privilege routes", () => {
  assert.match(source, /p==="\/v1\/admin\/client-refunds"\)return "finance\.read"/);
  assert.ok(source.includes('return "finance.refunds";'));
  assert.match(source, /provider_refund_started:false/);
  assert.match(source, /A rejection reason is required/);
});

test("refund review uses compare-and-set and only audits a successful status transition", () => {
  assert.match(source, /const updated=await env\.DB\.prepare\("UPDATE client_refund_requests SET status=.*WHERE id=\? AND status IN \('requested','under_review'\)"\)/);
  assert.match(source, /if\(!updated\.meta\?\.changes\)return bad\("This refund request was updated by another reviewer\. Refresh the queue and try again\.",409,"refund_review_conflict"\)/);
  assert.ok(source.indexOf("if(!updated.meta?.changes)") < source.indexOf('await log(env,a.id,"client_refund_"+next'));
});

test("health endpoint checks canonical and legacy storage dependencies without writes", () => {
  const start = source.indexOf('if(m==="GET"&&p==="/health"){');
  const end = source.indexOf('if(m==="GET"&&p==="/v1/config")', start);
  assert.ok(start >= 0 && end > start);
  const health = source.slice(start, end);
  for (const table of ["users","client_profiles","projects","project_files","payments","editor_profiles","editor_portfolio_videos","editor_kyc_documents","project_tenders","csa_pricing_policies","notifications","notification_preferences","client_refund_requests","countries","country_legal_reviews","regional_admins","regional_admin_permissions","regional_admin_permission_catalog","regional_admin_audit_logs","editor_payouts"]) {
    assert.ok(health.includes('"'+table+'"'), "missing required table "+table);
  }
  for (const table of ["video_editing_orders","video_editing_files","video_editing_status_history"]) {
    assert.ok(health.includes('"'+table+'"'), "missing legacy video table "+table);
  }
  assert.ok(health.includes("d1_connected:d1"));
  assert.ok(health.includes("schema_ready:schemaReady"));
  assert.ok(health.includes("missing_tables:missingTables"));
  assert.ok(health.includes("legacy_video_db_connected:legacyDb"));
  assert.ok(health.includes("legacy_video_bucket_configured:legacyVideoBucket"));
  assert.ok(health.includes('status:healthy?"healthy":"degraded"'));
});
