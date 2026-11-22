# Legacy-side Assignment Bridge Ledger — Schema Proposal

**Status: design-only / not applied to any D1 database.**

## Purpose

Provide durable idempotency evidence on the Legacy Editor Portal side for the proposed signed assignment-create endpoint. A successful assignment create and its ledger row must be committed atomically by the future Worker handler. A retry with the same idempotency key and request hash must return the original assignment ID; a changed payload must conflict. A unique legacy order ID prevents a second bridge-created assignment for the same order.

## Proposed table

Candidate migration:
`workers/source-snapshots/csa-editor-portal-isolated-staging/migrations/0001_legacy_assignment_bridge_ledger.sql`

The table records only:
- correlation ID and idempotency key;
- canonical SHA-256 request hash;
- legacy order ID and order code;
- editor ID and created assignment ID;
- confirmed-created state and timestamp.

It deliberately stores no passwords, session tokens, email, phone, address, client details, or KYC data. It has no foreign keys because the deployed key types and constraints of `video_editing_orders`, `video_editing_assignments`, and `video_editors` have not yet been verified. This avoids guessing compatibility. The Worker must still validate the exact referenced rows and create the assignment plus ledger record in one D1 transaction/batch after the actual schema has been reviewed.

## Safety semantics

1. Same idempotency key + same request hash: return the recorded assignment ID.
2. Same key + changed hash: conflict; never overwrite the original record.
3. Same correlation ID + changed request: conflict.
4. Existing assignment or ledger row for the order: do not reassign or overwrite.
5. A timeout/5xx is an unknown response, not proof of failure. Perform exact lookup by correlation/idempotency key; never mint a new key automatically.
6. The ledger stores confirmed successful creations. Validation failures do not create a success record.
7. The Global API remains responsible for durable `reconciliation_required` state and reviewer-audited reconciliation.

## Verification performed

The companion test `scripts/test-legacy-side-assignment-ledger-migration.py` runs only against in-memory SQLite. It checks uniqueness, hash validation, required identifiers, allowed result state, no credential/PII columns, and safe reapplication. These tests validate the proposed SQL constraints only; they do not prove Cloudflare D1 transaction behavior, deployed schema compatibility, or endpoint correctness.

## Activation gates — all required

- Owner explicitly confirms which isolated legacy D1 database is canonical.
- Read-only inspection verifies actual table/column names, primary-key types, unique constraints, active-assignment semantics, and current row counts.
- Review the D1 batch/transaction behavior for atomic assignment + ledger creation.
- Back up and verify restore to a separate recovery database.
- Explicit approval to apply this migration to the confirmed isolated staging D1.
- Implement and test the signed lookup/create routes, including Cloudflare Access identity and HMAC/nonce verification.
- Run synthetic staging end-to-end tests, including replay, changed payload, duplicate order, timeout reconciliation, and rollback.
- Separate explicit approval before any production change.

**No Worker route is registered, no D1 binding is changed, no migration is applied remotely, and no live assignment is created by this proposal.**
