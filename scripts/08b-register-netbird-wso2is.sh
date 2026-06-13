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
# [1] App: netbird-dashboard (PKCE + Authorization Code Flow)
#     Digunakan oleh Web Dashboard NetBird
# ─────────────────────────────────────────────────────────────────────────────
echo "[1/2] Register netbird-dashboard (Web UI / PKCE)..."
RESP=$(curl -skv -X POST \
  "${IS_URL}/api/server/v1/applications" \
  -H "Authorization: Basic ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "netbird-dashboard",
    "description": "NetBird VPN Dashboard Web UI",
    "inboundProtocolConfiguration": {
      "oidc": {
        "grantTypes": ["authorization_code", "refresh_token"],
        "callbackURLs": [
          "https://netbird.dev-indonesia.com/auth",
          "http://localhost:53000"
        ],
        "allowedOrigins": ["https://netbird.dev-indonesia.com"],
        "publicClient": true,
        "pkce": {
          "mandatory": true,
          "supportPlainTransformAlgorithm": false
        },
        "accessToken": {
          "type": "JWT",
          "userAccessTokenExpiryInSeconds": 3600,
          "applicationAccessTokenExpiryInSeconds": 3600
        }
      }
    },
    "claimConfiguration": {
      "requestedClaims": [
        {"claim": {"uri": "http://wso2.org/claims/emailaddress"}, "mandatory": false},
        {"claim": {"uri": "http://wso2.org/claims/givenname"}, "mandatory": false}
      ]
    }
  }')

CLIENT_ID_DASH=$(echo "$RESP" | grep -o '"clientId":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$CLIENT_ID_DASH" ]; then
  echo "   ✅ netbird-dashboard Client ID: $CLIENT_ID_DASH"
else
  echo "   ❌ Gagal atau sudah ada. Response:"
  echo "$RESP" | head -c 500
  echo ""
  echo "   Coba manual di WSO2 IS Console:"
  echo "   https://is.dev-indonesia.com/console"
fi

# ─────────────────────────────────────────────────────────────────────────────
# [2] App: netbird-device (Device Authorization Flow)
#     Digunakan oleh CLI peer (netbird up)
# ─────────────────────────────────────────────────────────────────────────────
echo "[2/2] Register netbird-device (Device Code Flow untuk CLI)..."
RESP2=$(curl -sk -X POST \
  "${IS_URL}/api/server/v1/applications" \
  -H "Authorization: Basic ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "netbird-device",
    "description": "NetBird VPN Device Authorization (CLI peers)",
    "inboundProtocolConfiguration": {
      "oidc": {
        "grantTypes": [
          "urn:ietf:params:oauth:grant-type:device_code",
          "refresh_token"
        ],
        "callbackURLs": ["http://localhost"],
        "publicClient": true,
        "accessToken": {
          "type": "JWT",
          "userAccessTokenExpiryInSeconds": 3600
        }
      }
    }
  }')

CLIENT_ID_DEV=$(echo "$RESP2" | grep -o '"clientId":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$CLIENT_ID_DEV" ]; then
  echo "   ✅ netbird-device Client ID: $CLIENT_ID_DEV"
else
  echo "   ❌ Gagal atau sudah ada. Response:"
  echo "$RESP2" | head -c 500
  echo ""
  echo "   Coba manual di WSO2 IS Console:"
  echo "   https://is.dev-indonesia.com/console"
fi

echo ""
echo "================================================================="
echo " SETELAH REGISTRASI — Update management.json:"
echo ""
echo "   netbird-dashboard ClientID : ${CLIENT_ID_DASH:-<lihat di WSO2 IS console>}"
echo "   netbird-device    ClientID : ${CLIENT_ID_DEV:-<lihat di WSO2 IS console>}"
echo ""
echo " Edit file: netbird/management.json"
echo "   ganti 'netbird-dashboard' dengan client ID di atas"
echo "   ganti 'netbird-device' dengan client ID di atas"
echo ""
echo " Lalu restart NetBird management:"
echo "   docker compose -f netbird/docker-compose.yml restart management dashboard"
echo "================================================================="
