#!/usr/bin/env python3
"""Execute the legacy editor bridge migration against a disposable SQLite schema."""
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
INSERT INTO users(id) VALUES ('admin-1'), ('editor-1'), ('editor-2');
INSERT INTO editor_profiles(user_id) VALUES ('editor-1'), ('editor-2');
INSERT INTO assignments(id) VALUES ('assignment-1'), ('assignment-2');
""")
db.executescript(MIGRATION.read_text(encoding="utf-8"))

db.execute("""
INSERT INTO legacy_editor_identity_links
(editor_user_id, legacy_editor_id, link_status, created_by)
VALUES ('editor-1', 'legacy-1', 'pending', 'admin-1')
""")
try:
    db.execute("""
    INSERT INTO legacy_editor_identity_links
    (editor_user_id, legacy_editor_id, link_status, created_by)
    VALUES ('editor-2', 'legacy-1', 'pending', 'admin-1')
    """)
    raise AssertionError("Duplicate legacy editor ID was accepted")
except sqlite3.IntegrityError:
    pass

try:
    db.execute("""
    UPDATE legacy_editor_identity_links SET link_status='active'
    WHERE editor_user_id='editor-1'
    """)
    raise AssertionError("Active link without reviewer timestamp was accepted")
except sqlite3.IntegrityError:
    pass

db.execute("""
UPDATE legacy_editor_identity_links
SET link_status='active', reviewed_by='admin-1',
    reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE editor_user_id='editor-1'
""")

db.execute("""
INSERT INTO legacy_assignment_links
(global_assignment_id, legacy_order_id, idempotency_key, bridge_status)
VALUES ('assignment-1', 'order-1', 'idem-1', 'pending')
""")
try:
    db.execute("""
    INSERT INTO legacy_assignment_links
    (global_assignment_id, legacy_order_id, idempotency_key, bridge_status)
    VALUES ('assignment-2', 'order-1', 'idem-2', 'pending')
    """)
    raise AssertionError("Duplicate legacy order mapping was accepted")
except sqlite3.IntegrityError:
    pass

try:
    db.execute("""
    UPDATE legacy_assignment_links SET bridge_status='created'
    WHERE global_assignment_id='assignment-1'
    """)
    raise AssertionError("Created bridge without legacy assignment ID was accepted")
except sqlite3.IntegrityError:
    pass

db.execute("""
UPDATE legacy_assignment_links
SET bridge_status='created', legacy_assignment_id='legacy-assignment-1'
WHERE global_assignment_id='assignment-1'
""")
print("Legacy editor bridge migration SQLite smoke test passed.")
