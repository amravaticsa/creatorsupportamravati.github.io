import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const api = await readFile(new URL("../../workers/source-snapshots/csa-global-api-isolated-staging/index.js", import.meta.url), "utf8");
const editor = await readFile(new URL("../../workers/source-snapshots/csa-editor-portal-isolated-staging/worker.js", import.meta.url), "utf8");
const superAdmin = await readFile(new URL("../../workers/source-snapshots/csa-superadmin-isolated-staging/worker.js", import.meta.url), "utf8");
const superAdminBridge = await readFile(new URL("../../workers/source-snapshots/csa-superadmin-isolated-staging/global-admin-sync.js", import.meta.url), "utf8");
const superAdminDashboard = await readFile(new URL("../../workers/source-snapshots/csa-superadmin-isolated-staging/admin-dashboard.js", import.meta.url), "utf8");
const superAdminApp = await readFile(new URL("../../workers/source-snapshots/csa-superadmin-isolated-staging/admin-app-source.js", import.meta.url), "utf8");

function extract(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.notEqual(a, -1, `Missing source start: ${start}`);
  assert.notEqual(b, -1, `Missing source end: ${end}`);
  return source.slice(a, b);
}

function makeContext(extra = {}) {
  return vm.createContext({
    crypto: webcrypto,
    TextEncoder,
    URL,
    Date,
    btoa: value => Buffer.from(value, "binary").toString("base64"),
    atob: value => Buffer.from(value, "base64").toString("binary"),
    ...extra
  });
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
    "\n" + extract(api, "async function callLegacyAssignmentBridge(", "async function log(") +
    "\nglobalThis.sign = callLegacyAssignmentBridge;";
  const editorCode = "const enc = new TextEncoder();\n" + extract(editor, "const hex=", "const clean=") +
    "\nglobalThis.verify = verifyLegacyBridgeRequest;";
  const captured = [];
  const signContext = makeContext({
    fetch: async (url, init) => {
      captured.push({ url, init });
      return { ok: true, json: async () => ({ ok: true }) };
    }
  });
  const verifyContext = makeContext();
  vm.runInContext(apiCode, signContext);
  vm.runInContext(editorCode, verifyContext);
  return {
    async signedRequest({ secret = "test-only-disposable-secret", environment = "staging", body = JSON.stringify({ purpose: "validate-link", kind: "editor", legacy_editor_id: "probe_editor_001" }) } = {}) {
      await signContext.sign({
        ENVIRONMENT: environment,
        CSA_LEGACY_BRIDGE_SECRET: secret,
        CF_ACCESS_CLIENT_ID: "test-access-client-id",
        CF_ACCESS_CLIENT_SECRET: "test-access-client-secret"
      }, { purpose: "validate-link", kind: "editor", legacy_editor_id: "probe_editor_001" });
      const call = captured.pop();
      assert.ok(call, "legacy bridge signer must issue the peer request");
      assert.equal(call.init.body, body, "test body must match the signed body");
      const req = new Request(call.url, { method: call.init.method, headers: call.init.headers, body: call.init.body });
      return { req, raw: call.init.body, headers: call.init.headers, secret };
    },
    async verify(signed, { environment = "staging", secret = signed.secret, database = db } = {}) {
      const env = { ENVIRONMENT: environment, CSA_LEGACY_BRIDGE_SECRET: secret, CSA_VIDEO_DB: database };
      return verifyContext.verify(signed.req, env, signed.raw);
    },
    db
  };
}

test("Legacy assignment bridge signer is staging-only and does not write Global identity or order data", () => {
  const helper = extract(api, "async function callLegacyAssignmentBridge(", "async function log(");
  assert.ok(helper.includes('env.ENVIRONMENT!=="staging"'));
  assert.ok(helper.includes("CSA_LEGACY_BRIDGE_SECRET"));
  assert.ok(helper.includes("CF_ACCESS_CLIENT_ID"));
  assert.ok(helper.includes("CF_ACCESS_CLIENT_SECRET"));
  assert.ok(helper.includes("x-csa-bridge-signature"));
  assert.doesNotMatch(helper, /INSERT INTO (?:legacy_editor_identity_links|video_editing_orders|assignments)/);
});

test("legacy bridge signer and Editor verifier use identical canonical HMAC components", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  const result = await h.verify(signed);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: true });
  assert.equal(h.db.used.size, 1);
  assert.equal(new URL(signed.req.url).hostname, "superadmin-editor-staging.creatorsupportamravati.in");
});

test("a repeated legacy bridge nonce is rejected as replay (409)", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  assert.equal((await h.verify(signed)).ok, true);
  const replay = await h.verify(signed);
  assert.deepEqual(JSON.parse(JSON.stringify(replay)), { ok: false, status: 409, code: "bridge_nonce_replayed" });
});

test("modified body and wrong legacy bridge secret are rejected (401)", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  assert.equal((await h.verify({ ...signed, raw: signed.raw + " " })).code, "bridge_signature_invalid");
  const wrongSecret = await h.verify(signed, { secret: "different-disposable-secret" });
  assert.equal(wrongSecret.code, "bridge_signature_invalid");
});

test("missing legacy nonce table fails closed as unavailable (503)", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  const result = await h.verify(signed, { database: makeDb({ tableExists: false }) });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: false, status: 503, code: "bridge_nonce_store_unavailable" });
});

test("non-staging legacy bridge environments fail closed (503)", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  const result = await h.verify(signed, { environment: "production" });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: false, status: 503, code: "bridge_unavailable" });
});

test("stale legacy bridge timestamps are rejected (401)", async () => {
  const h = await createHarness();
  const signed = await h.signedRequest();
  const headers = new Headers(signed.req.headers);
  headers.set("x-csa-bridge-timestamp", "1000000000");
  const stale = { ...signed, req: new Request(signed.req.url, { method: "POST", headers, body: signed.raw }) };
  const result = await h.verify(stale);
  assert.equal(result.code, "bridge_timestamp_invalid");
});

test("Super Admin legacy-links endpoint is staging-only, HMAC-authenticated, replay-protected and Super Admin allowlisted", () => {
  const start = api.indexOf('if(m==="POST"&&p==="/internal/superadmin/legacy-links"){');
  const end = api.indexOf('if(m==="POST"&&p==="/internal/superadmin/pricing-policy"){', start);
  const route = api.slice(start, end);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.ok(route.includes('env.ENVIRONMENT!=="staging"'));
  assert.ok(route.includes("GLOBAL_API_SYNC_HMAC_SECRET||env.ADMIN_SYNC_HMAC_SECRET"));
  assert.ok(route.includes("admin_sync_nonces"));
  assert.ok(route.includes("constantTime(expected,sig)"));
  assert.ok(route.includes('actorRole!=="super_admin"'));
  assert.ok(route.includes("allow.includes(actorEmail)"));
  assert.ok(route.includes('b.action==="test_bridge"'));
  assert.ok(route.includes("callLegacyAssignmentBridge"));
});

test("Super Admin legacy-link test action is Super Admin-only and staging-only", () => {
  const route = superAdmin.slice(superAdmin.indexOf('if(p==="/api/legacy-links"&&req.method==="POST"){'), superAdmin.indexOf('if(p==="/api/finance/refund-action"&&req.method==="POST"){'));
  assert.ok(route.includes('u.role!=="super_admin"'));
  assert.ok(route.includes('["link_editor","claim_order","test_bridge"]'));
  assert.ok(route.includes("callGlobalLegacyLinks"));
  const helper = superAdminBridge.slice(superAdminBridge.indexOf("export async function callGlobalLegacyLinks"));
  assert.ok(helper.includes('env.ENVIRONMENT!=="staging"'));
});

test("Super Admin legacy-link bridge signs the isolated legacy API request", () => {
  const helper = superAdminBridge.slice(superAdminBridge.indexOf("export async function callGlobalLegacyLinks"));
  assert.ok(helper.includes("GLOBAL_API_SYNC_HMAC_SECRET"));
  assert.ok(helper.includes('["POST",path,timestamp,nonce,await sha256Hex(body)].join("\\n")'));
  assert.ok(helper.includes("/internal/superadmin/legacy-links"));
  assert.ok(helper.includes("csa-global-api-isolated-staging.creatorsupportamravati.workers.dev"));
});

test("Legacy Editor peer request carries path-scoped Cloudflare Access service credentials", () => {
  const helper = extract(api, "async function callLegacyAssignmentBridge(", "async function log(");
  assert.ok(helper.includes("CF-Access-Client-Id"));
  assert.ok(helper.includes("CF-Access-Client-Secret"));
  assert.ok(helper.includes("CF_ACCESS_CLIENT_ID"));
  assert.ok(helper.includes("CF_ACCESS_CLIENT_SECRET"));
  assert.ok(helper.includes("CSA_LEGACY_BRIDGE_SECRET"));
  assert.ok(helper.includes("superadmin-editor-staging.creatorsupportamravati.in"));
});

test("Super Admin dashboard exposes the guarded legacy-link bridge test action", () => {
  assert.ok(superAdminDashboard.includes("testLegacyBridge()"));
  assert.ok(superAdminDashboard.includes("legacyLinks"));
  assert.ok(superAdminApp.includes("function testLegacyBridge()"));
  assert.ok(superAdminApp.includes("legacy-links"));
});
