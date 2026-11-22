# CSA Editor Workflow Bridge Readiness Audit (Staging)

Date: 2026-11-22  
Scope: read-only audit of isolated staging Worker source and D1 schemas. No Worker code, bindings, database rows, R2 objects, routes, or production resources were changed by this audit.

## Verified findings

### 1. Canonical and legacy data stores are distinct

- Global API canonical editor identity is stored in the Global API D1: `users`, `editor_profiles`, `editor_credentials`, and `editor_kyc_documents`.
- Legacy Editor Portal identity and editing queue are stored in its `CSA_VIDEO_DB`: `video_editors`, `video_editor_sessions`, `video_editing_orders`, `video_editing_assignments`, `video_editing_files`, and audit/history tables.
- The legacy Editor Portal's configured D1 contains the expected legacy video editing tables.
- The Global API source uses `env.LEGACY_VIDEO_DB` in `POST /v1/client/legacy-video-orders/claim` to read legacy orders, files, and status history.

### 2. Global API legacy D1 binding is currently unresolved

The isolated Global API Worker setting previously read for `LEGACY_VIDEO_DB` points to a D1 database ID that currently returns Cloudflare D1 404 (“database could not be found”) on a read-only schema inspection.

The actual legacy Editor Portal D1 is a different database and contains the expected legacy tables. It is not safe to silently repoint the Global API binding: doing so would activate the client-facing legacy-order claim path, which reads customer/order data and writes imported project records and file metadata into the Global API database.

**Decision required before activation:** confirm that the isolated Global API staging environment is intended to read the same isolated legacy Editor Portal D1, and approve enabling the legacy order claim/import workflow on staging.

### 3. The bridge migration is not applied remotely

The Global API D1 currently contains the canonical editor and assignment tables, but the read-only schema inspection did not find `legacy_editor_identity_links` or `legacy_assignment_links`. Migration `0026_legacy_editor_identity_bridge.sql` remains source-controlled and CI-tested only.

The legacy Editor Portal D1 has no bridge replay-nonce table yet. A signed endpoint must not be enabled until its nonce/replay storage, key provisioning, request contract, and idempotency behavior are implemented and tested.

### 4. Identity and credential boundary

- Global editor password credentials must remain in Global API D1.
- Legacy editor password credentials must not be copied or synchronized.
- A stable, reviewed mapping must connect Global `users.id` to legacy `video_editors.id`.
- Only active editors with verified profile and verified KYC may be eligible for legacy provisioning.
- Revocation/suspension must block future assignment and revoke legacy sessions.
- Never match identities by email, display name, or username alone.

## Safe next implementation sequence

1. Obtain approval to repoint the isolated Global API `LEGACY_VIDEO_DB` binding to the confirmed isolated legacy Editor Portal D1, or leave legacy-order claim disabled.
2. Apply migration 0026 only to the isolated Global API staging D1 after the binding/DB ownership decision.
3. Add a dedicated internal bridge endpoint to the legacy Editor Portal with HMAC timestamp, nonce, body digest, constant-time signature validation, short replay window, strict staging guard, and idempotency.
4. Provision a separate staging-only bridge secret directly in Cloudflare Worker secrets for both peers. Never expose it to browser code or logs.
5. Add admin-reviewed mapping/provisioning and revocation flows; do not transfer credentials.
6. Add disposable-database integration tests and end-to-end staging tests before any runtime deployment.

## Non-changes

This audit did not:
- change Worker bindings or deploy Workers;
- apply migration 0026 to remote D1;
- create or update editor accounts, orders, assignments, or credentials;
- copy client files or KYC documents;
- change DNS, Access, or production resources.
