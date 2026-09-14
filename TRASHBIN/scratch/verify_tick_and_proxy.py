import urllib.request
import json
import time

print("=== 1. Direct Python Backend API (Port 9000) ===")
req_direct = urllib.request.urlopen("http://127.0.0.1:9000/history?symbol=XAUUSD.&resolution=1T&countback=300")
data_direct = json.loads(req_direct.read().decode())
bars_direct = len(data_direct.get("t", []))
print(f"Status: {data_direct.get('s')}, Bars count: {bars_direct}")
if bars_direct > 0:
    t0 = data_direct['t'][0]
    t1 = data_direct['t'][-1]
    span_min = (t1 - t0) / 60
    print(f"Time span: {span_min:.2f} minutes ({span_min/60:.2f} hours)")
    print(f"Earliest bar t: {t0}, Latest bar t: {t1}")
    mono = all(data_direct['t'][i] < data_direct['t'][i+1] for i in range(bars_direct - 1))
    print(f"Strict Monotonicity: {mono}")

print("\n=== 2. Node.js Reverse Proxy (Port 8080) ===")
req_proxy = urllib.request.urlopen("http://127.0.0.1:8080/history?symbol=XAUUSD.&resolution=1T&countback=300")
data_proxy = json.loads(req_proxy.read().decode())
bars_proxy = len(data_proxy.get("t", []))
print(f"Status: {data_proxy.get('s')}, Bars count: {bars_proxy}")
if bars_proxy > 0:
    t0 = data_proxy['t'][0]
    t1 = data_proxy['t'][-1]
    span_min = (t1 - t0) / 60
    print(f"Time span: {span_min:.2f} minutes ({span_min/60:.2f} hours)")
    mono = all(data_proxy['t'][i] < data_proxy['t'][i+1] for i in range(bars_proxy - 1))
    print(f"Strict Monotonicity: {mono}")

print("\n=== 3. Static Assets via Node (Port 8080) ===")
req_html = urllib.request.urlopen("http://127.0.0.1:8080/index.html")
html_len = len(req_html.read())
print(f"HTML bytes received: {html_len}, Content-Type: {req_html.headers.get('Content-Type')}")

req_config = urllib.request.urlopen("http://127.0.0.1:8080/config")
config_data = json.loads(req_config.read().decode())
print(f"Proxy /config received: {config_data.keys()}")
