import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync(new URL("../global-admin-sync.js", import.meta.url), "utf8");

test("Global Admin sync prefers the dedicated HMAC secret and retains the legacy fallback", () => {
  assert.ok(helper.includes("if (!(env.GLOBAL_API_SYNC_HMAC_SECRET || env.ADMIN_SYNC_HMAC_SECRET))"));
  assert.ok(helper.includes("hmacHex(env.GLOBAL_API_SYNC_HMAC_SECRET || env.ADMIN_SYNC_HMAC_SECRET"));
  assert.ok(helper.includes("csa-global-api-staging.creatorsupportamravati.workers.dev"));
  assert.ok(!helper.includes("csa-global-api-isolated-staging.creatorsupportamravati.workers.dev"));
});
