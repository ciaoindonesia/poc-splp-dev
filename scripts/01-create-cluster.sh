#!/usr/bin/env bash
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
  -p "80:80@loadbalancer" \
  -p "443:443@loadbalancer" \
  -p "3000:30300@loadbalancer" \
  -p "8081:30801@loadbalancer" \
  -p "8082:30802@loadbalancer" \
  -p "9443:30943@loadbalancer" \
  -p "9444:30944@loadbalancer" \
  -p "8280:30280@loadbalancer" \
  -p "8888:30888@loadbalancer" \
  -p "9090:30909@loadbalancer" \
  --wait

echo "==> Mengatur kubectl context..."
k3d kubeconfig merge "$CLUSTER_NAME" --kubeconfig-merge-default
kubectl config use-context "k3d-$CLUSTER_NAME"

echo "==> Cluster $CLUSTER_NAME siap!"
kubectl get nodes
