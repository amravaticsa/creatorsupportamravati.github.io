#!/usr/bin/env bash
set -euo pipefail

# Intentionally pinned to the staging Worker hostname. Never accept a caller-supplied
# URL here: this test must not be redirected to production by workflow variables.
API="https://csa-global-api-isolated-staging.creatorsupportamravati.workers.dev"
case "$API" in
  https://csa-global-api-isolated-staging.creatorsupportamravati.workers.dev) ;;
  *) echo "Refusing to run against a non-staging API." >&2; exit 2 ;;
esac

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

health_status="$(curl --silent --show-error --retry 5 --retry-delay 3 --retry-all-errors \
  -o "$tmp" -w '%{http_code}' "$API/health")"
if [ "$health_status" != "200" ]; then
  echo "FAIL staging health endpoint: HTTP $health_status" >&2
  cat "$tmp" >&2
  exit 1
fi
node --input-type=module - "$tmp" <<'NODE'
import fs from "node:fs";
const h = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (h.ok !== true || h.service !== "CSA Global API" || h.status !== "healthy" || h.d1_connected !== true || h.schema_ready !== true || (h.missing_tables || []).length !== 0 || (h.missing_columns || []).length !== 0 || (h.missing_views || []).length !== 0) {
  throw new Error("Isolated Global API canonical D1 schema check failed: " + JSON.stringify({status:h.status,d1_connected:h.d1_connected,schema_ready:h.schema_ready,missing_tables:h.missing_tables,missing_columns:h.missing_columns,missing_views:h.missing_views}));
}
NODE
echo "PASS isolated Global API health and canonical D1 table/column schema"

# These are read-only business queues. Without a signed-in identity they must
# reject access, rather than disclose client, editor, tender, KYC or finance data.
endpoints=(
  "/v1/client/projects"
  "/v1/client/refunds"
  "/v1/editor/tenders"
  "/v1/editor/assignments"
  "/v1/admin/tenders"
  "/v1/admin/editors/kyc/pending"
  "/v1/admin/client-refunds"
)

for path in "${endpoints[@]}"; do
  status="$(curl --silent --show-error --retry 2 --retry-delay 2 --retry-all-errors \
    -H 'Accept: application/json' -o "$tmp" -w '%{http_code}' "$API$path")"
  case "$status" in
    401|403)
      echo "PASS unauthenticated access denied: $path (HTTP $status)"
      ;;
    *)
      echo "FAIL expected HTTP 401/403 for unauthenticated $path, received $status" >&2
      cat "$tmp" >&2
      exit 1
      ;;
  esac
done

echo "PASS all staging unauthenticated access-boundary checks"
