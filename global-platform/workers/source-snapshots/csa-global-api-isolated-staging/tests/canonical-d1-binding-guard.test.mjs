import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../index.js", import.meta.url), "utf8");
const start = source.indexOf('if(m==="POST"&&p==="/internal/admin-authorizations/sync")');
const end = source.indexOf('if(m==="POST"&&p==="/internal/superadmin/finance/refund-dashboard")', start);
const syncRoute = source.slice(start, end);

test("admin authorization sync rejects the main-stack Global D1 before nonce or authorization writes", () => {
  assert.ok(start >= 0, "admin authorization sync route exists");
  assert.match(syncRoute, /country_legal_evidence/);
  assert.match(syncRoute, /isolated_database_mismatch/);
  assert.match(syncRoute, /country_legal_reviews/);
  const guard = syncRoute.indexOf("country_legal_reviews");
  const nonce = syncRoute.indexOf("INSERT INTO admin_sync_nonces");
  const write = syncRoute.indexOf("await env.DB.batch(statements)");
  assert.ok(guard >= 0 && nonce > guard && write > guard, "canonical D1 guard runs before all writes");
});
