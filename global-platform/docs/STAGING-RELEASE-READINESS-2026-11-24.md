# CSA Global staging release-readiness audit

**Audit timestamp:** 2026-11-24 15:50 UTC  
**Environment:** Cloudflare isolated staging only  
**Result:** Technical staging foundation is operational; business activation and production release remain blocked.

## 1. Current Worker binding map

All settings below were read after the 24-November binding correction. No production Worker or route was changed.

| Worker | Primary D1 | Additional D1 | R2 |
|---|---|---|---|
| `csa-global-api-staging` | `DB` → canonical Global D1 `470a81b8…` | `LEGACY_VIDEO_DB` → `2d3f97a0…` | `MEDIA` → `csa-global-media-staging`; legacy video bucket → `csa-global-video-isolated-staging` |
| `csa-global-api-isolated-staging` | `DB` → canonical Global D1 `470a81b8…` | `LEGACY_VIDEO_DB` → isolated video D1 `b611b8ff…` | `MEDIA` → `csa-global-media-isolated-staging`; legacy video bucket → `csa-video-editing-isolated-staging` |
| `csa-superadmin-isolated-staging` | `DB` → Super Admin identity D1 `c2bb3fb5…` | `CANONICAL_GLOBAL_DB` and `GLOBAL_API_DB` → `470a81b8…`; compatibility `GLOBAL_DB` → `6a32dda3…` | `ATTENDANCE_MEDIA` → `csa-attendance-evidence-staging` |
| `csa-editor-portal-isolated-staging` | `CSA_SUPERADMIN_DB` → `c2bb3fb5…` | `CSA_VIDEO_DB` → `b611b8ff…` | `CSA_VIDEO_BUCKET` → `csa-video-editing-isolated-staging` |
| `csa-global-db-backup-staging` | Ten staging D1 bindings, including canonical `DB_GLOBAL` → `470a81b8…` and compatibility `DB_GLOBAL_LEGACY` → `6a32dda3…` | — | `BACKUPS` → `csa-global-db-backups-staging` |

The isolated API and its private media bucket are deliberately separate from the regular staging media bucket. The compatibility D1 is retained as a distinct legacy store; it is not the canonical country/project data source.

## 2. D1 structural checks

All ten D1 databases attached to the backup Worker were checked with `PRAGMA foreign_key_check`. Each returned **zero foreign-key violations**.

| Logical database | Tables | FK violations |
|---|---:|---:|
| Canonical Global | 59 | 0 |
| Super Admin isolated | 50 | 0 |
| Super Admin legacy | 34 | 0 |
| Global compatibility | 58 | 0 |
| Video isolated | 14 | 0 |
| Global video legacy | 11 | 0 |
| Editor Super Admin legacy | 33 | 0 |
| Video workflow | 10 | 0 |
| Rush | 3 | 0 |
| Rush isolated | 3 | 0 |

The canonical Global D1 currently has 249 country rows, 2 users and 3 projects. Its country legal review and country evidence tables have zero records. The Super Admin country registry has 249 rows and zero legal-review rows. No country was legally approved or commercially activated by this setup.

The compatibility Global D1 also currently contains 249 country rows, 2 users and 3 projects. It remains separate; the application must use the canonical D1 for current country verification and project scope.

## 3. Backup and storage controls

- The backup Worker has ten D1 bindings and ten daily Cron schedules at 02:02, 02:07, 02:12, 02:17, 02:22, 02:27, 02:32, 02:37, 02:42 and 02:47 UTC.
- The private backup bucket is `csa-global-db-backups-staging`, in APAC, Infrequent Access.
- Its R2 lifecycle policy expires `daily/` logical backups after 30 days and aborts incomplete multipart uploads after 7 days.
- The backup Worker source includes database UUIDs, schema/data exports, trigger and foreign-key checks, gzip compression, R2 readback/decompression verification and per-database manifests. The repository regression tests for mapping, readback verification and manifest ordering passed in the latest validation run.
- The backup bucket has no custom domains; its managed `r2.dev` domain is disabled. The staging media, video and attendance-evidence buckets also have no custom domains and disabled managed domains.
- Earlier 24-November backup objects created before the binding correction are diagnostic only, not approved restore inputs. The first daily backup cycle using the corrected bindings and readback path remains pending.

## 4. Application and CI validation

- GitHub Actions run `45383651707`: staging Pages deployment and post-deploy route/API smoke checks completed successfully.
- GitHub Actions run `45383651913`: CSA Global API validation and disposable SQLite migration checks completed successfully.
- The smoke workflow checks the staging frontend, API health, unauthenticated API rejection, isolated Super Admin/Admin portals, Editor portal, and unsigned Editor bridge rejection.
- The last-hour Cloudflare Worker telemetry query found no error-level events for the isolated Super Admin, isolated Global API or backup Worker.
- Finance Admin is enforced as read-only (`finance.read`); Write/Manage options are hidden/disabled in the Super Admin UI.
- R2 custom domains and public managed domains remain disabled for the inspected staging buckets.

The read-only Worker configuration preflight cannot inspect Worker settings using the existing GitHub Pages deployment token; Cloudflare returned HTTP 403. The workflow records this and skips the detailed checks rather than falsely reporting them as passed. Manual Cloudflare settings verification was performed for this audit. To enable automatic checks, add a separate least-privilege GitHub Actions secret named `CLOUDFLARE_WORKERS_READ_TOKEN` with Cloudflare Workers Scripts Read permission. Secret values must not be placed in source control or logs.

## 5. Business activation gates still open

| Gate | Current evidence | Required before activation |
|---|---|---|
| Regional Admin | 0 Regional Admin principals and invitations | Real human enrollment and authorized identity review |
| Country legal approval | 249 country registry entries; 0 legal-review/evidence records | Genuine country-specific legal evidence and approval by an authorized reviewer |
| Client scope | 2 client accounts; 3 projects are country-unassigned | Evidence-backed country verification and project assignment |
| Editor onboarding | 0 editor profiles/credentials, 0 tenders/assignments/submissions | Real editor enrollment, verification, agreements and operational tests |
| Pricing | 0 pricing policies | Owner-approved prices, currency, deposits, commissions and refund rules |
| Payments | 0 payment, refund and payout records; Razorpay Test Mode credentials absent | Test Mode credentials and webhook configuration, followed by test-only E2E |
| Finance Admin | 0 Finance Admin accounts | Enroll only if needed; read-only access remains enforced |
| Authenticated E2E | No valid enrolled editor/Regional Admin identities for full workflows | Run end-to-end tests using real approved staging identities |

No fake legal approvals, client verification, editor accounts, pricing rules, payment transactions or refunds were created.

## 6. Production release blockers

The separate production route audit still finds production hostnames routed to staging-named Super Admin/Rush services, and the production Editor Worker uses a staging Super Admin D1 binding. The employee gateway also points to the staging Super Admin backend. Production migration needs its own approved architecture, backups, route plan, change window and rollback plan.

**Do not fix these production route issues by pointing production hosts to isolated staging Workers.** No production Worker, D1, R2, DNS, route, secret or payment configuration was modified during this staging work.

## 7. Release decision

**Staging technical status: ready for controlled onboarding tests after the external prerequisites are supplied.**  
**Commercial activation: not ready.**  
**Production launch: blocked.**

This report distinguishes verified infrastructure state from user/legal/payment prerequisites and must be refreshed after the first corrected scheduled backup cycle and after any binding, route or secret change.
