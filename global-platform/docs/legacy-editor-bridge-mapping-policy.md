# Legacy Editor Identity Bridge — Mapping and Safety Policy

Status: **Design-only / staging preparation**  
Applies to: CSA Global Editor profiles and the legacy Editor Portal  
Activation: **Blocked until the canonical legacy database is explicitly confirmed and the bridge contract is reviewed.**

## 1. Identity mapping

- Link a Global editor only by an explicitly reviewed pair: `editor_profiles.user_id` and the legacy `video_editors.id`.
- Never auto-link by email, display name, phone number, username, or other fuzzy matching.
- Require both records to exist. Require the Global profile to be verified and active, and the legacy editor record to be active.
- Enforce one-to-one mapping in both directions. A Global editor may have at most one legacy identity; a legacy identity may belong to at most one Global editor.
- Store mapping status, method, creator, reviewer, timestamps, and a concise review note. Never copy passwords, password hashes, session tokens, OTPs, or recovery secrets.

## 2. Approval and audit

- Mapping creation, activation, revocation, and reassignment must be authenticated and authorized server-side.
- Record the acting admin, target IDs, previous and new state, reason, timestamp, and outcome in an append-only audit trail.
- Do not allow an identity to be silently reassigned. Reassignment requires revoking the old link and a separately reviewed new link.
- If the deployment requires two-person review, the creator and reviewer must be different users. This is a policy switch to confirm before implementation, not an assumed current requirement.

## 3. Status synchronization and revocation

- A Global editor who is suspended, disabled, unverified, or whose mapping is revoked must not receive new legacy assignments through the bridge.
- On revocation, invalidate applicable legacy editor sessions using the legacy portal's supported session-revocation mechanism.
- Preserve historical orders, assignments, submissions, and audit records. Revocation must not delete historical work.
- If the legacy portal cannot confirm session revocation, fail closed for new bridge operations and create an auditable incident.

## 4. Assignment transfer invariants

- Transfer only an explicitly identified Global assignment to an explicitly identified legacy order and legacy assignment.
- Enforce uniqueness for Global assignment ID, legacy order ID, legacy assignment ID, and idempotency key.
- Repeating the same idempotency key with the same canonical request must return the recorded result without creating another assignment.
- Reusing an idempotency key with a different request must be rejected.
- Check editor mapping and both editor statuses again at transfer time; do not rely on an earlier UI check.
- On partial failure, persist a stable failure state and correlation ID. Do not create a second legacy assignment as an automatic retry.
- Never overwrite or reassign an existing legacy order/assignment silently.

## 5. Request security

- Keep the bridge staging-only until a separate production-readiness review is approved.
- Require signed requests with timestamp, nonce, method, path, and body hash; enforce a short clock-skew window and one-time nonce use.
- Compare signatures in constant time. Reject missing secrets, missing nonce storage, replayed nonces, malformed signatures, and unexpected hosts.
- Keep secrets in Worker secret bindings only. Never log secret values or authentication headers.
- Apply strict request-size limits, rate limits, and least-privilege route authorization.

## 6. Required tests before activation

1. Valid reviewed mapping succeeds.
2. Unknown Global ID or legacy ID is rejected.
3. Unverified, inactive, suspended, or disabled editor is rejected.
4. Duplicate Global-to-legacy and legacy-to-Global mappings are rejected.
5. Email/name-only matching never creates a link.
6. Unauthorized actor and invalid review state are rejected.
7. Revoked mapping blocks new assignments and triggers session invalidation.
8. Historical records remain unchanged after revocation.
9. Assignment transfer is idempotent for an identical request.
10. Conflicting idempotency key, duplicate order, or duplicate assignment is rejected.
11. Partial failure is auditable and cannot create duplicate work on retry.
12. Signature tampering, expired timestamp, nonce replay, missing secret, and nonce-store failure all fail closed.
13. All tests run against disposable local test databases; no production or live staging customer/editor data is used.

## 7. Activation blockers

Do not change Worker database bindings, copy records, or activate identity/order routes until all of the following are confirmed:

- The canonical legacy Editor Portal database is explicitly selected by the owner.
- The isolated staging Worker and D1 bindings are re-read and verified against that selection.
- A backup/export and rollback plan are prepared before any remote schema or data write.
- The bridge API contract and session-revocation behavior are reviewed against the actual legacy schema.
- Disposable tests pass, followed by staging-only smoke tests with approved test accounts.
- Production activation receives a separate explicit approval.

## 8. Current decision required

The canonical database is not yet confirmed. The candidate `csa-video-isolated-staging` must not be assumed to be authoritative merely because it is bound to the isolated Editor Portal Worker. Keep the existing Global API `LEGACY_VIDEO_DB` binding unchanged until the owner explicitly confirms the intended database and approves the binding change.

This document records safety requirements only. It does not authorize database changes, data migration, account linking, assignment transfer, or production deployment.
