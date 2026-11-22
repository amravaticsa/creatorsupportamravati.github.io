# CSA Legacy Editor Bridge Secret Setup (Staging)

Date: 2026-11-22  
Scope: isolated staging Workers only.

## Secret provisioned

A new, independent 256-bit random secret has been created directly in Cloudflare Worker Secrets under the binding name:

`CSA_LEGACY_BRIDGE_SECRET`

It is present on both:
- `csa-global-api-isolated-staging`
- `csa-editor-portal-isolated-staging`

The secret value is intentionally not recorded in Git, logs, chat, or this document.

## Existing authorization secret preserved

The existing `ADMIN_SYNC_HMAC_SECRET` on the Global API Worker remains present and was not changed. It continues to serve the existing Super Admin/Admin authorization synchronization contract. The Editor Portal does not currently have that secret, and no change was made to it.

## Implemented in source (staging snapshot)

- Added a staging-only HMAC verifier to the isolated Editor Portal Worker.
- The canonical signature binds timestamp, nonce, HTTP method, exact request path, and SHA-256 body digest.
- Timestamp freshness is limited to 5 minutes; signature comparison is constant-time.
- Added POST `/editor-api/internal/legacy-bridge/health`, restricted to the dedicated staging Admin host and the `bridge-readiness` purpose.
- Added `0027_legacy_bridge_nonces.sql` for one-time nonce storage and expiry indexing.
- Added a matching staging-only HMAC signer helper in the Global API Worker source. It emits the same `CSA-BRIDGE-V1` canonical signature headers as the Editor Portal verifier; the helper is not yet called by any order or identity transfer flow.
- Editor Portal nonce-store failures now distinguish replay conflicts (409) from unavailable/missing nonce storage (503), while failing closed.
- Added API-suite regression tests for signer/verifier canonicalization and HMAC request binding.
- Added a disposable in-memory SQLite test for migration `0027`, covering nonce uniqueness, expiry cleanup, and the expiry index; the staging CI workflow now runs it without touching remote D1.
- CI validation passed for the staging source changes.

The nonce migration `0027` was applied on 2026-11-22 only to the isolated Editor Portal staging D1 (`csa-video-isolated-staging`, binding `CSA_VIDEO_DB`). The table `legacy_bridge_nonces` and index `idx_legacy_bridge_nonces_expiry` were read back from `sqlite_master` and verified. The disposable SQLite migration test also passed in CI. The updated Editor Portal Worker source was deployed to the isolated staging Worker on 2026-11-22. Cloudflare confirmed deployment ID `9fe7b3aeea9f43e3b2f5162f06359be0` and script tag `f017245bc5644052af0069a28b57ab4e`. The post-deploy settings read-back confirmed that `CSA_LEGACY_BRIDGE_SECRET`, both D1 bindings, the R2 binding, and `ENVIRONMENT=staging` were preserved. External HTTPS runtime probing is still pending; the web access check could not reach the hostname, so no live health-response or signed-request success is claimed. No D1 binding was changed and no editor identity, order, assignment, credential, KYC document, or media record was copied.

## Required next implementation gates

1. The Global API now contains `/internal/superadmin/legacy-bridge/readiness`, a staging-only endpoint authenticated with the existing Super Admin ↔ Global API HMAC. It consumes a one-time `admin_sync_nonces` entry, signs a fixed readiness-only request with `CSA_LEGACY_BRIDGE_SECRET`, and calls only the Editor Portal health endpoint. It returns a generic success/failure and no peer payload or customer data.
2. Automated source regression tests cover staging restriction, both secret gates, replay protection, fixed staging peer, and absence of order/identity-transfer operations. Latest API validation passed on commit `e167980ceeafdba3d30760b163fdbc43b63dc81b` (run `44984688273`). The Global API Worker source is NOT deployed, so the new endpoint is not live yet.
3. After separate deployment approval, deploy only `csa-global-api-isolated-staging`, then invoke the readiness route from the Super Admin Worker using its existing `ADMIN_SYNC_HMAC_SECRET` signing convention and verify peer health plus replay rejection.
3. Implement explicit admin-reviewed Global editor ↔ legacy editor mapping; require active account, verified profile, and verified KYC. Never match by email/name alone and never copy password credentials.
4. Implement idempotent order/assignment bridge operations and revocation handling.
5. Only after the above tests pass, revisit the isolated Global API `LEGACY_VIDEO_DB` binding. Preserve all existing bindings and keep production untouched.
6. Deploy Global API bridge source only after the runtime and end-to-end acceptance suite passes.

## Safety note

Do not rotate or reuse `ADMIN_SYNC_HMAC_SECRET` for this bridge. Do not enable the legacy order claim/import path by repointing the D1 binding before the bridge and its authorization controls are ready.


## Super Admin readiness action and scoped Access service token (Nov 22, 2026)

- Added a Super Admin-only POST action at `/api/admins/legacy-bridge-readiness` in the isolated Super Admin Worker source. It rejects non-Super-Admin sessions and non-staging environments, writes an audit event, and returns only a generic readiness result.
- Added `callGlobalLegacyBridgeReadiness` in `global-admin-sync.js`. It signs a fixed readiness-only payload using the existing `ADMIN_SYNC_HMAC_SECRET` and calls the isolated Global API Worker hostname.
- Corrected the Global API receiver's canonical HMAC string to use actual newline separators and strict 10-digit timestamp validation.
- The Global API peer request now expects `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` secrets and sends them only as Cloudflare Access service-token headers.
- Created a dedicated Access self-hosted application scoped to the single path `/editor-api/internal/legacy-bridge/health` on the isolated staging hostname, with a policy allowing only one dedicated service token. This is separate from the broader human Super Admin Access app.
- Created service token `CSA Legacy Bridge Staging Health Probe v2` with a one-year expiry. The unused first token was deleted. The service-token secret is not stored in Git or exposed in documentation.
- **Pending prerequisite:** the Cloudflare Access service-token Client ID and Client Secret still need to be installed as Worker secrets `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` on `csa-global-api-isolated-staging`. Until then, the peer health call will fail closed. No Worker deployment or live bridge request has been performed in this step.
- Automated source regression tests cover the Super Admin route guard, signed request helper, fixed target and Access header usage.
