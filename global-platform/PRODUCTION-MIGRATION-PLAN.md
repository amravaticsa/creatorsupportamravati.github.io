# CSA Production Super Admin + Rush Migration Plan

Audit date: 2026-11-21
Branch: staging
Status: preparation only — no production resources changed.

## Confirmed source state

### Super Admin staging D1
- Database: `csa-superadmin-staging`
- ID: `99bc81fc-e97e-488b-a380-eb0237ff8ffc`
- Contains 34 application tables (plus Cloudflare's internal `_cf_KV` table).
- Core identity/access tables inspected: `admin_accounts`, `admin_permissions`, `admin_sessions`, `admin_enrollment_tokens`, and `csa_admin_module_access`.
- `admin_accounts` contains identity, role, status, password-hash and phone-verification fields.
- `admin_sessions` stores session-token hashes and expiry/revocation metadata.
- `admin_enrollment_tokens` stores enrollment-token hashes, purpose and expiry/consumption metadata.

### Rush staging D1
- Database: `csa-video-rush-staging`
- ID: `198a0604-af4d-4671-8053-5df245ea754c`
- Three application tables inspected: `rush_delivery_audit`, `rush_delivery_quotes`, and `video_editing_orders`.
- All three tables returned zero rows during the read-only audit.
- Quote records store amounts as integer paise, surcharge basis points, approval/payment statuses, customer email and timestamps.
- Audit records capture quote ID, event, actor ID/role, details JSON and timestamp.
- Order records include order code, customer email, customer access hash, project budget in paise and draft status.

## Required production architecture

1. Dedicated production Super Admin D1 with the complete, reviewed schema.
2. Dedicated production Super Admin Worker with production-only D1/R2 bindings and an explicit production environment guard.
3. Dedicated production Rush D1 with reviewed migrations.
4. Production Rush Worker bound only to production Rush D1 and production Super Admin identity/access store.
5. Production Editor Worker must use the production Super Admin identity/access store; staging Editor Worker remains on staging D1.
6. Production host routes are switched only after health, login, authorization, CRUD, audit logging and rollback tests pass.

## Identity and security migration rules

- Do not copy active session rows or session-token hashes from staging to production.
- Do not copy unconsumed enrollment tokens into production.
- Provision production admin identities using a verified invitation/enrollment or password-reset flow.
- If account metadata is migrated, explicitly review role, status, permission and module-access assignments before activation.
- Never expose password hashes, token hashes, HMAC secrets, API keys or other secret values in logs, documentation or chat.
- Confirm that all production authentication, OTP, email and Cloudflare Access settings use production-specific configuration.

## D1 capacity constraint

The Cloudflare account was previously observed at 10/10 D1 database slots. No new production database was created in this preparation step.

Before provisioning:
- Confirm current account quota and whether a plan/quota increase is available.
- Evaluate only genuinely unused databases after checking every Worker binding, route, deployment and backup.
- Export candidate databases and verify the exports before any retirement.
- Obtain explicit owner approval before deleting any database.
- Never use a production database as a staging substitute.

## Release gates (all required)

- [ ] Production Super Admin D1 provisioned and schema migration verified.
- [ ] Production Rush D1 provisioned and schema migration verified.
- [ ] Production Super Admin Worker deployed with production-only bindings and environment guard.
- [ ] Production Rush Worker deployed with production-only bindings and environment guard.
- [ ] Admin identities enrolled; permissions reviewed; no staging sessions/tokens copied.
- [ ] Editor Worker production identity binding corrected and tested.
- [ ] Rush API tests cover quote creation, approval/rejection, audit events, expiry, payment state and authorization.
- [ ] Super Admin tests cover login, logout, session expiry/revocation, role/permission enforcement and audit logs.
- [ ] Route switch has a documented rollback target and owner-approved change window.
- [ ] Runtime health and end-to-end tests pass before production routes are changed.

## Current routing blockers

- `superadmin.creatorsupportamravati.in/*` currently targets the staging Super Admin Worker.
- Production-hostname Rush routes currently target `csa-rush-admin-staging`.
- Production Editor Worker currently references the staging Super Admin D1.
- No dedicated production Super Admin Worker or production Rush Worker/database was verified in the audit.

## Change record

This document records a preparation plan based on read-only inspection. It does not create databases, deploy Workers, change routes, migrate identities, or modify production data.


## Follow-up D1 capacity audit (2026-11-21)

A fresh read-only inventory confirmed 10/10 D1 slots are occupied. Every one of the six databases previously observed with zero application rows is still referenced by at least one deployed Worker D1 binding. Some attached Workers have no custom route, but that alone is insufficient evidence to delete or unbind them. Four other databases contain operational or production records.

**Decision:** no safe D1 retirement candidate is established. Do not delete or unbind any of these databases as part of this migration. Obtain a Cloudflare D1 quota increase, or perform a separately approved consolidation project with verified exports, complete Worker/trigger/service-binding dependency review, and a tested rollback plan. Production provisioning remains blocked until dedicated production D1 capacity is available.


## D1 plan-limit decision (2026-11-21)

Cloudflare's current D1 documentation states:
- Workers Free: up to 10 D1 databases per account.
- Workers Paid: 100,000 D1 databases included; additional databases are billed separately under current pricing.
- Enterprise accounts with custom database limits should contact Cloudflare support if the expected limit is not reflected.

The account inventory currently contains exactly 10 D1 databases. Attempts to read account subscription and billing usage through the connected API returned HTTP 403 authentication errors, so the active plan cannot be verified through this connection. Do not assume the account is Free solely from the database count.

**Recommended next gate:** the account owner should verify the active Workers plan in Cloudflare Dashboard → Workers & Pages → Plans/Billing. If Free, evaluate upgrading to Workers Paid (review current billing and usage before confirming). If already Paid, contact Cloudflare support because the observed 10-database ceiling does not match the published Paid allowance. No plan, billing, database, Worker, or route change was made by this audit.
