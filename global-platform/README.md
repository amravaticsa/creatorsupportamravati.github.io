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

**Current staging status (2026-11-19):** the deployed staging homepage has been opened successfully in a connected browser. This confirms the homepage renders, but does not prove Google sign-in or client/editor/admin workflows pass end-to-end. Keep the site marked as staging until those tests are completed.

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
- Integrate CSA Global admin access with the approved single-Super-Admin model. The separate `csa-superadmin-api-staging` service already provides Access-protected first-Super-Admin bootstrap, password + email OTP login, and Super-Admin-only admin invitations/role management. However, it uses a separate D1 identity store and is not yet connected to CSA Global's `users` table or portal session. Meanwhile, this Global API still auto-creates an `admin` account for any Google email in its `ADMIN_EMAILS` allowlist during `/v1/auth/google`. This split identity model is an integration gap: do not add further admin emails, use the Global API admin signup as the production admin path, or assume Super Admin invitations automatically grant CSA Global portal access until a secure, tested identity bridge is implemented.
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
