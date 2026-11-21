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
Replace these patterns with fixed event/error codes only:
- `console.error("CSA recovery email failed", e)`
- `console.error("Employee recovery email failed", err)`
- `console.error('Attendance punch failed', err)`

Recommended safe equivalents:
```js
console.error(JSON.stringify({
  event: "recovery_email_delivery_failed",
  error_code: "email_provider_error"
}));
console.error(JSON.stringify({
  event: "employee_recovery_email_delivery_failed",
  error_code: "email_provider_error"
}));
console.error(JSON.stringify({
  event: "attendance_capture_failed",
  error_code: "attendance_storage_or_write_error"
}));
```
Do not include recipient address, employee code, request body, uploaded image, object key, provider response, or exception text.

### csa-global-api-isolated-staging
Replace arbitrary exception text in the multipart cleanup warning:
```js
console.warn(JSON.stringify({
  event: "multipart_cleanup_abort_failed",
  session_id: session.id,
  error_code: "storage_abort_failed"
}));
```
Before retaining `session_id`, confirm it is an internal random identifier and not a credential or externally reusable token. Otherwise omit it and log only a generated correlation ID.

The cleanup completion event is aggregate-only; retain only bounded counts and timestamp.

### csa-editor-portal-isolated-staging
Targeted scan found no explicit console log statements. Keep this as the first observability pilot after authenticated runtime tests.

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
