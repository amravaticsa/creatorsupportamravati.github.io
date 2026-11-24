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


test("admin authorization sync verifies only the dedicated CSA Global Admin HMAC key", () => {
  const start = source.indexOf('if(m==="POST"&&p==="/internal/admin-authorizations/sync"){');
  assert.ok(start >= 0, "admin authorization sync route exists");
  const block = source.slice(start, start + 1800);
  assert.match(block, /!env\.CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET/);
  assert.match(block, /hmacHex\(env\.CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET,canonical\)/);
  assert.doesNotMatch(block, /verifyGlobalApiHmac\(env,canonical,sig\)/);
  assert.doesNotMatch(block, /env\.ADMIN_SYNC_HMAC_SECRET/);
  assert.doesNotMatch(block, /env\.GLOBAL_API_SYNC_HMAC_SECRET/);
});
