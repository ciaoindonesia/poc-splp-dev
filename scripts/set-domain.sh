#!/usr/bin/env bash
# =============================================================================
# Ganti domain di seluruh konfigurasi SPLP
# Usage:
#   bash scripts/set-domain.sh              # baca dari domain.conf
#   bash scripts/set-domain.sh splp.go.id   # langsung set domain baru
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
CONF="$ROOT/domain.conf"

# ── Baca atau set domain ──────────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  NEW_DOMAIN="$1"
  sed -i "s|^BASE_DOMAIN=.*|BASE_DOMAIN=$NEW_DOMAIN|" "$CONF"
  echo "✅ domain.conf diperbarui → BASE_DOMAIN=$NEW_DOMAIN"
else
  NEW_DOMAIN=$(grep '^BASE_DOMAIN=' "$CONF" | cut -d= -f2 | tr -d '[:space:]')
fi

if [ -z "$NEW_DOMAIN" ]; then
  echo "❌ Domain tidak ditemukan. Isi domain.conf atau jalankan: bash scripts/set-domain.sh yourdomain.com"
  exit 1
fi

echo "================================================================="
echo " Menerapkan domain: $NEW_DOMAIN"
echo "================================================================="

# ── Generate ingress-all.yaml dari template ───────────────────────────────────
TMPL="$ROOT/k8s/ingress/ingress-template.yaml"
OUT="$ROOT/k8s/ingress/ingress-all.yaml"
sed "s/SPLP_DOMAIN/$NEW_DOMAIN/g" "$TMPL" > "$OUT"
echo "✅ k8s/ingress/ingress-all.yaml dihasilkan"

# ── Generate wso2-apim.yaml (replace SPLP_DOMAIN placeholder) ─────────────────
sed -i "s/apim\.SPLP_DOMAIN/apim.$NEW_DOMAIN/g; s/api\.SPLP_DOMAIN/api.$NEW_DOMAIN/g" \
  "$ROOT/k8s/wso2-apim/wso2-apim.yaml"
echo "✅ k8s/wso2-apim/wso2-apim.yaml diperbarui → apim.$NEW_DOMAIN"

sed -i "s/grafana\.SPLP_DOMAIN/grafana.$NEW_DOMAIN/g" \
  "$ROOT/k8s/grafana/grafana-values.yaml"
echo "✅ k8s/grafana/grafana-values.yaml diperbarui → grafana.$NEW_DOMAIN"

# ── Apply ke cluster (jika kubectl tersedia) ──────────────────────────────────
if kubectl cluster-info &>/dev/null 2>&1; then
  kubectl apply -f "$OUT"
  echo "✅ Ingress diterapkan ke cluster"
else
  echo "⚠  kubectl tidak terhubung ke cluster. Apply manual:"
  echo "   kubectl apply -f k8s/ingress/ingress-all.yaml"
fi

# ── Update /etc/hosts (lokal, jika belum ada) ─────────────────────────────────
HOSTS_ENTRIES="127.0.0.1 ${NEW_DOMAIN} api.${NEW_DOMAIN} api-backend.${NEW_DOMAIN} apim.${NEW_DOMAIN} is.${NEW_DOMAIN} grafana.${NEW_DOMAIN} clickhouse.${NEW_DOMAIN}"
if ! grep -q "$NEW_DOMAIN" /etc/hosts 2>/dev/null; then
  echo ""
  echo "📋 Tambahkan baris berikut ke /etc/hosts:"
  echo "   $HOSTS_ENTRIES"
  echo ""
  echo "   Jalankan:"
  echo "   echo '$HOSTS_ENTRIES' | sudo tee -a /etc/hosts"
else
  echo "✅ /etc/hosts sudah memiliki entri untuk $NEW_DOMAIN"
fi

echo ""
echo "================================================================="
echo " Domain aktif: $NEW_DOMAIN"
echo ""
echo " URL Aplikasi:"
echo "   Portal  : http://$NEW_DOMAIN"
echo "   Backend : http://api-backend.$NEW_DOMAIN"
echo "   API GW  : http://api.$NEW_DOMAIN"
echo "   APIM    : http://apim.$NEW_DOMAIN/publisher/"
echo "   IS      : http://is.$NEW_DOMAIN"
echo "   Grafana : http://grafana.$NEW_DOMAIN"
echo "================================================================="

# ── Update domain.conf ────────────────────────────────────────────────────────
echo "BASE_DOMAIN=$NEW_DOMAIN" > "$CONF"
cat >> "$CONF" << 'EOF'

# Subdomain yang digunakan (otomatis menggunakan BASE_DOMAIN di atas):
#   Portal     : BASE_DOMAIN         (contoh: splp.go.id)
#   Backend API: api-backend.BASE_DOMAIN
#   API Gateway: api.BASE_DOMAIN
#   APIM UI    : apim.BASE_DOMAIN
#   Identity   : is.BASE_DOMAIN
#   Grafana    : grafana.BASE_DOMAIN
#   ClickHouse : clickhouse.BASE_DOMAIN
EOF
