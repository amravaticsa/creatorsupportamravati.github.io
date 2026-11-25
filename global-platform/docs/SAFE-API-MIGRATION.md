# CSA Global — Safe API Migration (Staging Only)

## Routing state (verified 25 November 2026)

- Frontend active API: `https://csa-global-api-staging.creatorsupportamravati.workers.dev`
- Isolated candidate API: `https://csa-global-api-isolated-staging.creatorsupportamravati.workers.dev`
- Current mode: `legacy`
- Isolated traffic: **disabled**
- Rollback target: Legacy Staging API
- Production API, production D1 databases, production R2 buckets and production routing: **not changed**

The frontend uses the shared `assets/api-config.js`. It is frozen at runtime and CI verifies that the active URL and rollback URL remain on Legacy Staging until gates are cleared.

## Latest verified implementation

- Isolated Worker route additions and finance read endpoints were committed on staging at `9b6f1725ea2e240dc89d3468f87d7b0b8b6bcd59`.
- API validation workflow run `45542657077`: success.
- Worker preflight workflow run `45542657149`: success.
- Pages staging deployment workflow run `45542657114`: success.
- The route additions include client deliverables/review/revisions, editor assignment submission history, client balance and finance read-only endpoints.
- The isolated Worker uses the isolated Global D1 and isolated media/video bindings. No browser traffic has been switched to it.
- Additional isolated routes were added on 25 November: owner-scoped client refund detail, finance-read admin refund detail, staging-only Razorpay client refund processing (requires `rzp_test_` credentials), editor payout queue creation, and editor payout approve/mark-paid actions. Payout handlers record Finance state only and explicitly do not initiate a bank transfer.
- The refund detail and payout action route tests were added. The first test attempt exposed a missing client-detail permission-map entry; that entry was corrected and the subsequent API validation passed.
- Latest validation run after refund detail/payout action tests `45544372541`: success. Latest validation run including staging-only refund processing and payout queue creation `45544628723`: success. Latest staging Pages deployment run `45544628987`: success, including frontend/API health and read-only authorization smoke tests.

These checks establish build/preflight success, not full authenticated end-to-end parity.

## Route parity audit — remaining blockers

A fresh source inventory compared frontend literal API paths with both Worker source files and inspected method-dispatch branches. The following Legacy API operation families still need explicit isolated parity review; some may be intentionally absent, but must be proven against the actual UI workflow and data model before cutover:

- Admin client-refund detail is implemented and finance-read permission checked. Staging-only Razorpay refund processing is implemented with test-key enforcement and provider idempotency; it remains unavailable unless valid Razorpay test credentials are explicitly configured on the staging Worker and exercised with a disposable test payment.
- Client refund detail is now implemented with client ownership scoping. It still needs authenticated E2E verification using a dedicated staging client identity.
- Editor payout creation and approve/mark-paid actions are implemented with QC eligibility, idempotency, state checks and a dedicated `finance.payouts` permission. No bank transfer is initiated. The permission is not granted to the Finance Admin read-only role; real payout mutations remain unavailable until an explicitly authorized role and staging test process are approved.
- Admin assignment routes and assignment state transitions.
- Full client project detail, quote, delivery and review route/method matrix. The isolated Worker has a revision-request read route and guarded deliverables/review handlers; legacy and isolated path shapes are not identical.
- Dynamic editor tender, admin quote, multipart upload session/part/complete/abort, project-file upload/download and media streaming paths require request/response and authorization tests, not just literal string matching.
- Any route dynamically composed by frontend helpers or constructed from response data must be included in the final browser-call inventory.

The source inventory also found isolated-only editor logout/session-revocation endpoints. These are not a substitute for proving the legacy client workflow parity.

## Storage and data state

- Isolated Global API D1 binding points to isolated Global D1.
- Isolated API media binding points to `csa-global-media-isolated-staging`; video bindings point to isolated video resources.
- The inspected staging R2 buckets were empty at the time of the audit. No object migration was therefore performed.
- Legacy staging media bucket CORS configuration returned “does not exist”; browser-direct upload compatibility is not established. Do not add permissive CORS. Derive exact origins, methods and headers from the upload transport and test on isolated staging only.
- Sampled legacy/isolated D1 entities (users, client profiles and projects) had matching stable IDs and counts, but this was not a complete table-by-table reconciliation. Matching samples do not establish transactional consistency.
- Isolated data sampled: 2 users, 2 client profiles, 3 projects, and zero sampled operational rows for offers, assignments, submissions, payments, refunds, editor profiles and payouts. No real payment or production data mutation is authorized.

## Required gates before isolated traffic can be enabled

1. Complete frontend browser-call inventory, including methods, dynamic paths, binary responses and streaming.
2. Implement and test every required route with method, role, ownership, input validation, response contract and DB side-effect parity.
3. Compare all D1 tables, indexes, triggers, views and schema versions; reconcile row counts and stable keys with explicit ownership/status rules.
4. Verify JWT issuer/audience/JWKS, Google auth, editor credential lifecycle, Cloudflare Access, admin authorization sync and session revocation.
5. Exercise isolated R2 upload, resumability, multipart completion, private download authorization, video streaming and cleanup using disposable staging objects only.
6. Verify no legacy-only schema assumptions and no cross-environment bindings.
7. Run authenticated client, editor and admin staging E2E with dedicated test identities and disposable records. Unauthenticated smoke tests alone are insufficient.
8. Perform a staging rollback drill and prove that writes do not split across databases.
9. Obtain explicit user acceptance before any production change. Production remains outside this migration.

## Rollback and write safety

The central config retains the Legacy Staging URL as both active and rollback target. No automatic cross-API fallback for writes is allowed: a timed-out write must first be reconciled by idempotency key against its originating database. Do not retry it against the other API.

## Decision

**MIGRATION GATE: BLOCKED.** Keep frontend traffic on Legacy Staging. Latest isolated route additions passed API validation and the Pages staging deployment plus read-only smoke tests passed. Full D1 schema/data reconciliation, disposable R2 upload/download E2E, dedicated authenticated client/editor/admin workflows and rollback drill remain outstanding. Cloudflare D1 API denied the attempted sqlite_master inventory with SQLITE_AUTH, so a complete remote schema inventory was not claimed. This is a safe incremental step, not completion of Step 2. Do not enable isolated traffic or touch production until every gate above is evidenced and signed off.
