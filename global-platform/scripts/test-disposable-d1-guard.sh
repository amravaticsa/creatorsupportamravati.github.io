#!/usr/bin/env bash
# Negative tests for the guarded disposable D1 schema helper.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HELPER="$ROOT/global-platform/scripts/apply-disposable-d1-schema.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

expect_fail() {
  local label="$1"
  shift
  if bash "$HELPER" "$@" >"$TMP/out" 2>&1; then
    echo "FAIL: $label unexpectedly succeeded" >&2
    cat "$TMP/out" >&2
    exit 1
  fi
  echo "PASS: $label"
}

bash -n "$HELPER"
bash "$HELPER" --schema superadmin --target csa-superadmin-migration-test-ci >"$TMP/dry-superadmin"
grep -q "DRY RUN ONLY" "$TMP/dry-superadmin"
bash "$HELPER" --schema rush --target csa-rush-migration-test-ci >"$TMP/dry-rush"
grep -q "DRY RUN ONLY" "$TMP/dry-rush"
echo "PASS: valid disposable targets remain dry-run only"

expect_fail "empty target suffix rejected" --schema superadmin --target csa-superadmin-migration-test-
expect_fail "schema/target mismatch rejected" --schema rush --target csa-superadmin-migration-test-ci
expect_fail "staging target rejected" --schema superadmin --target csa-superadmin-staging
expect_fail "production-labelled target rejected" --schema superadmin --target csa-superadmin-migration-test-production
expect_fail "apply without explicit disposable assertion rejected" \
  --schema superadmin --target csa-superadmin-migration-test-ci --apply \
  --confirm CSA-DISPOSABLE-D1-TEST
expect_fail "apply without exact confirmation rejected" \
  --schema superadmin --target csa-superadmin-migration-test-ci --apply \
  --target-confirmed-disposable --confirm WRONG
echo "All disposable D1 guard tests passed."
