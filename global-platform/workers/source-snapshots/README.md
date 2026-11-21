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
