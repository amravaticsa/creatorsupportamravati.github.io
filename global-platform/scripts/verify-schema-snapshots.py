#!/usr/bin/env python3
"""Validate CSA schema-only snapshots using Python's built-in SQLite engine.

Run from the repository root:
  python3 global-platform/scripts/verify-schema-snapshots.py
This is a local syntax/constraint smoke test, not a Cloudflare D1 compatibility
or production migration test. A disposable D1 test is still required.
"""
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[2]
CASES = {
    "superadmin": {
        "path": ROOT / "global-platform/migrations/2026-11-21-superadmin-schema.sql",
        "expected": {"table": 33, "index": 36, "trigger": 6},
        "required": {
            "admin_accounts", "admin_permissions", "admin_sessions",
            "admin_enrollment_tokens", "csa_admin_module_access",
            "csa_module_registry", "csa_activity_events", "csa_employees",
            "csa_clients", "csa_projects", "csa_invoices", "csa_payments",
        },
    },
    "rush": {
        "path": ROOT / "global-platform/migrations/2026-11-21-rush-schema.sql",
        "expected": {"table": 3, "index": 4, "trigger": 0},
        "required": {
            "rush_delivery_audit", "rush_delivery_quotes", "video_editing_orders",
        },
    },
}


def main() -> int:
    failed = False
    for name, case in CASES.items():
        path = case["path"]
        if not path.is_file():
            print(f"FAIL {name}: missing {path}")
            failed = True
            continue

        db = sqlite3.connect(":memory:")
        db.execute("PRAGMA foreign_keys = ON")
        try:
            db.executescript(path.read_text(encoding="utf-8"))
            counts = {
                kind: db.execute(
                    "SELECT count(*) FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%'",
                    (kind,),
                ).fetchone()[0]
                for kind in ("table", "index", "trigger")
            }
            # SQLite autoindexes have NULL SQL and are not represented in the
            # snapshot; count only explicit indexes with non-NULL SQL.
            counts["index"] = db.execute(
                "SELECT count(*) FROM sqlite_master WHERE type='index' AND sql IS NOT NULL"
            ).fetchone()[0]
            missing = case["required"] - {
                row[0] for row in db.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            fk_errors = list(db.execute("PRAGMA foreign_key_check"))
            integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
            ok = counts == case["expected"] and not missing and not fk_errors and integrity == "ok"
            print(
                f"{'PASS' if ok else 'FAIL'} {name}: counts={counts}, "
                f"missing_tables={sorted(missing)}, foreign_key_errors={len(fk_errors)}, "
                f"integrity={integrity}"
            )
            failed |= not ok
        except sqlite3.Error as exc:
            print(f"FAIL {name}: SQLite rejected schema: {exc}")
            failed = True
        finally:
            db.close()

    print("NOTE: Passing this script does not replace testing against a disposable Cloudflare D1 database.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
