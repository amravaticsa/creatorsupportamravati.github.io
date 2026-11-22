import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("admin identity registration requires a verified identity-provider email", () => {
  assert.match(source, /c\.email_verified!==true/);
  assert.match(source, /c\.sub!=="string"/);
  assert.match(source, /c\.email!=="string"/);
});

test("admin registration rechecks active Super Admin authorization before creating the Global account", () => {
  assert.match(source, /SELECT 1 AS ok FROM global_admin_authorizations WHERE email=\? COLLATE NOCASE AND status='active'/);
  assert.match(source, /if\(!stillAuthorized\)return bad\("CSA Super Admin authorization is no longer active\."/);
  assert.match(source, /INSERT INTO users\(id,auth_subject,role,email,email_verified_at,account_status\) VALUES\(\?,\?, 'admin',\?,\?, 'active'\)/);
});

test("admin access is revalidated against active authorization and finance access level on every authenticated request", () => {
  assert.match(source, /SELECT source_role,source_admin_id,finance_access_level FROM global_admin_authorizations WHERE email=\? COLLATE NOCASE AND status='active'/);
  assert.match(source, /if\(!a\|\|!GLOBAL_ROLE_PERMISSIONS\[a\.source_role\]\)throw Error\("CSA Super Admin authorization is inactive\."\)/);
  assert.match(source, /if\(a\.source_role==="regional_admin"\)throw Error\("Regional Admin access is restricted to the country-scoped Regional Admin portal\."\)/);
});

test("the Super Admin sync bridge accepts delegated roles and never super_admin", () => {
  assert.match(source, /\["project_admin","editor_admin","finance_admin","support_admin","regional_admin"\]\.includes\(role\)/);
  assert.match(source, /revoked_if_absent:true/);
  assert.doesNotMatch(source, /\["project_admin","editor_admin","finance_admin","support_admin","regional_admin","super_admin"\]/);
});

test("role permissions remain least-privilege; finance and regional access are separately scoped", () => {
  assert.match(source, /project_admin:\["projects\.manage"\]/);
  assert.match(source, /editor_admin:\["content\.manage"\]/);
  assert.match(source, /finance_admin:\[\]/);
  assert.match(source, /support_admin:\["support\.manage"\]/);
  assert.match(source, /regional_admin:\[\]/);
  assert.match(source, /a\.source_role==="finance_admin"&&\["read","write","manage"\]\.includes\(a\.finance_access_level\)/);
  assert.match(source, /rolePermissions\.push\("finance\.read"\)/);
  assert.match(source, /rolePermissions\.push\("finance\.refunds","finance\.payouts"\)/);
});

test("Global Admin HMAC verification supports dedicated and legacy secrets", () => {
  assert.match(source, /async function verifyGlobalApiHmac\(env,canonical,sig\)/);
  assert.match(source, /env\.GLOBAL_API_SYNC_HMAC_SECRET,env\.ADMIN_SYNC_HMAC_SECRET/);
  assert.match(source, /if\(constantTime\(expected,sig\)\)return true/);
});

test("Super Admin pricing bridge accepts a 10-digit timestamp and signs newline-delimited canonical data", () => {
  assert.ok(source.includes('if(!/^\\d{10}$/.test(ts)'));
  assert.ok(source.includes('const canonical="POST\\n/internal/superadmin/pricing-policy\\n"+ts+"\\n"+nonce+"\\n"+bodyHash'));
});
