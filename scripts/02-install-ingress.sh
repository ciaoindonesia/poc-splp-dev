#!/usr/bin/env bash
## Install nginx-ingress controller dan apply semua Ingress resources
## Jalankan SETELAH 01-create-cluster.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Install nginx-ingress controller..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx --force-update 2>/dev/null || true
helm repo update ingress-nginx

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=NodePort \
  --set controller.service.nodePorts.http=30080 \
  --set controller.service.nodePorts.https=30443 \
  --set controller.hostPort.enabled=true \
  --set controller.hostPort.ports.http=80 \
  --set controller.hostPort.ports.https=443 \
  --set controller.config.proxy-body-size="50m" \
  --wait --timeout 3m

echo "==> Apply Ingress resources..."
kubectl apply -f "$ROOT_DIR/k8s/ingress/ingress-all.yaml"

echo ""
echo "✅ Ingress siap! Tambahkan ke /etc/hosts:"
echo ""
echo "  127.0.0.1  pocsplp.com"
echo "  127.0.0.1  api.pocsplp.com"
echo "  127.0.0.1  apim.pocsplp.com"
echo "  127.0.0.1  id.pocsplp.com"
echo "  127.0.0.1  grafana.pocsplp.com"
echo "  127.0.0.1  clickhouse.pocsplp.com"
echo "  127.0.0.1  api-backend.pocsplp.com"
echo ""
echo "Akses:"
echo "  🌐 Portal    : http://pocsplp.com"
echo "  📊 Grafana   : http://grafana.pocsplp.com  (admin / splp-grafana-2026)"
echo "  🔌 WSO2 APIM : http://apim.pocsplp.com/carbon  (admin / admin)"
echo "  🔐 WSO2 IS   : http://id.pocsplp.com/console    (admin / admin)"
echo "  🗄️  ClickHouse: http://clickhouse.pocsplp.com"
