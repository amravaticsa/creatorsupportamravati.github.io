# Super Admin → CSA Global authorization sync integration

Status: sender and receiver are deployed to the two staging Workers. The shared HMAC secret is configured on both staging Workers. Migration 0012 is applied to staging D1. Static deployment checks passed; an end-to-end sync using a real test admin invitation is still pending.

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

The same randomly generated high-entropy `ADMIN_SYNC_HMAC_SECRET` is now configured as a secret binding on both staging Workers:
- `csa-superadmin-api-staging`
- `csa-global-api-staging`

Presence of both secret bindings was verified without reading their values. The secret is not in source control, plain-text Worker vars, browser JavaScript, logs, or chat.

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

Deployed to staging only:
- Global API receiver with corrected HMAC newline canonicalization and timestamp/email validation.
- Super Admin sender helper, invitation-acceptance hook, admin role/status update hook, and Super Admin-only manual retry endpoint.
- Shared HMAC secret bindings on both staging Workers.

Verified: both Workers report the `staging` environment; both expose the secret binding; source markers for the sender/hooks and receiver/replay guard are present; the staging D1 authorization table currently has zero rows. No live admin sync has yet been performed, because no test admin invitation has been accepted for this integration test.

Production Workers, production D1, production R2, DNS, and payment settings remain untouched.

## Security review finding — Global role permissions

The synchronization receiver preserves each Super Admin role in `source_role`, but the current Global API login flow creates all invited administrators with the single Global role `admin`. The Global API authorization helper currently checks only that the email has an active registry row; it does not enforce the synchronized `source_role` against individual admin routes. Consequently, the four source roles (`project_admin`, `editor_admin`, `finance_admin`, and `support_admin`) currently have the same Global API admin permissions.

This is a known authorization gap, not a verified role-based access-control implementation. Do not invite real Global administrators or enable production access until a least-privilege route-to-role matrix is approved and enforced server-side. The role names alone are not sufficient to infer the intended permission boundaries. Keep this item open rather than silently assigning permissions.

Suggested review categories for the owner to approve:
- Project workflow: project review, matching, offers, assignments, quality-control decisions.
- Editor operations: editor verification and editor account review.
- Finance: payment, deposit, refund and finance records.
- Support: read-only account/project lookup and support actions.

Every write route must enforce its own server-side permission; hiding UI controls is not an authorization boundary.
