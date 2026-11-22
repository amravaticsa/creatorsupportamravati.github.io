#!/usr/bin/env python3
"""Disposable SQLite tests for the append-only country legal review migration."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0033_country_legal_review_registry.sql"

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript("""
CREATE TABLE countries (
  country_code TEXT PRIMARY KEY,
  country_name TEXT NOT NULL
);
INSERT INTO countries(country_code,country_name) VALUES
  ('IN','India'),('US','United States');
""")

db.executescript(MIGRATION.read_text(encoding="utf-8"))

columns = {
    row[1] for row in db.execute("PRAGMA table_info(country_legal_reviews)").fetchall()
}
assert columns == {
    "id", "country_code", "review_status", "reviewer_source_admin_id",
    "evidence_reference", "legal_notes", "reviewed_at", "created_at", "updated_at"
}, columns

# Pending reviews may be recorded before an approval decision.
db.execute(
    "INSERT INTO country_legal_reviews(id,country_code,review_status,reviewer_source_admin_id) "
    "VALUES(?,?,?,?)",
    ("pending_1", "IN", "pending", "admin_001"),
)

# Approval without a verifiable evidence reference is blocked.
try:
    db.execute(
        "INSERT INTO country_legal_reviews(id,country_code,review_status,reviewer_source_admin_id) "
        "VALUES(?,?,?,?)",
        ("bad_approval", "IN", "approved", "admin_001"),
    )
    raise AssertionError("Approved review without evidence unexpectedly succeeded")
except sqlite3.IntegrityError as exc:
    assert "country_legal_review_requires_valid_reviewer_and_evidence" in str(exc), str(exc)

# Valid approval with an evidence reference succeeds.
db.execute(
    "INSERT INTO country_legal_reviews(id,country_code,review_status,reviewer_source_admin_id,"
    "evidence_reference,legal_notes,reviewed_at) VALUES(?,?,?,?,?,?,?)",
    ("approved_1", "IN", "approved", "admin_001",
     "https://example.gov.in/legal-evidence", "Reviewed by authorised counsel",
     "2026-11-22T00:00:00Z"),
)

# Invalid status, missing country, malformed reviewer, and overlong evidence are rejected.
invalid_rows = [
    ("bad_status", "IN", "active", "admin_001", "ref"),
    ("bad_country", "ZZ", "pending", "admin_001", None),
    ("bad_reviewer", "IN", "pending", "x", None),
    ("long_evidence", "IN", "pending", "admin_001", "x" * 1001),
]
for row_id, country, status, reviewer, evidence in invalid_rows:
    try:
        db.execute(
            "INSERT INTO country_legal_reviews(id,country_code,review_status,reviewer_source_admin_id,evidence_reference) "
            "VALUES(?,?,?,?,?)",
            (row_id, country, status, reviewer, evidence),
        )
        raise AssertionError("Invalid legal review unexpectedly succeeded: " + row_id)
    except sqlite3.IntegrityError:
        pass

# Review history is append-only.
for statement in [
    "UPDATE country_legal_reviews SET legal_notes='changed' WHERE id='approved_1'",
    "DELETE FROM country_legal_reviews WHERE id='approved_1'",
]:
    try:
        db.execute(statement)
        raise AssertionError("Legal review history unexpectedly changed: " + statement)
    except sqlite3.IntegrityError as exc:
        assert "country_legal_reviews_are_immutable" in str(exc), str(exc)

latest = db.execute(
    "SELECT review_status,evidence_reference FROM country_legal_reviews "
    "WHERE country_code='IN' ORDER BY created_at DESC,id DESC LIMIT 1"
).fetchone()
assert latest[0] in ("pending", "approved"), latest
assert db.execute(
    "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_country_legal_reviews_country_created'"
).fetchone()[0] == 1

print("PASS: migration 0033 creates evidence-backed, append-only country legal review history.")
