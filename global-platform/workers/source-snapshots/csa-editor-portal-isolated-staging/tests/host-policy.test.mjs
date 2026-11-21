import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const workerPath = new URL("../worker.js", import.meta.url);
let source = readFileSync(workerPath, "utf8");
source = source.replace(/^export function /gm, "function ");
source = source.replace("export default {", "globalThis.__worker = {");
source += "\nglobalThis.__hostPolicy = { resolvePortalHosts, isPortalHost };\n";
const sandbox = {};
vm.runInNewContext(source, sandbox, { filename: "editor-portal-worker.js" });
const { resolvePortalHosts, isPortalHost } = sandbox.__hostPolicy;

test("staging environment accepts only the two dedicated staging hosts", () => {
  const env = { ENVIRONMENT: "staging" };
  assert.equal(isPortalHost("editor-staging.creatorsupportamravati.in", "editor", env), true);
  assert.equal(isPortalHost("superadmin-editor-staging.creatorsupportamravati.in", "admin", env), true);
  assert.equal(isPortalHost("editor.creatorsupportamravati.in", "editor", env), false);
  assert.equal(isPortalHost("superadmin.creatorsupportamravati.in", "admin", env), false);
  assert.equal(isPortalHost("attacker.example", "editor", env), false);
});

test("production environment retains only the production hostnames", () => {
  const env = { ENVIRONMENT: "production" };
  assert.equal(isPortalHost("editor.creatorsupportamravati.in", "editor", env), true);
  assert.equal(isPortalHost("superadmin.creatorsupportamravati.in", "admin", env), true);
  assert.equal(isPortalHost("editor-staging.creatorsupportamravati.in", "editor", env), false);
  assert.equal(isPortalHost("superadmin-editor-staging.creatorsupportamravati.in", "admin", env), false);
});

test("missing or unknown environment fails closed", () => {
  assert.equal(resolvePortalHosts({}), null);
  assert.equal(resolvePortalHosts({ ENVIRONMENT: "preview" }), null);
  assert.equal(isPortalHost("editor-staging.creatorsupportamravati.in", "editor", {}), false);
});

test("host matching is exact and role constrained", () => {
  const env = { ENVIRONMENT: "staging" };
  assert.equal(isPortalHost("EDITOR-STAGING.creatorsupportamravati.in", "editor", env), false);
  assert.equal(isPortalHost("editor-staging.creatorsupportamravati.in.evil.test", "editor", env), false);
  assert.equal(isPortalHost("editor-staging.creatorsupportamravati.in", "admin", env), false);
  assert.equal(isPortalHost("superadmin-editor-staging.creatorsupportamravati.in", "editor", env), false);
});
