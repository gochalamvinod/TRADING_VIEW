from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Union, Any
from datetime import datetime, timedelta
import MetaTrader5 as mt5
import time
import requests
from dateutil import parser
import re
import json
import MetaTrader5 as mt5

import MetaTrader5 as mt5

def get_current_tick_time(symbol: str) -> int:
    mt5.initialize()
    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        return None
    return int(tick.time)   # Unix timestamp (seconds)


def extract_currencies(symbol: str):
    symbol = symbol.upper()
    # Remove any suffixes like 'm', '.r', etc.
    symbol = ''.join(filter(str.isalpha, symbol))
    currencies = [symbol[i:i+3] for i in range(0, len(symbol), 3)]
    return set(currencies)

# Colors for time scale marks
C_HIGH = "red"
C_MEDIUM = "orange"
C_LOW = "green"

def load_list(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# Predefined time windows used for demo volume toggling

ACTIVE_SYMBOL = 'EURUSD'  # kept for compatibility if you reference it elsewhere
JSON = r"E:\PROJECT TRADINGVIEW\backend\SERVER\events.json"

def get_latest_tick_datetime(symbol: str) -> datetime:
    """
    Returns the time of the latest tick as a datetime.datetime object.
    """
    if not mt5.initialize():
        raise RuntimeError("MT5 initialization failed")

    tick = mt5.symbol_info_tick(symbol)
    # mt5.shutdown()  # intentionally left commented as original style

    if tick is None:
        raise ValueError("No tick data for symbol: " + symbol)

    return datetime.fromtimestamp(tick.time)

def replace_text_in_file(filepath):
    try:
        with open(filepath, 'w', encoding='utf-8') as file:
            file.write("txxxxxxt")
        print(f"Replaced content in: {filepath}")
    except Exception as e:
        print(f"Error: {e}")

app = FastAPI(
    title="MetaTrader5 UDF Data Feed",
    description="FastAPI server implementing TradingView's Universal Data Format (UDF) for MetaTrader5 data, adjusted for symbols with trailing dots.",
    version="1.0.3"  # bumped after cleanup
)

# Configure CORS to allow all origins for development purposes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

# Map UDF resolutions to MetaTrader5 timeframes
UDF_RESOLUTION_TO_MT5_TIMEFRAME = {
    "1": mt5.TIMEFRAME_M1,
    "5": mt5.TIMEFRAME_M5,
    "15": mt5.TIMEFRAME_M15,
    "30": mt5.TIMEFRAME_M30,
    "60": mt5.TIMEFRAME_H1,
    "120": mt5.TIMEFRAME_H2,
    "240": mt5.TIMEFRAME_H4,
    "1D": mt5.TIMEFRAME_D1,
    "1W": mt5.TIMEFRAME_W1,
    "1M": mt5.TIMEFRAME_MN1,
}

# Supported resolutions for the /config endpoint
SUPPORTED_RESOLUTIONS = list(UDF_RESOLUTION_TO_MT5_TIMEFRAME.keys()) +['15S','15s']

# Helper function to ensure symbol has a trailing dot if needed for MT5
def _ensure_dot_suffix(symbol: str) -> str:
    """
    Appends a dot to the symbol if it doesn't already have one,
    based on the user's reported MT5 symbol naming convention.
    """
    if symbol and not symbol.endswith('.'):
        return symbol + '.'
    return symbol

@app.on_event("startup")
async def startup_event():
    """
    Initializes MetaTrader5 connection on application startup.
    """
    if not mt5.initialize():
        print("MetaTrader5 initialization failed on startup.")

@app.on_event("shutdown")
async def shutdown_event():
    """
    Shuts down MetaTrader5 connection on application shutdown.
    """
    mt5.shutdown()
    print("MetaTrader5 connection shut down.")

@app.get("/config")
def get_config() -> Dict[str, Any]:
    """
    Returns the configuration for the charting library.
    """
    return {
        "supports_search": True,
        "supports_group_request": False,
        "supported_resolutions": SUPPORTED_RESOLUTIONS,
        "supports_marks": False,
        "supports_timescale_marks": False,
        "supports_time": True
    }

@app.get("/symbols")
def get_symbols(symbol: str = Query(..., description="Symbol ticker, e.g., EURUSD")) -> Dict[str, Any]:
    """
    Returns metadata for a specific symbol.
    """
    # mt5_symbol = _ensure_dot_suffix(symbol)
    mt5_symbol = symbol

    if not mt5.initialize():
        raise HTTPException(status_code=500, detail="MT5 initialization failed")

    symbol_info = mt5.symbol_info(mt5_symbol)
    mt5.shutdown()

    if not symbol_info or not symbol_info.visible:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' (or '{mt5_symbol}') not found or not visible in MT5.")

    # Determine pricescale based on digits
    pricescale = 10 ** symbol_info.digits

    return {
        "name": symbol_info.name,
        "ticker": symbol_info.name,
        "description": symbol_info.description,
        "type": "forex",
        "session": "24x7",
        "exchange": "COMEX.CME",
        "listed_exchange": "COMEX.CME",
        "timezone": "Etc/UTC",
        "minmov": 1,
        "pricescale": pricescale,
        "has_intraday": True,
        "has_seconds": True,
        "has_ticks": True,
        "has_daily": True,
        "has_weekly_and_monthly": True,
        "has_empty_bars": False,
        "has_no_volume": False,
        "volume_precision": 0,
        "supported_resolutions": SUPPORTED_RESOLUTIONS,
        "format": "price"
    }

@app.get("/history")
def get_history(
    symbol: str = Query(..., description="Symbol ticker, e.g., EURUSD"),
    resolution: str = Query(..., description="Resolution, e.g., 1, 15, 1D, 1M"),
    _from: int = Query(..., alias="from", description="Start time (UNIX seconds)"),
    to: int = Query(..., description="End time (UNIX seconds)")
) -> Dict[str, Union[str, List[int], List[float]]]:

    mt5_symbol = symbol

    if not mt5.initialize():
        raise HTTPException(status_code=500, detail="MT5 initialization failed")

    mt5_timeframe = UDF_RESOLUTION_TO_MT5_TIMEFRAME.get(resolution)
    if mt5_timeframe is None:
        mt5.shutdown()
        raise HTTPException(status_code=400, detail="Unsupported resolution")

    # Define safe timestamp bounds
    MIN_TS = 0                # 1970-01-01 (Windows safe minimum)
    MAX_TS = 4102444800       # ~2100-01-01

    # Adjust from timestamp depending on resolution
    if 'M' in resolution:  # Monthly
        ts = _from - 700000
    else:
        ts = _from - 500000

    # Clamp into safe range
    if ts < MIN_TS:
        ts = MIN_TS
    elif ts > MAX_TS:
        ts = MAX_TS

    # Convert safely
    try:
        from_datetime = datetime.fromtimestamp(ts)
    except (OSError, OverflowError, ValueError):
        mt5.shutdown()
        return {"s": "no_data"}

    # Always get latest available tick datetime for the requested symbol
    to_datetime = get_current_tick_time(ACTIVE_SYMBOL)

    # Fetch rates safely
    try:
        all_rates = mt5.copy_rates_range(mt5_symbol, mt5_timeframe, from_datetime, to_datetime)
    except Exception as e:
        print(f"MT5 error: {e}")
        mt5.shutdown()
        return {"s": "no_data"}

    mt5.shutdown()

    if all_rates is None or len(all_rates) == 0:
        return {"s": "no_data"}

    # Prepare UDF response format
    t_values, o_values, h_values, l_values, c_values, v_values = [], [], [], [], [], []

    start_index = 0
    for i, rate in enumerate(all_rates):
        if rate['time'] >= _from:
            start_index = i
            break

    for i in range(start_index, len(all_rates)):
        current_rate = all_rates[i]

        # Open should be MT5 open
        o_values.append(current_rate['open'])

        t_values.append(int(current_rate['time']))
        h_values.append(current_rate['high'])
        l_values.append(current_rate['low'])
        c_values.append(current_rate['close'])
        v_values.append(current_rate['tick_volume'])



    return {
        "s": "ok",
        "t": t_values,
        "o": o_values,
        "h": h_values,
        "l": l_values,
        "c": c_values,
        "v": v_values
    }

@app.get("/time")
def get_current_time() -> int:
    """
    Returns the current server time as a plain UNIX timestamp (seconds).
    """
    return int(get_current_tick_time(ACTIVE_SYMBOL))

@app.get("/search")
def search_symbols(
    query: str = Query(..., description="Search query, e.g., eur"),
    _type: str = Query(None, alias="type", description="Type of symbol, e.g., forex"),
    limit: int = Query(10, description="Maximum number of results to return")
) -> List[Dict[str, str]]:
    """
    Searches for symbols matching the query and type.
    """
    if not mt5.initialize():
        raise HTTPException(status_code=500, detail="MT5 initialization failed")

    all_symbols = mt5.symbols_get()
    mt5.shutdown()

    if not all_symbols:
        return []

    results = []
    for s in all_symbols:
        # Filter by visibility and query. The s.name will already include the dot if present in MT5.
        if s.visible and query.lower() in s.name.lower():
            # Basic type filtering (MT5 doesn't have explicit 'forex' type)
            if _type and _type.lower() == "forex" and not (s.currency_base and s.currency_profit):
                continue

            results.append({
                "symbol": s.name,
                "full_name": f"MetaTrader5:{s.name}",
                "description": s.description,
                "exchange": "MetaTrader5",
                "ticker": s.name,
                "type": _type if _type else "unknown"
            })
        if len(results) >= limit:
            break
    return results

@app.get("/quotes")
def get_quotes(symbols: str = Query(..., description="Comma-separated list of symbols, e.g., EURUSD,USDJPY")) -> Dict[str, Any]:
    """
    Returns live price updates for a list of symbols.
    """
    # Split and apply dot suffix to each symbol in the list
    symbol_list_udf = [s.strip() for s in symbols.split(',') if s.strip()]
    symbol_list_mt5 = [_ensure_dot_suffix(s) for s in symbol_list_udf]

    if not mt5.initialize():
        raise HTTPException(status_code=500, detail="MT5 initialization failed")

    data = []
    for i, mt5_symbol_name in enumerate(symbol_list_mt5):
        # Use the original UDF symbol name for the 's' field in the response
        udf_symbol_name = symbol_list_udf[i]

        tick = mt5.symbol_info_tick(mt5_symbol_name)
        symbol_info = mt5.symbol_info(mt5_symbol_name)

        if tick and symbol_info:

            change = 0.0
            change_percent = 0.0

            if hasattr(symbol_info, '_daily_change') and symbol_info._daily_change is not None:
                point_value = symbol_info.point if symbol_info.point is not None else 0.00001
                trade_tick_value = symbol_info.trade_tick_value_profit_long if symbol_info.trade_tick_value_profit_long is not None else 1.0
                change = point_value * trade_tick_value * symbol_info._daily_change

            if hasattr(symbol_info, '_daily_change_percent') and symbol_info._daily_change_percent is not None:
                change_percent = symbol_info._daily_change_percent

            data.append({
                "s": udf_symbol_name,
                "p": tick.last,
                "v": tick.volume,
                "ch": change,
                "chp": change_percent
            })
        else:
            # If symbol info or tick data is not available, return zeros
            data.append({
                "s": udf_symbol_name,
                "p": 0.0,
                "v": 0,
                "ch": 0.0,
                "chp": 0.0
            })

    mt5.shutdown()
    return {"s": "ok", "d": data}

@app.get("/marks")
def get_marks(
    symbol: str = Query(...),
    _from: int = Query(..., alias="from"),
    to: int = Query(...),
    resolution: str = Query(...)
):
    url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
    try:
        events = requests.get(url, timeout=10).json()
    except Exception:
        events = load_list(JSON)  # Update with your actual fallback file path
    if resolution in [f"{i}H" for i in range(3, 60)] + [f"{i}D" for i in range(3, 60)] + ['1W']:
        events = []
    currencies = extract_currencies(symbol)
    marks = []

    for i, e in enumerate(events):
        try:
            ts = int(parser.isoparse(e["date"]).timestamp())
        except Exception:
            continue

        if ts < _from or ts > to:
            continue

        if e["country"] not in currencies:
            continue

        impact = e.get("impact", "")
        color = "green"
        if impact == "High":
            color = "red"
        elif impact == "Medium":
            color = "orange"

        marks.append({
            "id": str(i),
            "time": ts,
            "color": color,
            "text": f"{e['country']} - {e['title']}",
            "label": e["country"],
            "labelFontColor": "white"
        })

    return marks

@app.get("/timescale_marks")
def get_timescale_marks(
    symbol: str = Query(...),
    _from: int = Query(..., alias="from"),
    to: int = Query(...),
    resolution: str = Query(...)
):
    url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
    try:
        events = requests.get(url, timeout=10).json()
    except Exception:
        events = load_list(JSON)  # Update path

    if resolution in [f"{i}H" for i in range(3, 60)] + [f"{i}D" for i in range(1, 60)] + ['1W'] + [f"{i}" for i in range(120, 1300000)]:
        events = []
    currencies = extract_currencies(symbol)
    timescale_marks = []

    for i, e in enumerate(events):
        try:
            ts = int(parser.isoparse(e["date"]).timestamp())
        except Exception:
            continue

        if ts < _from or ts > to:
            continue

        if e["country"] not in currencies:
            continue

        impact = e.get("impact", "")
        color = C_LOW
        if impact == "High":
            color = C_HIGH
        elif impact == "Medium":
            color = C_MEDIUM

        timescale_marks.append({
            "id": str(i),
            "time": ts,
            "color": color,
            "label": e["country"],
            "tooltip": f"{e['country']} - {e['title']}"
        })

    return timescale_marks
