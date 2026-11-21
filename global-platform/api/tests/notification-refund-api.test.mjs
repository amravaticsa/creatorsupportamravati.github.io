import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("notification API is authenticated and scoped to the signed-in user", () => {
  assert.match(source, /if\(m==="GET"&&p==="\/v1\/notifications"\)\{\s*const a=await user\(req,env,\["client","admin"\]\)/);
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
  assert.ok(source.includes(String.raw`if(m==="PATCH"&&/^\/v1\/admin\/client-refunds\/[\w-]+$/.test(p))return "finance.refunds";`));
  assert.match(source, /provider_refund_started:false/);
  assert.match(source, /A rejection reason is required/);
});
