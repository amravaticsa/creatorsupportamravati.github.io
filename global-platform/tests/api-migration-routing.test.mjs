import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const configSource = await readFile(new URL("../assets/api-config.js", import.meta.url), "utf8");
const context = { window: {} };
vm.runInNewContext(configSource, context);
const config = context.window.CSA_GLOBAL_API_CONFIG;

test("staging API router stays on legacy until migration gates are cleared", () => {
  assert.equal(config.mode, "legacy");
  assert.equal(config.activeBaseUrl, config.legacyBaseUrl);
  assert.equal(config.isolatedTrafficEnabled, false);
  assert.equal(config.rollbackBaseUrl, config.legacyBaseUrl);
  assert.match(config.migrationGate, /BLOCKED/);
});

test("isolated API endpoint is registered for controlled future cutover", () => {
  assert.equal(config.isolatedBaseUrl, "https://csa-global-api-isolated-staging.creatorsupportamravati.workers.dev");
  assert.notEqual(config.isolatedBaseUrl, config.legacyBaseUrl);
});

test("API routing configuration cannot be modified at runtime", () => {
  assert.equal(Object.isFrozen(config), true);
  assert.throws(() => { config.activeBaseUrl = config.isolatedBaseUrl; });
});
