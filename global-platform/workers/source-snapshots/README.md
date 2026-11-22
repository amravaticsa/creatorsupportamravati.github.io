# Isolated staging Worker source snapshots

Captured from Cloudflare deployed Worker module bundles on 2026-11-21.

These files are deployment snapshots exported from the isolated staging Workers, not proof that they are the original development source or that they are already wired into a build/deploy pipeline.

Workers captured:
- `csa-superadmin-isolated-staging` — all five JavaScript modules
- `csa-global-api-isolated-staging` — `index.js`
- `csa-editor-portal-isolated-staging` — `worker.js`

Use these snapshots as a recoverable baseline for review and patch preparation. Before deployment:
1. Compare the snapshot module names and content with the deployed bundle.
2. Preserve all Worker settings, bindings, compatibility date/flags, and routes.
3. Apply security changes in a reviewed commit.
4. Run JavaScript syntax validation and synthetic tests.
5. Deploy only the isolated staging Worker and verify its route isolation.
6. Record the prior deployment version for rollback.

No Worker source, settings, bindings, routes, or deployments were changed by this export.

## Automated snapshot validation

The repository workflow `.github/workflows/csa-global-validation.yml` now syntax-checks every JavaScript module in the three isolated Worker snapshots with Node.js 22 and scans for the previously identified raw exception-to-log patterns. These checks are source validation only; they do not deploy Workers or verify runtime bindings, D1/R2 behavior, route isolation, or live observability.

Validation is triggered by changes under `global-platform/**` on the `staging` branch. A passing workflow is required before any isolated Worker deployment is considered.

## Snapshot refresh — 2026-11-22

- The five `csa-superadmin-isolated-staging` modules and the `csa-global-api-isolated-staging/index.js` module were re-exported from their deployed Cloudflare bundles and synchronized to these snapshots.
- Super Admin Worker snapshot now reflects the deployed invitation, Finance access, country-assignment, Regional Admin, legacy-link and canonical Global API bridge routes.
- All Super Admin Global API bridge URLs now target `csa-global-api-staging` (canonical D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473`). The isolated Global API Worker remains separate and is used for health/CI isolation checks.
- The Super Admin Worker logs no longer emit raw exception messages or stack traces. Sync diagnostics preserve only an allowlisted HTTP status code.
- The isolated Global API health endpoint checks live D1 connectivity and 26 required schema tables. The latest GitHub Actions Staging deploy/smoke test passed before this snapshot refresh.
