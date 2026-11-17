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
- `GET /v1/editor/offers`, `GET /v1/editor/agreements`, `GET /v1/editor/assignments`
- `POST /v1/offers/:id/accept`, `POST /v1/offers/:id/terms`
- `POST /v1/offers/:id/deposit/checkout`, `POST /v1/payments/razorpay/verify`, `POST /v1/webhooks/razorpay`
- `PUT /v1/assignments/:id/submissions`
- Admin: overview, tender queue, editor queues, offer creation, agreement draft/activation, assignment confirmation, QC queue and QC decisions.
- `GET /v1/admin/deposits/refunds/eligible`, `POST /v1/admin/deposits/:paymentId/refund` — full original-method refund, available only after CSA QC approval; one request per deposit.
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

## Private file handling
- R2 bucket is private and not publicly exposed.
- Client source files are only available to the project owner, CSA admins and the assigned editor.
- Editor submissions are private until QC approval; clients can download approved deliverables only.
- Current direct staging upload limit is 90 MB per file. Implement resumable/multipart upload before handling large camera originals.

## Staging-only limitations
- No active legal agreement is seeded. Admin must add and activate a reviewed agreement before editors can accept terms.
- Staging D1 migrations `0001`–`0005` have been applied; verify the target database before any future migration or deployment.
- Refunds require an explicit CSA Admin action after Quality Approved; provider status is reconciled by signed Razorpay refund webhooks. Both the API response and webhook must match the original payment ID, full amount and currency, and a locally recorded CSA refund request before the deposit is marked fully refunded. Refund requests are single-use/idempotency-keyed; mismatches and uncertain provider outcomes are marked unknown for manual Razorpay dashboard reconciliation and must not be retried blindly.
- No automatic email/WhatsApp notifications, editor payout automation, client final sign-off or large-file multipart upload yet.
- Google OAuth settings, admin allowlist and Razorpay encrypted secrets are configured on the staging Worker. Configuration is not proof of end-to-end payment/refund success.
- Keep payment processing in Test Mode. Do not collect live deposits or publish to production until legal review, end-to-end tests and independent security review are complete.
