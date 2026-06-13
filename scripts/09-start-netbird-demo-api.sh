#!/usr/bin/env bash
# =============================================================================
# Start Simple HTTP Server on NetBird Interface for Demo
# Usage: bash scripts/09-start-netbird-demo-api.sh
# =============================================================================
set -euo pipefail

echo "================================================================="
echo " Start NetBird Demo API Server"
echo "================================================================="

# Get NetBird IP
NETBIRD_IP=$(netbird status | grep "NetBird IP" | awk '{print $3}' | cut -d'/' -f1)

if [ -z "$NETBIRD_IP" ]; then
    echo "❌ Error: NetBird not connected or IP not found"
    echo "   Run: netbird status"
    exit 1
fi

echo "✅ NetBird IP: $NETBIRD_IP"
echo ""

# Create Python script for demo API
DEMO_API_SCRIPT="/tmp/netbird-demo-api.py"
cat > "$DEMO_API_SCRIPT" << 'EOF'
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sys

class DemoHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                "status": "ok",
                "service": "dukcapil-api",
                "via": "netbird-vpn",
                "peer": "splp-server",
                "message": "This API is accessible only via NetBird VPN"
            }
            self.wfile.write(json.dumps(response, indent=2).encode())
        elif self.path == '/dukcapil/v2/verify-nik':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                "status": "success",
                "data": {
                    "nik": "3201234567890001",
                    "nama": "Ahmad Fauzi",
                    "valid": true
                },
                "via": "netbird-vpn"
            }
            self.wfile.write(json.dumps(response, indent=2).encode())
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                "error": "Not Found",
                "available_endpoints": ["/health", "/dukcapil/v2/verify-nik"]
            }
            self.wfile.write(json.dumps(response, indent=2).encode())

    def log_message(self, format, *args):
        # Suppress default logging
        pass

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', required=True, help='Host IP to bind to')
    parser.add_argument('--port', type=int, default=8080, help='Port to listen on')
    args = parser.parse_args()
    
    server = HTTPServer((args.host, args.port), DemoHandler)
    print(f'✅ Demo API Server running on http://{args.host}:{args.port}')
    print(f'   Endpoints:')
    print(f'   - GET /health')
    print(f'   - GET /dukcapil/v2/verify-nik')
    print(f'   Press Ctrl+C to stop')
    server.serve_forever()
EOF

echo "✅ Demo API script created: $DEMO_API_SCRIPT"
echo ""

# Start server
echo "🚀 Starting demo API server on $NETBIRD_IP:8080..."
echo "   Press Ctrl+C to stop"
echo ""

sudo python3 "$DEMO_API_SCRIPT" --host "$NETBIRD_IP" --port 8080
