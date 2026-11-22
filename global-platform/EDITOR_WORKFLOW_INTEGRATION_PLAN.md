# CSA Editor Workflow Integration Contract (Staging)

Status: design/implementation gate  
Scope: staging only; this document does not change Worker code, bindings, routes, D1 data, R2 objects, or production.

## 1. Verified current architecture

### Global Editor Network (canonical onboarding and showcase)
The Global API source snapshot is `global-platform/workers/source-snapshots/csa-global-api-isolated-staging/index.js`; its application source is `global-platform/api/src/index.js`.

The Global workflow uses:
- `users`, `editor_profiles`, `editor_credentials`, and `editor_sessions` for editor identity and account state.
- `editor_kyc_documents` with private R2 object storage for KYC.
- `editor_portfolio_videos` for editor work samples.
- Global `projects`, offers, assignments, submissions, and payment tables for the marketplace workflow.

The source contains editor onboarding, KYC upload/review, editor credential issuance, and portfolio review endpoints. The client showcase query and stream endpoint enforce all of:
- editor account is active;
- editor profile verification status is `verified`;
- sample review status is `approved`;
- sample `client_visible=1`;
- at least one KYC document for that editor has status `verified`.

The Global API test suite already contains source-level assertions for this approved-only showcase rule and for editor-admin route permissions. Relevant tests:
- `global-platform/api/tests/portal-workflows.test.mjs`
- `global-platform/api/tests/rbac-route-map.test.mjs`

### Isolated legacy Editor Portal
The isolated Editor Portal snapshot is `global-platform/workers/source-snapshots/csa-editor-portal-isolated-staging/worker.js`.

It uses a separate legacy identity/work queue:
- `video_editors` and `video_editor_sessions`;
- `video_editing_orders`, `video_editing_assignments`, `video_editing_files`, and status/audit history;
- `CSA_VIDEO_DB` for editor/order data;
- `CSA_SUPERADMIN_DB` for the shared Super Admin session check.

Its Super Admin page currently creates legacy editor accounts and assigns legacy video orders. It does not directly call the Global API's KYC or portfolio review endpoints.

## 2. Integration decision

The Global Editor Network is the canonical source for editor registration, identity, KYC, profile verification, credentials, and client-facing portfolio visibility.

The legacy Editor Portal remains a separate legacy-order execution surface until a reviewed adapter is implemented. Do not silently treat a legacy `video_editors.id` as a Global `users.id`, or a legacy `video_editing_orders.id/order_code` as a Global `projects.id/project_code`.

No automatic cross-database joins are possible in the current Worker code. Any integration must use an explicit server-side bridge and stable mapping records.

## 3. Required adapter design before implementation

1. **Stable editor mapping:** create an explicit mapping between Global `users.id` and legacy `video_editors.id`; never match solely on display name or email.
2. **Verified-only provisioning:** only Global editors with active account status, verified profile, and verified KYC may be provisioned into the legacy work queue. A KYC rejection, account suspension, or revoked verification must block new assignments and disable legacy access through a defined revocation path.
3. **Credential ownership:** Global editor credentials remain canonical. Do not copy password hashes or raw credentials between databases. Use a signed, short-lived, audience-restricted server-side exchange or a deliberate single-login design.
4. **Order mapping:** map a Global project/offer/assignment to a legacy video order through an immutable mapping ID and idempotency key. Preserve both systems' audit trails and status history.
5. **Assignment guard:** only active, verified, KYC-cleared editors can receive new assignments. Reassignment must close/revoke the previous active assignment before creating the new one.
6. **Media separation:** KYC documents remain private and must never enter the portfolio/showcase bucket or editor/client downloads. Portfolio samples are client-visible only after explicit CSA approval.
7. **Failure handling:** bridge retries must be idempotent; partial failures must be observable and safely retryable without duplicate editor accounts, orders, payments, or assignments.
8. **Rollback:** feature-flag the adapter in staging; rollback must stop new bridge writes without deleting either system's records.

## 4. Staging acceptance tests

- A pending or rejected KYC editor cannot be provisioned to the legacy editor work queue.
- A verified editor with a pending/rejected portfolio sample does not appear in the client showcase.
- An approved sample appears only when the editor account is active, profile is verified, and KYC is verified.
- A suspended editor cannot log in or receive a new assignment.
- One Global project creates at most one mapped legacy order under retry.
- One active assignment exists per mapped order; reassignment preserves history and revokes the prior assignment.
- KYC object URLs are never returned by client showcase endpoints.
- Client users cannot access admin KYC review/preview endpoints.
- Editor Admin can review KYC and portfolio samples but cannot issue finance refunds or perform project-admin writes.
- All bridge failures are logged without tokens, cookies, identity-document data, or payment secrets.

## 5. Deployment gate

Do not deploy an adapter or migrate records until:
- the canonical editor identity and order mapping are agreed;
- migration/backfill is rehearsed on disposable staging data;
- the adapter tests above pass;
- the existing Global API and legacy Editor Portal tests pass;
- staging-only bindings and environment guards are verified;
- production routes, databases, and Worker scripts remain unchanged.

## 6. Current blocker

The Global KYC/showcase workflow already exists and has source-level regression tests. The remaining gap is the cross-system identity and order adapter between Global `users/projects` and legacy `video_editors/video_editing_orders`. This is a real integration task, not a missing KYC-table task.


## 7. Staging-only bridge schema preparation (2026-11-22)

A new additive migration has been authored at `global-platform/migrations/0026_legacy_editor_identity_bridge.sql`.

It defines:
- `legacy_editor_identity_links`: explicit Global editor user ID ↔ legacy editor ID mapping, with pending/active/revoked review states and unique one-to-one constraints.
- `legacy_assignment_links`: Global assignment ↔ legacy order/assignment mapping, with unique idempotency key and pending/created/failed/revoked bridge states.

A source-level regression test is at `global-platform/api/tests/legacy-editor-bridge-schema.test.mjs`. CI is configured to require the migration file.

Important: this is schema preparation only. The migration has **not** been applied to any remote D1 database. No legacy editor accounts, credentials, orders, or assignments were copied. The runtime adapter endpoints and end-to-end bridge are not implemented yet.


### 7.1. Migration execution test added

The migration is now exercised against a disposable in-memory SQLite database by `global-platform/scripts/test-legacy-editor-bridge-migration.py`. The test checks actual SQL execution, foreign-key compatibility, unique editor/order mappings, reviewer requirements for activation, and the created-assignment invariant. The staging validation workflow runs this test. It performs no remote D1 writes.
