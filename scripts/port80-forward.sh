#!/usr/bin/env bash
# Forward port 80 → 8080 (k3d ingress)
# Run with: sudo bash scripts/port80-forward.sh
pkill -f "socat.*:80" 2>/dev/null || true
echo "Starting port 80 → 8080 forward..."
socat TCP4-LISTEN:80,fork,reuseaddr TCP4:127.0.0.1:8080 &
echo "PID: $!"
echo "Domains now accessible without :8080:"
echo "  http://pocsplp.com"
echo "  http://apim.pocsplp.com/publisher/"
echo "  http://grafana.pocsplp.com"
echo "  http://id.pocsplp.com"
