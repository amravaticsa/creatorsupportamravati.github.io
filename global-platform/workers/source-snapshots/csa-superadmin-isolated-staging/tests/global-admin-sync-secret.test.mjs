import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync(new URL("../global-admin-sync.js", import.meta.url), "utf8");

function blockFor(name) {
  const start = helper.indexOf("export async function " + name);
  assert.ok(start >= 0, name + " helper exists");
  const next = helper.indexOf("export async function ", start + 20);
  return helper.slice(start, next < 0 ? helper.length : next);
}

test("Canonical Super Admin bridges use the dedicated HMAC with legacy fallback", () => {
  assert.ok(helper.includes("if (!(env.GLOBAL_API_SYNC_HMAC_SECRET || env.ADMIN_SYNC_HMAC_SECRET))"));
  assert.ok(helper.includes("hmacHex(env.GLOBAL_API_SYNC_HMAC_SECRET || env.ADMIN_SYNC_HMAC_SECRET"));
  for (const fn of ["syncGlobalAdminAuthorizations","callGlobalPricingPolicy","callGlobalRefundDashboard","callGlobalEditorSessions"]) {
    const block = blockFor(fn);
    assert.ok(block.includes("csa-global-api-staging.creatorsupportamravati.workers.dev"), fn + " must target canonical Staging API");
    assert.ok(!block.includes("csa-global-api-isolated-staging.creatorsupportamravati.workers.dev"), fn + " must not target isolated legacy API");
  }
});

test("Legacy-link bridge stays isolated and signs with the legacy HMAC secret only", () => {
  const block = blockFor("callGlobalLegacyLinks");
  assert.ok(block.includes("csa-global-api-isolated-staging.creatorsupportamravati.workers.dev"));
  assert.ok(!block.includes("csa-global-api-staging.creatorsupportamravati.workers.dev"));
  assert.ok(block.includes("hmacHex(env.ADMIN_SYNC_HMAC_SECRET,canonical)"));
  assert.ok(!block.includes("GLOBAL_API_SYNC_HMAC_SECRET"));
});
