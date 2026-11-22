#!/usr/bin/env python3
"""Disposable SQLite invariant tests; no remote database or live records are accessed."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "global-platform/migrations/0026_legacy_editor_identity_bridge.sql"
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
db.executescript("""
CREATE TABLE users (id TEXT PRIMARY KEY);
CREATE TABLE editor_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id));
CREATE TABLE assignments (id TEXT PRIMARY KEY);
INSERT INTO users(id) VALUES ('admin-1'), ('admin-2'), ('editor-1'), ('editor-2'), ('editor-3');
INSERT INTO editor_profiles(user_id) VALUES ('editor-1'), ('editor-2'), ('editor-3');
INSERT INTO assignments(id) VALUES ('assignment-1'), ('assignment-2'), ('assignment-3');
""")
db.executescript(MIGRATION.read_text(encoding="utf-8"))

def reject(label, sql, params=()):
    try:
        db.execute(sql, params)
    except sqlite3.IntegrityError:
        db.rollback()
        print("PASS:", label)
        return
    raise AssertionError("Expected rejection: " + label)

db.execute("""INSERT INTO legacy_editor_identity_links
(editor_user_id,legacy_editor_id,link_status,created_by)
VALUES ('editor-1','legacy-1','pending','admin-1')""")
reject("duplicate legacy identity", """INSERT INTO legacy_editor_identity_links
(editor_user_id,legacy_editor_id,link_status,created_by)
VALUES ('editor-2','legacy-1','pending','admin-1')""")
reject("duplicate Global identity", """INSERT INTO legacy_editor_identity_links
(editor_user_id,legacy_editor_id,link_status,created_by)
VALUES ('editor-1','legacy-2','pending','admin-1')""")
reject("unknown Global editor foreign key", """INSERT INTO legacy_editor_identity_links
(editor_user_id,legacy_editor_id,link_status,created_by)
VALUES ('missing','legacy-x','pending','admin-1')""")
reject("unknown creator foreign key", """INSERT INTO legacy_editor_identity_links
(editor_user_id,legacy_editor_id,link_status,created_by)
VALUES ('editor-2','legacy-2','pending','missing-admin')""")
reject("invalid identity status", """INSERT INTO legacy_editor_identity_links
(editor_user_id,legacy_editor_id,link_status,created_by)
VALUES ('editor-2','legacy-2','linked','admin-1')""")
reject("activation without review timestamp", """UPDATE legacy_editor_identity_links
SET link_status='active' WHERE editor_user_id='editor-1'""")
db.execute("""UPDATE legacy_editor_identity_links SET link_status='active',
reviewed_by='admin-2',reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE editor_user_id='editor-1'""")
assert db.execute("SELECT link_status,reviewed_by FROM legacy_editor_identity_links").fetchone() == ("active","admin-2")
print("PASS: reviewed mapping activation")
db.execute("""UPDATE legacy_editor_identity_links SET link_status='revoked',
revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE editor_user_id='editor-1'""")
assert db.execute("SELECT link_status,legacy_editor_id FROM legacy_editor_identity_links").fetchone() == ("revoked","legacy-1")
print("PASS: revocation retains mapping history")

db.execute("""INSERT INTO legacy_assignment_links
(global_assignment_id,legacy_order_id,idempotency_key,bridge_status)
VALUES ('assignment-1','order-1','idem-1','pending')""")
reject("duplicate legacy order", """INSERT INTO legacy_assignment_links
(global_assignment_id,legacy_order_id,idempotency_key,bridge_status)
VALUES ('assignment-2','order-1','idem-2','pending')""")
reject("duplicate Global assignment", """INSERT INTO legacy_assignment_links
(global_assignment_id,legacy_order_id,idempotency_key,bridge_status)
VALUES ('assignment-1','order-2','idem-2','pending')""")
reject("reused idempotency key", """INSERT INTO legacy_assignment_links
(global_assignment_id,legacy_order_id,idempotency_key,bridge_status)
VALUES ('assignment-2','order-2','idem-1','pending')""")
reject("unknown Global assignment foreign key", """INSERT INTO legacy_assignment_links
(global_assignment_id,legacy_order_id,idempotency_key,bridge_status)
VALUES ('missing','order-x','idem-x','pending')""")
reject("invalid bridge status", """INSERT INTO legacy_assignment_links
(global_assignment_id,legacy_order_id,idempotency_key,bridge_status)
VALUES ('assignment-2','order-2','idem-2','sent')""")
reject("created state requires legacy assignment ID", """UPDATE legacy_assignment_links
SET bridge_status='created' WHERE global_assignment_id='assignment-1'""")
db.execute("""UPDATE legacy_assignment_links SET bridge_status='created',
legacy_assignment_id='legacy-assignment-1' WHERE global_assignment_id='assignment-1'""")
assert db.execute("""SELECT bridge_status,legacy_order_id,legacy_assignment_id,idempotency_key
FROM legacy_assignment_links""").fetchone() == ("created","order-1","legacy-assignment-1","idem-1")
print("PASS: created transfer requires stable legacy assignment ID")
reject("duplicate legacy assignment ID", """INSERT INTO legacy_assignment_links
(global_assignment_id,legacy_order_id,legacy_assignment_id,idempotency_key,bridge_status)
VALUES ('assignment-2','order-2','legacy-assignment-1','idem-2','created')""")
assert db.execute("SELECT COUNT(*) FROM legacy_assignment_links").fetchone()[0] == 1
assert db.execute("SELECT COUNT(*) FROM legacy_editor_identity_links").fetchone()[0] == 1
print("PASS: revocation preserves assignment history")
print("Legacy editor bridge disposable SQLite invariant tests passed.")
