#!/usr/bin/env python3
"""Static guard: the legacy assignment preflight must remain read-only."""
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
PREFLIGHT = ROOT / "workers/source-snapshots/csa-editor-portal-isolated-staging/migrations/0001_legacy_assignment_bridge_ledger_preflight.sql"
ALLOWED_PRAGMAS = {"table_info", "index_list"}
FORBIDDEN = {
    "INSERT", "UPDATE", "DELETE", "REPLACE", "CREATE", "DROP", "ALTER",
    "ATTACH", "DETACH", "VACUUM", "REINDEX", "ANALYZE", "BEGIN", "COMMIT",
    "ROLLBACK", "SAVEPOINT", "RELEASE",
}


def strip_comments(sql):
    return re.sub(r"(?m)--.*$", "", sql)


def inspection_pragma(statement):
    return re.match(r"(?is)^PRAGMA[ ]+([A-Za-z_]+)[ ]*[(][ ]*[A-Za-z_]+[ ]*[)]$", statement)


class ReadOnlyPreflightTests(unittest.TestCase):
    def test_preflight_contains_only_select_and_inspection_pragmas(self):
        source = strip_comments(PREFLIGHT.read_text(encoding="utf-8"))
        statements = [part.strip() for part in source.split(";") if part.strip()]
        self.assertGreater(len(statements), 0, "preflight must not be empty")
        for statement in statements:
            first = re.match(r"([A-Za-z]+)", statement)
            self.assertIsNotNone(first, statement)
            command = first.group(1).upper()
            if command == "SELECT":
                pass
            elif command == "PRAGMA":
                match = inspection_pragma(statement)
                self.assertIsNotNone(match, f"unsupported or mutating PRAGMA: {statement}")
                self.assertIn(match.group(1).lower(), ALLOWED_PRAGMAS)
            else:
                self.fail(f"non-read-only SQL command: {command}")
            tokens = {token.upper() for token in re.findall(r"[A-Za-z_]+", statement)}
            self.assertFalse(tokens & FORBIDDEN, f"write/transaction keyword found: {tokens & FORBIDDEN}")

    def test_guard_rejects_write_commands(self):
        for sql in ("INSERT INTO t VALUES (1)", "UPDATE t SET x=1", "DELETE FROM t",
                    "CREATE TABLE t(x)", "DROP TABLE t", "PRAGMA user_version=1"):
            statement = strip_comments(sql).strip()
            command = re.match(r"([A-Za-z]+)", statement).group(1).upper()
            self.assertNotIn(command, {"SELECT", "PRAGMA"} if command != "PRAGMA" else {"SELECT"})
            if command == "PRAGMA":
                self.assertIsNone(inspection_pragma(statement))


if __name__ == "__main__":
    unittest.main()
