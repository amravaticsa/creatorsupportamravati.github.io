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

test("Isolated admin authorization sync tries configured HMAC keys after 401", () => {
  const block = blockFor("syncGlobalAdminAuthorizations");
  assert.ok(block.includes('["CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET", env.CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET]'));
  assert.ok(block.includes('["GLOBAL_API_SYNC_HMAC_SECRET", env.GLOBAL_API_SYNC_HMAC_SECRET]'));
  assert.ok(block.includes('["ADMIN_SYNC_HMAC_SECRET", env.ADMIN_SYNC_HMAC_SECRET]'));
  assert.ok(block.indexOf("CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET") < block.indexOf("GLOBAL_API_SYNC_HMAC_SECRET"));
  assert.ok(block.includes("for (const [, secret] of hmacSecrets)"));
  assert.ok(block.includes("if (response.status === 401)"));
  assert.ok(block.includes("const nonce = crypto.randomUUID()"));
  assert.ok(block.includes("const signature = await hmacHex(secret, canonical)"));
  assert.ok(block.includes("csa-global-api-isolated-staging.creatorsupportamravati.workers.dev"));
});

test("Other isolated Global API bridges retain the separate Global API HMAC key", () => {
  for (const fn of ["callGlobalPricingPolicy","callGlobalRefundDashboard","callGlobalEditorSessions"]) {
    const block = blockFor(fn);
    assert.ok(block.includes("GLOBAL_API_SYNC_HMAC_SECRET"), fn + " uses Global API bridge secret");
    assert.ok(block.includes("csa-global-api-isolated-staging.creatorsupportamravati.workers.dev"), fn + " targets isolated Global API");
  }
});

test("Legacy-link bridge stays isolated and signs with the legacy HMAC secret only", () => {
  const block = blockFor("callGlobalLegacyLinks");
  assert.ok(block.includes("csa-global-api-isolated-staging.creatorsupportamravati.workers.dev"));
  assert.ok(!block.includes("csa-global-api-staging.creatorsupportamravati.workers.dev"));
  assert.ok(block.includes("hmacHex(env.ADMIN_SYNC_HMAC_SECRET,canonical)"));
  assert.ok(!block.includes("GLOBAL_API_SYNC_HMAC_SECRET"));
  assert.ok(!block.includes("CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET"));
});
