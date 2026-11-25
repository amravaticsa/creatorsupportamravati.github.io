# CSA Global — Safe API Migration (Staging Only)

## Current routing decision

- Frontend active API: `https://csa-global-api-staging.creatorsupportamravati.workers.dev`
- Isolated candidate API: `https://csa-global-api-isolated-staging.creatorsupportamravati.workers.dev`
- Current mode: `legacy`
- Isolated traffic: **disabled**
- Rollback target: the Legacy Staging API above
- Production API and production databases: **not changed**

The browser clients load one shared `assets/api-config.js`. The migration mode is frozen at runtime and CI tests fail if the default routing or rollback target changes unexpectedly.

## Why traffic is not switched yet

The isolated API is not yet a complete replacement for the Legacy API. The route inventory has identified remaining frontend families that need explicit parity verification and, where required, implementation:

- `/v1/files/*`
- `/v1/admin/client-refunds/*`
- `/v1/admin/editor-portfolio-videos/*`
- `/v1/admin/multipart-uploads/*`
- `/v1/admin/projects/*`
- `/v1/admin/quotes/*`
- `/v1/client/editor-portfolio-videos/*`
- `/v1/client/projects/*` (detail, quote, delivery and review workflows)
- `/v1/client/quotes/*`
- `/v1/editor/tenders/*`

Literal path search is only an inventory aid; each dynamic route must be tested by method, authorization role, request/response contract and database side effects.

## Cutover gates (all required)

1. Route/method parity for every browser call, including dynamic path parameters, uploads, streaming, downloads and binary responses.
2. Schema parity for every query and mutation on the isolated D1; no legacy-only column assumptions.
3. Identity parity: JWT issuer/audience/JWKS, role checks, Cloudflare Access and admin authorization synchronization.
4. Storage parity: isolated R2 object keys, upload resumability, multipart completion, download authorization and video streaming.
5. Data migration/reconciliation: stable IDs, row counts, ownership, status transitions, payments/refunds/payout ledgers and repeatable idempotent transfer. No blind full-database copy.
6. No unsafe automatic fallback for writes. A timed-out write must be reconciled by idempotency key before retrying against another API.
7. Staging end-to-end tests with dedicated test accounts and disposable records; no real payments or real customer/editor data mutations.
8. Rollback drill: switch the central config to Legacy Staging, redeploy, verify health/auth and confirm data writes are not split across databases.
9. Explicit acceptance before any production change. Production is outside this staging migration.

## Current data caution

The isolated Global D1 currently contains three projects but zero assignments, submissions, payments and payouts. The legacy and isolated databases are independent. Matching IDs alone do not prove synchronized records. Until the data transfer/reconciliation plan is validated, the browser must stay on Legacy Staging.

## Rollback

The central config retains `legacyBaseUrl` and `rollbackBaseUrl`. The safe default is already Legacy Staging. No client-side fallback from isolated writes to legacy writes is implemented, intentionally avoiding duplicate or split-brain mutations.
