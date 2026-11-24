import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const syncSource = readFileSync(new URL("../../superadmin/global-admin-sync.js", import.meta.url), "utf8");
const isolatedWorkerSource = readFileSync(new URL("../../workers/source-snapshots/csa-superadmin-isolated-staging/worker.js", import.meta.url), "utf8");
const legacyWorkerSource = readFileSync(new URL("../../workers/staging/csa-superadmin-api-staging/worker.js", import.meta.url), "utf8");
const isolatedSyncSource = readFileSync(new URL("../../workers/source-snapshots/csa-superadmin-isolated-staging/global-admin-sync.js", import.meta.url), "utf8");

const isolatedAdminUiSource = readFileSync(new URL("../../workers/source-snapshots/csa-superadmin-isolated-staging/admin-app-source.js", import.meta.url), "utf8");
const legacyAdminUiSource = readFileSync(new URL("../../workers/staging/csa-superadmin-api-staging/admin-app-source.js", import.meta.url), "utf8");

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

test("Finance Admin sync grants are normalized to read-only", () => {
  const mapping = 'finance_access_level: account.role === "finance_admin" ? (account.finance_access_level === "none" ? "none" : ["read","write","manage"].includes(account.finance_access_level) ? "read" : "none") : "none",';
  assert.ok(syncSource.includes(mapping));
  assert.ok(isolatedSyncSource.includes(mapping));
});

test("isolated Super Admin backend rejects Finance Admin write/manage even with stale module access", () => {
  assert.ok(isolatedWorkerSource.includes('if(u.role==="finance_admin"&&moduleKey==="finance"&&required!=="read")return false;'));
  assert.ok(isolatedWorkerSource.includes('if(!["none","read"].includes(level))'));
});


test("Finance Admin module access is read-only in both Super Admin APIs", () => {
  const guard = 'if(target.role==="finance_admin"&&items.some(x=>x.module_key==="finance"&&!["none","read"].includes(x.access_level)))return json({ok:false,error:"finance_admin_access_is_read_only"},403);';
  assert.ok(isolatedWorkerSource.includes(guard));
  assert.ok(legacyWorkerSource.includes(guard));
});

test("legacy Finance routes require module permissions and hide analytics money fields", () => {
  assert.ok(legacyWorkerSource.includes('if(u.role==="finance_admin"&&moduleKey==="finance"&&required!=="read")return false;'));
  assert.ok(legacyWorkerSource.includes('if(!await hasModuleAccess(env,u,"finance","read"))return json({ok:false,error:"module_access_denied"},403);'));
  assert.ok(legacyWorkerSource.includes('if(!await hasModuleAccess(env,u,"finance","write"))return json({ok:false,error:"module_access_denied"},403);'));
  assert.ok(legacyWorkerSource.includes("finance:financeAccess?finance:null"));
  assert.ok(legacyWorkerSource.includes("monthly_revenue:financeAccess?monthly.results||[]:[]"));
});

test("legacy Finance Admin invitations and role changes default to Read and clear access on role removal", () => {
  assert.ok(legacyWorkerSource.includes('if(role==="finance_admin")await env.DB.prepare("INSERT INTO csa_admin_module_access'));
  assert.ok(legacyWorkerSource.includes('if(role==="finance_admin"||(!role&&a.role==="finance_admin"))'));
  assert.ok(legacyWorkerSource.includes("access_level='read'"));
  assert.ok(legacyWorkerSource.includes("access_level='none'"));
  assert.ok(isolatedWorkerSource.includes("access_level='read'"));
});

test("Finance dropdown is role-scoped and does not remove Super Admin access options", () => {
  const roleGuard = "const financeReadOnly=d.admin?.role==='finance_admin';";
  const financeOnly = "financeReadOnly&&x.module_key==='finance'";
  const hiddenOption = "financeReadOnly&&x.module_key==='finance'?'hidden disabled ':'";
  for (const uiSource of [isolatedAdminUiSource, legacyAdminUiSource]) {
    assert.ok(uiSource.includes(roleGuard));
    assert.ok(uiSource.includes(financeOnly));
    assert.ok(uiSource.includes(hiddenOption));
  }
});
