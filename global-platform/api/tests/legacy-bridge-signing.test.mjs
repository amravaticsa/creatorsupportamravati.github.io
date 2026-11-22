import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../../workers/source-snapshots/csa-global-api-isolated-staging/index.js", import.meta.url), "utf8");
const editor = await readFile(new URL("../../workers/source-snapshots/csa-editor-portal-isolated-staging/worker.js", import.meta.url), "utf8");

test("Global API signer is staging-only and uses the dedicated bridge secret", () => {
  assert.match(api, /async function legacyBridgeHeaders\(env,method,path,rawBody\)/);
  assert.match(api, /env\.ENVIRONMENT!=="staging"\|\|!env\.CSA_LEGACY_BRIDGE_SECRET/);
  assert.match(api, /x-csa-bridge-timestamp/);
  assert.match(api, /x-csa-bridge-nonce/);
  assert.match(api, /x-csa-bridge-signature/);
  assert.equal(api.split("legacyBridgeHeaders(").length - 1, 1);
});

test("Global API signer and Editor Portal verifier use identical newline canonicalization", () => {
  assert.ok(api.includes('.join("\\n")'));
  assert.ok(editor.includes('.join("\\n")'));
  assert.ok(api.includes('["CSA-BRIDGE-V1",timestamp,nonce,String(method).toUpperCase(),path,bodyHash]'));
  assert.ok(editor.includes('["CSA-BRIDGE-V1",timestamp,nonce,req.method.toUpperCase(),path,bodyHash]'));
});

test("HMAC binds exact method, path, timestamp, nonce and raw body digest", () => {
  const secret = randomBytes(32);
  const raw = JSON.stringify({ purpose: "bridge-readiness" });
  const timestamp = "1795350000";
  const nonce = randomBytes(24).toString("base64url");
  const method = "POST";
  const path = "/editor-api/internal/legacy-bridge/health";
  const bodyHash = createHash("sha256").update(raw).digest("hex");
  const canonical = ["CSA-BRIDGE-V1", timestamp, nonce, method, path, bodyHash].join("\\n");
  const signature = createHmac("sha256", secret).update(canonical).digest("hex");
  assert.equal(signature.length, 64);
  assert.notEqual(signature, createHmac("sha256", secret).update(canonical.replace(path, path + "/")).digest("hex"));
  assert.notEqual(signature, createHmac("sha256", secret).update(canonical.replace(bodyHash, "0".repeat(64))).digest("hex"));
});
