#!/usr/bin/env python3
"""Exercise country assignment migration 0031 on disposable in-memory SQLite only."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0031_country_assignment_audit.sql"

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript("""
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  account_status TEXT NOT NULL,
  email TEXT,
  email_verified_at TEXT,
  created_at TEXT NOT NULL,
  country_code TEXT
);
CREATE TABLE client_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  country TEXT
);
CREATE TABLE editor_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  country TEXT,
  verification_status TEXT
);
CREATE TABLE editor_kyc_documents (
  id TEXT PRIMARY KEY,
  editor_id TEXT,
  status TEXT,
  created_at TEXT
);
""")
db.executescript(MIGRATION.read_text(encoding="utf-8"))

# A self-reported profile country is retained, but authoritative country remains null.
db.execute(
    "INSERT INTO users(id,role,account_status,email,created_at,country_code) VALUES(?,?,?,?,?,NULL)",
    ("client_1", "client", "active", "client@example.test", "2026-11-22T00:00:00Z"),
)
db.execute("INSERT INTO client_profiles(user_id,display_name,country) VALUES(?,?,?)",
           ("client_1", "Client One", "India"))
db.execute(
    "INSERT INTO users(id,role,account_status,email,created_at,country_code) VALUES(?,?,?,?,?,NULL)",
    ("editor_1", "editor", "pending", "editor@example.test", "2026-11-22T00:00:00Z"),
)
db.execute(
    "INSERT INTO editor_profiles(user_id,display_name,country,verification_status) VALUES(?,?,?,?)",
    ("editor_1", "Editor One", "India", "pending"),
)

rows = db.execute(
    "SELECT user_id,profile_country_text,assignment_status FROM v_country_assignment_review ORDER BY user_id"
).fetchall()
assert rows == [
    ("client_1", "India", "needs_verified_country"),
    ("editor_1", "India", "needs_verified_country"),
], rows

# Directly setting the authoritative country without an immutable evidence record is blocked.
try:
    db.execute(
        "UPDATE users SET country_code='IN',country_verified_at='2026-11-22T00:00:00Z',"
        "country_verified_by='admin_123',country_evidence_ref='https://example.gov.in/evidence' "
        "WHERE id='client_1'"
    )
    raise AssertionError("Unaudited country assignment unexpectedly succeeded")
except sqlite3.IntegrityError as exc:
    assert "country_assignment_requires_immutable_audit_record" in str(exc), str(exc)

# Empty evidence cannot be recorded.
try:
    db.execute(
        "INSERT INTO country_user_assignment_audit(id,user_id,country_code,actor_admin_id,evidence_reference) "
        "VALUES(?,?,?,?,?)",
        ("audit_bad", "client_1", "IN", "admin_123", ""),
    )
    raise AssertionError("Empty evidence unexpectedly accepted")
except sqlite3.IntegrityError as exc:
    assert "country_assignment_audit_requires_unassigned_user_and_valid_evidence" in str(exc), str(exc)

# Evidence-backed assignment succeeds and is reflected by the review view.
db.execute(
    "INSERT INTO country_user_assignment_audit(id,user_id,country_code,actor_admin_id,evidence_reference,verification_note) "
    "VALUES(?,?,?,?,?,?)",
    ("audit_1", "client_1", "IN", "admin_123", "https://example.gov.in/evidence", "Verified by reviewer"),
)
db.execute(
    "UPDATE users SET country_code='IN',country_verified_at='2026-11-22T00:00:00Z',"
    "country_verified_by='admin_123',country_evidence_ref='https://example.gov.in/evidence' WHERE id='client_1'"
)
status = db.execute(
    "SELECT assignment_status,verified_country_code FROM v_country_assignment_review WHERE user_id='client_1'"
).fetchone()
assert status == ("assigned", "IN"), status

# Audit rows are immutable; verified country cannot be changed.
for statement in [
    "UPDATE country_user_assignment_audit SET verification_note='changed' WHERE id='audit_1'",
    "DELETE FROM country_user_assignment_audit WHERE id='audit_1'",
    "UPDATE users SET country_code='US' WHERE id='client_1'",
]:
    try:
        db.execute(statement)
        raise AssertionError("Immutable audit/country guard unexpectedly allowed: " + statement)
    except sqlite3.IntegrityError:
        pass

# New accounts cannot insert an authoritative country directly.
try:
    db.execute(
        "INSERT INTO users(id,role,account_status,email,created_at,country_code) VALUES(?,?,?,?,?,?)",
        ("client_2", "client", "active", "client2@example.test", "2026-11-22T00:00:00Z", "IN"),
    )
    raise AssertionError("New account country assignment unexpectedly succeeded")
except sqlite3.IntegrityError as exc:
    assert "new_accounts_require_post_creation_superadmin_country_assignment" in str(exc), str(exc)

print("PASS: migration 0031 enforces evidence-backed, append-only, immutable country assignment.")
