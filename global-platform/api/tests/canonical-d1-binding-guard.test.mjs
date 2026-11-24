import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf('if(m==="POST"&&p==="/internal/admin-authorizations/sync")');
const end = source.indexOf('if(m==="POST"&&p.startsWith("/internal/regional/"))', start);
const syncRoute = source.slice(start, end);

test("main Global API rejects admin sync on a non-canonical D1 before nonce or authorization writes", () => {
  assert.ok(start >= 0, "admin authorization sync route exists");
  assert.match(syncRoute, /country_legal_evidence/);
  assert.match(syncRoute, /canonical_database_mismatch/);
  const guard = syncRoute.indexOf("country_legal_evidence");
  const nonce = syncRoute.indexOf("INSERT INTO admin_sync_nonces");
  const write = syncRoute.indexOf("await env.DB.batch(statements)");
  assert.ok(guard >= 0 && nonce > guard && write > guard, "canonical D1 guard runs before all writes");
});
