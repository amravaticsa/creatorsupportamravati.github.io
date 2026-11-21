#!/usr/bin/env bash
# Guarded helper for applying CSA schema snapshots to explicitly disposable D1 databases.
# It never creates/deletes databases and never targets existing CSA staging/production DBs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="plan"
SCHEMA=""
TARGET=""
CONFIRM=""
DISPOSABLE_ASSERTION=""

usage() {
  cat <<'USAGE'
Usage:
  bash global-platform/scripts/apply-disposable-d1-schema.sh --schema superadmin --target csa-superadmin-migration-test-YYYYMMDD
  bash global-platform/scripts/apply-disposable-d1-schema.sh --schema rush --target csa-rush-migration-test-YYYYMMDD

Dry-run is the default. To execute against a newly created, verified disposable D1:
  ... --apply --target-confirmed-disposable --confirm CSA-DISPOSABLE-D1-TEST

This helper does NOT create or delete D1 databases. Before --apply, the operator
must independently confirm account quota, target ownership, and that no Worker
or route is bound to the target. Never use a staging or production database.
USAGE
}

while (($#)); do
  case "$1" in
    --schema) SCHEMA="${2:?missing schema}"; shift 2 ;;
    --target) TARGET="${2:?missing target}"; shift 2 ;;
    --apply) MODE="apply"; shift ;;
    --confirm) CONFIRM="${2:?missing confirmation}"; shift 2 ;;
    --target-confirmed-disposable) DISPOSABLE_ASSERTION="yes"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$SCHEMA" in
  superadmin) SQL="$ROOT/global-platform/migrations/2026-11-21-superadmin-schema.sql" ;;
  rush) SQL="$ROOT/global-platform/migrations/2026-11-21-rush-schema.sql" ;;
  *) echo "ERROR: --schema must be superadmin or rush" >&2; exit 2 ;;
esac

case "$SCHEMA" in
  superadmin)
    [[ "$TARGET" =~ ^csa-superadmin-migration-test-[A-Za-z0-9][A-Za-z0-9-]*$ ]] || {
      echo "ERROR: target name does not match the dedicated disposable prefix for this schema" >&2; exit 2;
    }
    ;;
  rush)
    [[ "$TARGET" =~ ^csa-rush-migration-test-[A-Za-z0-9][A-Za-z0-9-]*$ ]] || {
      echo "ERROR: target name does not match the dedicated disposable prefix for this schema" >&2; exit 2;
    }
    ;;
esac

case "$TARGET" in
  *staging*|*production*|csa-superadmin-staging|csa-video-rush-staging|csa-global-platform|csa-orders)
    echo "ERROR: refusing known staging/production database name" >&2; exit 3 ;;
esac

[[ -s "$SQL" ]] || { echo "ERROR: missing or empty SQL snapshot: $SQL" >&2; exit 4; }

echo "Schema: $SCHEMA"
echo "Target: $TARGET"
echo "Snapshot: $SQL"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$SQL"
else
  shasum -a 256 "$SQL"
fi

if [[ "$MODE" == "plan" ]]; then
  echo "DRY RUN ONLY: no Cloudflare request was made."
  printf 'Planned command: npx wrangler d1 execute %q --remote --file=%q\n' "$TARGET" "$SQL"
  echo "Before execution, verify the target is newly created, empty, and not bound to any Worker or route."
  exit 0
fi

[[ "$DISPOSABLE_ASSERTION" == "yes" ]] || {
  echo "ERROR: --apply requires --target-confirmed-disposable" >&2; exit 5;
}
[[ "$CONFIRM" == "CSA-DISPOSABLE-D1-TEST" ]] || {
  echo "ERROR: exact confirmation phrase required" >&2; exit 6;
}
command -v npx >/dev/null 2>&1 || { echo "ERROR: npx is required" >&2; exit 7; }

echo "Applying schema to explicitly confirmed disposable target only..."
npx wrangler d1 execute "$TARGET" --remote --file="$SQL"
echo "Apply command completed. Run the read-only verification queries in D1-DISPOSABLE-TEST-RUNBOOK.md."
