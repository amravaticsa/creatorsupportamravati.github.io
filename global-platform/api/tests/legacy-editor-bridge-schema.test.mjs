import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../migrations/0026_legacy_editor_identity_bridge.sql", import.meta.url),
  "utf8"
);

test("legacy editor links use explicit stable IDs and one-to-one constraints", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS legacy_editor_identity_links/);
  assert.match(migration, /editor_user_id TEXT PRIMARY KEY REFERENCES editor_profiles\(user_id\)/);
  assert.match(migration, /legacy_editor_id TEXT NOT NULL UNIQUE/);
  assert.match(migration, /link_status IN \('pending','active','revoked'\)/);
  assert.match(migration, /reviewed_by TEXT REFERENCES users\(id\)/);
});

test("legacy assignment bridge is idempotent and preserves one-to-one order mapping", () => {
  assert.match(migration, /global_assignment_id TEXT PRIMARY KEY REFERENCES assignments\(id\)/);
  assert.match(migration, /legacy_order_id TEXT NOT NULL UNIQUE/);
  assert.match(migration, /legacy_assignment_id TEXT UNIQUE/);
  assert.match(migration, /idempotency_key TEXT NOT NULL UNIQUE/);
  assert.match(migration, /bridge_status IN \('pending','created','failed','revoked'\)/);
});

test("migration does not copy legacy credentials or write to remote systems", () => {
  assert.doesNotMatch(migration, /password_hash|password_salt|INSERT INTO|UPDATE |DELETE FROM|fetch\(/i);
});
