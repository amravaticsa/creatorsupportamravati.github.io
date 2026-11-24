import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workerSource = readFileSync(
  new URL("../worker.js", import.meta.url),
  "utf8",
);

test("country verification and assignment route through the isolated Global API D1 alias", () => {
  assert.match(workerSource, /env\.GLOBAL_API_DB\|\|env\.CANONICAL_GLOBAL_DB/);
  assert.match(workerSource, /const target=env\.GLOBAL_API_DB\|\|env\.CANONICAL_GLOBAL_DB/);
  assert.doesNotMatch(workerSource, /env\.GLOBAL_DB/);
  assert.match(workerSource, /country_legal_reviews/);
  assert.match(workerSource, /country_legal_evidence/);
  assert.match(workerSource, /isolated_global_db_binding_mismatch/);
});

test("country legal review replication is idempotent and respects immutable target rows", () => {
  assert.match(workerSource, /ON CONFLICT\(id\) DO NOTHING/);
  assert.doesNotMatch(workerSource, /ON CONFLICT\(id\) DO UPDATE SET review_status=excluded\.review_status/);
});
