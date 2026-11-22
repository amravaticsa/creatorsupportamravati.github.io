import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("admin identity registration requires a verified identity-provider email", () => {
  assert.match(source, /c\\.email_verified!==true/);
  assert.match(source, /c\\.sub!==\"string\"/);
  assert.match(source, /c\\.email!==\"string\"/);
});

test("admin registration rechecks active Super Admin authorization before creating the Global account", () => {
  assert.ok(source.includes("SELECT 1 AS ok FROM global_admin_authorizations WHERE email=? COLLATE NOCASE AND status='active'"));
  assert.ok(source.includes('if(!stillAuthorized)return bad("CSA Super Admin authorization is no longer active."'));
  assert.ok(source.includes("INSERT INTO users(id,auth_subject,role,email,email_verified_at,account_status) VALUES(?,?, 'admin',?,?, 'active')"));
});

test("admin access is revalidated against active authorization and regional admins stay in their country-scoped portal", () => {
  assert.ok(source.includes("SELECT source_role,source_admin_id,finance_access_level FROM global_admin_authorizations WHERE email=? COLLATE NOCASE AND status='active'"));
  assert.ok(source.includes('if(!a||!GLOBAL_ROLE_PERMISSIONS[a.source_role])throw Error("CSA Super Admin authorization is inactive.")'));
  assert.ok(source.includes('if(a.source_role==="regional_admin")throw Error("Regional Admin access is restricted to the country-scoped Regional Admin portal.")'));
});

test("the Super Admin sync bridge accepts only delegated roles and never super_admin", () => {
  assert.ok(source.includes('["project_admin","editor_admin","finance_admin","support_admin","regional_admin"].includes(role)'));
  assert.ok(source.includes("revoked_if_absent:true"));
  assert.ok(!source.includes('"super_admin"].includes(role)'));
});

test("global role permissions remain least-privilege by default", () => {
  assert.ok(source.includes('project_admin:["projects.manage"]'));
  assert.ok(source.includes('editor_admin:["content.manage"]'));
  assert.ok(source.includes("finance_admin:[]"));
  assert.ok(source.includes('support_admin:["support.manage"]'));
  assert.ok(source.includes("regional_admin:[]"));
});

test("finance read, refund and payout access are separately granted by explicit finance access level", () => {
  assert.ok(source.includes('if(a.source_role==="finance_admin"&&["read","write","manage"].includes(a.finance_access_level))rolePermissions.push("finance.read")'));
  assert.ok(source.includes('if(a.source_role==="finance_admin"&&["write","manage"].includes(a.finance_access_level))rolePermissions.push("finance.refunds","finance.payouts")'));
});

test("Super Admin pricing bridge accepts a 10-digit timestamp and signs newline-delimited canonical data", () => {
  assert.ok(source.includes('if(!/^\\\\d{10}$/.test(ts)'));
  assert.ok(source.includes('const canonical="POST\\\\n/internal/superadmin/pricing-policy\\\\n"+ts+"\\\\n"+nonce+"\\\\n"+bodyHash'));
});
