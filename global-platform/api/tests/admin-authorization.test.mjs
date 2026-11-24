import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("admin identity registration requires a verified identity-provider email", () => {
  assert.ok(source.includes("c.email_verified!==true"));
  assert.ok(source.includes('c.sub!=="string"'));
  assert.ok(source.includes('c.email!=="string"'));
});

test("admin registration rechecks active Super Admin authorization before creating the Global account", () => {
  assert.ok(source.includes("SELECT 1 AS ok FROM global_admin_authorizations WHERE email=? COLLATE NOCASE AND status='active'"));
  assert.ok(source.includes('if(!stillAuthorized)return bad("CSA Super Admin authorization is no longer active."'));
  assert.ok(source.includes("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status) VALUES(?,?, 'admin',?,?, 'active')"));
});

test("admin access is revalidated against active authorization and finance access level on every authenticated request", () => {
  assert.ok(source.includes("SELECT source_role,source_admin_id,finance_access_level FROM global_admin_authorizations WHERE email=? COLLATE NOCASE AND status='active'"));
  assert.ok(source.includes('if(!a||!GLOBAL_ROLE_PERMISSIONS[a.source_role])throw Error("CSA Super Admin authorization is inactive.")'));
  assert.ok(source.includes('if(a.source_role==="regional_admin")throw Error("Regional Admin access is restricted to the country-scoped Regional Admin portal.")'));
});

test("the Super Admin sync bridge accepts delegated roles and never super_admin", () => {
  assert.ok(source.includes('["project_admin","editor_admin","finance_admin","support_admin","regional_admin"].includes(role)'));
  assert.ok(source.includes("revoked_if_absent:true"));
  assert.ok(!source.includes('["project_admin","editor_admin","finance_admin","support_admin","regional_admin","super_admin"]'));
});

test("role permissions remain least-privilege; finance and regional access are separately scoped", () => {
  assert.ok(source.includes('project_admin:["projects.manage"]'));
  assert.ok(source.includes('editor_admin:["content.manage"]'));
  assert.ok(source.includes('finance_admin:[]'));
  assert.ok(source.includes('support_admin:["support.manage"]'));
  assert.ok(source.includes('regional_admin:[]'));
  assert.ok(source.includes('a.source_role==="finance_admin"&&a.finance_access_level==="read"'));
  assert.ok(source.includes('rolePermissions.push("finance.read")'));
  assert.ok(!source.includes('rolePermissions.push("finance.refunds","finance.payouts")'));
});

test("Global Admin HMAC verification supports dedicated and legacy secrets", () => {
  assert.ok(source.includes("async function verifyGlobalApiHmac(env,canonical,sig)"));
  assert.ok(source.includes("env.GLOBAL_API_SYNC_HMAC_SECRET,env.ADMIN_SYNC_HMAC_SECRET"));
  assert.ok(source.includes("if(constantTime(expected,sig))return true"));
});

test("Super Admin pricing bridge accepts a 10-digit timestamp and signs newline-delimited canonical data", () => {
  assert.ok(source.includes("if(!/^\\d{10}$/.test(ts)"));
  assert.ok(source.includes('const canonical="POST\\n/internal/superadmin/pricing-policy\\n"+ts+"\\n"+nonce+"\\n"+bodyHash'));
});
