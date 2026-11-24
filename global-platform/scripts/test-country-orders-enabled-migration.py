#!/usr/bin/env python3
"""Smoke-test the additive canonical countries.orders_enabled migration."""

from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
migration = (ROOT / "migrations" / "0035_country_orders_enabled.sql").read_text(encoding="utf-8")

db = sqlite3.connect(":memory:")
db.execute("""
CREATE TABLE countries (
  country_code TEXT PRIMARY KEY CHECK(length(country_code)=2),
  country_name TEXT NOT NULL,
  currency_code TEXT,
  timezone TEXT,
  commercial_status TEXT NOT NULL DEFAULT 'planned',
  payment_enabled INTEGER NOT NULL DEFAULT 0 CHECK(payment_enabled IN (0,1)),
  payout_enabled INTEGER NOT NULL DEFAULT 0 CHECK(payout_enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
""")
db.executemany(
    "INSERT INTO countries(country_code,country_name) VALUES(?,?)",
    [("IN", "India"), ("US", "United States"), ("GB", "United Kingdom")],
)
db.executescript(migration)

columns = {row[1] for row in db.execute("PRAGMA table_info(countries)")}
assert "orders_enabled" in columns, "orders_enabled column was not added"
rows = db.execute("SELECT country_code,orders_enabled FROM countries ORDER BY country_code").fetchall()
assert rows == [("GB", 0), ("IN", 0), ("US", 0)], rows

db.execute("UPDATE countries SET orders_enabled=1 WHERE country_code='IN'")
assert db.execute("SELECT orders_enabled FROM countries WHERE country_code='IN'").fetchone()[0] == 1

try:
    db.execute("UPDATE countries SET orders_enabled=2 WHERE country_code='US'")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("orders_enabled CHECK constraint accepted a value other than 0 or 1")

assert db.execute("PRAGMA foreign_key_check").fetchall() == []
print("PASS: migration adds orders_enabled, preserves existing countries as disabled, and enforces the boolean flag.")
