import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync(new URL("../global-admin-sync.js", import.meta.url), "utf8");

test("Global Admin sync uses the single canonical ADMIN_SYNC_HMAC_SECRET binding", () => {
  assert.ok(helper.includes("if (!env.ADMIN_SYNC_HMAC_SECRET)"));
  assert.ok(helper.includes("hmacHex(env.ADMIN_SYNC_HMAC_SECRET"));
  assert.ok(!helper.includes("GLOBAL_API_SYNC_HMAC_SECRET"), "alternate secret aliases must not silently override the shared key");
});
