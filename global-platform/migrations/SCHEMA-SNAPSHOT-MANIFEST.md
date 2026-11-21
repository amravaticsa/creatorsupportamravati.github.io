# CSA staging schema snapshot manifest

Generated: 2026-11-21

| File | Characters | Tables | Explicit indexes | Triggers |
|---|---:|---:|---:|---:|
| `global-platform/migrations/2026-11-21-superadmin-schema.sql` | 28306 | 33 | 36 | 6 |
| `global-platform/migrations/2026-11-21-rush-schema.sql` | 2714 | 3 | 4 | 0 |

Schema only; no application rows or credentials are included. These counts are checked against the committed files. They establish file completeness at the object-count level, not successful execution on Cloudflare D1. Run `python3 global-platform/scripts/verify-schema-snapshots.py` for local SQLite smoke testing, then validate on a disposable D1 before production.
