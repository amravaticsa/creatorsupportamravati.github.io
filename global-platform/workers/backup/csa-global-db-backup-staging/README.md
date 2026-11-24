# CSA Global staging D1 backups

This Worker creates daily logical backups of the five staging D1 databases used by the Global platform and its compatibility/editor services.

- Destination: private R2 bucket `csa-global-db-backups-staging`
- Schedule: one database per run, daily from 02:00–02:20 UTC
- Retention: 30 days
- Format: gzip-compressed JSON containing table DDL, rows, indexes, and views
- Scope: staging databases only; no production database bindings
- Public access: none; Worker has no routes and workers.dev is disabled

The five scheduled exports are:
- 02:00 UTC — canonical Global D1
- 02:05 UTC — isolated Super Admin D1
- 02:10 UTC — legacy Super Admin staging D1
- 02:15 UTC — legacy Global API staging D1
- 02:20 UTC — legacy video/editor staging D1

One database is exported per invocation to keep CPU and execution time bounded. The temporary `*/5` mapping is only for first-run verification and must be replaced by the five daily schedules after the legacy Super Admin test backup succeeds.

R2 media objects are not copied by this Worker. The JSON exports are logical recovery artifacts; restoration is a controlled/manual operation and should be tested against a separate recovery database before being used for a live restore.

The R2 bucket must remain private. Do not add a public R2 domain or public bucket policy.
