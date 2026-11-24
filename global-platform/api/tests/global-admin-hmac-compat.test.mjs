import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("canonical Global API accepts the dedicated HMAC secret and legacy fallback", () => {
  assert.match(source, /async function verifyGlobalApiHmac\(env,canonical,sig\)/);
  assert.match(source, /\[env\.GLOBAL_API_SYNC_HMAC_SECRET,env\.ADMIN_SYNC_HMAC_SECRET\]\.filter\(Boolean\)/);
  assert.match(source, /for\(const secret of secrets\)/);
  assert.match(source, /constantTime\(expected,sig\)/);
  assert.ok((source.match(/verifyGlobalApiHmac\(env,canonical,sig\)/g) || []).length >= 7);
});


test("admin authorization sync accepts the dedicated CSA key without widening other bridge verification", () => {
  assert.match(source, /async function verifyGlobalAdminSyncHmac\(env,canonical,sig\)/);
  assert.match(source, /\[env\.CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET,env\.GLOBAL_API_SYNC_HMAC_SECRET,env\.ADMIN_SYNC_HMAC_SECRET\]\.filter\(Boolean\)/);
  assert.match(source, /verifyGlobalAdminSyncHmac\(env,canonical,sig\)/);
  assert.match(source, /env\.CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET&&!env\.ADMIN_SYNC_HMAC_SECRET&&!env\.GLOBAL_API_SYNC_HMAC_SECRET/);
});
