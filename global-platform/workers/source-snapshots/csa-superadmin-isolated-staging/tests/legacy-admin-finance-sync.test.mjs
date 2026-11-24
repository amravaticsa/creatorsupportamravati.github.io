import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../../staging/csa-superadmin-api-staging/global-admin-sync.js", import.meta.url),
  "utf8",
);

test("Legacy Super Admin sync sends Finance access and clamps it to read", () => {
  assert.match(source, /csa_admin_module_access/);
  assert.match(source, /AS finance_access_level/);
  assert.match(source, /finance_access_level: account\.role === "finance_admin"/);
  assert.match(source, /\["read","write","manage"\]\.includes\(account\.finance_access_level\) \? "read"/);
});
