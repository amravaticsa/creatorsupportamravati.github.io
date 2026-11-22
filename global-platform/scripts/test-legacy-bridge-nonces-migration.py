#!/usr/bin/env python3
"""Exercise migration 0027 against a disposable in-memory SQLite database only."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "global-platform" / "migrations" / "0027_legacy_bridge_nonces.sql"

def main():
    sql = MIGRATION.read_text(encoding="utf-8")
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(sql)

    columns = {row[1] for row in db.execute("PRAGMA table_info(legacy_bridge_nonces)")}
    assert {"nonce", "expires_at", "created_at"} <= columns

    db.execute(
        "INSERT INTO legacy_bridge_nonces (nonce, expires_at) VALUES (?, ?)",
        ("disposable-nonce-00000000000001", 1900000000),
    )
    try:
        db.execute(
            "INSERT INTO legacy_bridge_nonces (nonce, expires_at) VALUES (?, ?)",
            ("disposable-nonce-00000000000001", 1900000001),
        )
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("Duplicate nonce was not rejected by the primary key")

    indexes = {row[1] for row in db.execute("PRAGMA index_list(legacy_bridge_nonces)")}
    assert "idx_legacy_bridge_nonces_expiry" in indexes

    db.execute("DELETE FROM legacy_bridge_nonces WHERE expires_at < ?", (1900000001,))
    assert db.execute("SELECT COUNT(*) FROM legacy_bridge_nonces").fetchone()[0] == 0
    db.close()
    print("Migration 0027 passed disposable SQLite nonce uniqueness, expiry and index checks.")

if __name__ == "__main__":
    main()
