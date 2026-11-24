import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../../.github/workflows/deploy-csa-staging.yml", import.meta.url), "utf8");

test("staging deployment fails closed when a non-test Razorpay key is configured", () => {
  const guard = workflow.indexOf('if (health.razorpay_mode === "blocked_non_test_key")');
  assert.ok(guard >= 0);
  const end = workflow.indexOf("\n            }", guard);
  assert.ok(end > guard);
  const block = workflow.slice(guard, end);
  assert.match(block, /process\.exit\(1\)/);
  assert.doesNotMatch(block, /console\.warn/);
});
