import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const workerPath = new URL("../worker.js", import.meta.url);
const source = readFileSync(workerPath, "utf8");
const match = source.match(/const portalRoleAllowed = \(req,env,role\) => \{[\s\S]*?\};/);
assert.ok(match, "Super Admin portal host policy must exist");
const sandbox = { URL };
vm.runInNewContext(match[0] + "\\nglobalThis.portalRoleAllowed = portalRoleAllowed;", sandbox);
const allowed = (host, role, environment = "staging") =>
  sandbox.portalRoleAllowed({ url: `https://${host}/api/login` }, { ENVIRONMENT: environment }, role);

test("dedicated editor-management auth host is staging-only", () => {
  assert.equal(allowed("superadmin-editor-staging.creatorsupportamravati.in", "super_admin", "staging"), true);
  assert.equal(allowed("superadmin-editor-staging.creatorsupportamravati.in", "super_admin", "production"), false);
  assert.equal(allowed("superadmin-editor-staging.creatorsupportamravati.in", "project_admin", "staging"), false);
  assert.equal(allowed("superadmin-editor-staging.creatorsupportamravati.in.evil.test", "super_admin", "staging"), false);
});

test("existing Super Admin hosts retain their role policy", () => {
  assert.equal(allowed("superadmin.creatorsupportamravati.in", "super_admin"), true);
  assert.equal(allowed("superadmin-staging.creatorsupportamravati.in", "super_admin"), true);
  assert.equal(allowed("admin.creatorsupportamravati.in", "project_admin"), true);
  assert.equal(allowed("admin.creatorsupportamravati.in", "super_admin"), false);
});
