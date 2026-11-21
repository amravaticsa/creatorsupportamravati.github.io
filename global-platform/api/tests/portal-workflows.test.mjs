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

test("Client showcase exposes only approved samples from fully verified editors", () => {
  const start = api.indexOf('const rows=await env.DB.prepare("SELECT v.id,v.title,v.description,v.category,v.mime_type FROM editor_portfolio_videos');
  const end = api.indexOf("const clientPortfolioStream=", start);
  assert.notEqual(start, -1, "Missing client showcase query");
  assert.ok(end > start, "Missing client showcase stream route");
  const route = api.slice(start, end);
  assert.match(route, /v\.review_status='approved'/);
  assert.match(route, /v\.client_visible=1/);
  assert.match(route, /e\.verification_status='verified'/);
  assert.match(route, /u\.account_status='active'/);
  assert.match(route, /k\.status='verified'/);
  assert.match(route, /SELECT v\.id,v\.title,v\.description,v\.category,v\.mime_type FROM/);
  assert.doesNotMatch(route, /SELECT v\.id,v\.editor_id|SELECT v\.\*/, "Client response must not select editor identity");
});

test("Client deliverables and file downloads remain locked until QC approval", () => {
  const start = api.indexOf("const deliver=p.match");
  const end = api.indexOf('if(m==="GET"&&p==="/v1/editor/assignments")', start);
  assert.notEqual(start, -1, "Missing client deliverables route");
  const route = api.slice(start, end);
  assert.match(route, /s\.qc_status='approved'/);
  const fileStart = api.indexOf("const fileMatch=p.match");
  const fileEnd = api.indexOf("// Tender, editor bidding", fileStart);
  const fileRoute = api.slice(fileStart, fileEnd);
  assert.match(fileRoute, /if\(a\.role==="client"&&file\.kind==="submission"\)allowed=allowed&&file\.qc_status==="approved"/);
});

test("Tender lifecycle requires draft, publish, close, then award before quote", () => {
  const start = api.indexOf("const tenderDraft=p.match");
  const end = api.indexOf('if(m==="POST"&&/^\\/v1\\/admin\\/quotes/', start);
  assert.notEqual(start, -1, "Missing admin tender lifecycle");
  const route = api.slice(start, end);
  assert.match(route, /status!=="draft"/);
  assert.match(route, /action==="publish"/);
  assert.match(route, /status!=="published"/);
  assert.match(route, /action==="close"/);
  assert.match(route, /status!=="closed"/);
  assert.match(route, /action==="award"/);
  assert.match(route, /status!=="awarded"/);
  assert.match(route, /pricing_policy_unconfigured/);
  assert.match(route, /minimum_margin_minor/);
});

test("Assignment is created only after editor deposit reaches ready-for-assignment", () => {
  const start = api.indexOf('if(m==="POST"&&p.startsWith("/v1/admin/offers/")&&p.endsWith("/assign"))');
  const end = api.indexOf('if(m==="POST"&&p.startsWith("/v1/offers/")&&p.endsWith("/deposit/checkout"))', start);
  assert.notEqual(start, -1, "Missing assignment confirmation route");
  const route = api.slice(start, end);
  assert.match(route, /o\.status!=="ready_for_assignment"/);
  assert.match(route, /INSERT INTO assignments/);
  assert.match(route, /client_visible_status='in_progress'/);
  const verifyStart = api.indexOf('if(m==="POST"&&p==="/v1/payments/razorpay/verify")');
  const verifyEnd = api.indexOf('if(m==="POST"&&p==="/v1/webhooks/razorpay")', verifyStart);
  const verify = api.slice(verifyStart, verifyEnd);
  assert.match(verify, /payment\.status!=="captured"/);
  assert.match(verify, /status='ready_for_assignment'/);
});

test("Editor submissions enter QC and only an approved decision unlocks client review", () => {
  const start = api.indexOf('const assignmentId=p.split("/")[3],a=await user(req,env,["editor"]);');
  const end = api.indexOf('if(m==="GET"&&p==="/v1/admin/submissions/pending")', start);
  assert.notEqual(start, -1, "Missing editor submission route");
  const route = api.slice(start, end);
  assert.match(route, /qc_status,\\?\'pending\'/);
  assert.match(route, /status='quality_check'/);
  assert.match(route, /changes_requested/);
  assert.match(route, /qc_status='approved'/);
  assert.match(route, /client_visible_status/);
});
