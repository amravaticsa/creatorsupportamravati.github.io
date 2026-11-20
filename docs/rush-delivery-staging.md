# CSA Video Editing — Rush Delivery Staging

## Pricing
- Standard: no surcharge.
- Priority delivery (one-day target): +25% of the server-stored base project amount.
- Same-day urgent request: +50%, with approval by a currently authenticated Super Admin.
- Same-day is a request, not a promise. Pending/rejected approval blocks payment.
- Amounts are calculated server-side in paise. The client cannot set the surcharge or total.

## Isolated resources created
- Rush quote/audit D1: `csa-video-rush-staging` (APAC), UUID `198a0604-af4d-4671-8053-5df245ea754c`.
- Full workflow D1: `csa-video-workflow-staging` (APAC), UUID `69f070a4-b71f-4448-973f-31993715b781`.
- Private upload storage: R2 bucket `csa-video-editing-staging` (APAC).
- Workers: `csa-video-rush-api-staging`, `csa-video-workflow-api-staging`, `csa-rush-payment-api-staging`, and `csa-rush-admin-staging`.
- Super Admin identity database: `csa-superadmin-staging` (UUID `99bc81fc-e97e-488b-a380-eb0237ff8ffc`).
- Only schema was reproduced in staging. No live customer rows, production payment records, production secrets or media were copied.

## Staging API routes
Customer order page: [Open full staging order portal](https://csa-video-rush-api-staging.creatorsupportamravati.workers.dev/rush-preview).

Workflow API (`csa-video-workflow-api-staging`):
- `POST /api/orders/draft` — creates an isolated customer draft.
- `POST /api/drafts/:draftCode/files` and `PUT/POST /api/uploads/:fileId` — multipart upload to private staging R2.
- `POST /api/drafts/:draftCode/finalize` — requires raw media, accepted terms, captured payment and paid rush quote.
- `GET /api/orders/:orderCode` — private order tracking.

Rush API (`csa-video-rush-api-staging`):
- `GET /health`
- `POST /api/rush/quotes` — customer bearer token must match the staging draft's SHA-256 access hash.
- `GET /api/rush/quotes/:id?draftCode=...` — customer-authenticated quote/approval status.
- `GET /api/admin/rush/quotes` — requires a valid unexpired `csa_admin_session` belonging to an active `super_admin` account in the staging Super Admin DB.
- `POST /api/admin/rush/quotes/:id/decision` — Super Admin only; accepts `approve` or `reject`, records actor/time/note in audit log.

Payment API (`csa-rush-payment-api-staging`):
- `GET /health`
- `POST /api/create-order` — accepts an active unexpired quote and approved/not-required status; records the order in the isolated payment ledger.
- `POST /api/verify-payment` — verifies signature, order ID, INR currency, captured status and exact amount; records payment and marks quote paid.

## Payment test gate
Separate Razorpay **Test Mode** key ID and secret are configured as encrypted secrets on csa-rush-payment-api-staging; they are not copied from Production. The Worker settings confirm both secret bindings remain present after the latest deployment. Do not add Production Razorpay keys. Test Mode checkout still requires an end-to-end browser test before release.

## Current boundary
The customer form is a separate staging copy. It uses only the staging API, staging D1 databases and staging R2 bucket. Production `video-editing.html`, live video/payment APIs, production database, production media bucket and live orders remain unchanged. The preview is noindex. Full browser/API end-to-end testing is still required before any production release.


## Super Admin approval portal
- A separate staging-only Worker, `csa-rush-admin-staging`, serves the approval page at `https://superadmin.creatorsupportamravati.in/rush-approvals`.
- The Worker is routed only for `/rush-approvals*` and `/rush-api/*`; the existing Super Admin Worker and its secrets were not modified.
- Approval API requests are same-origin and validate the existing `csa_admin_session` against the staging Super Admin D1 database. The session cookie is not sent to a workers.dev cross-origin host.
- Customer rush quote preview: `https://csa-video-rush-api-staging.creatorsupportamravati.workers.dev/rush-preview` (served by the isolated staging API Worker; same-origin requests stay on staging).
- Razorpay Test Mode credentials are configured on the isolated staging payment Worker. This preview is still not approved for production; complete browser-based upload, approval, checkout, payment verification, receipt and tracking tests first.


## Workflow staging deployment
- Customer page: `https://csa-video-rush-api-staging.creatorsupportamravati.workers.dev/rush-preview`.
- Workflow API: `https://csa-video-workflow-api-staging.creatorsupportamravati.workers.dev`.
- Rush payment API: `https://csa-rush-payment-api-staging.creatorsupportamravati.workers.dev`.
- Workflow schema: `database/migrations/20261120_video_workflow_staging.sql`.
- Same-day requests show a confirmation dialog, create a pending quote, and block checkout until Super Admin approval. After approval, the customer returns and clicks Pay Now again.
- Priority one-day quotes require no Super Admin approval; they add 25%. Same-day adds 50%.
- Final order records store rush level, surcharge and total project fee; order tracking displays the rush charge.
- Razorpay Test Mode credentials are configured as encrypted staging Worker secrets. Production keys are not copied. The payment Worker now supports idempotent verification retries and is deployed to staging.


## Latest staging hardening — 2026-11-20
- Super Admin approve/reject decision and audit insert now execute in one D1 batch; the update rechecks pending state and quote expiry. Deployed to csa-rush-admin-staging at 100% traffic.
- Payment verification supports safe retries for an already-paid quote, avoids duplicate payment rows with INSERT OR IGNORE, and only writes the paid audit event once. Deployed to csa-rush-payment-api-staging at 100% traffic.
- Payment API deployment was verified to retain both D1 bindings and both encrypted Razorpay Test Mode secret bindings.
- The payment-order type synchronization change is committed to the staging branch frontend source. It has not been deployed to the public site; production remains unchanged.
- D1 staging tables were checked and contained zero test orders, files, payment ledger rows, rush quotes and audit rows at the last read-only count.
- Direct Worker URL health checks from the management execution environment are blocked by that environment's outbound request policy (403); this is not evidence of a Worker outage. Browser-based end-to-end testing remains outstanding.
