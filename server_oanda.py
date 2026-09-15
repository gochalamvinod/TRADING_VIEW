"""
OANDA v20 REST API Backend — FastAPI UDF Server for TradingView Advanced Charts.

Completely separate from the MT5 server (server.py).
Zero MT5 imports — no MetaTrader5, no hft_engine, no broker_time, no mt5_bridge.
Time sync: Always returns pure UTC (time.time()) — OANDA v20 is always UTC, offset = 0.
"""

import os
import sys
import json
import time
import logging
import asyncio
import ctypes
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Union, Any, Optional, Tuple

import httpx
import orjson
from fastapi import FastAPI, Query, HTTPException, Request, Body, WebSocket, WebSocketDisconnect
from fastapi.responses import Response, PlainTextResponse, FileResponse
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

# ──────────────────────────────────────────────────────────────────────────────
# OANDA Engine (only import — zero MT5 dependency)
# ──────────────────────────────────────────────────────────────────────────────
import oanda_engine

BROKER_BACKEND = "OANDA"
PRICE_TYPE = os.environ.get("PRICE_TYPE", "MID").strip().upper()
if PRICE_TYPE not in ("MID", "BID", "ASK"):
    PRICE_TYPE = "MID"

print(f"[SERVER_OANDA] OANDA v20 Backend | Account: {oanda_engine.OANDA_ACCOUNT_ID} | Price: {PRICE_TYPE}")

# ──────────────────────────────────────────────────────────────────────────────
# Fast JSON serialization
# ──────────────────────────────────────────────────────────────────────────────
def fast_json_dumps(obj: Any) -> bytes:
    return orjson.dumps(obj, option=orjson.OPT_SERIALIZE_NUMPY)


# ──────────────────────────────────────────────────────────────────────────────
# Supported resolutions — all OANDA-native granularities supported
# ──────────────────────────────────────────────────────────────────────────────
SUPPORTED_RESOLUTIONS: List[str] = [
    "1T", "5T", "10T", "15T", "20T", "25T", "30T", "40T", "50T", "60T", "100T", "200T", "500T",
    "1S", "5S", "10S", "15S", "30S",
    "1", "2", "3", "5", "10", "15", "20", "30", "45", "60", "120", "180", "240",
    "1D", "1W", "1M", "3M", "6M", "12M"
]

LOCAL_ROOT = os.environ.get("LOCAL_ROOT", os.path.abspath(os.path.dirname(__file__)))
REMOTE_CDN_BASE = os.environ.get("CDN_URL", "https://trading-terminal.tradingview-widget.com")
UDF_API_PREFIXES = {
    "config", "symbols", "history", "time", "ticks", "search",
    "quotes", "marks", "timescale_marks", "trade", "ws", "health",
    "openapi.json", "docs", "redoc", "pine", "pine-converter", "indicators"
}

logger = logging.getLogger("OandaServer")
cdn_download_lock = asyncio.Lock()
cdn_http_client: Optional[httpx.AsyncClient] = None
_server_start_time = time.time()
_mm_timer_active: bool = False

# ─── Ultra-High-Precision UTC Timer (Sub-Microsecond Windows Kernel QPC) ────
# Queries GetSystemTimePreciseAsFileTime on Windows (100ns precision, 0.0001 ms).
# Zero drift, zero 15.6ms step, perfectly synchronized with true hardware UTC clock.
try:
    class _FILETIME(ctypes.Structure):
        _fields_ = [('dwLowDateTime', ctypes.c_uint32), ('dwHighDateTime', ctypes.c_uint32)]
    _kernel32 = ctypes.windll.kernel32
    _GetSystemTimePrecise = _kernel32.GetSystemTimePreciseAsFileTime
    _GetSystemTimePrecise.argtypes = [ctypes.c_void_p]
    _GetSystemTimePrecise.restype = None
    _ft_buf = _FILETIME()
    _byref_buf = ctypes.byref(_ft_buf)

    def get_precise_utc() -> float:
        _GetSystemTimePrecise(_byref_buf)
        return (((_ft_buf.dwHighDateTime << 32) | _ft_buf.dwLowDateTime) - 116444736000000000) / 10000000.0
except Exception:
    def get_precise_utc() -> float:
        return time.time_ns() / 1_000_000_000.0


# ──────────────────────────────────────────────────────────────────────────────
# Lifespan: OANDA init only — no MT5
# ──────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global cdn_http_client, _server_start_time, _mm_timer_active
    _server_start_time = time.time()

    if sys.platform == "win32":
        try:
            res = ctypes.windll.winmm.timeBeginPeriod(1)
            _mm_timer_active = (res == 0)
        except Exception:
            _mm_timer_active = False

    cdn_http_client = httpx.AsyncClient(timeout=20.0, follow_redirects=True)

    print(f"[OANDA] Initializing OANDA v20 REST Engine (Account: {oanda_engine.OANDA_ACCOUNT_ID})...")
    oanda_engine.init_instruments()
    print(f"[OANDA] Ready. {len(oanda_engine._instruments_cache)} instrument mappings loaded.")

    yield

    if cdn_http_client:
        await cdn_http_client.aclose()

    if sys.platform == "win32":
        try:
            ctypes.windll.winmm.timeEndPeriod(1)
        except Exception:
            pass

    print("[OANDA] Session terminated cleanly.")


# ──────────────────────────────────────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="OANDA v20 UDF Data Feed",
    description="High-performance OANDA REST API backend implementing TradingView UDF protocol.",
    version="2.0.0",
    lifespan=lifespan,
)


class PureASGIMiddleware:
    """Zero-overhead ASGI middleware: CORS, path rewrite, cache-control headers."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            method = scope.get("method", "GET")

            if method == "OPTIONS":
                await send({"type": "http.response.start", "status": 204, "headers": [
                    (b"access-control-allow-origin", b"*"),
                    (b"access-control-allow-methods", b"GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH"),
                    (b"access-control-allow-headers", b"*"),
                    (b"access-control-max-age", b"86400"),
                    (b"content-length", b"0"),
                ]})
                await send({"type": "http.response.body", "body": b""})
                return

            if path.startswith("/api/"):
                parts = path.strip("/").split("/")
                if len(parts) > 1 and parts[1].lower() in UDF_API_PREFIXES:
                    new_path = "/" + "/".join(parts[1:])
                    scope["path"] = new_path
                    if scope.get("raw_path") is not None:
                        scope["raw_path"] = new_path.encode("ascii")

            async def send_wrapper(message):
                if message["type"] == "http.response.start":
                    override_keys = {
                        b"access-control-allow-origin", b"access-control-allow-methods",
                        b"access-control-allow-headers", b"cache-control", b"pragma", b"expires",
                        b"x-content-type-options", b"x-frame-options",
                    }
                    p_lower = path.lower()
                    is_vendor_asset = (
                        p_lower.startswith("/charting_library/bundles")
                        or any(p_lower.endswith(ext) for ext in (".woff2", ".woff", ".ico"))
                    )
                    headers = [(k, v) for (k, v) in message.get("headers", []) if k.lower() not in override_keys]
                    headers.extend([
                        (b"access-control-allow-origin", b"*"),
                        (b"access-control-allow-methods", b"GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH"),
                        (b"access-control-allow-headers", b"*"),
                        (b"x-content-type-options", b"nosniff"),
                        (b"x-frame-options", b"SAMEORIGIN"),
                    ])
                    if is_vendor_asset:
                        headers.append((b"cache-control", b"public, max-age=86400, stale-while-revalidate=3600"))
                    else:
                        headers.extend([
                            (b"cache-control", b"no-cache, no-store, must-revalidate, max-age=0"),
                            (b"pragma", b"no-cache"),
                            (b"expires", b"0"),
                        ])
                    message["headers"] = headers
                await send(message)

            await self.app(scope, receive, send_wrapper)
            return

        await self.app(scope, receive, send)


app.add_middleware(GZipMiddleware, minimum_size=100000)
app.add_middleware(PureASGIMiddleware)


# ──────────────────────────────────────────────────────────────────────────────
# UDF Core Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/robots.txt")
async def robots_txt() -> PlainTextResponse:
    return PlainTextResponse("User-agent: *\nAllow: /\n", media_type="text/plain")


@app.get("/health")
async def health_check() -> Response:
    """OANDA health check — tests REST API connectivity."""
    now = time.time()
    oanda_ok = True
    try:
        acc = oanda_engine.get_account_summary()
        oanda_ok = bool(acc and acc.get("balance", 0) >= 0)
    except Exception:
        oanda_ok = False

    payload = {
        "status": "healthy" if oanda_ok else "degraded",
        "uptime": round(now - _server_start_time, 2),
        "broker_backend": "OANDA",
        "oanda": "connected" if oanda_ok else "disconnected",
        "broker_status": "connected" if oanda_ok else "disconnected",
        "mt5": "disabled",
        "hft_engine": "disabled",
        "mm_timer_1ms": _mm_timer_active,
        "timestamp": now,
    }
    return Response(content=orjson.dumps(payload), media_type="application/json")


@app.get("/config")
async def get_config() -> Response:
    """TradingView UDF configuration for OANDA."""
    cfg = {
        "supports_search": True,
        "supports_group_request": False,
        "supports_marks": False,
        "supports_timescale_marks": False,
        "supports_time": True,
        "supports_quotes": True,
        "supported_resolutions": SUPPORTED_RESOLUTIONS,
        "has_seconds": True,
        "build_seconds_from_ticks": True,
        "seconds_multipliers": ["1", "5", "10", "15", "30"],
        "has_ticks": True,
        "is-tickbars-available": True,
        "is_tickbars_available": True,
        "tick_multipliers": ["1", "5", "10", "15", "20", "25", "30", "40", "50", "60", "100", "200", "500"],
        "ticks_multipliers": ["1", "5", "10", "15", "20", "25", "30", "40", "50", "60", "100", "200", "500"],
        "has_intraday": True,
        "intraday_multipliers": ["1", "2", "3", "5", "10", "15", "30", "60", "120", "240"],
        "has_daily": True,
        "daily_multipliers": ["1"],
        "has_weekly_and_monthly": True,
        "weekly_multipliers": ["1"],
        "monthly_multipliers": ["1", "3", "6", "12"],
        "broker_backend": "OANDA",
        "price_type": PRICE_TYPE,
    }
    return Response(content=orjson.dumps(cfg), media_type="application/json")


@app.get("/time")
async def get_current_time(
    request: Request,
    format: Optional[str] = Query(None, description="'json', 'float', or 'int'")
) -> Response:
    """
    Return high-resolution pure UTC server time for TradingView timescale alignment.
    
    CRITICAL: Returns ONLY pure UTC unix seconds — ZERO broker timezone offset.
    OANDA v20 is always UTC. The frontend ServerTimeSyncEngine (Cristian's Algorithm)
    expects raw UTC. Adding ANY offset would make TV think the server is hours ahead
    → infinite "future bars" requests → OANDA 400 errors → cascade time errors.
    
    Uses kernel32.GetSystemTimePreciseAsFileTime for 100-nanosecond hardware UTC precision.
    Windows time.time() has 15.6ms granularity — get_precise_utc() is sub-microsecond.
    """
    now_utc = get_precise_utc()

    accept_hdr = request.headers.get("accept", "").lower()
    is_json = (format == "json") or (
        format is None and "application/json" in accept_hdr
        and "*/*" not in accept_hdr and "text/html" not in accept_hdr
    )
    if is_json:
        payload = {
            "time": now_utc,
            "broker_time_msc": int(now_utc * 1000),
            "broker_offset_sec": 0,
            "precision": "microsecond"
        }
        return Response(content=orjson.dumps(payload), media_type="application/json",
                        headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

    if format == "int":
        return Response(content=str(int(now_utc)).encode("ascii"), media_type="application/json",
                        headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

    # Default UDF: microsecond float ASCII string (pure UTC, zero offset)
    return Response(content=f"{now_utc:.6f}".encode("ascii"), media_type="application/json",
                    headers={"Cache-Control": "no-cache, no-store, must-revalidate"})


@app.get("/symbols")
def get_symbols(symbol: str = Query(...)) -> Dict[str, Any]:
    """Return TradingView symbol metadata for an OANDA instrument."""
    meta = oanda_engine.get_symbol_info(symbol)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found in OANDA.")
    return meta


@app.get("/history")
def get_history(
    symbol: str = Query(...),
    resolution: str = Query(...),
    _from: Optional[float] = Query(None, alias="from"),
    to: Optional[float] = Query(None),
    countback: Optional[int] = Query(None),
) -> Response:
    """Return OHLC bars from OANDA v20 API for any resolution."""
    hist = oanda_engine.get_history(symbol, resolution, _from, to, countback)
    return Response(content=orjson.dumps(hist), media_type="application/json")


@app.get("/quotes")
async def get_quotes(
    symbols: str = Query(..., description="Comma-separated symbols, e.g. EURUSD,XAUUSD")
) -> Response:
    """Return real-time OANDA pricing quotes for given symbols."""
    sym_list = [s.strip() for s in symbols.split(",") if s.strip()]
    quotes = oanda_engine.get_quotes(sym_list)
    return Response(content=orjson.dumps({"s": "ok", "d": quotes}), media_type="application/json")


@app.get("/search")
def search_symbols(
    query: str = Query(""),
    _type: Optional[str] = Query(None, alias="type"),
    exchange: Optional[str] = Query(None),
    limit: int = Query(30),
) -> List[Dict[str, Any]]:
    """Search OANDA instruments by query string."""
    return oanda_engine.search_symbols(query, limit)


@app.get("/ticks")
def get_ticks(
    symbol: str = Query(...),
    ticks_per_bar: int = Query(40),
    side: str = Query(PRICE_TYPE.lower()),
    days: int = Query(2),
) -> Dict[str, Any]:
    """Return tick-style bars for OANDA via S5 granularity candles."""
    h = oanda_engine.get_history(symbol, "5S", countback=500)
    t_arr = h.get("t", [])
    return {
        "s": "ok",
        "symbol": symbol,
        "ticks_per_bar": ticks_per_bar,
        "side": side,
        "bars": len(t_arr),
        "data": [
            {
                "time": t_arr[i], "open": h["o"][i], "high": h["h"][i],
                "low": h["l"][i], "close": h["c"][i], "volume": h["v"][i],
                "ticks": ticks_per_bar
            }
            for i in range(len(t_arr))
        ]
    }


@app.get("/marks")
def get_marks(symbol: str = Query(...), _from: int = Query(..., alias="from"),
              to: int = Query(...), resolution: str = Query(...)) -> List:
    return []


@app.get("/timescale_marks")
def get_timescale_marks(symbol: str = Query(...), _from: int = Query(..., alias="from"),
                        to: int = Query(...), resolution: str = Query(...)) -> List:
    return []


# ──────────────────────────────────────────────────────────────────────────────
# Trade API Request Models
# ──────────────────────────────────────────────────────────────────────────────

class MarketOrderRequest(BaseModel):
    symbol: str
    action: Optional[str] = "BUY"
    side: Optional[str] = None
    order_type: Optional[Union[str, int]] = None
    volume: float
    price: Optional[float] = None
    sl: Optional[float] = None
    tp: Optional[float] = None
    deviation: Optional[int] = 20
    comment: Optional[str] = "TradingView OANDA"
    magic: Optional[int] = 234000
    type_filling: Optional[Union[str, int]] = None


class PendingOrderRequest(BaseModel):
    symbol: str
    type: Optional[Union[str, int]] = "BUY_LIMIT"
    order_type: Optional[Union[str, int]] = None
    price: float
    stoplimit: Optional[float] = None
    volume: float
    sl: Optional[float] = None
    tp: Optional[float] = None
    expiration: Optional[Union[int, float]] = 0
    deviation: Optional[int] = 20
    comment: Optional[str] = "TV Pending"
    magic: Optional[int] = 234000
    type_filling: Optional[Union[str, int]] = None


class ModifyOrderRequest(BaseModel):
    ticket: Any
    sl: Optional[float] = None
    tp: Optional[float] = None
    price: Optional[float] = None
    stoplimit: Optional[float] = None
    expiration: Optional[Union[int, float]] = None
    symbol: Optional[str] = None


class CloseOrderRequest(BaseModel):
    ticket: Any
    volume: Optional[float] = None
    price: Optional[float] = None
    deviation: Optional[int] = 20
    comment: Optional[str] = None


class CloseAllRequest(BaseModel):
    symbol: Optional[str] = None
    cancel_pending: Optional[bool] = False
    deviation: Optional[int] = 20
    comment: Optional[str] = "Close all positions"


# ──────────────────────────────────────────────────────────────────────────────
# Trade Endpoints — All delegate directly to oanda_engine.*
# ──────────────────────────────────────────────────────────────────────────────

def _oanda_trade_response(res: Dict[str, Any], volume: float = 0.0,
                           price: float = 0.0, symbol: str = "", action: str = "") -> Response:
    """Build a standardised TradingView trade response from an oanda_engine result dict."""
    is_success = res.get("retcode") == 10009
    resp = {
        "success": is_success,
        "retcode": res.get("retcode", 10015),
        "retcode_name": "TRADE_RETCODE_DONE" if is_success else "TRADE_RETCODE_ERROR",
        "retcode_description": res.get("comment", res.get("error", "")),
        "order": res.get("order", res.get("ticket", 0)),
        "ticket": res.get("order", res.get("ticket", 0)),
        "deal": res.get("deal", 0),
        "volume": volume,
        "price": res.get("price", price),
        "comment": res.get("comment", ""),
        "symbol": symbol,
        "action": action,
    }
    if not is_success:
        resp["error"] = res.get("error", "Order rejected")
    return Response(content=orjson.dumps(resp, default=str), media_type="application/json")


@app.post("/trade/order")
async def execute_market_order(req: MarketOrderRequest) -> Response:
    """Execute a market BUY or SELL order on OANDA."""
    action_val = str(
        req.order_type if req.order_type is not None
        else (req.side if req.side is not None else req.action)
    ).upper().strip()
    res = oanda_engine.execute_order(
        symbol=req.symbol,
        action=action_val,
        volume=float(req.volume),
        price=float(req.price) if req.price else None,
        sl=float(req.sl) if req.sl else None,
        tp=float(req.tp) if req.tp else None,
        order_type="MARKET"
    )
    return _oanda_trade_response(res, req.volume, 0.0, req.symbol, action_val)


@app.post("/trade/pending")
@app.post("/trade/pending_order")
async def place_pending_order(req: PendingOrderRequest) -> Response:
    """Place a pending LIMIT or STOP order on OANDA."""
    raw_type = str(req.order_type if req.order_type is not None else req.type).upper().strip()
    action_val = "BUY" if "BUY" in raw_type else "SELL"
    res = oanda_engine.execute_order(
        symbol=req.symbol,
        action=action_val,
        volume=float(req.volume),
        price=float(req.price) if req.price else None,
        sl=float(req.sl) if req.sl else None,
        tp=float(req.tp) if req.tp else None,
        order_type=raw_type
    )
    return _oanda_trade_response(res, req.volume, float(req.price) if req.price else 0.0,
                                 req.symbol, action_val)


@app.post("/trade/modify")
@app.post("/trade/modify_position")
@app.post("/trade/modify_order")
async def modify_trade(req: ModifyOrderRequest) -> Response:
    """Modify SL/TP or price of an OANDA open trade or pending order."""
    target_ticket = None
    if isinstance(req.ticket, int):
        target_ticket = req.ticket
    elif isinstance(req.ticket, str):
        cleaned = req.ticket.replace("_sl", "").replace("_tp", "").strip()
        if cleaned.isdigit():
            target_ticket = int(cleaned)
    if target_ticket is None and req.symbol:
        open_pos = oanda_engine.get_open_positions(req.symbol)
        if open_pos:
            target_ticket = open_pos[0]["ticket"]
    if target_ticket is None:
        raise HTTPException(status_code=400, detail="Invalid or missing ticket for modification")

    res = oanda_engine.modify_trade_or_order(
        ticket=target_ticket,
        sl=float(req.sl) if req.sl is not None else None,
        tp=float(req.tp) if req.tp is not None else None,
        price=float(req.price) if req.price is not None else None
    )
    is_success = res.get("retcode") == 10009
    # When OANDA replaces a pending order it issues a new ticket ID
    new_ticket = res.get("ticket", target_ticket)
    return Response(content=orjson.dumps({
        "success": is_success,
        "retcode": res.get("retcode", 10009 if is_success else 10015),
        "ticket": new_ticket,
        "comment": res.get("comment", res.get("error", ""))
    }), media_type="application/json")


@app.post("/trade/close")
@app.post("/trade/close_position")
@app.post("/trade/cancel_order")
async def close_trade_position(req: CloseOrderRequest) -> Response:
    """Close an open position or cancel a pending order on OANDA."""
    target_ticket = None
    if isinstance(req.ticket, int):
        target_ticket = req.ticket
    elif isinstance(req.ticket, str):
        cleaned = req.ticket.replace("_sl", "").replace("_tp", "").strip()
        if cleaned.isdigit():
            target_ticket = int(cleaned)
    if target_ticket is None:
        try:
            target_ticket = int(req.ticket)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid ticket '{req.ticket}'")

    res = oanda_engine.close_trade_or_order(target_ticket)
    is_success = res.get("retcode") == 10009
    resp = {
        "success": is_success,
        "retcode": res.get("retcode", 10009),
        "ticket": target_ticket,
        "comment": res.get("comment", res.get("error", ""))
    }
    if not is_success:
        resp["error"] = res.get("error", "Failed to close on OANDA")
    return Response(content=orjson.dumps(resp, default=str), media_type="application/json")


@app.post("/trade/close_all")
async def close_all_positions(req: Optional[CloseAllRequest] = None) -> Response:
    """Close all active OANDA positions (optionally filtered by symbol)."""
    sym_filter = req.symbol if req else None
    open_pos = oanda_engine.get_open_positions(sym_filter)
    closed_count = 0
    for p in open_pos:
        oanda_engine.close_trade_or_order(p["ticket"])
        closed_count += 1
    return Response(content=orjson.dumps({"success": True, "closed_positions": closed_count}),
                    media_type="application/json")


@app.get("/trade/positions")
def get_open_positions(
    symbol: Optional[str] = Query(None),
    ticket: Optional[int] = Query(None)
) -> List[Dict[str, Any]]:
    """Return all open OANDA positions."""
    return oanda_engine.get_open_positions(symbol, ticket)


@app.get("/trade/orders")
def get_pending_orders(
    symbol: Optional[str] = Query(None),
    ticket: Optional[int] = Query(None)
) -> List[Dict[str, Any]]:
    """Return all pending OANDA orders."""
    return oanda_engine.get_pending_orders(symbol, ticket)


@app.get("/trade/account")
def get_account_summary() -> Dict[str, Any]:
    """Return OANDA account summary (balance, equity, margin, leverage)."""
    return oanda_engine.get_account_summary()


@app.get("/trade/history")
def get_trade_history(
    days: int = Query(7),
    _from: Optional[float] = Query(None, alias="from"),
    to: Optional[float] = Query(None),
    symbol: Optional[str] = Query(None),
    ticket: Optional[int] = Query(None),
    position: Optional[int] = Query(None),
    type: Optional[str] = Query("all"),
    all_entries: Optional[bool] = Query(True),
    limit: Optional[int] = Query(500),
) -> Dict[str, Any]:
    """Return OANDA trade and order history."""
    return oanda_engine.get_trade_history(days=days)


# ──────────────────────────────────────────────────────────────────────────────
# Indicators (Python-only, no Julia required for OANDA)
# ──────────────────────────────────────────────────────────────────────────────
import indicators_engine

@app.get("/indicators/list")
@app.get("/api/indicators/list")
async def list_available_indicators() -> Response:
    catalog = [
        {"id": "SMA", "name": "Simple Moving Average", "overlay": True, "params": {"length": 14}},
        {"id": "EMA", "name": "Exponential Moving Average", "overlay": True, "params": {"length": 14}},
        {"id": "WMA", "name": "Weighted Moving Average", "overlay": True, "params": {"length": 14}},
        {"id": "HMA", "name": "Hull Moving Average", "overlay": True, "params": {"length": 14}},
        {"id": "DEMA", "name": "Double EMA", "overlay": True, "params": {"length": 14}},
        {"id": "TEMA", "name": "Triple EMA", "overlay": True, "params": {"length": 14}},
        {"id": "RSI", "name": "Relative Strength Index", "overlay": False, "params": {"length": 14}},
        {"id": "MACD", "name": "MACD", "overlay": False, "params": {"fast": 12, "slow": 26, "signal": 9}},
        {"id": "BB", "name": "Bollinger Bands", "overlay": True, "params": {"length": 20, "mult": 2.0}},
        {"id": "ATR", "name": "Average True Range", "overlay": False, "params": {"length": 14}},
        {"id": "SUPERTREND", "name": "Supertrend", "overlay": True, "params": {"length": 10, "mult": 3.0}},
        {"id": "STOCH", "name": "Stochastic Oscillator", "overlay": False, "params": {"k_len": 14, "k_smooth": 3, "d_len": 3}},
        {"id": "CCI", "name": "Commodity Channel Index", "overlay": False, "params": {"length": 20}},
        {"id": "ADX", "name": "ADX / DMI", "overlay": False, "params": {"length": 14}},
    ]
    return Response(
        content=orjson.dumps({"status": "ok", "count": len(catalog), "indicators": catalog}),
        media_type="application/json",
        headers={"Cache-Control": "public, max-age=3600"}
    )


@app.api_route("/indicators/compute", methods=["GET", "POST"])
@app.api_route("/api/indicators/compute", methods=["GET", "POST"])
async def compute_server_indicator(
    symbol: str = Query("EURUSD"),
    resolution: str = Query("1"),
    indicator: str = Query("SMA"),
    params: Optional[str] = Query(None),
    bars: int = Query(1000),
    to: Optional[int] = Query(None),
    engine: str = Query("auto"),
    request: Request = None
) -> Response:
    """Compute a server-side indicator from OANDA candle data."""
    param_dict = {}
    if params:
        try:
            param_dict = json.loads(params)
        except Exception:
            pass
    if request and request.method == "POST":
        try:
            body = await request.json()
            if isinstance(body, dict):
                param_dict.update(body.get("params", {}))
                symbol = body.get("symbol", symbol)
                resolution = body.get("resolution", resolution)
                indicator = body.get("indicator", indicator)
                bars = body.get("bars", bars)
                to = body.get("to", to)
        except Exception:
            pass

    safe_count = min(10000, max(50, bars))
    hist = oanda_engine.get_history(symbol, resolution, countback=safe_count)
    if not hist.get("t"):
        return Response(content=orjson.dumps({"s": "no_data", "detail": f"No rates for {symbol}"}),
                        media_type="application/json")

    import cudf
    t0 = time.perf_counter()
    rates = cudf.DataFrame({
        "time": hist["t"],
        "open": hist["o"],
        "high": hist["h"],
        "low": hist["l"],
        "close": hist["c"],
        "tick_volume": hist["v"]
    })

    result = indicators_engine.compute_indicator(indicator, rates, param_dict)
    dt_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    result["status"] = "ok"
    result["symbol"] = symbol
    result["resolution"] = resolution
    result["compute_time_ms"] = dt_ms

    return Response(content=orjson.dumps(result), media_type="application/json",
                    headers={"Cache-Control": "public, max-age=5"})


# ──────────────────────────────────────────────────────────────────────────────
# PineTS Transpiler (same as MT5 server — no MT5 dependency)
# ──────────────────────────────────────────────────────────────────────────────
PINE_EXAMPLES_DIR = os.path.join(LOCAL_ROOT, "pine_examples")
PINE_CATALOG_FILE = os.path.join(LOCAL_ROOT, "pine_indicators_catalog.json")
PINE_CJS_FILE = os.path.join(LOCAL_ROOT, "PineTS-main", "dist", "pinets.min.cjs")
if not os.path.isfile(PINE_CJS_FILE):
    PINE_CJS_FILE = os.path.join(LOCAL_ROOT, "pinets.min.cjs")


@app.get("/pine/catalog")
@app.get("/pine/indicators/catalog")
async def get_pine_catalog() -> Response:
    if os.path.isfile(PINE_CATALOG_FILE):
        try:
            with open(PINE_CATALOG_FILE, "r", encoding="utf-8") as f:
                return Response(content=f.read(), media_type="application/json")
        except Exception:
            pass
    return Response(content=orjson.dumps([]), media_type="application/json")


class PineTranspileRequest(BaseModel):
    source: str


@app.post("/pine/transpile")
async def transpile_pine(req: PineTranspileRequest) -> Response:
    """Transpile PineScript to JavaScript via PineTS Node.js."""
    import subprocess
    source = req.source.strip()
    if not source:
        raise HTTPException(status_code=400, detail="PineScript source is empty")

    pinets_path = PINE_CJS_FILE.replace("\\", "/")
    script = f"""
    const fs = require('fs');
    const {{ Indicator, pineToJS }} = require('{pinets_path}');
    const s = fs.readFileSync(0, 'utf-8');
    try {{
        const ind = Indicator.from(s);
        const inputs = ind.getInputsMeta();
        const props = ind.getPropsMeta();
        const prep = ind.prepare();
        const codeStr = (prep && prep.fn) ? prep.fn.toString() : '';
        console.log(JSON.stringify({{ success: true, code: codeStr, inputs, props }}));
    }} catch (e) {{
        const m = (e.message||'').match(/at\\s+(\\d+):(\\d+)/i);
        console.log(JSON.stringify({{ success: false, error: e.message||String(e),
            line: m ? parseInt(m[1]) : 1, column: m ? parseInt(m[2]) : 1 }}));
    }}
    """
    try:
        proc = await asyncio.to_thread(
            subprocess.run,
            ["node", "-e", script],
            input=source, capture_output=True, text=True, encoding="utf-8", timeout=15.0
        )
        if proc.returncode == 0 and proc.stdout:
            return Response(content=proc.stdout, media_type="application/json")
        return Response(content=orjson.dumps({"success": False, "error": proc.stderr or "Failed"}),
                        media_type="application/json")
    except Exception as ex:
        return Response(content=orjson.dumps({"success": False, "error": str(ex)}),
                        media_type="application/json")


@app.get("/pine/source/{filename:path}")
async def get_pine_source(filename: str):
    clean_name = os.path.basename(filename)
    if not clean_name.endswith(".pine"):
        clean_name += ".pine"
    file_path = os.path.join(PINE_EXAMPLES_DIR, clean_name)
    if os.path.isfile(file_path):
        return FileResponse(file_path, media_type="text/plain; charset=utf-8")
    raise HTTPException(status_code=404, detail=f"Pine script '{clean_name}' not found")


# ──────────────────────────────────────────────────────────────────────────────
# WebSocket — Real-Time OANDA Quote Streaming (~350ms polling)
# ──────────────────────────────────────────────────────────────────────────────
@app.websocket("/ws/quotes")
@app.websocket("/ws")
async def websocket_quotes_endpoint(websocket: WebSocket):
    """Real-time OANDA quote stream via 350ms polling. Subscribe/unsubscribe supported."""
    await websocket.accept()

    # TCP_NODELAY for lowest latency
    try:
        import socket as _socket
        sock = None
        raw_transport = websocket.scope.get("transport")
        if raw_transport and hasattr(raw_transport, "get_extra_info"):
            sock = raw_transport.get_extra_info("socket")
        if sock:
            sock.setsockopt(_socket.IPPROTO_TCP, _socket.TCP_NODELAY, 1)
    except Exception:
        pass

    subscribed: set = {"EURUSD", "XAUUSD"}
    stream_task: Optional[asyncio.Task] = None

    async def _poll_and_push():
        """Fetch OANDA prices every 350ms and push to WebSocket client."""
        last_prices: Dict[str, float] = {}
        try:
            while True:
                await asyncio.sleep(0.35)
                if not subscribed:
                    continue
                now_msc = int(time.time() * 1000)
                syms = list(subscribed)
                try:
                    q_list = oanda_engine.get_quotes(syms)
                except Exception:
                    continue
                for q_item in q_list:
                    n = q_item.get("n", "")
                    lp = q_item.get("v", {}).get("lp", 0.0)
                    q_time_msc = q_item.get("time_utc_msc") or q_item.get("time_msc") or int(get_precise_utc() * 1000)
                    if lp != last_prices.get(n):
                        last_prices[n] = lp
                        msg = orjson.dumps({
                            "type": "quote",
                            "symbol": n,
                            "data": q_item,
                            "time_msc": q_time_msc,
                            "time_utc_msc": q_time_msc,
                        }).decode("utf-8")
                        try:
                            await websocket.send_text(msg)
                        except Exception:
                            return
        except (asyncio.CancelledError, WebSocketDisconnect):
            pass
        except Exception:
            pass

    # Send initial quotes immediately on connect
    try:
        init_quotes = oanda_engine.get_quotes(list(subscribed))
        for q_it in init_quotes:
            q_time_msc = q_it.get("time_utc_msc") or q_it.get("time_msc") or int(get_precise_utc() * 1000)
            await websocket.send_text(orjson.dumps({
                "type": "quote", "symbol": q_it.get("n"),
                "data": q_it, "time_msc": q_time_msc, "time_utc_msc": q_time_msc
            }).decode("utf-8"))
    except Exception:
        pass

    stream_task = asyncio.create_task(_poll_and_push())

    try:
        while True:
            msg = await websocket.receive_text()
            try:
                p = json.loads(msg)
                syms = p.get("symbols", [])
                if isinstance(syms, str):
                    syms = [syms]
                action = p.get("action", "")

                if action in ("subscribe", "sub") and syms:
                    for s in syms:
                        subscribed.add(s)
                    # Immediately push quotes for newly subscribed symbols
                    now_msc = int(time.time() * 1000)
                    try:
                        quotes = oanda_engine.get_quotes(syms)
                        for q_item in quotes:
                            await websocket.send_text(orjson.dumps({
                                "type": "quote", "symbol": q_item.get("n"),
                                "data": q_item, "time_msc": now_msc
                            }).decode("utf-8"))
                    except Exception:
                        pass

                elif action in ("unsubscribe", "unsub") and syms:
                    for s in syms:
                        subscribed.discard(s)

            except Exception:
                pass
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        if stream_task:
            stream_task.cancel()


# ──────────────────────────────────────────────────────────────────────────────
# Static File Serving + TradingView CDN Fallback
# ──────────────────────────────────────────────────────────────────────────────
_static_file_cache: Dict[str, Tuple] = {}


def _get_content_type(file_path: str) -> str:
    lower = file_path.lower()
    if lower.endswith(".js"): return "application/javascript"
    if lower.endswith(".css"): return "text/css"
    if lower.endswith((".html", ".htm")): return "text/html"
    if lower.endswith(".json"): return "application/json"
    if lower.endswith(".svg"): return "image/svg+xml"
    if lower.endswith(".png"): return "image/png"
    if lower.endswith(".ico"): return "image/x-icon"
    if lower.endswith(".woff2"): return "font/woff2"
    if lower.endswith(".woff"): return "font/woff"
    return "application/octet-stream"


def _serve_cached_file(file_path: str) -> Response:
    headers = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
    try:
        mtime = os.path.getmtime(file_path)
    except Exception:
        mtime = 0
    cached = _static_file_cache.get(file_path)
    if cached:
        cached_mtime, data, c_type = cached
        if cached_mtime == mtime:
            return Response(content=data, media_type=c_type, headers=headers)
    c_type = _get_content_type(file_path)
    try:
        sz = os.path.getsize(file_path)
        if sz < 15 * 1024 * 1024:
            with open(file_path, "rb") as f:
                data = f.read()
            _static_file_cache[file_path] = (mtime, data, c_type)
            return Response(content=data, media_type=c_type, headers=headers)
    except Exception:
        pass
    return FileResponse(file_path, media_type=c_type, headers=headers)


@app.get("/")
@app.get("/{full_path:path}")
async def serve_static_or_cdn(full_path: str = ""):
    clean = full_path.lstrip("/\\").replace("\\", "/")

    if clean:
        first_seg = clean.split("/")[0].lower()
        if first_seg in UDF_API_PREFIXES:
            raise HTTPException(status_code=404, detail=f"API endpoint '/{clean}' not found")

    if ".." in clean:
        raise HTTPException(status_code=404, detail="Resource not found")

    disallowed = {".py", ".bat", ".cmd", ".ps1", ".env", ".git", ".log", ".md", ".sh", ".jsonl"}
    _, ext = os.path.splitext(clean)
    if ext.lower() in disallowed:
        raise HTTPException(status_code=404, detail="Resource not found")

    if not clean or clean == "index.html":
        index_file = os.path.join(LOCAL_ROOT, "index.html")
        if os.path.isfile(index_file):
            return _serve_cached_file(index_file)
        raise HTTPException(status_code=404, detail="index.html not found")

    local_file = os.path.abspath(os.path.join(LOCAL_ROOT, clean))
    try:
        if not os.path.commonpath([LOCAL_ROOT, local_file]) == LOCAL_ROOT:
            raise HTTPException(status_code=404, detail="Resource not found")
    except Exception:
        raise HTTPException(status_code=404, detail="Resource not found")

    if os.path.isfile(local_file):
        return _serve_cached_file(local_file)

    if clean.startswith("bundles/"):
        alt = os.path.abspath(os.path.join(LOCAL_ROOT, "charting_library", clean))
        if os.path.isfile(alt):
            return _serve_cached_file(alt)

    if os.path.isdir(local_file):
        cand = os.path.join(local_file, "index.html")
        if os.path.isfile(cand):
            return FileResponse(cand, media_type="text/html")

    # CDN Fallback
    remote_subpath = ("/charting_library/" + clean if clean.startswith("bundles/")
                      else ("/" + clean if not clean.startswith("/") else clean))
    primary_url = REMOTE_CDN_BASE.rstrip("/") + remote_subpath
    secondary_url = "https://charting-library.tradingview-widget.com" + remote_subpath
    target_save = (os.path.abspath(os.path.join(LOCAL_ROOT, "charting_library", clean))
                   if clean.startswith("bundles/") else local_file)

    def _atomic_write(path: str, data: bytes):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = f"{path}.tmp.{os.getpid()}.{time.time_ns()}"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, path)

    async with cdn_download_lock:
        if os.path.isfile(local_file):
            return FileResponse(local_file)
        try:
            client = cdn_http_client or httpx.AsyncClient(timeout=20.0, follow_redirects=True)
            r = await client.get(primary_url)
            if r.status_code != 200:
                r = await client.get(secondary_url)
            if r.status_code == 200 and r.content:
                await asyncio.to_thread(_atomic_write, target_save, r.content)
                return FileResponse(target_save)
        except Exception as ex:
            logger.warning(f"[CDN] Failed for {remote_subpath}: {ex}")

    raise HTTPException(status_code=404, detail=f"Resource '{clean}' not found")


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8080"))
    print(f"[STARTUP] OANDA Server on http://{host}:{port}")
    uvicorn.run("server_oanda:app", host=host, port=port, log_level="warning", access_log=False)
