# CSA Global staging D1 backups

This Worker creates daily logical backups of the five staging D1 databases used by the Global platform and its compatibility/editor services.

- Destination: private R2 bucket `csa-global-db-backups-staging`
- Schedule: daily at 02:00 UTC
- Retention: 30 days
- Format: gzip-compressed JSON containing table DDL, rows, indexes, and views
- Scope: staging databases only; no production database bindings
- Public access: none; Worker has no routes and workers.dev is disabled

The backup includes:
- canonical Global D1
- isolated Super Admin D1
- legacy Super Admin staging D1
- legacy Global API staging D1
- legacy video/editor staging D1

R2 media objects are not copied by this Worker. The JSON exports are logical recovery artifacts; restoration is a controlled/manual operation and should be tested against a separate recovery database before being used for a live restore.

The R2 bucket must remain private. Do not add a public R2 domain or public bucket policy.
