#!/usr/bin/env python3
"""Disposable SQLite contract tests; never connects to Cloudflare D1."""
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "workers/source-snapshots/csa-editor-portal-isolated-staging/migrations/0001_legacy_assignment_bridge_ledger.sql"


class LegacySideLedgerMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.sql = MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(self.sql)

    def tearDown(self):
        self.db.close()

    def insert(self, **overrides):
        row = {
            "id": "ledger-0001",
            "correlation_id": "correlation-0001",
            "idempotency_key": "idem-key-0001",
            "request_hash": "a" * 64,
            "legacy_order_id": "order-0001",
            "order_code": "CSA-ORDER-001",
            "editor_id": "editor-0001",
            "assignment_id": "assignment-0001",
            "result_state": "created",
        }
        row.update(overrides)
        self.db.execute(
            """INSERT INTO legacy_assignment_bridge_ledger
            (id,correlation_id,idempotency_key,request_hash,legacy_order_id,
             order_code,editor_id,assignment_id,result_state)
            VALUES (:id,:correlation_id,:idempotency_key,:request_hash,:legacy_order_id,
                    :order_code,:editor_id,:assignment_id,:result_state)""",
            row,
        )

    def test_migration_creates_expected_table_and_index(self):
        names = {r[0] for r in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','index')")}
        self.assertIn("legacy_assignment_bridge_ledger", names)
        self.assertIn("idx_legacy_assignment_bridge_ledger_created", names)

    def test_valid_created_ledger_row(self):
        self.insert()
        self.assertEqual(self.db.execute(
            "SELECT result_state FROM legacy_assignment_bridge_ledger").fetchone()[0], "created")

    def test_idempotency_key_is_unique(self):
        self.insert()
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert(id="ledger-0002", correlation_id="correlation-0002",
                        legacy_order_id="order-0002", assignment_id="assignment-0002")

    def test_correlation_id_is_unique(self):
        self.insert()
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert(id="ledger-0002", idempotency_key="idem-key-0002",
                        legacy_order_id="order-0002", assignment_id="assignment-0002")

    def test_one_bridge_record_per_legacy_order(self):
        self.insert()
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert(id="ledger-0002", correlation_id="correlation-0002",
                        idempotency_key="idem-key-0002", assignment_id="assignment-0002")

    def test_assignment_id_is_unique(self):
        self.insert()
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert(id="ledger-0002", correlation_id="correlation-0002",
                        idempotency_key="idem-key-0002", legacy_order_id="order-0002")

    def test_request_hash_must_be_lowercase_sha256_hex(self):
        for bad in ("short", "A" * 64, "g" * 64):
            with self.subTest(bad=bad), self.assertRaises(sqlite3.IntegrityError):
                self.insert(request_hash=bad)

    def test_only_confirmed_created_state_is_recorded(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert(result_state="unknown")

    def test_required_identifiers_cannot_be_blank(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert(editor_id="  ")

    def test_ledger_contains_no_credentials_or_contact_fields(self):
        cols = {r[1] for r in self.db.execute(
            "PRAGMA table_info(legacy_assignment_bridge_ledger)")}
        forbidden = {"password", "password_hash", "token", "session_token",
                     "email", "phone", "address", "kyc_document"}
        self.assertFalse(cols & forbidden)

    def test_migration_is_safe_to_reapply(self):
        self.db.executescript(self.sql)
        self.insert()
        self.assertEqual(self.db.execute(
            "SELECT COUNT(*) FROM legacy_assignment_bridge_ledger").fetchone()[0], 1)

    def test_no_external_or_legacy_tables_are_modified(self):
        tables = {r[0] for r in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertEqual(tables, {"legacy_assignment_bridge_ledger"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
