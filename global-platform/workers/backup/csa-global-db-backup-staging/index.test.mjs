import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./index.js", import.meta.url), "utf8");

test("daily backup maps all ten staging D1 databases", () => {
  const bindings = source.match(/^  [a-z_]+: \{ binding: "DB_[A-Z_]+", database_id: "[0-9a-f-]{36}" \},$/gm) || [];
  const schedules = source.match(/^  "\d+ 2 \* \* \*": "[a-z_]+",$/gm) || [];
  assert.equal(bindings.length, 10);
  assert.equal(schedules.length, 10);
  const cronMap = schedules;
  assert.deepEqual(cronMap, [
    '  "2 2 * * *": "global",',
    '  "7 2 * * *": "superadmin",',
    '  "12 2 * * *": "superadmin_legacy",',
    '  "17 2 * * *": "global_legacy",',
    '  "22 2 * * *": "video_isolated",',
    '  "27 2 * * *": "global_video_legacy",',
    '  "32 2 * * *": "editor_superadmin",',
    '  "37 2 * * *": "video_workflow",',
    '  "42 2 * * *": "rush",',
    '  "47 2 * * *": "rush_isolated",',
  ]);
  assert.doesNotMatch(source, /"\* \* \* \* \*"/);
  assert.doesNotMatch(source, /"\*\/5 \* \* \* \*"/);
});

test("logical backup captures triggers and records foreign-key violations", () => {
  assert.match(source, /type IN \('table','view','index','trigger'\)/);
  assert.match(source, /PRAGMA foreign_key_check/);
  assert.match(source, /foreign_key_violations/);
  assert.match(source, /triggers,/);
});


test("each uploaded gzip backup is read back, decompressed and verified", () => {
  assert.match(source, /async function verifyStoredBackup/);
  assert.match(source, /await bucket\.get\(key\)/);
  assert.match(source, /new DecompressionStream\("gzip"\)/);
  assert.match(source, /backup_object_content_verification_failed/);
  assert.match(source, /\.verification\.json/);
  assert.match(source, /verification_status: verification\.status/);
});


test("backup manifest is written only after successful R2 readback verification", () => {
  const verificationCall = source.indexOf("const verification = await verifyStoredBackup");
  const manifestWrite = source.indexOf(".manifest.json");
  assert.ok(verificationCall >= 0 && manifestWrite > verificationCall);
  assert.match(source, /verification_status: verification\.status/);
});


test("isolated and main staging Global backups use their semantic D1 bindings", () => {
  const databaseMap = source.slice(source.indexOf("const DATABASES"), source.indexOf("const CRON_TO_DATABASE"));
  const entries = [...databaseMap.matchAll(/^  ([a-z_]+): \{ binding: "(DB_[A-Z_]+)", database_id: "([0-9a-f-]{36})" \},$/gm)];
  assert.equal(entries.length, 10);
  const map = Object.fromEntries(entries.map(([, name, binding, id]) => [name, { binding, id }]));
  assert.deepEqual(map.global, { binding: "DB_GLOBAL", id: "6a32dda3-b8c5-413c-9f51-58f0a9fa0712" });
  assert.deepEqual(map.global_legacy, { binding: "DB_GLOBAL_LEGACY", id: "470a81b8-3d36-4e2d-942c-5cbb2746a473" });
  assert.match(source, /database_id: databaseId/);
  assert.match(source, /payload.database_id !== expected.database_id/);
  assert.match(source, /v_tender_country_scope/);
  assert.match(source, /isolated_global_d1_binding_mismatch/);
  assert.match(source, /main_global_d1_binding_mismatch/);
});
