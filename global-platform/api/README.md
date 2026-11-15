# CSA Global API foundation

Cloudflare Worker API source bound to the dedicated csa-global-platform D1 database.

Implemented routes: GET /health; POST /v1/onboarding/editor; POST /v1/onboarding/client; POST /v1/projects; GET /v1/editor/offers; POST /v1/offers/:id/accept; POST /v1/offers/:id/terms; POST /v1/offers/:id/deposit/checkout (deliberately disabled); GET /v1/admin/overview; POST /v1/admin/editors/:id/verify; POST /v1/admin/projects/:id/offers.

Authentication expects RS256 OIDC JWTs with verified email and matching issuer, audience and JWKS. Set AUTH_JWKS_URL, AUTH_ISSUER, AUTH_AUDIENCE and exact ALLOWED_ORIGINS as Worker variables. D1 binding DB is defined in wrangler.toml. Admin accounts must be provisioned out-of-band.

No real payment checkout, refunds, payouts, private R2 file access, messaging, rate limiting or production launch is enabled. Do not collect real deposits until a provider, legal/cross-border rules, webhook verification, operational controls and security testing are complete.

## Staging deployment
- Worker name: `csa-global-api`
- Staging endpoint: https://csa-global-api.creatorsupportamravati.workers.dev
- Public health route: https://csa-global-api.creatorsupportamravati.workers.dev/health
- D1 binding attached: `DB` → `csa-global-platform`
- Worker deployment uploaded successfully; workers.dev subdomain enabled; preview URLs disabled.
- GitHub Actions syntax validation: passed.

The API is a staging foundation, not a production launch. Identity provider variables are not configured, so authenticated routes are intentionally unavailable. Payment checkout is explicitly disabled.

## Google Identity setup
1. Create a Google OAuth 2.0 Web application client in Google Cloud Console.
2. Add Authorized JavaScript origins: `https://creatorsupportamravati.in` and `https://www.creatorsupportamravati.in` (plus the exact staging origin if the UI is hosted elsewhere).
3. Set Worker plain-text variables `GOOGLE_CLIENT_ID` and `AUTH_AUDIENCE` to the same Web client ID. The Worker already has Google's JWKS URL and issuer configured.
4. The login page uses Google Identity Services and a per-login nonce. The Worker verifies RS256 signature, issuer, exact audience, expiry, issued-at and verified email.

## Razorpay setup
1. Activate Razorpay account and obtain a Test Mode Key ID and Key Secret first.
2. Set Worker variable `RAZORPAY_KEY_ID`; add `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` as encrypted Worker secrets.
3. Configure webhook URL `https://csa-global-api.creatorsupportamravati.workers.dev/v1/webhooks/razorpay` and subscribe to `payment.captured` and `payment.failed`. Copy the webhook secret into the Worker secret binding.
4. Test order creation, payment capture, signature verification, duplicate webhook handling and deposit ledger updates in Test Mode before enabling Live Mode.
5. Razorpay account must be approved for the currencies/cross-border payments intended for international editors. Payment capture must be enabled. Never rely on the browser success callback alone.

## Important controls
- Registration is free; deposit is project-specific and requested only after offer acceptance and active project terms.
- Deposit is held against a single project in the ledger; assignment remains blocked until captured payment is confirmed.
- Client-facing UI must not expose editor email, phone, payout or personal identity fields.
- Do not use Live keys until legal review of security-deposit, refund, dispute, tax and cross-border requirements is complete.
