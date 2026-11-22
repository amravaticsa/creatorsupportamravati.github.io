# Legacy Assignment Bridge — Isolated D1 Backup, Preflight, Apply and Rollback Runbook

Status: **Preparation only — no remote D1 write authorized or performed**  
Scope: Global API isolated staging D1 only (csa-global-api-isolated-staging)  
Migration: 0029_legacy_assignment_reconciliation_state.sql  
Production: **Out of scope; never target production from this runbook**

## 1. Safety gates

Do not run this procedure until all of the following are true:

- The owner has explicitly confirmed the canonical isolated Legacy Editor Portal database.
- The target Global API isolated staging D1 database ID and Worker binding have been re-read from Cloudflare immediately before the operation.
- The exact migration file and current staging branch commit have been reviewed.
- A restorable pre-migration backup/export has been created and its artifact location, timestamp, and byte size recorded.
- The operator has explicit approval for the remote staging schema write.
- No production database ID, production Worker, or production binding appears in the command being run.

This runbook does not authorize changing LEGACY_VIDEO_DB, copying data, linking editor identities, or transferring assignments.

## 2. Target identity verification

Before backup or migration, independently inspect the isolated Global API Worker and D1 binding in Cloudflare. Confirm:

- Worker name is exactly csa-global-api-isolated-staging.
- D1 binding name and database UUID match the approved isolated Global API staging database.
- The legacy-side database is not being substituted for the Global API database.
- The production Worker and production D1 UUID are not selected.

If any name, binding, or UUID differs from the approved record, stop. Do not infer the target from a familiar database name.

## 3. Preflight snapshot

Capture and retain the following read-only results before applying the migration:

    SELECT name, type, sql
    FROM sqlite_master
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name;

    PRAGMA table_info('legacy_assignment_links');
    PRAGMA index_list('legacy_assignment_links');
    PRAGMA foreign_key_list('legacy_assignment_links');
    PRAGMA foreign_key_check;

    SELECT bridge_status, COUNT(*) AS row_count
    FROM legacy_assignment_links
    GROUP BY bridge_status
    ORDER BY bridge_status;

    SELECT COUNT(*) AS total_rows FROM legacy_assignment_links;
    SELECT COUNT(DISTINCT global_assignment_id) AS unique_global_assignments
    FROM legacy_assignment_links;
    SELECT COUNT(DISTINCT legacy_order_id) AS unique_legacy_orders
    FROM legacy_assignment_links;
    SELECT COUNT(DISTINCT idempotency_key) AS unique_idempotency_keys
    FROM legacy_assignment_links;

Also inspect all triggers and indexes attached to legacy_assignment_links, plus any views, triggers, or foreign keys elsewhere that reference that table. Migration 0029 rebuilds the table; attached triggers are dropped with the old table and must be deliberately recreated if any are required.

Record the exact result set and counts. If PRAGMA foreign_key_check returns any rows, or if any unexpected dependent object exists, stop and revise the migration before applying it.

## 4. Backup/export

Use the currently approved Cloudflare D1 backup/export mechanism for the exact isolated staging database. A local Wrangler export may be used where supported:

    npx wrangler d1 export csa-global-api-isolated-staging --remote --output ./backups/csa-global-api-isolated-staging-pre-0029.sql

Check the installed Wrangler version and its command help first; CLI flags can vary by version. Do not assume that command success alone proves restorability.

After export:

- Confirm the file exists and is non-empty.
- Record SHA-256, byte size, UTC timestamp, database name, and database UUID in the change record.
- Store the backup in approved restricted storage; do not commit it to Git.
- Validate restore procedure against a separate disposable D1/database where feasible. Never test restore against production.
- If the export is incomplete, unavailable, or cannot be restored, stop.

## 5. Migration review checklist

Before execution, confirm that the reviewed SQL:

- Preserves every existing row and stable unique identifier.
- Preserves the assignments(id) foreign key relationship.
- Recreates the status index after the table rebuild.
- Maps existing created rows to confirmed_created, failed rows to definite_failure, and pending/revoked rows to not_attempted.
- Enforces the intended state and reviewer-evidence constraints.
- Does not call either Worker, transfer data, or modify any editor/order records.
- Has passed the disposable SQLite migration test suite.

Important review note: DROP TABLE and ALTER TABLE ... RENAME behavior must be validated against the actual Cloudflare D1/SQLite runtime and the target database's dependent objects. Do not rely only on a local SQLite pass if the target schema contains additional dependencies.

## 6. Apply — staging only

Only after the explicit staging-write approval and all preflight gates pass:

1. Reconfirm the target database UUID immediately before the write.
2. Apply migration 0029 using the approved Wrangler/D1 migration mechanism and exact isolated staging database.
3. Capture the command output and deployment/change record.
4. Do not combine this with a Worker binding change or route deployment.

Example command shape (verify the current Wrangler syntax before use):

    npx wrangler d1 migrations apply csa-global-api-isolated-staging --remote

If the repository uses a different migrations directory/configuration, use that project's declared configuration rather than improvising a path.

## 7. Post-migration verification

Run and retain:

    PRAGMA table_info('legacy_assignment_links');
    PRAGMA index_list('legacy_assignment_links');
    PRAGMA foreign_key_list('legacy_assignment_links');
    PRAGMA foreign_key_check;

    SELECT bridge_status, remote_result_state, COUNT(*) AS row_count
    FROM legacy_assignment_links
    GROUP BY bridge_status, remote_result_state
    ORDER BY bridge_status, remote_result_state;

    SELECT COUNT(*) AS total_rows FROM legacy_assignment_links;

    SELECT name, type, sql
    FROM sqlite_master
    WHERE name IN (
      'idx_legacy_assignment_links_status',
      'trg_legacy_assignment_link_transition_guard',
      'trg_legacy_assignment_reconciliation_audit_guard'
    )
    ORDER BY type, name;

Acceptance criteria:

- Total row count exactly matches the preflight count.
- Existing identifiers and values are preserved.
- Existing status counts are preserved, with the corresponding remote-result mapping.
- Required columns, unique constraints, index, and both triggers exist.
- PRAGMA foreign_key_check returns zero rows.
- No unexpected schema objects disappeared.
- The disposable migration tests and staging validation workflow pass.

Any mismatch is a stop condition. Do not enable bridge routes to work around a failed verification.

## 8. Rollback and recovery

Migration 0029 is a table rebuild. Do not attempt an improvised reverse migration or manually rename/drop tables in the live database.

If post-migration verification fails:

1. Keep bridge/transfer routes disabled.
2. Stop all writes to the affected bridge ledger.
3. Preserve logs and the failed post-migration schema snapshot.
4. Restore the verified pre-migration backup to a separate isolated recovery database first, and validate row counts, constraints, and foreign keys.
5. Obtain explicit approval for any restoration that would overwrite the affected staging database.
6. If approved, restore using the documented Cloudflare D1 restore procedure for the account/runtime in use.
7. Re-read the restored schema and counts; record the resulting database UUID and verification evidence.
8. Do not switch Worker bindings automatically. Binding changes require a separate review and approval.

If restore cannot be verified, leave the bridge disabled and escalate; do not retry the migration or perform ad hoc data repair.

## 9. Change record

Record before/after:

- Approver and operator
- UTC start/end time
- Git commit and migration file SHA-256
- Worker name and target D1 name/UUID
- Backup artifact path, SHA-256, and size
- Preflight and post-migration query outputs
- Wrangler version and exact command
- CI workflow run and staging deployment run
- Any deviations, warnings, or rollback activity

## 10. Current status

This runbook is documentation only. Migration 0029 remains source-only and has not been applied to remote D1. No backup was created by this change, no remote schema was modified, no Worker binding changed, and production remains untouched.
