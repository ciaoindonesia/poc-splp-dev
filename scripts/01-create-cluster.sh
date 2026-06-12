#!/usr/bin/env bash
# =============================================================================
# Buat k3d cluster saja (tanpa install komponen).
# Untuk setup lengkap (nginx + WSO2 + portal + backend), gunakan:
#   bash scripts/recreate-cluster.sh
# =============================================================================
set -euo pipefail

CLUSTER_NAME="poc-splp-dev"

echo "==> Memeriksa cluster $CLUSTER_NAME..."
if k3d cluster list | grep -q "$CLUSTER_NAME"; then
  echo "[INFO] Cluster '$CLUSTER_NAME' sudah ada."
  k3d kubeconfig merge "$CLUSTER_NAME" --kubeconfig-merge-default
  kubectl config use-context "k3d-$CLUSTER_NAME"
  exit 0
fi

echo "==> Membuat k3d cluster: $CLUSTER_NAME"
k3d cluster create "$CLUSTER_NAME" \
  --servers 1 \
  --agents 2 \
  --k3s-arg "--disable=traefik@server:0" \
  --port "80:80@loadbalancer" \
  --port "443:443@loadbalancer" \
  --port "3000:30300@server:0" \
  --port "9090:30909@server:0" \
  --port "9443:30943@server:0" \
  --port "9444:30944@server:0" \
  --port "8280:30280@server:0" \
  --port "8888:30888@server:0" \
  --wait

echo "==> Mengatur kubectl context..."
k3d kubeconfig merge "$CLUSTER_NAME" --kubeconfig-merge-default
kubectl config use-context "k3d-$CLUSTER_NAME"

echo "==> Cluster $CLUSTER_NAME siap!"
kubectl get nodes
echo ""
echo "Lanjutkan dengan:"
echo "  bash scripts/recreate-cluster.sh   # setup lengkap (nginx + apps)"
