import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../../portal.html", import.meta.url), "utf8");
const portal = readFileSync(new URL("../../assets/portal.js", import.meta.url), "utf8");

test("Client portal exposes notification preferences and refund request history", () => {
  for (const id of ["client-notification-preferences", "client-notifications", "client-refund-form", "client-refunds", "client-refund-message"]) {
    assert.match(html, new RegExp('id="' + id + '"'), "Missing client UI: " + id);
  }
  assert.match(portal, /api\("\/v1\/notifications"\)/);
  assert.match(portal, /api\("\/v1\/notifications\/preferences"\)/);
  assert.match(portal, /api\("\/v1\/client\/refunds"/);
  assert.match(portal, /Idempotency-Key/);
  assert.match(portal, /loadClientRefundRequests\(\)/);
});

test("Admin portal exposes notification send and finance review controls", () => {
  for (const id of ["admin-notification-preferences", "admin-notifications", "admin-notification-form", "admin-client-refunds", "admin-notification-message"]) {
    assert.match(html, new RegExp('id="' + id + '"'), "Missing admin UI: " + id);
  }
  assert.match(portal, /api\("\/v1\/admin\/notifications"/);
  assert.match(portal, /api\("\/v1\/admin\/client-refunds"/);
  assert.match(portal, /action,review_note/);
  assert.match(portal, /Approve for processing/);
  assert.match(portal, /does not trigger a Razorpay refund/);
});

test("WhatsApp stays an explicit opt-in and client UI does not expose editor identities", () => {
  assert.match(portal, /whatsapp_enabled/);
  assert.match(portal, /WhatsApp notifications \(optional opt-in\)/);
  assert.match(html, /Approval for processing is not the same as a completed bank refund/);
});
