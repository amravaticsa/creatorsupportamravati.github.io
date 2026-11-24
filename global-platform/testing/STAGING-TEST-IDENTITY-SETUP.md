# CSA Global — Staging Test Identity Setup

Date: 2026-11-22
Branch: `staging`
Status: **Preparation only — no accounts created by this document.**

## Purpose

Prepare isolated test identities and synthetic files for the seven staging end-to-end workflows. Use only the CSA Global staging environment. This document is not authorization to create production users, change permissions, or enable live payments.

## Staging entry points

- Staging frontend: https://csa-global-staging.pages.dev
- Client/editor sign-in: https://csa-global-staging.pages.dev/login.html
- Client and editor workspace: https://csa-global-staging.pages.dev/portal.html
- Admin sign-in: https://csa-global-staging.pages.dev/admin-login.html
- Staging API health: https://csa-global-api-staging.creatorsupportamravati.workers.dev/health

Before entering test data, confirm the browser address is on `csa-global-staging.pages.dev` and the API hostname ends in `-staging.creatorsupportamravati.workers.dev`. Do not continue if a page redirects to the production domain or a production payment page.

## Identity separation

Create/choose identities under the user's control using the normal Google sign-in flow. Do not send passwords, OTPs, recovery codes, cookies, ID tokens, or secret values to CSA staff or ChatGPT.

| Test identity | Purpose | Required separation |
|---|---|---|
| Client QA identity | Submit one synthetic client project and inspect client history | Must not be the editor or admin identity |
| Editor QA identity | Complete editor onboarding, upload portfolio samples, and test assigned work | Must not be the client or admin identity |
| Admin QA identity | Review KYC, tender, QC and finance actions | Must be an already authorized staging admin; do not self-grant admin role |

### Client identity setup

1. Sign in at the staging `/login.html` page with a dedicated Google identity.
2. Confirm the portal identifies the account as a client. If the role is incorrect or access is denied, stop and record BLOCKED; do not edit the browser role or database.
3. Use the synthetic name `CSA QA Client 01` in the project brief where a display name is requested.
4. Submit only a clearly labelled non-commercial QA project, e.g. `[STAGING QA] Client upload and tender flow`.
5. Use a short, non-confidential sample video created for testing. Do not upload customer footage, private recordings, or copyrighted material.
6. Record only the generated project/application ID and test result in the evidence log.

### Editor identity setup

1. Sign out of the client identity and sign in with a separate dedicated Google identity.
2. Complete the normal editor registration flow. Use `CSA QA Editor 01` as a test display label if the form permits.
3. Upload only synthetic portfolio samples labelled `STAGING QA — NOT CLIENT WORK`.
4. For KYC, use a platform-provided test fixture if one exists. If the platform requires a real identity document, obtain the editor's explicit informed consent and restrict visibility to authorized reviewers. Never fabricate identity documents or upload someone else's document without consent.
5. Do not attempt to approve the editor from the editor account. KYC/profile/sample approval must be performed by an authorized reviewer.
6. Record the generated editor/profile ID and KYC state, not document numbers or images.

### Admin identity setup

1. Use only an existing, explicitly authorized staging admin identity.
2. Do not use the production Super Admin hostname as a substitute for the staging admin portal.
3. If the staging admin sign-in is unavailable, or the identity has no required department/finance permissions, mark admin-dependent workflows BLOCKED.
4. Never create or elevate an admin by editing local storage, browser claims, API payload roles, or database rows manually.

## Synthetic test fixture

Prepare a small local file set:

- `csa-staging-qa-source.mp4`: short, self-created or public-domain footage, no personal data.
- `csa-staging-qa-delivery-v1.mp4`: intentionally incomplete draft for QC change request.
- `csa-staging-qa-delivery-v2.mp4`: corrected final version.
- `csa-staging-qa-thumbnail.jpg`: optional synthetic thumbnail.

Keep the files small enough for a quick upload. Never commit the media files or any identity documents to GitHub.

## Test execution order

1. Client registration and one project submission (E2E-01).
2. Admin project review and draft/published tender (E2E-02).
3. Editor registration, KYC/profile/sample review (E2E-03).
4. Eligible editor bid and controlled award/offer (E2E-04).
5. Editor v1 upload → QC changes requested → v2 upload → QC approval (E2E-05).
6. Client approved-deliverable access; payment remains BLOCKED unless a full Razorpay Test Mode checkout is explicitly enabled and verified (E2E-06).
7. Refund request and test-provider reconciliation only after a test payment has been captured (E2E-07).

## Evidence log template

For each workflow, record:

| Field | Value |
|---|---|
| Test ID | E2E-01 … E2E-07 |
| Build/commit | |
| Test role | Client / Editor / Admin |
| Synthetic record ID | |
| Expected result | |
| Actual result | |
| API/UI evidence reference | |
| Result | BLOCKED / PASS / FAIL |
| Notes | |

A workflow is PASS only when the UI action and resulting server/database state are both verified. A form submission, screenshot, or HTTP 200 by itself is not enough.

## Stop conditions

Stop and mark BLOCKED if:
- Any staging sign-in redirects to production.
- A test account unexpectedly receives admin access.
- A client can view another client's data, or an editor can access another editor's files.
- An unapproved editor can bid, accept an assignment, or appear in the client showcase.
- A client can download a deliverable before QC approval.
- Any payment flow requests live credentials or real-money payment.
- The test would require editing production data, changing production routes, or exposing secrets.

## Cleanup

After retaining redacted evidence, remove test projects and uploads only through supported staging application workflows. Do not delete D1 rows directly as a shortcut. Retain a concise audit record of cleanup. Production remains untouched.


## Latest verified staging deployment — 2026-11-22

Use the immutable deployment below as the authoritative frontend target for this test cycle:

- Frontend: https://437b6fbc.csa-global-staging.pages.dev
- Staging API: https://csa-global-api-staging.creatorsupportamravati.workers.dev
- Staging branch commit: `85765d058a50416a403393a6491567ba60cf2914`
- Deployment workflow: https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/45001308790 (success).
- API validation workflow: https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/45001308640 (success).

The previous `csa-global-staging.pages.dev` address above is a project alias and may resolve to a different deployment over time. For reproducible QA evidence, record and use the immutable deployment URL shown here. Before any sign-in, verify the browser remains on this Pages deployment and API calls remain on the staging Worker hostname. Never enter credentials after a redirect to a production hostname.

This deployment proves frontend route availability, staging API health/D1 connectivity, and unauthenticated API denial only. It does not create QA identities or pass E2E-01 through E2E-07.


### Deployment smoke hardening — 2026-11-22

The staging Pages workflow now fails closed if any required frontend route or asset does not return HTTP 200, rather than logging a warning and continuing. It also checks the final URL origin after redirects and fails if a route or asset leaves the immutable staging deployment origin. The updated workflow passed on commit `5ac3a7dc979424b6689a64418b49f820bdbb0e15` (run 45001308790). This is a CI/deployment guard only; it does not change API routes, data, secrets, or production resources.


### Latest fail-closed smoke verification — 2026-11-22

- Historical immutable Pages deployment: https://2f2ef3b0.csa-global-staging.pages.dev
- Source commit: `5f6574e3e361c1271e3427d93d1252537c355ee4`.
- Deployment workflow: run 45001237131 — success. This is historical evidence; do not use this URL for the current QA cycle.
- API validation workflow: run 45001308640 — success, including independent schema-snapshot job.
- The hardened smoke test returned HTTP 200 on all six HTML routes and both portal assets, verified no redirect escaped the immutable deployment origin, confirmed staging API/D1 health, and received HTTP 401 on all seven protected unauthenticated API routes.
- This remains a read-only deployment/security smoke test. Signed-in E2E-01…E2E-07, provider payment/refund tests, and production release gates remain separate.


### Documentation refresh — 2026-11-22

The authoritative immutable staging URL for the current cycle is `https://2add6c07.csa-global-staging.pages.dev` on commit `5ac3a7dc979424b6689a64418b49f820bdbb0e15`. Use the latest deployment and validation runs listed above; earlier immutable URLs are historical and must not be used for new QA evidence.


### Current deployment supersedes historical URLs — 2026-11-22

Cloudflare Pages confirms deployment `437b6fbc-58e3-4d2f-9c12-3ea63ff6d82e` succeeded for staging commit `85765d058a50416a403393a6491567ba60cf2914`. Current immutable QA frontend: `https://437b6fbc.csa-global-staging.pages.dev`. This deployment contains documentation refreshes only; the strict route/API smoke evidence remains tied to commit `5ac3a7dc979424b6689a64418b49f820bdbb0e15` and deployment run `45001308790` until smoke checks are re-run against the new immutable URL.


## Current isolated portal entry points — 24 November 2026

Use these staging-only hosts for operations QA:
- Super Admin: `https://superadmin-isolated-staging.creatorsupportamravati.in/`
- Delegated Admin: `https://admin-isolated-staging.creatorsupportamravati.in/`
- Regional Admin: `https://regional-staging.creatorsupportamravati.in/`
- Editor Portal: `https://editor-staging.creatorsupportamravati.in/`
- Editor internal bridge: `https://editor-api-isolated-staging.creatorsupportamravati.in/` (service-to-service only; unsigned requests must be rejected)
- Client portal: use the immutable `csa-global-staging.pages.dev` deployment URL recorded by the latest successful deployment workflow.

The isolated admin hosts are protected by Cloudflare Access; an unauthenticated API request may return 401/403 or redirect only to the configured CSA Cloudflare Access login domain. Do not use `admin.creatorsupportamravati.in` or `superadmin.creatorsupportamravati.in` for staging QA.

No test identities were created by this recheck. Continue to use separate, user-controlled QA identities and the normal application onboarding/review flows. Do not create or elevate an admin by direct database writes.
