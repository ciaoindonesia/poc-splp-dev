from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import argparse

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
                    "valid": True
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
        # Log to stdout for Docker
        print(f"[{self.log_date_time_string()}] {format % args}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default=os.environ.get('NETBIRD_IP', '0.0.0.0'), help='Host IP to bind to')
    parser.add_argument('--port', type=int, default=8080, help='Port to listen on')
    args = parser.parse_args()
    
    server = HTTPServer((args.host, args.port), DemoHandler)
    print(f'✅ Demo API Server running on http://{args.host}:{args.port}')
    print(f'   Endpoints:')
    print(f'   - GET /health')
    print(f'   - GET /dukcapil/v2/verify-nik')
    print(f'   Press Ctrl+C to stop')
    server.serve_forever()
