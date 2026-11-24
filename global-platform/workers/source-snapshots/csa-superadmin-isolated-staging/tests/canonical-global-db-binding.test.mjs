import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workerSource = readFileSync(
  new URL("../worker.js", import.meta.url),
  "utf8",
);

test("country verification and assignment use the explicit canonical Global D1 binding", () => {
  assert.equal((workerSource.match(/env\.CANONICAL_GLOBAL_DB/g) || []).length, 9);
  assert.equal((workerSource.match(/env\.GLOBAL_DB/g) || []).length, 0);
});
