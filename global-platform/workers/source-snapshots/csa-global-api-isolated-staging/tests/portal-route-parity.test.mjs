import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../index.js", import.meta.url), "utf8");

test("client delivery history is owner-scoped and exposes only QC-approved submissions", () => {
  const start = api.indexOf('if(m==="GET"&&p.startsWith("/v1/client/projects/")&&p.endsWith("/deliverables")){');
  const end = api.indexOf('if(m==="POST"&&p.startsWith("/v1/client/projects/")&&p.endsWith("/approve")){', start);
  assert.ok(start >= 0 && end > start, "client deliverables route must exist");
  const route = api.slice(start, end);
  assert.match(route, /user\(req,env,\["client"\]\)/);
  assert.match(route, /client_id=\?/);
  assert.match(route, /s\.qc_status='approved'/);
  assert.match(route, /client_revision_requests/);
});

test("client final approval is limited to latest QC-approved delivery and no open revision", () => {
  const start = api.indexOf('if(m==="POST"&&p.startsWith("/v1/client/projects/")&&p.endsWith("/approve")){');
  const end = api.indexOf('if(m==="POST"&&p.startsWith("/v1/client/projects/")&&p.endsWith("/revisions")){', start);
  assert.ok(start >= 0 && end > start, "client approval route must exist");
  const route = api.slice(start, end);
  assert.match(route, /user\(req,env,\["client"\]\)/);
  assert.match(route, /client_id=\?/);
  assert.match(route, /qc_status='approved'/);
  assert.match(route, /status IN \('open','in_progress'\)/);
  assert.match(route, /delivery_approval_conflict/);
});

test("client revision requests enforce ownership, QC, revision cap and one open request", () => {
  const start = api.indexOf('if(m==="POST"&&p.startsWith("/v1/client/projects/")&&p.endsWith("/revisions")){');
  const end = api.indexOf('if(m==="GET"&&p.startsWith("/v1/editor/assignments/")&&p.endsWith("/submissions")){', start);
  assert.ok(start >= 0 && end > start, "client revision route must exist");
  const route = api.slice(start, end);
  assert.match(route, /user\(req,env,\["client"\]\)/);
  assert.match(route, /client_id=\?/);
  assert.match(route, /revisions_included/);
  assert.match(route, /qc_status='approved'/);
  assert.match(route, /revision_request_conflict/);
});

test("editor submission history is restricted to the assigned editor", () => {
  const start = api.indexOf('if(m==="GET"&&p.startsWith("/v1/editor/assignments/")&&p.endsWith("/submissions")){');
  const end = api.indexOf('if(m==="GET"&&p==="/v1/editor/assignments"){', start);
  assert.ok(start >= 0 && end > start, "editor assignment history route must exist");
  const route = api.slice(start, end);
  assert.match(route, /user\(req,env,\["editor"\]\)/);
  assert.match(route, /editor_id=\?/);
  assert.match(route, /Assignment not found for this editor/);
});
