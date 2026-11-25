import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../index.js", import.meta.url), "utf8");

test("client deliverables are owner-scoped and include a server-derived revision policy", () => {
  const start = api.indexOf("const deliver=p.match(");
  const end = api.indexOf("const clientReview=p.match(", start);
  assert.ok(start >= 0 && end > start, "client deliverables route must exist");
  const route = api.slice(start, end);
  for (const required of ['user(req,env,["client"])','client_id=?',"s.qc_status='approved'","revision_policy","revisions_included"]) {
    assert.ok(route.includes(required), "missing client deliverable guard: " + required);
  }
});

test("client approve and revision aliases reuse guarded review lifecycle", () => {
  const start = api.indexOf("const clientReview=p.match(");
  const end = api.indexOf('if(m==="GET"&&p==="/v1/editor/payouts"){', start);
  assert.ok(start >= 0 && end > start, "client review route must exist");
  const route = api.slice(start, end);
  for (const required of ['(review|approve|revisions)','action==="approve"','action==="revisions"',"accepted client quotation is required","client_balance_due","client_refund_hold","payout_amount_mismatch","revision_limit_reached","requestedSubmissionId"]) {
    assert.ok(route.includes(required), "missing client review safety check: " + required);
  }
});

test("editor submission history is restricted to the assigned editor", () => {
  const start = api.indexOf('if(m==="GET"&&p.startsWith("/v1/editor/assignments/")&&p.endsWith("/submissions")){');
  const end = api.indexOf('if(m==="GET"&&p==="/v1/editor/assignments"){', start);
  assert.ok(start >= 0 && end > start, "editor assignment history route must exist");
  const route = api.slice(start, end);
  for (const required of ['user(req,env,["editor"])',"editor_id=?","Assignment not found for this editor"]) {
    assert.ok(route.includes(required), "missing editor ownership guard: " + required);
  }
});


test("client and admin refund detail routes enforce ownership and finance-read permission", () => {
  const clientStart = api.indexOf("const clientRefundDetail=p.match(");
  const clientEnd = api.indexOf('if(m==="GET"&&p==="/v1/client/refunds")', clientStart);
  assert.ok(clientStart >= 0 && clientEnd > clientStart, "client refund detail route must exist");
  const clientRoute = api.slice(clientStart, clientEnd);
  assert.ok(clientRoute.includes('user(req,env,["client"])'));
  assert.ok(clientRoute.includes("client_id=?"));
  assert.ok(api.includes('if(m==="GET"&&/^\\/v1\\/client\\/refunds\\/[\\w-]+$/.test(p))return null;'));

  const adminStart = api.indexOf("const adminClientRefundDetail=p.match(");
  const adminEnd = api.indexOf('if(m==="GET"&&p==="/v1/admin/client-refunds")', adminStart);
  assert.ok(adminStart >= 0 && adminEnd > adminStart, "admin refund detail route must exist");
  const adminRoute = api.slice(adminStart, adminEnd);
  assert.ok(adminRoute.includes('user(req,env,["admin"])'));
  assert.ok(adminRoute.includes("JOIN users u ON u.id=r.client_id"));
  assert.ok(api.includes('if(m==="GET"&&/^\\/v1\\/admin\\/client-refunds\\/[\\w-]+$/.test(p))return "finance.read";'));
});

test("editor payout approve and mark-paid actions require finance payout permission and compare-and-set transitions", () => {
  const start = api.indexOf("const payoutAction=p.match(");
  const end = api.indexOf('if(m==="GET"&&p==="/v1/admin/finance/refund-dashboard")', start);
  assert.ok(start >= 0 && end > start, "editor payout action route must exist");
  const route = api.slice(start, end);
  assert.ok(route.includes('user(req,env,["admin"])'));
  assert.ok(route.includes("status='pending_approval'"));
  assert.ok(route.includes("status='approved'"));
  assert.ok(route.includes("payment_reference"));
  assert.ok(route.includes("transfer_initiated:false"));
  assert.ok(api.includes('if(m==="POST"&&/^\\/v1\\/admin\\/finance\\/editor-payouts\\/[\\w-]+\\/(approve|mark-paid)$/.test(p))return "finance.payouts";'));
});


const legacyApi = await readFile(new URL("../../../../api/src/index.js", import.meta.url), "utf8");

function publicRouteInventory(source) {
  const routes = new Set();
  for (const match of source.matchAll(/if\(m==="(GET|POST|PUT|PATCH|DELETE)"&&p==="([^"]+)"/g)) {
    const route = match[2];
    if (route === "/health" || route.startsWith("/v1/")) routes.add(match[1] + " " + route);
  }
  for (const match of source.matchAll(/const\s+(\w+)\s*=\s*p\.match\((\/[^;]+?)\);/g)) {
    const variable = match[1], pattern = match[2];
    const branch = source.indexOf("&&" + variable + ")", match.index);
    if (branch < 0) continue;
    const prefix = source.slice(Math.max(0, branch - 80), branch);
    const method = prefix.match(/if\(m==="(GET|POST|PUT|PATCH|DELETE)"/);
    if (method && pattern.includes("/v1/")) routes.add(method[1] + " " + pattern);
  }
  return routes;
}

test("isolated Global API contains every legacy public route/method", () => {
  const legacyRoutes = publicRouteInventory(legacyApi);
  const isolatedRoutes = publicRouteInventory(api);
  const missing = [...legacyRoutes].filter(route => !isolatedRoutes.has(route)).sort();
  assert.deepEqual(missing, [], "isolated API is missing legacy public routes");
});
