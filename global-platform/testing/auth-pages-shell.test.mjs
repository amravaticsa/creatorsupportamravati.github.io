import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pages = [
  "login.html",
  "admin-login.html",
  "editor-login.html",
  "editor-register.html",
];

for (const page of pages) {
  test(`${page} stays a plain authentication page without shared header/footer navigation`, () => {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
    assert.doesNotMatch(html, /<header\\b/i);
    assert.doesNotMatch(html, /<footer\\b/i);
    assert.doesNotMatch(html, /<nav\\b/i);
    assert.doesNotMatch(html, /class=["']top["']/i);
    assert.match(html, /Platform Home/);
  });
}
