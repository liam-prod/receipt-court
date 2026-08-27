#!/usr/bin/env python3
"""
da-proxy.py — a CORS shim for the AI District Attorney.

Cursor's API does not send Access-Control-Allow-Origin, so a browser cannot
call it directly from the deployed page. This forwards requests from the
courtroom to Cursor and adds the CORS headers the browser insists on.

Standard library only — no pip install, no dependencies.

    export CURSOR_API_KEY=sk-...
    python3 scripts/da-proxy.py

Then in the app's AI Prosecutor panel set Base URL to http://localhost:8788/v0
(the key field can be left as anything; the proxy injects the real one).
"""
import http.server
import json
import os
import socketserver
import urllib.error
import urllib.request

PORT = int(os.environ.get("DA_PROXY_PORT", "8788"))
UPSTREAM = os.environ.get("CURSOR_API_BASE", "https://api.cursor.com/v0").rstrip("/")
API_KEY = os.environ.get("CURSOR_API_KEY", "")


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        # Strip the /v0 prefix the browser sends; UPSTREAM already carries it.
        path = self.path
        for prefix in ("/v0", "/v1"):
            if path.startswith(prefix):
                path = path[len(prefix):]
                break

        # Prefer the server-side key so the browser never holds a real secret.
        key = API_KEY or (self.headers.get("Authorization", "") or "").replace("Bearer ", "")
        req = urllib.request.Request(
            UPSTREAM + path,
            data=body,
            method="POST",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                payload, status = res.read(), res.status
        except urllib.error.HTTPError as e:
            payload, status = e.read(), e.code
            print(f"  upstream {status}: {payload[:200].decode('utf-8', 'replace')}")
        except Exception as e:
            payload, status = json.dumps({"error": str(e)}).encode(), 502
            print(f"  proxy error: {e}")

        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        print(f"[da-proxy] {fmt % args}")


if __name__ == "__main__":
    if not API_KEY:
        print("! CURSOR_API_KEY is not set — the proxy will forward whatever the browser sends.")
    print(f"District Attorney proxy listening on http://localhost:{PORT}  ->  {UPSTREAM}")
    print(f"Set the app's Base URL to: http://localhost:{PORT}/v0")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        httpd.serve_forever()
