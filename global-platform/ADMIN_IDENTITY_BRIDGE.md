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


## Receiver implementation prepared (not deployed)
- `global-platform/api/src/index.js` now contains a staging-only `POST /internal/admin-authorizations/sync` receiver in GitHub source.
- The receiver requires `ADMIN_SYNC_HMAC_SECRET`, a 60-second timestamp window, a unique nonce, and an HMAC-SHA256 signature over method, exact path, timestamp, nonce and SHA-256 request-body digest. It rejects oversized/invalid/duplicate snapshots and unknown roles.
- Snapshot application revokes all previously synchronized authorizations, then upserts the supplied authoritative snapshot in a single D1 batch. Admin API authorization also checks the active registry on each request, so a suspended/revoked admin is blocked even if their Google token remains valid.
- Migration `0012_admin_sync_nonces.sql` creates the replay-protection nonce store. It has been applied and verified on CSA Global Staging D1 only.
- The receiver is not deployed. `ADMIN_SYNC_HMAC_SECRET` has not been created or installed. The Super Admin sender/lifecycle hooks are not implemented. No sync records have been inserted. Production remains untouched.


## Security hardening — Super Admin excluded from Global Admin sync (2026-11-21)
- Review of the deployed staging Workers found that the sender snapshot included the `super_admin` account and the Global receiver accepted `super_admin` as a synchronized Global role. The Global API permission map also contained a full-access `super_admin` role.
- Staging D1 was checked before remediation: it contained two authorization rows (`super_admin` and `editor_admin`), and neither row matched an active Global Admin user. No active Global Admin account was receiving access from those rows.
- Both staging Workers were updated successfully without changing Worker bindings or reading/replacing any secrets:
  - Super Admin sender now excludes `super_admin` from the snapshot.
  - Global receiver now rejects `super_admin` records.
  - Global API no longer defines Global permissions for `super_admin`.
  - Department access mapping no longer grants a Global department set to `super_admin`.
- The stale `super_admin` authorization row was also explicitly changed to `revoked`, and its eight Global department grants were removed. The independent Super Admin account remains active in the Super Admin system. Do not treat the end-to-end lifecycle as fully tested until a fresh sync and role-specific tests are performed.
- Production remains untouched.


## Environment routing hardening (2026-11-21)
- The Super Admin sync helper now selects the Global API endpoint from the Worker `ENVIRONMENT` binding: staging uses the staging Global API and production uses the production Global API.
- The same change is deployed to the staging Super Admin Worker and committed to the staging source branch.
- No production Worker or production D1 data was changed. Production Super Admin Worker and shared-secret configuration are still not provisioned.
- End-to-end sync has not yet been authenticated and exercised. The route requires an active Super Admin session; do not use a database-only assertion as proof of a successful signed sync.
