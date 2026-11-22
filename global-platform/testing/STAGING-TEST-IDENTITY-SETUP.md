# CSA Global — Staging Test Identity Setup

Date: 2026-11-21
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

- Frontend: https://434432ea.csa-global-staging.pages.dev
- Staging API: https://csa-global-api-staging.creatorsupportamravati.workers.dev
- Staging branch commit: `0dca6bbbe87b2c8a27c42c5534d4f325e2ee7fef`
- Deployment workflow: https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/45001141509 (success).
- API validation workflow: https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/45001104285 (success).

The previous `csa-global-staging.pages.dev` address above is a project alias and may resolve to a different deployment over time. For reproducible QA evidence, record and use the immutable deployment URL shown here. Before any sign-in, verify the browser remains on this Pages deployment and API calls remain on the staging Worker hostname. Never enter credentials after a redirect to a production hostname.

This deployment proves frontend route availability, staging API health/D1 connectivity, and unauthenticated API denial only. It does not create QA identities or pass E2E-01 through E2E-07.


### Deployment smoke hardening — 2026-11-22

The staging Pages workflow now fails closed if any required frontend route or asset does not return HTTP 200, rather than logging a warning and continuing. It also checks the final URL origin after redirects and fails if a route or asset leaves the immutable staging deployment origin. The updated workflow passed on commit `0dca6bbbe87b2c8a27c42c5534d4f325e2ee7fef` (run 45001141509). This is a CI/deployment guard only; it does not change API routes, data, secrets, or production resources.
