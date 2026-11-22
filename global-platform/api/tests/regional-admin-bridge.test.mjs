import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf('if(m==="POST"&&p.startsWith("/internal/regional/")){');
const end = source.indexOf('if(m==="POST"&&p==="/internal/admin-authorizations/sync"){', start);
assert.ok(start >= 0 && end > start, "Canonical Regional Admin bridge must exist");
const route = source.slice(start, end);

test("Regional Admin data bridge is staging-only, HMAC-authenticated and replay-protected", () => {
  assert.ok(route.includes('env.ENVIRONMENT!=="staging"'));
  assert.ok(route.includes("verifyGlobalApiHmac(env,canonical,sig)"));
  assert.ok(route.includes("admin_sync_nonces"));
  assert.ok(route.includes("nowSeconds+300"));
  assert.ok(route.includes("regional_signature_invalid"));
  assert.ok(route.includes("regional_replay"));
  assert.ok(route.includes("raw.length>12000"));
});

test("Regional Admin request is bound to one exact permission and path", () => {
  assert.ok(route.includes('"/internal/regional/dashboard":"overview.read"'));
  assert.ok(route.includes('"/internal/regional/projects":"projects.read"'));
  assert.ok(route.includes('"/internal/regional/clients":"clients.read"'));
  assert.ok(route.includes('"/internal/regional/editors":"editors.read"'));
  assert.ok(route.includes('"/internal/regional/tenders":"tenders.read"'));
  assert.ok(route.includes("permission!==expectedPermission"));
  assert.ok(route.includes('["read","write","manage"].includes(level)'));
  assert.ok(route.includes("txt(b.regional_admin_id,100)"));
  assert.ok(route.includes("txt(b.assignment_id,100)"));
  assert.ok(route.includes('Sensitive finance access requires separate legal and finance approval.'));
});

test("Regional Admin data is filtered only by authoritative verified users.country_code", () => {
  assert.ok(route.includes("WHERE role='client' AND country_code=?"));
  assert.ok(route.includes("WHERE role='editor' AND country_code=?"));
  assert.ok(route.includes("WHERE u.role='client' AND u.country_code=?"));
  assert.ok(route.includes("WHERE u.role='editor' AND u.country_code=?"));
  assert.ok(route.includes("v_project_country_scope WHERE country_code=? AND country_scope_status='assigned'"));
  assert.ok(route.includes("s.country_code=? AND s.country_scope_status='assigned'"));
  assert.ok(!route.includes("COALESCE(ep.country_code,u.country_code)"));
  assert.ok(!route.includes("COALESCE(e.country_code,u.country_code)"));
  assert.ok(!route.includes("ep.country_code=?"));
});

test("Regional Admin bridge verifies country exists and never exposes finance records", () => {
  assert.ok(route.includes('SELECT country_code FROM countries WHERE country_code=?'));
  assert.ok(route.includes('if(p==="/internal/regional/finance")return bad('));
  assert.ok(!route.includes("SELECT * FROM payments"));
  assert.ok(!route.includes("FROM client_refund_requests"));
});
