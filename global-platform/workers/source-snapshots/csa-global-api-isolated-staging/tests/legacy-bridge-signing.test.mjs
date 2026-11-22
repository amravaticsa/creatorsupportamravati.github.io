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
  assert.doesNotMatch(api, /legacyBridgeHeaders\(env/);
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
