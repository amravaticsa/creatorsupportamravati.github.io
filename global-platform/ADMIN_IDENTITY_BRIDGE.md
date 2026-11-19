# CSA Super Admin ↔ Global Admin Identity Bridge

Status: design specification only. No bridge endpoint or credentials are deployed. The GitHub staging API source has the allowlist replacement, but the currently deployed Cloudflare Worker `csa-global-api-staging` was inspected and still runs the old `ADMIN_EMAILS` gate. Do not treat the deployed staging API as updated until a controlled deployment is completed and verified.

## Trust boundary
- The Super Admin Worker is the source of truth for administrator identity, role and status.
- The Global API is the relying party. It must not accept a browser-supplied role, email allowlist, password, or admin-session cookie as proof of administrative authority.
- The Global D1 table `global_admin_authorizations` is a synchronized authorization cache, not an independent account-creation authority.
- A Super Admin invitation in `pending` state must not create an active Global authorization. Synchronize only after invitation acceptance activates the account.
- Role changes and status changes must be propagated. Suspended/deactivated admins must be revoked in Global promptly; the Global API must fail closed if a sync cannot be verified.

## Recommended protocol
1. Configure a dedicated Cloudflare Worker Service Binding on `csa-superadmin-api-staging`, e.g. binding `GLOBAL_API` targeting `csa-global-api-staging`. This avoids a long-lived shared credential in application code or browser JavaScript. Cloudflare documentation confirms service bindings call another Worker without a public URL; however, Cloudflare Access context is not propagated, so the receiving endpoint must still enforce a narrowly scoped internal request contract. If service bindings are unavailable for the deployed worker arrangement, use a dedicated high-entropy HMAC secret stored as a Worker secret on both services; never put it in Pages variables or client code.
2. Each sync request is server-to-server and contains a bounded list of admin records: immutable Super Admin account ID, normalized verified email, allowed Global role mapping, status, and monotonic revision/update timestamp.
3. Authenticate every request. For HMAC fallback, sign method + canonical path + timestamp + unique nonce + SHA-256 body digest. Reject timestamps outside 60 seconds, invalid signatures, duplicate nonces, unexpected issuer, oversized bodies, unknown roles, and malformed email. Store consumed nonces with a short TTL to prevent replay.
4. Global API upserts by `source_admin_id` and email; unique constraints prevent duplicate mapping. Only allow explicit role mapping:
   - `project_admin` → Global admin (project permission scope to be defined)
   - `editor_admin` → Global admin (editor/content scope to be defined)
   - `finance_admin` → Global admin (finance scope to be defined)
   - `support_admin` → Global admin (support scope to be defined)
   Never map `super_admin` into a second Global super-admin.
5. On role/status change, revoke Global API sessions for that admin identity and ensure new sessions reflect the current role. Do not rely only on a stale JWT role claim.
6. Google login may establish the user's verified Google subject, but it may only bind to an already synchronized active authorization. It must not create authorization based on `ADMIN_EMAILS`.
7. Make sync idempotent. Retry transient failures with bounded exponential backoff; log only source ID, action, result and request ID (never credentials or OTPs). A failed sync after invitation acceptance must leave Global access denied and surface a clear admin-side sync status.

## Lifecycle hooks to implement
- `acceptInvite`: after account status changes from pending to active, enqueue/perform an authorization sync.
- `updateAdmin`: after role/status change, synchronize the resulting active/suspended/deactivated state and revoke Global sessions.
- Admin removal: represent as revoked/deactivated state, not a hard delete that loses audit history.
- Add a Super Admin UI status indicator for last successful sync and retry action.

## Required staging tests
- Uninvited allowlisted Google email with `role=admin`: denied.
- Pending invite: denied.
- Accepted active invitation with valid sync: allowed only for mapped role.
- Tampered body/signature, expired timestamp, replayed nonce, wrong audience/path: denied.
- Suspended/deactivated source account: Global session revoked and next login denied.
- Role downgrade/change: old permissions removed, no stale session retains prior access.
- Existing client/editor flows remain unchanged.
- No production Worker, D1, R2, DNS, or live payment changes during staging tests.

## Deployment order
1. Confirm Service Binding availability or provision HMAC secret in both staging Workers.
2. Deploy Global API internal sync receiver and its migration to staging.
3. Deploy Super Admin sender and lifecycle hooks to staging.
4. Test invite → accept → sync → Global sign-in, then suspend/revoke and verify session invalidation.
5. Only after all tests and security review, prepare production backup, production migrations, production worker config and a separate approved production rollout.


## Verified deployment gap (2026-11-19)
- GitHub `staging` source `global-platform/api/src/index.js` checks `global_admin_authorizations` and rejects uninvited admin sign-ins.
- The deployed Cloudflare Worker `csa-global-api-staging` was separately inspected and still checks `ADMIN_EMAILS` and can insert a Global admin identity from that allowlist.
- Therefore the source change is not live. The staging API must be updated only after the authenticated sync receiver is implemented and tested, then deployed as a complete Worker version. Until then, the old runtime remains a known staging-only security gap; do not use it for admin onboarding.
- Super Admin Worker currently has no Service binding in its deployed settings. No binding was added and no Worker was redeployed during this investigation.
