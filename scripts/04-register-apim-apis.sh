#!/usr/bin/env bash
# =============================================================================
# Register all 12 SPLP mock APIs ke WSO2 APIM Publisher
# Usage: ./scripts/04-register-apim-apis.sh [APIM_BASE_URL]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DOMAIN=$(grep '^BASE_DOMAIN=' "${SCRIPT_DIR}/../domain.conf" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || echo 'pocsplp.com')
APIM="${1:-http://apim.${BASE_DOMAIN}}"
MOCK_BACKEND="http://splp-backend.splp.svc.cluster.local:3002/api/mock"
CID="B9fqPOPPRc0B1XTwdbKwCDp6drUa"
CSE="sjunTt1jFEzHJJALMvqGQGEPMJEa"

echo "==> Registering SPLP APIs ke $APIM ..."

# ── Get OAuth2 token ──────────────────────────────────────────────────────────
TOKEN=$(curl -sf -u "$CID:$CSE" \
  -X POST "$APIM/oauth2/token" \
  -d "grant_type=password&username=admin&password=admin&scope=apim:api_create%20apim:api_publish%20apim:api_view%20apim:api_delete" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "  ✅ Token diperoleh"

H_AUTH="Authorization: Bearer $TOKEN"
H_JSON="Content-Type: application/json"
PUB="$APIM/api/am/publisher/v4"

# ── Helper: create + publish ──────────────────────────────────────────────────
create_api() {
  local name="$1" version="$2" context="$3" method="$4" path="$5" tags="$6" desc="$7" backendPath="$8"

  # Check if already exists
  EXISTING=$(curl -sf -H "$H_AUTH" "$PUB/apis?query=name:$name" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['list'][0]['id'] if d['count']>0 else '')" 2>/dev/null || echo "")
  if [ -n "$EXISTING" ]; then
    echo "  ⏭  $name — sudah ada (id=${EXISTING:0:8}...), skip"
    return
  fi

  BODY=$(python3 -c "
import json, sys
print(json.dumps({
  'name': '$name', 'version': '$version', 'context': '$context',
  'description': '$desc', 'type': 'HTTP', 'transport': ['http','https'],
  'tags': $tags, 'policies': ['Unlimited'],
  'operations': [{'target': '$path', 'verb': '$method', 'authType': 'None', 'throttlingPolicy': 'Unlimited'}],
  'endpointConfig': {
    'endpoint_type': 'http',
    'production_endpoints': {'url': '$MOCK_BACKEND$backendPath'},
    'sandbox_endpoints':    {'url': '$MOCK_BACKEND$backendPath'},
  },
  'securityScheme': ['oauth2','api_key'],
  'lifeCycleStatus': 'CREATED',
}))")

  API_ID=$(curl -sf -H "$H_AUTH" -H "$H_JSON" \
    -X POST "$PUB/apis" -d "$BODY" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

  if [ -z "$API_ID" ]; then
    echo "  ❌ Gagal membuat $name"
    return
  fi

  # Publish
  curl -sf -H "$H_AUTH" -X POST "$PUB/apis/change-lifecycle?apiId=$API_ID&action=Publish" > /dev/null 2>&1 || true
  echo "  ✅ $name ($version) → PUBLISHED [id=${API_ID:0:8}...]"
}

# ── Register all 12 APIs ──────────────────────────────────────────────────────

create_api "VerifikasiNIK" "v2.1" "/dukcapil/v2" \
  "POST" "/verify-nik" \
  '["Dukcapil","Kependudukan"]' \
  "Verifikasi keaslian NIK warga negara Indonesia via Dukcapil" \
  "/dukcapil/v2"

create_api "DataKependudukan" "v2.0" "/dukcapil/v2/data" \
  "GET" "/data-kependudukan" \
  '["Dukcapil","Kependudukan"]' \
  "Mengambil data kependudukan lengkap berdasarkan NIK dari Dukcapil" \
  "/dukcapil/v2"

create_api "StatusKepesertaanBPJS" "v1.5" "/bpjs-kes/v1" \
  "POST" "/kepesertaan" \
  '["BPJSKesehatan","Kesehatan"]' \
  "Cek status kepesertaan dan kelayakan JKN BPJS Kesehatan" \
  "/bpjs-kes/v1"

create_api "TagihanBPJSKesehatan" "v1.3" "/bpjs-kes/v1/tagihan" \
  "GET" "/tagihan" \
  '["BPJSKesehatan","Kesehatan"]' \
  "Mendapatkan informasi tagihan iuran BPJS Kesehatan peserta mandiri" \
  "/bpjs-kes/v1"

create_api "VerifikasiNPWP" "v3.0" "/djp/v3" \
  "POST" "/verify-npwp" \
  '["DJP","Perpajakan"]' \
  "Verifikasi keabsahan NPWP orang pribadi atau badan usaha" \
  "/djp/v3"

create_api "StatusPajakBadan" "v2.2" "/djp/v2" \
  "GET" "/status-badan" \
  '["DJP","Perpajakan"]' \
  "Cek status kepatuhan pajak badan usaha dan riwayat pelaporan SPT" \
  "/djp/v2"

create_api "VerifikasiJHT" "v1.4" "/bpjs-tk/v1" \
  "POST" "/kepesertaan-jht" \
  '["BPJSKetenagakerjaan","Ketenagakerjaan"]' \
  "Verifikasi kepesertaan JHT dan JKK BPJS Ketenagakerjaan" \
  "/bpjs-tk/v1"

create_api "DataSTNKBPKB" "v1.0" "/polri/v1" \
  "POST" "/kendaraan" \
  '["POLRI","Keamanan"]' \
  "Verifikasi data kendaraan bermotor berdasarkan nomor polisi atau rangka" \
  "/polri/v1"

create_api "DataBansosPenerima" "v1.2" "/kemensos/v1" \
  "GET" "/bansos" \
  '["Kemensos","Sosial"]' \
  "Mengambil data penerima bantuan sosial PKH/BPNT/BLT berdasarkan NIK" \
  "/kemensos/v1"

create_api "RekamMedisElektronik" "v2.0" "/kemenkes/v2" \
  "GET" "/rekam-medis" \
  '["Kemenkes","Kesehatan"]' \
  "Akses rekam medis elektronik pasien. Memerlukan consent pasien" \
  "/kemenkes/v2"

create_api "StatusWNIWNA" "v1.5" "/imigrasi/v1" \
  "POST" "/status-wni" \
  '["Kemenkumham","Kependudukan"]' \
  "Verifikasi status kewarganegaraan dan informasi paspor/visa WNI/WNA" \
  "/ditjen-imigrasi/v1"

create_api "DataPerizinanUsaha" "v1.1" "/kemendagri/v1" \
  "GET" "/perizinan" \
  '["Kemendagri","Sosial"]' \
  "Cek status dan detail perizinan usaha yang diterbitkan pemerintah daerah" \
  "/kemendagri/v1"

echo ""
echo "✅ Selesai! Semua API terdaftar di:"
echo "   $APIM/publisher/"
