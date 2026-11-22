# Legacy Editor Bridge API Contract (Proposal)

Status: **Contract proposal only — routes are not implemented or enabled.**  
Environment: staging design target only.  
Prerequisite: owner must explicitly select the canonical legacy Editor Portal database.

This contract intentionally does not choose a database, copy data, create mappings, or transfer assignments.

## Security envelope

- All proposed management routes are internal admin operations, authenticated by the existing Global API session/JWT layer and authorized server-side with the narrow `content.manage` permission.
- Every mutation requires a CSRF-safe authenticated request, a reason, and an audit event.
- Any cross-Worker request must use the existing staging-only HMAC bridge envelope (timestamp, one-time nonce, method, exact path, body SHA-256) plus the configured Cloudflare Access service identity.
- Never accept a legacy ID supplied by a browser as proof of identity. Resolve and verify it server-side against the selected legacy database.
- Never expose passwords, password hashes, session tokens, OTPs, recovery codes, secret bindings, or full KYC documents through bridge responses or logs.
- Return generic errors to callers; keep diagnostic details in restricted audit metadata without credentials or sensitive payloads.

## Proposed route surface

These routes are proposals and must not be registered until the database and schema review is complete.

### 1. Inspect candidate identities

`GET /v1/admin/legacy-editor-links/candidates`

Purpose: read-only reconciliation view.

Query:
- `global_editor_id` (optional exact Global user/profile ID)
- `legacy_editor_id` (optional exact legacy editor ID)

Response fields:
- stable Global editor ID
- Global verification and account status
- stable legacy editor ID
- legacy account status
- current mapping state, if any
- eligibility reason codes

Rules:
- Exact IDs only; no fuzzy email/name matching.
- Do not return private contact fields, KYC contents, or credential data.
- If the selected legacy database is unavailable or ambiguous, return a fail-closed service error.

### 2. Create a pending mapping

`POST /v1/admin/legacy-editor-links`

Request:
```json
{
  "global_editor_id": "exact-global-user-id",
  "legacy_editor_id": "exact-legacy-editor-id",
  "reason": "Reviewed identity evidence reference"
}
```

Rules:
- Both records must exist in their respective authoritative stores.
- Global editor must be active and verified; legacy editor must be active.
- Enforce one-to-one uniqueness in both directions.
- Create a pending link only. Do not activate or transfer assignments as a side effect.
- Record actor, exact IDs, reason, timestamp, and outcome.

### 3. Activate a reviewed mapping

`POST /v1/admin/legacy-editor-links/{global_editor_id}/activate`

Request:
```json
{
  "reason": "Review completed"
}
```

Rules:
- Re-read both editor records and current link state at mutation time.
- Require pending state and all eligibility checks to pass.
- Reject already-linked, revoked, reassigned, inactive, unverified, or ambiguous identities.
- Preserve reviewer identity and activation timestamp.
- Two-person approval remains a configurable policy decision and must be settled before implementation.

### 4. Revoke a mapping

`POST /v1/admin/legacy-editor-links/{global_editor_id}/revoke`

Request:
```json
{
  "reason": "Access revoked by authorized administrator"
}
```

Rules:
- Stop new bridge assignments immediately.
- Request legacy session invalidation through a reviewed legacy-portal operation.
- If session invalidation cannot be confirmed, fail closed for further bridge work and create a security incident.
- Preserve historical orders, assignments, submissions, and mapping audit history.
- Never delete or rewrite historical work.

### 5. Preview an assignment transfer

`POST /v1/admin/legacy-assignment-bridge/preview`

Request:
```json
{
  "global_assignment_id": "exact-global-assignment-id",
  "legacy_order_id": "exact-legacy-order-id"
}
```

Rules:
- Read-only. No remote writes.
- Confirm active verified Global editor, active legacy identity, active mapping, eligible order state, and no existing transfer.
- Return explicit reason codes for any blocked condition.
- Do not reveal client contact details to an editor or to a browser response.

### 6. Execute an approved assignment transfer

`POST /v1/admin/legacy-assignment-bridge/transfers`

Request:
```json
{
  "global_assignment_id": "exact-global-assignment-id",
  "legacy_order_id": "exact-legacy-order-id",
  "idempotency_key": "client-generated-unique-key",
  "reason": "Authorized assignment handoff"
}
```

Rules:
- Require a fresh eligibility check immediately before writing.
- Bind idempotency key to a canonical request hash. Same key + same hash returns the recorded result; same key + different hash is rejected.
- Enforce unique Global assignment, legacy order, legacy assignment, and idempotency key.
- Persist correlation ID and a stable pending/created/failed outcome.
- A timeout or uncertain remote result must block automatic duplicate retries until reconciliation confirms the remote state.
- Never silently replace an existing assignment or order owner.

## Error model

Use stable machine-readable codes:
- `bridge_not_configured`
- `canonical_database_unconfirmed`
- `legacy_store_unavailable`
- `identity_not_found`
- `identity_not_eligible`
- `mapping_conflict`
- `mapping_not_active`
- `assignment_not_eligible`
- `transfer_conflict`
- `idempotency_conflict`
- `remote_result_uncertain`
- `authorization_denied`

No error response may contain secrets, raw authorization headers, passwords, KYC contents, or unredacted personal data.

## Implementation gates

1. Explicitly confirm the canonical isolated legacy D1 database.
2. Re-read both Worker bindings and compare schema snapshots; do not infer from Worker names.
3. Review the exact legacy editor/order/assignment/session tables and their status values.
4. Define and test the session-revocation operation.
5. Add route authorization tests, mapping lifecycle tests, idempotency tests, replay/tamper tests, and failure-reconciliation tests using disposable databases.
6. Back up the selected isolated database and document rollback before remote writes.
7. Deploy staging-only with approved synthetic test accounts; verify no production binding changed.
8. Obtain separate explicit approval before production changes.

Until these gates pass, this file is a design artifact only. No route described here is live.
