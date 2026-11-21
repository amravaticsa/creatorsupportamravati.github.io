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
  assert.match(html, /does not trigger a Razorpay refund/);
});

test("WhatsApp stays an explicit opt-in and client UI does not expose editor identities", () => {
  assert.match(portal, /whatsapp_enabled/);
  assert.match(portal, /WhatsApp notifications \(optional opt-in\)/);
  assert.match(html, /Approval for processing is not the same as a completed bank refund/);
});




const api = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("Client showcase is restricted to approved samples from verified editors and KYC", () => {
  assert.match(api, /SELECT v\.id,v\.title,v\.description,v\.category,v\.mime_type FROM editor_portfolio_videos/);
  assert.match(api, /v\.review_status='approved' AND v\.client_visible=1 AND e\.verification_status='verified' AND u\.account_status='active'/);
  assert.match(api, /k\.editor_id=v\.editor_id AND k\.status='verified'/);
  assert.doesNotMatch(api, /SELECT v\.id,v\.editor_id,v\.title,v\.description,v\.category,v\.mime_type FROM editor_portfolio_videos/);
});

test("Client deliverables and downloads are gated by QC approval", () => {
  assert.match(api, /const deliver=p\.match/);
  assert.match(api, /WHERE x\.project_id=\? AND s\.qc_status='approved'/);
  assert.match(api, /if\(a\.role==="client"&&file\.kind==="submission"\)allowed=allowed&&file\.qc_status==="approved"/);
});

test("Tender lifecycle requires draft, publish, close, award and configured CSA markup", () => {
  assert.match(api, /const tenderDraft=p\.match/);
  assert.match(api, /if\(action==="publish"\)\{if\(t\.status!=="draft"/);
  assert.match(api, /if\(action==="close"\)\{if\(t\.status!=="published"/);
  assert.match(api, /if\(action==="award"\)\{/);
  assert.match(api, /if\(action==="quote"\)\{/);
  assert.match(api, /pricing_policy_unconfigured/);
  assert.match(api, /minimum_margin_minor/);
});

test("Assignment is gated by verified editor deposit", () => {
  assert.match(api, /o\.status!=="ready_for_assignment"/);
  assert.match(api, /INSERT INTO assignments/);
  assert.match(api, /payment\.status!=="captured"/);
  assert.match(api, /SET status='ready_for_assignment' WHERE id=\?/);
});

test("Editor submission enters QC and approved QC moves project to client review", () => {
  assert.match(api, /INSERT INTO work_submissions\(id,assignment_id,submitted_by,r2_object_key,version_number,notes,qc_status/);
  assert.match(api, /'pending',?,?,\?/);
  assert.match(api, /SET status='quality_check'/);
  assert.match(api, /status==="approved"\?"client_review"/);
  assert.match(api, /status==="approved"\?"reviewing"/);
});

test("Client project budget recommendation can be submitted without an amount", () => {
  assert.match(html, /name="budget" type="number" min="1" step="0\.01" placeholder="Enter your maximum or estimated budget"/);
  assert.match(html, /Optional when you select Recommend a budget/);
  assert.match(portal, /budgetType\?\.addEventListener\("change",syncProjectBudgetRequirement\)/);
  assert.match(portal, /budgetInput\.required=!recommended/);
  assert.match(portal, /budgetText\?Math\.round\(Number\(budgetText\)\*100\):null/);
  assert.match(api, /const recommendBudget=b\.budget_type==="recommend"/);
  assert.match(api, /\(!budget&&!recommendBudget\)/);
});
