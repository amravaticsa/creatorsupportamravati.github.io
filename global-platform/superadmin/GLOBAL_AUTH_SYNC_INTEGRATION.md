# Global Admin Authorization Sync Integration

## Authoritative Staging architecture

- Super Admin source of truth: `csa-superadmin-isolated-staging`, Super Admin D1 `c2bb3fb5-db22-4ed5-9283-161df57ebac2`.
- Global Client/Editor API: `csa-global-api-staging`, canonical Global D1 `470a81b8-3d36-4e2d-942c-5cbb2746a473`.
- The Super Admin Worker's `GLOBAL_DB` binding points to canonical Global D1; its `DB` binding remains the Super Admin account/session D1.
- The four core Super Admin bridges (authorization sync, pricing, refund dashboard and editor sessions) target `csa-global-api-staging`. The Regional Admin proxy also targets this canonical API. The Legacy Links bridge remains on `csa-global-api-isolated-staging` because that isolated API owns the dedicated legacy Editor Portal integration route.
- `csa-global-api-isolated-staging` and D1 `6a32dda3-b8c5-413c-9f51-58f0a9fa0712` remain a separate isolated test/legacy surface. They are not live-replicated with canonical D1 and are not the current Super Admin bridge target.

## HMAC configuration

- A cryptographically random 256-bit `GLOBAL_API_SYNC_HMAC_SECRET` was generated and set to the same value on `csa-superadmin-isolated-staging`, `csa-global-api-staging` and `csa-global-api-isolated-staging`.
- The secret value is not stored in source control, documentation, or chat.
- The Super Admin sender prefers `GLOBAL_API_SYNC_HMAC_SECRET` and retains `ADMIN_SYNC_HMAC_SECRET` fallback.
- Both Global API verifiers accept the dedicated secret and retain the legacy `ADMIN_SYNC_HMAC_SECRET` fallback.
- The legacy `ADMIN_SYNC_HMAC_SECRET` was not rotated. The legacy `csa-superadmin-api-staging` Worker and production-looking hostnames were not changed.
- The isolated Global API Worker uses the same dedicated Staging secret only for the Legacy Links bridge; its D1 remains separate and is not live-replicated.

## Deployment verification

- Super Admin Worker bridge host routing deployed at 09:54:42 UTC with 100% traffic.
- Dedicated secret bindings confirmed on Super Admin and canonical Global API at 09:56:04 UTC; both Worker deployments showed 100% traffic.
- GitHub Actions Staging deploy and smoke tests passed at 09:49:53 UTC and again after the source snapshot/health updates. The latest validation and deployment after log sanitization also passed.
- The Super Admin Worker source snapshots now match all five deployed modules. Raw exception messages and stack traces were removed from its logs; sync diagnostics preserve only an allowlisted HTTP status code.

## Scheduled sync status

- Before the final routing/secret correction, the 09:45:46 UTC attempt failed with `global_authorization_sync_failed_401` while the sender and isolated receiver had different dedicated secrets. The 10:00:46 UTC attempt failed with `internal_error` during the initial bridge-target transition.
- After routing the four core bridges to canonical API, retaining Legacy Links on the isolated API, and provisioning the dedicated 256-bit secret on the two canonical Staging Workers, the 10:15:46 UTC scheduled sync **succeeded** with `synced_count=1` and no error code.
- Read-only comparison confirmed the active non-Super-Admin source account and its canonical `global_admin_authorizations` row have the same source ID, role, status and Finance access level (`none`).
- GitHub Actions validation and the Staging Pages deploy/smoke workflow both passed for commit `8e029c2d7c81bc9bb2be91eb2d5c6202af255f96` at 10:16:51 UTC. The 10:30:46 UTC scheduled run also succeeded with `synced_count=1` and no error code, after the isolated sender was changed to prefer `GLOBAL_API_SYNC_HMAC_SECRET`.

## Safe acceptance criteria

1. Confirm a post-change scheduled sync succeeds and writes the authoritative snapshot to canonical D1.
2. Confirm canonical `global_admin_authorizations` matches the current active/suspended non-Super-Admin accounts from Super Admin D1.
3. Do not create dummy admins or invitations. A controlled lifecycle test should use a real, explicitly authorized admin change only.
4. Do not manually edit Global API authorization rows; the signed Super Admin snapshot is authoritative.
5. Keep Production and legacy Workers untouched.


### Follow-up verification — 2026-11-22 10:40 UTC

- The isolated Super Admin sender now signs the authorization snapshot with `GLOBAL_API_SYNC_HMAC_SECRET` first and retains `ADMIN_SYNC_HMAC_SECRET` only as compatibility fallback.
- The canonical Global API verifies both dedicated and legacy HMAC keys on all eight internal bridge paths; the legacy Super Admin Worker remains unchanged.
- The 10:30:46 UTC scheduled sync succeeded after the dedicated-secret sender deployment: one active non-Super-Admin authorization synchronized, no error.
- The canonical Super Admin `GLOBAL_DB` must remain aligned with canonical Global API D1 470 because the country assignment route writes there and Regional Admin data reads through the canonical API. The Staging preflight now explicitly checks this binding and both secret names.
- Super Admin, Editor Portal and Rush Admin isolated Staging Workers now have persisted Workers Logs and sampled Traces enabled. Raw exception objects/messages were sanitized before enabling observability.
- Production and the legacy Super Admin Worker were not modified.
