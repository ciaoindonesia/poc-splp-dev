#!/usr/bin/env bash
# =============================================================================
# Recreate k3d cluster poc-splp-dev dengan port 80 dan 443 langsung terikat
# Tidak perlu kubectl port-forward atau socat setelah ini.
#
# Usage: bash scripts/recreate-cluster.sh
# Estimasi waktu: 15-25 menit
# =============================================================================
set -euo pipefail

CLUSTER="poc-splp-dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
BASE_DOMAIN=$(grep '^BASE_DOMAIN=' "${ROOT}/domain.conf" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || echo 'pocsplp.com')

echo "================================================================="
echo " Recreate k3d cluster: $CLUSTER"
echo " Port 80  → nginx ingress HTTP"
echo " Port 443 → nginx ingress HTTPS (untuk production nanti)"
echo "================================================================="
echo ""

# ── 1. Hapus cluster lama ─────────────────────────────────────────────────────
echo "[1/8] Hapus cluster lama..."
k3d cluster delete "$CLUSTER" 2>/dev/null || true
sudo pkill -f "socat.*:80" 2>/dev/null || true
sudo pkill -f "kubectl.*port-forward.*ingress" 2>/dev/null || true

# ── 2. Buat cluster baru ──────────────────────────────────────────────────────
echo "[2/8] Buat cluster baru dengan port 80/443 terikat langsung..."
k3d cluster create "$CLUSTER" \
  --servers 1 \
  --agents 2 \
  --k3s-arg '--disable=traefik@server:0' \
  --port "80:80@loadbalancer" \
  --port "443:443@loadbalancer" \
  --port "3000:30300@server:0" \
  --port "9090:30909@server:0" \
  --port "9443:30943@server:0" \
  --port "9444:30944@server:0" \
  --port "8280:30280@server:0" \
  --port "8888:30888@server:0"

echo "   ✅ Cluster terbuat"

# ── 3. Install nginx ingress ──────────────────────────────────────────────────
echo "[3/8] Install nginx ingress controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml
echo "   ⏳ Tunggu ingress ready (maks 5 menit)..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s || {
  echo "   ⚠  Timeout, cek manual: kubectl get pods -n ingress-nginx"
  echo "   ⏳ Tunggu 30 detik lagi sebelum lanjut..."
  sleep 30
}
echo "   ✅ Ingress ready (atau akan ready sebentar)"

# ── 4. Buat namespaces ────────────────────────────────────────────────────────
echo "[4/8] Buat namespaces..."
kubectl create namespace wso2       --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace splp       --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# ── 5. Import semua images ────────────────────────────────────────────────────
echo "[5/8] Import container images ke cluster baru..."
IMAGES=(
  "splp-backend:latest"
  "splp-portal:latest"
)
k3d image import "${IMAGES[@]}" -c "$CLUSTER" 2>&1 | tail -1
echo "   ✅ Images diimport"

# ── 6. Apply semua manifests ──────────────────────────────────────────────────
echo "[6/8] Apply Kubernetes manifests..."
kubectl apply -f "$ROOT/k8s/wso2-apim/"   2>/dev/null || true
kubectl apply -f "$ROOT/k8s/wso2-is/"     2>/dev/null || true
kubectl apply -f "$ROOT/k8s/clickhouse/"  2>/dev/null || true
kubectl apply -f "$ROOT/k8s/splp-apps/"   2>/dev/null || true
kubectl apply -f "$ROOT/k8s/ingress/"     2>/dev/null || true
echo "   ✅ Manifests applied"

# ── Grafana via Helm ──────────────────────────────────────────────────────────
if command -v helm &>/dev/null; then
  echo "[6b] Deploy Grafana via Helm..."
  helm repo add grafana https://grafana.github.io/helm-charts --force-update 2>/dev/null || true
  helm upgrade --install grafana grafana/grafana \
    -n monitoring --create-namespace \
    -f "$ROOT/k8s/grafana/grafana-values.yaml" \
    --wait --timeout 3m 2>&1 | tail -2 || echo "   ⚠  Grafana timeout, akan ready sebentar"
  echo "   ✅ Grafana deployed"
else
  echo "   ⚠  helm tidak ditemukan, skip Grafana (install: https://helm.sh)"
fi

# ── 7. Tunggu pods ready ──────────────────────────────────────────────────────
echo "[7/8] Tunggu pods splp-backend dan splp-portal..."
kubectl rollout status deployment/splp-backend -n splp --timeout=120s
kubectl rollout status deployment/splp-portal  -n splp --timeout=120s
echo "   ✅ SPLP apps ready"

echo "[7/8] Tunggu WSO2 APIM (bisa 5-10 menit)..."
kubectl rollout status deployment/wso2-apim -n wso2 --timeout=600s 2>/dev/null || \
  echo "   ⚠  WSO2 APIM belum ready — lanjutkan manual: kubectl rollout status deploy/wso2-apim -n wso2"

# ── 8. Register APIs ──────────────────────────────────────────────────────────
echo "[8/8] Register mock APIs ke WSO2 APIM..."
echo "   ⏳ Tunggu APIM Publisher API siap (30 detik)..."
sleep 30
bash "$SCRIPT_DIR/04-register-apim-apis.sh" "http://apim.${BASE_DOMAIN}" 2>&1 | grep -E "✅|❌|⏭|Token" || true

# ── Selesai ───────────────────────────────────────────────────────────────────
echo ""
echo "================================================================="
echo " ✅ Cluster siap! Tidak perlu port-forward atau socat."
echo ""
echo " Akses langsung (port 80 default, tidak perlu :8080):"
echo "   http://${BASE_DOMAIN}"
echo "   http://apim.${BASE_DOMAIN}/publisher/"
echo "   http://grafana.${BASE_DOMAIN}"
echo "   http://id.${BASE_DOMAIN}"
echo ""
echo " NodePorts lain:"
echo "   http://localhost:9443  — APIM Publisher HTTPS"
echo "   http://localhost:9444  — WSO2 IS HTTPS"
echo "   http://localhost:8280  — API Gateway"
echo "   http://localhost:3000  — Grafana (langsung)"
echo "================================================================="
