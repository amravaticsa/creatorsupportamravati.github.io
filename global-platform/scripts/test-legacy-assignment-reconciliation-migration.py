#!/usr/bin/env python3
"""Disposable SQLite migration test; no remote D1 or live records are accessed."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "global-platform/migrations/0026_legacy_editor_identity_bridge.sql"
MIGRATION = ROOT / "global-platform/migrations/0029_legacy_assignment_reconciliation_state.sql"

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
db.executescript("""
CREATE TABLE users (id TEXT PRIMARY KEY);
CREATE TABLE editor_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id));
CREATE TABLE assignments (id TEXT PRIMARY KEY);
INSERT INTO users(id) VALUES ('admin-1'),('admin-2'),('editor-1');
INSERT INTO editor_profiles(user_id) VALUES ('editor-1');
INSERT INTO assignments(id) VALUES ('as-pending'),('as-created'),('as-failed'),('as-revoked'),
 ('as-uncertain'),('as-absent');
""")
db.executescript(BASE.read_text(encoding="utf-8"))
db.executescript("""
INSERT INTO legacy_assignment_links
(global_assignment_id,legacy_order_id,legacy_assignment_id,idempotency_key,bridge_status,last_error_code)
VALUES
 ('as-pending','order-pending',NULL,'key-pending','pending',NULL),
 ('as-created','order-created','legacy-assignment-created','key-created','created',NULL),
 ('as-failed','order-failed',NULL,'key-failed','failed','legacy_rejected'),
 ('as-revoked','order-revoked',NULL,'key-revoked','revoked',NULL);
""")
db.executescript(MIGRATION.read_text(encoding="utf-8"))


def reject(label, sql, params=()):
    db.execute("SAVEPOINT expected_rejection")
    try:
        db.execute(sql, params)
    except sqlite3.IntegrityError:
        db.execute("ROLLBACK TO expected_rejection")
        db.execute("RELEASE expected_rejection")
        print("PASS:", label)
        return
    db.execute("RELEASE expected_rejection")
    raise AssertionError("Expected rejection: " + label)


rows = db.execute("""
SELECT global_assignment_id,bridge_status,legacy_assignment_id,remote_result_state
FROM legacy_assignment_links ORDER BY global_assignment_id
""").fetchall()
assert rows == [
    ("as-created","created","legacy-assignment-created","confirmed_created"),
    ("as-failed","failed",None,"definite_failure"),
    ("as-pending","pending",None,"not_attempted"),
    ("as-revoked","revoked",None,"not_attempted"),
]
print("PASS: migration preserves existing pending/created/failed/revoked records")

indexes = {row[1] for row in db.execute("PRAGMA index_list(legacy_assignment_links)")}
assert "idx_legacy_assignment_links_status" in indexes
print("PASS: status index recreated")

# An uncertain result must have a request fingerprint, correlation ID and explicit code.
db.execute("""
INSERT INTO legacy_assignment_links
(global_assignment_id,legacy_order_id,idempotency_key,bridge_status,last_error_code,
 request_hash,correlation_id,remote_result_state)
VALUES ('as-uncertain','order-uncertain','key-uncertain','pending',NULL,NULL,NULL,'not_attempted')
""")
db.execute("""
UPDATE legacy_assignment_links SET bridge_status='reconciliation_required',
 last_error_code='remote_result_uncertain',request_hash=?,correlation_id=?,
 remote_result_state='unknown'
WHERE global_assignment_id='as-uncertain'
""", ("a"*64,"corr-uncertain"))
assert db.execute("""
SELECT bridge_status,remote_result_state,last_error_code
FROM legacy_assignment_links WHERE global_assignment_id='as-uncertain'
""").fetchone() == ("reconciliation_required","unknown","remote_result_uncertain")
print("PASS: uncertain remote outcome is durably represented")

reject("uncertain transfer cannot be reset to pending", """
UPDATE legacy_assignment_links SET bridge_status='pending',last_error_code=NULL,
 remote_result_state='not_attempted'
WHERE global_assignment_id='as-uncertain'
""")
reject("uncertain transfer cannot become created without reconciliation audit", """
UPDATE legacy_assignment_links SET bridge_status='created',
 legacy_assignment_id='legacy-as-uncertain',last_error_code=NULL,
 remote_result_state='reconciled_created'
WHERE global_assignment_id='as-uncertain'
""")

db.execute("""
UPDATE legacy_assignment_links SET bridge_status='created',
 legacy_assignment_id='legacy-as-uncertain',last_error_code=NULL,
 remote_result_state='reconciled_created',
 reconciled_at='2026-11-22T00:00:00Z',reconciled_by='admin-2',
 reconciliation_note='Found exact legacy assignment by correlation ID'
WHERE global_assignment_id='as-uncertain'
""")
assert db.execute("""
SELECT bridge_status,legacy_assignment_id,remote_result_state,reconciled_by
FROM legacy_assignment_links WHERE global_assignment_id='as-uncertain'
""").fetchone() == ("created","legacy-as-uncertain","reconciled_created","admin-2")
print("PASS: exact remote match can be linked with reviewer evidence")

# Authoritative absence is also an audited reconciliation, never an automatic retry.
db.execute("""
INSERT INTO legacy_assignment_links
(global_assignment_id,legacy_order_id,idempotency_key,bridge_status,last_error_code,
 request_hash,correlation_id,remote_result_state)
VALUES ('as-absent','order-absent','key-absent','reconciliation_required',
 'remote_result_uncertain',?,?,'unknown')
""", ("b"*64,"corr-absent"))
reject("absence cannot be declared without reviewer evidence", """
UPDATE legacy_assignment_links SET bridge_status='failed',
 remote_result_state='reconciled_absent'
WHERE global_assignment_id='as-absent'
""")
db.execute("""
UPDATE legacy_assignment_links SET bridge_status='failed',
 remote_result_state='reconciled_absent',last_error_code='reconciled_remote_absent',
 reconciled_at='2026-11-22T00:01:00Z',reconciled_by='admin-2',
 reconciliation_note='Exact legacy order lookup confirmed no assignment'
WHERE global_assignment_id='as-absent'
""")
assert db.execute("""
SELECT bridge_status,remote_result_state,reconciled_by
FROM legacy_assignment_links WHERE global_assignment_id='as-absent'
""").fetchone() == ("failed","reconciled_absent","admin-2")
print("PASS: authoritative absence requires reviewer, timestamp and evidence")

reject("failed transfer cannot be silently reset", """
UPDATE legacy_assignment_links SET bridge_status='pending',
 last_error_code=NULL,remote_result_state='not_attempted'
WHERE global_assignment_id='as-absent'
""")
reject("created transfer cannot be overwritten", """
UPDATE legacy_assignment_links SET bridge_status='pending',
 legacy_assignment_id=NULL,last_error_code=NULL,remote_result_state='not_attempted'
WHERE global_assignment_id='as-uncertain'
""")
reject("revoked transfer is terminal", """
UPDATE legacy_assignment_links SET bridge_status='pending',
 remote_result_state='not_attempted'
WHERE global_assignment_id='as-revoked'
""")
reject("duplicate correlation ID rejected", """
INSERT INTO legacy_assignment_links
(global_assignment_id,legacy_order_id,idempotency_key,bridge_status,last_error_code,
 request_hash,correlation_id,remote_result_state)
VALUES ('as-pending','order-dup','key-dup','reconciliation_required',
 'remote_result_uncertain',?,?,'unknown')
""", ("c"*64,"corr-uncertain"))

assert db.execute("PRAGMA foreign_key_check").fetchall() == []
assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
print("PASS: foreign keys and SQLite integrity remain valid")
print("Legacy assignment reconciliation migration tests passed.")
