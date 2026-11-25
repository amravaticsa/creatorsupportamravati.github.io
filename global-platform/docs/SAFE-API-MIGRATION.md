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
- The isolated Global API Worker was updated from the current staging source snapshot using the content-only deployment endpoint; deployment `dc2c2ee1-318f-4644-b9be-acd0e31930f1` / version `78aa1b4d-0e17-4afa-bafc-4c32655985c9` became 100% active on 25 November. Its existing D1/R2 bindings, compatibility date and secret bindings were verified unchanged after upload.
- Latest full API validation run `45547322619`: success. Latest staging Pages deployment and smoke run `45547322679`: success, including the new refund/payout/multipart route guards and upload CORS preflight from the immutable staging Pages origin.

These checks establish build/preflight success, not full authenticated end-to-end parity.

## Route parity audit — source-level result

- A method-dispatch inventory compared Legacy API and isolated Worker source. Every legacy public `/v1/*` and `/health` route/method pattern is present in the isolated Worker. The isolated Worker also adds guarded routes for client deliverables/review/revisions, editor assignment submission history, refund detail, and finance workflows.
- An automated parity test now extracts the public route inventory from both source files and fails if a legacy public route/method is absent from isolated.
- Two legacy-only server-to-server endpoints (`/internal/superadmin/finance-data` and `/internal/superadmin/regional-admin-data`) are not used by the current isolated Super Admin Worker. Their current isolated equivalents are the signed finance/refund dashboard bridge and the signed `/internal/regional/*` bridge. The isolated Super Admin Worker also uses the new signed `/internal/superadmin/legacy-links` bridge.
- Finance Admin remains read-only. Refund/payout mutations are not granted to Finance Admin. The Super Admin bridge validates actor role, allowlist, HMAC, timestamp and nonce. Editor payout readiness checks include completed project/assignment, QC approval, full client payment, no open refunds and matching quote/editor fee. Recording paid requires explicit transfer-completed confirmation and a reference; it does not initiate a transfer.
- The isolated direct Razorpay client-refund route is staging-only and requires `rzp_test_` credentials. It has not been exercised with a real disposable Razorpay test payment. Do not configure live payment keys or enable a production refund path as part of this migration.
- The source-level inventory is not authenticated browser E2E. Dedicated client/editor/admin sessions and disposable records are still needed to verify the actual UI request/response flows.

## Storage and data state

- Isolated Global API bindings point to the isolated Global D1 and isolated media/video resources.
- The frontend uploads through the API proxy: multipart create, part `PUT`, complete/abort, and authenticated file download. It does not upload directly from the browser to an R2 presigned URL. The Worker CORS layer allows `GET,POST,PUT,OPTIONS` and the required `Authorization`/`Content-Type` headers for the staging Pages origin. The missing bucket-level R2 CORS configuration is therefore not itself a blocker for this proxy-based upload path.
- All inspected staging media/video R2 buckets were empty at the time of inspection. No object migration was required or performed. A CORS preflight smoke test for the actual immutable staging Pages origin passed. A real authenticated upload, resume, complete, private download and cleanup cycle using a disposable staging file remains to be tested.
- D1 schema alignment migrations were committed and applied:
  - `0037_isolated_rollback_compatibility.sql` applied additively to Legacy Global staging D1. It adds isolated-required nullable columns while preserving older compatibility columns; no existing rows were rewritten or dropped.
  - `0038_isolated_staging_index_parity.sql` applied to isolated Global staging D1 to align the remaining indexes.
  - `0039_legacy_verified_payment_country_scope.sql` applied to Legacy Global staging D1 to replace its older self-reported-country payment view with the evidence-backed view already used by isolated staging.
- After these changes, both databases have 59 tables, 70 indexes, 15 triggers and 4 views. All 89 index/trigger/view objects now have identical names and SQL definitions in both databases. Both pass `PRAGMA quick_check` and have zero `PRAGMA foreign_key_check` violations. Three old compatibility columns remain only in Legacy (`deposit_ledger.created_by_admin_id`, `editor_deposit_refunds.requested_by_admin_id`, and `legacy_editor_identity_links.created_by/reviewed_by`). The newer source-admin columns exist in both. Legacy `legacy_editor_identity_links.created_by_source_admin_id` is nullable while isolated enforces NOT NULL; the table is empty, and the legacy schema remains more permissive for rollback writes.
- Row comparison across 55 non-operational tables found no business-data differences after excluding generated timestamps. This includes users, client profiles, projects, countries, department routing, authorization records and regional permission catalog. The 249 country records differ only in `updated_at`; authorization/catalog records differ only in sync/creation timestamps.
- Generated operational tables (`admin_sync_nonces`, `api_rate_limits`, `multipart_cleanup_runs`) are intentionally not compared as business records.
- `global_admin_department_access` remains a permission-scope discrepancy: Legacy has an additional `dept-hr-admin` grant for an existing editor-admin source identity; isolated reflects the current Super Admin role-to-department mapping and has only the content department grant. This was not copied or revoked automatically. Review the intended HR grant before cutover.
- No real payment, payout, refund, employee, editor or client business records were fabricated.

## Required gates before isolated traffic can be enabled

1. Complete frontend browser-call inventory, including methods, dynamic paths, binary responses and streaming.
2. Implement and test every required route with method, role, ownership, input validation, response contract and DB side-effect parity.
3. Resolve the remaining HR department-access discrepancy and retain the completed D1 schema/object/data reconciliation evidence.
4. Verify JWT issuer/audience/JWKS, Google auth, editor credential lifecycle, Cloudflare Access, admin authorization sync and session revocation.
5. Exercise isolated R2-backed API upload, resumability, multipart completion, private download authorization, video streaming and cleanup using disposable staging objects only.
6. Verify no legacy-only schema assumptions and no cross-environment bindings.
7. Run authenticated client, editor and admin staging E2E with dedicated test identities and disposable records. Unauthenticated smoke tests alone are insufficient.
8. Design and perform a staging rollback drill that accounts for separate D1 databases. A URL switch alone does not roll back writes made after isolated traffic begins; prove replication/reconciliation or a write-free canary before switching.
9. Obtain explicit user acceptance before any production change. Production remains outside this migration.

## Rollback and write safety

The central config retains the Legacy Staging URL as both active and rollback target. This is a routing fallback only, not a data rollback. The two APIs write to separate D1 databases; a URL switch after isolated writes would leave those writes behind. No automatic cross-API fallback for writes is allowed: a timed-out write must first be reconciled by idempotency key against its originating database. Do not retry it against the other API.

## Decision

**MIGRATION GATE: BLOCKED.** Keep frontend traffic on Legacy Staging. Public route/method source parity is complete and automated; isolated Worker deployment, API route guards, CORS preflight, D1 schema/object parity and business-row comparison are verified. Remaining blockers are the HR department-access discrepancy, authenticated client/editor/admin E2E, disposable R2-backed upload/download/stream tests, and a rollback design that protects writes across separate D1 databases. Do not enable isolated traffic or touch production until these gates are evidenced and signed off.
