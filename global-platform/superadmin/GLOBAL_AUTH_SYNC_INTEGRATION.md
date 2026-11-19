# Super Admin → CSA Global authorization sync integration

Status: helper source committed to the `staging` branch; it is NOT imported into or deployed with the Super Admin Worker yet. The Global API receiver exists in Global API staging source, and replay-protection migration 0012 is applied to the staging D1 database.

## Source helper

`global-platform/superadmin/global-admin-sync.js` exports `syncGlobalAdminAuthorizations(env)`.

The helper:
- Reads the complete authoritative snapshot from `admin_accounts`.
- Excludes the `super_admin` account and all pending invitations.
- Maps `active` to active, `suspended` to suspended, and all other non-pending statuses to revoked.
- Signs the exact receiver canonical string with HMAC-SHA256.
- Sends a unique nonce and timestamp to the staging Global API.
- Throws on any non-2xx or non-`ok` response; callers must not report sync success in that case.

## Required Worker secret

Configure the same high-entropy `ADMIN_SYNC_HMAC_SECRET` as a secret binding on:
- `csa-superadmin-api-staging`
- `csa-global-api-staging`

Do not put the secret in source control, plain-text Worker vars, browser JavaScript, logs, or chat. Secret provisioning has not been completed.

## Required lifecycle hooks in Super Admin Worker

Import the helper:

```js
import { syncGlobalAdminAuthorizations } from "./global-admin-sync.js";
```

1. In `acceptInvite(req, env)`, after the account status has successfully changed from pending to active and after the audit entry, call `await syncGlobalAdminAuthorizations(env)`. If sync fails, return HTTP 202 with `global_sync: "pending_retry_required"`; do not claim that Global access is ready.
2. In `updateAdmin(req, env, u, aid)`, after the role/status update and audit entry, call the same helper. On failure, return HTTP 202 with the same pending marker.
3. Add an authenticated `POST /api/admins/sync-global` route, restricted to `adminOnly(u)`, to retry a full snapshot after a transient outage. Return the number synchronized only after the receiver confirms success.
4. Do not sync on invitation creation. Pending invitations must never receive Global authorization.
5. Do not add or sync the `super_admin` role. The Global authorization receiver must continue to reject it.

## Verification before enabling

- Confirm both Worker secret bindings exist without reading or printing their values.
- Deploy the sender and receiver to staging only.
- Accept a test invitation and confirm the Global authorization row is created.
- Suspend the test admin and confirm the row is suspended and protected Global API requests are denied.
- Reactivate, change role, and revoke/deactivate; verify each transition.
- Replay the same signed nonce and verify the receiver rejects it.
- Test a missing/incorrect secret and verify fail-closed behavior.
- Confirm the Super Admin identity is never present in `global_admin_authorizations`.

## Current deployment boundary

No Super Admin Worker source deployment has been made by this integration commit. No secret has been provisioned. No admin authorization rows have been inserted. Production Workers, production D1, production R2, DNS, and payment settings remain untouched.
