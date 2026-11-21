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
The complete deployed module bundle was re-exported into the GitHub snapshot after the first export had truncated large files. Current module sizes: worker.js 122,366 characters; admin-app-source.js 91,381; admin-app-validate.js 28,054; admin-dashboard.js 26,324; global-admin-sync.js 3,945.

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

GitHub Actions run: https://github.com/amravaticsa/creatorsupportamravati.github.io/actions/runs/44908906417
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
