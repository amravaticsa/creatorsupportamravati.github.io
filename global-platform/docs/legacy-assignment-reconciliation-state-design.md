# Legacy Assignment Reconciliation — Durable State Design

Status: design only. No migration is applied and no transfer route is enabled.

## Why this design is needed

The current `0026_legacy_editor_identity_bridge.sql` schema allows only
`pending`, `created`, `failed`, and `revoked` for `bridge_status`.
The in-memory safety harness already models `reconciliation_required`, but
that state is not yet durable in D1. A real endpoint must not be implemented
until this mismatch is resolved.

A network timeout is not proof that the legacy Worker failed. It may have
created the assignment and lost the response. Retrying a create operation
without checking the legacy store could create a duplicate.

## Proposed durable record fields

Retain the existing unique identifiers and add fields after a reviewed schema
migration:

- `request_hash`: SHA-256 of a canonical, versioned transfer payload; binds
  the idempotency key to the exact transfer intent.
- `correlation_id`: server-generated opaque identifier shared by Global API,
  legacy Worker request, and restricted audit events.
- `remote_result_state`: explicit remote outcome classification.
- `reconciled_at`, `reconciled_by`, `reconciliation_note`: operator and
  evidence trail for resolving an uncertain result.
- `last_error_code`: stable, redacted machine-readable failure code only.

Never persist credentials, access tokens, full client payloads, KYC documents,
or raw authorization headers in this ledger.

## Proposed state machine

| Current state | Event | Next state | Rule |
|---|---|---|---|
| pending | Remote confirms created + stable legacy assignment ID | created | Store remote ID atomically |
| pending | Definite remote rejection | failed | Store redacted error code |
| pending | Timeout / lost response / ambiguous result | reconciliation_required | Block create retries |
| reconciliation_required | Exact remote assignment found | created | Link the existing remote ID; do not create |
| reconciliation_required | Authoritative remote absence verified | failed | Record reviewer and evidence; a later retry needs a separately authorized action |
| created | Any create replay | created | Return existing recorded result |
| failed | Any automatic retry | failed | No automatic retry |
| revoked | Any transfer/replay | revoked | Terminal; preserve history |

A conflicting remote assignment, multiple matches, mismatched order/editor,
or inability to query the legacy store remains blocked and requires manual
investigation. Never choose a record by email/name similarity.

## Required invariants

1. One Global assignment, one legacy order, one legacy assignment ID, and one
   idempotency key can each be linked at most once.
2. Same idempotency key + same canonical request hash returns the existing
   ledger record.
3. Same idempotency key + different hash is rejected as
   `idempotency_conflict`.
4. A timeout is classified as uncertain, never as definite failure.
5. No create retry while outcome is uncertain.
6. Reconciliation reads by stable correlation/idempotency identity and exact
   legacy order/editor IDs; it does not create.
7. An operator-confirmed absence requires reviewer identity, timestamp, and
   evidence note. This alone does not silently retry the transfer.
8. All transitions are atomic, audited, and fail closed if either database is
   unavailable.
9. Legacy-side idempotency must be implemented and verified too; Global-side
   uniqueness alone cannot prevent duplicate writes after a lost response.

## Required tests before endpoint implementation

- Schema migration from the current four-state check to the reviewed state set.
- Preserve existing rows and all unique/FK constraints through migration.
- Reject unknown state values and illegal state transitions.
- Repeated same-key/same-hash requests return the same ledger record.
- Same key with changed hash fails.
- Simulate remote commit followed by lost response; reconciliation finds the
  same remote assignment and no second create occurs.
- Simulate authoritative remote absence; require reviewer evidence before
  authorizing a new attempt.
- Simulate duplicate or conflicting remote matches; remain blocked.
- Simulate legacy store unavailable; remain blocked.
- Verify revoked and created records cannot be overwritten or silently reset.
- Exercise both Workers and isolated D1 databases using disposable synthetic
  records only.

## Activation gates

- Owner confirms which isolated legacy Editor Portal D1 is canonical.
- Review the legacy order/assignment schema and status semantics.
- Approve the durable schema and migration/rollback plan.
- Verify legacy-side idempotency and exact lookup/reconciliation endpoint.
- Complete isolated integration tests and audit review.
- Obtain separate explicit approval before production changes.

Until these gates pass, this document is a design artifact. No live transfer
or remote database mutation is authorized by it.


## Migration draft added

A source-only migration draft now exists at
`global-platform/migrations/0029_legacy_assignment_reconciliation_state.sql`.
It rebuilds the assignment-link table while preserving existing pending,
created, failed, and revoked rows; adds request fingerprint, correlation ID,
remote outcome, and reviewer evidence fields; and introduces transition and
reconciliation audit guards.

A disposable regression test is maintained at
`global-platform/scripts/test-legacy-assignment-reconciliation-migration.py`.
It checks legacy-row preservation, uncertain outcome persistence, reviewed
reconciliation to created/failed, duplicate correlation protection, terminal
states, foreign keys, and SQLite integrity.

This migration has not been applied to any remote D1 database. Review the SQL
and test results before considering isolated staging application.
