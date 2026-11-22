import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("Editor Portal Staging never writes raw exception objects or messages to logs", () => {
  const rawObject = /console\.(?:log|warn|error|info|debug)\([^;\n]{0,500},\s*(?:e|err|error|mailError|cleanup|logError)\s*\)/;
  const rawMessage = /console\.(?:log|warn|error|info|debug)\([^;\n]{0,500}(?:String\((?:e|err|error|mailError|cleanup|logError)(?:\?\.|\.)|(?:e|err|error|mailError|cleanup|logError)\?\.(?:message|stack))/;
  assert.doesNotMatch(source, rawObject);
  assert.doesNotMatch(source, rawMessage);
});
