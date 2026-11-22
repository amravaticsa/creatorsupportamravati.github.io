# Legacy-side Assignment Bridge Contract — Proposal Only

Status: **Design and test preparation only. No route is registered or enabled.**  
Target: isolated staging Editor Portal Worker, after owner confirms its canonical D1 database.  
Production: explicitly excluded.

## 1. Purpose

Provide a narrowly scoped internal operation for Global API to create or reconcile one legacy editor assignment without using the browser-facing Super Admin assignment route.

The current browser admin route `POST /editor-api/admin/assign` is not a bridge contract: it uses an UPSERT by order and can replace the assigned editor. It must not be called by the cross-Worker bridge.

## 2. Proposed internal routes

All routes require:
- `ENVIRONMENT=staging`
- exact admin host allowlist
- existing HMAC V1 request authentication (timestamp, one-time nonce, method, exact path, SHA-256 body hash)
- Cloudflare Access service identity
- strict body size limit and JSON content type
- no browser CORS access; reject requests with an Origin header
- fail-closed behavior if secret, D1 binding, or Access identity is unavailable

### A. Exact read / reconciliation lookup

`POST /editor-api/internal/legacy-bridge/assignment-lookup`

Request:
```json
{
  "purpose": "assignment-reconciliation",
  "correlation_id": "stable-uuid",
  "idempotency_key": "opaque-unique-key",
  "request_hash": "64-lowercase-hex",
  "order_id": "exact-legacy-order-id",
  "order_code": "exact-legacy-order-code",
  "legacy_editor_id": "exact-legacy-editor-id"
}
```

Rules:
- Read-only. Never create, update, reassign, or change order status.
- Exact order ID and order code must resolve to the same row.
- Return only the minimum fields needed for reconciliation: `found`, stable order ID/code, current order status, active assignment ID/editor ID, and an exact-match indicator.
- If multiple active assignment rows exist or ID/code disagree, return a conflict code and no guessed match.
- Do not return editor credentials, contact data, client details, KYC, session data, or file metadata.

### B. Idempotent assignment create

`POST /editor-api/internal/legacy-bridge/assignment-create`

Request:
```json
{
  "purpose": "assignment-transfer",
  "correlation_id": "stable-uuid",
  "idempotency_key": "opaque-unique-key",
  "request_hash": "64-lowercase-hex",
  "order_id": "exact-legacy-order-id",
  "order_code": "exact-legacy-order-code",
  "legacy_editor_id": "exact-legacy-editor-id"
}
```

Rules:
- Use a dedicated durable legacy-side bridge ledger with a unique idempotency key and unique correlation ID. Do not rely on a Worker memory cache.
- Bind idempotency key to request hash and the exact order/editor tuple. Same key + same hash returns the original durable result; same key + changed hash returns `idempotency_conflict`.
- Same correlation ID + different request hash returns conflict.
- Validate order ID/code exact match, order is not draft, order status is explicitly eligible, editor exists and is active, and no conflicting active assignment exists.
- Never UPSERT, replace, or silently reassign an existing editor.
- Create assignment and ledger result in one D1 transaction/batch with guarded inserts and unique constraints. Return the stable assignment ID.
- If a unique conflict occurs, perform exact lookup and return a conflict unless the durable ledger proves this exact idempotent request already created it.
- A duplicate request after a successful commit must return the same assignment ID, not create another assignment.

### C. Result semantics

Success:
```json
{
  "ok": true,
  "result": "created",
  "correlation_id": "stable-uuid",
  "idempotency_key": "opaque-unique-key",
  "request_hash": "64-lowercase-hex",
  "legacy_assignment_id": "stable-assignment-id",
  "replayed": false
}
```

A same-key replay returns the same fields and ID with `replayed: true`.

Definite business conflict: HTTP 409 with a stable code such as `order_not_eligible`, `editor_not_active`, `assignment_already_exists`, `idempotency_conflict`, or `correlation_conflict`.

Unknown result: caller must treat network timeout, connection reset, malformed response, and 5xx after request dispatch as **unknown**, not as a definite failure. Do not automatically call create again with a new key. Query exact reconciliation lookup using the same correlation ID, idempotency key, and request hash.

### D. Reconciliation lookup response

Found exact result:
```json
{
  "ok": true,
  "result": "found",
  "correlation_id": "stable-uuid",
  "idempotency_key": "opaque-unique-key",
  "request_hash": "64-lowercase-hex",
  "legacy_assignment_id": "stable-assignment-id",
  "legacy_editor_id": "exact-legacy-editor-id",
  "order_id": "exact-legacy-order-id",
  "exact_match": true
}
```

No ledger row and no matching assignment:
```json
{
  "ok": true,
  "result": "absent",
  "correlation_id": "stable-uuid",
  "exact_match": true
}
```

An `absent` response is only a point-in-time read. It does not itself authorize a retry. Global API must record reviewer identity, timestamp, reason/evidence, and a reconciliation decision before any subsequent create attempt.

## 3. Legacy-side durable ledger requirements

Proposed table (final SQL depends on confirmed schema):

- `id` primary key
- `correlation_id` unique, not null
- `idempotency_key` unique, not null
- `request_hash` 64-char lowercase hex, not null
- `order_id`, `order_code`, `editor_id` exact identifiers
- `result_state`: `created` or `definite_failure`
- `assignment_id` unique when created
- `created_at`, `updated_at`
- constraints and indexes for exact reconciliation lookups

Do not store credentials or full request bodies. Keep a compact canonical hash and stable IDs only. The authoritative Global API ledger remains the owner of reviewer reconciliation decisions; legacy ledger records only the remote operation outcome.

## 4. Canonical request hash

Hash a canonical UTF-8 serialization with fixed key order and explicit version marker, for example:

`CSA-LEGACY-ASSIGNMENT-V1\ncorrelation_id\nidempotency_key\norder_id\norder_code\nlegacy_editor_id`

The same canonicalization function must be used by Global API and legacy Worker tests. Reject malformed hashes, unknown versions, missing fields, overlong identifiers, and control characters. Never trust a caller-supplied hash without recomputing it server-side.

## 5. Atomicity and concurrency

- Enforce unique constraints in D1; application pre-checks alone are insufficient.
- Use guarded `INSERT` statements and D1 batch/transaction semantics supported by the deployed runtime.
- Never use `ON CONFLICT DO UPDATE` for assignment ownership.
- If assignment insertion succeeds but ledger insertion fails, the operation must be rolled back atomically; if the deployed D1 API cannot guarantee this for the selected statements, redesign before implementation.
- Concurrent same-key requests must converge to one durable assignment ID.
- Concurrent different-key requests for the same order must result in one winner and one explicit conflict.
- Do not return success until the durable ledger and assignment are both committed.

## 6. Audit and privacy

Audit only actor/service identity, correlation ID, stable record IDs, result code, and timestamps. Redact HMAC, Access tokens, authorization headers, request bodies, editor credentials, client contact information, and KYC. The endpoint is service-to-service only.

## 7. Required tests before route implementation

Use disposable SQLite/D1 fixtures only:
1. Exact order ID and code match.
2. ID/code mismatch is rejected.
3. Missing/draft/ineligible order rejected.
4. Inactive/missing editor rejected.
5. Existing active assignment never overwritten.
6. Same key + same hash returns the same assignment ID.
7. Same key + changed hash rejected.
8. Same correlation ID + changed hash rejected.
9. Concurrent duplicate same-key requests create one assignment.
10. Concurrent different keys for one order produce one assignment and one conflict.
11. Assignment and ledger are atomic under injected failure.
12. Lost response followed by exact lookup returns original assignment.
13. Exact lookup returns absent only when both ledger and matching assignment are absent.
14. Malformed request hash, replayed nonce, stale timestamp, invalid signature, wrong host/environment, Origin header, and missing Access identity fail closed.
15. Response contains no credentials, client PII, KYC, or session data.

## 8. Activation gates

Do not implement or register these routes until:
- owner confirms the canonical isolated legacy database;
- current Worker binding and full schema are re-read;
- exact order/editor/assignment status values and constraints are verified;
- ledger migration is reviewed against D1 runtime semantics;
- HMAC secret equality and Cloudflare Access service identity are validated without exposing secrets;
- backup/restore runbook is approved and a verified backup exists;
- disposable tests pass;
- synthetic staging E2E test and separate explicit staging-write approval are complete.

This document is a proposal only. It does not change Worker code, D1 schema, database bindings, data, or production.
