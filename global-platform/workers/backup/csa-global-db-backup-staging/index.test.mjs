import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./index.js", import.meta.url), "utf8");

test("daily backup maps all ten staging D1 databases", () => {
  const bindings = source.match(/^  [a-z_]+: "DB_[A-Z_]+",$/gm) || [];
  const schedules = source.match(/^  "\d+ 2 \* \* \*": "[a-z_]+",$/gm) || [];
  assert.equal(bindings.length, 10);
  assert.equal(schedules.length, 10);
  const cronMap = schedules;
  assert.deepEqual(cronMap, [
    '  "2 2 * * *": "global",',
    '  "7 2 * * *": "superadmin",',
    '  "12 2 * * *": "superadmin_legacy",',
    '  "17 2 * * *": "global_legacy",',
    '  "22 2 * * *": "video_legacy",',
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
