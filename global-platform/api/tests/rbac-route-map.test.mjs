import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

function extractBlock(marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing source marker: ${marker}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unclosed source block: ${marker}`);
}

const permissionBlock = extractBlock("const GLOBAL_ROLE_PERMISSIONS=");
const rolePermissions = Function(`return (${permissionBlock.slice(permissionBlock.indexOf("=") + 1)})`)();
const resolverSource = extractBlock("function adminPermissionFor(req)");
const adminPermissionFor = Function("URL", `${resolverSource}; return adminPermissionFor;`)(URL);

function required(method, path) {
  return adminPermissionFor({ method, url: `https://csa.test${path}` });
}
function can(role, permission) {
  return (rolePermissions[role] || []).includes(permission);
}
function permits(role, method, path) {
  const requirement = required(method, path);
  if (requirement === null) return true;
  if (requirement === "__deny__") return false;
  return (Array.isArray(requirement) ? requirement : [requirement]).some(p => can(role, p));
}

test("only the four synchronized least-privilege roles exist", () => {
  assert.deepEqual(Object.keys(rolePermissions).sort(), [
    "editor_admin", "finance_admin", "project_admin", "support_admin"
  ]);
  assert.equal(rolePermissions.super_admin, undefined);
});

test("Project Admin can access project workflow but not finance/editor review", () => {
  assert.equal(permits("project_admin", "GET", "/v1/admin/projects"), true);
  assert.equal(permits("project_admin", "GET", "/v1/admin/submissions/pending"), true);
  assert.equal(permits("project_admin", "POST", "/v1/admin/projects/prj_1/offers"), true);
  assert.equal(permits("project_admin", "GET", "/v1/admin/editors/verified"), true);
  assert.equal(permits("project_admin", "GET", "/v1/admin/editors/kyc/pending"), false);
  assert.equal(permits("project_admin", "POST", "/v1/admin/deposits/pay_1/refund"), false);
});

test("Editor Admin can manage editor KYC and agreements but not project or finance writes", () => {
  assert.equal(permits("editor_admin", "GET", "/v1/admin/editors/pending"), true);
  assert.equal(permits("editor_admin", "GET", "/v1/admin/editors/kyc/pending"), true);
  assert.equal(permits("editor_admin", "POST", "/v1/admin/editors/usr_1/verify"), true);
  assert.equal(permits("editor_admin", "GET", "/v1/admin/agreements"), true);
  assert.equal(permits("editor_admin", "GET", "/v1/admin/editors/verified"), true);
  assert.equal(permits("editor_admin", "POST", "/v1/admin/projects/prj_1/offers"), false);
  assert.equal(permits("editor_admin", "POST", "/v1/admin/deposits/pay_1/refund"), false);
});

test("Finance Admin has explicit refund-write permission, separate from finance read", () => {
  assert.equal(permits("finance_admin", "GET", "/v1/admin/deposits/refunds/eligible"), true);
  assert.equal(permits("finance_admin", "POST", "/v1/admin/deposits/pay_1/refund"), true);
  assert.equal(permits("finance_admin", "POST", "/v1/admin/projects/prj_1/offers"), false);
  assert.equal(can("project_admin", "finance.refunds"), false);
});

test("Support Admin is limited to upload diagnostics and incident operations", () => {
  assert.equal(permits("support_admin", "GET", "/v1/admin/multipart-uploads"), true);
  assert.equal(permits("support_admin", "GET", "/v1/admin/multipart-cleanup-runs"), true);
  assert.equal(permits("support_admin", "POST", "/v1/admin/multipart-uploads/up_1/incidents"), true);
  assert.equal(permits("support_admin", "POST", "/v1/admin/deposits/pay_1/refund"), false);
  assert.equal(permits("support_admin", "POST", "/v1/admin/projects/prj_1/offers"), false);
});

test("shared admin views are mapped and unknown admin routes fail closed", () => {
  for (const role of Object.keys(rolePermissions)) {
    assert.equal(permits(role, "GET", "/v1/admin/departments"), true);
    assert.equal(permits(role, "GET", "/v1/admin/overview"), true);
  }
  assert.equal(required("POST", "/v1/admin/not-yet-mapped"), "__deny__");
});

test("pricing policy remains explicitly locked to the separate Super Admin boundary", () => {
  assert.equal(permits("project_admin", "GET", "/v1/admin/pricing-policy"), true);
  assert.equal(permits("editor_admin", "POST", "/v1/admin/pricing-policy"), false);
  assert.match(source, /Only Super Admin can (manage|change) CSA pricing policy/);
  assert.equal(rolePermissions.super_admin, undefined);
});
