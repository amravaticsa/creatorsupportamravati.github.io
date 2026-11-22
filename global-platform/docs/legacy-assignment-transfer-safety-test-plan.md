# Legacy assignment transfer safety test plan

Status: design/test harness only. No transfer API is registered or enabled.

## Coverage in the in-memory regression harness

The script `global-platform/scripts/test-legacy-assignment-transfer-safety.py` exercises:

- Idempotent replay: same key and same payload returns the existing transfer.
- Key conflict: same idempotency key with a changed payload is rejected.
- Duplicate protection: one Global assignment and one legacy order cannot be linked twice.
- Confirmed remote success: the legacy assignment ID is retained and replay does not create a second record.
- Uncertain remote outcome: timeout/connection loss enters reconciliation-required state; automatic create retry is blocked.
- Reconciliation: a discovered remote assignment is linked once; absence must be explicitly established before a retry is considered.
- Definite failure: recorded distinctly from an unknown outcome.
- Remote assignment uniqueness: a legacy assignment ID cannot be linked to multiple Global assignments.

## Important limitation

This harness is a deterministic in-memory model, not an integration test of Cloudflare Workers, D1, the legacy Editor Portal, or the proposed routes. It proves the intended safety policy in CI only. Before implementing a real transfer endpoint, the API contract must define durable reconciliation state, retry authority, payload fingerprinting, and the legacy side's idempotency behavior.

## Activation gates

- Owner confirms the canonical isolated legacy Editor Portal D1.
- API contract and durable schema for uncertain outcomes are reviewed.
- Tests run against disposable isolated D1 and a disposable legacy Worker.
- Backup/rollback and audit review are complete.
- Production enablement receives separate explicit approval.
