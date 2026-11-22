# Country Legal Review Migration 0033 — Read-only Preflight and Approval Gate

Status: **prepared, not applied remotely**  
Date: 2026-11-22

## Why this migration exists

The isolated Global API D1 (6a32dda3-b8c5-413c-9f51-58f0a9fa0712) has the countries, regional_admins, and permission/audit tables, but it does not currently have country_legal_reviews. The tracked Global API country-management bridge reads and writes that table. The regular staging D1 (470a81b8-3d36-4e2d-942c-5cbb2746a473) already has the table and its country/time index.

Migration 0033_country_legal_review_registry.sql is additive:
- Creates the table only if absent.
- Adds the country/time index only if absent.
- Adds insert validation requiring a valid reviewer and evidence for an approved review.
- Makes review history append-only with no-update and no-delete triggers.
- Does not insert country approvals, users, invitations, assignments, or permissions.

## Exact target identity

For the isolated Global API Worker, the currently observed binding is:

- Worker: csa-global-api-isolated-staging
- Binding: DB
- D1 name: csa-global-platform-isolated-staging
- D1 UUID: 6a32dda3-b8c5-413c-9f51-58f0a9fa0712

Do not infer the target from a database name alone. Re-read the Worker settings immediately before any remote operation and stop if the UUID differs.

## Read-only preflight

Run migrations/preflight_country_legal_review_0033.sql against the exact target D1. It contains only:
- PRAGMA table_info
- PRAGMA index_list
- SELECT against sqlite_master
- aggregate COUNT(*)

Do not select legal notes, evidence references, reviewer identifiers, or any personal data during preflight.

Expected isolated-D1 result before migration:
- country_legal_reviews table absent.
- idx_country_legal_reviews_country_created index absent.
- trg_country_legal_reviews_* triggers absent.

The preflight has not been executed remotely as part of this setup.

## Required approvals before applying

1. Confirm the exact isolated staging D1 UUID against the live Worker binding.
2. Confirm this is staging and not production.
3. Obtain explicit approval for a remote staging D1 schema write.
4. Take a restorable backup/export of the exact D1 and verify its artifact.
5. Apply only migration 0033 to that D1.
6. Re-run the read-only preflight and country legal review smoke tests.
7. Deploy the matching Global API Worker code only after the schema gate passes.
8. Verify health reports country schema ready and the Regional Admin bridge can read only assigned-country data.

No production database or Worker is in scope.

## Rollback and recovery

The migration is additive and should not require dropping the table. Do not use DROP TABLE or delete legal evidence as rollback. If the migration or verification fails, stop the bridge deployment and restore the pre-change backup to a separate recovery database for investigation. Do not overwrite the source database during recovery without a separately approved plan.

## Explicitly not authorised by this document

- Activating India or any other country.
- Approving a legal review or creating evidence references.
- Creating Regional Admin identities or invitations.
- Assigning countries or granting Regional Admin permissions.
- Changing D1 bindings, Worker secrets, host routes, or production resources.
- Migrating or copying legacy editor identities, orders, or assignments.
