# CSA Video Editing — Rush Delivery Staging

## Pricing policy

- Standard delivery: no surcharge.
- Priority delivery (one-day target): +25% of the base project amount.
- Same-day urgent request: +50% of the base project amount, only after an authorized CSA Super Admin approves capacity and timing.
- A same-day request is a request, not a confirmed promise. If approval is rejected or pending, same-day payment must not be collected.
- All amounts are calculated in integer paise on the server. The browser's displayed amount is informational only.

## Staging isolation

An isolated Cloudflare D1 database named `csa-video-rush-staging` was created on 2026-11-20 (UUID: `198a0604-af4d-4671-8053-5df245ea754c`, APAC region). The migration is `database/migrations/20261120_rush_delivery_staging.sql`.

This database is separate from the live `csa-orders` database and the live video editing API. It contains only rush quote and audit tables; it does not copy customer records or payment data.

## Required implementation sequence

1. Add a staging Video Editing API that creates a quote from the trusted server-side draft amount, never from a browser-supplied surcharge or total.
2. Enforce the surcharge rates server-side (0 / 2500 / 5000 basis points) and store the calculation in `rush_delivery_quotes`.
3. Require authenticated Super Admin approval for `same_day`; record actor, timestamp, decision and note in `rush_delivery_audit`.
4. Add a staging Payment API flow that accepts only an active, unexpired, approved quote ID and calculates advance/full payment from the stored total.
5. Verify Razorpay's captured amount against the stored payable amount before allowing draft finalization.
6. Show the base amount, rush surcharge, total, payment amount and approval state on the customer receipt and Super Admin order view.
7. Run end-to-end tests with Razorpay test credentials and staging-only D1/R2 resources. Do not deploy to production until all checks pass.

## Current limitation

The account currently has staging Super Admin and Global API Workers, but no separate staging Video Editing API or staging Payment API. The existing Video Editing and Razorpay Workers are production Workers. Therefore this change deliberately does not alter either live Worker, live payment flow, or existing orders. A staging Worker pair and test credentials must be configured before the workflow can be safely exercised end-to-end.
