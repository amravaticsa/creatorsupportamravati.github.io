# CSA Global production route and database isolation audit

**Audit date:** 2026-11-22  
**Scope:** Read-only Cloudflare account inspection. No route, Worker, D1, R2, DNS, secret, or production resource was changed.

## Executive result

**Production launch is blocked.** The live production Super Admin hostname is routed to a Worker whose environment is explicitly `staging`. The production Editor Portal Worker also uses that staging Super Admin D1 for its `CSA_SUPERADMIN_DB` binding. This creates a mixed-environment boundary: production hostnames and a production editor-orders database are coupled to staging administration infrastructure.

Do not treat a successful staging deployment or authenticated staging dashboard as production readiness.

## Observed production routes

Zone: `creatorsupportamravati.in`  
Zone ID: `683ea74f1645d22bc4a4e42cd57b12b0`

| Route pattern | Current Worker | Assessment |
|---|---|---|
| `superadmin.creatorsupportamravati.in/*` | `csa-superadmin-api-staging` | **BLOCKER:** production hostname routes to a Worker configured with `ENVIRONMENT=staging`. |
| `superadmin.creatorsupportamravati.in/editor-management*` | `csa-editor-portal` | Production Editor Worker; its admin DB binding is staging (see below). |
| `superadmin.creatorsupportamravati.in/editor-api/*` | `csa-editor-portal` | Production Editor Worker; its admin DB binding is staging (see below). |
| `superadmin.creatorsupportamravati.in/rush-approvals*` | `csa-rush-admin-staging` | **BLOCKER:** production hostname routes to staging-named Rush Worker with staging D1 bindings. |
| `superadmin.creatorsupportamravati.in/rush-api/*` | `csa-rush-admin-staging` | **BLOCKER:** production hostname routes to staging-named Rush Worker with staging D1 bindings. |
| `editor.creatorsupportamravati.in/*` | `csa-editor-portal` | Production Editor Portal Worker. |
| `employee.creatorsupportamravati.in/*` | `csa-employee-gateway` | **BLOCKER:** gateway service binding points to `csa-superadmin-api-staging`, not a production backend. |
| `superadmin-staging.creatorsupportamravati.in/*` | `csa-superadmin-api-staging` | Staging route. |
| `superadmin-editor-staging.creatorsupportamravati.in/*` | `csa-superadmin-isolated-staging` | Isolated staging route. |

The route list also includes isolated staging editor API and Rush routes. The employee gateway's service binding and Rush production-host routes add two more staging-to-production boundary violations. No production route was edited.

## Observed Worker binding identities

Only resource identifiers and non-secret environment labels are recorded. Secret values were not read.

| Worker | Environment | D1 binding | Bound D1 UUID |
|---|---|---|---|
| `csa-superadmin-api-staging` | `staging` | `DB` | `99bc81fc-e97e-488b-a380-eb0237ff8ffc` (`csa-superadmin-staging`) |
| `csa-superadmin-isolated-staging` | `staging` | `DB` | `c2bb3fb5-db22-4ed5-9283-161df57ebac2` (`csa-superadmin-isolated-staging`) |
| `csa-superadmin-isolated-staging` | `staging` | `GLOBAL_DB` | `470a81b8-3d36-4e2d-942c-5cbb2746a473` (`csa-global-platform-staging`) |
| `csa-editor-portal` | production route | `CSA_SUPERADMIN_DB` | `99bc81fc-e97e-488b-a380-eb0237ff8ffc` (`csa-superadmin-staging`) |
| `csa-editor-portal` | production route | `CSA_VIDEO_DB` | `72a5d236-1ae1-4362-9a51-e6fb9b9840c8` (`csa-orders`) |
| `csa-editor-portal-isolated-staging` | `staging` | `CSA_SUPERADMIN_DB` | `c2bb3fb5-db22-4ed5-9283-161df57ebac2` |
| `csa-editor-portal-isolated-staging` | `staging` | `CSA_VIDEO_DB` | `b611b8ff-8f9f-43b2-95c8-a767a14987d6` (`csa-video-isolated-staging`) |
| `csa-rush-admin-staging` | staging-named Worker | `CSA_RUSH_DB` | `198a0604-af4d-4671-8053-5df245ea754c` (`csa-video-rush-staging`) |
| `csa-rush-admin-staging` | staging-named Worker | `CSA_SUPERADMIN_DB` | `99bc81fc-e97e-488b-a380-eb0237ff8ffc` (`csa-superadmin-staging`) |
| `csa-rush-admin-isolated-staging` | `staging` | `CSA_RUSH_DB` | `198a0604-af4d-4671-8053-5df245ea754c` |
| `csa-rush-admin-isolated-staging` | `staging` | `CSA_SUPERADMIN_DB` | `c2bb3fb5-db22-4ed5-9283-161df57ebac2` |
| `csa-employee-gateway` | production hostname route | service binding `EMPLOYEE_BACKEND` | `csa-superadmin-api-staging` |
| `csa-global-api` | `production` | `DB` | `23462947-5ab9-41ea-a25a-0fac0e6349d7` (`csa-global-platform`) |
| `csa-global-api` | `production` | `LEGACY_VIDEO_DB` | `72a5d236-1ae1-4362-9a51-e6fb9b9840c8` (`csa-orders`) |
| `csa-global-api-staging` | `staging` | `DB` | `470a81b8-3d36-4e2d-942c-5cbb2746a473` |
| `csa-global-api-isolated-staging` | `staging` | `DB` | `6a32dda3-b8c5-413c-9f51-58f0a9fa0712` (`csa-global-platform-isolated-staging`) |
| `csa-global-api-isolated-staging` | `staging` | `LEGACY_VIDEO_DB` | `2d3f97a0-fa32-46ef-9913-972a59a410e4` (`csa-global-legacy-video-isolated-staging`) |

## Additional isolation finding

The isolated Super Admin Worker has a `GLOBAL_DB` binding to the regular staging Global Platform D1 (`470a...`), while the isolated Global API Worker is bound to `6a32...`. A source scan of the currently tracked isolated Super Admin Worker did not find any `env.GLOBAL_DB` reads; this binding appears unused in that source snapshot. Do not repoint or remove it until deployed code/version parity and intended data flow are confirmed.

The two Global Platform D1 databases are not schema-identical: the isolated database `6a32...` and regular staging database `470a...` have different schema objects, including country-legal-review and finance-bridge objects in the latter. Treat them as distinct databases, not interchangeable replicas.

## Required remediation sequence

1. Freeze production launch and avoid new production data entry until routing and binding ownership are resolved. This applies to Super Admin, Editor Management, Rush Admin and Employee Portal paths.
2. Establish the intended production Super Admin Worker and its production D1 UUID. The current script inventory did not show a dedicated `csa-superadmin-api` production Worker; do not simply point the production route at a staging Worker.
3. Review the production Super Admin D1 schema, backup/restore capability, and ownership before any route change.
4. Prepare and test a production Super Admin Worker from reviewed source with `ENVIRONMENT=production`, correct production D1, correct Access configuration, and independently scoped secrets.
5. Decide whether the production Editor Portal should share the production Super Admin D1 or use a separate explicitly designed service binding. Its current `CSA_SUPERADMIN_DB` binding to staging D1 must not be left implicit.
6. Test the full route matrix on staging and a production-like isolated environment, including login, OTP, admin authorization sync, editor management, and audit logs.
7. Take and verify restorable backups before any production binding or route migration.
8. Apply route/binding changes only in a scheduled, explicitly approved production change window; immediately verify route ownership, health, login, D1 connectivity, and rollback readiness.
9. Verify all remaining production hosts, including employee and payment routes, before public launch.

## Explicitly not performed

- No Worker route was created, edited, or deleted.
- No Worker was uploaded or redeployed by this audit.
- No D1 binding was changed.
- No D1 migration, export, backup, restore, or data transfer was performed.
- No secret value was retrieved, rotated, or installed.
- No production user, payment, KYC, or client data was queried.
- No production DNS, Access policy, payment provider, or R2 configuration was changed.

## Evidence interpretation

This audit is a point-in-time read-only inspection of Cloudflare route records, Worker settings/binding metadata, D1 database metadata, and schema object names. It does not prove all application workflows or production data correctness. Re-run the route and binding audit immediately before the approved remediation window.


## Isolated staging operational spot-check

A read-only query of the isolated Super Admin sync log and isolated Global API authorization counts found:

- Latest recorded scheduled sync: **success**, 2026-11-22 08:45:47 UTC, 1 authorization record synchronized.
- Earlier historical failures in the same log included HTTP 401, 404 and 500. The latest success is encouraging, but a longer sequence of scheduled successes and a reviewed authorization reconciliation are still needed.
- Isolated Global API currently has 1 active and 1 revoked authorization record; the count query did not retrieve email addresses or other user details.
- The isolated Super Admin dashboard's Central Control and HR/Finance panels load on tab selection. Their initial HTML contains placeholder text such as "Loading…"; that text in a full-page DOM extraction alone is not evidence of a live API failure. The UI code calls `loadCentral()`, `loadHR()` and `loadFinance()` when those tabs are selected.

These checks were read-only except for the already-existing scheduled sync that had completed before the query. No manual sync was triggered.


## Current staging cross-binding notes (2026-11-22)

- `csa-global-api-staging` and `csa-global-api-isolated-staging` both currently bind `LEGACY_VIDEO_DB` to `2d3f97a0-fa32-46ef-9913-972a59a410e4` and `LEGACY_VIDEO_BUCKET` to `csa-global-video-isolated-staging`. The isolated API has a separate primary D1 (`6a32dda3-b8c5-413c-9f51-58f0a9fa0712`), but its legacy claim database and legacy bucket are shared with regular staging. Treat isolated staging as only partially isolated until this is deliberately resolved.
- The isolated Super Admin Worker has a `GLOBAL_DB` binding to regular staging D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473`; the tracked Worker source snapshot contains no `env.GLOBAL_DB` reads. Do not remove or repoint without deployed-source parity and dependency review.
- The latest D1 inventory returned 11 databases. The previous 10/10 account-capacity observation is stale; the current account plan/quota was not verified.
- Latest isolated Worker deployments were observed for Global API and Super Admin at 08:57 UTC. Their deployed source contents still did not contain the legacy readiness endpoints present in the tracked source snapshots. The Editor Portal health peer endpoint was present. See `LEGACY_BRIDGE_SECRET_SETUP.md` for deployment parity details.



## Follow-up read-only checks (2026-11-22)

- Aggregate counts on the shared staging legacy D1 `2d3f97a0-fa32-46ef-9913-972a59a410e4` returned 0 `video_editors`, 0 `video_editing_orders`, and 0 `video_editing_assignments`. The shared binding remains an isolation concern even though these tables are currently empty.
- Isolated Global Admin sync now has four consecutive scheduled successes: 08:45:46, 09:00:46, 09:15:47 and 09:30:46 UTC, each with `synced_count=1`. Earlier 500, 404 and 401 failures remain in history and should stay visible in monitoring. Aggregate Global API authorization state is one active `editor_admin` and one revoked `super_admin`; no email or personal record was queried.
- The new read-only Worker binding preflight workflow initially returned HTTP 403 because the existing GitHub Actions Cloudflare token could not read Worker settings. The workflow now uses a separate `CLOUDFLARE_WORKERS_READ_TOKEN` secret and remains manual-only. It does not require or read secret values; a successful run still needs a token with Workers Scripts Read permission.



## Worker custom-domain and staging portal route audit

The Worker Custom Domains API returned these additional hostname mappings:

| Hostname | Worker service | Environment | Assessment |
|---|---|---|---|
| `admin.creatorsupportamravati.in` | `csa-superadmin-api-staging` | production custom-domain binding | **BLOCKER:** production hostname is attached to a staging-named Worker. |
| `superadmin.creatorsupportamravati.in` | `csa-superadmin-api-staging` | production custom-domain binding | **BLOCKER:** confirmed above. |
| `employee.creatorsupportamravati.in` | `csa-employee-gateway` | production custom-domain binding | **BLOCKER:** its backend service binding points to `csa-superadmin-api-staging`. |
| `admin-staging.creatorsupportamravati.in` | `csa-superadmin-api-staging` custom domain | production custom-domain binding | A Worker Route for the same hostname maps to `csa-superadmin-isolated-staging`; Cloudflare documents that a matching Worker Route takes precedence over the Custom Domain. Effective staging traffic is therefore routed to the isolated Worker. |
| `superadmin-staging.creatorsupportamravati.in` | `csa-superadmin-api-staging` | production custom-domain binding | Regular staging Worker. |
| `regional-staging.creatorsupportamravati.in` | `csa-superadmin-isolated-staging` | production custom-domain binding | **Configured:** isolated Regional Admin portal hostname is present and enabled. |

Cloudflare routing reference: <https://developers.cloudflare.com/workers/configuration/routing/routes/> (Routes take precedence over a Custom Domain on the same hostname).

## Country Management and Regional Admin — live staging state

The live isolated Super Admin Worker was inspected read-only. Unlike the tracked source snapshot, its deployed code already contains Country Management, Regional Admins, Country Assignments, and the V2 Regional Admin Portal. The `regional-staging.creatorsupportamravati.in` Custom Domain is enabled and points to this isolated Worker. Do not redeploy the older GitHub source snapshot over this deployed Worker until the source-of-truth drift is reconciled.

### Separate country registries

- Isolated Super Admin D1 `c2bb3fb5-db22-4ed5-9283-161df57ebac2` has 249 rows in `csa_country_registry`, plus its own `csa_country_legal_reviews`, assignment, invitation, permissions and audit tables.
- Global API isolated D1 `6a32dda3-b8c5-413c-9f51-58f0a9fa0712` has 249 rows in `countries`, and separate `regional_admins`, `regional_admin_permissions`, and `regional_admin_audit_logs` tables.
- India is `setup` / `not_started` in the Super Admin country registry, with orders, payments and payouts disabled. In the Global API registry it is `planned`, with payments and payouts disabled. There are no India legal-review records in either checked registry.
- The isolated Super Admin D1 currently has zero Regional Admin principals, assignments, invitations, permissions and Regional Admin audit rows. The Global API isolated D1 has zero `regional_admins` and zero `regional_admin_permissions`.
- The two country registries are separate databases. No country update or Regional Admin assignment was made during this audit.

### Remaining cross-Worker integration gate

The deployed isolated Super Admin Worker maintains its own country registry and uses a signed `regionalGlobalProxy` for Regional Admin read requests. The currently deployed isolated Global API Worker contains the `/internal/regional/` read endpoints, but does not contain the Super Admin country/assignment synchronization route `/internal/superadmin/regional-admin-data` present in the tracked API source. The deployed isolated Super Admin Worker also does not call that missing route. Consequently, local Super Admin assignments are not yet proven to create matching Global API `regional_admins` and permission records. The Global API isolated D1 is also missing `country_legal_reviews`, which the tracked country-management API source requires.

A new additive migration `0033_country_legal_review_registry.sql` and disposable SQLite test have been added to source and CI. They are **not applied remotely**. Before enabling Regional Admin access, the isolated integration must be reconciled, the missing Global API schema must be applied with explicit staging-write approval, and an end-to-end country assignment/read-scope test must pass.

### Source-of-truth warning

The deployed `csa-superadmin-isolated-staging` Worker includes more country and Regional Admin functionality than `workers/source-snapshots/csa-superadmin-isolated-staging/*` in the repository. The live Worker source must be exported/reconciled into maintainable tracked modules before any Worker deployment from the repository. Do not overwrite the deployed UI with the older snapshot.


## Global Admin HMAC sync — 09:45 UTC regression

The latest scheduled sync at 09:45:46 UTC returned HTTP 401 after four successful runs at 08:45, 09:00, 09:15 and 09:30 UTC.

Read-only Worker version metadata shows:
- Super Admin Worker version 113 was created at 09:43:06 UTC with annotation triggered_by=secret. Its binding names include both ADMIN_SYNC_HMAC_SECRET and GLOBAL_API_SYNC_HMAC_SECRET.
- Global API Worker version 49 was created at 09:31:17 UTC. Its HMAC secret binding list includes ADMIN_SYNC_HMAC_SECRET, but not GLOBAL_API_SYNC_HMAC_SECRET.
- The deployed Super Admin sync helper selects GLOBAL_API_SYNC_HMAC_SECRET first and falls back to ADMIN_SYNC_HMAC_SECRET. The Global API verifier uses ADMIN_SYNC_HMAC_SECRET.

This sequence is strongly consistent with a newly introduced GLOBAL_API_SYNC_HMAC_SECRET override that does not match the Global API verifier secret. Secret values were not read and cannot be compared here, so the exact mismatch is not independently confirmed.

**Owner-only security action required:** ensure both sides use the exact same HMAC secret value and one canonical binding name. The minimal likely correction is to remove the new override from the Super Admin Worker so the previously working ADMIN_SYNC_HMAC_SECRET fallback is used, or deliberately synchronize the values on both Workers. Do not paste secret values into ChatGPT. After correction, verify a fresh scheduled run returns success before relying on Global Admin sync.
