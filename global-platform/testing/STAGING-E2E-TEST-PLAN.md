# CSA Global — Staging End-to-End Business Workflow Test Plan

Date: 2026-11-22
Branch: `staging`
Status: **Prepared; interactive end-to-end execution is not yet complete.**

## Safety boundary

- Use only the CSA Global staging Pages site, staging API, staging D1 and staging R2.
- Use dedicated test identities and clearly labelled test projects/files.
- Never copy production client/editor data into staging.
- Razorpay must remain in Test Mode. Do not use real cards, UPI payments, bank accounts or live credentials.
- Do not trigger live refunds, edit production D1, change production routes, or deploy production Workers.
- Never place passwords, OTPs, access tokens, KYC images or payment secrets in this repository or test report.
- Delete test uploads and test identities only through their supported application/admin workflows after retaining the test evidence needed for audit.

## Current verified baseline

- The latest staging Pages deployment completed successfully (workflow run 45001308790, commit `5ac3a7dc979424b6689a64418b49f820bdbb0e15`; immutable URL `https://2add6c07.csa-global-staging.pages.dev`).
- The deployment smoke test passed for the six core HTML routes, two portal JavaScript assets, and the staging API health endpoint.
- The same deployment's read-only authorization-boundary step passed: unauthenticated requests to the client projects/refunds, editor tenders/assignments, admin tenders, pending editor KYC and client-refund endpoints all returned HTTP 401 or 403.
- GitHub Actions job `Deploy only to csa-global-staging Pages` completed successfully; both frontend/API smoke checks and the API authorization-boundary step are green.
- The latest API validation run completed successfully (workflow run 45001308640): JavaScript/source tests, required-file checks, schema snapshot validation and disposable-D1 safety-guard tests passed.
- These are deployment and source/CI checks. They are **not** proof that a signed-in user can complete the business workflows below.
- The browser-level tests require dedicated test identities and interactive Google sign-in; no user credentials or OTPs are stored in this plan.

## Important known UI gates

- `client-project.html` currently labels its standalone form as a preview and directs clients to sign in. The database-backed submission form is in `portal.html`; use `login.html` → Google sign-in → Client Portal for the actual test.
- Client quote checkout is deliberately described in the portal as unavailable until payment integration tests are completed. Do not mark client payment as passed until a Razorpay Test Mode checkout and server-side capture verification are completed.
- Admin approval of a client refund request is not itself a Razorpay refund. Refund processing and bank/provider reconciliation need separate evidence.

## Test identities and fixtures required

Follow `global-platform/testing/STAGING-TEST-IDENTITY-SETUP.md` for the staging-only identity separation, synthetic fixture, evidence and stop-condition procedure. No test identities are created automatically by this runbook; use the normal sign-in and approval flows.


Prepare these directly in the staging environment:
1. One dedicated client Google identity.
2. One dedicated editor identity with an approved test profile and KYC review fixture. Do not use another person's real identity document. If a real document is required to validate the process, obtain the editor's explicit consent and restrict access to authorized reviewers.
3. One authorized staging admin with the required project, editor-review, QC and finance permissions.
4. One small, clearly labelled test video and one test source file with no confidential or copyrighted third-party content.
5. Razorpay Test Mode configuration and a test payment method supported by the Razorpay test account.

If any identity, permission, provider configuration or test fixture is missing, record the relevant test as **BLOCKED**, not PASS.

## Execution matrix

| ID | Workflow | Actions | Evidence required | Current result |
|---|---|---|---|---|
| E2E-01 | Client registration and project submission | Sign in as test client; verify account role; submit one test project; upload a small test source file; reload portal | Client account exists once; project appears once in client history and admin queue; file is private and downloadable only by authorized roles | BLOCKED — interactive sign-in and test identity required |
| E2E-02 | Admin verification and tender publishing | Sign in as authorized admin; inspect submitted brief/files; verify department routing; create draft tender; validate pricing policy; publish | Audit event exists; tender moves draft → published; no unauthorized admin can publish; configured minimum CSA margin is enforced | BLOCKED — requires E2E-01 and admin identity/permissions |
| E2E-03 | Editor registration, KYC and approval | Register test editor; upload approved test KYC fixture and 1–3 portfolio samples; review KYC, profile and each sample separately; approve only after checks | KYC status, profile status and sample review status are independently recorded; only verified/active approved editors appear in client showcase | BLOCKED — requires test editor identity and reviewer |
| E2E-04 | Editor bidding and assignment | Sign in as approved editor; view eligible tender; submit bid; admin reviews and awards; complete agreement and any required project-specific deposit using Test Mode | Bid is linked to tender/editor; award is audited; assignment is created only after all configured gates pass; unverified editors cannot bid/accept | BLOCKED — requires E2E-02/03 and deposit test setup |
| E2E-05 | Video submission and QC | Assigned editor uploads test deliverable; admin QC requests changes; editor submits a new version; admin approves final version | Version history is retained; status moves to QC; client download is denied before QC approval and allowed only after approval | BLOCKED — requires E2E-04 and test upload |
| E2E-06 | Client delivery and payment | Client views approved deliverable; verify download authorization; run a Razorpay Test Mode quote checkout and server-side payment verification when checkout is enabled | Client can access only approved deliverables; payment ledger and webhook event reconcile to one captured test payment; duplicate webhook is idempotent | BLOCKED — checkout is currently gated pending payment integration test |
| E2E-07 | Refund and finance reconciliation | Client submits refund request for an eligible test payment; finance reviewer approves/rejects; separately execute provider test refund if supported and authorized | Request decision, provider refund ID/status, ledger entries and final reconciliation agree; approval alone is not counted as a completed refund | BLOCKED — provider refund execution/reconciliation evidence required |

## Required negative/authorization checks

- Client A cannot read Client B's projects, uploads, notifications or refund requests.
- An unverified or suspended editor cannot access tenders, accept assignments or expose portfolio videos.
- An editor cannot access another editor's source files, submissions or assignment.
- A client cannot download an editor submission before CSA QC approval.
- An admin without the relevant department/finance permission cannot perform restricted actions.
- Repeated submission, payment webhook and refund-request retries must not create duplicate business records or ledger movements.
- Expired/revoked sessions must not authorize API requests.

## Evidence log

For each test, record: test ID, UTC timestamp, staging build/commit, test role (not email), synthetic record IDs, action, expected result, actual result, API/UI evidence, and PASS/FAIL/BLOCKED. Redact personal information and secrets.

No test is PASS until the full action sequence and its resulting database/API state have both been verified. Screenshots of a form or a successful HTTP 200 response alone are insufficient.

## Exit criteria

- All seven workflows pass in staging.
- All negative/authorization checks pass.
- Test payment and refund records reconcile in the staging ledger and Razorpay Test Mode.
- Test data is removed or clearly retained as non-production QA evidence under an approved retention policy.
- A separate release review approves production migration, production routing and any live payment activation. This test plan does not authorize those actions.


## Tender award handoff audit (2026-11-21)

The staging source review confirms that the tender award endpoint is **not** the same operation as editor assignment:

- Award is permitted only after the tender is closed, the selected bid is still submitted/shortlisted, the bid currency matches the project currency, and the admin independently passes both global projects.manage permission and the tender department route check.
- Award marks the selected bid won, rejects the other eligible bids, marks the tender awarded, and returns the explicit next step create_client_quote_and_send_managed_editor_offer.
- Award does not create a project_offers record or an assignments record. This is intentional for now: the existing managed-editor offer requires an active, verified editor, an agreed fee, delivery period, currency and security-deposit amount. Those commercial terms must not be guessed from the bid.
- The existing offer-creation endpoint rejects editors who are not both verification_status=verified and account_status=active. Assignment is a separate later action and requires an offer in ready_for_assignment; the deposit verification flow must have a captured payment before that state is reached.
- The client quote is a separate action after award and uses the active Super Admin pricing policy. It creates a draft quote; a separate authorized send action is required before the client can see it.

Regression assertions were added for the handoff boundary, verified-editor offer gate, deposit gate, and department authorization. These are source-level regression checks, not a signed-in browser E2E pass. E2E-04 remains BLOCKED until a dedicated staging client/editor/admin test set and test deposit setup are available. No offer, assignment, notification, quote, or payment was created by this audit.

## Assignment finalization security hardening (2026-11-22)

The staging API assignment endpoint was tightened after review of the Editor offer → agreement → deposit → assignment handoff:

- Before creating an assignment, the API now rechecks that the editor account is active, the editor profile is verified, and at least one editor KYC document remains verified.
- It independently verifies that the editor accepted an active project-specific agreement for the same offer and that a successful editor security-deposit payment with a provider payment reference exists.
- The assigning Admin must have the tender department route permission for the project, in addition to the global project-management permission.
- Assignment creation uses a guarded insert and relies on the existing unique constraint on `assignments.offer_id`; duplicate/concurrent attempts cannot create a second assignment for the same offer and are handled as a conflict.
- The assignment, offer status and project status updates are submitted as one D1 batch. No production resources were changed.

Evidence:
- API validation run `44977700574`: `validate` and `schema-snapshot` jobs passed for commit `8ac770e947bd1a0a07f055e76c1027e5b1e806ee`.
- Staging Pages deployment run `44977700557`: frontend/API health and read-only authorization-boundary checks passed.
- Staging Worker `csa-global-api-staging` uploaded from the updated API source as version `75` (`5ed7df9b-a05b-41bb-9847-a5348539af71`); deployment `3254979c-1305-412a-80e6-c2dbb8e957ca` routes 100% of Worker traffic to that version.
- Worker configuration was re-read after upload: `ENVIRONMENT=staging`, both expected staging D1 bindings and both staging R2 buckets remained attached, and the four existing secret binding names remained present. Secret values were neither read nor changed.
- These checks do not constitute a signed-in browser E2E test or a real Razorpay Test Mode payment. E2E-04 remains BLOCKED until dedicated staging client/editor/admin identities and test payment evidence are available. No offer, assignment, payment or refund was created during this hardening.

## QC review security hardening (2026-11-22)

The staging API's Editor submission → Admin QC → client review handoff was hardened:

- QC review now requires the reviewing Admin to hold the project's Tender department route access, in addition to the global `projects.manage` role permission.
- The decision update is compare-and-set: only a submission still in `pending` QC can be processed. Repeated or concurrent review attempts return HTTP 409 (`qc_already_processed`) instead of silently reprocessing an already-reviewed submission.
- Assignment and project status changes are conditioned on the QC decision having been recorded for that submission in the same D1 batch.
- API regression assertions cover the department check and one-time QC decision guard.

Evidence:
- API validation run `44978744063`: `validate` and `schema-snapshot` jobs passed.
- Read-only staging API smoke run `44978744069`: health and public authentication configuration checks passed.
- Staging Worker `csa-global-api-staging` version `76` (`8f652265-d6ef-41f4-8bf4-faeb23f9292f`) is deployed at 100% traffic; deployment `7d1e9af5-6877-4f86-b833-7df7f75eba1e`.
- Worker configuration was rechecked: `ENVIRONMENT=staging`, the expected staging D1 and R2 bindings and all four secret binding names remain present. Secret values were not read or changed.
- These are source, CI, configuration and health checks—not a signed-in Admin QC browser test. E2E-05 remains BLOCKED until test identities, an authorized Admin and synthetic submission files are available. No real client/editor work was processed.


## Client revision request and tracking system (2026-11-22)

- Added staging D1 table client_revision_requests with per-project request numbering, client, assignment, approved submission reference, notes, lifecycle status, timestamps, and handler.
- Added a partial unique index to permit only one open/in-progress client revision request per project.
- Client revision API is owner-scoped, accepts only the latest QC-approved delivery while project is in client_review, requires a meaningful note, and enforces projects.revisions_included as a hard limit.
- Successful request moves the project and assigned editor assignment to revision; Editor assignment view displays the client's requested changes and used/included count.
- Client delivery view displays revision history and remaining allowance. Additional requests are blocked while one is open or when allowance is exhausted.
- Staging D1 migration: global-platform/migrations/2026-11-22-client-revision-requests.sql. Applied only to staging D1 470a81b8-3d36-4e2d-942c-5cbb2746a473; no production D1 or route was changed.
- Still required: authenticated E2E with a separate staging client and editor, upload a QC-approved fixture, request revision, confirm editor sees the notes, re-submit, repeat QC, and verify request count and limit. No real client request or assignment was created by this setup.

- Post-implementation validation: API JavaScript and regression suite passed in GitHub Actions run 44980307966; schema-snapshot and disposable migration safety tests passed.
- Staging Pages deployment and route/asset smoke tests passed in run 44980307990.
- Staging API Worker csa-global-api-staging updated to Version 78 (version ID aae5fc5b-f3cb-4a17-975a-fc4b7dc7a69b; deployment ID 55bf5a08-ecec-4b6e-940e-71cafcd7197e; 100% traffic). ENVIRONMENT remains staging; D1 and R2 bindings are unchanged; existing secret binding names were preserved and secret values were not read or changed.
- Read-only D1 verification confirmed client_revision_requests exists, all three indexes exist, and zero real client revision requests were created during setup.

- Latest-delivery binding refinement: revision requests now require the latest QC-approved submission by submitted_at and an assignment still in approved state. Regression validation passed in GitHub Actions run 44980486941.
- Staging API Worker csa-global-api-staging updated to Version 79 (version ID 0b09c21e-f6f2-445e-939c-5da4765176ad; deployment ID ca3258d7-1499-42de-bdda-70d4f0a75f2a; 100% traffic). ENVIRONMENT remains staging; D1/R2 bindings and secret binding names remain unchanged.
- Staging Pages deployment for the revision request UI passed in run 44980486978, including route/asset smoke tests and read-only API authorization boundary checks. A fresh API health smoke after Worker Version 79 is recorded by the follow-up workflow.


## Client–Editor in-app workflow notifications (2026-11-22)

- Added a best-effort in-app notification helper using the existing notifications and notification_preferences tables. A disabled in-app preference is respected; notification persistence failures do not roll back a successfully completed project action.
- Client revision request sends the assigned Editor a notification containing the client's revision notes.
- Editor submission sends the Client an update that the new version is waiting for CSA QC.
- QC decision sends both Client and Editor the result; approved, changes_requested and rejected decisions use distinct titles and messages.
- Enabled Editor access to notification list, mark-as-read and preferences endpoints using the existing CSA-issued Editor session authentication.
- Added CSA Notifications and preferences panel to the Editor Portal.
- Email and WhatsApp are not sent; they remain preference-only until a delivery provider and verified sender setup are configured.
- Regression coverage added. Authenticated multi-user E2E remains pending separate staging Client, Editor and Admin identities; no real users or project records were modified.

- Workflow notification API validation: GitHub Actions run 44981284270 completed successfully; schema snapshot validation also passed. The Editor notification center and API event wiring are included in the staging source.
- Cloudflare staging Worker csa-global-api-staging deployed as Version 80 (version ID cbd3f4d7-a4a6-41f7-ab04-3db2043a94b3; deployment ID d74108be-d165-4ed4-8d01-412e16454dcb; 100% traffic). Source commit for API: ced4712547bff073f3a94218bf81cd68728bd53a. ENVIRONMENT=staging; expected staging D1 and R2 bindings unchanged; four existing secret binding names unchanged, values not read or modified.
- A fresh post-Version-80 staging health and authorization smoke is required before declaring the notification API runtime-smoke verified. Authenticated Client/Editor notification delivery still needs multi-identity E2E.


## Client final video approval and project completion (2026-11-22)

- Added owner-scoped POST /v1/client/projects/{project_id}/approve. It accepts only when the project is in client_review, its assignment is still approved, the latest QC-approved submission exists, and no open/in-progress revision request exists.
- The API uses a conditional D1 batch to move the project and assignment to completed, records an audit event, and notifies the assigned Editor.
- Client Portal now offers “Approve final video & complete project” with a confirmation step and a clear note that any outstanding balance remains subject to CSA Finance reconciliation.
- Final approval does not initiate a payment, refund or editor payout. Finance reconciliation remains separate.
- Regression tests added. Authenticated E2E still requires separate staging Client and Editor identities plus a real staged QC-approved fixture; no client project was approved during setup.

- Final approval API regression validation passed in runs 44981519724 and 44981526739; schema snapshot validation passed in both runs.
- Cloudflare staging API Worker deployed as Version 81 (version ID 8e9c3241-62d7-42dc-9d71-c3141751406a; deployment ID bc52e81f-15c5-4997-a810-db807ba2ae2b; 100% traffic). Source commit: 3671913eb82d808408b4f2f94ca0c500dd8d5a5e. Staging ENVIRONMENT and D1/R2 bindings unchanged; existing secret binding names unchanged and secret values not accessed.
- Post-Version-81 staging Pages deploy and smoke run 44981526725 passed: Pages deployment, route/asset/API health checks, and read-only API authorization boundary checks all succeeded.


## Latest verified staging baseline — 2026-11-22

- Staging branch commit: `7f867c03cf018a2712271ee6f1fa04f318489eab`.
- CSA Global API validation run: [44999571826](https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/44999571826) — success. Both validation jobs passed, including schema snapshot checks, all disposable SQLite migration/idempotency/reconciliation tests, the read-only preflight guard, the new audit-template safety test, route-disabled guard, JavaScript syntax and API tests.
- Staging Pages deployment run: [44999569554](https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/44999569554) — success. Immutable deployment: https://dd27e46a.csa-global-staging.pages.dev.
- The deployment smoke test passed for `/`, `/client-project.html`, `/editor-register.html`, `/login.html`, `/admin-login.html`, `/portal.html`, `/assets/auth.js`, and `/assets/portal.js`; staging API health and read-only authorization-boundary checks also passed.
- These results verify source/CI, deployment, public route/asset availability, API health and unauthenticated authorization boundaries only. They do not complete any signed-in client/editor/admin business workflow.
- E2E-01 through E2E-07 remain **BLOCKED** until their dedicated staging identities, reviewer permissions, synthetic fixtures and (for payment/refund) Razorpay Test Mode evidence are available. No test identity was created and no payment/refund was initiated by this run.


## Latest staging CI and Pages deployment — 2026-11-22 (supersedes prior baseline)

- Staging branch HEAD: `6892bfdbf8913670e62a937e05f2421774d89881`.
- CSA Global API validation: [workflow run 44999804523](https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/44999804523) — completed successfully for the exact staging HEAD.
- CSA Global staging Pages deployment: [workflow run 44999804529](https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/44999804529) — completed successfully for the same HEAD.
- Immutable Pages deployment URL: https://2c5b2871.csa-global-staging.pages.dev.
- The deployment smoke covered `/`, `/client-project.html`, `/editor-register.html`, `/login.html`, `/admin-login.html`, `/portal.html`, `/assets/auth.js`, and `/assets/portal.js`; staging API health and read-only unauthenticated authorization-boundary checks passed.
- Validation included JavaScript/source tests, schema snapshot checks, disposable SQLite migration/idempotency/reconciliation tests, read-only preflight guard, audit-template safety guard, and the guard keeping proposed legacy bridge management routes disabled.
- This addendum supersedes the older `7f867c03...` / `dd27e46a...` baseline above for the latest staging source/deployment. Earlier entries remain historical evidence.
- Authenticated E2E-01 through E2E-07 remain **BLOCKED**. These CI/deployment checks do not create test identities, prove signed-in client/editor/admin workflows, or validate Razorpay Test Mode payment/refund execution. No production resource was changed by these workflows.


## Latest fail-closed staging smoke — 2026-11-22

- Source commit: `5f6574e3e361c1271e3427d93d1252537c355ee4`.
- Immutable deployment: https://2f2ef3b0.csa-global-staging.pages.dev.
- Deployment run 45001237131: success. API validation run 45001237109: success; independent `schema-snapshot` and `validate` jobs passed.
- The deployment workflow now treats route/asset errors as hard failures and verifies that redirects remain on the immutable staging origin. Latest evidence: all six HTML routes and both JS assets returned HTTP 200; staging API/D1 health passed; all seven unauthenticated protected-route checks returned HTTP 401.
- This supersedes prior deployment URLs for the latest source baseline only. Historical records remain for audit traceability.
- No authenticated client/editor/admin session was used. E2E-01…E2E-07 remain BLOCKED pending dedicated test identities/authorized reviewer and Test Mode payment provider setup. No production resources changed.


## Latest staging build baseline (2026-11-22)

- Immutable frontend: `https://2add6c07.csa-global-staging.pages.dev`.
- Source commit: `5ac3a7dc979424b6689a64418b49f820bdbb0e15`.
- Deployment workflow run `45001308790`: success.
- API validation workflow run `45001308640`: success.
- Strict smoke coverage: six HTML routes and two JS assets returned HTTP 200 from the same immutable deployment origin; staging API health/D1 connectivity passed; seven protected API routes denied unauthenticated requests with HTTP 401.
- All interactive workflows E2E-01 through E2E-07 remain BLOCKED pending dedicated test identities, synthetic media, and approved test-provider execution. The deployment checks do not change those results.


## Latest setup evidence — 2026-11-22

### Deployed Staging infrastructure
- Super Admin invitation preflight/final validation, atomic invitation acceptance, OTP single-use hardening, stale-session revocation, admin role/deactivation session revocation, and Finance access controls are deployed to `csa-superadmin-isolated-staging`.
- Finance access is carried from `csa_admin_module_access` into the canonical Global API authorization snapshot. Canonical bridges include pricing policy, refund dashboard, editor sessions and admin authorization sync. The isolated Regional Admin portal continues to read from `csa-global-api-isolated-staging` / D1 6a32.
- Super Admin authorization reconciliation Cron: every 15 minutes. Canonical Global multipart cleanup Cron: hourly. The isolated Global API cleanup Cron remains scoped to its separate isolated D1.
- Rush approvals have a separate Staging route on `superadmin-editor-staging.creatorsupportamravati.in`, backed by `csa-rush-admin-isolated-staging` and the isolated Super Admin D1. The legacy `superadmin.creatorsupportamravati.in` Rush routes remain unchanged.
- Rush payment staging now rejects payment creation/verification unless `RAZORPAY_KEY_ID` starts with `rzp_test_`.

### Current data inventory (read-only)
- Client accounts: 2 active.
- Projects: 3 submitted; assignments: 0; work submissions: 0.
- Active Editor accounts: 0; Editor credentials: 0.
- Global admin authorizations: 1 active and 1 revoked; no Finance Admin account is currently active.
- Pricing policies: 0; client quotes: 0; payment records: 0.
- Rush delivery quotes and Rush audit rows: 0 at the time of the latest check.
- No dummy/test Client, Editor, Finance Admin, or invitation was created during this setup.

### E2E blockers that require real business configuration or identities
1. Set at least one approved pricing policy (currency, CSA margin %, minimum margin in minor units, and client advance %) in the Super Admin Pricing Policy page. The current placeholder values are not saved policy.
2. Confirm that the canonical Global API has a Razorpay Test Mode key ID (`rzp_test_...`) and valid test secret; the runtime secret value is intentionally not exposed in this plan.
3. Onboard and verify at least one real or explicitly approved test Editor, then assign a project to that Editor. There are currently no assignments or Editor credentials to test the workflow.
4. Use separate authorized Client, Editor, and Admin sessions to test upload, revision, QC, final payment, refund review, and payout flows. No cross-account or browser E2E was performed in this setup.
5. Confirm actual OTP email delivery and invitation acceptance through the browser. Code deployment and static validation do not prove delivery or end-to-end login.

Production Workers, Production D1/R2, and Production DNS were not changed.


### Authorization sync runtime blocker — 2026-11-22 08:30 UTC

- The 08:30 scheduled reconciliation initially returned HTTP 401. Dual-secret verification was then deployed; the 08:45 and 09:00 UTC scheduled runs both succeeded with one authorization synchronized and no error code.
- The legacy `csa-superadmin-api-staging` also calls the canonical staging API using `ADMIN_SYNC_HMAC_SECRET`. Do not rotate that existing binding.
- A dedicated `GLOBAL_API_SYNC_HMAC_SECRET` binding has not been provisioned. The isolated Super Admin sender prefers it and falls back to the existing `ADMIN_SYNC_HMAC_SECRET`; the canonical API accepts both. Scheduled sync is currently verified using the existing legacy secret. The separate Regional Admin data proxy continues to use the legacy secret with the isolated API.
- Until the new secret is authorized and a scheduled run records success, Global Admin sync is deployed but not operationally verified.


### HMAC compatibility code — 2026-11-22 08:33 UTC

- Dual-secret verification is deployed on the canonical Global API; the isolated Super Admin sender prefers `GLOBAL_API_SYNC_HMAC_SECRET` and retains legacy fallback for canonical Admin sync. The Regional Admin data proxy still targets the isolated API/D1 6a32.
- Existing `ADMIN_SYNC_HMAC_SECRET` values remain unchanged, preserving the legacy Super Admin Worker.
- The new dedicated secret binding has not been provisioned. The scheduled sync remains blocked by the existing 401 until the same new random value is added to `csa-superadmin-isolated-staging` and `csa-global-api-staging` after owner authorization.


### Country assignment integration — 2026-11-22 08:40 UTC

- Canonical Global D1 470 has the immutable evidence-backed country assignment audit schema. The isolated D1 6a32 already had the same audit table, triggers and review view; Super Admin `GLOBAL_DB` remains bound to 6a32 so the isolated Regional Admin portal and country-assignment workflow use the isolated stack.
- New Client/Editor onboarding no longer writes a user-supplied country into authoritative `users.country_code`; it remains null until Super Admin evidence review.
- The two existing active Client accounts appear in the country review view as `needs_verified_country`. No country assignments or audit rows were created.
- Runtime country-assignment verification still needs a Super Admin browser session, an approved active country/legal review, and evidence reference. Do not mark a country verified without owner-provided evidence.


### Scheduled Global Admin sync recheck — 2026-11-22 08:45 UTC

- Latest scheduled run after the dual-secret compatibility deployment succeeded: `outcome=success`, `synced_count=1`, no error code.
- The prior 08:30 UTC 401 is superseded by the successful 08:45 UTC result. A dedicated `GLOBAL_API_SYNC_HMAC_SECRET` is not required for current operation; it may be introduced during a future controlled rotation.

- The 09:00:46 UTC scheduled run also succeeded with `synced_count=1`, no error code. Two consecutive scheduled runs succeeded after the compatibility deployment.


### Regional Admin canonical data bridge — 2026-11-22

- Super Admin Regional Admin read proxy calls `csa-global-api-isolated-staging` (D1 6a32). The canonical API's duplicate Regional Admin endpoints are reserved for a future consolidation; no automatic live sync exists between D1 6a32 and D1 470.
- Canonical API endpoints are HMAC-authenticated, timestamp-bound, nonce-replay-protected, path-to-permission-bound and staging-only.
- Client/editor lists filter only on verified `users.country_code`; projects/tenders use `v_project_country_scope`. No profile-country fallback is allowed. Regional finance is denied pending separate legal/finance approval.
- Static API contract tests added. A live Regional Admin E2E test remains unavailable because there is no real Regional Admin account and India is not legally approved/active.

- Deployment smoke checks now verify that `admin-staging` and `regional-staging` serve their login pages and that unauthenticated `/api/me` / `/api/regional/dashboard` requests return 401. A signed Regional Admin request still requires a real account, active assignment and legally approved country for full E2E.


### Shared R2 cross-stack isolation test — pending

- The canonical and isolated Global API Workers share `MEDIA` bucket `csa-global-media-staging`, `LEGACY_VIDEO_DB` 2d3... and `LEGACY_VIDEO_BUCKET` `csa-global-video-isolated-staging`, while their primary D1 databases differ.
- Before launch, use two real accounts and distinct project/assignment records to verify that neither API can fetch, overwrite, complete or abort another account's media object or multipart upload, even when a valid object key is known.
- Do not claim physical storage isolation. Consider dedicated R2/legacy D1 resources if strict separation is required; no bucket migration has been performed.

- Migration `0032_verified_country_scope.sql` is applied to canonical D1 470. It requires the full country verification evidence tuple before a project can enter `v_project_country_scope`. The isolated D1 6a32 already enforced the same rule. Read-only check: all three existing canonical projects remain `country_unassigned` and India's verified client/editor/project counts are zero.


### Isolated Regional stack fixture inventory — read-only snapshot

- Isolated Global D1 6a32 currently contains 2 active Client accounts, 3 projects owned by only one Client, 0 Editor accounts, 0 assignments, 0 work submissions, 0 revision requests and 0 verified-country users.
- The Super Admin D1 contains 0 Regional Admin principals, 0 active Regional Admin assignments, 0 pending invitations and no India legal review row.
- No synthetic accounts, assignments, projects, submissions, invitations or country approvals were inserted. Client A-to-B isolation and Editor/QC/Client end-to-end tests require real authorized accounts/data or a separately approved disposable fixture environment.

- The 09:15:47 UTC scheduled reconciliation also succeeded with one authorization synchronized and no error code; three consecutive 15-minute runs (08:45, 09:00, 09:15 UTC) have passed.

- Read-only R2 configuration check: managed public `r2.dev` access is disabled for `csa-global-media-staging` and `csa-global-video-isolated-staging`. Cross-account authorization still requires E2E testing because both API Workers share these private buckets.
