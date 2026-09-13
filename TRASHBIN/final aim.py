import os
import sys
import json
import time
import logging
import threading
import requests
from urllib3.util import Retry
from requests.adapters import HTTPAdapter
from flask import Flask, request, Response, send_from_directory

# Configure high-performance persistent connection pool (reusable TCP sockets, 0ms handshake overhead)
retry_strategy = Retry(
    total=3,
    connect=3,
    read=False,
    backoff_factor=0.05,
    status_forcelist=[502, 503, 504],
    raise_on_status=False,
)
backend_session = requests.Session()
adapter = HTTPAdapter(
    pool_connections=200,
    pool_maxsize=200,
    max_retries=retry_strategy,
)
backend_session.mount("http://", adapter)
backend_session.mount("https://", adapter)

# Ensure standard output handles UTF-8 safely on Windows platforms
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Configure structured logging with clean tags
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [Proxy] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ProxyServer")

app = Flask(__name__)

# === CONFIGURATION ===
local_root = os.environ.get("LOCAL_ROOT", r"E:\TRADINGVIEW ADVANCED")
backend_base = os.environ.get("BACKEND_URL", "http://127.0.0.1:8080")    # FastAPI MT5 Backend
origin_base = os.environ.get("ORIGIN_URL", "http://127.0.0.1:8081")      # Local static file server
remote_base = os.environ.get("CDN_URL", "https://trading-terminal.tradingview-widget.com") # TV CDN

os.makedirs(local_root, exist_ok=True)

# Lock for thread-safe CDN downloads and file writes
cdn_download_lock = threading.Lock()

# Recognized UDF and Trading API endpoints and prefixes
UDF_API_PREFIXES = (
    "config",
    "symbols",
    "history",
    "time",
    "ticks",
    "search",
    "quotes",
    "marks",
    "timescale_marks",
    "trade",
    "ws",
    "openapi.json",
    "docs",
    "redoc",
)

# Headers to filter out during proxying (hop-by-hop headers)
REQUEST_EXCLUDED_HEADERS = {
    "host",
    "content-length",
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}

RESPONSE_EXCLUDED_HEADERS = {
    "content-encoding",
    "content-length",
    "transfer-encoding",
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "upgrade",
}


def is_udf_api_path(path: str) -> bool:
    """
    Determine whether the incoming request path is a UDF API endpoint or API documentation route.
    Matches paths such as:
      - 'config', '/config'
      - 'symbols', '/symbols', 'symbols?symbol=...'
      - 'history', '/history', 'history?symbol=...&resolution=...'
      - 'time', '/time'
      - 'ticks', '/ticks'
      - 'search', '/search'
      - 'quotes', '/quotes'
      - 'marks', '/marks'
      - 'timescale_marks', '/timescale_marks'
      - 'trade/*', '/trade/order', '/trade/positions', etc.
      - 'api/config', 'api/symbols', 'api/trade/*', etc.
      - Subpaths such as 'config/subpath' or 'docs'
    """
    clean = path.strip("/\\").lower()
    if not clean:
        return False
    parts = [p for p in clean.replace("\\", "/").split("/") if p]
    if not parts:
        return False
    if parts[0] in UDF_API_PREFIXES:
        return True
    if parts[0] == "api" and len(parts) > 1 and parts[1] in UDF_API_PREFIXES:
        return True
    return False


def get_backend_relative_path(path: str) -> str:
    """Extract relative API path, stripping leading 'api/' wrapper if present."""
    clean = path.strip("/\\")
    parts = [p for p in clean.replace("\\", "/").split("/") if p]
    if parts and parts[0].lower() == "api" and len(parts) > 1 and parts[1].lower() in UDF_API_PREFIXES:
        return "/".join(parts[1:])
    return clean


@app.before_request
def handle_preflight():
    """Cleanly handle CORS OPTIONS preflight requests before routing."""
    if request.method == "OPTIONS":
        resp = Response("", status=204)
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH"
        resp.headers["Access-Control-Allow-Headers"] = "*"
        resp.headers["Access-Control-Max-Age"] = "86400"
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp


@app.after_request
def add_cors_and_nocache_headers(response: Response) -> Response:
    """Ensure all responses carry permissive CORS and strict cache-control headers."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint for proxy and upstream services."""
    backend_ok = False
    try:
        r = backend_session.get(f"{backend_base}/time", timeout=2.0)
        backend_ok = (r.status_code == 200)
    except Exception:
        backend_ok = False

    static_ok = False
    try:
        r = requests.get(f"{origin_base}/index.html", timeout=2.0)
        static_ok = (r.status_code == 200)
    except Exception:
        static_ok = False

    status = "healthy" if backend_ok else "degraded"
    return Response(
        json.dumps({
            "status": status,
            "proxy": "healthy",
            "backend_8080": "online" if backend_ok else "offline",
            "static_8081": "online" if static_ok else "offline",
            "timestamp": time.time(),
        }),
        status=200 if backend_ok else 503,
        mimetype="application/json",
    )


def forward_to_backend(path: str) -> Response:
    """
    Forward UDF and Trade API requests directly to the FastAPI backend at port 8080.
    Preserves HTTP method, query parameters, headers, and request body.
    Includes robust error handling, connection retries with exponential backoff, and no-cache headers.
    """
    clean_rel = get_backend_relative_path(path)
    backend_url = f"{backend_base}/{clean_rel}"
    method = request.method
    query_str = request.query_string.decode("utf-8") if request.query_string else None

    logger.info(f"[API ROUTE] {method} {request.path}{'?' + query_str if query_str else ''} -> {backend_url}")

    # Forward headers minus excluded hop-by-hop headers
    forward_headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in REQUEST_EXCLUDED_HEADERS
    }

    body = request.get_data()

    MAX_RETRIES = 3
    INITIAL_BACKOFF = 0.05
    last_err = None
    resp = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = backend_session.request(
                method=method,
                url=backend_url,
                params=query_str,
                headers=forward_headers,
                data=body if body else None,
                timeout=(3.0, 30.0),
                allow_redirects=False,
            )

            # If status code is 502/503/504 and attempt < MAX_RETRIES, retry with backoff
            if r.status_code in (502, 503, 504) and attempt < MAX_RETRIES:
                logger.warning(f"  [API RETRY {attempt}/{MAX_RETRIES}] Backend returned status {r.status_code} for {backend_url}. Retrying in {INITIAL_BACKOFF * attempt:.2f}s...")
                time.sleep(INITIAL_BACKOFF * attempt)
                continue

            resp = r
            break

        except (requests.exceptions.ConnectionError, requests.exceptions.ConnectTimeout) as ce:
            last_err = ce
            if attempt < MAX_RETRIES:
                logger.warning(f"  [API RETRY {attempt}/{MAX_RETRIES}] Connection error to {backend_url}: {ce}. Retrying in {INITIAL_BACKOFF * attempt:.2f}s...")
                time.sleep(INITIAL_BACKOFF * attempt)
                continue
        except requests.exceptions.ReadTimeout as te:
            last_err = te
            # Retry read timeouts only for idempotent HTTP methods
            if method in ("GET", "HEAD", "OPTIONS") and attempt < MAX_RETRIES:
                logger.warning(f"  [API RETRY {attempt}/{MAX_RETRIES}] Read timeout from {backend_url}: {te}. Retrying in {INITIAL_BACKOFF * attempt:.2f}s...")
                time.sleep(INITIAL_BACKOFF * attempt)
                continue
            break
        except Exception as ex:
            last_err = ex
            break

    if resp is not None:
        resp_headers = [
            (name, value) for (name, value) in resp.raw.headers.items()
            if name.lower() not in RESPONSE_EXCLUDED_HEADERS and name.lower() not in ("cache-control", "pragma", "expires")
        ]
        resp_headers.append(("Cache-Control", "no-cache, no-store, must-revalidate"))
        resp_headers.append(("Pragma", "no-cache"))
        resp_headers.append(("Expires", "0"))

        logger.info(f"  [API OK] {backend_url} returned status {resp.status_code}")
        return Response(resp.content, status=resp.status_code, headers=resp_headers)

    # All retries failed - produce informative response
    if isinstance(last_err, requests.exceptions.ReadTimeout):
        logger.error(f"  [API TIMEOUT] FastAPI backend read timed out at {backend_url} after {MAX_RETRIES} attempts: {last_err}")
        return Response(
            json.dumps({"s": "error", "errmsg": f"FastAPI backend read timed out on port 8080: {last_err}"}),
            status=504,
            mimetype="application/json",
        )
    elif isinstance(last_err, (requests.exceptions.ConnectionError, requests.exceptions.ConnectTimeout)):
        logger.error(f"  [API CONN_ERR] FastAPI backend unreachable at {backend_url} after {MAX_RETRIES} attempts: {last_err}")
        return Response(
            json.dumps({"s": "error", "errmsg": f"FastAPI backend connection refused on port 8080: {last_err}"}),
            status=502,
            mimetype="application/json",
        )
    else:
        logger.error(f"  [API ERROR] Unexpected error proxying to {backend_url}: {last_err}")
        return Response(
            json.dumps({"s": "error", "errmsg": f"Proxy forwarding error: {last_err}"}),
            status=500,
            mimetype="application/json",
        )


def fetch_and_cache(path: str) -> Response:
    """
    Try local cache on disk -> remote TradingView CDN -> return file.
    Uses thread-safe locking and atomic file writing to prevent concurrent corruption.
    """
    clean_subpath = path.lstrip("/\\").replace("\\", "/")
    local_path = os.path.abspath(os.path.join(local_root, clean_subpath))

    # Handle directory root / index.html
    if not clean_subpath or os.path.isdir(local_path):
        candidate = os.path.join(local_path, "index.html") if os.path.isdir(local_path) else os.path.join(local_root, "index.html")
        if os.path.isfile(candidate):
            rel = os.path.relpath(candidate, local_root).replace("\\", "/")
            logger.info(f"  [LOCAL DISK] Serving index.html -> {candidate}")
            return send_from_directory(local_root, rel)

    # Check if file exists locally on disk
    if os.path.isfile(local_path):
        logger.info(f"  [LOCAL DISK] Serving file -> {local_path}")
        return send_from_directory(local_root, clean_subpath)

    # If subpath is 'bundles/...', also check 'charting_library/bundles/...'
    if clean_subpath.startswith("bundles/"):
        alt_path = os.path.abspath(os.path.join(local_root, "charting_library", clean_subpath))
        if os.path.isfile(alt_path):
            logger.info(f"  [LOCAL DISK] Serving bundle from charting_library -> {alt_path}")
            return send_from_directory(os.path.join(local_root, "charting_library"), clean_subpath)

    # Missing locally -> fetch from remote TradingView CDN with thread-safe lock
    remote_subpath = "/charting_library/" + clean_subpath if clean_subpath.startswith("bundles/") else ("/" + clean_subpath if not clean_subpath.startswith("/") else clean_subpath)
    remote_url = remote_base + remote_subpath
    with cdn_download_lock:
        if os.path.isfile(local_path):
            return send_from_directory(local_root, clean_subpath)
        if clean_subpath.startswith("bundles/"):
            alt_path = os.path.abspath(os.path.join(local_root, "charting_library", clean_subpath))
            if os.path.isfile(alt_path):
                return send_from_directory(os.path.join(local_root, "charting_library"), clean_subpath)
        try:
            logger.info(f"  [CDN FETCH] Missing locally, fetching from TV CDN: {remote_url}")
            r = requests.get(remote_url, timeout=20)
            r.raise_for_status()

            target_save_path = os.path.abspath(os.path.join(local_root, "charting_library", clean_subpath)) if clean_subpath.startswith("bundles/") else local_path
            os.makedirs(os.path.dirname(target_save_path), exist_ok=True)
            temp_path = target_save_path + f".tmp.{os.getpid()}.{threading.get_ident()}"
            with open(temp_path, "wb") as f:
                f.write(r.content)
            os.replace(temp_path, target_save_path)
            logger.info(f"  [CDN SAVED] Cached to local disk -> {target_save_path}")

            if clean_subpath.startswith("bundles/"):
                return send_from_directory(os.path.join(local_root, "charting_library"), clean_subpath)
            return send_from_directory(local_root, clean_subpath)
        except Exception as e:
            logger.error(f"  [CDN FAILED] Failed to fetch {remote_url}: {e}")
            return Response("Not found", status=404)


def forward_to_static(path: str) -> Response:
    """
    Handle static assets:
    1. Query local static file server (http-server at port 8081).
    2. If missing (404) or server fails/unavailable, fall back to local disk / TradingView CDN.
    """
    clean_path = path.lstrip("/")
    origin_url = f"{origin_base}/{clean_path}"
    query_str = request.query_string.decode("utf-8") if request.query_string else None

    logger.info(f"[STATIC ROUTE] Request: /{clean_path} -> checking {origin_url}")

    try:
        forward_headers = {
            k: v for k, v in request.headers.items()
            if k.lower() not in REQUEST_EXCLUDED_HEADERS
        }
        r = requests.get(
            origin_url,
            params=query_str,
            headers=forward_headers,
            timeout=10,
            allow_redirects=True,
        )
        if r.status_code == 200:
            resp_headers = [
                (name, value) for (name, value) in r.raw.headers.items()
                if name.lower() not in RESPONSE_EXCLUDED_HEADERS and name.lower() not in ("cache-control", "pragma", "expires")
            ]
            resp_headers.append(("Cache-Control", "no-cache, no-store, must-revalidate"))
            resp_headers.append(("Pragma", "no-cache"))
            resp_headers.append(("Expires", "0"))
            logger.info(f"  [STATIC 8081 OK] Served from local static server: {origin_url} (200 OK)")
            return Response(r.content, status=r.status_code, headers=resp_headers)
        else:
            logger.warning(f"  [STATIC 8081 WARN] {origin_url} returned status {r.status_code}, falling back to cache/CDN")
    except Exception as e:
        logger.warning(f"  [STATIC 8081 UNREACHABLE] {origin_url} failed ({e}), falling back to cache/CDN")

    return fetch_and_cache("/" + clean_path)


@app.route("/", defaults={"path": ""}, methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
@app.route("/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
def proxy(path: str):
    """
    Unified reverse proxy router on port 9000:
    - UDF & Trading API endpoints -> FastAPI backend at port 8080.
    - Static file assets -> Local static server at port 8081 with local disk & CDN fallback.
    """
    if is_udf_api_path(path):
        return forward_to_backend(path)
    return forward_to_static(path)


if __name__ == "__main__":
    host = os.environ.get("PROXY_HOST", "127.0.0.1")
    port = int(os.environ.get("PROXY_PORT", 9000))
    debug_mode = os.environ.get("PROXY_DEBUG", "false").lower() in ("true", "1", "yes")

    print(f"Proxy server running at http://{host}:{port}")
    print(f"   |-- API Target:    {backend_base} (FastAPI MT5 backend)")
    print(f"   |-- Static Target: {origin_base} (Local HTTP server)")
    print(f"   +-- Fallback CDN:  {remote_base} (TradingView CDN)")
    app.run(host=host, port=port, debug=debug_mode, threaded=True)
