#!/usr/bin/env bash
# Deploy semua API yang sudah PUBLISHED ke WSO2 APIM Gateway
# Jalankan setelah 04-register-apim-apis.sh atau setelah pod APIM restart

set -euo pipefail

DOMAIN="${BASE_DOMAIN:-$(grep BASE_DOMAIN "$(dirname "$0")/../domain.conf" 2>/dev/null | cut -d= -f2)}"
APIM_URL="https://apim.${DOMAIN}"
VHOST="api.${DOMAIN}"
CREDS="admin:admin"

echo "==> Deploying APIs ke gateway: ${VHOST}"

API_IDS=$(curl -s -k "${APIM_URL}/api/am/publisher/v4/apis?limit=50" \
  -u "${CREDS}" | python3 -c "
import sys, json
apis = json.load(sys.stdin).get('list', [])
for a in apis:
    print(a['id'] + ' ' + a['name'])
")

if [ -z "$API_IDS" ]; then
  echo "  ❌ Tidak ada API ditemukan. Jalankan 04-register-apim-apis.sh terlebih dahulu."
  exit 1
fi

while IFS=' ' read -r api_id api_name; do
  # Buat revision
  rev=$(curl -s -k -X POST \
    "${APIM_URL}/api/am/publisher/v4/apis/${api_id}/revisions" \
    -H 'Content-Type: application/json' \
    -u "${CREDS}" \
    -d '{"description":"deploy"}')
  rev_id=$(echo "$rev" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null)

  if [ -z "$rev_id" ]; then
    echo "  ❌ ${api_name} — gagal buat revision"
    continue
  fi

  # Deploy revision ke gateway
  result=$(curl -s -k -X POST \
    "${APIM_URL}/api/am/publisher/v4/apis/${api_id}/deploy-revision?revisionId=${rev_id}" \
    -H 'Content-Type: application/json' \
    -u "${CREDS}" \
    -d "[{\"name\":\"Default\",\"vhost\":\"${VHOST}\",\"displayOnDevportal\":true}]")

  status=$(echo "$result" | python3 -c '
import sys, json
d = json.load(sys.stdin)
if isinstance(d, list):
    print(d[0]["status"])
else:
    print("ERROR: " + d.get("message", str(d)))
' 2>/dev/null)

  if [[ "$status" == "APPROVED" ]]; then
    echo "  ✅ ${api_name} → ${status}"
  else
    echo "  ❌ ${api_name} → ${status}"
  fi
done <<< "$API_IDS"

echo ""
echo "✅ Selesai! API aktif di:"
echo "   https://${VHOST}/"
