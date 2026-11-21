# Disposable Cloudflare D1 Migration Test Runbook

Date: 2026-11-21
Branch: staging
Status: prepared; **not executed against Cloudflare D1**

## Purpose

Validate the committed schema-only snapshots against a genuinely disposable Cloudflare D1 database before any production migration is considered.

Snapshots:
- `2026-11-21-superadmin-schema.sql` — 33 tables, 36 explicit indexes, 6 triggers.
- `2026-11-21-rush-schema.sql` — 3 tables, 4 explicit indexes, 0 triggers.

## Safety boundary

- Never run these snapshots against `csa-superadmin-staging`, `csa-video-rush-staging`, any production database, or any database currently bound to an application Worker.
- The account inventory previously showed 10/10 D1 database slots in use. Six empty databases are still referenced by deployed Workers. Empty does not mean unused.
- Do not delete, repurpose, rename, or change bindings for an existing database to make room.
- First confirm the Cloudflare plan/quota in the dashboard or with Cloudflare Support. The API subscription lookup was not authorized and did not establish the active plan.
- Create a disposable database only after an additional D1 slot is available and the account owner explicitly approves the resource creation.
- Keep all credentials and API tokens out of this repository and all logs.

## Preflight gate

Record each item before provisioning:

1. Account owner confirms D1 database quota and available capacity.
2. A new database name is reserved, for example `csa-superadmin-migration-test-20261121`; confirm it does not already exist.
3. Confirm the target database is not bound to any Worker or route.
4. Confirm the exact source snapshot commit and SHA-256 hashes of both SQL files.
5. Confirm the target is disposable and contains no user, client, editor, order, payment, KYC, or credential data.
6. Save the test operator, timestamp, target database ID, and approval reference in the change record.

If any item is unknown, stop. Do not substitute an existing staging database.

## Provision and apply

Run from a trusted local checkout with an authenticated Wrangler CLI. Review the commands and target name before execution.

Create a new disposable database (this consumes an account D1 slot):

```sh
npx wrangler d1 create csa-superadmin-migration-test-20261121
```

Capture the returned database ID in the private change record. Do not commit account IDs or credentials unless they are already intended public configuration.

Apply the Super Admin snapshot to that newly created target only:

```sh
npx wrangler d1 execute csa-superadmin-migration-test-20261121 --remote --file=global-platform/migrations/2026-11-21-superadmin-schema.sql
```

For Rush, provision a separate disposable database after confirming a second slot is available, then apply:

```sh
npx wrangler d1 create csa-rush-migration-test-20261121
npx wrangler d1 execute csa-rush-migration-test-20261121 --remote --file=global-platform/migrations/2026-11-21-rush-schema.sql
```

Do not combine the two schemas in one database: they are separate service schemas and should be tested independently.

## Verification queries

Run these read-only queries against each disposable target and save the JSON output:

```sql
SELECT type, COUNT(*) AS object_count
FROM sqlite_master
WHERE name NOT LIKE 'sqlite_%'
GROUP BY type
ORDER BY type;

PRAGMA foreign_key_check;
PRAGMA integrity_check;
```

Expected application objects:
- Super Admin: 33 tables, 36 explicit indexes, 6 triggers.
- Rush: 3 tables, 4 explicit indexes, 0 triggers.

Cloudflare may expose internal metadata objects; compare application objects by name/type against the source snapshot manifest, not a blind total that includes platform internals. Check every expected table, index, and trigger by exact name. Any missing object or SQL execution error is a failure.

Also perform:
- Confirm all expected foreign-key declarations with `PRAGMA foreign_key_list('<table_name>')` for tables listed in the snapshot.
- Insert and roll back representative disposable fixture rows only where a safe fixture can be defined from the schema; verify CHECK constraints and trigger effects.
- Confirm no fixture row remains after the test.
- Re-run `PRAGMA foreign_key_check` and `PRAGMA integrity_check` after fixture tests.

## Acceptance criteria

A snapshot passes only when:
1. The entire SQL file applies without error to its own empty disposable D1.
2. Every expected table/index/trigger exists and matches the committed manifest.
3. Foreign-key and integrity checks return no errors.
4. Representative constraint/trigger tests behave as expected.
5. The evidence (target ID, snapshot commit/hash, command output, timestamp, operator) is recorded.

A successful SQLite in-memory CI check is not a substitute for this D1 test.

## Cleanup

Do not automatically delete the disposable database at the end of the test. Retain it until the evidence is reviewed and the account owner explicitly approves cleanup. Before deletion, re-check all Worker bindings and routes; then delete only the exact disposable database created for this test. Never delete an existing database as part of this procedure.

## Current result

**Not run.** No disposable D1 slot has been confirmed available. No Cloudflare D1 resource, source database, Worker binding, route, or production setting was changed while preparing this runbook.


## Guarded apply helper (2026-11-21)

Added `scripts/apply-disposable-d1-schema.sh` to reduce the chance of accidentally applying a snapshot to the wrong database.

- Default behavior is dry-run; it prints the target, snapshot path, SHA-256, and planned Wrangler command without making a Cloudflare request.
- It accepts only schema-specific target names with a non-empty alphanumeric suffix: `csa-superadmin-migration-test-*` or `csa-rush-migration-test-*`; schema/target mismatches are rejected.
- It rejects known staging/production names.
- Actual apply requires both `--target-confirmed-disposable` and the exact confirmation phrase `CSA-DISPOSABLE-D1-TEST`.
- It never creates or deletes a database.

Example dry runs:

```sh
bash global-platform/scripts/apply-disposable-d1-schema.sh --schema superadmin --target csa-superadmin-migration-test-ci
bash global-platform/scripts/apply-disposable-d1-schema.sh --schema rush --target csa-rush-migration-test-ci
```

Execution example (only after account-owner approval, capacity confirmation, and independent verification that the target is empty and not Worker-bound):

```sh
bash global-platform/scripts/apply-disposable-d1-schema.sh --schema superadmin --target csa-superadmin-migration-test-YYYYMMDD --apply --target-confirmed-disposable --confirm CSA-DISPOSABLE-D1-TEST
```

The CI workflow runs `global-platform/scripts/test-disposable-d1-guard.sh`. It checks valid dry-runs and rejects empty suffixes, schema/target mismatches, staging targets, production-labelled targets, apply without the disposable assertion, and apply without the exact confirmation phrase. CI never performs a remote D1 write. The helper's apply path has not been executed in this project.
