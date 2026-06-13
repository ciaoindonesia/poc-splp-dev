#!/usr/bin/env bash
# =============================================================================
# Deploy Kafka via Strimzi Operator + Kafka UI
# Usage: bash scripts/06-deploy-kafka.sh [BASE_DOMAIN]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
BASE_DOMAIN="${1:-$(grep '^BASE_DOMAIN=' "$ROOT/domain.conf" | cut -d= -f2 | tr -d '[:space:]')}"

echo "================================================================="
echo " Deploy Kafka — domain: $BASE_DOMAIN"
echo "================================================================="

# ─────────────────────────────────────────────────────────────────────────────
# [1] Namespace
# ─────────────────────────────────────────────────────────────────────────────
echo "[1/4] Buat namespace messaging..."
kubectl create namespace messaging --dry-run=client -o yaml | kubectl apply -f -
echo "   ✅ namespace messaging"

# ─────────────────────────────────────────────────────────────────────────────
# [2] Install Strimzi Operator
# ─────────────────────────────────────────────────────────────────────────────
echo "[2/4] Install Strimzi Operator..."
helm repo add strimzi https://strimzi.io/charts/ --force-update 2>/dev/null || true
helm repo update strimzi

if helm status strimzi-kafka-operator -n messaging &>/dev/null; then
  echo "   ✅ Strimzi sudah terinstall"
else
  helm upgrade --install strimzi-kafka-operator strimzi/strimzi-kafka-operator \
    --namespace messaging \
    --set watchNamespaces="{messaging}" \
    --wait --timeout 5m
  echo "   ✅ Strimzi operator installed"
fi

echo "   ⏳ Tunggu Strimzi CRDs..."
kubectl wait --for=condition=established crd/kafkas.kafka.strimzi.io --timeout=60s
kubectl wait --for=condition=established crd/kafkanodepools.kafka.strimzi.io --timeout=60s
echo "   ✅ CRDs ready"

# ─────────────────────────────────────────────────────────────────────────────
# [3] Deploy Kafka cluster + Kafka UI
# ─────────────────────────────────────────────────────────────────────────────
echo "[3/4] Deploy Kafka cluster (KRaft mode)..."
kubectl apply -f "$ROOT/k8s/kafka/strimzi-kafka.yaml"
kubectl apply -f "$ROOT/k8s/kafka/kafka-ui.yaml"
echo "   ✅ Kafka cluster + Kafka UI submitted"

echo "   ⏳ Tunggu Kafka ready (~3-5 menit)..."
kubectl wait kafka/splp-kafka -n messaging --for=condition=Ready --timeout=10m \
  || echo "   ⚠  Kafka belum ready, lanjut..."

# ─────────────────────────────────────────────────────────────────────────────
# [4] Update ingress untuk kafka-ui
# ─────────────────────────────────────────────────────────────────────────────
echo "[4/4] Update ingress dengan kafka-ui..."
sed "s/SPLP_DOMAIN/$BASE_DOMAIN/g" \
  "$ROOT/k8s/ingress/ingress-template.yaml" \
  > "$ROOT/k8s/ingress/ingress-all.yaml"
kubectl apply -f "$ROOT/k8s/ingress/ingress-all.yaml"
echo "   ✅ Ingress updated"

echo ""
echo "================================================================="
echo " ✅ Kafka deploy selesai!"
echo ""
echo " Kafka bootstrap : splp-kafka-kafka-bootstrap.messaging:9092"
echo " Kafka UI        : https://kafka-ui.$BASE_DOMAIN"
echo ""
echo " Monitor:"
echo "   kubectl get pods -n messaging"
echo "   kubectl get kafka -n messaging"
echo "================================================================="
