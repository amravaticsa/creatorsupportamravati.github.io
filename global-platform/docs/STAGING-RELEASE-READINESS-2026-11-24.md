# CSA Global staging release-readiness audit

**Audit timestamp:** 2026-11-25 02:48 UTC  
**Environment:** Cloudflare staging only  
**Result:** Main and isolated staging stacks are separated. Infrastructure, schema guards, authentication-boundary smoke tests and the first complete daily backup cycle pass. Real identity enrollment, approved commercial rules, payment credentials and production migration remain blocked.

## 1. Two distinct staging Global databases

The project has two separate staging stacks. They must not be merged or silently rebound to one another.

| Component | Main staging stack | Isolated staging stack |
|---|---|---|
| Global API Worker | `csa-global-api-staging` | `csa-global-api-isolated-staging` |
| Global D1 | `470a81b8-3d36-4e2d-942c-5cbb2746a473` | `6a32dda3-b8c5-413c-9f51-58f0a9fa0712` |
| Super Admin Worker | `csa-superadmin-api-staging` | `csa-superadmin-isolated-staging` |
| Super Admin identity D1 | `99bc81fc-e97e-488b-a380-eb0237ff8ffc` | `c2bb3fb5-db22-4ed5-9283-161df57ebac2` |
| Legacy video D1 | `2d3f97a0-fa32-46ef-9913-972a59a410e4` | `b611b8ff-8f9f-43b2-95c8-a767a14987d6` |

The isolated Super Admin Worker has `DB` → D1 c2bb and `GLOBAL_API_DB`, `CANONICAL_GLOBAL_DB`, and `GLOBAL_DB` → isolated Global D1 6a32. The main staging Super Admin service uses its separate D1 99bc and syncs to the main Global API on D1 470.

The `v_tender_country_scope` view exists only in isolated D1 6a32 and is the unique isolated-stack schema marker. Both Global D1s contain `country_legal_evidence`; the main API guard requires that table and rejects the isolated view, while isolated API and isolated Super Admin guards require the view. These fail-closed guards prevent a cross-stack binding change from silently writing to the wrong database.

## 2. Current Worker and storage bindings

| Worker | Verified D1 bindings | R2 |
|---|---|---|
| `csa-global-api-staging` | `DB` → main Global D1 470; `LEGACY_VIDEO_DB` → 2d3f | Main media bucket `csa-global-media-staging`; main video bucket `csa-global-video-isolated-staging` |
| `csa-global-api-isolated-staging` | `DB` → isolated Global D1 6a32; `LEGACY_VIDEO_DB` → b611 | Isolated media bucket `csa-global-media-isolated-staging`; video bucket `csa-video-editing-isolated-staging` |
| `csa-superadmin-isolated-staging` | `DB` → c2bb; all Global D1 aliases → 6a32 | Attendance evidence bucket `csa-attendance-evidence-staging` |
| `csa-editor-portal-isolated-staging` | `CSA_SUPERADMIN_DB` → c2bb; `CSA_VIDEO_DB` → b611 | `csa-video-editing-isolated-staging` |
| `csa-global-db-backup-staging` | Ten staging D1 bindings; `DB_GLOBAL` → isolated D1 6a32; `DB_GLOBAL_LEGACY` → main D1 470 | Private `csa-global-db-backups-staging` |

The isolated Super Admin Cloudflare Access audience allowlist now contains all four isolated staging host-app audiences, and the Worker parses comma-separated audience values. The `admin-staging` Access app remains restricted by its allow policy. The CI smoke test now checks the Access redirect without following the external login flow, retries transient network failures, and passed in the latest staging deployment. The isolated API auth-boundary smoke test now uses the actual Workers account subdomain rather than the incorrect `amravaticsa.workers.dev` hostname.

## 3. D1 structural and data checks

All ten D1 databases attached to the backup Worker were checked with `PRAGMA foreign_key_check`; each returned **zero foreign-key violations**. A separate `PRAGMA quick_check` on all ten also returned `ok`.

| Logical database | Tables | FK violations |
|---|---:|---:|
| Main staging Global | 59 | 0 |
| Isolated Global | 59 | 0 |
| Isolated Super Admin | 50 | 0 |
| Main Super Admin legacy | 34 | 0 |
| Isolated video | 14 | 0 |
| Main Global video legacy | 11 | 0 |
| Editor Super Admin legacy | 33 | 0 |
| Video workflow | 10 | 0 |
| Rush | 3 | 0 |
| Rush isolated | 3 | 0 |

Both Global D1 databases currently contain 249 country rows, 2 users and 3 projects. All three projects remain country-unassigned. The isolated Super Admin country registry contains 249 rows; legal-review records remain zero. No country was legally approved or commercially activated by this setup.

Both D1s have the `country_legal_evidence` table and zero evidence rows. Only isolated D1 6a32 has the `v_tender_country_scope` view; it currently has zero country legal-review rows. The isolated HMAC admin sync has completed 42 consecutive scheduled successes since the schema-role guard fix, from 16:30:03.637 UTC on 24 November through 02:45:04.021 UTC on 25 November, syncing one authorization each run against D1 6a32. The isolated 16:15 attempt returned 503 before the schema fix; no later scheduled failure is recorded. The main and isolated syncs target their matching Global API Worker/D1 pair.

## 4. Backup, storage and large uploads

- The backup Worker has ten D1 bindings and ten daily Cron schedules at 02:02, 02:07, 02:12, 02:17, 02:22, 02:27, 02:32, 02:37, 02:42 and 02:47 UTC.
- The private backup bucket is `csa-global-db-backups-staging`, in APAC Infrequent Access.
- Its R2 lifecycle expires `daily/` backups after 30 days and aborts incomplete multipart uploads after 7 days.
- The backup source verifies each database's role before export: `global` must be isolated D1 6a32, while `global_legacy` must be main D1 470. It captures schema, rows, indexes, views, triggers, quick-check and foreign-key results, gzip-compresses, reads back and verifies the R2 object, then writes a manifest.
- The backup Worker has been rebound to `DB_GLOBAL` 6a32 and `DB_GLOBAL_LEGACY` 470. The first full daily cycle with final bindings and schema-role guards completed on 25 November, 02:02–02:47 UTC (07:32–08:17 IST): all ten D1 exports have `verification_status=verified`, `quick_check=ok`, and zero foreign-key violations. The 10 R2 data objects, 10 manifests and 10 verification markers cover 276 tables and 2,291 rows. Each object was read back, decompressed and checked against its manifest. The backup Worker source and deployed module are byte-for-byte synchronized; all ten D1 bindings and schedules are verified.
- Six inspected staging R2 buckets have no custom public domains and disabled managed public domains. The backup Worker has no public workers.dev or preview subdomain.
- Large uploads use direct upload up to 90 MB and resumable R2 multipart uploads above 90 MB up to 5 GB per file. Parts are 50 MB, sessions expire after 24 hours, each part is SHA-256 checked, and upload operations are scoped to the authenticated uploader. The canonical upload tables currently show zero open sessions and zero orphaned parts; cleanup logs contain 179 successful runs.

## 5. Application and CI validation

- Staging Pages deployment, frontend/API health, Regional Admin API rejection of unsigned requests, and admin/regional/editor portal route/session-protection smoke checks passed in the latest staging deployment. Client Login, Admin Login, Editor Login and Editor Registration pages are now plain shells without shared top bar, header or footer; a CI regression test covers all four.
- API validation includes Google auth, client upload security, project/country scope, finance read-only, regional bridge authentication, editor workflows, and schema/migration checks.
- Finance Admin is enforced as `finance.read` only; Write/Manage options are hidden/disabled in the Super Admin UI.
- Razorpay checkout remains unconfigured; no payment, refund or payout was executed.
- The GitHub Worker configuration preflight cannot read Worker settings with the existing Pages token (HTTP 403). It correctly records a skipped detailed check rather than reporting a false pass. Add a separate least-privilege `CLOUDFLARE_WORKERS_READ_TOKEN` repository secret with Workers Scripts Read permission to enable the automated read-only binding check. The workflow now includes isolated Rush Admin and the legacy Super Admin binding guard; manual Cloudflare verification was performed during this audit.

## 6. Business activation gates

| Gate | Current evidence | Required before activation |
|---|---|---|
| Regional Admin | 0 principals and invitations | Real human enrollment and authorized identity review |
| Country legal approval | 249 country entries; 0 legal-review/evidence records | Genuine country-specific evidence and authorized approval |
| Client scope | 2 clients; 3 projects country-unassigned | Evidence-backed country verification and project assignment |
| Editor onboarding | 0 editor profiles/credentials, tenders, assignments or submissions | Real editor enrollment, verification, agreements and operational tests |
| Pricing | 0 pricing policies | Owner-approved prices, currency, deposits, commissions and refund rules |
| Payments | 0 payment/refund/payout records; no Razorpay Test Mode credentials | Test Mode credentials and webhook config, followed by test-only E2E |
| Finance Admin | 0 accounts | Enroll only if needed; read-only access remains enforced |
| Authenticated E2E | No valid enrolled Editor/Regional Admin identities | Run with real approved staging identities |

No fake legal approvals, client verification, editor accounts, pricing rules, payment transactions or refunds were created.

## 7. Production release blockers

The separate production route audit still finds production hostnames routed to staging-named Super Admin/Rush services, and the production Editor Worker uses a staging Super Admin D1 binding. Production migration needs its own approved architecture, backups, route plan, change window and rollback plan.

**Do not fix these production route issues by pointing production hosts to isolated staging Workers.** No production Worker, D1, R2, DNS, route, secret or payment configuration was modified during this staging work.

The separate legacy staging hostname `superadmin-staging.creatorsupportamravati.in` remains routed to `csa-superadmin-api-staging`, bound to the non-isolated `csa-superadmin-staging` D1 (99bc…) and `csa-attendance-evidence` R2 bucket. Its whole-host Cloudflare Access policy and unauthenticated route smoke tests pass. Its 595-row D1 backup and full temporary-D1 restore rehearsal pass, but the existing admin identities and unrevoked sessions must be migrated or formally retired before this hostname is repointed or removed. The `admin-staging` alias routes to the isolated Super Admin Worker and has whole-host Access protection.

## 8. Release decision

**Staging infrastructure status:** core isolation, schema, auth-boundary smoke tests and the first 10/10 verified daily backup cycle pass. Controlled onboarding and commercial activation remain gated by real identities, approvals and test credentials.  
**Commercial activation:** not ready.  
**Production launch:** blocked.

This report distinguishes verified infrastructure state from legal, user-enrollment and payment prerequisites. Refresh it after the next 15-minute isolated HMAC sync, the first corrected daily backup cycle, and any binding, route or secret change.


## 9. First complete daily backup cycle — 25 November 2026

**Result: 10/10 staging D1 backups completed and passed read-back verification.**

The private Worker `csa-global-db-backup-staging` executed all ten scheduled slots from 02:02 through 02:47 UTC. Each completion event reported `verification_status=verified`, `quick_check=ok`, and `foreign_key_violations=0`.

| UTC slot | Logical database | D1 UUID suffix | Tables | Rows | Read-back |
|---|---|---|---:|---:|---|
| 02:02 | Isolated Global | `6a32…` | 59 | 552 | Verified |
| 02:07 | Isolated Super Admin | `c2bb…` | 50 | 654 | Verified |
| 02:12 | Main Super Admin legacy | `99bc…` | 34 | 595 | Verified |
| 02:17 | Main Global legacy | `470a…` | 59 | 490 | Verified |
| 02:22 | Isolated video legacy | `b611…` | 14 | 0 | Verified |
| 02:27 | Isolated Global video legacy subsystem | `2d3f…` | 11 | 0 | Verified |
| 02:32 | Editor Super Admin legacy | `1fc2…` | 33 | 0 | Verified |
| 02:37 | Video workflow | `69f0…` | 10 | 0 | Verified |
| 02:42 | Rush | `198a…` | 3 | 0 | Verified |
| 02:47 | Isolated Rush | `99c7…` | 3 | 0 | Verified |

Each backup includes schema, rows, indexes, views, triggers and integrity results. The Worker decompresses each R2 object and validates its database identity, table/row counts, quick-check and foreign-key count before writing a manifest and verification record. The R2 bucket remains private and the Worker has no public subdomain.

**Restore rehearsal status (25 November):** schema restoration has been exercised for all ten databases in disposable D1 databases. Full row-level restore has passed for the six isolated databases in the earlier six-database rehearsal and the 595-row legacy Super Admin database in the current rehearsal. The zero-row video workflow and main Rush databases passed schema/empty-dataset restore checks. The 490-row legacy Global database passed schema-only restoration (59 tables, 65 indexes, 3 views, 13 triggers), but its data rows were not copied into the temporary D1; full row-level restore remains a release blocker. All temporary restore databases were deleted after checks. Read-back verification alone is not a substitute for a full restore.


## 10. Latest operational recheck — 25 November 2026, 02:45 UTC

- The latest isolated Super Admin → isolated Global API admin-authorization sync completed at **02:45:04 UTC** with `outcome=success`, `synced_count=1`, and no error code. The previous 15-minute runs at 02:30, 02:15 and 02:00 UTC also succeeded.
- The isolated Super Admin identity database contains 2 admin accounts: one active `super_admin` and one active `editor_admin`. The Global API authorization sync remains least-privilege; the local Super Admin identity is not granted a Global API master role.
- The isolated Global D1 contains 2 client users and 3 projects. All 3 projects remain `country_unassigned`; there are 0 verified country-evidence rows and 0 country-assignment audit rows.
- The isolated Super Admin country registry has 249 countries. All 249 remain `setup` / `not_started`; orders, payments and payouts are disabled. The isolated Global D1 has 249 country rows and 0 legal-review rows. No legal approvals were fabricated.
- Finance Admin remains read-only in both API authorization and Super Admin UI. No Finance Admin account or payment/refund/payout records exist.
- The latest successful staging Pages deployment and full staging smoke-test run completed on commit `05e3168b42eaefa6410e0da1072bfe10b9299560`. The validation workflow also passed all API, migration, finance, HMAC, country-scope, editor, portal and backup-schedule tests.
- The Worker configuration preflight's detailed Cloudflare settings checks remain **INCOMPLETE** because the existing GitHub Actions token cannot read Worker settings (HTTP 403). The workflow now adds a job summary to distinguish skipped checks from completed checks. Manual Cloudflare configuration checks were performed separately; secret values were never read.
- The first complete ten-database backup cycle is verified above. A controlled restore drill into disposable D1, followed by application-level recovery smoke tests, remains pending.
- Production route findings in the separate production audit remain unchanged: several production hostnames/service bindings still point to staging-configured Workers or staging D1. No production route, Worker, D1, R2, DNS, secret, Access or payment setting was changed.

**Current release decision:** isolated/main staging infrastructure is stable for controlled onboarding tests. Legal/commercial activation and production release remain blocked by the genuine business prerequisites and production route remediation described above.
