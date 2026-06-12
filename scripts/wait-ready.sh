#!/usr/bin/env bash
# =============================================================================
# Monitor status semua komponen SPLP sampai semua ready.
# Jalankan setelah recreate-cluster.sh selesai.
#
# Usage: bash scripts/wait-ready.sh
# Ctrl+C untuk keluar kapan saja (tidak merusak cluster)
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
BASE_DOMAIN=$(grep '^BASE_DOMAIN=' "${ROOT}/domain.conf" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || echo 'pocsplp.com')

# Komponen yang dipantau: "namespace/deployment label_selector estimasi_ukuran"
declare -A COMPS=(
  ["splp-portal"]="splp|app=splp-portal|lokal"
  ["splp-backend"]="splp|app=splp-backend|lokal"
  ["nginx-ingress"]="ingress-nginx|app.kubernetes.io/component=controller|~200MB"
  ["clickhouse"]="splp|app=clickhouse|~500MB"
  ["wso2-apim"]="wso2|app=wso2am|~1.5GB"
  ["wso2-is"]="wso2|app=wso2is|~800MB"
  ["grafana"]="monitoring|app.kubernetes.io/name=grafana|~300MB"
)

ORDER=("splp-portal" "splp-backend" "nginx-ingress" "clickhouse" "grafana" "wso2-is" "wso2-apim")

is_ready() {
  local ns=$1 sel=$2
  local n
  n=$(kubectl get pods -n "$ns" -l "$sel" --no-headers 2>/dev/null | grep -c "Running" || echo 0)
  [ "${n:-0}" -ge 1 ]
}

apim_api_ready() {
  curl -sf --max-time 5 \
    "http://apim.${BASE_DOMAIN}/api/am/publisher/v4/apis" \
    -o /dev/null 2>/dev/null
}

print_status() {
  local all_ready=true
  echo ""
  echo "  ┌────────────────────────────────────────────────────────┐"
  printf "  │  %-20s %-12s %-20s │\n" "Komponen" "Status" "Image Size"
  echo "  ├────────────────────────────────────────────────────────┤"
  for name in "${ORDER[@]}"; do
    local info="${COMPS[$name]}"
    local ns; ns=$(echo "$info" | cut -d'|' -f1)
    local sel; sel=$(echo "$info" | cut -d'|' -f2)
    local size; size=$(echo "$info" | cut -d'|' -f3)
    if is_ready "$ns" "$sel"; then
      printf "  │  %-20s %-12s %-20s │\n" "$name" "✅ Running" "$size"
    else
      printf "  │  %-20s %-12s %-20s │\n" "$name" "⏳ Pulling..." "$size"
      all_ready=false
    fi
  done
  echo "  └────────────────────────────────────────────────────────┘"
  echo ""
  $all_ready
}

# ─────────────────────────────────────────────────────────────────────────────
echo "================================================================="
echo " SPLP Status Monitor — domain: $BASE_DOMAIN"
echo " Ctrl+C untuk keluar. Cluster tetap berjalan."
echo "================================================================="

INTERVAL=20
ELAPSED=0
APIM_REGISTERED=false

while true; do
  clear
  echo "================================================================="
  echo " SPLP Status Monitor  $(date '+%H:%M:%S')  (+${ELAPSED}m elapsed)"
  echo "================================================================="

  if print_status; then
    echo "  🎉 Semua komponen Ready!"
    echo ""

    # Register APIs otomatis setelah WSO2 APIM ready
    if [ "$APIM_REGISTERED" = false ]; then
      echo "  📋 WSO2 APIM ready — mendaftarkan mock APIs..."
      bash "$SCRIPT_DIR/04-register-apim-apis.sh" 2>&1 \
        | grep -E "✅|❌|⏭|Token|Error" || true
      APIM_REGISTERED=true
      echo ""
    fi

    echo "  🌐 Akses aplikasi:"
    echo "     Portal  : http://${BASE_DOMAIN}"
    echo "     APIM    : http://apim.${BASE_DOMAIN}/publisher/"
    echo "     Grafana : http://grafana.${BASE_DOMAIN}"
    echo "     IS      : http://id.${BASE_DOMAIN}"
    echo ""
    break
  fi

  printf "  Refresh tiap ${INTERVAL}s. Ctrl+C untuk keluar.\n"
  printf "  Pod events: "
  kubectl get events -A --field-selector reason=Pulling \
    --sort-by='.lastTimestamp' 2>/dev/null \
    | tail -3 | awk '{print $4" "$5" "$6" "$7}' | tr '\n' ' ' || true
  echo ""

  sleep "$INTERVAL"
  ELAPSED=$(( ELAPSED + INTERVAL / 60 ))
done
