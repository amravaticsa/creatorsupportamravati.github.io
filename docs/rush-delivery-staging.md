# CSA Video Editing — Rush Delivery Staging

## Pricing
- Standard: no surcharge.
- Priority delivery (one-day target): +25% of the server-stored base project amount.
- Same-day urgent request: +50%, with approval by a currently authenticated Super Admin.
- Same-day is a request, not a promise. Pending/rejected approval blocks payment.
- Amounts are calculated server-side in paise. The client cannot set the surcharge or total.

## Isolated resources created
- D1: `csa-video-rush-staging` (APAC), UUID `198a0604-af4d-4671-8053-5df245ea754c`.
- Video/Rush API Worker: `csa-video-rush-api-staging`.
- Payment Worker: `csa-rush-payment-api-staging`.
- Super Admin identity database: `csa-superadmin-staging` (UUID `99bc81fc-e97e-488b-a380-eb0237ff8ffc`).
- Staging DB holds rush quotes/audit and a minimal staging-only draft table. No live customer rows or payments were copied.

## Staging API routes
Video/Rush API:
- `GET /health`
- `POST /api/rush/quotes` — customer bearer token must match the staging draft's stored SHA-256 access hash.
- `GET /api/admin/rush/quotes` — requires a valid unexpired `csa_admin_session` belonging to an active `super_admin` account in the staging Super Admin DB.
- `POST /api/admin/rush/quotes/:id/decision` — Super Admin only; accepts `approve` or `reject`, records actor/time/note in audit log.

Payment API:
- `GET /health`
- `POST /api/create-order` — accepts only an active unexpired quote and approved/not-required status; calculates advance/full from stored total.
- `POST /api/verify-payment` — validates Razorpay signature, retrieves payment from Razorpay, checks order ID, INR currency, payment state and exact stored amount.

## Payment test gate
The staging Payment Worker has no Razorpay secrets copied from Production. Its health response reports whether test credentials are configured. Until separate Razorpay **Test Mode** key ID and secret are set as staging-only Worker secrets, payment creation and verification return HTTP 503. Do not add Production Razorpay keys.

## Current boundary
The two Workers are deployed separately in Cloudflare Staging with only isolated D1 bindings. They are not connected to the live order form, live video API, live payment API, or production admin page. Front-end selection/popup/receipt and Super Admin screen still need staging integration and end-to-end testing before a production release.


## Super Admin approval portal
- A separate staging-only Worker, `csa-rush-admin-staging`, serves the approval page at `https://superadmin.creatorsupportamravati.in/rush-approvals`.
- The Worker is routed only for `/rush-approvals*` and `/rush-api/*`; the existing Super Admin Worker and its secrets were not modified.
- Approval API requests are same-origin and validate the existing `csa_admin_session` against the staging Super Admin D1 database. The session cookie is not sent to a workers.dev cross-origin host.
- Customer rush quote preview: `https://csa-video-rush-api-staging.creatorsupportamravati.workers.dev/rush-preview` (served by the isolated staging API Worker; same-origin requests stay on staging).
- Payment is intentionally disabled until separate Razorpay Test Mode credentials are configured. This preview currently tests quote creation and same-day approval only; it does not upload media or submit a production order.
