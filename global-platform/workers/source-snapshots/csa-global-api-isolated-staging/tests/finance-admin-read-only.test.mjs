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
