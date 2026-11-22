# CSA staging schema snapshot manifest

Generated: 2026-11-21

| File | Characters | Tables | Explicit indexes | Triggers |
|---|---:|---:|---:|---:|
| `global-platform/migrations/2026-11-21-superadmin-schema.sql` | 28306 | 33 | 36 | 6 |
| `global-platform/migrations/2026-11-21-rush-schema.sql` | 2714 | 3 | 4 | 0 |

Schema only; no application rows or credentials are included. These counts are checked against the committed files. They establish file completeness at the object-count level, not successful execution on Cloudflare D1. Run `python3 global-platform/scripts/verify-schema-snapshots.py` for local SQLite smoke testing, then validate on a disposable D1 before production.


## Finance access scope update — 2026-11-22

- Migration: `0030_global_admin_finance_access_level.sql`.
- Adds `global_admin_authorizations.finance_access_level` with allowed values `none`, `read`, `write`, and `manage`; default is `none`.
- Canonical staging D1 `csa-global-platform-staging` already contained this column before the source migration was committed.
- Isolated staging D1 `csa-global-platform-isolated-staging` was upgraded with the same additive column during this setup.
- Before applying migration 0030 to any existing D1, inspect `PRAGMA table_info(global_admin_authorizations)`; do not apply it again where the column already exists.


## Audited country assignment update — 2026-11-22

- Migration: `0031_country_assignment_audit.sql`.
- Adds `users.country_verified_at`, `users.country_verified_by`, and `users.country_evidence_ref`; adds immutable `country_user_assignment_audit`, evidence validation triggers, and the extended `v_country_assignment_review` view.
- Applied to canonical staging D1 `csa-global-platform-staging` (`470a81b8-3d36-4e2d-942c-5cbb2746a473`). The isolated D1 copy already had the same audit table and triggers.
- Existing canonical Client rows had `users.country_code=NULL`; no country assignments or audit rows were written. They now appear as `needs_verified_country` until a Super Admin completes evidence-backed assignment.
- The Super Admin Worker `GLOBAL_DB` remains bound to isolated Global D1 6a32; `DB` remains the separate Super Admin account/session D1 c2bb. Canonical Client/Editor API D1 470 also has the migration but is not the active Regional Admin data source.
- New Client/Editor onboarding writes `users.country_code=NULL`; self-reported country remains in profile fields. Only the Super Admin verification workflow can set the authoritative user country.


## Verified project country scope — migration 0032

- Migration: `0032_verified_country_scope.sql`.
- Applied to canonical Global Staging D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473`.
- Rebuilds `v_project_country_scope` so a Client's country is included only when `users.country_verified_at`, `country_verified_by`, and `country_evidence_ref` are all present and the country code is valid.
- The isolated D1 6a32 already had this stricter view. Canonical and isolated views now use the same verified-country rule.
- Read-only verification: all three existing canonical projects remain `country_unassigned`; no project is included in India's Regional Admin scope until evidence-backed assignment.
