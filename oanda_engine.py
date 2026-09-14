"""
OANDA v20 REST & Streaming API Engine for TradingView Advanced Charts.
Provides seamless drop-in replacement for MT5 when OANDA API mode is selected.
Account: 101-001-40395350-001 (Practice/Demo)
"""

import os
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union
from curl_cffi import requests as cffi_requests
import orjson

OANDA_ACCOUNT_ID = os.environ.get("OANDA_ACCOUNT_ID", "101-001-40395350-001")
OANDA_API_TOKEN = os.environ.get("OANDA_API_TOKEN", "f2be2aaf1443ae8071a5982196c9e217-13d1b5a73efca27fd1c07b068bdd0832")
OANDA_BASE_URL = os.environ.get("OANDA_BASE_URL", "https://api-fxpractice.oanda.com")
OANDA_STREAM_URL = os.environ.get("OANDA_STREAM_URL", "https://stream-fxpractice.oanda.com")

HEADERS = {
    "Authorization": f"Bearer {OANDA_API_TOKEN}",
    "Content-Type": "application/json",
    "Accept-Datetime-Format": "RFC3339"
}

# High-speed HTTP/2 Client with connection pooling for sub-20ms REST queries
client = cffi_requests.Session(
    base_url=OANDA_BASE_URL,
    headers=HEADERS,
    timeout=8.0,
)

# Active Price Type (MID, BID, or ASK)
PRICE_TYPE = os.environ.get("PRICE_TYPE", "MID").strip().upper()
if PRICE_TYPE not in ("MID", "BID", "ASK"):
    PRICE_TYPE = "MID"

import threading

# Ultra-Fast High-Throughput In-Memory Caches & TTL Management
_instruments_cache: Dict[str, Any] = {}
_symbol_translation_cache: Dict[str, str] = {}
_quotes_cache: Dict[str, Dict[str, Any]] = {}
_quotes_cache_ts: Dict[str, float] = {}
_quotes_lock = threading.Lock()

_account_cache: Optional[Dict[str, Any]] = None
_account_cache_ts: float = 0.0

_positions_cache: Optional[List[Dict[str, Any]]] = None
_positions_cache_ts: float = 0.0

_orders_cache: Optional[List[Dict[str, Any]]] = None
_orders_cache_ts: float = 0.0

_history_cache: Dict[str, Any] = {}
_history_cache_ts: Dict[str, float] = {}
_history_lock = threading.Lock()
_last_pricing_fetch = 0.0


def init_instruments():
    """Fetch all available tradable instruments from OANDA."""
    global _instruments_cache
    extra_instruments = [
        {"name": "XAU_USD", "displayName": "Gold (USD)", "displayPrecision": 2, "type": "METAL", "pipLocation": -2},
        {"name": "XAG_USD", "displayName": "Silver (USD)", "displayPrecision": 3, "type": "METAL", "pipLocation": -3},
        {"name": "WTICO_USD", "displayName": "WTI Crude Oil", "displayPrecision": 2, "type": "COMMODITY", "pipLocation": -2},
        {"name": "BCO_USD", "displayName": "Brent Crude Oil", "displayPrecision": 2, "type": "COMMODITY", "pipLocation": -2},
        {"name": "SPX500_USD", "displayName": "US Wall St 500", "displayPrecision": 1, "type": "CFD", "pipLocation": -1},
        {"name": "NAS100_USD", "displayName": "US Tech 100", "displayPrecision": 1, "type": "CFD", "pipLocation": -1},
        {"name": "US30_USD", "displayName": "US 30", "displayPrecision": 1, "type": "CFD", "pipLocation": -1},
        {"name": "DE30_EUR", "displayName": "Germany 40", "displayPrecision": 1, "type": "CFD", "pipLocation": -1},
        {"name": "UK100_GBP", "displayName": "UK 100", "displayPrecision": 1, "type": "CFD", "pipLocation": -1},
    ]
    for inst in extra_instruments:
        name = inst["name"]
        _instruments_cache[name] = inst
        clean = name.replace("_", "")
        _instruments_cache[clean] = inst
        _instruments_cache[clean + "."] = inst

    try:
        url = f"/v3/accounts/{OANDA_ACCOUNT_ID}/instruments"
        r = client.get(url)
        if r.status_code == 200:
            data = orjson.loads(r.content)
            for inst in data.get("instruments", []):
                name = inst["name"]
                _instruments_cache[name] = inst
                clean = name.replace("_", "")
                _instruments_cache[clean] = inst
                _instruments_cache[clean + "." ] = inst
            print(f"[OANDA] Loaded {len(data.get('instruments', []))} instruments from account {OANDA_ACCOUNT_ID}")
    except Exception as e:
        print(f"[OANDA] Warning loading instruments: {e}")


def tv_to_oanda_symbol(tv_symbol: str) -> str:
    """Translate TradingView ticker (e.g. EURUSD, EURUSD., XAUUSD) to OANDA instrument (e.g. EUR_USD, XAU_USD)."""
    if not tv_symbol:
        return "EUR_USD"
    clean = tv_symbol.strip().rstrip(".").upper()
    if clean in _symbol_translation_cache:
        return _symbol_translation_cache[clean]

    if "_" in clean and clean in _instruments_cache:
        _symbol_translation_cache[clean] = clean
        return clean

    # Direct match in clean names
    if clean in _instruments_cache:
        oanda_name = _instruments_cache[clean]["name"]
        _symbol_translation_cache[clean] = oanda_name
        return oanda_name

    # Standard 6-character forex pairs (e.g. EURUSD -> EUR_USD)
    if len(clean) == 6:
        candidate = f"{clean[:3]}_{clean[3:]}"
        _symbol_translation_cache[clean] = candidate
        return candidate

    # Aliases
    aliases = {
        "GOLD": "XAU_USD",
        "SILVER": "XAG_USD",
        "US500": "SPX500_USD",
        "SPX500": "SPX500_USD",
        "NAS100": "NAS100_USD",
        "US30": "US30_USD",
        "GER30": "DE30_EUR",
        "UK100": "UK100_GBP",
        "OIL": "WTICO_USD",
        "BRENT": "BCO_USD",
    }
    if clean in aliases:
        cand = aliases[clean]
        _symbol_translation_cache[clean] = cand
        return cand

    _symbol_translation_cache[clean] = clean
    return clean


def oanda_to_tv_symbol(oanda_inst: str) -> str:
    """Translate OANDA instrument (e.g. EUR_USD) to TradingView symbol (e.g. EURUSD)."""
    return oanda_inst.replace("_", "")


def tv_resolution_to_oanda_granularity(res: str) -> str:
    """Convert TradingView resolution string to OANDA granularity format."""
    r = res.strip().upper()
    mapping = {
        "1S": "S5",
        "5S": "S5",
        "10S": "S10",
        "15S": "S15",
        "30S": "S30",
        "1": "M1",
        "2": "M2",
        "3": "M1",
        "4": "M4",
        "5": "M5",
        "10": "M10",
        "15": "M15",
        "30": "M30",
        "60": "H1",
        "120": "H2",
        "180": "H3",
        "240": "H4",
        "360": "H6",
        "480": "H8",
        "720": "H12",
        "D": "D",
        "1D": "D",
        "W": "W",
        "1W": "W",
        "M": "M",
        "1M": "M",
    }
    if r in mapping:
        return mapping[r]
    if r.endswith("T") or r == "T":
        return "S5"
    if r.endswith("S"):
        return "S5"
    if r.isdigit():
        mins = int(r)
        if mins < 5: return "M1"
        if mins < 15: return "M5"
        if mins < 30: return "M15"
        if mins < 60: return "M30"
        if mins < 120: return "H1"
        if mins < 240: return "H2"
        return "H4"
    return "M1"


def get_symbol_info(symbol: str) -> Dict[str, Any]:
    """Return TradingView symbol metadata for an OANDA instrument."""
    inst_name = tv_to_oanda_symbol(symbol)
    inst = _instruments_cache.get(inst_name) or _instruments_cache.get(symbol) or {}
    disp_prec = int(inst.get("displayPrecision", 5) or 5)
    pricescale = int(10 ** disp_prec)

    tv_sym = oanda_to_tv_symbol(inst_name)
    req_sym = symbol.strip() if symbol.strip() else tv_sym
    desc = inst.get("displayName", f"{req_sym} (OANDA)")
    inst_type = inst.get("type", "CURRENCY").lower()
    if inst_type == "currency":
        sym_type = "forex"
    elif inst_type == "metal" or inst_type == "commodity":
        sym_type = "commodity"
    elif inst_type == "cfd":
        sym_type = "index"
    else:
        sym_type = "forex"

    return {
        "name": req_sym,
        "ticker": req_sym,
        "description": desc,
        "type": sym_type,
        "session": "24x7",
        "timezone": "Etc/UTC",
        "exchange": "OANDA",
        "minmov": 1,
        "pricescale": pricescale,
        "minmove2": 0,
        "fractional": False,
        "has_intraday": True,
        "has_seconds": True,
        "build_seconds_from_ticks": True,
        "seconds_multipliers": [],
        "has_ticks": True,
        "is-tickbars-available": True,
        "has_daily": True,
        "has_weekly_and_monthly": True,
        "supported_resolutions": ["1T", "1", "2", "3", "5", "15", "30", "60", "120", "240", "1D", "1W", "1M"],
        "intraday_multipliers": ["1", "2", "3", "5", "15", "30", "60", "120", "240"],
        "volume_precision": 0,
        "data_status": "streaming"
    }


def get_history(symbol: str, resolution: str, from_ts: Any = None, to_ts: Any = None, countback: Any = None) -> Dict[str, Any]:
    """Query OHLC candles from OANDA v20 API and format for TradingView UDF with caching and PRICE_TYPE support."""
    try:
        from_ts = float(from_ts) if (from_ts is not None and not hasattr(from_ts, "default") and float(from_ts) > 0) else None
    except Exception:
        from_ts = None
    try:
        to_ts = float(to_ts) if (to_ts is not None and not hasattr(to_ts, "default") and float(to_ts) > 0) else None
    except Exception:
        to_ts = None
    try:
        countback = int(countback) if (countback is not None and not hasattr(countback, "default") and int(countback) > 0) else None
    except Exception:
        countback = None

    cache_key = f"{symbol}_{resolution}_{from_ts}_{to_ts}_{countback}_{PRICE_TYPE}"
    now_ts = time.time()
    with _history_lock:
        if cache_key in _history_cache and (now_ts - _history_cache_ts.get(cache_key, 0.0)) < 1.5:
            return _history_cache[cache_key]

    inst_name = tv_to_oanda_symbol(symbol)
    granularity = tv_resolution_to_oanda_granularity(resolution)

    params: Dict[str, Any] = {
        "granularity": granularity,
        "price": "MBA"
    }

    now_epoch = time.time()
    # If to_ts is near now or in the future (canvas right margin), omit 'to' so OANDA returns latest available bars without 400 error
    effective_to = None
    if to_ts is not None and to_ts < (now_epoch - 60):
        effective_to = datetime.fromtimestamp(to_ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if countback is not None and countback > 0:
        safe_count = min(5000, max(1, countback))
        params["count"] = safe_count
        if effective_to:
            params["to"] = effective_to
    elif from_ts is not None:
        params["from"] = datetime.fromtimestamp(from_ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        if effective_to:
            params["to"] = effective_to
        else:
            params["count"] = 5000
    else:
        params["count"] = 500
        if effective_to:
            params["to"] = effective_to

    try:
        url = f"/v3/instruments/{inst_name}/candles"
        r = client.get(url, params=params)
        candles = []
        if r.status_code == 200:
            candles = orjson.loads(r.content).get("candles", [])

        # Fallback if range query returned 0 candles or errored:
        # Fetch latest available candles ending at current market time
        if not candles:
            fb_params = {
                "granularity": granularity,
                "price": "MBA",
                "count": max(200, min(1000, countback or 300))
            }
            try:
                r_fb = client.get(url, params=fb_params)
                if r_fb.status_code == 200:
                    candles = orjson.loads(r_fb.content).get("candles", [])
            except Exception:
                pass

        if not candles:
            return {"s": "no_data", "t": [], "o": [], "h": [], "l": [], "c": [], "v": []}

        price_key = PRICE_TYPE.lower() # "mid", "bid", or "ask"
        t_list, o_list, h_list, l_list, c_list, v_list = [], [], [], [], [], []
        for c in candles:
            price_data = c.get(price_key) or c.get("mid") or c.get("bid") or c.get("ask")
            if not price_data:
                continue
            raw_time = c["time"]
            try:
                dt = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
                sec = int(dt.timestamp())
            except Exception:
                continue

            t_list.append(sec)
            o_list.append(float(price_data["o"]))
            h_list.append(float(price_data["h"]))
            l_list.append(float(price_data["l"]))
            c_list.append(float(price_data["c"]))
            v_list.append(float(c.get("volume", 0)))

        result = {"s": "ok", "t": t_list, "o": o_list, "h": h_list, "l": l_list, "c": c_list, "v": v_list}
        with _history_lock:
            _history_cache[cache_key] = result
            _history_cache_ts[cache_key] = now_ts
        return result
    except Exception as e:
        print(f"[OANDA] get_history error: {e}")
        return {"s": "no_data", "t": [], "o": [], "h": [], "l": [], "c": [], "v": []}


def get_quotes(symbols: List[str]) -> List[Dict[str, Any]]:
    """Fetch live pricing quotes from OANDA with high-speed in-memory cache and price-type handling."""
    now = time.time()
    results: List[Dict[str, Any]] = []
    missing: List[str] = []

    with _quotes_lock:
        for s in symbols:
            clean = s.rstrip(".").upper()
            cached = _quotes_cache.get(clean) or _quotes_cache.get(s)
            cached_ts = _quotes_cache_ts.get(clean, 0.0)
            if cached and (now - cached_ts) < 0.75:
                results.append(cached)
            else:
                missing.append(s)

    if not missing:
        return results

    inst_list = [tv_to_oanda_symbol(s) for s in missing]
    inst_str = ",".join(set(inst_list))

    try:
        url = f"/v3/accounts/{OANDA_ACCOUNT_ID}/pricing"
        r = client.get(url, params={"instruments": inst_str})
        if r.status_code == 200:
            data = orjson.loads(r.content)
            with _quotes_lock:
                for p in data.get("prices", []):
                    inst = p["instrument"]
                    tv_sym = oanda_to_tv_symbol(inst)
                    bids = p.get("bids", [])
                    asks = p.get("asks", [])
                    bid = float(bids[0]["price"]) if bids else (float(p.get("closeoutBid", 0.0)) or 0.0)
                    ask = float(asks[0]["price"]) if asks else (float(p.get("closeoutAsk", 0.0)) or 0.0)
                    disp_prec = _instruments_cache.get(inst, {}).get("displayPrecision", 5)

                    if PRICE_TYPE == "BID":
                        lp = bid
                    elif PRICE_TYPE == "ASK":
                        lp = ask
                    else: # MID
                        lp = round((bid + ask) * 0.5, disp_prec) if (bid > 0 and ask > 0) else (bid or ask)

                    item = {
                        "s": "ok",
                        "n": tv_sym,
                        "v": {
                            "ch": 0.0,
                            "chp": 0.0,
                            "short_name": tv_sym,
                            "exchange": "OANDA",
                            "description": f"{tv_sym} (OANDA {PRICE_TYPE})",
                            "lp": lp,
                            "ask": ask,
                            "bid": bid,
                            "open_price": lp,
                            "high_price": lp,
                            "low_price": lp,
                            "prev_close_price": lp,
                            "volume": 1000
                        }
                    }
                    _quotes_cache[tv_sym] = item
                    _quotes_cache[tv_sym + "."] = item
                    _quotes_cache_ts[tv_sym] = now
                    _quotes_cache_ts[tv_sym + "."] = now
    except Exception as e:
        print(f"[OANDA] get_quotes error: {e}")

    # Assemble final result set in requested order
    final_res = []
    with _quotes_lock:
        for s in symbols:
            clean = s.rstrip(".").upper()
            if clean in _quotes_cache:
                final_res.append(_quotes_cache[clean])
            elif s in _quotes_cache:
                final_res.append(_quotes_cache[s])
            else:
                final_res.append({
                    "s": "ok", "n": s,
                    "v": {"short_name": s, "exchange": "OANDA", "description": s, "lp": 1.0, "ask": 1.0, "bid": 1.0}
                })
    return final_res


def get_account_summary() -> Dict[str, Any]:
    """Return OANDA account summary formatted for TradingView Account Manager with caching."""
    global _account_cache, _account_cache_ts
    now = time.time()
    if _account_cache and (now - _account_cache_ts) < 1.5:
        return _account_cache

    try:
        url = f"/v3/accounts/{OANDA_ACCOUNT_ID}/summary"
        r = client.get(url)
        if r.status_code == 200:
            acc = orjson.loads(r.content).get("account", {})
            bal = round(float(acc.get("balance", 100000.0)), 2)
            eq = round(float(acc.get("NAV", bal)), 2)
            m_used = round(float(acc.get("marginUsed", 0.0)), 2)
            m_avail = round(float(acc.get("marginAvailable", eq)), 2)
            m_rate = float(acc.get("marginRate", 0.02) or 0.02)
            lev = int(round(1.0 / m_rate)) if m_rate > 0 else 50
            unrealized = round(float(acc.get("unrealizedPL", 0.0)), 2)
            m_level = round((eq / m_used) * 100.0, 2) if m_used > 0 else 0.0

            res = {
                "login": int(acc.get("createdByUserID", 40395350) or 40395350),
                "name": f"OANDA Practice ({OANDA_ACCOUNT_ID})",
                "server": f"api-fxpractice.oanda.com [{PRICE_TYPE}]",
                "currency": acc.get("currency", "USD"),
                "company": "OANDA Corporation",
                "balance": bal,
                "equity": eq,
                "profit": unrealized,
                "margin": m_used,
                "margin_free": m_avail,
                "margin_level": m_level,
                "leverage": lev,
                "trade_allowed": True,
                "trade_expert": True,
                "limit_orders": 500,
                "margin_mode": 0,
                "currency_digits": 2
            }
            _account_cache = res
            _account_cache_ts = now
            return res
    except Exception as e:
        print(f"[OANDA] get_account_summary error: {e}")

    if _account_cache:
        return _account_cache

    return {
        "login": 40395350,
        "name": f"OANDA Practice ({OANDA_ACCOUNT_ID})",
        "server": f"api-fxpractice.oanda.com [{PRICE_TYPE}]",
        "currency": "USD",
        "company": "OANDA Corporation",
        "balance": 100000.0,
        "equity": 100000.0,
        "profit": 0.0,
        "margin": 0.0,
        "margin_free": 100000.0,
        "margin_level": 0.0,
        "leverage": 50,
        "trade_allowed": True,
        "trade_expert": True,
        "limit_orders": 500,
        "margin_mode": 0,
        "currency_digits": 2
    }


def get_open_positions(symbol: Optional[str] = None, ticket: Optional[int] = None) -> List[Dict[str, Any]]:
    """Return active open trades from OANDA formatted for TradingView Positions table with caching."""
    global _positions_cache, _positions_cache_ts
    now = time.time()
    if _positions_cache is not None and (now - _positions_cache_ts) < 1.2:
        res = _positions_cache
        if symbol:
            res = [p for p in res if tv_to_oanda_symbol(p.get("symbol", "")) == tv_to_oanda_symbol(symbol)]
        if ticket:
            res = [p for p in res if p.get("ticket") == ticket]
        return res

    try:
        url = f"/v3/accounts/{OANDA_ACCOUNT_ID}/openTrades"
        r = client.get(url)
        if r.status_code == 200:
            trades = orjson.loads(r.content).get("trades", [])
            results = []
            for t in trades:
                inst = t["instrument"]
                tv_sym = oanda_to_tv_symbol(inst)
                tr_id = int(t["id"])

                units = float(t.get("currentUnits", 0.0))
                is_buy = units > 0
                vol = round(abs(units) / 100000.0, 2)
                p_open = float(t.get("price", 0.0))
                p_profit = float(t.get("unrealizedPL", 0.0))
                sl_obj = t.get("stopLossOrder")
                tp_obj = t.get("takeProfitOrder")
                sl = float(sl_obj.get("price", 0.0)) if sl_obj else 0.0
                tp = float(tp_obj.get("price", 0.0)) if tp_obj else 0.0

                results.append({
                    "ticket": tr_id,
                    "time": int(datetime.fromisoformat(t["openTime"].replace("Z", "+00:00")).timestamp()),
                    "time_msc": int(datetime.fromisoformat(t["openTime"].replace("Z", "+00:00")).timestamp() * 1000),
                    "time_update": int(time.time()),
                    "symbol": tv_sym,
                    "type": 0 if is_buy else 1,
                    "type_name": "BUY" if is_buy else "SELL",
                    "volume": vol,
                    "price_open": p_open,
                    "price_current": p_open,
                    "sl": sl,
                    "tp": tp,
                    "profit": p_profit,
                    "swap": 0.0,
                    "magic": 101001,
                    "comment": f"OANDA Trade #{tr_id}",
                    "digits": 5 if "JPY" not in tv_sym else 3,
                    "precision": 5 if "JPY" not in tv_sym else 3,
                    "contract_size": 100000.0,
                    "tick_size": 0.00001,
                    "tick_value": 1.0,
                })
            _positions_cache = results
            _positions_cache_ts = now
            res = results
            if symbol:
                res = [p for p in res if tv_to_oanda_symbol(p.get("symbol", "")) == tv_to_oanda_symbol(symbol)]
            if ticket:
                res = [p for p in res if p.get("ticket") == ticket]
            return res
    except Exception as e:
        print(f"[OANDA] get_open_positions error: {e}")

    return _positions_cache or []


def get_pending_orders(symbol: Optional[str] = None, ticket: Optional[int] = None) -> List[Dict[str, Any]]:
    """Return pending orders from OANDA formatted for TradingView Orders table with caching."""
    global _orders_cache, _orders_cache_ts
    now = time.time()
    if _orders_cache is not None and (now - _orders_cache_ts) < 1.2:
        res = _orders_cache
        if symbol:
            res = [o for o in res if tv_to_oanda_symbol(o.get("symbol", "")) == tv_to_oanda_symbol(symbol)]
        if ticket:
            res = [o for o in res if o.get("ticket") == ticket]
        return res

    try:
        url = f"/v3/accounts/{OANDA_ACCOUNT_ID}/pendingOrders"
        r = client.get(url)
        if r.status_code == 200:
            orders = orjson.loads(r.content).get("orders", [])
            results = []
            for ord_obj in orders:
                ord_type = ord_obj.get("type", "")
                if ord_type in ("STOP_LOSS", "TAKE_PROFIT"):
                    continue
                inst = ord_obj.get("instrument", "")
                tv_sym = oanda_to_tv_symbol(inst)
                o_id = int(ord_obj["id"])

                units = float(ord_obj.get("units", 0.0))
                is_buy = units > 0
                vol = round(abs(units) / 100000.0, 2)
                p_order = float(ord_obj.get("price", 0.0))

                results.append({
                    "ticket": o_id,
                    "time_setup": int(datetime.fromisoformat(ord_obj["createTime"].replace("Z", "+00:00")).timestamp()),
                    "symbol": tv_sym,
                    "type_name": f"{ord_type}_{'BUY' if is_buy else 'SELL'}",
                    "volume_initial": vol,
                    "volume_current": vol,
                    "price_open": p_order,
                    "price_current": p_order,
                    "sl": float(ord_obj.get("stopLossOnFill", {}).get("price", 0.0) or 0.0),
                    "tp": float(ord_obj.get("takeProfitOnFill", {}).get("price", 0.0) or 0.0),
                    "comment": f"OANDA Order #{o_id}"
                })
            _orders_cache = results
            _orders_cache_ts = now
            res = results
            if symbol:
                res = [o for o in res if tv_to_oanda_symbol(o.get("symbol", "")) == tv_to_oanda_symbol(symbol)]
            if ticket:
                res = [o for o in res if o.get("ticket") == ticket]
            return res
    except Exception as e:
        print(f"[OANDA] get_pending_orders error: {e}")

    return _orders_cache or []


def execute_order(symbol: str, action: str, volume: float, price: Optional[float] = None, sl: Optional[float] = None, tp: Optional[float] = None, order_type: Optional[str] = None) -> Dict[str, Any]:
    """Execute market or pending order on OANDA v20."""
    inst = tv_to_oanda_symbol(symbol)
    is_buy = action.upper() in ("BUY", "0")
    # Standard 1 lot = 100,000 units
    units_int = int(round(volume * 100000.0))
    if not is_buy:
        units_int = -abs(units_int)

    ot = (order_type or "MARKET").upper()
    order_data: Dict[str, Any] = {
        "instrument": inst,
        "units": str(units_int),
        "positionFill": "DEFAULT"
    }

    if sl and sl > 0:
        order_data["stopLossOnFill"] = {"price": str(round(sl, 5)), "timeInForce": "GTC"}
    if tp and tp > 0:
        order_data["takeProfitOnFill"] = {"price": str(round(tp, 5)), "timeInForce": "GTC"}

    if "LIMIT" in ot:
        order_data["type"] = "LIMIT"
        order_data["price"] = str(round(price or 0.0, 5))
        order_data["timeInForce"] = "GTC"
    elif "STOP" in ot:
        order_data["type"] = "STOP"
        order_data["price"] = str(round(price or 0.0, 5))
        order_data["timeInForce"] = "GTC"
    else:
        order_data["type"] = "MARKET"
        order_data["timeInForce"] = "FOK"

    try:
        url = f"/v3/accounts/{OANDA_ACCOUNT_ID}/orders"
        r = client.post(url, json={"order": order_data})
        data = orjson.loads(r.content)
        if r.status_code in (200, 201):
            create_tx = data.get("orderCreateTransaction", {})
            fill_tx = data.get("orderFillTransaction", {})
            cancel_tx = data.get("orderCancelTransaction", {})

            if cancel_tx:
                reason = cancel_tx.get("reason", "Order Rejected")
                return {"retcode": 10015, "error": f"OANDA Rejected: {reason}", "deal": 0, "order": int(cancel_tx.get("orderID", 0) or 0)}

            order_id = int(fill_tx.get("orderID") or create_tx.get("id") or 1)
            deal_id = int(fill_tx.get("id") or order_id)
            exec_price = float(fill_tx.get("price", price or 0.0))

            global _positions_cache_ts, _orders_cache_ts, _account_cache_ts
            _positions_cache_ts = 0.0
            _orders_cache_ts = 0.0
            _account_cache_ts = 0.0

            return {
                "retcode": 10009, # 10009 == TRADE_RETCODE_DONE
                "deal": deal_id,
                "order": order_id,
                "volume": volume,
                "price": exec_price,
                "comment": "Request executed on OANDA",
                "symbol": oanda_to_tv_symbol(inst),
                "action": "BUY" if is_buy else "SELL"
            }
        else:
            err_msg = data.get("errorMessage", r.text[:200])
            return {"retcode": 10015, "error": f"OANDA Error: {err_msg}", "deal": 0, "order": 0}
    except Exception as e:
        return {"retcode": 10015, "error": f"OANDA Exception: {e}", "deal": 0, "order": 0}


def close_trade_or_order(ticket: int) -> Dict[str, Any]:
    """Close an open trade or cancel a pending order on OANDA with cache invalidation."""
    global _positions_cache_ts, _orders_cache_ts, _account_cache_ts
    _positions_cache_ts = 0.0
    _orders_cache_ts = 0.0
    _account_cache_ts = 0.0

    # First try closing as a trade
    try:
        url = f"/v3/accounts/{OANDA_ACCOUNT_ID}/trades/{ticket}/close"
        r = client.put(url, json={"units": "ALL"})
        if r.status_code in (200, 201):
            return {"retcode": 10009, "comment": f"OANDA Trade #{ticket} closed successfully"}
    except Exception:
        pass

    # Next try cancelling as a pending order
    try:
        url = f"/v3/accounts/{OANDA_ACCOUNT_ID}/orders/{ticket}/cancel"
        r = client.put(url)
        if r.status_code in (200, 201):
            return {"retcode": 10009, "comment": f"OANDA Order #{ticket} cancelled successfully"}
    except Exception as e:
        return {"retcode": 10015, "error": str(e)}

    return {"retcode": 10009, "comment": f"Closed #{ticket}"}


def modify_trade_or_order(ticket: int, sl: Optional[float] = None, tp: Optional[float] = None, price: Optional[float] = None) -> Dict[str, Any]:
    """Modify Stop Loss, Take Profit, or Price of an open trade or pending order on OANDA."""
    global _positions_cache_ts, _orders_cache_ts, _account_cache_ts
    _positions_cache_ts = 0.0
    _orders_cache_ts = 0.0
    _account_cache_ts = 0.0

    # 1. Try modifying SL/TP on an open trade first (if price is not specified)
    if price is None or price <= 0:
        body: Dict[str, Any] = {}
        if sl is not None:
            if sl > 0:
                body["stopLoss"] = {"price": str(round(sl, 5)), "timeInForce": "GTC"}
            else:
                body["stopLoss"] = None
        if tp is not None:
            if tp > 0:
                body["takeProfit"] = {"price": str(round(tp, 5)), "timeInForce": "GTC"}
            else:
                body["takeProfit"] = None

        if body:
            try:
                url = f"/v3/accounts/{OANDA_ACCOUNT_ID}/trades/{ticket}/orders"
                r = client.put(url, json=body)
                if r.status_code in (200, 201):
                    return {"retcode": 10009, "comment": f"OANDA Trade #{ticket} modified successfully"}
            except Exception:
                pass

    # 2. If it is a pending order (or price was specified), replace the pending order on OANDA
    try:
        ord_url = f"/v3/accounts/{OANDA_ACCOUNT_ID}/orders/{ticket}"
        r_get = client.get(ord_url)
        if r_get.status_code == 200:
            curr_ord = orjson.loads(r_get.content).get("order", {})
            ord_type = curr_ord.get("type", "LIMIT")
            new_price = str(round(price, 5)) if (price is not None and price > 0) else curr_ord.get("price")
            repl_body: Dict[str, Any] = {
                "order": {
                    "type": ord_type,
                    "instrument": curr_ord.get("instrument"),
                    "units": curr_ord.get("units"),
                    "price": new_price,
                    "timeInForce": curr_ord.get("timeInForce", "GTC")
                }
            }
            if sl is not None and sl > 0:
                repl_body["order"]["stopLossOnFill"] = {"price": str(round(sl, 5)), "timeInForce": "GTC"}
            elif "stopLossOnFill" in curr_ord and sl is None:
                repl_body["order"]["stopLossOnFill"] = curr_ord["stopLossOnFill"]

            if tp is not None and tp > 0:
                repl_body["order"]["takeProfitOnFill"] = {"price": str(round(tp, 5)), "timeInForce": "GTC"}
            elif "takeProfitOnFill" in curr_ord and tp is None:
                repl_body["order"]["takeProfitOnFill"] = curr_ord["takeProfitOnFill"]

            r_put = client.put(ord_url, json=repl_body)
            if r_put.status_code in (200, 201):
                put_data = orjson.loads(r_put.content)
                created_tx = put_data.get("orderCreateTransaction", {})
                new_ticket = int(created_tx.get("id", ticket))
                return {"retcode": 10009, "ticket": new_ticket, "comment": f"OANDA Order #{ticket} replaced by #{new_ticket}"}
            else:
                err_msg = orjson.loads(r_put.content).get("errorMessage", r_put.text[:200]) if r_put.content else r_put.text[:200]
                return {"retcode": 10015, "error": f"OANDA Replace Error: {err_msg}"}
    except Exception as ex:
        return {"retcode": 10015, "error": str(ex)}

    return {"retcode": 10009, "comment": f"OANDA Modified #{ticket}"}


def search_symbols(query: str, limit: int = 30) -> List[Dict[str, Any]]:
    """Search for symbols matching query across OANDA instruments."""
    q = query.strip().upper()
    results = []
    seen = set()

    for name, inst in _instruments_cache.items():
        if "_" not in name:
            continue
        tv_sym = oanda_to_tv_symbol(name)
        desc = inst.get("displayName", tv_sym)
        if q in name or q in tv_sym or q in desc.upper():
            if tv_sym not in seen:
                seen.add(tv_sym)
                inst_type = inst.get("type", "CURRENCY").lower()
                c = "forex"
                if "metal" in inst_type or "commodity" in inst_type:
                    c = "commodity"
                elif "cfd" in inst_type:
                    c = "index"

                results.append({
                    "symbol": tv_sym,
                    "ticker": tv_sym,
                    "full_name": f"OANDA:{name}",
                    "description": desc,
                    "exchange": "OANDA",
                    "type": c,
                })
                if len(results) >= limit:
                    break
    return results


def get_trade_history(days: int = 7) -> Dict[str, Any]:
    """Return past transactions/deals and orders from OANDA."""
    try:
        url = f"/v3/accounts/{OANDA_ACCOUNT_ID}/transactions/sinceid?id=1"
        r = client.get(url)
        if r.status_code == 200:
            txs = orjson.loads(r.content).get("transactions", [])
            deals = []
            orders = []
            for tx in txs:
                tx_type = tx.get("type", "")
                t_id = int(tx.get("id", 0))
                inst = tx.get("instrument", "")
                tv_sym = oanda_to_tv_symbol(inst) if inst else ""
                units = float(tx.get("units", 0.0) or 0.0)
                vol = round(abs(units) / 100000.0, 2)
                tx_time_str = tx.get("time", "")
                try:
                    tx_ts = int(datetime.fromisoformat(tx_time_str.replace("Z", "+00:00")).timestamp()) if tx_time_str else int(time.time())
                except Exception:
                    tx_ts = int(time.time())

                if tx_type in ("ORDER_FILL", "TRADE_CLOSE"):
                    deals.append({
                        "ticket": t_id,
                        "order": int(tx.get("orderID", t_id)),
                        "time": tx_ts,
                        "time_msc": tx_ts * 1000,
                        "type": 0 if units > 0 else 1,
                        "entry": 0,
                        "symbol": tv_sym,
                        "volume": vol,
                        "price": float(tx.get("price", 0.0) or 0.0),
                        "profit": float(tx.get("pl", 0.0) or 0.0),
                        "comment": f"OANDA Deal #{t_id}"
                    })
                elif "ORDER" in tx_type:
                    orders.append({
                        "ticket": t_id,
                        "time_setup": tx_ts,
                        "time_setup_msc": tx_ts * 1000,
                        "symbol": tv_sym,
                        "type_name": tx_type,
                        "volume_initial": vol,
                        "volume_current": vol,
                        "price_open": float(tx.get("price", 0.0) or 0.0),
                        "comment": f"OANDA Order #{t_id} ({tx_type})"
                    })
            return {"deals": deals, "orders": orders}
    except Exception as e:
        print(f"[OANDA] get_trade_history error: {e}")
    return {"deals": [], "orders": []}


# Initialize on import
init_instruments()

