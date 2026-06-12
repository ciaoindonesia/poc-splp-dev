#!/usr/bin/env bash
# =============================================================================
# Recreate k3d cluster poc-splp-dev
# Strategi:
#   - Buat cluster + apply semua manifests sekaligus (cepat)
#   - Tunggu hanya nginx ingress & SPLP apps (image kecil, <3 menit)
#   - WSO2 / ClickHouse / Grafana pull image besar di background
#   - Setelah script selesai, jalankan: bash scripts/wait-ready.sh
#
# Usage: bash scripts/recreate-cluster.sh
# Estimasi selesai script: ~5-8 menit
# Estimasi semua komponen ready: ~30-60 menit (bergantung kecepatan internet)
# =============================================================================
set -euo pipefail

CLUSTER="poc-splp-dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
BASE_DOMAIN=$(grep '^BASE_DOMAIN=' "${ROOT}/domain.conf" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || echo 'pocsplp.com')

# ── Helper: poll sampai pod running, tampilkan titik progress ─────────────────
# Usage: wait_running <namespace> <label-selector> <deskripsi> <timeout-menit>
wait_running() {
  local ns=$1 sel=$2 desc=$3 timeout_min=${4:-20}
  local deadline=$(( $(date +%s) + timeout_min * 60 ))
  printf "   ⏳ %-35s" "$desc"
  while [ "$(date +%s)" -lt "$deadline" ]; do
    local n
    n=$(kubectl get pods -n "$ns" -l "$sel" --no-headers 2>/dev/null \
        | grep -c "Running" || true)
    if [ "${n:-0}" -ge 1 ]; then
      echo " ✅"
      return 0
    fi
    printf "."
    sleep 15
  done
  echo " ⚠  (timeout ${timeout_min}m — masih berjalan di background)"
  return 0   # jangan abort script
}

# ── Helper: status deployment ─────────────────────────────────────────────────
pod_status() {
  local ns=$1 deploy=$2
  local ready
  ready=$(kubectl get deploy "$deploy" -n "$ns" \
          -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
  local total
  total=$(kubectl get deploy "$deploy" -n "$ns" \
          -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "?")
  echo "${ready:-0}/${total}"
}

echo "================================================================="
echo " Recreate k3d cluster: $CLUSTER  (domain: $BASE_DOMAIN)"
echo " Script selesai: ~5-8 menit"
echo " Semua komponen ready: ~30-60 menit (pull image)"
echo "================================================================="
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# [1] Hapus cluster lama
# ─────────────────────────────────────────────────────────────────────────────
echo "[1/6] Hapus cluster lama..."
k3d cluster delete "$CLUSTER" 2>/dev/null || true
sudo pkill -f "socat.*:80" 2>/dev/null || true
sudo pkill -f "kubectl.*port-forward.*ingress" 2>/dev/null || true
echo "   ✅ Cluster lama dihapus"

# ─────────────────────────────────────────────────────────────────────────────
# [2] Buat cluster baru
# ─────────────────────────────────────────────────────────────────────────────
echo "[2/6] Buat cluster baru..."
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

# ─────────────────────────────────────────────────────────────────────────────
# [3] Install nginx ingress + buat namespaces
# ─────────────────────────────────────────────────────────────────────────────
echo "[3/6] Install nginx ingress controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml \
  2>&1 | grep -c "created\|configured\|unchanged" | xargs -I{} echo "   {} resources applied"

echo "[3/6] Buat namespaces..."
for ns in wso2 splp monitoring; do
  kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null
done
echo "   ✅ Namespaces: wso2, splp, monitoring"

# Tunggu nginx — ini satu-satunya wait blocking (diperlukan sebelum ingress routes kerja)
# Image nginx kecil (~200MB), biasanya 5-20 menit bergantung koneksi
wait_running "ingress-nginx" \
  "app.kubernetes.io/component=controller" \
  "nginx ingress (image pull ~200MB)..." \
  20

# ─────────────────────────────────────────────────────────────────────────────
# [4] Import images lokal ke cluster
# ─────────────────────────────────────────────────────────────────────────────
echo "[4/6] Import container images (splp-backend, splp-portal)..."
k3d image import splp-backend:latest splp-portal:latest -c "$CLUSTER" 2>&1 | tail -1
echo "   ✅ Images diimport"

# ─────────────────────────────────────────────────────────────────────────────
# [5] Apply SEMUA manifests sekaligus (API call cepat, pod pull di background)
# ─────────────────────────────────────────────────────────────────────────────
echo "[5/6] Apply semua manifests..."
kubectl apply -f "$ROOT/k8s/wso2-apim/"  2>/dev/null || true
kubectl apply -f "$ROOT/k8s/wso2-is/"    2>/dev/null || true
kubectl apply -f "$ROOT/k8s/clickhouse/" 2>/dev/null || true
kubectl apply -f "$ROOT/k8s/splp-apps/"  2>/dev/null || true
kubectl apply -f "$ROOT/k8s/ingress/"    2>/dev/null || true
echo "   ✅ Manifests submitted ke cluster"

# Grafana via Helm (tanpa --wait agar tidak blocking)
if command -v helm &>/dev/null; then
  helm repo add grafana https://grafana.github.io/helm-charts 2>/dev/null || true
  helm upgrade --install grafana grafana/grafana \
    -n monitoring --create-namespace \
    -f "$ROOT/k8s/grafana/grafana-values.yaml" \
    --atomic=false 2>&1 | tail -1 || true
  echo "   ✅ Grafana manifest submitted"
else
  echo "   ⚠  helm tidak ditemukan — skip Grafana"
fi

# ─────────────────────────────────────────────────────────────────────────────
# [6] Tunggu hanya SPLP apps (image lokal, cepat)
# ─────────────────────────────────────────────────────────────────────────────
echo "[6/6] Tunggu SPLP apps (image lokal, biasanya <2 menit)..."
wait_running "splp" "app=splp-backend" "splp-backend..." 5
wait_running "splp" "app=splp-portal"  "splp-portal..."  5
echo "   ✅ SPLP apps ready — portal bisa diakses sekarang"

# ─────────────────────────────────────────────────────────────────────────────
# Selesai — tampilkan status snapshot + instruksi monitor
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "================================================================="
echo " ✅ Script selesai — cluster berjalan, manifests applied"
echo ""
echo " Status saat ini:"
printf "   %-30s %s\n" "splp-portal"  "$(pod_status splp splp-portal)"
printf "   %-30s %s\n" "splp-backend" "$(pod_status splp splp-backend)"
printf "   %-30s %s\n" "wso2-apim"    "$(pod_status wso2 wso2-apim) (pull image ~1.5GB)"
printf "   %-30s %s\n" "wso2-is"      "$(pod_status wso2 wso2-is)   (pull image ~800MB)"
printf "   %-30s %s\n" "clickhouse"   "$(pod_status splp clickhouse) (pull image ~500MB)"
echo ""
echo " 🌐 Akses sekarang (portal sudah ready):"
echo "   http://${BASE_DOMAIN}"
echo ""
echo " ⏳ Komponen berat masih pull image di background."
echo "    Monitor dengan:"
echo "    watch kubectl get pods -A"
echo "    # atau:"
echo "    bash scripts/wait-ready.sh"
echo ""
echo " 📋 Setelah WSO2 APIM ready (~30 menit), daftarkan APIs:"
echo "    bash scripts/04-register-apim-apis.sh"
echo "================================================================="
