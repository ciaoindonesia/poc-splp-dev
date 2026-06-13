#!/usr/bin/env bash
# =============================================================================
# Register NetBird OAuth2 Applications di WSO2 IS
# Usage: bash scripts/08b-register-netbird-wso2is.sh
#
# Fix: WSO2 IS ini hanya terima 1 callbackURL saat POST create.
#      URL tambahan + PKCE + JWT di-update via PATCH setelah create.
# =============================================================================

IS_URL="https://is.dev-indonesia.com"
ADMIN_USER="admin"
ADMIN_PASS="admin"
AUTH=$(echo -n "${ADMIN_USER}:${ADMIN_PASS}" | base64)

echo "================================================================="
echo " Register NetBird Apps di WSO2 IS: $IS_URL"
echo "================================================================="

# ─────────────────────────────────────────────────────────────────────────────
# get_app_id_by_name <name>
# ─────────────────────────────────────────────────────────────────────────────
get_app_id_by_name() {
  local NAME="$1"
  curl -sk \
    "${IS_URL}/api/server/v1/applications?filter=name+eq+${NAME}" \
    -H "Authorization: Basic ${AUTH}" | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
apps = data.get('applications', [])
print(apps[0]['id'] if apps else '')
" 2>/dev/null || echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# create_app <name> <grant_types_json> <single_callback_url> <public_client>
# Returns app ID atau kosong jika gagal
# PENTING: hanya 1 callbackURL di POST — WSO2 IS ini 500 jika >1
# ─────────────────────────────────────────────────────────────────────────────
create_app() {
  local NAME="$1"
  local GRANTS="$2"
  local CALLBACK="$3"
  local PUBLIC="${4:-true}"

  local PAYLOAD
  PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'name': '${NAME}',
  'description': 'NetBird VPN - ${NAME}',
  'inboundProtocolConfiguration': {
    'oidc': {
      'grantTypes': ${GRANTS},
      'callbackURLs': ['${CALLBACK}'],
      'publicClient': ${PUBLIC}
    }
  }
}))
")

  local HEADERS
  HEADERS=$(curl -sk -i -X POST \
    "${IS_URL}/api/server/v1/applications" \
    -H "Authorization: Basic ${AUTH}" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" 2>/dev/null)

  local HTTP_STATUS
  HTTP_STATUS=$(echo "$HEADERS" | grep -m1 "^HTTP" | awk '{print $2}' | tr -d '\r')

  if [ "$HTTP_STATUS" = "201" ]; then
    echo "$HEADERS" | grep -i "^location:" | sed 's|.*/||' | tr -d '\r\n'
  else
    local BODY
    BODY=$(echo "$HEADERS" | grep -A1 "^{" | head -1)
    echo "   ⚠️  HTTP ${HTTP_STATUS}: ${BODY}" >&2
    echo ""
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# patch_oidc <app_id> <json_payload>
# ─────────────────────────────────────────────────────────────────────────────
patch_oidc() {
  local APP_ID="$1"
  local PAYLOAD="$2"
  curl -sk -o /dev/null -w "%{http_code}" -X PATCH \
    "${IS_URL}/api/server/v1/applications/${APP_ID}/inbound-protocols/oidc" \
    -H "Authorization: Basic ${AUTH}" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD"
}

# ─────────────────────────────────────────────────────────────────────────────
# get_client_id <app_id>
# ─────────────────────────────────────────────────────────────────────────────
get_client_id() {
  local APP_ID="$1"
  curl -sk \
    "${IS_URL}/api/server/v1/applications/${APP_ID}/inbound-protocols/oidc" \
    -H "Authorization: Basic ${AUTH}" | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('clientId',''))" 2>/dev/null || echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# delete_app <app_id>
# ─────────────────────────────────────────────────────────────────────────────
delete_app() {
  local APP_ID="$1"
  curl -sk -o /dev/null -w "%{http_code}" -X DELETE \
    "${IS_URL}/api/server/v1/applications/${APP_ID}" \
    -H "Authorization: Basic ${AUTH}"
}

# =============================================================================
# Cleanup app sementara dari percobaan sebelumnya
# =============================================================================
echo ""
echo "[cleanup] Hapus app percobaan sebelumnya jika ada..."

for NAME in "netbird-dashboard-test" "netbird-web" "netbirddashboard"; do
  ID=$(get_app_id_by_name "$NAME")
  if [ -n "$ID" ]; then
    STATUS=$(delete_app "$ID")
    echo "   🗑️  Hapus '${NAME}' (${ID}) → HTTP ${STATUS}"
  fi
done

# =============================================================================
# [1] netbird-dashboard
# =============================================================================
echo ""
echo "[1/2] netbird-dashboard (Authorization Code + PKCE)..."

APP_ID_DASH=$(get_app_id_by_name "netbird-dashboard")

if [ -n "$APP_ID_DASH" ]; then
  echo "   ℹ️  Sudah ada → App ID: ${APP_ID_DASH}"
else
  echo "   → Create app (1 callback URL)..."
  APP_ID_DASH=$(create_app \
    "netbird-dashboard" \
    '["authorization_code", "refresh_token"]' \
    "https://netbird.dev-indonesia.com/auth" \
    "true")

  if [ -n "$APP_ID_DASH" ]; then
    echo "   ✅ Created → App ID: ${APP_ID_DASH}"
  else
    echo "   ❌ Gagal membuat netbird-dashboard"
    exit 1
  fi
fi

echo "   → PATCH: tambah callback localhost + PKCE + JWT..."
PATCH_STATUS=$(patch_oidc "$APP_ID_DASH" '{
  "callbackURLs": [
    "https://netbird.dev-indonesia.com/auth",
    "http://localhost:53000"
  ],
  "pkce": {
    "mandatory": true,
    "supportPlainTransformAlgorithm": false
  },
  "accessToken": {
    "type": "JWT",
    "userAccessTokenExpiryInSeconds": 3600,
    "applicationAccessTokenExpiryInSeconds": 3600
  }
}')
echo "   → PATCH status: ${PATCH_STATUS}"

CLIENT_ID_DASH=$(get_client_id "$APP_ID_DASH")
echo "   ✅ Client ID: ${CLIENT_ID_DASH}"

# =============================================================================
# [2] netbird-device
# =============================================================================
echo ""
echo "[2/2] netbird-device (Device Code Flow)..."

APP_ID_DEV=$(get_app_id_by_name "netbird-device")

if [ -n "$APP_ID_DEV" ]; then
  echo "   ℹ️  Sudah ada → App ID: ${APP_ID_DEV}"
else
  echo "   → Create app..."
  APP_ID_DEV=$(create_app \
    "netbird-device" \
    '["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"]' \
    "http://localhost" \
    "true")

  if [ -n "$APP_ID_DEV" ]; then
    echo "   ✅ Created → App ID: ${APP_ID_DEV}"
  else
    echo "   ❌ Gagal membuat netbird-device"
    exit 1
  fi
fi

echo "   → PATCH: JWT token config..."
PATCH_STATUS=$(patch_oidc "$APP_ID_DEV" '{
  "accessToken": {
    "type": "JWT",
    "userAccessTokenExpiryInSeconds": 3600
  }
}')
echo "   → PATCH status: ${PATCH_STATUS}"

CLIENT_ID_DEV=$(get_client_id "$APP_ID_DEV")
echo "   ✅ Client ID: ${CLIENT_ID_DEV}"

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "================================================================="
echo " HASIL REGISTRASI"
echo "================================================================="
echo ""
echo " netbird-dashboard:"
echo "   App ID   : ${APP_ID_DASH}"
echo "   Client ID: ${CLIENT_ID_DASH}"
echo ""
echo " netbird-device:"
echo "   App ID   : ${APP_ID_DEV}"
echo "   Client ID: ${CLIENT_ID_DEV}"
echo ""
echo "================================================================="
echo " UPDATE netbird/management.json:"
echo ""
echo "   \"clientID\": \"${CLIENT_ID_DASH}\","
echo "   \"deviceClientID\": \"${CLIENT_ID_DEV}\""
echo ""
echo " Lalu restart:"
echo "   docker compose -f netbird/docker-compose.yml restart management dashboard"
echo "================================================================="