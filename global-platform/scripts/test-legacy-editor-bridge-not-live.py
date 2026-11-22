#!/usr/bin/env python3
"""Fail-closed guard: proposed legacy editor bridge management routes stay offline.

This is a source-level regression guard only. It performs no network or D1 writes.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKER = ROOT / "global-platform/workers/source-snapshots/csa-global-api-isolated-staging/index.js"
API = ROOT / "api/src/index.js"
PROPOSAL = ROOT / "global-platform/docs/legacy-editor-bridge-api-contract-proposal.md"

PROPOSED_ROUTES = (
    "/v1/admin/legacy-editor-links/candidates",
    "/v1/admin/legacy-editor-links",
    "/v1/admin/legacy-editor-links/{global_editor_id}/activate",
    "/v1/admin/legacy-editor-links/{global_editor_id}/revoke",
    "/v1/admin/legacy-assignment-bridge/preview",
    "/v1/admin/legacy-assignment-bridge/transfers",
)

def main():
    worker = WORKER.read_text(encoding="utf-8")
    api = API.read_text(encoding="utf-8")
    proposal = PROPOSAL.read_text(encoding="utf-8")

    # The deployed isolated Worker snapshot is the runtime source of record.
    # Keep all proposed route literals out of both runtime implementations.
    for route in PROPOSED_ROUTES:
        if route in worker:
            raise SystemExit(f"FAIL: proposed route appears in isolated Worker: {route}")
        if route in api:
            raise SystemExit(f"FAIL: proposed route appears in Global API source: {route}")

    if "Contract proposal only — routes are not implemented or enabled." not in proposal:
        raise SystemExit("FAIL: proposal status must explicitly state routes are not enabled.")
    if "POST /internal/superadmin/legacy-bridge/readiness" not in worker:
        raise SystemExit("FAIL: expected readiness-only bridge endpoint is missing.")

    # Guard against accidental route-level permission grants before approval.
    permission_block = worker.split("function adminPermissionFor(req){", 1)
    if len(permission_block) != 2:
        raise SystemExit("FAIL: adminPermissionFor route map was not found.")
    permission_block = permission_block[1].split("\n}", 1)[0]
    for marker in ("legacy-editor-links", "legacy-assignment-bridge"):
        if marker in permission_block:
            raise SystemExit(f"FAIL: unapproved legacy bridge permission found: {marker}")

    print("PASS: proposed legacy editor mapping/transfer routes remain unregistered.")
    print("PASS: no legacy bridge admin permission has been granted.")
    print("PASS: staging readiness probe remains present; no remote writes performed.")

if __name__ == "__main__":
    main()
