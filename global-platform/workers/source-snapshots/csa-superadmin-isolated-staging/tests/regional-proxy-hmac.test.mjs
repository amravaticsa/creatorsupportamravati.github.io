import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const start = source.indexOf("async function regionalGlobalProxy");
const end = source.indexOf("async function regionalAudit", start);
const proxy = source.slice(start, end);

test("Regional Admin proxy uses the legacy HMAC key only for the isolated compatibility API", () => {
  assert.ok(start >= 0 && end > start);
  assert.match(proxy, /const secret=env\.ADMIN_SYNC_HMAC_SECRET/);
  assert.doesNotMatch(proxy, /GLOBAL_API_SYNC_HMAC_SECRET/);
  assert.match(proxy, /csa-global-api-isolated-staging\.creatorsupportamravati\.workers\.dev/);
});
