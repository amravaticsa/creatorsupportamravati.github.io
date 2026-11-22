#!/usr/bin/env python3
"""Static safety check for the legacy Editor Portal D1 audit template."""
from pathlib import Path
import sys

path = Path("global-platform/docs/legacy-editor-d1-schema-audit-template.md")
if not path.is_file():
    sys.exit("FAIL: audit template is missing")
content = path.read_text(encoding="utf-8")
required = {
    "canonical D1 identity": "Canonical D1 database UUID:",
    "worker binding identity": "Observed binding UUID:",
    "explicit owner confirmation": "Owner explicitly confirmed the canonical isolated staging D1.",
    "binding UUID match": "Worker binding UUID exactly matches the confirmed D1 UUID.",
    "production exclusion": "Production database excluded.",
    "read-only preflight": "Preflight SQL reviewed as read-only.",
    "schema-only privacy boundary": "Record schema metadata only.",
    "aggregate-only counts": "Aggregate counts only",
    "compatibility decision": "Compatibility decision",
    "restorable backup": "Backup/export reference (must be restorable):",
    "restore test evidence": "Restore test reference:",
    "separate staging write approval": "Staging write approval reference (separate, explicit approval required):",
    "no migration without approval": "Do not apply the ledger migration.",
    "no bridge activation without approval": "Do not register or activate bridge endpoints.",
    "no binding or secret changes": "Do not change D1 bindings or secrets.",
    "no production data access": "Do not access or modify production data.",
}
missing = [label for label, marker in required.items() if marker not in content]
if missing:
    for label in missing:
        print(f"FAIL: missing audit-template control: {label}")
    sys.exit(1)
if "Status:** Not executed." not in content:
    sys.exit("FAIL: template must clearly state that the audit has not been executed")
if "A completed template does not itself authorize any write" not in content:
    sys.exit("FAIL: explicit non-authorization statement is missing")
print(f"PASS: audit template contains all {len(required)} required controls")
print("PASS: template is explicitly marked not executed and grants no write authorization")
print("NOTE: static documentation check only; no remote D1 was queried or modified")
