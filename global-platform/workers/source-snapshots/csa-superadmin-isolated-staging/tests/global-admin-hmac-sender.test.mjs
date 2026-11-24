import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../global-admin-sync.js", import.meta.url), "utf8");

test("Super Admin authorization sync retries with a fresh nonce using the alternate HMAC key", () => {
  const start = source.indexOf("export async function syncGlobalAdminAuthorizations");
  assert.ok(start >= 0);
  const next = source.indexOf("export async function ", start + 20);
  const block = source.slice(start, next < 0 ? source.length : next);
  assert.match(block, /\["GLOBAL_API_SYNC_HMAC_SECRET", env\.GLOBAL_API_SYNC_HMAC_SECRET\]/);
  assert.match(block, /\["ADMIN_SYNC_HMAC_SECRET", env\.ADMIN_SYNC_HMAC_SECRET\]/);
  assert.match(block, /for \(const \[, secret\] of hmacSecrets\)/);
  assert.match(block, /if \(response\.status === 401\)/);
  assert.match(block, /const nonce = crypto\.randomUUID\(\)/);
  assert.match(block, /hmacHex\(secret, canonical\)/);
  assert.doesNotMatch(block, /env\.CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET/);
  assert.match(block, /https:\/\/csa-global-api-staging\.creatorsupportamravati\.workers\.dev/);
});
