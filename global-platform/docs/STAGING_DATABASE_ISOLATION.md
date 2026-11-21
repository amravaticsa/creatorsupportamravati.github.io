# CSA Global staging database isolation

Last audited: 2026-11-21
Branch: `staging`

## Current deployment state

The staging API Worker is `csa-global-api-staging`. Its current bindings are:

| Binding | Current resource | State |
|---|---|---|
| `DB` | `csa-global-platform-staging` | Shared staging database; not isolated |
| `LEGACY_VIDEO_DB` | `csa-video-workflow-staging` | Shared legacy staging database; not isolated |
| `MEDIA` | `csa-global-media-staging` | Existing staging R2 bucket |
| `ENVIRONMENT` | `staging` | Correct |

The API health check confirms that the Worker can execute `SELECT 1` against its current `DB` binding. It does not establish schema completeness, data isolation, or successful authentication/payment flows.

## Isolated staging resources already created

These databases were created for isolated staging work and received schema-only copies from the then-current staging sources. Source rows were not copied.

| Database | Purpose | ID |
|---|---|---|
| `csa-superadmin-isolated-staging` | Super Admin | `c2bb3fb5-db22-4ed5-9283-161df57ebac2` |
| `csa-editor-superadmin-isolated-staging` | Editor/Super Admin | `1fc2979f-52e2-420e-80f5-b70a51f6ac6c` |
| `csa-video-isolated-staging` | Video editing | `b611b8ff-8f9f-43b2-95c8-a767a14987d6` |
| `csa-global-legacy-video-isolated-staging` | Legacy video workflow | `2d3f97a0-fa32-46ef-9913-972a59a410e4` |

These schema copies are snapshots, not proof that they match every current migration. Reconcile migration history and schema before binding any Worker to them.

## Account quota blocker

The Cloudflare account currently reports the D1 database limit reached at 10 databases. Creating `csa-global-core-isolated-staging` failed with account limit error 7406.

The two older staging databases `csa-video-workflow-staging` and `csa-video-rush-staging` had zero application rows at the last audit, but other staging Workers are still bound to them. They must not be deleted based only on row counts.

## Safe cutover sequence

1. Increase the account's D1 database quota, or obtain explicit approval after a complete dependency audit to retire a database. Do not delete any database as an automatic cleanup.
2. Create a dedicated `csa-global-core-isolated-staging` D1 database.
3. Reconcile all numbered migrations against the source schema and migration-history table. Do not blindly replay ALTER migrations on a copied schema.
4. Apply the reconciled schema to the new isolated database and verify required tables, indexes, constraints, and migration history.
5. Run API tests and read-only smoke checks against the isolated database.
6. Update only the staging API Worker `DB` binding to the isolated database after explicit cutover approval. Keep production bindings unchanged.
7. Run authenticated client/admin workflow tests and confirm no staging request can access production data.
8. Only after successful staging verification, prepare a separate production migration and cutover plan. Production must never be changed as part of staging setup.

## Guardrails

- Never delete a D1 database just because it currently has zero rows.
- Never change a production D1 binding during staging work.
- Never copy production customer/payment data into staging.
- Do not enable real Razorpay payments or process refunds as part of database smoke tests.
- Treat OAuth and payment environment-variable presence as configuration checks only, not proof of end-to-end functionality.
- Keep editor identity private in all client-facing responses and dashboards.
