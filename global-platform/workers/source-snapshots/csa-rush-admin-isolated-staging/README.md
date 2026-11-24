# CSA Rush Admin isolated staging Worker

This folder is the source snapshot for `csa-rush-admin-isolated-staging`.

## Runtime bindings

- `ENVIRONMENT`: `staging`
- `CSA_RUSH_DB`: `csa-video-rush-isolated-staging` — D1 `99c797a2-d822-437f-a4d7-31d658f3862f`
- `CSA_SUPERADMIN_DB`: `csa-superadmin-isolated-staging` — D1 `c2bb3fb5-db22-4ed5-9283-161df57ebac2`

## Routes

- `/rush-approvals` — Super Admin same-day delivery approval UI
- `/rush-api/quotes` — list pending same-day quotes
- `/rush-api/quotes/:id/decision` — approve/reject with an audit record

The Worker verifies the Super Admin session against the isolated Super Admin D1, requires an active `super_admin` account, enforces the 30-minute idle-session policy, and checks same-origin requests for writes.

## Isolated staging host routes

- `admin-isolated-staging.creatorsupportamravati.in/rush-api/*`
- `admin-isolated-staging.creatorsupportamravati.in/rush-approvals*`
- `superadmin-isolated-staging.creatorsupportamravati.in/rush-api/*`
- `superadmin-isolated-staging.creatorsupportamravati.in/rush-approvals*`
- `superadmin-editor-staging.creatorsupportamravati.in/rush-api/*`
- `superadmin-editor-staging.creatorsupportamravati.in/rush-approvals*`

Do not bind this isolated Worker to the non-isolated Rush or Super Admin databases.
