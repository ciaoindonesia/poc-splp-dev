#!/usr/bin/env bash
# =============================================================================
# Setup HTTPS dengan cert-manager + Let's Encrypt
# Jalankan di server setelah cluster running dan DNS sudah propagate
#
# Usage: bash scripts/05-setup-https.sh [BASE_DOMAIN] [EMAIL]
# Contoh: bash scripts/05-setup-https.sh dev-indonesia.com admin@dev-indonesia.com
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
BASE_DOMAIN="${1:-$(grep '^BASE_DOMAIN=' "$ROOT/domain.conf" | cut -d= -f2 | tr -d '[:space:]')}"
EMAIL="${2:-admin@${BASE_DOMAIN}}"

echo "================================================================="
echo " Setup HTTPS — domain: $BASE_DOMAIN"
echo " Let's Encrypt email: $EMAIL"
echo "================================================================="

# ─────────────────────────────────────────────────────────────────────────────
# [1] Verifikasi DNS sudah propagate
# ─────────────────────────────────────────────────────────────────────────────
echo "[1/4] Cek DNS propagation..."
SERVER_IP=$(curl -sf https://ifconfig.me 2>/dev/null || curl -sf https://api.ipify.org || hostname -I | awk '{print $1}')
for subdomain in "" "portal." "api-backend." "apim." "is." "grafana."; do
  host="${subdomain}${BASE_DOMAIN}"
  resolved=$(dig +short "$host" 2>/dev/null | head -1 || nslookup "$host" 2>/dev/null | grep -A1 'Name:' | grep 'Address:' | awk '{print $2}' | head -1 || echo "?")
  if [ "$resolved" = "$SERVER_IP" ] || [ "$resolved" = "" ]; then
    echo "   ✅ $host → ${resolved:-propagating...}"
  else
    echo "   ⚠  $host → $resolved (ekspektasi: $SERVER_IP)"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# [2] Install cert-manager via Helm
# ─────────────────────────────────────────────────────────────────────────────
echo "[2/4] Install cert-manager..."
helm repo add jetstack https://charts.jetstack.io --force-update 2>/dev/null || true
helm repo update jetstack

if helm status cert-manager -n cert-manager &>/dev/null; then
  echo "   ✅ cert-manager sudah terinstall"
else
  helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --create-namespace \
    --set crds.enabled=true \
    --wait --timeout 3m
  echo "   ✅ cert-manager installed"
fi

# Tunggu webhook ready
kubectl wait --for=condition=Available deployment/cert-manager-webhook \
  -n cert-manager --timeout=60s
echo "   ✅ cert-manager webhook ready"

# ─────────────────────────────────────────────────────────────────────────────
# [3] Apply ClusterIssuer
# ─────────────────────────────────────────────────────────────────────────────
echo "[3/4] Apply ClusterIssuer Let's Encrypt..."
sed "s/SPLP_DOMAIN/$BASE_DOMAIN/g; s/admin@SPLP_DOMAIN/$EMAIL/g" \
  "$ROOT/k8s/cert-manager/cluster-issuer.yaml" | kubectl apply -f -
echo "   ✅ ClusterIssuer letsencrypt-staging + letsencrypt-prod created"

# ─────────────────────────────────────────────────────────────────────────────
# [4] Update ingress dengan TLS
# ─────────────────────────────────────────────────────────────────────────────
echo "[4/4] Update ingress resources dengan TLS..."
sed "s/SPLP_DOMAIN/$BASE_DOMAIN/g" \
  "$ROOT/k8s/ingress/ingress-template.yaml" \
  > "$ROOT/k8s/ingress/ingress-all.yaml"
kubectl apply -f "$ROOT/k8s/ingress/ingress-all.yaml"
echo "   ✅ Ingress updated dengan TLS"

# ─────────────────────────────────────────────────────────────────────────────
# Selesai
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "================================================================="
echo " ✅ HTTPS setup selesai!"
echo ""
echo " cert-manager akan request sertifikat otomatis dari Let's Encrypt."
echo " Proses 1-3 menit per subdomain."
echo ""
echo " Monitor status sertifikat:"
echo "   kubectl get certificate -A"
echo "   kubectl get certificaterequest -A"
echo "   kubectl describe certificate -n splp tls-portal-$BASE_DOMAIN"
echo ""
echo " Akses HTTPS:"
echo "   https://portal.$BASE_DOMAIN"
echo "   https://api-backend.$BASE_DOMAIN"
echo "   https://apim.$BASE_DOMAIN/publisher/   (admin/admin)"
echo "   https://is.$BASE_DOMAIN/console        (admin/admin)"
echo "   https://grafana.$BASE_DOMAIN"
echo "================================================================="
