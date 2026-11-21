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

### Confirmed source-of-truth permission model

The staging Super Admin Worker already defines these role permissions:
- `super_admin`: full administrative permissions.
- `project_admin`: `projects.manage`, `admins.read`.
- `editor_admin`: `content.manage`.
- `finance_admin`: `finance.read`.
- `support_admin`: `support.manage`.

The Super Admin Worker checks these permissions for its own admin-management endpoints. The Global API does not currently consume this permission list: its `user()` guard checks only that an email has an active authorization row, and the Google login flow creates a Global `admin` identity for every invited source role. Therefore, the source role is synchronized but not yet enforced by Global API routes.

### Global API route families found during staging review

- Project operations: project listing, offer creation/assignment, quality-control review, project overview.
- Editor operations: verified/pending editor lists and editor verification.
- Finance operations: eligible-deposit/refund listing and refund action.
- Administration/content: agreement listing, creation and activation.
- Shared support visibility: project/file and operational views.

Before implementation, each route must be assigned a permission and every write route must check it server-side. In particular, the current `support_admin` permission name does not establish whether support staff may view financial or editor-sensitive data. No role has been granted new Global permissions as part of this review.

## Global API role-based access control — staging deployment

Implemented in `global-platform/api/src/index.js` and deployed to `csa-global-api-staging` on 2026-11-19. The Global API now loads `source_role` from the active authorization row on every admin request and applies server-side permissions. Unknown or unmapped admin routes fail closed.

Current route permission mapping:
- `project_admin` — `projects.manage`: project listing, pending submission review, QC decisions, offer creation/assignment, ready-offer listing, and project source-file access.
- `editor_admin` — `content.manage`: editor verification queues/actions, agreement management, and submission-file access.
- `finance_admin` — `finance.read` and `finance.refunds`: eligible refund review and refund initiation. Refund initiation is a distinct write permission; read permission alone cannot trigger a refund.
- `support_admin` — `support.manage`: multipart upload operations, inspection, and incident history/resolution notes.
- Overview metrics are available to any one of the four authorized module roles.
- File downloads are checked after the file record is resolved: project source files require `projects.manage`; editor submission files require `content.manage`.

Deployment verification:
- Worker deployment succeeded; startup time reported by Cloudflare was 2 ms.
- Deployed source contains the role permission guard and explicit finance refund permission.
- Worker environment remains `staging`; the HMAC secret binding remains present.
- Global authorization rows: 0; sync nonce rows: 0. No admin access was created during this change.

Limitations:
- This is static/deployment verification only. No authenticated role-by-role HTTP tests have been performed because there are no accepted test invitations/accounts yet.
- The current four-role map should be reviewed against actual business duties before real admin invitations. Do not enable production access until role-by-role tests pass.


## Sync monitoring and operator controls (2026-11-21)
- The deployed staging Super Admin Worker now writes a row to `global_admin_sync_logs` for every lifecycle-triggered, scheduled, and manually retried sync.
- Each row stores trigger type, success/failure, synchronized record count, bounded error code, start/finish timestamps, and optional actor admin ID. HMAC material and payload contents are never logged.
- Super Admin-only endpoints:
  - `GET /api/admins/global-sync-status` returns the latest attempt and up to 20 recent attempts.
  - `POST /api/admins/sync-global` performs an authenticated manual retry and records the result.
- The Super Admin Central Control page includes a Global Admin Sync Health panel and a Retry Sync Now control.
- Cron remains `*/15 * * * *` (every 15 minutes). The scheduled handler records success or failure in the same log.
- Staging D1 migration: `0013_global_admin_sync_logs.sql`. It has been applied to staging D1 and verified.
- Deployment is staging-only. No production Worker, database, credentials, or payment configuration was changed.
- End-to-end runtime success still requires a real Cloudflare Access-authenticated Super Admin session; do not treat deployment acceptance as proof of a successful HMAC sync.


## Runtime sync verification — 2026-11-21 (supersedes earlier pending-test notes)
- Cloudflare D1 logs now show repeated real scheduled executions with `outcome=success`, `synced_count=1`, and no error code. The 20 most recent log rows include 15 consecutive scheduled successes and one successful lifecycle run; the remaining rows are earlier scheduled successes.
- Latest observed scheduled success: 2026-11-21T10:45:22Z to 10:45:23Z (UTC). The 15-minute Cron Trigger is still configured as `*/15 * * * *`.
- Global staging D1 confirms one active `editor_admin` authorization. The historical `super_admin` row remains revoked; active `super_admin` authorization count is zero. Department grants exist only for the active editor-admin source record; none exist for the revoked Super Admin record.
- This proves the scheduled sender → signed receiver path is executing successfully in staging and the role-exclusion state remains enforced in the resulting authorization data. It does not prove every role's protected API routes by authenticated HTTP tests.
- Manual Retry Sync Now has not been invoked through a logged-in Super Admin browser session. No test invitation or new account was created for this verification. Production remains untouched.


## Admin route-permission audit — 2026-11-21
- A static route-map audit found that the Global API fail-closed permission resolver did not map the pending-editor queue or verified-editor list. Those admin routes were therefore denied to every synchronized admin role, despite being present in the admin UI.
- Fixed and deployed to `csa-global-api-staging` only:
  - `GET /v1/admin/editors/pending` → `content.manage` (Editor Admin).
  - `GET /v1/admin/editors/verified` → `projects.manage` OR `content.manage` (Project Admin or Editor Admin), because verified-editor selection is needed for project matching and editor operations.
  - KYC queue, preview, review and credential issuance remain under `content.manage`.
- GitHub staging source commit: `511ba617f6ad42f283a5e44908263a7dcb349902`.
- Cloudflare staging deployment ID: `f7d2595ec74b488490a82e2c4f9bd3b5`; deployed entry point `index.js`; startup time 1 ms. The deployed module was patched in place to preserve its existing staging-only code, rather than replacing it with a non-identical repository copy.
- Post-deploy verification confirmed both new route mappings in deployed source and preserved D1, R2, OAuth, origin and staging environment bindings.
- This is static permission/deployment verification. Authenticated HTTP tests for each role remain pending; no role assignments, production resources or client records were changed.


## RBAC regression test suite — 2026-11-21
- Added `global-platform/api/tests/rbac-route-map.test.mjs`, a Node built-in test suite that extracts the deployed permission resolver and role map from the Worker source and checks Project, Editor, Finance and Support role boundaries, shared views, explicit refund-write permission, and fail-closed behavior for unmapped routes.
- Added the test to `.github/workflows/csa-global-validation.yml` so staging pushes and pull requests run it alongside syntax validation.
- Test coverage also asserts that `super_admin` is absent from the synchronized Global role map and that CSA pricing policy remains explicitly restricted by the separate Super Admin-only handler guard.
- GitHub staging commits: test suite `3564a6018c80f35841d9d6667bdfe8a44fab504b`; workflow integration `72ed0e04a17005d39cac7b486ce1502cfc538a7f`; pricing-guard assertion clarification `73b296ca3461ca02c29237ad4cd339fc57579a3a`.
- This is automated static regression coverage, not authenticated live HTTP testing. Workflow execution status has not yet been confirmed. No production deployment or role/account changes were made.

## Pricing policy boundary (staging)

The Global API pricing-policy routes are intentionally fail-closed for all synchronized Global Admin roles (`GET` and `POST /v1/admin/pricing-policy` resolve to `__deny__`). The handler also retains its explicit Super Admin-only guard. Do not add `super_admin` to `GLOBAL_ROLE_PERMISSIONS`, do not grant `projects.manage` as a workaround, and do not expose pricing controls in the Super Admin dashboard until a dedicated HMAC-authenticated Super Admin-to-Global API bridge is implemented with timestamp, nonce/replay protection, audit logging, and end-to-end tests. The Global staging `csa_pricing_policies` table currently has no policy rows; no pricing values were created or changed by this security hardening. Production remains untouched.
