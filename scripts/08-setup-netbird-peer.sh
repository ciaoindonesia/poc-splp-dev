#!/usr/bin/env bash
# =============================================================================
# Setup NetBird Peer on SPLP Server
# Usage: bash scripts/08-setup-netbird-peer.sh [SETUP_KEY]
#
# Prerequisite: NetBird Management sudah running (lihat netbird/docker-compose.yml)
# Jalankan di host server (bukan di dalam k3d)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
SETUP_KEY="${1:-}"
MGMT_URL="https://netbird.dev-indonesia.com:33073"

echo "================================================================="
echo " Setup NetBird Peer — SPLP Server"
echo " Management: $MGMT_URL"
echo "================================================================="

# ─────────────────────────────────────────────────────────────────────────────
# [1] Install NetBird client
# ─────────────────────────────────────────────────────────────────────────────
echo "[1/3] Install NetBird client..."
if command -v netbird &>/dev/null; then
  echo "   ♻️  NetBird sudah terinstall: $(netbird version)"
else
  echo "   🔧 Installing NetBird..."
  curl -fsSL https://pkgs.netbird.io/install.sh | sh
  echo "   ✅ NetBird installed"
fi

# ─────────────────────────────────────────────────────────────────────────────
# [2] Deploy NetBird Management (Docker Compose)
# ─────────────────────────────────────────────────────────────────────────────
echo "[2/3] Start NetBird Management Server..."
if ! docker compose -f "$ROOT/netbird/docker-compose.yml" ps --status running 2>/dev/null | grep -q "management"; then
  docker compose -f "$ROOT/netbird/docker-compose.yml" up -d
  echo "   ⏳ Tunggu management server siap..."
  sleep 10
  echo "   ✅ NetBird Management running"
else
  echo "   ✅ NetBird Management sudah running"
fi

# ─────────────────────────────────────────────────────────────────────────────
# [3] Connect server sebagai peer
# ─────────────────────────────────────────────────────────────────────────────
echo "[3/3] Connect server sebagai peer 'splp-server'..."
if [ -z "$SETUP_KEY" ]; then
  echo ""
  echo "   ⚠️  Setup key tidak diberikan."
  echo "   Buka: $MGMT_URL/setup-keys"
  echo "   Buat setup key baru (type: Reusable), lalu jalankan:"
  echo "   bash scripts/08-setup-netbird-peer.sh <SETUP_KEY>"
  echo ""
  echo "   Atau gunakan perintah manual:"
  echo "   netbird up --management-url $MGMT_URL --setup-key <SETUP_KEY>"
else
  netbird up \
    --management-url "$MGMT_URL" \
    --setup-key "$SETUP_KEY" \
    --hostname "splp-server"
  echo "   ✅ Server terdaftar sebagai peer"
  echo ""
  echo "   NetBird IP server:"
  netbird status | grep "NetBird IP" || ip addr show wt0 2>/dev/null | grep "inet " | awk '{print $2}'
fi

echo ""
echo "================================================================="
echo " Dashboard NetBird: https://netbird.dev-indonesia.com"
echo " API Management:    $MGMT_URL"
echo "================================================================="
