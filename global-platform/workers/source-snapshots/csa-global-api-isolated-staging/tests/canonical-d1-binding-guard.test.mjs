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
  assert.match(syncRoute, /v_tender_country_scope/);
  const guard = syncRoute.indexOf("v_tender_country_scope");
  const nonce = syncRoute.indexOf("INSERT INTO admin_sync_nonces");
  const write = syncRoute.indexOf("await env.DB.batch(statements)");
  assert.ok(guard >= 0 && nonce > guard && write > guard, "canonical D1 guard runs before all writes");
});


const healthStart = source.indexOf('if(m==="GET"&&p==="/health"){');
const healthEnd = source.indexOf('if(m==="GET"&&p==="/v1/config")', healthStart);
const healthRoute = source.slice(healthStart, healthEnd);

test("Global API health validates canonical D1 required tables and columns", () => {
  assert.ok(healthStart >= 0, "health route exists");
  assert.match(healthRoute, /country_legal_evidence/);
  assert.match(healthRoute, /pragma_table_info/);
  assert.match(healthRoute, /missing_columns:missingColumns/);
  assert.match(healthRoute, /schemaReady=missingTables.length===0&&missingColumns.length===0/);
  for (const column of [
    "created_by_source_admin_id",
    "reviewed_by_source_admin_id",
    "client_approved_at",
    "client_approved_by",
    "requested_by_source_admin_id",
    "processed_by_source_admin_id",
    "settlement_reference",
    "processed_at"
  ]) assert.ok(healthRoute.includes(column), "health schema guard must require " + column);
});
