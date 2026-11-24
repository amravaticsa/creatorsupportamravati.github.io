# CSA Global — Managed Editing Platform

## Client-facing brand policy
- Public client pages and client sign-in present CSA as the single managed creative production provider.
- Do not disclose subcontractor, freelancer, editor-network or individual editor details in client-facing pages, messages or project views.
- Editor onboarding and project workspaces are separate access paths; internal assignment and QC remain CSA-managed.

## Operating model
- Project allocation is managed by CSA; clients do not select or contact editors directly.
- Editor registration is open and free.
- Client payments are collected by CSA.
- Editor flow: Google sign-in → profile verification → project offer → accept → review project-specific agreement → project-specific security deposit → CSA confirms assignment.
- No deposit is charged during registration or simply for receiving an offer.
- CSA remains the client-facing service manager and performs quality review before client delivery.
- Editors are independent contractors, not CSA employees.

## Staging URLs
- Frontend: https://csa-global-staging.pages.dev
- Staging API: https://csa-global-api-staging.creatorsupportamravati.workers.dev
- API health endpoint: https://csa-global-api-staging.creatorsupportamravati.workers.dev/health
- Client/editor sign-in: `/login.html`
- Admin sign-in: `/admin-login.html`
- Operations portal: `/portal.html`

**Current staging status (2026-11-22):** the latest immutable staging deployment is `https://2add6c07.csa-global-staging.pages.dev` (commit `5ac3a7dc979424b6689a64418b49f820bdbb0e15`). Automated deployment and validation workflows completed successfully. The deployment smoke gate requires all six HTML routes and both portal JavaScript assets to return HTTP 200 from the same immutable deployment origin; cross-origin redirects fail the workflow. The staging API health check also verifies D1 connectivity. This confirms deploy-time availability and unauthenticated route-denial behavior, not successful completion of authenticated client/editor/admin workflows.

**Automated post-deploy smoke check:** every deployment checks `/`, `/client-project.html`, `/editor-register.html`, `/login.html`, `/admin-login.html`, `/portal.html`, `/assets/auth.js` and `/assets/portal.js`. Any non-200 response, invalid HTML response, or redirect outside the immutable deployment origin fails the deployment workflow. The staging API `/health` endpoint must report a healthy service and must not report a disconnected D1. Seven protected API routes are also checked for unauthenticated denial (HTTP 401). These checks do not replace browser-level authentication, uploads, tender, editor, QC, payment or refund end-to-end tests.

## Isolated Cloudflare staging resources
- Worker: `csa-global-api-staging`
- D1 database: `csa-global-platform-staging`
- R2 bucket: `csa-global-media-staging` (private; Worker binding `MEDIA`)
- Pages project: `csa-global-staging` (Direct Upload)
- Worker environment: `staging`
- Worker D1 binding: `DB` → staging D1 only
- Worker R2 binding: `MEDIA` → staging R2 only

The production Worker, production D1 database, production R2 bucket and live CSA website must remain separate and untouched during staging work.

## Implemented platform functions
- Google Identity Services sign-in with backend RS256 ID-token validation, nonce, issuer, audience, expiry, issued-at and verified-email checks.
- Client onboarding, project tender submission and project history.
- Editor onboarding, verification queue and managed project offers.
- Project-specific agreement review and explicit acceptance.
- Razorpay order creation, server-side captured-payment verification and signed webhook processing.
- Private R2 source-file upload/download with role and assignment checks; direct uploads support files up to 90 MB and resumable multipart uploads support files larger than 90 MB up to 5 GiB.
- Editor assignment inbox and work-submission upload.
- Admin quality-control queue with approve, request-changes and reject decisions.
- Client access to approved deliverables.
- Admin dashboard, audit log, payment ledger and deposit ledger.
- Full security-deposit refund workflow: admin action is available only after recorded CSA quality approval; editor can view refund status. Refunds are not automatic.

## Staging configuration
- Google OAuth client ID, audience, issuer/JWKS settings, allowed frontend origin and admin email allowlist are configured on the staging Worker.
- Razorpay credentials and webhook secret are configured as encrypted secrets on the staging Worker. Never copy secret values into this repository or frontend.
- Webhook endpoint: `https://csa-global-api-staging.creatorsupportamravati.workers.dev/v1/webhooks/razorpay`
- Configured webhook events: `payment.captured`, `payment.failed`, `refund.created`, `refund.processed`, `refund.failed`.
- Keep all payment work in Razorpay Test Mode. A configured credential is not proof that a complete checkout/refund has been tested.

## Database migrations
Migrations `0001` through `0010` are present in `global-platform/migrations/`. Staging has the newer rate-limit, multipart-upload, checksum, cleanup-run and incident tables. Production is behind this schema and must not be migrated until a downloadable, verified backup is retained and the exact migration state is checked. Never apply staging migrations blindly to production.

## Remaining release gates
- Confirm the full deployed frontend (not only the homepage) and API are reachable, then complete browser-level tests for Google sign-in, client project submission, file upload/download, editor workflow, QC and refund status.
- Integrate CSA Global admin access with the approved single-Super-Admin model. The separate `csa-superadmin-api-staging` service already provides Access-protected first-Super-Admin bootstrap, password + email OTP login, and Super-Admin-only admin invitations/role management. However, it uses a separate D1 identity store and is not yet connected to CSA Global's `users` table or portal session. Meanwhile, this Global API still auto-creates an `admin` account for any Google email in its `ADMIN_EMAILS` allowlist during `/v1/auth/google`. The identity stores remain separate by design. The HMAC authorization bridge now synchronizes permitted non-Super-Admin roles into the Global API; Super Admin country assignment and Regional Admin data use the canonical Global D1 binding. A shared browser session across the two portals is not implemented.
- Run payment/refund tests only with explicit approval and Razorpay Test Mode; no real-money payment or refund has been initiated.
- Complete legal review and approval of client/editor agreements before activating them.
- Complete end-to-end tests for resumable/multipart upload, including resume, checksum verification, completion reconciliation and expired-session cleanup.
- Staging hourly cleanup cron is active: the latest 10 recorded executions completed successfully with zero failures. No multipart upload sessions are currently recorded; this validates the scheduled cleanup runner, not a real expired-upload abort.
- Complete backup/restore, rate limiting/abuse controls, operational policies and independent security review.
- Do not deploy to production or enable live payments until all release gates are signed off.

Never commit secrets or ask users to enter passwords, OTPs, card data or secret keys into public forms or repository files.


### Admin identity integration audit (2026-11-19)
- Super Admin D1 currently contains exactly one `active` `super_admin` account and no other admin accounts. No account email, user ID or credential is recorded in this status note.
- CSA Global staging D1 currently contains one active `client` account and zero `admin` accounts.
- The standalone Super Admin service exposes `/api/admins` for Super-Admin-controlled invitations and role management; this is not the same identity store as CSA Global's `users` table.
- The integration must map invited admin identities to Global portal authorization without trusting a client-supplied role, allowlist-only self-registration, or a browser-stored role claim. Prefer a short-lived, signed server-to-server identity assertion with strict issuer/audience/expiry/nonce validation and explicit admin status/role lookup. Do not implement by sharing a password or copying session cookies across hosts.
- Direct HTTP checks from the management execution environment were blocked by its outbound-host policy (403), so service reachability and unauthenticated route behavior remain unverified by those probes.


### Super Admin → Global admin gate (prepared, not deployed)
- Staging source now rejects /v1/auth/google requests with role=admin unless the verified Google email already has an active row in global_admin_authorizations. The old ADMIN_EMAILS allowlist is no longer sufficient to create an admin identity.
- New migration: global-platform/migrations/0011_global_admin_authorizations.sql. It creates a deny-by-default authorization registry keyed by normalized email and the source Super Admin account ID.
- Deployment order is mandatory: apply migration 0011 to the staging D1 database first, then deploy the updated staging API Worker. Deploying the code before the migration would make the admin-auth query fail. Migration 0011 has now been applied and verified on the isolated CSA Global staging D1 database only; the updated Worker code has not been deployed.
- The secure server-to-server sync endpoint and matching sender in csa-superadmin-api-staging are not implemented yet. No authorization rows have been inserted. Until that bridge exists, no newly invited admin can sign in to the Global portal; this is intentional fail-closed behavior.
- Staging branch code changes do not auto-deploy the Direct Upload Pages site or Worker. No production resource, database, DNS, payment setting, or Super Admin account was changed by this preparation.

- Identity bridge design and required staging security tests: `global-platform/ADMIN_IDENTITY_BRIDGE.md`.

## Department routing bridge (Staging)

The Global database mirrors the existing CSA Super Admin department IDs in
`global_departments`; it does not create or rename departments in the source
Super Admin database. Migration `0021_department_routing_bridge.sql` adds
department references to project and editor records and a scoped admin access
table. New client applications default to Content & Video Production; new
editor profiles default to HR & Administration. Existing project records are
preserved and assigned to Content & Video Production.

Admin department access is synchronized from the Super Admin role snapshot:
Super Admin receives all existing departments, Editor Admin receives Content &
Video Production, Project Admin receives Operations & Events, Finance Admin
receives Finance & Accounts, and Support Admin receives Sales & Client Success.
The Global project queue filters by the synchronized department access.

## Shared application routing

Each application remains one row in `projects` with one public application code.
The additive `project_department_routes` table links that same record to three
queues: Content & Video Production (intake), Operations & Events (tender and
assignment), and Finance & Accounts (payment). Department Admins receive only
the queues granted by their synchronized role; Super Admin receives all
existing departments. Editor profiles route to HR & Administration for KYC.


## Tender, editor bidding and client quotation (Staging phase 1)

Migration `0023_tenders_pricing_quotes.sql` is applied to the isolated Staging D1 database. It adds:
- One tender record per central application, with draft, published, closed and awarded states.
- Verified editor bidding with currency validation, delivery estimates and proposal notes.
- Super Admin-only pricing policy per currency. The policy is intentionally unconfigured until the business owner chooses the markup and minimum amount.
- Client quotation drafts with a stored cost/markup calculation, a seven-day validity window, send status and client accept/decline audit events.

Portal sections are available for Admin tender creation and management, Editor tender discovery and bids, Super Admin pricing policy, and Client quotation decisions.

Important release boundaries:
- A tender bid award does not itself assign the editor. CSA must still send the managed editor offer through the existing approval/deposit workflow.
- A client quotation acceptance is recorded, but client advance/balance checkout, payment receipts and refund handling are not implemented in this phase. No client payment is taken.
- No margin percentage is preselected or activated. Quote generation returns a fail-closed response until Super Admin configures the applicable currency.
- No production Worker, database, R2 bucket, Pages project, DNS, main website or live payment credential was changed.
- The new Worker API version is staging-only. UI deployment and API deployment must both be checked independently.


### Client quotation payment (Staging, Test Mode only)

Migration `0024_client_quote_payments.sql` adds a quote-to-payment reference and payment status. Super Admin can optionally configure a client advance percentage per currency alongside the CSA markup policy. If no advance percentage is configured, checkout remains blocked. After the advance is captured, the next checkout is limited to the outstanding balance.

The API refuses client checkout unless the staging Razorpay key ID starts with `rzp_test_`. Payment signatures and captured amount/currency are verified server-side; webhook capture events update quote payment status. This is a test-only integration and must not be treated as permission to accept live payments.

Not yet completed: client refund initiation/reconciliation, payment receipt UI, failed/unknown payment support workflow, Razorpay Test Mode end-to-end checkout with a real test card, and legal approval of the client service agreement. Live payments remain disabled.

## Super Admin staging hostname routing (2026-11-21)

- Route `superadmin-staging.creatorsupportamravati.in/*` is configured to `csa-superadmin-api-staging`.
- The Worker host-role guard explicitly permits the staging hostname for `super_admin` sessions only.
- The two more-specific Editor Management routes remain on `csa-editor-portal-staging`: `/editor-management*` and `/editor-api/*`.
- This routing change is staging-only. The production `superadmin.creatorsupportamravati.in/*` route was not modified.
- Cloudflare currently has its account D1 database quota fully occupied (10 databases). A separate `csa-global-platform-isolated-staging` database could not be created. The unused `csa-global-api-isolated-staging` Worker still has its `DB` binding pointed at the shared staging Global D1; its workers.dev subdomain is disabled and it has no custom route. Do not enable or route this Worker until a dedicated D1 database is provisioned and the full migration set is applied.
- Existing production resources and live payment settings were not changed.


## Cloudflare D1 capacity and data-preservation audit (2026-11-21)

- Cloudflare account currently has 10 of 10 D1 database slots occupied.
- Read-only inspection of `sqlite_master` and row counts found six databases with schema objects but zero application rows: `csa-global-legacy-video-isolated-staging` (10 tables), `csa-video-isolated-staging` (13), `csa-editor-superadmin-isolated-staging` (33), `csa-superadmin-isolated-staging` (33), `csa-video-workflow-staging` (10), and `csa-video-rush-staging` (3).
- These six databases are not automatically safe to delete: they may be intentional migration targets or referenced by Worker configurations. No database was deleted, renamed, or modified during this audit.
- Databases with confirmed application rows include `csa-superadmin-staging` (admin, employee, audit and access records), `csa-global-platform-staging` (client profiles, users, projects, department routes, admin authorizations and operational records), `csa-global-platform` (one agreement-version row), and `csa-orders` (orders, payment and video-file records). Preserve these databases.
- The isolated staging databases contain table structures but currently no application data. This does not prove that the corresponding Workers are correctly bound, migrated for their intended purpose, or safe to activate.
- Next safe step: reconcile every Worker D1 binding and route against the intended database, export and verify backups for any proposed retirement candidate, then obtain explicit owner approval before deleting any database. Do not use a production database as a staging substitute.
- The row-count audit used read-only `SELECT COUNT(*)` queries. No rows or schema were changed. Production payment settings, DNS, routes and databases were not modified.


## Worker-to-D1 and hostname routing audit (2026-11-21, follow-up)

A read-only inventory of deployed Workers, their actual `/settings` bindings, and the zone's custom Worker routes found the following release blockers:

- The custom route `superadmin.creatorsupportamravati.in/*` currently targets `csa-superadmin-api-staging`. Its `ENVIRONMENT` binding is explicitly `staging`, and its D1 binding points to `csa-superadmin-staging`. This is a production hostname routed to a staging Worker. Do not treat the production Super Admin hostname as production-ready.
- The production-hostname Editor Worker `csa-editor-portal` (route `editor.creatorsupportamravati.in/*`, and production Super Admin Editor Management subroutes) has `CSA_SUPERADMIN_DB` bound to the staging Super Admin D1 database `99bc81fc-e97e-488b-a380-eb0237ff8ffc`; its video DB and R2 bucket are production resources. This is a cross-environment binding and must be corrected only after a production Super Admin database is provisioned, migrated, and populated with the required authorized identities.
- `csa-editor-portal-staging` also uses the same staging Super Admin D1 database, as expected for staging. The production and staging Editor Workers therefore currently share the same Super Admin identity/administration database.
- The account's deployed Worker inventory contains `csa-superadmin-api-staging` and `csa-superadmin-isolated-staging`, but no dedicated production `csa-superadmin-api` Worker. The isolated Super Admin Worker keeps its own identity/session D1 c2bb and binds `GLOBAL_DB` to canonical Global D1 470; it is a Staging portal, not a Production substitute.
- `csa-global-api` is correctly marked `ENVIRONMENT=production` and binds to the production Global D1 and production Orders D1/R2 resources. `csa-global-api-staging` is marked staging and binds to staging Global D1, staging video workflow D1/R2 and staging media R2.
- `csa-global-api-isolated-staging` is not a valid isolated Global Platform environment yet: its primary `DB` binding still points to the shared `csa-global-platform-staging` D1. It is currently not routed and its workers.dev subdomain remains disabled. Do not enable or route it.

No Worker routes or bindings were changed during this audit. Do not simply repoint the production Super Admin route to the isolated Worker: that Worker has an empty isolated identity database and lacks a verified production identity setup. Required remediation: provision/authorize a dedicated production Super Admin data store, deploy a production Super Admin Worker with production-only bindings and secrets, migrate/verify its schema and authorized accounts, then test authentication and Editor Management routes before changing production routing. Keep all production route/binding remediation behind explicit owner approval and a verified rollback plan.


## Rush Approval Worker routing and database audit (2026-11-21)

A read-only check of the deployed Rush Admin Worker, its D1 bindings, the matching custom routes, and application table counts found:

- Both production-hostname routes `superadmin.creatorsupportamravati.in/rush-approvals*` and `superadmin.creatorsupportamravati.in/rush-api/*` currently target `csa-rush-admin-staging`.
- `csa-rush-admin-staging` is bound to `CSA_RUSH_DB` = `csa-video-rush-staging` (D1 ID `198a0604-af4d-4671-8053-5df245ea754c`) and `CSA_SUPERADMIN_DB` = `csa-superadmin-staging` (D1 ID `99bc81fc-e97e-488b-a380-eb0237ff8ffc`). These are staging databases.
- The Rush Worker settings expose no explicit `ENVIRONMENT` plain-text binding. Do not infer production readiness from the production hostname.
- The Rush D1 currently has three application tables (`rush_delivery_audit`, `rush_delivery_quotes`, and `video_editing_orders`); read-only row counts returned zero for all three. This means there is no Rush workflow data in this D1 at audit time; it does not establish that the workflow is fully migrated or end-to-end functional.
- No dedicated production Rush Admin Worker or production Rush D1 was verified in this audit. The production-hostname Rush routes must be considered staging-to-production routing blockers until a production data store and Worker are provisioned and validated.
- Do not repoint these routes to another Worker or change D1 bindings until the production Rush schema, identity integration, authorization rules, and rollback plan are verified. Keep production routing changes behind explicit owner approval.
- This audit was read-only: no route, Worker binding, D1 schema, or row was changed. No HTTP end-to-end runtime test was claimed.


## D1 capacity and safe-retirement dependency audit (2026-11-21)

A fresh read-only inventory enumerated all 10 D1 databases, all deployed Workers' D1/R2 bindings, and all custom routes. The account remains at 10/10 D1 slots.

- All six databases previously observed with zero application rows are still referenced by at least one deployed Worker binding:
  - `csa-global-legacy-video-isolated-staging` → `csa-global-api-isolated-staging` (`LEGACY_VIDEO_DB`).
  - `csa-video-isolated-staging` and `csa-editor-superadmin-isolated-staging` → `csa-editor-portal-isolated-staging`.
  - `csa-superadmin-isolated-staging` → `csa-superadmin-isolated-staging`.
  - `csa-video-workflow-staging` → staging Global, Editor, Rush/payment workflow Workers.
  - `csa-video-rush-staging` → Rush Admin and Rush/video workflow Workers.
- Some of these Workers currently have no custom route, but a missing route does not prove that the Worker or its binding is disposable; workers.dev status, deployment intent, scripts, scheduled triggers, service bindings and rollback use must also be checked.
- The remaining four databases contain operational records or production data and must be preserved.
- Therefore, this audit found **no database that can safely be declared a retirement candidate** based only on current evidence. No D1 database was deleted or modified.
- Production Super Admin and Rush provisioning remains blocked by the D1 account quota. Preferred next path: ask Cloudflare to raise the D1 database limit, or obtain explicit owner approval for a separately planned consolidation/retirement after backups and complete dependency review. Do not unbind or delete an empty-but-referenced database just to free a slot.
- The inventory was read-only. No Worker settings, routes, D1 data/schema, DNS, or payment configuration changed. Runtime HTTP/end-to-end behavior was not tested by this inventory.


### Staging deployment and authorization smoke evidence (2026-11-21, latest)

- Deployment workflow run `44921983519` completed successfully for commit `a4f7651faac5caa79df63b4b82e56f573caee31a`.
- The post-deploy smoke test passed for the core frontend routes/assets and the staging API health endpoint.
- The read-only authorization-boundary check passed: unauthenticated requests to client projects/refunds, editor tenders/assignments, admin tenders, pending editor KYC and client-refund queues were denied with HTTP 401/403.
- This verifies unauthenticated denial only. It does not prove that valid client, editor or admin identities can complete their authorized workflows.
- Next staging gate: provision dedicated test identities through the normal Google sign-in and editor KYC process, then execute the seven workflows in `global-platform/testing/STAGING-E2E-TEST-PLAN.md`. Do not place credentials, OTPs or KYC documents in GitHub.


### Latest staging validation evidence (2026-11-22)

- Staging commit: `5ac3a7dc979424b6689a64418b49f820bdbb0e15`.
- Immutable Pages deployment: `https://2add6c07.csa-global-staging.pages.dev`.
- Deployment workflow run `45001308790` completed successfully; API validation workflow run `45001308640` completed successfully.
- All six HTML routes and both JavaScript assets passed strict HTTP 200 and same-origin checks.
- Staging API health and D1 connectivity passed.
- Seven protected client/editor/admin API routes returned HTTP 401 without authentication.
- Disposable migration, schema, idempotency, reconciliation and read-only preflight safety tests passed in CI. These are isolated test runs and do not authorize remote D1 writes.
- The legacy editor bridge management endpoints remain intentionally disabled. Canonical legacy D1 identity, separate staging-write approval, service-token installation and authenticated end-to-end test identities remain release gates.
- No production Worker, route, database, R2 bucket, DNS record or live payment setting was changed by this validation.


## Staging follow-up — 2026-11-22

This update supersedes earlier staging-boundary notes above where the current Cloudflare configuration has since changed:

- Canonical Client/Editor Portal remains `csa-global-api-staging` on D1 `csa-global-platform-staging` (`470a81b8-3d36-4e2d-942c-5cbb2746a473`). The Pages portal's `portal.js` targets this API.
- The canonical API `csa-global-api-staging` uses Global D1 470 and legacy video D1 2d3. The isolated legacy-link API `csa-global-api-isolated-staging` uses Global D1 6a32 and video D1 b611. Regional Admin data uses the canonical API; only Legacy Links uses the isolated API.
- Canonical staging API exposes HMAC-protected internal bridges for admin authorization sync, pricing policy, refund dashboard, editor sessions and the active Regional Admin data proxy. Finance access is sourced from `csa_admin_module_access` and persisted as `global_admin_authorizations.finance_access_level`. The isolated API hostname is reserved for Legacy Links compatibility.
- Super Admin authorization reconciliation runs every 15 minutes; canonical Global API multipart cleanup runs hourly. The isolated API retains its own 15-minute cleanup for its separate D1/R2 resources.
- A separate `csa-rush-admin-isolated-staging` Worker was created. It uses Rush D1 `csa-video-rush-staging` (`198a0604-af4d-4671-8053-5df245ea754c`) and isolated Super Admin D1 `csa-superadmin-isolated-staging` (`c2bb3fb5-db22-4ed5-9283-161df57ebac2`). Routes: `superadmin-editor-staging.creatorsupportamravati.in/rush-approvals*` and `superadmin-editor-staging.creatorsupportamravati.in/rush-api/*`. Open the staging approvals page at `https://superadmin-editor-staging.creatorsupportamravati.in/rush-approvals` after signing in to the isolated Super Admin portal.
- Existing Rush routes on `superadmin.creatorsupportamravati.in` remain unchanged and continue to target legacy `csa-rush-admin-staging` / D1 `99bc81fc-e97e-488b-a380-eb0237ff8ffc`. No Production-looking hostname route was repointed.
- `csa-rush-payment-api-staging` now requires a Razorpay key ID beginning `rzp_test_` for order creation and verification; the Worker reports test-credential readiness and has `ENVIRONMENT=staging`. No Rush quote or audit rows were present during the read-only check, and no payment order was created.
- The first 08:15 UTC scheduled Global Admin sync failed against the isolated database before the canonical target correction. The next scheduled run is the runtime confirmation point; browser E2E tests remain pending.
- Production Workers, Production D1/R2, and Production DNS were not changed.


### Country assignment integration — 2026-11-22 08:40 UTC

- The isolated Super Admin Worker's `GLOBAL_DB` binding points to canonical Global D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473`; its `DB` binding remains Super Admin identity/session D1 `c2bb3fb5-db22-4ed5-9283-161df57ebac2`.
- Canonical Global D1 now includes the evidence-backed immutable country assignment audit table, verification columns, insert/update/delete guards, and the extended country assignment review view (migration `0031_country_assignment_audit.sql`).
- Client/Editor onboarding now leaves authoritative `users.country_code` null. Self-reported country remains in profile fields; Super Admin verification with evidence is required before country scoping is activated.
- Two existing active Client accounts currently appear as `needs_verified_country`. No country was assigned automatically and no audit rows were created.
- The `csa-global-api-isolated-staging` hostname is a compatibility bridge for legacy links and Regional Admin proxy calls; it shares canonical Global D1 470 and uses the separate legacy video D1 2d3.


### Super Admin Staging route and canonical database correction — 2026-11-22 09:05 UTC

- `admin-staging.creatorsupportamravati.in/*` route ID `106b1cfa87ce411d99ef77b328b1b39e` now targets `csa-superadmin-isolated-staging` (previously it incorrectly targeted the legacy Worker).
- The isolated Super Admin Worker's `ADMIN_DASHBOARD_URL` is now `https://admin-staging.creatorsupportamravati.in`, which is the host allowed for non-super-admin administrator roles. `superadmin-editor-staging.creatorsupportamravati.in` remains super-admin-only.
- The isolated Super Admin Worker's `GLOBAL_DB` points to canonical Global D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473`; its separate `DB` binding remains `c2bb3fb5-db22-4ed5-9283-161df57ebac2` for Super Admin accounts/sessions.
- Cloudflare Access remains scoped only to `admin-staging.creatorsupportamravati.in/api/bootstrap` and allows the owner email for the one-time first-Super-Admin bootstrap. It does not protect the ordinary login route. The application login still enforces password, email OTP, session expiry and RBAC.
- Production-looking hostnames and legacy Worker routes were not changed.

- The legacy Worker still has a Custom Domain record for `admin-staging.creatorsupportamravati.in`; Cloudflare documents that a matching Worker Route takes precedence over a Custom Domain. The isolated Worker does not proxy the incoming request with `fetch(request)`, so the configured route handles the request directly. Keep this route explicit and re-check it after any future custom-domain or route edits. Reference: https://developers.cloudflare.com/workers/configuration/routing/routes/.


### India legal evidence research pack — 2026-11-22

- Initial official-source research and counsel issue register: `compliance/INDIA-LAUNCH-LEGAL-EVIDENCE-REGISTER.md`.
- India remains `setup` / `not_started`; no legal approval, country activation, or user country assignment was made. A qualified Indian advocate and CA must review the applicable entity, marketplace, GST, payment, privacy and intermediary obligations. The first Regional Admin must be a real verified person/email.
- Global Admin authorization sync has passed two consecutive scheduled checks after the HMAC compatibility deployment (08:45 and 09:00 UTC, one authorization synchronized each time).


### Regional Admin data path and staging isolation — 2026-11-22

- The isolated Super Admin Worker's Regional Admin read proxy targets canonical `csa-global-api-staging` D1 470 with the dedicated HMAC secret. Only the Legacy Links bridge targets `csa-global-api-isolated-staging` D1 6a32.
- The canonical Global API also has HMAC-authenticated, replay-protected Regional Admin read endpoints for future consolidation. They are not the current Regional Admin portal's data path.
- All Regional Admin queries use verified `users.country_code` or `v_project_country_scope`; self-reported `editor_profiles.country_code` is not used for access scoping. Finance/refund endpoints remain explicitly denied.
- Super Admin Worker `GLOBAL_DB` is canonical D1 470; its `DB` remains Super Admin identity/session D1 c2bb. No Production host or Worker was changed.
- Runtime Regional Admin login/E2E remains blocked until an actual Regional Admin identity exists and the country legal review is approved.

- The Regional Admin portal is served at `https://regional-staging.creatorsupportamravati.in`; the Super Admin Worker rejects this hostname unless `ENVIRONMENT=staging`. The custom domain maps to `csa-superadmin-isolated-staging`. Its unauthenticated dashboard endpoint returns 401; login requires the separate password + email OTP session.


### Staging storage isolation boundary

- Global Client/Editor and Regional Admin data use canonical D1 470; Super Admin identities/sessions remain in separate D1 c2bb. Legacy Links and the isolated Editor Portal use Global D1 6a32 with video D1 b611.
- Object storage is **not fully isolated**: both Global API Workers currently bind `MEDIA` to `csa-global-media-staging`, and both share `LEGACY_VIDEO_DB` 2d3... plus `LEGACY_VIDEO_BUCKET` `csa-global-video-isolated-staging`. These buckets are accessed through Worker bindings, not a public bucket hostname; per-record ownership/assignment checks are the security boundary.
- Before public launch, cross-account media access must be tested using real Client/Editor accounts. If strict physical isolation is required, provision separate R2 buckets and a separate legacy-video D1, then plan a controlled object/record migration. Do not switch bindings without that migration plan.

- Canonical Global D1 migration `0032_verified_country_scope.sql` requires verified country timestamp, reviewer ID and evidence reference. The isolated legacy Global D1 6a32 retains its own matching scope guard for legacy Editor workflows. The three canonical projects remain `country_unassigned`; no India project data is exposed to a Regional Admin before verification.

- Read-only R2 check on 22 November 2026: managed `r2.dev` public access is disabled for both `csa-global-media-staging` and `csa-global-video-isolated-staging`; neither bucket has a public managed R2 endpoint enabled. The buckets remain shared by the two API Workers through private bindings.


### Binding topology correction — 2026-11-22 10:53 UTC

- Verified live settings after the latest Super Admin deployment: `csa-superadmin-isolated-staging` uses `DB=c2bb3fb5-db22-4ed5-9283-161df57ebac2` for Super Admin identities/sessions and `GLOBAL_DB=470a81b8-3d36-4e2d-942c-5cbb2746a473` for country review/assignment against the canonical Global Platform D1.
- Both `csa-global-api-staging` and the legacy-link compatibility Worker `csa-global-api-isolated-staging` currently bind `DB=470a81b8-3d36-4e2d-942c-5cbb2746a473`. The latter keeps its legacy video data in `LEGACY_VIDEO_DB=2d3f97a0-fa32-46ef-9913-972a59a410e4`.
- D1 `6a32dda3-b8c5-413c-9f51-58f0a9fa0712` is the active isolated legacy-link API database, not the canonical Client/Editor or Regional Admin database. The Staging preflight checks the canonical `GLOBAL_DB` binding.


## Explicit canonical database binding — 2026-11-24

The isolated Super Admin Worker uses two separate Global D1 connections by purpose:

- `CANONICAL_GLOBAL_DB` → D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473` for country registry, country verification, and country assignment review.
- `GLOBAL_DB` may remain on D1 `6a32dda3-b8c5-413c-9f51-58f0a9fa0712` as a legacy compatibility binding only; country verification and assignment code must never use it.
- `DB` → Super Admin identity D1 `c2bb3fb5-db22-4ed5-9283-161df57ebac2`.

The staging preflight requires `CANONICAL_GLOBAL_DB` to point to D1 470. A regression test asserts all country-verification routes use the explicit binding and do not use `env.GLOBAL_DB`. This prevents a legacy compatibility binding update from silently changing the Regional Admin country-verification data source.

## Staging binding contract — 2026-11-24

The canonical Global Platform staging data path is:

- `csa-global-api-staging` → D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473`
- `csa-superadmin-isolated-staging` → local identity D1 `c2bb3fb5-db22-4ed5-9283-161df57ebac2`, **`CANONICAL_GLOBAL_DB` → canonical D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473`**, and legacy `GLOBAL_DB` → compatibility D1 `6a32dda3-b8c5-413c-9f51-58f0a9fa0712`.
- `csa-global-api-isolated-staging` → legacy/compatibility D1 `6a32dda3-b8c5-413c-9f51-58f0a9fa0712`; this database is not the canonical Regional Admin data source.

Country registry, country verification, and assignment review must use `CANONICAL_GLOBAL_DB` only. The legacy `GLOBAL_DB` binding is retained for compatibility and must not be used by country-verification code.

The read-only preflight workflow checks these exact bindings on every staging infrastructure change and hourly. If the binding differs, treat the check as a blocking configuration drift; do not resolve it by changing the documented canonical database.

The legacy `csa-superadmin-api-staging` Worker remains separate. It has a staging environment/database despite also being attached to non-suffixed `admin` and `superadmin` hostnames. Do not treat those hostnames as proof of a production deployment; hostname routing must be resolved before launch.


## Staging HMAC key roles — 2026-11-24

- `CSA_GLOBAL_ADMIN_SYNC_HMAC_SECRET` is the dedicated key for the isolated Super Admin → canonical `csa-global-api-staging` admin-authorization snapshot. It is accepted only by the canonical admin-sync receiver route; it is not a general-purpose bridge key.
- `GLOBAL_API_SYNC_HMAC_SECRET` signs the other canonical API bridges (Regional Admin read proxy, pricing policy, refund dashboard and editor-session operations) and remains a migration fallback for admin snapshots.
- `ADMIN_SYNC_HMAC_SECRET` remains a migration fallback where explicitly supported and signs the isolated Legacy Links bridge to `csa-global-api-isolated-staging`.
- The dedicated key must be present on both the isolated Super Admin sender and canonical Global API staging receiver. Secret values must never be read into logs, source control, or browser code.
