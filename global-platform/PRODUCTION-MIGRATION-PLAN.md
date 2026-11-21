# CSA Production Super Admin + Rush Migration Plan

Audit date: 2026-11-21
Branch: staging
Status: preparation only — no production resources changed.

## Confirmed source state

### Super Admin staging D1
- Database: `csa-superadmin-staging`
- ID: `99bc81fc-e97e-488b-a380-eb0237ff8ffc`
- Contains 33 application tables (plus Cloudflare's internal `_cf_KV` table).
- Core identity/access tables inspected: `admin_accounts`, `admin_permissions`, `admin_sessions`, `admin_enrollment_tokens`, and `csa_admin_module_access`.
- `admin_accounts` contains identity, role, status, password-hash and phone-verification fields.
- `admin_sessions` stores session-token hashes and expiry/revocation metadata.
- `admin_enrollment_tokens` stores enrollment-token hashes, purpose and expiry/consumption metadata.

### Rush staging D1
- Database: `csa-video-rush-staging`
- ID: `198a0604-af4d-4671-8053-5df245ea754c`
- Three application tables inspected: `rush_delivery_audit`, `rush_delivery_quotes`, and `video_editing_orders`.
- All three tables returned zero rows during the read-only audit.
- Quote records store amounts as integer paise, surcharge basis points, approval/payment statuses, customer email and timestamps.
- Audit records capture quote ID, event, actor ID/role, details JSON and timestamp.
- Order records include order code, customer email, customer access hash, project budget in paise and draft status.

## Required production architecture

1. Dedicated production Super Admin D1 with the complete, reviewed schema.
2. Dedicated production Super Admin Worker with production-only D1/R2 bindings and an explicit production environment guard.
3. Dedicated production Rush D1 with reviewed migrations.
4. Production Rush Worker bound only to production Rush D1 and production Super Admin identity/access store.
5. Production Editor Worker must use the production Super Admin identity/access store; staging Editor Worker remains on staging D1.
6. Production host routes are switched only after health, login, authorization, CRUD, audit logging and rollback tests pass.

## Identity and security migration rules

- Do not copy active session rows or session-token hashes from staging to production.
- Do not copy unconsumed enrollment tokens into production.
- Provision production admin identities using a verified invitation/enrollment or password-reset flow.
- If account metadata is migrated, explicitly review role, status, permission and module-access assignments before activation.
- Never expose password hashes, token hashes, HMAC secrets, API keys or other secret values in logs, documentation or chat.
- Confirm that all production authentication, OTP, email and Cloudflare Access settings use production-specific configuration.

## D1 capacity constraint

The Cloudflare account was previously observed at 10/10 D1 database slots. No new production database was created in this preparation step.

Before provisioning:
- Confirm current account quota and whether a plan/quota increase is available.
- Evaluate only genuinely unused databases after checking every Worker binding, route, deployment and backup.
- Export candidate databases and verify the exports before any retirement.
- Obtain explicit owner approval before deleting any database.
- Never use a production database as a staging substitute.

## Release gates (all required)

- [ ] Production Super Admin D1 provisioned and schema migration verified.
- [ ] Production Rush D1 provisioned and schema migration verified.
- [ ] Production Super Admin Worker deployed with production-only bindings and environment guard.
- [ ] Production Rush Worker deployed with production-only bindings and environment guard.
- [ ] Admin identities enrolled; permissions reviewed; no staging sessions/tokens copied.
- [ ] Editor Worker production identity binding corrected and tested.
- [ ] Rush API tests cover quote creation, approval/rejection, audit events, expiry, payment state and authorization.
- [ ] Super Admin tests cover login, logout, session expiry/revocation, role/permission enforcement and audit logs.
- [ ] Route switch has a documented rollback target and owner-approved change window.
- [ ] Runtime health and end-to-end tests pass before production routes are changed.

## Current routing blockers

- `superadmin.creatorsupportamravati.in/*` currently targets the staging Super Admin Worker.
- Production-hostname Rush routes currently target `csa-rush-admin-staging`.
- Production Editor Worker currently references the staging Super Admin D1.
- No dedicated production Super Admin Worker or production Rush Worker/database was verified in the audit.

## Change record

This document records a preparation plan based on read-only inspection. It does not create databases, deploy Workers, change routes, migrate identities, or modify production data.


## Follow-up D1 capacity audit (2026-11-21)

A fresh read-only inventory confirmed 10/10 D1 slots are occupied. Every one of the six databases previously observed with zero application rows is still referenced by at least one deployed Worker D1 binding. Some attached Workers have no custom route, but that alone is insufficient evidence to delete or unbind them. Four other databases contain operational or production records.

**Decision:** no safe D1 retirement candidate is established. Do not delete or unbind any of these databases as part of this migration. Obtain a Cloudflare D1 quota increase, or perform a separately approved consolidation project with verified exports, complete Worker/trigger/service-binding dependency review, and a tested rollback plan. Production provisioning remains blocked until dedicated production D1 capacity is available.


## D1 plan-limit decision (2026-11-21)

Cloudflare's current D1 documentation states:
- Workers Free: up to 10 D1 databases per account.
- Workers Paid: 100,000 D1 databases included; additional databases are billed separately under current pricing.
- Enterprise accounts with custom database limits should contact Cloudflare support if the expected limit is not reflected.

The account inventory currently contains exactly 10 D1 databases. Attempts to read account subscription and billing usage through the connected API returned HTTP 403 authentication errors, so the active plan cannot be verified through this connection. Do not assume the account is Free solely from the database count.

**Recommended next gate:** the account owner should verify the active Workers plan in Cloudflare Dashboard → Workers & Pages → Plans/Billing. If Free, evaluate upgrading to Workers Paid (review current billing and usage before confirming). If already Paid, contact Cloudflare support because the observed 10-database ceiling does not match the published Paid allowance. No plan, billing, database, Worker, or route change was made by this audit.


## Staging source-schema inventory (read-only, 2026-11-21)

A read-only `sqlite_master` inventory was run against the two identified staging source databases. No rows or schema were changed.

### Super Admin staging source
- 33 application tables, 36 indexes, and 6 triggers.
- The 33 tables include admin identity/authentication, permissions, module access, audit/activity, employee, attendance, task/project, client, invoice and payment domains.
- The staging database is approximately 565,248 bytes at the time of inspection.
- The inventory includes triggers that automatically provision module access and activity/audit records; these must be preserved and tested in a production schema migration.

### Rush staging source
- 3 application tables, 4 indexes, and no triggers.
- Tables: `rush_delivery_audit`, `rush_delivery_quotes`, `video_editing_orders`.
- The staging database is approximately 57,344 bytes at the time of inspection.
- Quote constraints enforce supported rush levels, surcharge basis points, non-negative surcharge amounts, total = base + surcharge, approval states, quote states, and payment type values.
- The audit table references rush quotes; migration verification must include foreign-key checks and index checks.

### Migration readiness decision
- The source schema is now inventoried, but production migration files have **not** been generated or applied. The returned DDL excerpts were partially truncated by the inspection interface; do not use those excerpts as executable migration scripts.
- Before provisioning, capture a complete schema export/DDL artifact for each source database, verify object counts and SQL hashes, and test the migration against a disposable target.
- Preserve triggers, indexes, CHECK constraints, foreign keys, and table creation order. Do not copy sessions, OTP challenges, enrollment tokens, or password/token hashes as part of production bootstrap.
- This is a schema inventory only, not proof that Worker code is compatible with a fresh production database.


## Schema-only SQL snapshots committed (2026-11-21)

Generated schema-only SQL files directly from each staging database's `sqlite_master` metadata. The extraction excluded Cloudflare internal objects and SQLite internal autoindexes; it includes application table DDL, explicit indexes, and triggers.

- `migrations/2026-11-21-superadmin-schema.sql`: 33 tables, 36 explicit indexes, 6 triggers (75 SQL objects).
- `migrations/2026-11-21-rush-schema.sql`: 3 tables, 4 explicit indexes (7 SQL objects).

These files contain schema only. No application rows or credential/session/token values were exported. Source staging databases were queried read-only; no source schema/data changed.

**Validation status:** snapshot extraction and object counts verified against `sqlite_master`. The SQL has not yet been applied to a disposable D1 target, and has not been tested as a production migration. It must not be applied to production until:
1. A disposable target database is available.
2. The SQL executes successfully there with foreign keys enabled.
3. Table/index/trigger counts and foreign-key checks match the source.
4. Worker code and expected binding names are reviewed for compatibility.
5. Production target database capacity and backup/rollback plan are confirmed.

No production database, Worker binding, route, payment configuration, or live account setting was changed.


## Schema snapshot correction and completeness check (2026-11-21)

The first GitHub write attempt created placeholder-only files because the D1 query response was truncated by the inspection tool. Those placeholders were replaced with complete schema-only DDL extracted from `sqlite_master` in bounded chunks. The current committed files were fetched back from GitHub and verified for expected DDL counts and absence of truncation markers:

- Super Admin: 33 `CREATE TABLE`, 36 explicit `CREATE INDEX`, 6 `CREATE TRIGGER`; 28,306 characters.
- Rush: 3 `CREATE TABLE`, 4 explicit `CREATE INDEX`, 0 triggers; 2,714 characters.

The snapshots preserve the full SQL text of the source objects, including constraints, foreign keys, partial indexes, and trigger bodies. They exclude SQLite internal autoindexes and Cloudflare internal objects. The D1 export API was also exercised with `no_data: true`; the export completed, but the committed migration artifacts were reconstructed from the bounded `sqlite_master` DDL extraction so the exact source SQL could be stored and reviewed in Git.

**Important:** this is a completeness/count verification, not an execution test. No disposable D1 was available, and no schema was applied to any existing D1. Before calling these deployable migrations, execute each file on a genuinely disposable database and compare `sqlite_master` object counts, foreign-key checks, and representative trigger behavior. The earlier note that migration files had not yet been generated is superseded by this section; validation on a disposable target remains outstanding.


## Local schema validation harness (2026-11-21)

Added `global-platform/scripts/verify-schema-snapshots.py`. It creates temporary in-memory SQLite databases, applies each schema-only file, checks expected table/index/trigger counts, required core tables, `PRAGMA foreign_key_check`, and `PRAGMA integrity_check`. It does not connect to Cloudflare or modify any remote database.

Run from the repository root with:

```sh
python3 global-platform/scripts/verify-schema-snapshots.py
```

This harness is a local SQLite smoke test only. A disposable Cloudflare D1 migration test remains a separate mandatory release gate.


## CI integration for schema validation (2026-11-21)

Updated `.github/workflows/csa-global-validation.yml` to run `python3 global-platform/scripts/verify-schema-snapshots.py` on the existing staging/global-platform validation workflow. This makes the local SQLite schema smoke test part of the automated staging checks whenever relevant files change.

Workflow update commit: `e6fdf7e5f83edb0550353465dadd37e624c36960`.

The workflow definition is committed, but this session has not received a GitHub Actions run result. Therefore CI execution is **pending/unverified**, not reported as passing. The check is validation-only and contains no deployment step.


### CI follow-up: independent schema job (2026-11-21)

The first workflow run for commit `516814578e9dc7a7aad2882c1868e20be3e36487` completed with overall failure before the schema step. The existing JavaScript syntax-check step failed on the large generated `admin-app-source.js` snapshot; the schema step was consequently skipped. The run logs show the existing API test suite itself passed (25/25). This is not evidence that either schema snapshot failed.

To prevent unrelated Worker snapshot syntax checks from blocking database validation, the schema smoke test has now been moved into its own independent GitHub Actions job, `schema-snapshot`. The job will run in parallel with the existing `validate` job. Its result must be checked separately; no passing result is assumed yet.

Workflow correction commit: `58cff5becba3ff90fdf707b8cd4ffcf4002d056c`.
