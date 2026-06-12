#!/usr/bin/env bash
# =============================================================================
# SPLP 2026 — Master Setup Script
# Deploy semua komponen ke k3d cluster poc-splp-dev
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="poc-splp-dev"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
section() { echo -e "\n${GREEN}======================================${NC}"; echo -e "${GREEN} $*${NC}"; echo -e "${GREEN}======================================${NC}"; }

# ── 1. Cluster ────────────────────────────────────────────────────────────────
section "1/7  Membuat k3d Cluster"
bash "$ROOT_DIR/scripts/01-create-cluster.sh"

# ── 2. Namespace ──────────────────────────────────────────────────────────────
section "2/7  Membuat Namespaces"
kubectl apply -f "$ROOT_DIR/k8s/00-namespace.yaml"
kubectl get namespaces | grep -E 'splp|monitoring|messaging|wso2' || true

# ── 3. Kafka via Strimzi ──────────────────────────────────────────────────────
section "3/7  Deploy Apache Kafka via Strimzi Operator (KRaft)"
helm repo add strimzi https://strimzi.io/charts/ --force-update 2>/dev/null || true
helm repo update strimzi

if helm status strimzi-kafka-operator -n messaging &>/dev/null; then
  info "Strimzi operator sudah terinstall, skip."
else
  helm upgrade --install strimzi-kafka-operator strimzi/strimzi-kafka-operator \
    --namespace messaging \
    --set watchNamespaces="{messaging}" \
    --wait --timeout 3m
fi
info "Strimzi operator ready ✓"

info "Menunggu Strimzi CRDs terdaftar..."
kubectl wait --for condition=established crd/kafkas.kafka.strimzi.io --timeout=60s
kubectl wait --for condition=established crd/kafkanodepools.kafka.strimzi.io --timeout=60s

info "Deploy Kafka cluster (KRaft mode)..."
kubectl apply -f "$ROOT_DIR/k8s/kafka/strimzi-kafka.yaml"

info "Menunggu Kafka cluster ready (bisa 2–3 menit)..."
kubectl wait kafka/splp-kafka -n messaging --for=condition=Ready --timeout=5m || \
  warn "Kafka belum ready, lanjut deploy komponen lain..."
info "Kafka deployed ✓"

# ── 4. ClickHouse ─────────────────────────────────────────────────────────────
section "4/7  Deploy ClickHouse"
kubectl apply -f "$ROOT_DIR/k8s/clickhouse/clickhouse.yaml"
info "Menunggu ClickHouse ready..."
kubectl rollout status deployment/clickhouse -n splp --timeout=120s
info "ClickHouse deployed ✓"

# ── 5. Grafana ────────────────────────────────────────────────────────────────
section "5/7  Deploy Grafana"
helm repo add grafana https://grafana.github.io/helm-charts --force-update 2>/dev/null || true
helm repo update grafana

if helm status grafana -n monitoring &>/dev/null; then
  info "Grafana sudah terinstall, skip."
else
  helm upgrade --install grafana grafana/grafana \
    --namespace monitoring \
    --values "$ROOT_DIR/k8s/grafana/grafana-values.yaml" \
    --set plugins="" \
    --wait --timeout 3m
fi
info "Grafana deployed ✓"

# ── 6. WSO2 APIM + IS ─────────────────────────────────────────────────────────
section "6/7  Deploy WSO2 APIM & Identity Server"
warn "WSO2 image pull bisa memakan waktu 5–15 menit pertama kali..."

kubectl apply -f "$ROOT_DIR/k8s/wso2-apim/wso2-apim.yaml" || warn "WSO2 APIM apply gagal, lanjut..."
kubectl apply -f "$ROOT_DIR/k8s/wso2-is/wso2-is.yaml"    || warn "WSO2 IS apply gagal, lanjut..."

info "WSO2 pods sedang start (async, tidak tunggu selesai)..."
info "Cek progress: kubectl get pods -n wso2 -w"

# ── 7. SPLP Apps ──────────────────────────────────────────────────────────────
section "7/7  Build & Deploy SPLP Portal + Backend"

info "Build Docker image: splp-backend..."
docker build -t splp-backend:latest "$ROOT_DIR/apps/splp-backend"
k3d image import splp-backend:latest -c "$CLUSTER_NAME"

info "Build Docker image: splp-portal..."
docker build -t splp-portal:latest "$ROOT_DIR/apps/splp-portal"
k3d image import splp-portal:latest -c "$CLUSTER_NAME"

kubectl apply -f "$ROOT_DIR/k8s/splp-apps/splp-backend.yaml"
kubectl apply -f "$ROOT_DIR/k8s/splp-apps/splp-portal.yaml"

info "Menunggu SPLP apps ready..."
kubectl rollout status deployment/splp-backend -n splp --timeout=60s
kubectl rollout status deployment/splp-portal  -n splp --timeout=60s

# ── Summary ───────────────────────────────────────────────────────────────────
section "✅  Deploy Selesai!"
echo ""
echo -e "${GREEN}Akses URL:${NC}"
echo "  🌐 SPLP Portal (k8s)  : http://localhost:8081"
echo "  ⚙️  SPLP Backend (k8s) : http://localhost:8082"
echo "  📊 Grafana             : http://localhost:3000  (admin / splp-grafana-2026)"
echo "  🗄️  ClickHouse HTTP     : http://localhost:8888"
echo "  🔌 WSO2 APIM HTTPS     : https://localhost:9443 (admin / admin)"
echo "  🔐 WSO2 IS             : https://localhost:9444 (admin / admin)"
echo ""
echo -e "${YELLOW}Dev server masih berjalan:${NC}"
echo "  🖥️  Portal (Vite dev)   : http://localhost:3001"
echo "  ⚙️  Backend (Node dev)  : http://localhost:3002"
echo ""
kubectl get pods -A | grep -E 'NAMESPACE|splp|monitoring|messaging|wso2'
