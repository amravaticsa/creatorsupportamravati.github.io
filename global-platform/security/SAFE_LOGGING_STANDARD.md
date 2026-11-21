# CSA Safe Logging Standard

Status: implementation specification; not yet deployed
Date: 2026-11-21
Scope: isolated staging Workers first, then reviewed production rollout.

## Non-negotiable rules

Never log:
- passwords, OTPs, recovery codes, bearer tokens, cookies, session IDs, authorization headers, API keys, payment signatures, or complete request/response bodies;
- client/editor emails, phone numbers, addresses, KYC document names/content, identity numbers, uploaded media, or raw user-entered text;
- arbitrary exception objects or exception messages from external providers.

Prefer allow-listed structured fields only:
- event name from a fixed set;
- service name and environment;
- bounded error code from a fixed enum;
- HTTP status (where useful);
- generated correlation ID that is not an authentication/session identifier;
- duration and aggregate counts;
- timestamp.

## Source-specific remediation status

### csa-superadmin-isolated-staging
The complete deployed module bundle was re-exported into the GitHub snapshot after the first export had truncated large files. Original refreshed export sizes: worker.js 122,366 characters; admin-app-source.js 91,381; admin-app-validate.js 28,054; admin-dashboard.js 26,324; global-admin-sync.js 3,945.

Confirmed unsafe paths in worker.js were patched in the GitHub snapshot:
- global_admin_sync_logs.error_code now stores fixed global_sync_failed, not exception text.
- A failed sync-log write emits only event global_sync_log_write_failed and error_code database_write_failed.
- Recovery email, employee recovery email, attendance capture, employee work-update upload, bootstrap, session sync, pricing bridge, manual sync, activation sync, and scheduled sync failures now emit fixed event/error-code fields only.
- Bootstrap no longer returns arbitrary exception detail to the browser; it returns the fixed bootstrap_failed detail.
- No raw exception object, message, or stack is passed to the patched console calls.

### csa-global-api-isolated-staging
The complete index.js snapshot (155,950 characters before the two small sanitization replacements) confirmed two multipart cleanup issues, now patched in the GitHub snapshot:
- Abort warning no longer logs session_id or exception text; it emits event multipart_cleanup_abort_failed with fixed error_code storage_abort_failed.
- multipart_cleanup_runs.error_message now stores fixed multipart_cleanup_failed, not arbitrary exception text.
- Aggregate cleanup completion counts remain available.

### csa-editor-portal-isolated-staging
The complete worker.js snapshot (33,354 characters) had no explicit console log statements or exception-message persistence markers in the targeted scan.

## Automated source validation

GitHub Actions run: https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/44909035221
- Result: success.
- Node.js syntax checks passed for all seven JavaScript modules across the three isolated Worker snapshots.
- Existing platform validation suite passed all 25 tests.
- Schema-only SQLite snapshot validation and required-file checks passed.
- The added scan for the known raw exception-to-log patterns passed.

## Remaining release gates

- [ ] Review complete request-body logging and all persisted audit/provider payloads beyond the targeted exception paths.
- [ ] Compare live Worker settings, bindings, compatibility date/flags, and module manifests with the deployment bundle.
- [ ] Prepare a rollback version and isolated synthetic test data.
- [ ] Deploy only the isolated staging Workers after settings parity is verified.
- [ ] Exercise recovery, attendance, work-update upload, admin sync, pricing bridge, and multipart cleanup failure paths.
- [ ] Inspect Worker logs and D1 cleanup/sync records to confirm only fixed error codes and approved aggregate fields persist.
- [ ] Verify production route and active staging Worker remain unchanged.

## Deployment status

All changes in this phase are GitHub snapshot and CI workflow changes only. No Cloudflare Worker source, version, deployment, settings, bindings, routes, or D1 records were modified by the security patch. The staging Pages workflow is a separate repository action and does not constitute a Worker deployment.

These snapshots are exports of deployed Cloudflare bundles, not proof of the original developer source or build pipeline. Do not deploy them until settings parity, rollback, and runtime tests are complete.

## Read-only Cloudflare pre-deployment check — 2026-11-21

Read-only settings and zone-route checks were performed for the three isolated staging Workers. No secret values were read or returned.

- The zone route list contains no route targeting any of these isolated Worker names; this confirms the patched snapshots cannot affect the official Super Admin route through these Worker routes.
- Super Admin isolated settings currently list ACCESS_AUD, ACCESS_TEAM_DOMAIN, ADMIN_DASHBOARD_URL, ADMIN_EMAIL, ATTENDANCE_MEDIA, DB, and ENVIRONMENT. The required binding names ADMIN_SYNC_HMAC_SECRET, RESEND_API_KEY, and RESEND_FROM_EMAIL are referenced by source but are absent from the settings binding list.
- Global API isolated settings currently list ADMIN_EMAILS, ALLOWED_ORIGINS, AUTH_AUDIENCE, AUTH_ISSUER, AUTH_JWKS_URL, DB, ENVIRONMENT, GOOGLE_CLIENT_ID, LEGACY_VIDEO_BUCKET, LEGACY_VIDEO_DB, and MEDIA. ADMIN_SYNC_HMAC_SECRET is referenced by source but absent from the settings binding list.
- Editor Portal isolated settings list CSA_SUPERADMIN_DB, CSA_VIDEO_BUCKET, and CSA_VIDEO_DB.
- Compatibility dates reported by settings: Super Admin and Global API 2026-11-17; Editor Portal 2026-11-20. Compatibility flags are empty for all three.

These missing secret binding names are a hard pre-deployment/runtime-test blocker for Super Admin recovery email and the Super Admin-to-Global API signed authorization/pricing bridge. Obtain the correct secret values through the approved secret-management process; never put them in GitHub source, documentation, or logs.

No Cloudflare settings, secrets, routes, bindings, Worker versions, or deployments were changed by this read-only check.

## Isolated Worker deployment inventory — refreshed 2026-11-21

A second read-only Cloudflare check inspected settings, the latest five version records, deployment allocations, and zone route targets for all three isolated Workers. Secret values were not requested or emitted.

| Isolated Worker | Current deployed version | Deployment allocation | Compatibility date | Observability |
|---|---|---:|---|---|
| csa-superadmin-isolated-staging | 87af7852-4372-4ac7-abb0-8e9c86c75151 (v2) | 100% | 2026-11-17 | observability settings absent; logpush false |
| csa-global-api-isolated-staging | a7aa7e33-fbb6-469a-bb26-70ad68732b41 (v2) | 100% | 2026-11-17 | observability settings absent; logpush false |
| csa-editor-portal-isolated-staging | 62cf8f10-383a-4694-9622-4816ca46fd76 (v1) | 100% | 2026-11-20 | observability settings absent; logpush false |

The zone route query returned zero routes targeting these three isolated Worker names. The current deployment inventory confirms that versions exist and are deployed within their isolated script names, but it does not make them publicly routable or prove end-to-end runtime health.

### Current readiness decision

- **Do not attach public routes or promote these Workers yet.**
- **Do not enable broad log streaming yet.** Observability settings are currently absent and logpush is false. First complete the full sensitive-data logging review, then configure narrowly scoped Workers Logs/Traces and verify redaction in synthetic tests.
- **Secret binding blockers remain:** ADMIN_SYNC_HMAC_SECRET is absent from both Super Admin and Global API isolated settings; RESEND_API_KEY and RESEND_FROM_EMAIL are absent from Super Admin isolated settings. Never place these values in source control or this document.
- **Editor isolated Worker:** current settings expose only its three D1/R2 binding names; origin/auth configuration and its compatibility with the intended isolated host still require review before runtime testing.
- **Rollback evidence:** previous isolated versions are retained for Super Admin (v1) and Global API (v1); the Editor isolated script currently lists only v1. Capture a known-good rollback artifact before any subsequent code/settings change.

Latest successful GitHub validation run recorded for this phase: https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/44909035221. This is repository CI validation, not a Cloudflare Worker deployment.

## Secure secret provisioning runbook — 2026-11-21

This runbook is limited to the three isolated staging Workers. Do not apply it to active staging or production Worker names.

### Required secret inventory

| Worker | Binding | Value source |
|---|---|---|
| csa-superadmin-isolated-staging | ADMIN_SYNC_HMAC_SECRET | Generate a new random high-entropy secret for this isolated bridge |
| csa-global-api-isolated-staging | ADMIN_SYNC_HMAC_SECRET | Bind the exact same generated value as the isolated Super Admin Worker |
| csa-superadmin-isolated-staging | RESEND_API_KEY | Create/use a restricted Resend API key from the authorized Resend account |
| csa-superadmin-isolated-staging | RESEND_FROM_EMAIL | Verified sender address authorized in Resend |

### Operator procedure

1. In Cloudflare Dashboard, open Workers & Pages, select only the exact isolated Worker name shown above, and open Settings → Variables and Secrets.
2. Add ADMIN_SYNC_HMAC_SECRET as a Secret on both isolated Super Admin and isolated Global API Workers. Generate it in a trusted local password manager or secret manager; use one identical value for both. Do not paste it into ChatGPT, GitHub, source files, tickets, or logs.
3. Add RESEND_API_KEY as a Secret on the isolated Super Admin Worker. Use a restricted key from Resend; do not use or expose an account-wide key if a restricted key is available.
4. Add RESEND_FROM_EMAIL as a non-secret text variable on the isolated Super Admin Worker only after the sender domain/address is verified in Resend.
5. Save the changes only on these isolated Worker names. Cloudflare may create new versions when bindings change. Do not change traffic allocation, attach routes, or enable workers.dev as part of this step.
6. Re-read settings and secret names only to confirm all four binding placements. Never retrieve or print secret values.
7. Record the new version IDs and confirm deployment allocation remains confined to the isolated script names. If a change unexpectedly affects any active route or script, stop and roll back immediately.

### Runtime test gate

- Test HMAC signing and verification between isolated Super Admin and isolated Global API using synthetic, non-customer payloads.
- Test recovery-email generation with a mocked mail transport first; then send one explicitly approved test email to an internal test mailbox only.
- Confirm logs contain fixed error codes and no tokens, signatures, email bodies, personal data, request bodies, or secret material.
- Test editor origin/auth behavior independently before allowing the Editor Portal to call any admin or global endpoint.
- Keep all public routes and production promotion disabled until all tests pass and a separate deployment approval is given.

**Current execution status:** This is an operator runbook only. No secret has been generated, stored, or bound by this documentation change.


## Editor Portal isolated-host and authentication audit — 2026-11-21

A read-only source/settings review was completed for `csa-editor-portal-isolated-staging`. The Worker content was read from the isolated script; no settings, routes, secrets, bindings, D1 rows, or deployments were changed.

### Verified source findings

- The isolated Editor Portal source still hard-codes `https://editor.creatorsupportamravati.in` and `https://superadmin.creatorsupportamravati.in` as its video/admin origins.
- The HTML entry routes are explicitly gated to the production hostnames: `editor.creatorsupportamravati.in` for the editor app and `superadmin.creatorsupportamravati.in` for `/editor-management`.
- The admin API branch is also gated to `superadmin.creatorsupportamravati.in`; the editor API branch rejects any host other than `editor.creatorsupportamravati.in`.
- The `/health` response currently reports `environment: "production"`, despite this isolated Worker being configured with staging D1/R2 resources. This is misleading environment metadata and must be corrected before test exposure.
- The request Origin check is same-origin only: a supplied Origin must equal the request URL origin. The OPTIONS response advertises the Worker URL origin, not an independent allowlist. Keep this strict same-origin behavior unless a separately reviewed cross-origin design is required.
- Admin API authentication reads the `csa_admin_session` cookie and validates its hashed session against `CSA_SUPERADMIN_DB`, requiring an active, unexpired `super_admin` account.
- Editor API authentication reads a Bearer token and validates its hashed session against `CSA_VIDEO_DB`, requiring an active, unexpired editor account.
- The isolated Editor Worker currently has the expected isolated D1/R2 binding names: `CSA_SUPERADMIN_DB`, `CSA_VIDEO_DB`, and `CSA_VIDEO_BUCKET`. The settings review did not expose any secret bindings for this Worker.

### Readiness decision

**Blocked for isolated-host end-to-end testing.** The current hostname guards mean the isolated Worker cannot serve the intended editor/admin UI on a separate staging hostname without a reviewed source change. Do not solve this by attaching the production hostnames or by changing active staging routes.

### Safe next implementation plan

1. Choose dedicated staging hostnames for the Editor Portal and its admin-management endpoint; keep them separate from `editor.creatorsupportamravati.in` and `superadmin.creatorsupportamravati.in`.
2. Add explicit environment-aware host allowlists (exact host matches only) and keep the production host allowlist unchanged for the active Worker.
3. Derive the health environment label from a non-secret environment binding rather than hard-coding `production`.
4. Review every use of the two hard-coded origin constants and the embedded UI's API URLs before changing them; confirm cookies, same-site behavior, redirects, and CORS remain same-origin on the staging host.
5. Test the admin cookie session and editor Bearer session separately with synthetic accounts in the isolated D1 databases. Confirm unauthorized, expired, revoked, disabled, and wrong-role sessions are rejected.
6. Add automated source tests for allowed-host and rejected-host cases, plus health environment metadata. Run repository CI before uploading a new isolated Worker version.
7. Only after those tests pass, capture the current v1 artifact as rollback evidence and request separate approval for an isolated Worker-only deployment. Do not add public zone routes or promote to production as part of this work.

**Execution status:** Audit and plan only. No code was changed in Cloudflare, no Worker version was uploaded, no production hostname was altered, and no public route was added.


## Editor Portal host-policy implementation — 2026-11-21

A source-only patch was added to the isolated Editor Portal snapshot at `global-platform/workers/source-snapshots/csa-editor-portal-isolated-staging/worker.js`.

### Host policy now represented in the snapshot

- `ENVIRONMENT=staging` maps the Editor UI to `editor-staging.creatorsupportamravati.in` and the Editor Management UI/API to `superadmin-editor-staging.creatorsupportamravati.in`.
- `ENVIRONMENT=production` retains the existing production hostnames only.
- Host matching is exact and role-specific; no suffix or wildcard matching is used.
- Missing or unknown `ENVIRONMENT` fails closed with HTTP 503. The health endpoint reports `environment: "unconfigured"` and HTTP 503 until a supported environment is present.
- Both the HTML route gates and the corresponding admin/editor API gates use the same environment-aware policy.
- The existing same-origin Origin check remains unchanged.

### Automated tests

Added `global-platform/workers/source-snapshots/csa-editor-portal-isolated-staging/tests/host-policy.test.mjs` and included it in `.github/workflows/csa-global-validation.yml`.

Coverage includes staging-only hosts, production-only hosts, missing/unknown environment, exact hostname matching, and role separation.

Validation run: [GitHub Actions #44918464290](https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/44918464290) — successful. Staging Pages workflow: [#44918464334](https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/44918464334) — successful.

### Remaining runtime blockers — do not expose the isolated Worker yet

1. The isolated Editor Portal settings inventory did not include an `ENVIRONMENT` variable. Set the non-secret text variable to `staging` on `csa-editor-portal-isolated-staging` before expecting health to return 200. This has not been changed by this commit.
2. The Super Admin session cookie is currently issued as `HttpOnly; Secure; SameSite=Strict; Path=/` with no `Domain` attribute. It is therefore host-only. A login on `superadmin.creatorsupportamravati.in` will not automatically authenticate a browser on `superadmin-editor-staging.creatorsupportamravati.in`. Do not broaden the production cookie to `.creatorsupportamravati.in` just to make staging work.
3. Before admin UI end-to-end testing, provision a dedicated isolated Super Admin login/session origin or implement a reviewed same-origin authentication proxy that validates against the isolated Super Admin database. The admin session must be minted and checked against the same isolated database.
4. DNS, routes, Worker settings, bindings, secrets, and deployments remain unchanged. No isolated Worker deployment or public route was made.

**Execution status:** Source snapshot and CI test changes only. Passing CI and Pages deployment do not mean the isolated Cloudflare Worker is deployed or reachable.


## Isolated Editor Management authentication topology — 2026-11-21

A source-level authentication host policy and automated tests were added to the isolated Super Admin Worker snapshot.

### Intended same-origin arrangement (design only; not routed)

Use the dedicated hostname `superadmin-editor-staging.creatorsupportamravati.in` as a shared browser origin with path-separated Worker routing:

- `/` and `/admin-app.js` → `csa-superadmin-isolated-staging` (serves the Super Admin login/dashboard shell).
- `/api/*` → `csa-superadmin-isolated-staging` (password + email OTP login, session issuance, and Super Admin APIs).
- `/editor-management*` and `/editor-api/*` → `csa-editor-portal-isolated-staging` (Editor Management UI and editor-management APIs).

This lets the existing `HttpOnly; Secure; SameSite=Strict; Path=/` host-only `csa_admin_session` cookie be issued by the Super Admin login response on the dedicated staging hostname and then be presented to the Editor Portal on that exact same hostname. The Editor Portal validates the hashed session against its isolated `CSA_SUPERADMIN_DB` binding. No cookie Domain broadening is required.

### Source change and tests

- The isolated Super Admin source snapshot now permits `superadmin-editor-staging.creatorsupportamravati.in` for the `super_admin` role only when `ENVIRONMENT=staging`.
- The existing production and prior staging host policy remains unchanged.
- Added tests for exact hostname matching, role restriction, and staging-only environment gating.
- CI now runs the isolated Super Admin host-policy test suite.

### Mandatory routing and runtime gates

- This is a proposed path-routing topology, not an applied Cloudflare route configuration.
- Before any route writes, verify Cloudflare route specificity and confirm the dedicated hostname DNS record and TLS coverage.
- Verify the isolated Super Admin Worker serves `/`, `/admin-app.js`, and `/api/*` as expected; verify the Editor Portal owns only its two path groups on that host.
- Set `ENVIRONMENT=staging` on both isolated Workers; the Editor Portal currently lacks this setting.
- Confirm both Workers use the same isolated Super Admin D1 database for session issuance and validation.
- Resolve missing isolated Super Admin email and HMAC secrets before OTP or unrelated admin features are runtime-tested.
- Keep production routes, cookies, databases, and active staging Worker routes unchanged.

**Execution status:** GitHub source snapshot, tests, and CI workflow only. No Cloudflare settings, DNS records, routes, Worker versions, bindings, secrets, or deployments were changed.


## Cloudflare isolated Editor Management preflight audit — 2026-11-21

Read-only audit performed after the source-level host-policy tests passed.

### Observed live Cloudflare state

- `csa-superadmin-isolated-staging` already has plain-text `ENVIRONMENT=staging`.
- `csa-editor-portal-isolated-staging` still has no `ENVIRONMENT` binding.
- No exact DNS record was returned for `superadmin-editor-staging.creatorsupportamravati.in`.
- No existing Worker route targets either isolated Worker. Existing production and prior staging routes remain in place.
- Super Admin Worker binding `DB` points to D1 `csa-superadmin-isolated-staging` (UUID `c2bb3fb5-db22-4ed5-9283-161df57ebac2`).
- Editor Portal binding `CSA_SUPERADMIN_DB` points to a different D1 database `csa-editor-superadmin-isolated-staging` (UUID `1fc2979f-52e2-420e-80f5-b70a51f6ac6c`).
- Both databases have the expected admin/session schema, but they are separate databases. Read-only aggregate checks found zero admin accounts, zero active Super Admin accounts, and zero active sessions in both at audit time.

### Authentication dependency — do not route yet

The isolated Super Admin Worker issues and validates `csa_admin_session` records in `env.DB`. The isolated Editor Portal validates the same cookie by looking up `admin_sessions` and `admin_accounts` through `env.CSA_SUPERADMIN_DB`.

Therefore, the two Workers must read the same isolated Super Admin D1 database for this shared-session design. Current bindings do not satisfy that requirement. The proposed binding for Editor Portal `CSA_SUPERADMIN_DB` is the exact same D1 UUID currently bound to Super Admin Worker `DB` (`c2bb3fb5-db22-4ed5-9283-161df57ebac2`). Do not change this until the operator explicitly approves the binding change and a backup/rollback plan is confirmed. Do not copy session rows or broaden cookie Domain as a workaround.

### Required safe activation order

1. Approve and apply Editor Portal `ENVIRONMENT=staging`.
2. Approve and align Editor Portal `CSA_SUPERADMIN_DB` to the isolated Super Admin D1 database; verify the binding readback.
3. Provision/verify the isolated Super Admin bootstrap and OTP delivery prerequisites using operator-controlled secrets; never reuse production secrets by default.
4. Confirm the dedicated hostname DNS record and TLS coverage.
5. Create exact path routes on the dedicated hostname only after verifying route precedence:
   - `/` and Super Admin API paths → `csa-superadmin-isolated-staging`
   - `/editor-management*` and `/editor-api/*` → `csa-editor-portal-isolated-staging`
6. Test login, OTP, cookie flags, session lookup, logout/revocation, and Editor Management APIs on staging.
7. Only then consider broader staging rollout. Production routes, cookies, databases, and secrets remain out of scope.

**Execution status:** This audit made read-only Cloudflare API calls and a documentation update only. No Cloudflare DNS, Worker settings/bindings, routes, secrets, D1 rows, Worker deployments, or production resources were modified.
