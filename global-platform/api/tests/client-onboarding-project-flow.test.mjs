import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const auth = readFileSync(new URL("../../assets/auth.js", import.meta.url), "utf8");
const portal = readFileSync(new URL("../../assets/portal.js", import.meta.url), "utf8");
const login = readFileSync(new URL("../../login.html", import.meta.url), "utf8");
const html = readFileSync(new URL("../../portal.html", import.meta.url), "utf8");

test("Client registration creates an active identity while keeping self-reported country out of verified users.country_code", () => {
  const route = api.slice(api.indexOf('if(m==="POST"&&p==="/v1/auth/google"){'), api.indexOf('if(m==="POST"&&p==="/v1/onboarding/editor")'));
  assert.match(route, /claims\(new Request\(req\.url,\{headers:\{Authorization:"Bearer "\+credential\}\}\),env\)/);
  assert.match(route, /if\(c\.nonce!==nonce\)/);
  assert.match(route, /if\(old\)\{/);
  assert.match(route, /if\(old\.role!==role\)return bad/);
  assert.match(route, /INSERT INTO users\(id,auth_subject,role,email,email_verified_at,account_status,country_code\) VALUES\(\?,\?, 'client',\?,\?, 'active',NULL\)/);
  assert.match(route, /INSERT INTO client_profiles\(user_id,display_name,company_name,country,timezone,preferred_language\)/);
  assert.match(route, /txt\(profile\.country,100\)\|\|null/);
  assert.match(route, /if\(byEmail\)return bad\("This email already has an account/);
  assert.match(auth, /role:role\.value,profile/);
  assert.match(auth, /sessionStorage\.setItem\("csa_global_token",response\.credential\)/);
  assert.match(login, /accounts\.google\.com\/gsi\/client/);
});

test("Editor onboarding stores self-reported profile country but does not set authoritative users.country_code", () => {
  const start = api.indexOf('if(m==="POST"&&p==="/v1/onboarding/editor")');
  const end = api.indexOf('if(m==="GET"&&p==="/v1/editor/agreements")', start);
  assert.ok(start >= 0 && end > start, "Editor onboarding route must exist");
  const route = api.slice(start, end);
  assert.match(route, /VALUES\(\?,\?, 'editor',\?,\?, 'pending',NULL\)/);
  assert.match(route, /txt\(b\.country_code,2\)\.toUpperCase\(\)\|\|null/);
  assert.match(route, /country_code/);
});

test("Client project submission requires an authenticated client and complete brief/location/language requirements", () => {
  const start = api.indexOf('if(m==="POST"&&p==="/v1/projects"){');
  const end = api.indexOf('if(m==="GET"&&p==="/v1/editor/agreements"){', start);
  assert.ok(start >= 0 && end > start, "Project submission route must exist");
  const route = api.slice(start, end);
  assert.match(route, /user\(req,env,\["client"\]\)/);
  assert.match(route, /communication_language/);
  assert.match(route, /source_language/);
  assert.match(route, /output_language/);
  assert.match(route, /client_country/);
  assert.match(route, /client_city/);
  assert.match(route, /\["remote","onsite","hybrid"\]/);
  assert.match(route, /budget_type==="recommend"/);
  assert.match(route, /INSERT INTO projects\(/);
  assert.match(route, /status\) VALUES\([\s\S]*?'submitted'\)/);
  assert.match(route, /project_submitted/);
});

test("Client dashboard lists only projects owned by the authenticated client", () => {
  const start = api.indexOf('if(m==="GET"&&p==="/v1/client/projects"){');
  const end = api.indexOf("// Resumable R2 multipart uploads", start);
  assert.ok(start >= 0 && end > start, "Client project list route must exist");
  const route = api.slice(start, end);
  assert.match(route, /user\(req,env,\["client"\]\)/);
  assert.match(route, /FROM projects WHERE client_id=\? ORDER BY created_at DESC LIMIT 100/);
  assert.match(route, /payment_status/);
  assert.match(route, /application_locked/);
  assert.match(portal, /api\("\/v1\/client\/projects"\)/);
});

test("Project submission UI reconciles ambiguous network responses before asking client to retry", () => {
  assert.match(html, /id="project-form"/);
  assert.match(html, /name="title" required/);
  assert.match(html, /name="brief" required/);
  assert.match(portal, /api\("\/v1\/projects",\{method:"POST",body:JSON\.stringify\(payload\)\}\)/);
  assert.match(portal, /network\/server error can arrive after the database commit/);
  assert.match(portal, /Check “Your projects with CSA” before trying again/);
});
