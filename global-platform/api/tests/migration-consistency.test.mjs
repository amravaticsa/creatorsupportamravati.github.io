import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Keep migration validation runnable from the API test suite directory.
// The workflow validates isolated snapshots without applying database migrations.

const dir = new URL("../../migrations/", import.meta.url);
const names = (await readdir(dir)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
assert.ok(names.length > 0, "No numbered SQL migrations found");

const versions = names.map((name) => Number(name.slice(0, 4)));
assert.equal(new Set(versions).size, versions.length, "Duplicate migration version found");
const reservedGaps = new Set([30]);
const gapDocumentation = await readFile(new URL("../../migrations/MIGRATION-NUMBER-GAPS.md", import.meta.url), "utf8");
assert.ok(gapDocumentation.includes("0030") && gapDocumentation.toLowerCase().includes("reserved"), "Reserved migration gaps must be documented");
for (let version = 1; version <= Math.max(...versions); version++) {
  if (reservedGaps.has(version)) {
    assert.ok(!versions.includes(version), "Reserved migration number must not be backfilled retroactively");
    continue;
  }
  assert.ok(versions.includes(version), "Migration sequence gap at " + String(version).padStart(4, "0"));
}

const sql = new Map();
for (const name of names) sql.set(name, await readFile(new URL(name, dir), "utf8"));

const pricing = [...sql.entries()].find(([name]) => name.startsWith("0023_"))?.[1] ?? "";
const quotePayments = [...sql.entries()].find(([name]) => name.startsWith("0024_"))?.[1] ?? "";
const notificationRefunds = [...sql.entries()].find(([name]) => name.startsWith("0025_"))?.[1] ?? "";

assert.match(pricing, /CREATE TABLE IF NOT EXISTS csa_pricing_policies[\s\S]*?client_advance_bps INTEGER/,
  "0023 must define the client advance percentage");
assert.doesNotMatch(quotePayments, /ALTER TABLE\s+csa_pricing_policies\s+ADD COLUMN\s+client_advance_bps/i,
  "0024 must not add client_advance_bps a second time");
assert.match(quotePayments, /ALTER TABLE\s+client_quotes\s+ADD COLUMN\s+payment_status/i,
  "0024 must add quote payment status");
assert.match(quotePayments, /ALTER TABLE\s+payments\s+ADD COLUMN\s+quote_id/i,
  "0024 must link payments to quotes");
for (const table of ["notifications", "notification_preferences", "notification_delivery_attempts", "client_refund_requests"]) {
  assert.match(notificationRefunds, new RegExp("CREATE TABLE IF NOT EXISTS " + table + "\\s*\\("),
    "0025 must create " + table + " idempotently");
}
assert.match(notificationRefunds, /whatsapp_enabled INTEGER NOT NULL DEFAULT 0/,
  "WhatsApp must remain opt-in by default");

console.log("Validated " + names.length + " ordered migrations and critical 0023–0025 schema invariants.");
