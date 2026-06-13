#!/usr/bin/env bash
# =============================================================================
# Deploy Observability Stack: Prometheus + Loki + upgrade Grafana
# Usage: bash scripts/07-deploy-observability.sh [BASE_DOMAIN]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
BASE_DOMAIN="${1:-$(grep '^BASE_DOMAIN=' "$ROOT/domain.conf" | cut -d= -f2 | tr -d '[:space:]')}"

echo "================================================================="
echo " Deploy Observability (Prometheus + Loki) — domain: $BASE_DOMAIN"
echo "================================================================="

# ─────────────────────────────────────────────────────────────────────────────
# [1] Namespace
# ─────────────────────────────────────────────────────────────────────────────
echo "[1/5] Pastikan namespace monitoring..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
echo "   ✅ namespace monitoring"

# ─────────────────────────────────────────────────────────────────────────────
# [2] Add Helm repos
# ─────────────────────────────────────────────────────────────────────────────
echo "[2/5] Tambah Helm repos..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update 2>/dev/null || true
helm repo add grafana https://grafana.github.io/helm-charts --force-update 2>/dev/null || true
helm repo update prometheus-community grafana
echo "   ✅ repos updated"

# ─────────────────────────────────────────────────────────────────────────────
# [3] Install / Upgrade Prometheus
# ─────────────────────────────────────────────────────────────────────────────
echo "[3/5] Install/Upgrade Prometheus..."
if helm status prometheus -n monitoring &>/dev/null; then
  echo "   ♻️  Upgrade Prometheus..."
  helm upgrade prometheus prometheus-community/prometheus \
    -n monitoring \
    -f "$ROOT/k8s/prometheus/prometheus-values.yaml" \
    --wait --timeout 5m
else
  echo "   🔧 Install Prometheus..."
  helm install prometheus prometheus-community/prometheus \
    -n monitoring \
    -f "$ROOT/k8s/prometheus/prometheus-values.yaml" \
    --wait --timeout 5m
fi
echo "   ✅ Prometheus running"

# ─────────────────────────────────────────────────────────────────────────────
# [4] Install / Upgrade Loki Stack (Loki + Promtail)
# ─────────────────────────────────────────────────────────────────────────────
echo "[4/5] Install/Upgrade Loki Stack..."
if helm status loki -n monitoring &>/dev/null; then
  echo "   ♻️  Upgrade Loki..."
  helm upgrade loki grafana/loki-stack \
    -n monitoring \
    -f "$ROOT/k8s/loki/loki-values.yaml" \
    --wait --timeout 5m
else
  echo "   🔧 Install Loki + Promtail..."
  helm install loki grafana/loki-stack \
    -n monitoring \
    -f "$ROOT/k8s/loki/loki-values.yaml" \
    --wait --timeout 5m
fi
echo "   ✅ Loki + Promtail running"

# ─────────────────────────────────────────────────────────────────────────────
# [5] Upgrade Grafana with new datasources (Prometheus + Loki + ClickHouse)
# ─────────────────────────────────────────────────────────────────────────────
echo "[5/5] Upgrade Grafana dengan datasources baru..."

# Patch domain in grafana-values.yaml
GRAFANA_VALUES=$(mktemp /tmp/grafana-values-XXXXXX.yaml)
sed "s/SPLP_DOMAIN/${BASE_DOMAIN}/g" "$ROOT/k8s/grafana/grafana-values.yaml" > "$GRAFANA_VALUES"

if helm status grafana -n monitoring &>/dev/null; then
  helm upgrade grafana grafana/grafana \
    -n monitoring \
    -f "$GRAFANA_VALUES" \
    --wait --timeout 5m
  echo "   ✅ Grafana upgraded"
else
  helm install grafana grafana/grafana \
    -n monitoring \
    -f "$GRAFANA_VALUES" \
    --wait --timeout 5m
  echo "   ✅ Grafana installed"
fi
rm -f "$GRAFANA_VALUES"

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "================================================================="
echo " ✅ Observability Stack Deployed"
echo "================================================================="
echo ""
echo " Komponen:"
kubectl get pods -n monitoring -l "app in (prometheus,loki,promtail)" \
  --no-headers -o custom-columns="  POD:.metadata.name,STATUS:.status.phase" 2>/dev/null || \
kubectl get pods -n monitoring --no-headers 2>/dev/null | awk '{print "  "$1"\t"$3}'
echo ""
echo " Datasources di Grafana:"
echo "   • ClickHouse  → http://clickhouse.splp.svc.cluster.local:8123"
echo "   • Prometheus  → http://prometheus-server.monitoring.svc.cluster.local:80"
echo "   • Loki        → http://loki.monitoring.svc.cluster.local:3100"
echo ""
echo " Grafana URL: https://grafana.${BASE_DOMAIN}"
echo "   Dashboards: Node Exporter Full, K8s Cluster Overview, Loki Logs"
echo "================================================================="
