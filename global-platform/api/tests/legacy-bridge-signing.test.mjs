import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const api = await readFile(new URL("../../workers/source-snapshots/csa-global-api-isolated-staging/index.js", import.meta.url), "utf8");
const editor = await readFile(new URL("../../workers/source-snapshots/csa-editor-portal-isolated-staging/worker.js", import.meta.url), "utf8");

function extract(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.notEqual(a, -1, `Missing source start: ${start}`);
  assert.notEqual(b, -1, `Missing source end: ${end}`);
  return source.slice(a, b);
}

function makeContext(extra = {}) {
  const context = vm.createContext({
    crypto: webcrypto,
    TextEncoder,
    URL,
    Date,
    btoa: value => Buffer.from(value, "binary").toString("base64"),
    atob: value => Buffer.from(value, "base64").toString("binary"),
    ...extra
  });
  return context;
}

function makeDb({ tableExists = true } = {}) {
  const used = new Set();
  return {
    used,
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async run() {
          if (!tableExists) throw new Error("no such table: legacy_bridge_nonces");
          if (sql.startsWith("INSERT")) {
            if (used.has(values[0])) throw new Error("UNIQUE constraint failed: legacy_bridge_nonces.nonce");
            used.add(values[0]);
          }
          return { success: true };
        }
      };
    }
  };
}

async function createHarness(db = makeDb()) {
  const apiCode = extract(api, "async function hmacHex(", "function constantTime(") +
    "\\nglobalThis.sign = legacyBridgeHeaders;";
  const editorCode = extract(editor, "const hex=", "const clean=") +
    "\\nglobalThis.verify = verifyLegacyBridgeRequest;";
  const signContext = makeContext();
  const verifyContext = makeContext();
  vm.runInContext(apiCode, signContext);
  vm.runInContext(editorCode, verifyContext);
  return {
    async signedRequest({ secret = "test-only-disposable-secret", env = "staging", method = "POST", path = "/editor-api/internal/legacy-bridge/health", body = JSON.stringify({ purpose: "bridge-readiness" }) } = {}) {
      const headers = await signContext.sign({ ENVIRONMENT: env, CSA_LEGACY_BRIDGE_SECRET: secret }, method, path, body);
      const req = new Request("https://superadmin-editor-staging.creatorsupportamravati.in" + path, { method, headers, body });
      return { req, raw: body, headers, secret };
    },
    async verify(signed, { environment = "staging", secret = signed.secret, database = db } = {}) {
      const env = { ENVIRONMENT: environment, CSA_LEGACY_BRIDGE_SECRET: secret, CSA_VIDEO_DB: database };
      return verifyContext.verify(signed.req, env, signed.raw);
    },
    db
  };
}

test("Global API signer remains staging-only and is not wired to order or identity transfer", () => {
  assert.match(api, /async function legacyBridgeHeaders\(env,method,path,rawBody\)/);
  assert.match(api, /env\.ENVIRONMENT!=="staging"\|\|!env\.CSA_LEGACY_BRIDGE_SECRET/);
  assert.equal(api.split("legacyBridgeHeaders(").length - 1, 1);
});

test("signer and verifier use identical canonical HMAC components", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  const result = await h.verify(signed);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: true });
  assert.equal(h.db.used.size, 1);
});

test("a repeated nonce is rejected as replay (409)", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  assert.equal((await h.verify(signed)).ok, true);
  const replay = await h.verify(signed);
  assert.deepEqual(JSON.parse(JSON.stringify(replay)), { ok: false, status: 409, code: "bridge_nonce_replayed" });
});

test("modified body and wrong signing secret are rejected (401)", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  assert.equal((await h.verify({ ...signed, raw: signed.raw + " " })).code, "bridge_signature_invalid");
  const wrongSecret = await h.verify(signed, { secret: "different-disposable-secret" });
  assert.equal(wrongSecret.code, "bridge_signature_invalid");
});

test("missing nonce table fails closed as unavailable (503)", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  const result = await h.verify(signed, { database: makeDb({ tableExists: false }) });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: false, status: 503, code: "bridge_nonce_store_unavailable" });
});

test("non-staging environments fail closed (503)", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  const result = await h.verify(signed, { environment: "production" });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: false, status: 503, code: "bridge_unavailable" });
});

test("stale timestamps are rejected (401)", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  signed.headers.set("x-csa-bridge-timestamp", "1000000000");
  const result = await h.verify(signed);
  assert.equal(result.code, "bridge_timestamp_invalid");
});
