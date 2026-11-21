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
## Super Admin pricing control bridge (staging)

- The Global API exposes `POST /internal/superadmin/pricing-policy` only for signed server-to-server requests. It checks the staging environment, a 60-second timestamp window, a SHA-256 body digest, HMAC-SHA256 signature, a one-time nonce in `admin_sync_nonces`, and strict currency / basis-point / minor-unit validation.
- The Super Admin Worker exposes `/api/pricing-policy` and a separate `/pricing-policy` page. Both require a valid active Super Admin session; the dashboard navigation item is hidden for non-Super-Admin roles.
- Supported operations: read configured country policies and recent audit entries; create/update a country's margin, minimum margin, and client advance percentage. Each successful update writes a Global audit entry and a Super Admin audit entry.
- The Global Admin pricing routes remain fail-closed and the synchronized Global role map still excludes `super_admin`.
- Both Worker changes are deployed to staging only. Production is unchanged.

### Deployment verification and remaining prerequisite

- Global API staging bridge deployment: `78115c6f4ebd4f7480d78221aeb1c54f`.
- Super Admin staging dashboard/API deployment: `52ebc0c3e4384d8495785ec19dd1a9a7`.
- Cloudflare metadata currently shows an `ADMIN_SYNC_HMAC_SECRET` secret binding on both `csa-superadmin-api-staging` and `csa-global-api-staging`. Secret values are write-only and were not read; matching binding names do not prove matching values. The signed bridge handshake and authenticated Save/Load remain unverified. Do not paste secrets into chat or rotate them as part of this task.
- No pricing policy rows have been created or modified. The dashboard is installed but end-to-end Save/Load is pending the matching staging secret.
- Never add this secret to production as part of this staging task. Production remains untouched.

### Pricing schema regression hardening

- Updated `global-platform/migrations/0023_tenders_pricing_quotes.sql` so a fresh staging database defines `client_advance_bps` with a 1–10000 basis-point CHECK constraint, matching the currently inspected Global staging D1 schema.
- Extended `global-platform/api/tests/rbac-route-map.test.mjs` to assert the CSA margin, minimum margin, client advance and unconfigured-by-default constraints.
- This was a source migration/test update only; no D1 migration was run and no pricing data was changed.


### Admin hostname and environment isolation audit (2026-11-21)

- Cloudflare custom-domain metadata currently maps both `admin.creatorsupportamravati.in` and `superadmin.creatorsupportamravati.in` to the Worker script `csa-superadmin-api-staging`. The Worker's environment binding is `ENVIRONMENT=staging`; its custom-domain metadata reports the default Worker environment as `production`. The hostname guard in the Worker intentionally permits non-Super-Admin roles on the `admin` host and only the `super_admin` role on the `superadmin` host.
- This is a deployment-isolation concern: the script named `staging` is attached to the official admin hostnames. No hostname, route, Worker, Access policy, or database binding was changed during this audit. Do not create a production Worker, move custom domains, or repoint routes without an explicit migration plan and a verified replacement.
- The Cloudflare execution environment blocks outbound requests to the admin hostname with a tool-level 403, so it cannot be used to prove live route behavior. The connected browser showed an authenticated Super Admin dashboard, but its rendered navigation did not include the Pricing Policy item even though the deployed HTML contains the item and the served-app source contains a Super-Admin visibility condition. A browser refresh / authenticated route check is still required; this discrepancy is not yet diagnosed.
- The Super Admin Worker contains authenticated `GET /pricing-policy` and `GET/POST /api/pricing-policy` handlers, guarded by an active Super Admin session. Do not treat source presence as proof of successful HMAC Load/Save. Global D1 currently has zero configured pricing-policy rows; no live pricing data was created or modified.
- Before the next Worker deployment, establish separate staging and production admin Workers / hostnames and validate Cloudflare Access coverage, D1 bindings, and role routing. Keep the existing official hostname mapping unchanged until the replacement is tested.


### Cloudflare Access and overlapping route audit (2026-11-21)

- Read-only Cloudflare account audit confirmed the only self-hosted Access application named `CSA Super Admin Staging` is scoped to `admin.creatorsupportamravati.in/api/bootstrap`; its allow policy is limited to the configured Super Admin email. It does not cover the full `superadmin.creatorsupportamravati.in` hostname.
- The `superadmin` hostname has distinct Worker routes for `/rush-approvals*` and `/rush-api/*` (Rush Admin Worker), `/editor-management*` and `/editor-api/*` (Editor Portal Worker), and a catch-all `/*` route (Super Admin Worker). Preserve these specific route boundaries when planning hostname or Access changes.
- Applying a blanket Cloudflare Access application to the entire `superadmin` hostname with the existing Super Admin-only allow policy could unintentionally block Editor/Rush workflows and their intended user populations. No Access application, policy, DNS record, Worker route, custom domain, or binding was modified.
- Read-only settings inspection confirmed the Super Admin staging Worker has D1 `DB`, R2 `ATTENDANCE_MEDIA`, staging environment configuration and secret bindings; the Global staging Worker has its separate D1 bindings and payment secret bindings. Secret values were not read. These binding names alone do not establish that database contents or secret values are safe to reuse across environments.
- No isolated Super Admin staging hostname or separate production Super Admin Worker was verified in the current account inventory. Keep official hostnames and existing route order unchanged. Next migration must first create a separately protected staging hostname and test all Super Admin, Editor and Rush paths before moving any official hostname.
- This was a configuration inventory only. No user data, credentials, payment settings, DNS, Access policies, or production resources were changed.


### Isolated staging hostname provisioning (2026-11-21)

- Created Cloudflare Access self-hosted application `CSA Super Admin Isolated Staging` for `superadmin-staging.creatorsupportamravati.in`, with a 1-hour session, existing identity provider, and an allow-only policy for the configured Super Admin identity. No public/bypass policy was added.
- Added Worker Custom Domain `superadmin-staging.creatorsupportamravati.in` to `csa-superadmin-api-staging`; Cloudflare provisioned a proxied AAAA record and TLS certificate. Preview routing is disabled.
- Configuration read-back verified the Access app and allow policy, custom domain, proxied DNS record and enabled Worker domain.
- Cloudflare reports the custom domain's default Worker environment as `production`; this is the default Workers environment label, not proof that the script's plain-text `ENVIRONMENT` binding is production. The attached script remains the staging-named Worker; its actual runtime host guard must be updated and verified before this hostname is considered usable.
- Read-back also shows two specific routes on the new hostname: `/editor-management*` and `/editor-api/*` map to `csa-editor-portal`. They were not created or changed in this step. The whole hostname is covered by the new Super Admin-only Access application; verify these intended paths and editor-role expectations before enabling broader access.
- Important pending code check: the deployed Super Admin hostname allowlist was previously confirmed to accept `superadmin.creatorsupportamravati.in` only. Until the staging hostname is explicitly added to the staging Worker host guard and verified through an authenticated browser session, expect the application to reject or fail closed on this new hostname. Do not direct normal users to it yet.
- The official `admin` and `superadmin` hostnames, their custom domains, existing routes and existing Access application were not modified. No production Worker, database, payment configuration or client data was changed.


### Staging hostname follow-up audit — 2026-11-21

- `superadmin-staging.creatorsupportamravati.in` is attached as a Worker Custom Domain to `csa-superadmin-api-staging`.
- The Super Admin Worker `portalRoleAllowed()` currently allows `superadmin.creatorsupportamravati.in` only for `super_admin` and `admin.creatorsupportamravati.in` for non-Super-Admin roles. It does not yet allow the isolated staging hostname. Add the staging hostname as a Super-Admin-only host; do not broaden the role condition.
- The two staging-host routes currently target the **production** Editor Portal Worker:
  - `superadmin-staging.creatorsupportamravati.in/editor-management*` → `csa-editor-portal`
  - `superadmin-staging.creatorsupportamravati.in/editor-api/*` → `csa-editor-portal`
- The production Editor Portal Worker is bound to production resources: D1 `CSA_VIDEO_DB` database `72a5d236-1ae1-4362-9a51-e6fb9b9840c8` and R2 bucket `csa-video-editing`. Its source hardcodes the admin host `superadmin.creatorsupportamravati.in` and production editor host. Do not route staging traffic to this Worker.
- A separate `csa-editor-portal-staging` Worker exists and is bound to staging resources: D1 `CSA_VIDEO_DB` database `69f070a4-b71f-4448-973f-31993715b781` and R2 bucket `csa-video-editing-staging`. Its current source also hardcodes the old Super Admin host in both the `/editor-management` page guard and the `/editor-api/*` admin API guard.
- Required staging-only correction before testing:
  1. Add `superadmin-staging.creatorsupportamravati.in` to `portalRoleAllowed()` as `super_admin` only.
  2. Update the **staging Editor Portal Worker source only** so `/editor-management` and the admin `/editor-api/*` branch accept the new staging host; update its admin-origin constant to the staging host.
  3. Change only the two `superadmin-staging` route targets to `csa-editor-portal-staging`. Preserve all official `superadmin` host routes and the two production Editor Portal route targets unchanged.
  4. Verify Cloudflare Access remains enforced for the whole staging hostname and test both Editor Management routes with a valid Super Admin session; verify unauthenticated requests return 401 and that staging data bindings are used.
- No Worker source, Worker deployment, route, Access policy, DNS record, database, or production resource was modified in this follow-up audit. The staging hostname must remain unavailable for normal use until all four corrections and authenticated route tests pass.

### Staging hostname implementation — 2026-11-21

The following staging implementation has now been applied and read back from Cloudflare:

- Super Admin Worker `csa-superadmin-api-staging`:
  - `portalRoleAllowed()` now accepts both `superadmin.creatorsupportamravati.in` and `superadmin-staging.creatorsupportamravati.in` for the `super_admin` role only.
  - The existing `admin.creatorsupportamravati.in` non-Super-Admin rule is unchanged.
  - Existing module files were retained during upload. Existing secret bindings were retained using Cloudflare `keep_bindings`; secret values were not read.
  - The `ENVIRONMENT` binding remains `staging`; D1 `DB` remains the staging database.
- Editor Portal Worker `csa-editor-portal-staging`:
  - `ADMIN_ORIGIN` now uses `https://superadmin-staging.creatorsupportamravati.in`.
  - The `/editor-management` host guard and admin `/editor-api/*` host guard now accept the staging hostname.
  - Staging D1 and R2 bindings remain attached (`CSA_VIDEO_DB` → staging database; `CSA_VIDEO_BUCKET` → `csa-video-editing-staging`; `CSA_SUPERADMIN_DB` → staging Super Admin database).
- Exactly these two staging routes were retargeted and verified:
  - `superadmin-staging.creatorsupportamravati.in/editor-management*` → `csa-editor-portal-staging`
  - `superadmin-staging.creatorsupportamravati.in/editor-api/*` → `csa-editor-portal-staging`
- Cloudflare Access read-back confirms the `CSA Super Admin Isolated Staging` self-hosted application still covers the exact staging hostname, has a 1-hour session, and has an allow-only policy for the configured Super Admin identity. No bypass/public policy is configured.
- The staging Worker sources and all Super Admin module files are now tracked under `global-platform/workers/staging/` on the GitHub `staging` branch.

#### Important production route observation

Cloudflare's route inventory shows the existing `superadmin.creatorsupportamravati.in/*` catch-all route points to `csa-superadmin-api-staging`. This route was not edited, but it means the staging-named Super Admin Worker script is also serving the official Super Admin hostname. The deployed change preserves the existing production-host role condition and only adds the isolated staging hostname condition; nevertheless, the two hostnames are not yet isolated at the Worker-script level. Before future Super Admin code changes, create and verify a separate production Worker/script and migrate the official catch-all route only in a separately reviewed change. Do not move that route as part of this staging task.

#### Remaining validation before normal use

- Authenticated browser test of Super Admin login on the staging hostname using the configured Super Admin identity.
- Confirm `/editor-management` renders with that session and the admin `/editor-api/*` calls succeed.
- Confirm unauthenticated requests are denied by Cloudflare Access (or return the expected authentication response after Access) and no editor or admin data leaks.
- Confirm staging data changes remain confined to staging D1/R2.
- Do not announce the staging URL for general use until these interactive checks pass.

No production route pattern, production Editor Portal target, DNS record, Access policy, or production database binding was intentionally changed in this implementation. The existing Super Admin catch-all route observation above must be treated as a shared-script dependency, not as proof of production/staging Worker isolation.

### Staging data-isolation recheck — 2026-11-21

A deeper binding audit found an important shared-resource issue that must be resolved before any staging write test:

- `csa-superadmin-api-staging` uses D1 `csa-superadmin-staging` (database `99bc81fc-e97e-488b-a380-eb0237ff8ffc`), which is a staging database.
- Its `ATTENDANCE_MEDIA` R2 binding is currently `csa-attendance-evidence` (without the staging suffix). This is not the isolated staging bucket. Do not run attendance-media upload/delete tests through this Worker until the official Super Admin hostname is moved to a separate production Worker and this staging Worker can safely be rebound to `csa-attendance-evidence-staging`.
- `csa-editor-portal-staging` uses staging D1 `csa-video-workflow-staging` (`69f070a4-b71f-4448-973f-31993715b781`) and R2 `csa-video-editing-staging`; its `CSA_SUPERADMIN_DB` points to `csa-superadmin-staging`.
- Cloudflare inventory also contains pre-existing `csa-superadmin-isolated-staging` and `csa-editor-portal-isolated-staging` Workers with separate D1/R2 resources. The isolated Super Admin Worker already has the staging hostname in its Super-Admin-only host guard and uses `csa-attendance-evidence-staging`; however, the isolated Editor Worker still has the old admin host and production-looking origin/health strings. These workers are not currently the active custom-domain/route targets.
- The official Super Admin catch-all route still targets `csa-superadmin-api-staging`. Consequently, changing that Worker’s attendance bucket or other shared bindings now could affect official admin traffic. No binding was changed in this recheck.

#### Safe next migration sequence

1. Inventory and compare all modules, non-secret bindings, secret binding names, Access settings, and D1/R2 resources for the active and pre-existing isolated Workers.
2. Create or verify a production-only Super Admin Worker with production D1/R2 and required secrets, and validate it independently before moving the official catch-all route.
3. Only after the production route is confirmed on the production Worker, rebind the staging Super Admin Worker to staging-only R2 (`csa-attendance-evidence-staging`) and test staging uploads.
4. Decide whether to retain the current staging Editor Worker or migrate to the pre-existing isolated Editor Worker after its host guards and origins are corrected.
5. Complete authenticated browser login, Editor Management/API, unauthenticated denial, and staging data-write tests. Until then, the staging hostname remains test-only and is not approved for general use.

No Worker bindings, Access rules, custom domains, or routes were changed during this recheck.

### Isolated Worker inventory and source-tracking check — 2026-11-21

A read-only comparison of the active staging Workers and the pre-existing isolated staging pair is complete.

| Worker | D1 bindings | R2 bindings | Secret binding names |
|---|---|---|---|
| `csa-superadmin-api-staging` | `DB` → `csa-superadmin-staging` (`99bc81fc-e97e-488b-a380-eb0237ff8ffc`) | `ATTENDANCE_MEDIA` → `csa-attendance-evidence` (**not staging-only**) | `ADMIN_SYNC_HMAC_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| `csa-superadmin-isolated-staging` | `DB` → isolated staging D1 (`c2bb3fb5-db22-4ed5-9283-161df57ebac2`) | `ATTENDANCE_MEDIA` → `csa-attendance-evidence-staging` | **none** |
| `csa-editor-portal-staging` | `CSA_VIDEO_DB` → `csa-video-workflow-staging` (`69f070a4-b71f-4448-973f-31993715b781`); `CSA_SUPERADMIN_DB` → `csa-superadmin-staging` | `CSA_VIDEO_BUCKET` → `csa-video-editing-staging` | none |
| `csa-editor-portal-isolated-staging` | `CSA_VIDEO_DB` → isolated staging D1 (`b611b8ff-8f9f-43b2-95c8-a767a14987d6`); `CSA_SUPERADMIN_DB` → isolated Super Admin D1 (`1fc2979f-52e2-420e-80f5-b70a51f6ac6c`) | `CSA_VIDEO_BUCKET` → `csa-video-editing-isolated-staging` | none |

Secret values were not requested, returned, or read. The isolated Super Admin Worker source references `ADMIN_SYNC_HMAC_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`, but its current configuration has no secret bindings. It is therefore not ready to replace the active staging Worker without a controlled secret-provisioning step and a full test.

The isolated Super Admin Worker already has a host guard that accepts `superadmin-staging.creatorsupportamravati.in` for `super_admin` only, and its attendance-media bucket is staging-specific. However, it is backed by a distinct isolated D1 database, not the active staging Super Admin database. Switching to it would also switch the identity/admin records and sync state to a different database; this is not a drop-in replacement.

The isolated Editor Worker is not ready for staging routing: its source still sets `VIDEO_ORIGIN` to `https://editor.creatorsupportamravati.in` and `ADMIN_ORIGIN` to `https://superadmin.creatorsupportamravati.in`. Its admin route guards still reference the production Super Admin hostname. Its D1/R2 resources are isolated, but its host/origin configuration must be corrected and reviewed before use.

GitHub source tracking for the active staging Workers is complete: all five Super Admin modules (`worker.js`, `admin-dashboard.js`, `admin-app-source.js`, `admin-app-validate.js`, `global-admin-sync.js`) and the Editor Portal `worker.js` were fetched successfully from the repository's `staging` branch. This verifies source files are present in GitHub; it does not by itself prove byte-for-byte parity with every deployed Cloudflare module.

#### Decision and next safe step

- Do not repoint the staging hostname to either pre-existing isolated Worker yet.
- Do not change the active Super Admin Worker's `ATTENDANCE_MEDIA` binding while its catch-all still serves the official Super Admin hostname.
- The safer next implementation is to prepare a separate production Super Admin Worker from the currently serving Super Admin source, with verified production D1/R2 bindings and preserved production secret bindings; test it before changing the official catch-all route.
- Only after that route migration is independently validated should the active staging Super Admin Worker be rebound to `csa-attendance-evidence-staging`. Then verify the staging identity/admin database and the isolated Editor route flow with authenticated browser tests.
- No Worker code, bindings, secrets, routes, custom domains, Access policies, DNS records, D1 data, R2 objects, or payment settings were modified during this inventory.


### Production replacement readiness inventory — 2026-11-21

A read-only account inventory was performed before creating or routing a separate production Super Admin Worker.

- Cloudflare currently lists no Worker script named `csa-superadmin-api` or other separate production Super Admin Worker. The only Super Admin scripts found are `csa-superadmin-api-staging` and `csa-superadmin-isolated-staging`.
- The official route `superadmin.creatorsupportamravati.in/*` still targets `csa-superadmin-api-staging`.
- The active Super Admin Worker is bound to D1 `csa-superadmin-staging` (`99bc81fc-e97e-488b-a380-eb0237ff8ffc`) and the non-staging R2 bucket `csa-attendance-evidence`.
- The D1 inventory contains `csa-global-platform`, `csa-orders`, and the named staging/isolated databases, but no clearly identified production Super Admin database. Do not infer that `csa-global-platform` or `csa-orders` is the production Super Admin database: their schemas and intended ownership must be verified first.
- The R2 inventory contains both `csa-attendance-evidence` and `csa-attendance-evidence-staging`, but bucket existence alone does not prove which bucket currently contains production attendance evidence or which application owns it.
- No Worker, route, custom domain, binding, D1 database, R2 bucket, Access policy, secret, or data was created or changed during this readiness inventory.

**Decision:** Do not create or route a production Super Admin Worker yet. There is no verified production Super Admin D1 database to bind it to. Cloning the active Worker while pointing it at the current staging D1 would merely create another Worker against staging data; pointing it at an unrelated D1 would risk corrupting another application. The next safe prerequisite is to inspect the schemas and application ownership of `csa-global-platform` and `csa-orders`, then identify or deliberately provision the correct production Super Admin database and seed/migration plan. Do not copy staging admin accounts or secrets into production without an explicit controlled migration plan.
