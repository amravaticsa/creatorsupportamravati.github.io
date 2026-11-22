import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../global-admin-sync.js", import.meta.url), "utf8");

test("Super Admin authorization sync prefers the dedicated secret and preserves legacy fallback", () => {
  assert.match(source, /env\.GLOBAL_API_SYNC_HMAC_SECRET \|\| env\.ADMIN_SYNC_HMAC_SECRET/);
  assert.match(source, /https:\/\/csa-global-api-staging\.creatorsupportamravati\.workers\.dev/);
  assert.match(source, /\/internal\/admin-authorizations\/sync/);
  assert.equal((source.match(/https:\/\/csa-global-api-staging\.creatorsupportamravati\.workers\.dev/g) || []).length, 4);
  assert.match(source, /callGlobalLegacyLinks[\s\S]*?csa-global-api-isolated-staging\.workers\.dev/);
});
