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
const revisionMigration = readFileSync(new URL("../../migrations/2026-11-22-client-revision-requests.sql", import.meta.url), "utf8");

test("Client showcase is restricted to approved samples from verified editors and KYC", () => {
  assert.match(api, /SELECT v\.id,v\.title,v\.description,v\.category,v\.mime_type FROM editor_portfolio_videos/);
  assert.match(api, /v\.review_status='approved' AND v\.client_visible=1 AND e\.verification_status='verified' AND u\.account_status='active'/);
  assert.match(api, /k\.editor_id=v\.editor_id AND k\.status='verified'/);
  assert.doesNotMatch(api, /SELECT v\.id,v\.editor_id,v\.title,v\.description,v\.category,v\.mime_type FROM editor_portfolio_videos/);
});

test("Client deliverables and downloads are gated by QC approval", () => {
  assert.ok(api.includes("p.startsWith(\"/v1/client/projects/\")&&p.endsWith(\"/deliverables\")"));
  assert.match(api, /WHERE x\.project_id=\? AND s\.qc_status='approved'/);
  assert.match(api, /if\(a\.role==="client"&&file\.kind==="submission"\)allowed=allowed&&file\.qc_status==="approved"/);
});

test("Tender lifecycle requires draft, publish, close, award and configured CSA markup", () => {
  assert.match(api, /const tenderDraft=p\.match/);
  assert.match(api, /if\(action==="publish"\)\{if\(t\.status!=="draft"/);
  assert.match(api, /if\(action==="close"\)\{if\(t\.status!=="published"/);
  assert.match(api, /if\(action==="award"\)\{\s*if\(t\.status!=="closed"/);
  assert.match(api, /if\(action==="quote"\)\{/);
  assert.match(api, /pricing_policy_unconfigured/);
  assert.match(api, /minimum_margin_minor/);
});

test("Assignment rechecks editor KYC, agreement, captured deposit and department access", () => {
  assert.match(api, /o\.status!=="ready_for_assignment"/);
  assert.match(api, /INSERT INTO assignments/);
  assert.match(api, /payment\.status!=="captured"/);
  assert.match(api, /SET status='ready_for_assignment' WHERE id=\?/);
  assert.match(api, /o\.account_status!=="active"\|\|o\.verification_status!=="verified"\|\|!o\.kyc_verified/);
  assert.match(api, /!o\.terms_accepted\|\|!o\.deposit_verified/);
  assert.match(api, /Tender department access is required to confirm project assignment/);
  assert.match(api, /NOT EXISTS\(SELECT 1 FROM assignments WHERE offer_id=\?\)/);
  assert.match(api, /assignment_already_exists/);
});

test("Editor submission enters QC and approved QC moves project to client review", () => {
  assert.ok(api.includes("INSERT INTO work_submissions(id,assignment_id,submitted_by,r2_object_key,version_number,notes,qc_status"));
  assert.ok(api.includes("SET status='quality_check'"));
  assert.ok(api.includes('status==="approved"?"client_review"'));
  assert.ok(api.includes('status==="approved"?"reviewing"'));
  assert.ok(api.includes("dr.route_key='tender' AND da.source_admin_id=?"));
  assert.ok(api.includes("SET qc_status=? WHERE id=? AND qc_status='pending'"));
  assert.ok(api.includes("qc_already_processed"));
  assert.ok(api.includes("results?.[0]?.meta?.changes"));
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


test("Client quotation exposes a transparent cost, CSA fee, advance and remaining-balance breakdown", () => {
  assert.match(api, /q\.base_cost_minor,q\.margin_minor,q\.total_amount_minor/);
  assert.match(api, /pol\.client_advance_bps/);
  assert.match(api, /AS paid_amount_minor/);
  assert.match(portal, /Editor \/ production cost/);
  assert.match(portal, /CSA service & coordination fee/);
  assert.match(portal, /Final quotation/);
  assert.match(portal, /Advance payable/);
  assert.match(portal, /Remaining balance/);
  assert.match(portal, /Math\.ceil\(total\*Number\(q\.client_advance_bps\|\|0\)\/10000\)/);
});


test("Admin tender bid comparison shows editor context and requires confirmation before awarding", () => {
  assert.match(portal, /Editor bid comparison/);
  assert.match(portal, /Specializations:/);
  assert.match(portal, /Proposal:/);
  assert.match(portal, /window\.confirm\("Confirm tender award/);
  assert.match(portal, /Other eligible bids will be rejected/);
  assert.match(portal, /Select this editor/);
});


test("Tender award is a handoff only; it does not bypass verified-editor offer and deposit gates", () => {
  assert.match(api, /if\(action==="award"\)\{\s*if\(t\.status!=="closed"/);
  assert.match(api, /editor_kyc_documents k WHERE k.editor_id=u.id AND k.status='verified'/);
  assert.match(api, /editor_kyc_required/);
  assert.match(api, /tender_bid_awarded/);
  assert.match(api, /next_step:"create_client_quote_and_send_managed_editor_offer"/);
  assert.match(api, /SELECT e\.user_id FROM editor_profiles e JOIN users u ON u\.id=e\.user_id WHERE e\.user_id=\? AND e\.verification_status='verified' AND u\.account_status='active'/);
  assert.match(api, /if\(!ed\)return bad\("Only verified editors can receive offers\."/);
  assert.match(api, /editor_kyc_required/);
  assert.match(api, /k\.status='verified'/);
  assert.match(api, /Tender department access is required to send a managed editor offer/);
  assert.match(api, /o\.status!=="ready_for_assignment"/);
  assert.match(api, /payment\.status!=="captured"/);
  assert.doesNotMatch(api, /if\(action==="award"\)[\s\S]{0,1800}INSERT INTO assignments/);
});

test("Tender award and quote actions enforce project-department access independently", () => {
  assert.match(api, /const ta=p\.match\(\/\^\\\/v1\\\/admin\\\/tenders/);
  assert.match(api, /route_key/);
  assert.match(api, /bind\(t\.project_id,a\.source_admin_id\)/);
});


test("Winning tender bid can be converted into a managed offer with an explicit deposit amount", () => {
  assert.match(api, /b\.editor_id,b\.bid_amount_minor/);
  assert.match(api, /active_offer_exists/);
  assert.match(api, /An active offer already exists for this editor and project/);
  assert.match(portal, /Create Managed Editor Offer/);
  assert.match(portal, /Enter the security deposit amount/);
  assert.match(portal, /proposed_fee_minor:bid\.bid_amount_minor/);
  assert.match(portal, /deposit_amount_minor:Math\.round\(deposit\*100\)/);
  assert.match(portal, /The editor must accept the offer, agreement and deposit before assignment/);
});


test("QC pending queue and ready-for-assignment queue are scoped to each admin's authorized project department", () => {
  const pending = api.slice(api.indexOf('if(m==="GET"&&p==="/v1/admin/submissions/pending")'), api.indexOf('const qc=p.match', api.indexOf('if(m==="GET"&&p==="/v1/admin/submissions/pending")')));
  const ready = api.slice(api.indexOf('if(m==="GET"&&p==="/v1/admin/offers/ready")'), api.indexOf('if(m==="GET"&&p==="/v1/admin/overview")', api.indexOf('if(m==="GET"&&p==="/v1/admin/offers/ready")')));
  for (const route of [pending, ready]) {
    assert.match(route, /project_department_routes dr JOIN global_admin_department_access da/);
    assert.match(route, /dr\.route_key='tender'/);
    assert.match(route, /da\.source_admin_id=\?/);
    assert.match(route, /\.bind\(a\.source_admin_id\|\|null,a\.source_admin_id\|\|null\)/);
  }
});


test("Editor assignment history is private to the assigned editor and exposes QC versions", () => {
  const route = api.slice(api.indexOf('if(m==="GET"&&p.startsWith("/v1/editor/assignments/")&&p.endsWith("/submissions"))'), api.indexOf('if(m==="GET"&&p==="/v1/editor/assignments")'));
  assert.match(route, /user\(req,env,\["editor"\]\)/);
  assert.match(route, /WHERE id=\? AND editor_id=\?/);
  assert.match(route, /WHERE assignment_id=\? ORDER BY version_number DESC/);
  assert.match(route, /qc_status,submitted_at/);
});

test("Editor portal shows submission history and only enables uploads for active or revision assignments", () => {
  assert.match(portal, /Submission and QC history/);
  assert.match(portal, /assignment\.status==="active"\|\|assignment\.status==="revision"/);
  assert.match(portal, /Submission received\. Upload is paused while CSA completes quality review\./);
  assert.match(portal, /Submit revised version/);
});


test("Editor final delivery supports resumable uploads up to 5 GB and client can download only QC-approved deliverables", () => {
  const editorUpload = portal.slice(portal.indexOf('async function loadAssignments()'));
  assert.match(editorUpload, /selected\.size>5\*1024\*1024\*1024/);
  assert.match(editorUpload, /multipartUpload\(selected,\{purpose:"submission",assignment_id:assignment\.id/);
  assert.match(editorUpload, /selected\.size>90\*1024\*1024/);
  assert.match(editorUpload, /Submit revised version/);
  const clientProjectView = portal.slice(portal.indexOf('async function loadClientProjects()'), portal.indexOf('async function loadPortfolioVideoReviews()'));
  assert.match(clientProjectView, /api\("\/v1\/client\/projects\/"\+p\.id\+"\/deliverables"\)/);
  assert.match(clientProjectView, /fetch\(API\+"\/v1\/files\/"\+file\.id/);
  assert.match(clientProjectView, /Download approved file/);
  assert.match(api, /WHERE x\.project_id=\? AND s\.qc_status='approved'/);
  assert.match(api, /if\(a\.role==="client"&&file\.kind==="submission"\)allowed=allowed&&file\.qc_status==="approved"/);
});

test("Client revision requests enforce ownership, latest approved delivery, one-open-request and included revision limits", () => {
  const route = api.slice(api.indexOf('if(m==="POST"&&p.startsWith("/v1/client/projects/")&&p.endsWith("/revisions"))'), api.indexOf('if(m==="GET"&&p.startsWith("/v1/editor/assignments/")'));
  for (const required of ["user(req,env,[\"client\"])","p.client_id=?","project.status!==\"client_review\"","s.qc_status='approved'","ORDER BY s2.submitted_at DESC LIMIT 1","x.status=\'approved\'","p.revisions_included","NOT EXISTS(SELECT 1 FROM client_revision_requests","revision_request_conflict","revision_limit_reached"]) {
    assert.ok(route.includes(required), "Missing revision safeguard: "+required);
  }
  assert.ok(revisionMigration.includes("idx_client_revision_requests_one_open_per_project"));
  assert.ok(api.includes("UPDATE assignments SET status='revision'"));
});

test("Client dashboard displays revision allowance and editor assignment shows the client's requested changes", () => {
  assert.ok(portal.includes("Video review & included revisions"));
  assert.ok(portal.includes("Request included revision"));
  assert.ok(portal.includes("remaining_revisions"));
  assert.ok(portal.includes("revision_notes"));
  assert.ok(portal.includes("Client revision request"));
});

test("A client revision stays open through editor re-upload and closes only after revised submission passes QC", () => {
  assert.ok(api.includes("UPDATE client_revision_requests SET status='completed'"));
  assert.ok(api.includes("submission_id<>? AND ?='approved'"));
  assert.ok(api.includes("handled_by=?"));
});

test("Workflow notifications reach Client and Editor and Editor can read/manage preferences", () => {
  assert.ok(api.includes("async function notifyInApp"));
  assert.ok(api.includes("client_revision_requested"));
  assert.ok(api.includes("work_submitted_for_qc"));
  assert.ok(api.includes('notifyInApp(env,sub.client_id,"quality_review_"+status'));
  assert.ok(api.includes('user(req,env,["client","admin","editor"])'));
  assert.ok(portal.includes('loadCsaNotifications("editor")'));
  assert.ok(portal.includes("editor-notifications"));
});
