# Cloudflare D1 Capacity and Billing Decision Checklist

Date: 2026-11-21
Branch: staging
Status: documented; account plan not independently verified

## Verified Cloudflare product limits

According to the official Cloudflare Workers/D1 pricing documentation:
- Workers Free includes 10 D1 databases per account.
- Workers Paid includes the first 100,000 D1 databases; databases above that amount are billed at $0.10 per database per month.
- D1 query and storage usage are billed separately according to plan allowances and usage.

Official references:
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/observability/billing/

These are product-plan limits, not evidence of this CSA account's currently active plan.

## Account-specific status

- Earlier inventory counted 10 D1 databases in the account.
- An earlier Cloudflare API subscription/billing lookup returned HTTP 403; it did not reveal the active account plan.
- Therefore do not assume that the account is Free or Paid based only on the database count.
- Do not upgrade, change billing, or delete any database automatically.

## Account owner verification steps

1. Sign in to the Cloudflare Dashboard for the CSA account.
2. Open Workers & Pages > Plans/Billing (or the account Billing page).
3. Confirm whether Workers Free or Workers Paid is active.
4. Open Workers & Pages > D1 and confirm the database count and whether creation is blocked by the Free plan limit.
5. Review the subscription price, payment method, taxes, and billing notifications before choosing an upgrade.
6. Record the confirmed plan and date in the private account operations record. Do not paste payment details, tokens, or billing identifiers into GitHub.

## Decision

### If Workers Free is active

The account is at its 10-database limit. If the owner approves the paid subscription and its cost, upgrade through the Cloudflare Dashboard. Cloudflare's docs state that upgrading to Workers Paid removes Free-tier D1 database-count constraints; confirm the dashboard reflects the new plan before provisioning.

### If Workers Paid is already active

The 100,000 included database allowance should make a 10-database count an unexpected blocker. Do not delete resources. Capture the exact dashboard error and contact Cloudflare Support/account team to resolve entitlement or account-specific restrictions.

### If plan or quota is unclear

Stop provisioning. Ask Cloudflare Support to confirm the account's active Workers plan and D1 database creation entitlement.

## Next authorized technical action after verification

Once a new database slot is confirmed:
1. Create a separate disposable D1 for Super Admin schema testing.
2. Create a second separate disposable D1 for Rush schema testing.
3. Apply only the committed schema snapshots to those empty disposable targets.
4. Run object-count, foreign-key, integrity, and constraint/trigger tests.
5. Record evidence in the migration plan.

## Safety

No billing plan was changed. No payment method was accessed. No database was created, deleted, or repurposed. No Worker bindings, routes, production data, or payment settings were changed while preparing this checklist.
