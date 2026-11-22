# CSA Global — Staging End-to-End Business Workflow Test Plan

Date: 2026-11-21
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

- The latest staging Pages deployment completed successfully (workflow run 44921983519, commit `a4f7651faac5caa79df63b4b82e56f573caee31a`).
- The deployment smoke test passed for the six core HTML routes, two portal JavaScript assets, and the staging API health endpoint.
- The same deployment's read-only authorization-boundary step passed: unauthenticated requests to the client projects/refunds, editor tenders/assignments, admin tenders, pending editor KYC and client-refund endpoints all returned HTTP 401 or 403.
- GitHub Actions job `Deploy only to csa-global-staging Pages` completed successfully; both frontend/API smoke checks and the API authorization-boundary step are green.
- The latest API validation run completed successfully (workflow run 44920027417): JavaScript/source tests, required-file checks, schema snapshot validation and disposable-D1 safety-guard tests passed.
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
