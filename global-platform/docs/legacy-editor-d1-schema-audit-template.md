# Legacy Editor D1 — Schema Audit Record

**Status:** Not executed. This template is not evidence of a remote database inspection.

## Change identity

- Audit date/time (UTC):
- Operator:
- Confirmed environment: isolated staging only
- Canonical D1 database name:
- Canonical D1 database UUID:
- Editor Portal Worker name:
- Worker binding name:
- Observed binding UUID:
- Owner confirmation reference:

## Preflight gate

- [ ] Owner explicitly confirmed the canonical isolated staging D1.
- [ ] Worker binding UUID exactly matches the confirmed D1 UUID.
- [ ] Production database excluded.
- [ ] Preflight SQL reviewed as read-only.
- [ ] Read-only query execution captured with command/target evidence.

## Schema observations

Record schema metadata only. Do not paste editor/customer rows, emails, phone numbers, tokens, credentials, or other personal data.

| Table | Exists | Primary key column/type | Relevant FK columns | Notes |
|---|---|---|---|---|
| video_editors | | | | |
| video_editing_orders | | | | |
| video_editing_assignments | | | | |
| legacy_assignment_bridge_ledger | | | | |

## Indexes, uniqueness and triggers

- video_editors:
- video_editing_orders:
- video_editing_assignments:
- Existing ledger:
- Relevant triggers and lifecycle rules:

## Aggregate counts only

| Table | Row count |
|---|---:|
| video_editors | |
| video_editing_orders | |
| video_editing_assignments | |
| legacy_assignment_bridge_ledger | |

## Compatibility decision

- [ ] Proposed ledger schema matches observed key types and constraints.
- [ ] No conflicting uniqueness rule was found.
- [ ] Existing assignment lifecycle is understood.
- [ ] Any required proposal changes are documented.

Decision: **HOLD / READY FOR BACKUP REVIEW**

Reason:

## Backup and next approval

- Backup/export reference (must be restorable):
- Restore test reference:
- Staging write approval reference (separate, explicit approval required):
- Reviewer:
- Review date:

## Prohibited until separately approved

- Do not apply the ledger migration.
- Do not register or activate bridge endpoints.
- Do not change D1 bindings or secrets.
- Do not migrate identities or assignments.
- Do not access or modify production data.

A completed template does not itself authorize any write, deployment to production, or data transfer.
