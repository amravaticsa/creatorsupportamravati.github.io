import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash, randomBytes } from "node:crypto";

const api = await (await import("node:fs/promises")).readFile(
  new URL("../index.js", import.meta.url), "utf8"
);
const editor = await (await import("node:fs/promises")).readFile(
  new URL("../../csa-editor-portal-isolated-staging/worker.js", import.meta.url), "utf8"
);

test("Global API signer is staging-only and uses the dedicated bridge secret", () => {
  assert.match(api, /async function legacyBridgeHeaders\(env,method,path,rawBody\)/);
  assert.match(api, /env\.ENVIRONMENT!=="staging"\|\|!env\.CSA_LEGACY_BRIDGE_SECRET/);
  assert.match(api, /x-csa-bridge-timestamp/);
  assert.match(api, /x-csa-bridge-nonce/);
  assert.match(api, /x-csa-bridge-signature/);
  const readinessStart = api.indexOf('if(m==="POST"&&p==="/internal/superadmin/legacy-bridge/readiness")');
  const readinessEnd = api.indexOf('if(m==="POST"&&p==="/internal/superadmin/pricing-policy")', readinessStart);
  assert.ok(readinessStart >= 0 && readinessEnd > readinessStart, "readiness route must be registered");
  const readinessRoute = api.slice(readinessStart, readinessEnd);
  assert.match(readinessRoute, /legacyBridgeHeaders\(env,"POST",bridgePath,bridgeBody\)/);
  assert.equal((api.match(/legacyBridgeHeaders\(env/g) || []).length, 1, "the signer may only be called by the fixed readiness route");
});

test("Global API signer and Editor Portal verifier use the same canonical format", () => {
  assert.match(api, /\["CSA-BRIDGE-V1",timestamp,nonce,String\(method\)\.toUpperCase\(\),path,bodyHash\]\.join\("\\\\n"\)/);
  assert.match(editor, /\["CSA-BRIDGE-V1",timestamp,nonce,req\.method\.toUpperCase\(\),path,bodyHash\]\.join\("\\n"\)/);
});

test("canonical HMAC binds exact method, path, timestamp, nonce and raw body", () => {
  const secret = randomBytes(32);
  const raw = JSON.stringify({ purpose: "bridge-readiness" });
  const timestamp = "1795350000";
  const nonce = randomBytes(24).toString("base64url");
  const method = "POST";
  const path = "/editor-api/internal/legacy-bridge/health";
  const bodyHash = createHash("sha256").update(raw).digest("hex");
  const canonical = ["CSA-BRIDGE-V1", timestamp, nonce, method, path, bodyHash].join("\n");
  const signature = createHmac("sha256", secret).update(canonical).digest("hex");
  assert.equal(signature.length, 64);
  assert.notEqual(signature, createHmac("sha256", secret).update(canonical.replace(path, path + "/")).digest("hex"));
  assert.notEqual(signature, createHmac("sha256", secret).update(canonical.replace(raw, raw + " ")).digest("hex"));
});

test("readiness endpoint is staging-only, HMAC-authenticated, Access-scoped and health-only", () => {
  const start = api.indexOf('if(m==="POST"&&p==="/internal/superadmin/legacy-bridge/readiness")');
  const end = api.indexOf('if(m==="POST"&&p==="/internal/superadmin/pricing-policy")', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.match(route, /env\.ENVIRONMENT!=="staging"/);
  assert.match(route, /env\.ADMIN_SYNC_HMAC_SECRET/);
  assert.match(route, /env\.CSA_LEGACY_BRIDGE_SECRET/);
  assert.match(route, /env\.CF_ACCESS_CLIENT_ID/);
  assert.match(route, /env\.CF_ACCESS_CLIENT_SECRET/);
  assert.match(route, /payload\?\.purpose!=="bridge-readiness"/);
  assert.match(route, /admin_sync_nonces/);
  assert.match(route, /https:\/\/superadmin-editor-staging\.creatorsupportamravati\.in/);
  assert.match(route, /CF-Access-Client-Id/);
  assert.match(route, /CF-Access-Client-Secret/);
  assert.doesNotMatch(route, /video_editing_orders|video_editing_assignments|legacy_editor_identity_links|legacy_assignment_links/);
});
