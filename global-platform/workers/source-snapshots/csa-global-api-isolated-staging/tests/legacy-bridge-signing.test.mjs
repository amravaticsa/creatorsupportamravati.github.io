import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../index.js", import.meta.url), "utf8");

test("legacy-links endpoint is staging-only, HMAC-authenticated and Super Admin allowlisted", () => {
  const start = api.indexOf('if(m==="POST"&&p==="/internal/superadmin/legacy-links"){');
  const end = api.indexOf('if(m==="POST"&&p==="/internal/superadmin/pricing-policy"){', start);
  assert.ok(start >= 0 && end > start, "legacy-links route must be registered");
  const route = api.slice(start, end);
  assert.match(route, /env\.ENVIRONMENT!==\"staging\"/);
  assert.match(route, /GLOBAL_API_SYNC_HMAC_SECRET\|\|env\.ADMIN_SYNC_HMAC_SECRET/);
  assert.match(route, /x-csa-sync-timestamp/);
  assert.match(route, /x-csa-sync-nonce/);
  assert.match(route, /x-csa-sync-signature/);
  assert.match(route, /admin_sync_nonces/);
  assert.match(route, /constantTime\(expected,sig\)/);
  assert.match(route, /actorRole!==\"super_admin\"/);
  assert.match(route, /allow\.includes\(actorEmail\)/);
});

test("legacy-links HMAC binds method, path, timestamp, nonce and exact raw body", () => {
  const secret = randomBytes(32);
  const raw = JSON.stringify({ action: "test_bridge", actor_role: "super_admin" });
  const timestamp = "1795350000";
  const nonce = randomBytes(24).toString("hex");
  const path = "/internal/superadmin/legacy-links";
  const bodyHash = createHash("sha256").update(raw).digest("hex");
  const canonical = ["POST", path, timestamp, nonce, bodyHash].join("\n");
  const signature = createHmac("sha256", secret).update(canonical).digest("hex");
  assert.equal(signature.length, 64);
  assert.notEqual(signature, createHmac("sha256", secret).update(canonical.replace(path, path + "/")).digest("hex"));
  assert.notEqual(signature, createHmac("sha256", secret).update(canonical.replace(bodyHash, bodyHash + "0")).digest("hex"));
});

test("legacy-links test_bridge is a non-mutating health probe", () => {
  const start = api.indexOf('if(b.action==="test_bridge"){');
  const end = api.indexOf('if(b.action==="list"){', start);
  assert.ok(start >= 0 && end > start);
  const probe = api.slice(start, end);
  assert.match(probe, /purpose:\"validate-link\"/);
  assert.match(probe, /callLegacyAssignmentBridge/);
  assert.match(probe, /legacy_editor_not_active/);
  assert.doesNotMatch(probe, /INSERT INTO legacy_editor_identity_links|INSERT INTO legacy_video_order_claims|UPDATE legacy_editor_identity_links/);
});

test("legacy Editor peer request is staging-only and uses Cloudflare Access plus a separate peer HMAC", () => {
  const start = api.indexOf("async function callLegacyAssignmentBridge(");
  const end = api.indexOf("async function log(", start);
  assert.ok(start >= 0 && end > start);
  const helper = api.slice(start, end);
  assert.match(helper, /env\.ENVIRONMENT!==\"staging\"/);
  assert.match(helper, /env\.CSA_LEGACY_BRIDGE_SECRET/);
  assert.match(helper, /env\.CF_ACCESS_CLIENT_ID/);
  assert.match(helper, /env\.CF_ACCESS_CLIENT_SECRET/);
  assert.match(helper, /CSA-BRIDGE-V1/);
  assert.match(helper, /CF-Access-Client-Id/);
  assert.match(helper, /CF-Access-Client-Secret/);
  assert.match(helper, /https:\/\/superadmin-editor-staging\.creatorsupportamravati\.in/);
});
