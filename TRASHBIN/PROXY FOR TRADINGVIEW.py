import http.server
import socketserver
import requests

print('REPLACE LOCALHOST 8080 in index WITH \n    http://localhost:8888')

PROXY_PORT = 8888
TARGET_HOST = "127.0.0.1"
TARGET_PORT = 8080
MAX_RETRIES = 10

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.forward_request("GET")

    def do_POST(self):
        self.forward_request("POST")

    def forward_request(self, method):
        url = f"http://{TARGET_HOST}:{TARGET_PORT}{self.path}"
        headers = self.filter_headers()
        data = None

        if method == "POST":
            content_length = int(self.headers.get('Content-Length', 0))
            data = self.rfile.read(content_length)

        resp = None
        for i in range(MAX_RETRIES):
            try:
                if method == "GET":
                    r = requests.get(url, headers=headers, allow_redirects=False)
                else:
                    r = requests.post(url, headers=headers, data=data, allow_redirects=False)

                if r.status_code != 500:
                    resp = r
                    break
                else:
                    print(f"[Retry {i+1}] Received 500 from backend")
            except requests.exceptions.RequestException as e:
                print(f"[Retry {i+1}] Request error: {e}")

        if resp is None:
            print("All retries failed. Dropping request silently.")
            # Do NOT send any response, just return.
            return

        # Forward successful response
        self.send_response(resp.status_code)
        for k, v in resp.headers.items():
            if k.lower() not in ["transfer-encoding", "content-encoding"]:
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(resp.content)

    def filter_headers(self):
        excluded = {"host", "connection", "proxy-connection", "content-length"}
        return {k: v for k, v in self.headers.items() if k.lower() not in excluded}

with socketserver.ThreadingTCPServer(("", PROXY_PORT), ProxyHandler) as httpd:
    print(f"Proxy running on 127.0.0.1:{PROXY_PORT}, forwarding to {TARGET_HOST}:{TARGET_PORT}")
    httpd.serve_forever()
