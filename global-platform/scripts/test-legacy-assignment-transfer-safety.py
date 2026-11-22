#!/usr/bin/env python3
"""Model-level safety tests for the proposed assignment bridge.

Uses only in-memory Python objects. This does not call a Worker, API, or D1.
The live transfer endpoints are intentionally not implemented yet.
"""
from dataclasses import dataclass
from hashlib import sha256


@dataclass
class Transfer:
    assignment_id: str
    legacy_order_id: str
    idempotency_key: str
    payload_hash: str
    status: str = "pending"
    legacy_assignment_id: str | None = None
    error_code: str | None = None


class TransferLedger:
    def __init__(self):
        self.by_key = {}
        self.by_assignment = {}
        self.by_order = {}
        self.by_legacy_assignment = {}

    @staticmethod
    def digest(payload):
        return sha256(payload.encode("utf-8")).hexdigest()

    def begin(self, assignment_id, legacy_order_id, idempotency_key, payload):
        payload_hash = self.digest(payload)
        if idempotency_key in self.by_key:
            prior = self.by_key[idempotency_key]
            if prior.payload_hash != payload_hash:
                raise ValueError("idempotency_key_payload_conflict")
            return prior, False
        if assignment_id in self.by_assignment:
            raise ValueError("global_assignment_already_transferred")
        if legacy_order_id in self.by_order:
            raise ValueError("legacy_order_already_transferred")
        item = Transfer(assignment_id, legacy_order_id, idempotency_key, payload_hash)
        self.by_key[idempotency_key] = item
        self.by_assignment[assignment_id] = item
        self.by_order[legacy_order_id] = item
        return item, True

    def record_result(self, item, outcome, legacy_assignment_id=None):
        if item.status != "pending":
            raise ValueError("transfer_not_pending_reconcile_first")
        if outcome == "created":
            if not legacy_assignment_id:
                raise ValueError("created_requires_legacy_assignment_id")
            if legacy_assignment_id in self.by_legacy_assignment:
                raise ValueError("legacy_assignment_already_linked")
            item.status = "created"
            item.legacy_assignment_id = legacy_assignment_id
            self.by_legacy_assignment[legacy_assignment_id] = item
        elif outcome == "failed":
            item.status = "failed"
            item.error_code = "definite_remote_failure"
        elif outcome == "unknown":
            # Timeout/connection loss: remote side may have committed.
            # Do not call the create operation again automatically.
            item.status = "reconciliation_required"
            item.error_code = "remote_outcome_unknown"
        else:
            raise ValueError("unsupported_outcome")

    def reconcile(self, item, remote_assignment_id):
        if item.status != "reconciliation_required":
            raise ValueError("reconciliation_not_required")
        if remote_assignment_id:
            if remote_assignment_id in self.by_legacy_assignment:
                raise ValueError("legacy_assignment_already_linked")
            item.status = "created"
            item.legacy_assignment_id = remote_assignment_id
            item.error_code = None
            self.by_legacy_assignment[remote_assignment_id] = item
        else:
            # An operator must explicitly confirm absence before retry is allowed.
            item.status = "failed"
            item.error_code = "reconciled_remote_absent"


def expect_error(label, code, fn):
    try:
        fn()
    except ValueError as exc:
        assert str(exc) == code, (label, str(exc))
        print("PASS:", label)
    else:
        raise AssertionError("Expected " + code + ": " + label)


def main():
    ledger = TransferLedger()
    payload = "assignment=as-1;order=ord-1;editor=legacy-editor-1"

    item, created = ledger.begin("as-1", "ord-1", "idem-1", payload)
    assert created and item.status == "pending"
    replay, created = ledger.begin("as-1", "ord-1", "idem-1", payload)
    assert not created and replay is item
    print("PASS: same idempotency key and payload reuses the existing transfer")

    expect_error(
        "same idempotency key with changed payload is rejected",
        "idempotency_key_payload_conflict",
        lambda: ledger.begin("as-1", "ord-1", "idem-1", payload + ";editor=other"),
    )
    expect_error(
        "duplicate Global assignment is rejected",
        "global_assignment_already_transferred",
        lambda: ledger.begin("as-1", "ord-2", "idem-2", "different"),
    )
    expect_error(
        "duplicate legacy order is rejected",
        "legacy_order_already_transferred",
        lambda: ledger.begin("as-2", "ord-1", "idem-3", "different"),
    )

    ledger.record_result(item, "created", "legacy-as-1")
    assert item.status == "created"
    replay, created = ledger.begin("as-1", "ord-1", "idem-1", payload)
    assert not created and replay.legacy_assignment_id == "legacy-as-1"
    expect_error(
        "created transfer cannot be blindly submitted again",
        "transfer_not_pending_reconcile_first",
        lambda: ledger.record_result(item, "created", "legacy-as-2"),
    )
    print("PASS: confirmed remote creation is stable across request replay")

    uncertain, _ = ledger.begin("as-2", "ord-2", "idem-4", "payload-2")
    ledger.record_result(uncertain, "unknown")
    assert uncertain.status == "reconciliation_required"
    expect_error(
        "unknown remote outcome cannot be automatically retried",
        "transfer_not_pending_reconcile_first",
        lambda: ledger.record_result(uncertain, "created", "legacy-as-2"),
    )
    ledger.reconcile(uncertain, "legacy-as-2")
    assert uncertain.status == "created" and uncertain.legacy_assignment_id == "legacy-as-2"
    print("PASS: uncertain outcome is reconciled before completion; no duplicate create")

    failed, _ = ledger.begin("as-3", "ord-3", "idem-5", "payload-3")
    ledger.record_result(failed, "failed")
    assert failed.status == "failed" and failed.error_code == "definite_remote_failure"
    print("PASS: definite remote failure is recorded distinctly from timeout")

    dup, _ = ledger.begin("as-4", "ord-4", "idem-6", "payload-4")
    expect_error(
        "legacy assignment ID cannot be linked twice",
        "legacy_assignment_already_linked",
        lambda: ledger.record_result(dup, "created", "legacy-as-1"),
    )

    print("Assignment transfer safety model tests passed (in-memory only).")


if __name__ == "__main__":
    main()
