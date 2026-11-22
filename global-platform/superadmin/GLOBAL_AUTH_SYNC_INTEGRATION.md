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

- The last successful scheduled sync before the bridge-target/secret changes was 09:30:46 UTC and synchronized one authorization record.
- The 09:45:46 UTC attempt failed with `global_authorization_sync_failed_401` while the old isolated target was still configured.
- The 10:00:46 UTC attempt failed with `internal_error`; at that time error details were intentionally redacted before an HTTP status allowlist was added.
- The next scheduled run after the 10:02:20 UTC diagnostic update must confirm a success. Until a new scheduled success is recorded, Global Admin sync remains **NOT VERIFIED**.

## Safe acceptance criteria

1. Confirm a post-change scheduled sync succeeds and writes the authoritative snapshot to canonical D1.
2. Confirm canonical `global_admin_authorizations` matches the current active/suspended non-Super-Admin accounts from Super Admin D1.
3. Do not create dummy admins or invitations. A controlled lifecycle test should use a real, explicitly authorized admin change only.
4. Do not manually edit Global API authorization rows; the signed Super Admin snapshot is authoritative.
5. Keep Production and legacy Workers untouched.
