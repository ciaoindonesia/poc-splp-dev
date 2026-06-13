#!/usr/bin/env bash
# =============================================================================
# Register NetBird OAuth2 Applications di WSO2 IS
# Jalankan SETELAH WSO2 IS sudah running
# Usage: bash scripts/08b-register-netbird-wso2is.sh
# =============================================================================
set -euo pipefail

IS_URL="https://is.dev-indonesia.com"
ADMIN_USER="admin"
ADMIN_PASS="admin"
AUTH=$(echo -n "${ADMIN_USER}:${ADMIN_PASS}" | base64)

echo "================================================================="
echo " Register NetBird Apps di WSO2 IS: $IS_URL"
echo "================================================================="

# ─────────────────────────────────────────────────────────────────────────────
# Helper: create or get existing app, return app ID dari Location header
# Usage: create_or_get_app <name> <json_payload>
# ─────────────────────────────────────────────────────────────────────────────
create_or_get_app() {
  local APP_NAME="$1"
  local PAYLOAD="$2"
  local APP_ID=""

  # Cek apakah sudah ada
  local EXISTING
  EXISTING=$(curl -sk \
    "${IS_URL}/api/server/v1/applications?filter=name+eq+${APP_NAME}" \
    -H "Authorization: Basic ${AUTH}")

  local TOTAL
  TOTAL=$(echo "$EXISTING" | python3 -c "import sys,json; print(json.load(sys.stdin).get('totalResults',0))" 2>/dev/null || echo "0")

  if [ "$TOTAL" -gt 0 ]; then
    APP_ID=$(echo "$EXISTING" | python3 -c "import sys,json; print(json.load(sys.stdin)['applications'][0]['id'])" 2>/dev/null || echo "")
    echo "   ℹ️  App '${APP_NAME}' sudah ada → ID: ${APP_ID}"
  else
    # Create baru
    local HEADERS
    HEADERS=$(curl -sk -i -X POST \
      "${IS_URL}/api/server/v1/applications" \
      -H "Authorization: Basic ${AUTH}" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" 2>/dev/null | head -20)

    local HTTP_STATUS
    HTTP_STATUS=$(echo "$HEADERS" | grep -m1 "^HTTP" | awk '{print $2}')

    if [ "$HTTP_STATUS" = "201" ]; then
      APP_ID=$(echo "$HEADERS" | grep -i "^location:" | sed 's|.*/||' | tr -d '\r')
      echo "   ✅ App '${APP_NAME}' berhasil dibuat → ID: ${APP_ID}"
    else
      echo "   ❌ Gagal membuat '${APP_NAME}' (HTTP ${HTTP_STATUS})"
      echo "$HEADERS" | tail -5
      return 1
    fi
  fi

  echo "$APP_ID"
}

# ─────────────────────────────────────────────────────────────────────────────
# Helper: patch OIDC config setelah app dibuat
# Usage: patch_oidc <app_id> <json_patch>
# ─────────────────────────────────────────────────────────────────────────────
patch_oidc() {
  local APP_ID="$1"
  local PATCH_PAYLOAD="$2"

  local HTTP_STATUS
  HTTP_STATUS=$(curl -sk -o /dev/null -w "%{http_code}" -X PATCH \
    "${IS_URL}/api/server/v1/applications/${APP_ID}/inbound-protocols/oidc" \
    -H "Authorization: Basic ${AUTH}" \
    -H "Content-Type: application/json" \
    -d "$PATCH_PAYLOAD")

  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
    echo "   ✅ OIDC config updated (HTTP ${HTTP_STATUS})"
  else
    echo "   ⚠️  PATCH OIDC status: ${HTTP_STATUS} (mungkin tidak semua field didukung, lanjut)"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Helper: ambil clientId dari app
# ─────────────────────────────────────────────────────────────────────────────
get_client_id() {
  local APP_ID="$1"
  curl -sk \
    "${IS_URL}/api/server/v1/applications/${APP_ID}/inbound-protocols/oidc" \
    -H "Authorization: Basic ${AUTH}" | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('clientId',''))" 2>/dev/null || echo ""
}

# =============================================================================
# [1] App: netbird-dashboard (Authorization Code + PKCE)
# =============================================================================
echo ""
echo "[1/2] netbird-dashboard (Web UI / PKCE)..."

PAYLOAD_DASH='{
  "name": "netbird-dashboard",
  "description": "NetBird VPN Dashboard Web UI",
  "inboundProtocolConfiguration": {
    "oidc": {
      "grantTypes": ["authorization_code", "refresh_token"],
      "callbackURLs": [
        "https://netbird.dev-indonesia.com/auth",
        "http://localhost:53000"
      ],
      "publicClient": true
    }
  }
}'

APP_ID_DASH=$(create_or_get_app "netbird-dashboard" "$PAYLOAD_DASH" | tail -1)

# PATCH: enable PKCE + JWT token
patch_oidc "$APP_ID_DASH" '{
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
}'

CLIENT_ID_DASH=$(get_client_id "$APP_ID_DASH")
echo "   → Client ID: ${CLIENT_ID_DASH}"

# =============================================================================
# [2] App: netbird-device (Device Authorization Flow)
# =============================================================================
echo ""
echo "[2/2] netbird-device (Device Code Flow untuk CLI)..."

PAYLOAD_DEV='{
  "name": "netbird-device",
  "description": "NetBird VPN Device Authorization (CLI peers)",
  "inboundProtocolConfiguration": {
    "oidc": {
      "grantTypes": [
        "urn:ietf:params:oauth:grant-type:device_code",
        "refresh_token"
      ],
      "callbackURLs": ["http://localhost"],
      "publicClient": true
    }
  }
}'

APP_ID_DEV=$(create_or_get_app "netbird-device" "$PAYLOAD_DEV" | tail -1)

# PATCH: JWT token
patch_oidc "$APP_ID_DEV" '{
  "accessToken": {
    "type": "JWT",
    "userAccessTokenExpiryInSeconds": 3600
  }
}'

CLIENT_ID_DEV=$(get_client_id "$APP_ID_DEV")
echo "   → Client ID: ${CLIENT_ID_DEV}"

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
echo " UPDATE management.json dengan nilai berikut:"
echo ""
echo '   "clientID": "'${CLIENT_ID_DASH}'"'
echo '   "deviceClientID": "'${CLIENT_ID_DEV}'"'
echo ""
echo " Lalu restart NetBird management:"
echo "   docker compose -f netbird/docker-compose.yml restart management dashboard"
echo "================================================================="