import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../index.js", import.meta.url), "utf8");

test("Finance Admin receives only finance.read in the Global role permission map", () => {
  const start = api.indexOf("const GLOBAL_ROLE_PERMISSIONS=");
  const end = api.indexOf("function adminPermissionFor", start);
  assert.ok(start >= 0 && end > start, "Global role permission map must exist");
  const roles = api.slice(start, end);
  assert.match(roles, /finance_admin:\["finance\.read"\]/);
  assert.doesNotMatch(roles, /finance\.refunds/);
});

test("refund mutations require an ungranted finance.refunds permission", () => {
  const start = api.indexOf("function adminPermissionFor");
  const end = api.indexOf("function ", start + 10);
  assert.ok(start >= 0);
  const map = api.slice(start, end > start ? end : api.length);
  assert.match(map, /client-refunds/);
  assert.match(map, /deposits/);
  assert.match(map, /finance\.refunds/);
  const roleStart = api.indexOf("const GLOBAL_ROLE_PERMISSIONS=");
  const roleEnd = api.indexOf("function adminPermissionFor", roleStart);
  assert.doesNotMatch(api.slice(roleStart, roleEnd), /finance\.refunds/);
});

test("payout mutations are routed through a separate ungranted finance.payouts permission", () => {
  const start = api.indexOf("const GLOBAL_ROLE_PERMISSIONS=");
  const end = api.indexOf("function adminPermissionFor", start);
  const roles = api.slice(start, end);
  assert.doesNotMatch(roles, /finance\.payouts/);
  assert.ok(api.includes('if(m==="POST"&&p==="/v1/admin/finance/editor-payouts")return "finance.payouts";'));
  assert.ok(api.includes('if(m==="POST"&&/^\\/v1\\/admin\\/finance\\/editor-payouts\\/[\\w-]+\\/(approve|mark-paid)$/.test(p))return "finance.payouts";'));
});

test("client refund processing is staging-only and requires Razorpay test credentials", () => {
  const start = api.indexOf("const clientRefundProcess=p.match(");
  const end = api.indexOf('if(m==="GET"&&p==="/v1/client/balance"){', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.match(route, /env\.ENVIRONMENT!=="staging"/);
  assert.match(route, /!env\.RAZORPAY_KEY_ID\|\|!env\.RAZORPAY_KEY_SECRET/);
  assert.match(route, /!env\.RAZORPAY_KEY_ID\.startsWith\("rzp_test_"\)/);
  assert.match(route, /X-Refund-Idempotency/);
});
