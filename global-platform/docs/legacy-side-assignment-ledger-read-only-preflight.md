# Legacy Editor D1 — Read-only Schema Preflight

**Status: prepared only. No query has been run against a remote D1 database.**

## Purpose

Before the proposed legacy assignment bridge ledger can be activated, verify the actual isolated Editor Portal schema rather than relying on source snapshots or assumed table layouts.

Preflight SQL:
`workers/source-snapshots/csa-editor-portal-isolated-staging/migrations/0001_legacy_assignment_bridge_ledger_preflight.sql`

## Required operator sequence

1. Obtain explicit owner confirmation of the canonical isolated staging D1 database and its UUID.
2. Verify the isolated Editor Portal Worker binding points to that exact D1 UUID. Do not infer identity from a database name.
3. Verify the query target is staging, not production; capture the command and target UUID in the change record.
4. Run the preflight statements read-only.
5. Review actual primary-key types, order/editor foreign-key columns, assignment uniqueness, statuses, triggers, indexes, and any existing ledger table.
6. Capture only schema metadata and aggregate row counts in the review artifact. Do not export or display editor/customer personal data.
7. Compare the deployed schema with the proposed ledger design. If key types or lifecycle constraints differ, revise the proposal before any migration.
8. Verify a restorable backup exists before requesting migration approval.

## Stop conditions

Stop without applying anything if:
- canonical database confirmation is absent or ambiguous;
- Worker binding UUID does not match the confirmed database;
- any table or column differs from the expected workflow;
- an existing unique assignment constraint conflicts with the proposed semantics;
- a ledger table already exists with an unknown schema;
- production target cannot be excluded.

## What this preflight does not do

- It does not apply the ledger migration.
- It does not create, update, or delete rows.
- It does not change Worker bindings or secrets.
- It does not expose editor/customer row contents.
- It does not authorize registration of the proposed bridge endpoints.

After a successful read-only review, the next step is a separate backup/restore validation and an explicit staging-write approval. Production still requires a separate approval.
