# CSA Global staging Worker source snapshots

These files are recoverable source snapshots exported from the deployed Cloudflare Workers. They are deployment baselines, not proof that the files are the original development source or that every Worker is deployed automatically from GitHub.

## Captured Workers

- `csa-global-api-isolated-staging` — `index.js`
- `csa-superadmin-isolated-staging` — `worker.js` plus four supporting JavaScript modules
- `csa-editor-portal-isolated-staging` — `worker.js`
- `csa-rush-admin-isolated-staging` — `worker.js`
- `csa-global-db-backup-staging` — scheduled backup Worker; its snapshot is under `global-platform/workers/backup/csa-global-db-backup-staging/`

## Isolated D1 binding contract

The isolated application Workers must use the isolated databases:

| Worker | Binding | Required D1 |
|---|---|---|
| Global API | `DB` | `csa-global-platform-isolated-staging` — `6a32dda3-b8c5-413c-9f51-58f0a9fa0712` |
| Super Admin | `DB` | `csa-superadmin-isolated-staging` — `c2bb3fb5-db22-4ed5-9283-161df57ebac2` |
| Super Admin | `CANONICAL_GLOBAL_DB`, `GLOBAL_API_DB`, `GLOBAL_DB` | `csa-global-platform-isolated-staging` — `6a32dda3-b8c5-413c-9f51-58f0a9fa0712` |
| Editor Portal | `CSA_SUPERADMIN_DB` | `csa-superadmin-isolated-staging` — `c2bb3fb5-db22-4ed5-9283-161df57ebac2` |
| Editor Portal | `CSA_VIDEO_DB` | `csa-video-isolated-staging` — `b611b8ff-8f9f-43b2-95c8-a767a14987d6` |
| Rush Admin | `CSA_RUSH_DB` | `csa-video-rush-isolated-staging` — `99c797a2-d822-437f-a4d7-31d658f3862f` |
| Rush Admin | `CSA_SUPERADMIN_DB` | `csa-superadmin-isolated-staging` — `c2bb3fb5-db22-4ed5-9283-161df57ebac2` |

The older `csa-global-platform-staging` D1 (`470a81b8-3d36-4e2d-942c-5cbb2746a473`) and `csa-superadmin-staging` D1 (`99bc81fc-e97e-488b-a380-eb0237ff8ffc`) are legacy/compatibility databases. Do not bind them to isolated application Workers. The older Global D1 lacks nine columns required by the current API and does not contain the isolated-only `v_tender_country_scope` view.

## Backup Worker mapping

The scheduled `csa-global-db-backup-staging` Worker deliberately backs up both isolated and legacy databases:

- `DB_GLOBAL` → isolated Global Platform D1 (`6a32...`)
- `DB_GLOBAL_LEGACY` → legacy Global Platform D1 (`470a...`)
- `DB_SUPERADMIN` → isolated Super Admin D1 (`c2bb...`)
- `DB_SUPERADMIN_LEGACY` → legacy Super Admin D1 (`99bc...`)

The source snapshot and deployed Worker module are synchronized. Its bindings were checked against the deployed mapping. The R2 backup bucket is private; the backup Worker has no public zone route and workers.dev is disabled. Daily schedules cover ten D1 databases at 02:02–02:47 UTC. The latest older legacy artifacts have manifests and integrity checks, but most predate the current readback/decompression verifier. Six isolated databases passed a separate restore rehearsal; a fresh ten-database backup and restore rehearsal is still required before production release.

## Current schema and runtime checks

The isolated Global API health endpoint checks 27 required tables and nine required columns, including `country_legal_evidence`. The Global Admin sync receiver also verifies the isolated-only `v_tender_country_scope` view. The isolated D1 contains both markers and all required columns; the legacy Global D1 does not.

The 2026-11-24 staging smoke workflow targets the correct isolated API host:
`https://csa-global-api-isolated-staging.creatorsupportamravati.workers.dev/health`

It verifies canonical D1 schema readiness and that unauthenticated client, Editor and Admin API routes fail closed. The latest run passed.

## Validation and deployment discipline

- `.github/workflows/csa-global-validation.yml` validates migrations, JavaScript syntax and source-level tests.
- `.github/workflows/deploy-csa-staging.yml` deploys the Pages staging site and runs isolated API/auth smoke tests.
- `.github/workflows/csa-global-worker-preflight.yml` checks Worker bindings, schedules, subdomains and secrets when a Cloudflare token with Account-level `Workers Scripts Read` permission is available. Add it to GitHub Actions as `CLOUDFLARE_WORKERS_READ_TOKEN`; the current token returns HTTP 403 for settings reads, so those read-only checks are skipped.

Before any Worker deployment:
1. Compare every source module with the current deployed bundle.
2. Preserve bindings, secrets, compatibility date/flags, routes and subdomain settings.
3. Run the repository validation and staging smoke workflows.
4. Deploy only the intended isolated staging Worker.
5. Verify D1/R2 bindings and route isolation after deployment.
6. Record the previous deployment version for rollback.

Use only `*-isolated-staging` hosts for new end-to-end tests. Legacy `admin-staging` and `superadmin-staging` aliases remain separate and must be formally retired or migrated before launch.
