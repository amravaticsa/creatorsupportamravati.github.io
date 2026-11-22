# Global Admin Authorization Sync Integration

## Current Staging topology

- Super Admin account/session source: `csa-superadmin-isolated-staging`, D1 `c2bb3fb5-db22-4ed5-9283-161df57ebac2`.
- Super Admin `GLOBAL_DB`: canonical Global D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473` (`csa-global-platform-staging`).
- Isolated Global API: `csa-global-api-isolated-staging`, bound to the same D1 `6a32dda3-b8c5-413c-9f51-58f0a9fa0712`.
- Admin authorization sync, Pricing, Refund dashboard, Editor sessions and the Regional Admin data proxy target canonical `csa-global-api-staging` D1 470 with the dedicated HMAC secret. Legacy Links alone targets `csa-global-api-isolated-staging` D1 6a32 with the legacy HMAC secret.
- The Admin invitation/dashboard URL is `https://admin-isolated-staging.creatorsupportamravati.in`; its custom domain is active on the isolated Super Admin Worker and the host guard allows non-Super-Admin roles there.
- The main Client/Editor Staging API remains `csa-global-api-staging`, bound to canonical D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473`. It is intentionally separate from the isolated Super Admin environment; no live D1 replication is configured.

## HMAC configuration

- A random 256-bit `GLOBAL_API_SYNC_HMAC_SECRET` is configured on the isolated Super Admin sender and canonical Global API receiver. Its value is not stored in source control, documentation or chat.
- The Super Admin sender prefers `GLOBAL_API_SYNC_HMAC_SECRET` and retains `ADMIN_SYNC_HMAC_SECRET` fallback.
- The canonical `csa-global-api-staging` receiver accepts the dedicated secret and retains the legacy fallback. The isolated compatibility API is reserved for Legacy Links and retains its separate legacy HMAC binding.
- The legacy `ADMIN_SYNC_HMAC_SECRET` remains unchanged for the legacy `csa-superadmin-api-staging` Worker. Production-looking hostnames and Production Workers were not changed.

## Runtime verification

- Scheduled sync at 10:15:46 UTC succeeded with one authorization record.
- Scheduled sync at 10:30:46 UTC also succeeded with one authorization record and no error code. Later runs at 11:15:47, 11:30:03, 11:45:03 and 12:00:03 UTC also succeeded with one authorization record each and no error code.
- Read-only comparison confirmed the active non-Super-Admin source account and its isolated `global_admin_authorizations` row match by source ID, role, status and Finance access level (`none`).
- The 09:45 and 10:00 failures occurred during the earlier secret/target transition and are superseded by the two later successful runs.
- The latest isolated Super Admin source snapshots were re-exported from the current deployed bundle; verify CI after this documentation/test refresh.

## Remaining acceptance criteria

1. Scheduled sync after the dedicated-secret deployment has now been confirmed successful through 12:00:03 UTC; continue monitoring the 15-minute schedule.
2. The isolated compatibility API uses D1 6a32 and video D1 b611 for Legacy Links only. Keep it separate from canonical D1 470; Regional Admin and current Client/Editor data use canonical D1 470.
3. Do not create dummy Admins or invitations. A controlled lifecycle test must use a real, explicitly authorized Admin action.
4. Do not manually edit Global API authorization rows; the signed Super Admin snapshot is authoritative.
5. India country activation, legal evidence and real Regional Admin identity remain external prerequisites.
6. Keep Production and legacy Workers untouched.


### Follow-up verification — 2026-11-22 10:40 UTC

- The isolated Super Admin sender now signs the authorization snapshot with `GLOBAL_API_SYNC_HMAC_SECRET` first and retains `ADMIN_SYNC_HMAC_SECRET` only as compatibility fallback.
- The canonical Global API verifies both dedicated and legacy HMAC keys on all eight internal bridge paths; the legacy Super Admin Worker remains unchanged.
- The 10:30:46 UTC scheduled sync succeeded after the dedicated-secret sender deployment: one active non-Super-Admin authorization synchronized, no error.
- The canonical Super Admin `GLOBAL_DB` must remain aligned with canonical Global API D1 470 because the country assignment route writes there and Regional Admin data reads through the canonical API. The Staging preflight now explicitly checks this binding and both secret names.
- Super Admin, Editor Portal and Rush Admin isolated Staging Workers now have persisted Workers Logs and sampled Traces enabled. Raw exception objects/messages were sanitized before enabling observability.
- Production and the legacy Super Admin Worker were not modified.
