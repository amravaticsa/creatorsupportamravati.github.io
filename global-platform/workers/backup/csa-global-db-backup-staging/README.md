# CSA Global staging D1 backups

This Worker creates daily logical backups of **all ten D1 databases in the staging environment**.

- Destination: private R2 bucket `csa-global-db-backups-staging`
- Schedule: one database per run, daily from 02:02–02:47 UTC
- Retention: 30 days
- Format: gzip-compressed JSON containing table DDL, rows, indexes, views, triggers, and foreign-key check results
- Scope: all ten staging D1 databases, including isolated and compatibility stores
- Exclusions: production databases `csa-global-platform` and `csa-orders`
- Public access: none; Worker has no routes and workers.dev is disabled

The scheduled exports are:

| UTC | Database | D1 binding |
|---|---|---|
| 02:02 | `csa-global-platform-staging` | `DB_GLOBAL` |
| 02:07 | `csa-superadmin-isolated-staging` | `DB_SUPERADMIN` |
| 02:12 | `csa-superadmin-staging` | `DB_SUPERADMIN_LEGACY` |
| 02:17 | `csa-global-platform-isolated-staging` | `DB_GLOBAL_LEGACY` |
| 02:22 | `csa-video-isolated-staging` | `DB_VIDEO` |
| 02:27 | `csa-global-legacy-video-isolated-staging` | `DB_GLOBAL_VIDEO_LEGACY` |
| 02:32 | `csa-editor-superadmin-isolated-staging` | `DB_EDITOR_SUPERADMIN` |
| 02:37 | `csa-video-workflow-staging` | `DB_VIDEO_WORKFLOW` |
| 02:42 | `csa-video-rush-staging` | `DB_RUSH` |
| 02:47 | `csa-video-rush-isolated-staging` | `DB_RUSH_ISOLATED` |

One database is exported per invocation to keep CPU and execution time bounded. Each export writes a gzip data object and a JSON manifest. The payload includes SQLite triggers and a pre-backup foreign-key violation count; a non-zero count is recorded rather than hidden. The first database's run prunes expired objects older than 30 days.

R2 media objects are not copied by this Worker. Each uploaded gzip object is fetched back from private R2, decompressed and parsed. The Worker verifies database identity, generated timestamp, table/row/trigger counts, per-table row counts, `quick_check`, and foreign-key metadata before it writes the manifest and `.verification.json` success marker. Treat the backup as complete only when all three objects exist: `.json.gz`, `.manifest.json`, and `.verification.json`. This is artifact verification, not a full SQL restore rehearsal; restoration remains a controlled/manual operation and must be tested against a separate recovery database before any live restore.

The R2 bucket must remain private. Do not add a public R2 domain or public bucket policy.


### Canonical versus compatibility Global D1 IDs

- `DB_GLOBAL` → canonical `csa-global-platform-staging`, D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473`.
- `DB_GLOBAL_LEGACY` → compatibility `csa-global-platform-isolated-staging`, D1 `6a32dda3-b8c5-413c-9f51-58f0a9fa0712`.

The binding names and backup object names are intentionally aligned: `global.json.gz` is canonical; `global_legacy.json.gz` is compatibility.
