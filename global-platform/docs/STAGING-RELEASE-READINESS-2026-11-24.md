# CSA Global staging release-readiness audit

**Audit timestamp:** 2026-11-24 16:14 UTC  
**Environment:** Cloudflare staging only  
**Result:** Main and isolated staging stacks are separated. Technical staging is ready for controlled onboarding tests; commercial activation and production release remain blocked.

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

The isolated Super Admin Cloudflare Access audience allowlist now contains all four isolated staging host-app audiences, and the Worker parses comma-separated audience values. The `admin-staging` Access app remains restricted by its allow policy. Its unauthenticated smoke test previously encountered a connection reset; the CI check now validates the Access redirect without following the external login flow and retries transient network failures.

## 3. D1 structural and data checks

All ten D1 databases attached to the backup Worker were checked with `PRAGMA foreign_key_check`. Each returned **zero foreign-key violations**.

| Logical database | Tables | FK violations |
|---|---:|---:|
| Main staging Global | 59 | 0 |
| Isolated Global | 58 | 0 |
| Isolated Super Admin | 50 | 0 |
| Main Super Admin legacy | 34 | 0 |
| Isolated video | 14 | 0 |
| Main Global video legacy | 11 | 0 |
| Editor Super Admin legacy | 33 | 0 |
| Video workflow | 10 | 0 |
| Rush | 3 | 0 |
| Rush isolated | 3 | 0 |

Both Global D1 databases currently contain 249 country rows, 2 users and 3 projects. All three projects remain country-unassigned. The isolated Super Admin country registry contains 249 rows; legal-review records remain zero. No country was legally approved or commercially activated by this setup.

Both D1s have the `country_legal_evidence` table and zero evidence rows. Only isolated D1 6a32 has the `v_tender_country_scope` view; it currently has zero country legal-review rows. The isolated HMAC admin sync and main HMAC admin sync are separate and target their matching Global API Worker/D1 pair.

## 4. Backup, storage and large uploads

- The backup Worker has ten D1 bindings and ten daily Cron schedules at 02:02, 02:07, 02:12, 02:17, 02:22, 02:27, 02:32, 02:37, 02:42 and 02:47 UTC.
- The private backup bucket is `csa-global-db-backups-staging`, in APAC Infrequent Access.
- Its R2 lifecycle expires `daily/` backups after 30 days and aborts incomplete multipart uploads after 7 days.
- The backup source verifies each database's role before export: `global` must be isolated D1 6a32, while `global_legacy` must be main D1 470. It captures schema, rows, indexes, views, triggers, quick-check and foreign-key results, gzip-compresses, reads back and verifies the R2 object, then writes a manifest.
- The backup Worker has been rebound to `DB_GLOBAL` 6a32 and `DB_GLOBAL_LEGACY` 470. The first daily backup cycle after this role correction and the new schema-role guards remains pending.
- Six inspected staging R2 buckets have no custom public domains and disabled managed public domains. The backup Worker has no public workers.dev or preview subdomain.
- Large uploads use direct upload up to 90 MB and resumable R2 multipart uploads above 90 MB up to 5 GB per file. Parts are 50 MB, sessions expire after 24 hours, each part is SHA-256 checked, and upload operations are scoped to the authenticated uploader. The canonical upload tables currently show zero open sessions and zero orphaned parts; cleanup logs contain 179 successful runs.

## 5. Application and CI validation

- Staging Pages deployment and frontend/API smoke checks have passed on recent runs.
- API validation includes Google auth, client upload security, project/country scope, finance read-only, regional bridge authentication, editor workflows, and schema/migration checks.
- Finance Admin is enforced as `finance.read` only; Write/Manage options are hidden/disabled in the Super Admin UI.
- Razorpay checkout remains unconfigured; no payment, refund or payout was executed.
- The GitHub Worker configuration preflight cannot read Worker settings with the existing Pages token (HTTP 403). It correctly records a skipped detailed check rather than reporting a false pass. Add a separate least-privilege `CLOUDFLARE_WORKERS_READ_TOKEN` repository secret with Workers Scripts Read permission to enable the automated read-only binding check. Manual Cloudflare verification was performed during this audit.

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

## 8. Release decision

**Main and isolated staging technical status:** ready for controlled onboarding tests after the remaining CI checks and the first corrected backup cycle.  
**Commercial activation:** not ready.  
**Production launch:** blocked.

This report distinguishes verified infrastructure state from legal, user-enrollment and payment prerequisites. Refresh it after the next 15-minute isolated HMAC sync, the first corrected daily backup cycle, and any binding, route or secret change.
