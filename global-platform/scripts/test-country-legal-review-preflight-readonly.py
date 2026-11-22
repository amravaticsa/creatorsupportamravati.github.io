#!/usr/bin/env python3
"""Static safety guard: country legal review preflight must remain read-only."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / "migrations" / "preflight_country_legal_review_0033.sql").read_text(encoding="utf-8")
statements = [part.strip() for part in SQL.split(";") if part.strip() and not part.strip().startswith("--")]
assert statements, "preflight must contain statements"
for statement in statements:
    upper = statement.upper()
    assert upper.startswith(("PRAGMA ", "SELECT ")), f"non-read-only statement: {statement}"
    assert not re.search(r"\b(INSERT|UPDATE|DELETE|REPLACE|DROP|ALTER|CREATE|BEGIN|COMMIT|ROLLBACK|VACUUM|ATTACH|DETACH)\b", upper), statement
assert "PRAGMA table_info(country_legal_reviews)" in SQL
assert "PRAGMA index_list(country_legal_reviews)" in SQL
assert "COUNT(*) AS country_legal_review_rows" in SQL
print("PASS: country legal review preflight contains only approved read-only PRAGMA and SELECT statements.")
