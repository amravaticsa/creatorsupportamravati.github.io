#!/usr/bin/env python3
"""Disposable SQLite contract tests for the proposed legacy assignment bridge.

No Worker, network, Cloudflare account, or remote D1 is contacted.
"""
import hashlib
import json
import sqlite3
import threading
import unittest


def canonical_hash(correlation_id, idempotency_key, order_id, order_code, editor_id):
    fields = [
        "CSA-LEGACY-ASSIGNMENT-V1",
        correlation_id,
        idempotency_key,
        order_id,
        order_code,
        editor_id,
    ]
    return hashlib.sha256("\n".join(fields).encode("utf-8")).hexdigest()


SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_code TEXT NOT NULL UNIQUE,
  is_draft INTEGER NOT NULL DEFAULT 0,
  order_status TEXT NOT NULL
);
CREATE TABLE editors (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL
);
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  editor_id TEXT NOT NULL REFERENCES editors(id),
  status TEXT NOT NULL
);
CREATE TABLE bridge_ledger (
  id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  order_id TEXT NOT NULL,
  order_code TEXT NOT NULL,
  editor_id TEXT NOT NULL,
  result_state TEXT NOT NULL CHECK(result_state IN ('created','definite_failure')),
  assignment_id TEXT UNIQUE REFERENCES assignments(id)
);
"""


class LegacyBridgeContractTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.db.execute("INSERT INTO orders VALUES ('o-1','CSA-001',0,'Files received')")
        self.db.execute("INSERT INTO orders VALUES ('o-draft','CSA-DRAFT',1,'Files received')")
        self.db.execute("INSERT INTO orders VALUES ('o-closed','CSA-CLOSED',0,'Final delivery')")
        self.db.execute("INSERT INTO editors VALUES ('e-1','active')")
        self.db.execute("INSERT INTO editors VALUES ('e-disabled','disabled')")
        self.db.commit()
        self.lock = threading.Lock()

    def tearDown(self):
        self.db.close()

    def create(self, conn, correlation, key, order_id, order_code, editor_id, fail_ledger=False):
        digest = canonical_hash(correlation, key, order_id, order_code, editor_id)
        prior = conn.execute(
            "SELECT * FROM bridge_ledger WHERE idempotency_key=?", (key,)
        ).fetchone()
        if prior:
            if prior["request_hash"] != digest:
                raise ValueError("idempotency_conflict")
            return prior["assignment_id"], True

        prior_corr = conn.execute(
            "SELECT * FROM bridge_ledger WHERE correlation_id=?", (correlation,)
        ).fetchone()
        if prior_corr:
            if prior_corr["request_hash"] != digest:
                raise ValueError("correlation_conflict")
            return prior_corr["assignment_id"], True

        order = conn.execute(
            "SELECT * FROM orders WHERE id=? AND order_code=?", (order_id, order_code)
        ).fetchone()
        if not order:
            raise ValueError("order_not_found_or_id_code_mismatch")
        if order["is_draft"] or order["order_status"] not in ("Files received", "Work assigned"):
            raise ValueError("order_not_eligible")
        editor = conn.execute("SELECT * FROM editors WHERE id=?", (editor_id,)).fetchone()
        if not editor or editor["status"] != "active":
            raise ValueError("editor_not_active")
        existing = conn.execute(
            "SELECT id,editor_id FROM assignments WHERE order_id=? AND status='active'",
            (order_id,),
        ).fetchone()
        if existing:
            raise ValueError("assignment_already_exists")

        assignment_id = "la-" + key
        try:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute(
                "INSERT INTO assignments(id,order_id,editor_id,status) VALUES(?,?,?,'active')",
                (assignment_id, order_id, editor_id),
            )
            if fail_ledger:
                raise RuntimeError("injected_ledger_write_failure")
            conn.execute(
                """INSERT INTO bridge_ledger
                   (id,correlation_id,idempotency_key,request_hash,order_id,order_code,
                    editor_id,result_state,assignment_id)
                   VALUES(?,?,?,?,?,?,?,'created',?)""",
                ("ledger-" + key, correlation, key, digest, order_id, order_code, editor_id, assignment_id),
            )
            conn.commit()
            return assignment_id, False
        except Exception:
            conn.rollback()
            raise

    def test_same_key_same_payload_replays_stable_id(self):
        a, replay1 = self.create(self.db, "c1", "k1", "o-1", "CSA-001", "e-1")
        b, replay2 = self.create(self.db, "c1", "k1", "o-1", "CSA-001", "e-1")
        self.assertFalse(replay1)
        self.assertTrue(replay2)
        self.assertEqual(a, b)
        self.assertEqual(1, self.db.execute("SELECT COUNT(*) FROM assignments").fetchone()[0])

    def test_same_key_changed_payload_rejected(self):
        self.create(self.db, "c1", "k1", "o-1", "CSA-001", "e-1")
        with self.assertRaisesRegex(ValueError, "idempotency_conflict"):
            self.create(self.db, "c1", "k1", "o-1", "CSA-001", "e-2")

    def test_correlation_changed_payload_rejected(self):
        self.create(self.db, "c1", "k1", "o-1", "CSA-001", "e-1")
        with self.assertRaisesRegex(ValueError, "correlation_conflict"):
            self.create(self.db, "c1", "k2", "o-1", "CSA-001", "e-1")

    def test_exact_order_id_and_code_required(self):
        with self.assertRaisesRegex(ValueError, "order_not_found"):
            self.create(self.db, "c1", "k1", "o-1", "WRONG-CODE", "e-1")

    def test_draft_and_ineligible_orders_rejected(self):
        with self.assertRaisesRegex(ValueError, "order_not_eligible"):
            self.create(self.db, "c1", "k1", "o-draft", "CSA-DRAFT", "e-1")
        with self.assertRaisesRegex(ValueError, "order_not_eligible"):
            self.create(self.db, "c2", "k2", "o-closed", "CSA-CLOSED", "e-1")

    def test_inactive_editor_rejected(self):
        with self.assertRaisesRegex(ValueError, "editor_not_active"):
            self.create(self.db, "c1", "k1", "o-1", "CSA-001", "e-disabled")

    def test_existing_assignment_is_never_overwritten(self):
        self.db.execute("INSERT INTO assignments VALUES ('old-a','o-1','e-1','active')")
        self.db.commit()
        with self.assertRaisesRegex(ValueError, "assignment_already_exists"):
            self.create(self.db, "c1", "k1", "o-1", "CSA-001", "e-1")
        row = self.db.execute("SELECT id FROM assignments WHERE order_id='o-1'").fetchone()
        self.assertEqual("old-a", row["id"])

    def test_assignment_and_ledger_are_atomic(self):
        with self.assertRaisesRegex(RuntimeError, "injected_ledger_write_failure"):
            self.create(self.db, "c1", "k1", "o-1", "CSA-001", "e-1", fail_ledger=True)
        self.assertEqual(0, self.db.execute("SELECT COUNT(*) FROM assignments").fetchone()[0])
        self.assertEqual(0, self.db.execute("SELECT COUNT(*) FROM bridge_ledger").fetchone()[0])

    def test_unique_order_prevents_second_assignment_key(self):
        self.create(self.db, "c1", "k1", "o-1", "CSA-001", "e-1")
        with self.assertRaisesRegex(ValueError, "assignment_already_exists"):
            self.create(self.db, "c2", "k2", "o-1", "CSA-001", "e-1")

    def test_concurrent_same_key_converges_to_one_assignment(self):
        # Serialize the in-memory SQLite connection to model concurrent callers
        # contending on a durable unique-key ledger.
        results, errors = [], []
        def run():
            try:
                with self.lock:
                    results.append(self.create(self.db, "c1", "k1", "o-1", "CSA-001", "e-1"))
            except Exception as exc:
                errors.append(exc)
        threads = [threading.Thread(target=run) for _ in range(8)]
        for t in threads: t.start()
        for t in threads: t.join()
        self.assertFalse(errors, errors)
        self.assertEqual(1, len({r[0] for r in results}))
        self.assertEqual(1, self.db.execute("SELECT COUNT(*) FROM assignments").fetchone()[0])
        self.assertEqual(1, self.db.execute("SELECT COUNT(*) FROM bridge_ledger").fetchone()[0])

    def test_hash_is_stable_and_sha256(self):
        a = canonical_hash("c1", "k1", "o-1", "CSA-001", "e-1")
        b = canonical_hash("c1", "k1", "o-1", "CSA-001", "e-1")
        self.assertEqual(a, b)
        self.assertEqual(64, len(a))
        self.assertTrue(all(ch in "0123456789abcdef" for ch in a))


if __name__ == "__main__":
    unittest.main(verbosity=2)
