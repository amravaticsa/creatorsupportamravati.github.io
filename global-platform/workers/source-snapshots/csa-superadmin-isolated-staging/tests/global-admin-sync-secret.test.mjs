import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync(new URL("../global-admin-sync.js", import.meta.url), "utf8");

test("All Super Admin Global API bridges use the isolated staging API with dedicated HMAC", () => {
  assert.ok(helper.includes("if (!(env.GLOBAL_API_SYNC_HMAC_SECRET || env.ADMIN_SYNC_HMAC_SECRET))"));
  assert.ok(helper.includes("hmacHex(env.GLOBAL_API_SYNC_HMAC_SECRET || env.ADMIN_SYNC_HMAC_SECRET"));
  for (const fn of ["syncGlobalAdminAuthorizations","callGlobalPricingPolicy","callGlobalRefundDashboard","callGlobalEditorSessions","callGlobalLegacyLinks"]) {
    const start = helper.indexOf("export async function " + fn);
    const next = helper.indexOf("export async function ", start + 20);
    const block = helper.slice(start, next < 0 ? helper.length : next);
    assert.ok(block.includes("csa-global-api-isolated-staging.creatorsupportamravati.workers.dev"), fn + " must target isolated staging");
    assert.ok(!block.includes("csa-global-api-staging.creatorsupportamravati.workers.dev"), fn + " must not target canonical API");
  }
});
