import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../migrations/0033_country_legal_review_registry.sql", import.meta.url), "utf8");

test("Global API health gate requires the country legal review and regional authorization schema", () => {
  const start = source.indexOf('if(m==="GET"&&p==="/health")');
  const end = source.indexOf('if(m==="GET"&&p==="/v1/config")', start);
  assert.ok(start >= 0 && end > start, "health route must be registered");
  const route = source.slice(start, end);
  for (const table of [
    "countries",
    "country_legal_reviews",
    "regional_admins",
    "regional_admin_permissions",
    "regional_admin_permission_catalog",
    "regional_admin_audit_logs",
  ]) {
    assert.ok(route.includes('"' + table + '"'), "health must require " + table);
  }
  assert.ok(route.includes("schemaReady=missingTables.length===0"));
  assert.ok(route.includes('status:healthy?"healthy":"degraded"'));
});

test("country activation and payments fail closed until the latest legal review is approved", () => {
  const start = source.indexOf('if(m==="POST"&&p==="/internal/superadmin/regional-admin-data")');
  const end = source.indexOf('if(m==="POST"&&p.startsWith("/internal/regional/"))', start);
  assert.ok(start >= 0 && end > start, "country-management bridge route must be registered");
  const route = source.slice(start, end);
  assert.ok(route.includes('legal?.review_status!=="approved"'));
  assert.ok(route.includes("country_legal_approval_required"));
  assert.ok(route.includes("country_payment_approval_required"));
  assert.ok(route.includes('status==="approved"&&!evidence'));
  assert.ok(route.includes('actorRole!=="super_admin"'));
});

test("legal review history is append-only and approved records require evidence", () => {
  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS country_legal_reviews"));
  assert.ok(migration.includes("review_status IN ('pending','approved','rejected')"));
  assert.ok(migration.includes("trg_country_legal_reviews_insert_guard"));
  assert.ok(migration.includes("NEW.review_status = 'approved' AND trim(COALESCE(NEW.evidence_reference,'')) = ''"));
  assert.ok(migration.includes("trg_country_legal_reviews_no_update"));
  assert.ok(migration.includes("trg_country_legal_reviews_no_delete"));
});
