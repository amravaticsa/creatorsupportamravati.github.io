import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../../../migrations/0027_legacy_bridge_nonces.sql", import.meta.url), "utf8");

test("legacy bridge verifier is staging-only and requires the dedicated secret", () => {
  assert.match(worker, /ENVIRONMENT[^\n]*staging/);
  assert.match(worker, /CSA_LEGACY_BRIDGE_SECRET/);
  assert.match(worker, /verifyLegacyBridgeRequest/);
  assert.match(worker, /x-csa-bridge-timestamp/);
  assert.match(worker, /x-csa-bridge-nonce/);
  assert.match(worker, /x-csa-bridge-signature/);
});

test("signed request binds timestamp, nonce, method, path, and body digest", () => {
  assert.match(worker, /Math\.abs\(Math\.floor\(Date\.now\(\)\/1000\)-Number\(timestamp\)\)>300/);
  assert.match(worker, /const path=new URL\(req\.url\)\.pathname,bodyHash=await sha\(rawBody\)/);
  assert.match(worker, /req\.method\.toUpperCase\(\),path,bodyHash/);
  assert.match(worker, /crypto\.subtle\.importKey\("raw".*HMAC/s);
  assert.match(worker, /safeEq\(signature,expected\)/);
});

test("bridge probe is restricted to the admin staging host and exact POST path", () => {
  assert.match(worker, /p==="\/editor-api\/internal\/legacy-bridge\/health"/);
  assert.match(worker, /req\.method!=="POST"/);
  assert.match(worker, /!isPortalHost\(host,"admin",env\)/);
  assert.match(worker, /payload\.purpose!=="bridge-readiness"/);
});

test("nonce table enforces one-time replay protection with expiry index", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS legacy_bridge_nonces/);
  assert.match(migration, /nonce TEXT PRIMARY KEY/);
  assert.match(migration, /expires_at INTEGER NOT NULL/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_legacy_bridge_nonces_expiry/);
  assert.doesNotMatch(migration, /password_hash|password_salt|INSERT INTO|UPDATE |DELETE FROM/i);
});
