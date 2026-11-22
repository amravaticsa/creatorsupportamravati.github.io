# CSA Global API — staging

Cloudflare Worker: `csa-global-api-staging`
Endpoint: https://csa-global-api-staging.creatorsupportamravati.workers.dev
Database binding: `DB` → `csa-global-platform-staging` (isolated staging database; do not bind this Worker to production D1)
Private media binding: `MEDIA` → `csa-global-media-staging`

## Implemented routes
- `GET /health`, `GET /v1/config`
- `POST /v1/auth/google` — Google Identity Services credential + nonce verification; client/editor/admin role onboarding (admin requires `ADMIN_EMAILS` allowlist).
- `POST /v1/projects`, `GET /v1/client/projects`, `GET /v1/client/projects/:id/deliverables`
- `PUT /v1/projects/:id/files`, `GET /v1/projects/:id/files`, `GET /v1/files/:id`
- Multipart: `POST /v1/uploads/multipart`, `PUT /v1/uploads/multipart/:id/parts/:partNumber`, `POST /v1/uploads/multipart/:id/complete`, `POST /v1/uploads/multipart/:id/abort` (project source files and editor submissions)
- `GET /v1/editor/offers`, `GET /v1/editor/agreements`, `GET /v1/editor/assignments`
- `POST /v1/offers/:id/accept`, `POST /v1/offers/:id/terms`
- `POST /v1/offers/:id/deposit/checkout`, `POST /v1/payments/razorpay/verify`, `POST /v1/webhooks/razorpay`
- `PUT /v1/assignments/:id/submissions`
- Admin: overview, tender queue, editor queues, offer creation, agreement draft/activation, assignment confirmation, QC queue and QC decisions.
- `GET /v1/admin/multipart-uploads` — admin/staff-only read-only upload operations summary and latest 50 sessions; no R2 keys or provider upload IDs exposed.
- `GET|POST /v1/admin/multipart-uploads/:id/incidents` — admin/staff-only append-only incident and resolution timeline for a specific upload session; bounded notes and allow-listed incident/status values.
- `GET /v1/uploads/multipart/history` — signed-in client's/editor's own latest 30 sessions.
- `GET /v1/admin/deposits/refunds/eligible`, `POST /v1/admin/deposits/:paymentId/refund` — full original-method refund, available only after CSA QC approval; one request per deposit.
- `GET /v1/notifications`, `POST /v1/notifications/:id/read` — authenticated user's own in-app notifications and read state.
- `GET|PUT /v1/notifications/preferences` — per-user in-app, email and WhatsApp preferences; WhatsApp defaults off and is explicit opt-in.
- `POST /v1/admin/notifications` — Support Admin can send an in-app notice to an active client/editor.
- `GET|POST /v1/client/refunds` — client can list and request partial/full refunds only against their own successful client advance/balance payments; requests are idempotency-keyed and limited to the remaining refundable amount.
- `GET /v1/admin/client-refunds`, `PATCH /v1/admin/client-refunds/:id` — Finance Admin review queue; approve means authorized for processing only and does not call Razorpay.
- `GET /v1/editor/deposit-refunds` — editor's own refund status and Razorpay refund reference.

## Authentication
Google RS256 ID tokens are verified using Google's JWKS. The Worker validates issuer, exact audience, expiry, issued-at, verified email and per-login nonce. Protected routes check account status and role on every request.

Required plain-text variables:
- `GOOGLE_CLIENT_ID` and `AUTH_AUDIENCE` (same OAuth Web client ID)
- `ADMIN_EMAILS` (comma-separated admin Google email allowlist)
- `RAZORPAY_KEY_ID`
- Existing: `AUTH_JWKS_URL`, `AUTH_ISSUER`, `ALLOWED_ORIGINS`, `ENVIRONMENT`

Required encrypted secrets:
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

## Razorpay safety
- Server creates Razorpay Orders; browser does not decide amount.
- Server verifies HMAC signature and fetches payment status; only captured, amount/currency-matched payments unlock assignment.
- Webhook signatures are checked against the raw request body; duplicate webhook event IDs are rejected.
- Configured staging webhook events: `payment.captured`, `payment.failed`, `refund.created`, `refund.processed` and `refund.failed`.
- Checkout is disabled/fails closed until valid keys and webhook secret are configured.
- Test Mode only until deposit/refund/legal/cross-border review is complete.

## API abuse controls
- D1-backed fixed-window rate limits are applied by client IP (SHA-256 hashed; raw IPs are not stored) to Google login (10/minute), client/editor onboarding (5/minute) and media uploads/submissions (6 per 5 minutes).
- Rate-limited requests return HTTP 429 with a `Retry-After` header. Rate-limit counters are stored in the isolated staging D1 database and expired rows are periodically pruned.
- Multipart upload creation is limited to 5/minute/IP, parts to 120/5 minutes/IP, and completion/abort to 10/5 minutes/IP.

## Private file handling
- R2 bucket is private and not publicly exposed.
- Client source files are only available to the project owner, CSA admins and the assigned editor.
- Editor submissions are private until QC approval; clients can download approved deliverables only.
- Direct single-request uploads remain capped at 90 MB. Resumable R2 multipart uploads support files over 90 MB up to 5 GB, split into 50 MiB parts (minimum 5 MiB except the last part). Upload sessions expire after 24 hours. An hourly scheduled Worker job aborts expired open R2 multipart uploads in batches of up to 100 and marks successful aborts as `aborted`; failed aborts remain open for the next scheduled retry. R2 also automatically aborts unfinished multipart uploads after 7 days.

## Staging-only limitations
- No active legal agreement is seeded. Admin must add and activate a reviewed agreement before editors can accept terms.
- Staging D1 migrations `0001`–`0010` have been applied only after verification; verify the target database before any future migration or deployment.
- Refunds require an explicit CSA Admin action after Quality Approved; provider status is reconciled by signed Razorpay refund webhooks. Both the API response and webhook must match the original payment ID, full amount and currency, and a locally recorded CSA refund request before the deposit is marked fully refunded. Refund requests are single-use/idempotency-keyed; mismatches and uncertain provider outcomes are marked unknown for manual Razorpay dashboard reconciliation and must not be retried blindly.
- No automatic email/WhatsApp notifications, editor payout automation or client final sign-off yet.
- Google OAuth settings, admin allowlist and Razorpay encrypted secrets are configured on the staging Worker. Configuration is not proof of end-to-end payment/refund success.
- Keep payment processing in Test Mode. Do not collect live deposits or publish to production until legal review, end-to-end tests and independent security review are complete.


### Upload history and recovery

Authenticated clients and editors can retrieve their latest 30 multipart upload sessions from `GET /v1/uploads/multipart/history`. The response is scoped to the signed-in account and includes file name, purpose, byte/part progress, status, timestamps and associated project or assignment IDs. The portal displays this history; an unexpired open upload can be resumed by selecting the same file (matching filename and size). The endpoint does not expose R2 object keys or provider multipart upload IDs.

- Admin portal includes a read-only large-file upload operations panel with status totals, progress and expired-session visibility.


### Multipart part integrity

The Worker computes and stores a SHA-256 digest for every uploaded part. Before resuming, the browser re-hashes all previously uploaded parts from the selected local file and compares them with the server-computed digests. If any part differs, resume is stopped before additional bytes are uploaded. Sessions created before migration 0008 have no part digests and are intentionally rejected for resume; start a fresh upload instead.


### Multipart cleanup run monitoring

Hourly scheduled cleanup executions are written to the staging D1 table `multipart_cleanup_runs`, including start/finish time, success/partial/failed status, number checked, number aborted and failures. Admin/staff can read the latest 30 records through `GET /v1/admin/multipart-cleanup-runs`; the admin portal displays this history. This records actual executions rather than assuming a configured Cron schedule has run.


### Multipart upload incident and resolution audit

Admin/staff can inspect an upload session and append an incident/resolution event. Each record captures the session, authenticated actor, allow-listed incident type, resolution status, bounded note (maximum 1,000 characters) and timestamp. Events are append-only so later updates do not erase the earlier investigation trail. Supported outcomes are reviewed, awaiting user, re-upload requested, resolved and escalated. This is an audit-only workflow: it does not retry or abort multipart uploads, delete R2 objects, or trigger refunds. The API exposes no R2 object keys, provider upload IDs or file contents through this feature.

## Notification and client refund limits
- Only in-app notification delivery is implemented. Email and WhatsApp preferences are stored, but no outbound provider is configured or called. WhatsApp remains opt-in and disabled by default.
- Client refund requests create a finance-review record only. Finance approval does not initiate a provider refund; processing and reconciliation require a separately reviewed Razorpay workflow.
- Client refund requests are restricted to the authenticated client's own successful `client_advance` or `client_balance` payment and the unreserved remaining amount. Rejected, failed or cancelled requests release the reserved amount.


## Super Admin private bridge (server-to-server only)

These routes are not browser-facing APIs. The CSA Super Admin Worker signs requests with `ADMIN_SYNC_HMAC_SECRET`, timestamp, one-use nonce, and SHA-256 body digest:

- `POST /internal/admin-authorizations/sync` — authoritative admin snapshot; stores source role and Finance access level, revokes identities absent from the snapshot, and rebuilds department grants.
- `POST /internal/superadmin/pricing-policy` — list/upsert country/currency pricing policy; only the Super Admin HMAC bridge can call it.
- `POST /internal/superadmin/finance/refund-dashboard` — read-only refund queue/totals; it never initiates a refund or transfer.
- `POST /internal/superadmin/editor-sessions` — list/revoke editor sessions; Super Admin identity is checked against the allowlist.
- `POST /internal/superadmin/regional-admin-data` — country/Regional Admin management bridge.

Global Admin RBAC is enforced in the API, not just in the dashboard. `project_admin` receives `projects.manage`; `editor_admin` receives `content.manage`; `support_admin` receives `support.manage`; `finance_admin` permissions are derived from `finance_access_level`: `none` grants none, `read` grants `finance.read`, and `write`/`manage` grant `finance.read`, `finance.refunds`, and `finance.payouts`. Unknown admin routes deny by default. The `super_admin` account is not synchronized into Global Admin identities.

The canonical staging database has `global_admin_authorizations.finance_access_level`; migration `0030_global_admin_finance_access_level.sql` adds this field to newly initialized databases. Check the column before applying to an existing D1 because the canonical staging database already contains it.

## Staging schedules
- `csa-global-api-staging`: hourly multipart cleanup for the canonical Global staging D1/R2.
- `csa-global-api-isolated-staging`: separate 15-minute cleanup for its own isolated D1/R2; it is not the Client/Editor Portal API database.
- `csa-superadmin-isolated-staging`: 15-minute Global Admin authorization reconciliation.


### HMAC secret transition

The canonical staging API accepts either `GLOBAL_API_SYNC_HMAC_SECRET` (preferred for the isolated Super Admin Worker) or the legacy `ADMIN_SYNC_HMAC_SECRET`. The isolated Super Admin Worker prefers the dedicated binding and falls back to the legacy binding. The legacy `csa-superadmin-api-staging` continues to use the old secret. Keep the old binding unchanged until that legacy Worker is retired. A cryptographically random 256-bit dedicated secret has been generated once and bound to `csa-superadmin-isolated-staging` and `csa-global-api-staging`; its value is never committed or pasted into chat.


### Current HMAC sync status — 2026-11-22

The dedicated `GLOBAL_API_SYNC_HMAC_SECRET` binding is optional for a future controlled rotation. The existing `ADMIN_SYNC_HMAC_SECRET` fallback is currently working: the scheduled Super Admin sync recorded success with one authorization synchronized at 2026-11-22 08:45 UTC. Do not rotate or remove the existing secret until a coordinated two-Worker rotation has been tested.


### Canonical Regional Admin read bridge

The staging API exposes the signed, private routes `POST /internal/regional/dashboard`, `/projects`, `/clients`, `/editors` and `/tenders`. Requests are timestamp-bound, HMAC-SHA256 authenticated using the dedicated/legacy secret verifier, nonce-replay protected, limited to 12 KB, and restricted to an exact path-to-permission mapping. The Super Admin Worker is the trusted caller and checks the live Regional Admin session, active assignment, country legal state and permission level before signing.

All client/editor rows are filtered on authoritative `users.country_code`; project/tender rows use `v_project_country_scope`, which derives scope from the verified Client `users.country_code`. Self-reported profile country is never an authorization key. Regional finance/refund endpoints remain denied pending separate legal and finance approval. The current isolated Super Admin Worker calls `csa-global-api-isolated-staging` (D1 6a32) for Regional Admin data. The canonical `csa-global-api-staging` Worker also exposes the same HMAC-protected Regional Admin read routes as a future consolidation path, but it is not the active Regional Admin portal data source. The two D1 databases are not live-replicated.


### Staging storage note

The canonical API (D1 470) and isolated API (D1 6a32) share the same R2 `MEDIA` bucket `csa-global-media-staging`, plus legacy-video D1 2d3... and bucket `csa-global-video-isolated-staging`. This is logical D1 separation, not physical object-storage separation. Keep every upload/download/complete/abort operation tied to an authenticated project/assignment record; cross-account media isolation remains a required live E2E test before launch.


### Dedicated HMAC secret provisioned — 2026-11-22 09:43 UTC

- Cloudflare generated and stored one random 256-bit `GLOBAL_API_SYNC_HMAC_SECRET` on both canonical Staging Workers. Secret values are not recorded in source control or chat.
- Cloudflare confirmed the binding exists on both Workers and created a 100% traffic deployment version on each.
- The next Super Admin cron (`*/15 * * * *`) is the runtime acceptance check. The most recent recorded scheduled sync before this secret deployment was successful at 09:30:46 UTC; confirm a new post-deployment scheduled record before closing this item.
