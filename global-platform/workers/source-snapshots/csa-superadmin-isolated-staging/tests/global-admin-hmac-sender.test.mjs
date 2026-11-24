import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../global-admin-sync.js", import.meta.url), "utf8");

test("Super Admin authorization sync uses only the dedicated CSA Global Admin HMAC key", () => {
  const start = source.indexOf("export async function syncGlobalAdminAuthorizations");
  assert.ok(start >= 0);
  const next = source.indexOf("export async function ", start + 20);
  const block = source.slice(start, next < 0 ? source.length : next);
  assert.match(block, /env\.CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET/);
  assert.doesNotMatch(block, /env\.GLOBAL_API_SYNC_HMAC_SECRET/);
  assert.doesNotMatch(block, /env\.ADMIN_SYNC_HMAC_SECRET/);
  assert.match(block, /https:\/\/csa-global-api-staging\.creatorsupportamravati\.workers\.dev/);
  assert.match(block, /\/internal\/admin-authorizations\/sync/);
});

test("Other canonical bridges keep their separate Global API key and legacy links keep the legacy key", () => {
  assert.match(source, /hmacHex\(env\.GLOBAL_API_SYNC_HMAC_SECRET\s*\|\|\s*env\.ADMIN_SYNC_HMAC_SECRET/);
  assert.match(source, /callGlobalLegacyLinks[\s\S]*?csa-global-api-isolated-staging\.creatorsupportamravati\.workers\.dev/);
  assert.match(source, /callGlobalLegacyLinks[\s\S]*?hmacHex\(env\.ADMIN_SYNC_HMAC_SECRET,canonical\)/);
});
