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
