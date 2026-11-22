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
- CI validation passed for the staging source changes.

The nonce migration has NOT been applied to the remote legacy D1, and the Worker source has NOT been deployed as part of this step. Until the migration is applied, the endpoint fails closed. No D1 binding has been changed and no editor identity, order, assignment, credential, KYC document, or media record has been copied.

## Required next implementation gates

1. Run the signer/verifier regression suite in CI, then add a disposable-D1 runtime probe that exercises a real signed request against the verifier.
2. Execute the nonce migration against a disposable copy of the legacy Editor Portal schema, then apply it only to the isolated legacy Editor Portal D1 after explicit confirmation.
3. Implement explicit admin-reviewed Global editor ↔ legacy editor mapping; require active account, verified profile, and verified KYC. Never match by email/name alone and never copy password credentials.
4. Implement idempotent order/assignment bridge operations and revocation handling.
5. Only after the above tests pass, revisit the isolated Global API `LEGACY_VIDEO_DB` binding. Preserve all existing bindings and keep production untouched.
6. Deploy to isolated staging only after the runtime and end-to-end acceptance suite passes.

## Safety note

Do not rotate or reuse `ADMIN_SYNC_HMAC_SECRET` for this bridge. Do not enable the legacy order claim/import path by repointing the D1 binding before the bridge and its authorization controls are ready.
