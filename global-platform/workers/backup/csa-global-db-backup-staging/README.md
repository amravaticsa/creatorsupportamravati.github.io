# CSA Global staging D1 backups

This Worker creates daily logical backups of **all ten D1 databases in the staging environment**.

- Destination: private R2 bucket `csa-global-db-backups-staging`
- Schedule: one database per run, daily from 02:00–02:45 UTC
- Retention: 30 days
- Format: gzip-compressed JSON containing table DDL, rows, indexes, views, triggers, and foreign-key check results
- Scope: all ten staging D1 databases, including isolated and compatibility stores
- Exclusions: production databases `csa-global-platform` and `csa-orders`
- Public access: none; Worker has no routes and workers.dev is disabled

The scheduled exports are:

| UTC | Database | D1 binding |
|---|---|---|
| 02:00 | `csa-global-platform-staging` | `DB_GLOBAL` |
| 02:05 | `csa-superadmin-isolated-staging` | `DB_SUPERADMIN` |
| 02:10 | `csa-superadmin-staging` | `DB_SUPERADMIN_LEGACY` |
| 02:15 | `csa-global-platform-isolated-staging` | `DB_GLOBAL_LEGACY` |
| 02:20 | `csa-video-isolated-staging` | `DB_VIDEO` |
| 02:25 | `csa-global-legacy-video-isolated-staging` | `DB_GLOBAL_VIDEO_LEGACY` |
| 02:30 | `csa-editor-superadmin-isolated-staging` | `DB_EDITOR_SUPERADMIN` |
| 02:35 | `csa-video-workflow-staging` | `DB_VIDEO_WORKFLOW` |
| 02:40 | `csa-video-rush-staging` | `DB_RUSH` |
| 02:45 | `csa-video-rush-isolated-staging` | `DB_RUSH_ISOLATED` |

One database is exported per invocation to keep CPU and execution time bounded. Each export writes a gzip data object and a JSON manifest. The payload includes SQLite triggers and a pre-backup foreign-key violation count; a non-zero count is recorded rather than hidden. The first database's run prunes expired objects older than 30 days.

R2 media objects are not copied by this Worker. The JSON exports are logical recovery artifacts; restoration is a controlled/manual operation and should be tested against a separate recovery database before being used for a live restore.

The R2 bucket must remain private. Do not add a public R2 domain or public bucket policy.
