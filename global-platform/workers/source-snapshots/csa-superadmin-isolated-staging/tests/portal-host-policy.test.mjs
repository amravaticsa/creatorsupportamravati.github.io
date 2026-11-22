import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const workerPath = new URL("../worker.js", import.meta.url);
const source = readFileSync(workerPath, "utf8");
const match = source.match(/const portalRoleAllowed = \(req,env,role\) => \{[\s\S]*?\};/);
assert.ok(match, "Super Admin portal host policy must exist");
const sandbox = { URL };
vm.runInNewContext(match[0] + "\nglobalThis.portalRoleAllowed = portalRoleAllowed;", sandbox);
const allowed = (host, role, environment = "staging") =>
  sandbox.portalRoleAllowed({ url: `https://${host}/api/login` }, { ENVIRONMENT: environment }, role);

test("dedicated editor-management auth host is staging-only", () => {
  assert.equal(allowed("superadmin-editor-staging.creatorsupportamravati.in", "super_admin", "staging"), true);
  assert.equal(allowed("superadmin-editor-staging.creatorsupportamravati.in", "super_admin", "production"), false);
  assert.equal(allowed("superadmin-editor-staging.creatorsupportamravati.in", "project_admin", "staging"), false);
  assert.equal(allowed("superadmin-editor-staging.creatorsupportamravati.in.evil.test", "super_admin", "staging"), false);
});


test("admin staging and workers.dev hosts are restricted to staging", () => {
  assert.equal(allowed("admin-isolated-staging.creatorsupportamravati.in", "project_admin", "staging"), true);
  assert.equal(allowed("admin-staging.creatorsupportamravati.in", "project_admin", "staging"), true);
  assert.equal(allowed("admin-isolated-staging.creatorsupportamravati.in", "super_admin", "staging"), false);
  assert.equal(allowed("admin-staging.creatorsupportamravati.in", "super_admin", "staging"), false);
  assert.equal(allowed("admin-isolated-staging.creatorsupportamravati.in", "project_admin", "production"), false);
  assert.equal(allowed("admin-staging.creatorsupportamravati.in", "project_admin", "production"), false);
  assert.equal(allowed("csa-superadmin-isolated-staging.creatorsupportamravati.workers.dev", "super_admin", "staging"), true);
  assert.equal(allowed("csa-superadmin-isolated-staging.creatorsupportamravati.workers.dev", "super_admin", "production"), false);
  assert.equal(allowed("superadmin-staging.creatorsupportamravati.in", "super_admin", "production"), false);
});

test("existing Super Admin hosts retain their role policy", () => {
  assert.equal(allowed("superadmin.creatorsupportamravati.in", "super_admin"), true);
  assert.equal(allowed("superadmin-staging.creatorsupportamravati.in", "super_admin"), true);
  assert.equal(allowed("admin.creatorsupportamravati.in", "project_admin"), true);
  assert.equal(allowed("admin.creatorsupportamravati.in", "super_admin"), false);
});

test("Admin invitation links use the role-compatible Admin dashboard host", () => {
  const start = source.indexOf("async function invite(");
  const end = source.indexOf("async function updateFinanceAccess(", start);
  assert.ok(start >= 0 && end > start, "Admin invite handler must exist");
  const invite = source.slice(start, end);
  assert.ok(invite.includes("env.ADMIN_DASHBOARD_URL"));
  assert.ok(invite.includes('dashboard.hostname!=="admin-isolated-staging.creatorsupportamravati.in"'));
  assert.ok(invite.includes('dashboard.protocol!=="https:"'));
  assert.doesNotMatch(invite, /admin\\.creatorsupportamravati\\.in/);
  assert.ok(invite.includes('dashboard.origin+"/?invite="'));
  assert.doesNotMatch(invite, /csa-superadmin-isolated-staging\\.creatorsupportamravati\\.workers\\.dev/);
});
