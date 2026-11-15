# CSA Global — Managed Worldwide Editing Platform

## Operating decisions
- Project allocation: CSA-managed; clients do not select or contact freelancers directly.
- Editor registration: open worldwide and free.
- Client payment: collected by CSA.
- Editor flow: Google sign-in → profile verification → project offer → accept → review project-specific agreement → project-specific security deposit → CSA confirms assignment.
- A deposit is never charged at editor registration or simply for receiving an offer.
- CSA remains the client-facing service manager and performs quality review before client delivery.
- Editors are independent contractors; client-facing messaging must not falsely describe them as CSA employees.

## Staging URLs
- Frontend: https://csa-global-staging.pages.dev
- Latest deployment snapshot: https://c106a3f4.csa-global-staging.pages.dev
- API: https://csa-global-api.creatorsupportamravati.workers.dev
- API health: https://csa-global-api.creatorsupportamravati.workers.dev/health
- Client/editor sign-in: `/login.html`
- Admin sign-in: `/admin-login.html`
- Staff/admin portal: `/portal.html`

## Cloudflare staging resources
- Worker: `csa-global-api`
- D1 database: `csa-global-platform` (21 application tables; migrations 0001–0004 applied)
- R2 bucket: `csa-global-media-staging` (private, APAC location hint; Worker binding `MEDIA`)
- Pages project: `csa-global-staging` (Direct Upload staging deployment)
- Existing production CSA website and `csa-orders` database were not changed.

## Implemented API and UI foundations
- Google Identity Services UI and backend RS256 ID-token validation with nonce, issuer, exact audience, expiry, issued-at and verified-email checks.
- Client onboarding and detailed project tender submission, client-set budget and project history.
- Worldwide editor onboarding and verification queue.
- Admin allowlist gate using `ADMIN_EMAILS`.
- Admin tender queue, editor verification, managed offers, agreement draft creation/activation, deposit verification and assignment confirmation.
- Editor offer inbox, agreement acceptance, Razorpay order creation and server-side payment verification.
- Razorpay webhook signature verification and duplicate-event protection.
- Private R2 source-file upload/download with role and assignment checks (90 MB per-file staging request limit).
- Editor assignment inbox, source-file access and work submission.
- Admin QC approve/request-changes flow and client access to approved deliverables.
- Audit log, payment ledger and deposit ledger.

## Required Cloudflare Worker variables
Set under Workers & Pages → csa-global-api → Settings → Variables and Secrets:
- `GOOGLE_CLIENT_ID`: Google OAuth Web Client ID (public identifier).
- `AUTH_AUDIENCE`: same Google OAuth Web Client ID.
- `RAZORPAY_KEY_ID`: Razorpay Test Mode Key ID (public identifier).
- `ADMIN_EMAILS`: comma-separated Google email(s) authorized for admin access.
- Existing variables `AUTH_ISSUER`, `AUTH_JWKS_URL`, `ALLOWED_ORIGINS`, `ENVIRONMENT` are already configured.

## Required encrypted Worker secrets
Add using Secret type, never as plain text:
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

## Google OAuth setup
Create a Google OAuth 2.0 Web application client. Add Authorized JavaScript origins:
- `https://csa-global-staging.pages.dev`
- `https://creatorsupportamravati.in` only if the application will also be served there.
Set the client ID in both `GOOGLE_CLIENT_ID` and `AUTH_AUDIENCE`. Add the admin's exact Google email to `ADMIN_EMAILS`.

## Razorpay test setup
- Start with Test Mode keys only.
- Configure webhook URL: `https://csa-global-api.creatorsupportamravati.workers.dev/v1/webhooks/razorpay`
- Subscribe to `payment.captured` and `payment.failed`.
- Store the webhook signing secret as `RAZORPAY_WEBHOOK_SECRET`.
- Confirm payment capture and currency/cross-border activation with Razorpay before international testing.
- Do not switch to Live Mode until legal review of deposit, refunds, disputes, tax and cross-border rules is complete.

## Remaining production gates
- Google OAuth client ID and admin email allowlist have not yet been supplied/configured.
- Razorpay test credentials and webhook secret have not yet been added; checkout is fail-closed until then.
- No active project agreement is seeded. Admin must save a legally reviewed agreement draft and explicitly activate it before editor terms acceptance can proceed.
- Large video uploads need resumable/multipart upload support; current staging uploader is limited to 90 MB per file.
- End-to-end browser testing with real Google and Razorpay test accounts, operational policies, backup/restore, rate limiting/abuse controls and an independent security review are still required.
- Frontend is on a separate staging Pages project and is not merged into the live CSA website.

Never commit secrets or ask users to enter real payment credentials into the public forms or repository.
