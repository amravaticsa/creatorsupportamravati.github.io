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

## Source-specific remediation queue

### csa-superadmin-isolated-staging
The exported Worker entry module contained two unsafe sync-failure paths:
- global_admin_sync_logs.error_code was populated from arbitrary exception text.
- A failed attempt to write that row logged the raw database exception message.

Both have been patched in the GitHub source snapshot:
- Persisted error code is now the fixed value `global_sync_failed`.
- The secondary failure log is a fixed structured event with `database_write_failed`.
- The original exception is still rethrown for the existing request/lifecycle error handling; it is not stringified or persisted by this wrapper.

The recovery-email and attendance log patterns previously listed were not present in the currently exported entry module or its four companion modules during this re-scan. They should not be treated as confirmed current targets without another deployed-bundle inspection.

### csa-global-api-isolated-staging
The currently exported `index.js` snapshot did not contain multipart cleanup execution code, a `multipart_cleanup_runs.error_message` write, or a console warning containing an exception message. It does expose admin read/incident routes for multipart cleanup records. The earlier cleanup logging targets therefore remain unverified against this snapshot and must be re-located in the actual deployed module/source before patching.

### csa-editor-portal-isolated-staging
The exported `worker.js` snapshot had no explicit console logging, stack logging, or exception-message persistence markers in the targeted scan. Keep it as a candidate for a synthetic runtime pilot after broader source review.

## Pilot validation checklist

- [ ] Review complete source and imported modules for logging calls and request-body dumps.
- [ ] Apply the allow-listed logging changes above in the isolated staging source.
- [ ] Run syntax/build validation before deployment.
- [ ] Deploy only the isolated staging Worker; verify the official production route is untouched.
- [ ] Exercise successful and failed login, logout, recovery, KYC upload/review, attendance capture, media upload, payment failure, and cleanup paths with synthetic test data.
- [ ] Inspect persisted logs and confirm no secrets, PII, KYC metadata, payment credentials, or raw exception text appear.
- [ ] Confirm retention and sampling settings; keep sampling conservative.
- [ ] Record test evidence and rollback version.
- [ ] Only after sign-off, repeat for other isolated Workers.
- [ ] Production rollout requires a separate change review.

## Deployment guardrails

This document does not itself change Worker source or settings. Do not enable persisted logs/traces or deploy a source change until the checklist's source review, syntax validation, synthetic runtime tests, and production-route isolation checks pass.


## Follow-up source audit — 2026-11-21

A deeper read of the deployed isolated Worker bundles found additional unsafe exception handling beyond the initial three targets.

### Additional Super Admin targets
- Global authorization sync catch persists `e.message` (truncated to 120 chars) into `global_admin_sync_logs.error_code`; this must become a fixed enum such as `global_sync_failed`, not provider/exception text.
- Failure to write that sync log currently emits the raw database exception message; replace with a fixed event and fixed code.
- Admin bootstrap catch logs `e.stack || e`; remove stack/object logging and emit only `bootstrap_failed`.
- Global authorization sync catch blocks in session lookup, admin update, and manual sync currently log exception messages; use fixed codes only.
- Previously identified recovery email and attendance catch blocks remain in scope.

### Additional Global API target
- Multipart cleanup abort warning currently logs arbitrary `error.message`; replace with fixed `storage_abort_failed` code and no session identifier unless independently verified non-sensitive.
- Multipart cleanup runner stores arbitrary exception text in `multipart_cleanup_runs.error_message`. Replace with a fixed safe value such as `multipart_cleanup_failed`; retain detailed diagnostics only in a restricted, redacted internal debugging channel if one is explicitly approved.
- Preserve aggregate cleanup counters; do not log object keys, upload IDs, filenames, user identifiers, or exception text.

### Source tracking / deployment status
The deployed Cloudflare Worker bundles were readable, but the assumed GitHub source paths for the isolated Workers returned 404 and repository code search did not locate those files. Therefore no source file was edited and no Worker was redeployed. Before changing live Worker code, establish the authoritative source-of-truth path or create a reviewed source export and preserve all existing module files, bindings, compatibility settings, and routes.

### Revised release gate
1. Locate or establish authoritative source for each isolated Worker.
2. Apply all source and D1 error-message sanitization targets above.
3. Run syntax validation and compare module/binding manifests.
4. Deploy only isolated staging Worker.
5. Run synthetic failure tests and inspect both Worker logs and D1 error/audit tables.
6. Confirm no secrets, personal data, document metadata, arbitrary exception text, or stack traces persist.
7. Record deployment version and rollback bundle before any wider rollout.


## Source baseline established — 2026-11-21

Cloudflare deployed module bundles have now been exported into:
`global-platform/workers/source-snapshots/`

The snapshot contains all modules for the isolated Super Admin Worker, plus the single entry modules for isolated Global API and Editor Portal. This resolves the immediate source-recovery blocker for review and patch preparation. The snapshots are explicitly labeled as deployed-bundle exports, not assumed original source-of-truth.

No Worker code was deployed or modified in Cloudflare during this export. Next step is to patch the snapshot files, run syntax validation and regression checks, then deploy only isolated staging Workers after route/binding parity is confirmed.

## Patch record — 2026-11-21

GitHub snapshot-only patch:
- File: `global-platform/workers/source-snapshots/csa-superadmin-isolated-staging/worker.js`
- Commit: `25483e958e15eae68344fbbeeebeed8e1cbd24a2`
- Replaced raw exception-derived sync error code with fixed `global_sync_failed`.
- Replaced raw database exception logging with fixed event/error-code fields.

This patch changed GitHub on the `staging` branch only. No Cloudflare Worker source, deployment, settings, bindings, routes, or D1 records were changed. Syntax validation, deployment, and synthetic runtime tests remain pending.