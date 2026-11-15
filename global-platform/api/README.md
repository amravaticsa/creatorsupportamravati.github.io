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
