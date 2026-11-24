import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./index.js", import.meta.url), "utf8");

test("daily backup maps all ten staging D1 databases", () => {
  const bindings = source.match(/^  [a-z_]+: "DB_[A-Z_]+",$/gm) || [];
  const schedules = source.match(/^  "\\d+ 2 \\* \\* \\*": "[a-z_]+",$/gm) || [];
  assert.equal(bindings.length, 10);
  assert.equal(schedules.length, 10);
  assert.doesNotMatch(source, /"\\* \\* \\* \\* \\*"/);
  assert.doesNotMatch(source, /"\\*\\/5 \\* \\* \\* \\*"/);
});

test("logical backup captures triggers and records foreign-key violations", () => {
  assert.match(source, /type IN \\('table','view','index','trigger'\\)/);
  assert.match(source, /PRAGMA foreign_key_check/);
  assert.match(source, /foreign_key_violations/);
  assert.match(source, /triggers,/);
});
