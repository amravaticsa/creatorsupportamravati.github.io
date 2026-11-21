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
