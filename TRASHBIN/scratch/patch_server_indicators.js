const fs = require('fs');
const path = require('path');

const serverPyPath = path.resolve('e:/TRADINGVIEW ADVANCED/server.py');
let code = fs.readFileSync(serverPyPath, 'utf8');
const isCrlf = code.includes('\r\n');
if (isCrlf) code = code.replace(/\r\n/g, '\n');

// 1. Add import indicators_engine
const oldImport = "from mt5_bridge_server import mt5_bridge";
const newImport = `from mt5_bridge_server import mt5_bridge
import indicators_engine`;

if (!code.includes(oldImport)) {
  console.error('Import target not found!');
  process.exit(1);
}
code = code.replace(oldImport, newImport);

// 2. Add indicators to UDF_API_PREFIXES
const oldPrefixes = `"openapi.json", "docs", "redoc", "pine", "pine-converter"`;
const newPrefixes = `"openapi.json", "docs", "redoc", "pine", "pine-converter", "indicators"`;

if (!code.includes(oldPrefixes)) {
  console.error('Prefixes target not found!');
  process.exit(1);
}
code = code.replace(oldPrefixes, newPrefixes);

// 3. Add indicator endpoints
const targetSearch = `@app.get("/search")`;
const endpointsCode = `
@app.get("/indicators/list")
@app.get("/api/indicators/list")
async def list_available_indicators() -> Response:
    """Return catalog of server-side high performance indicators."""
    catalog = [
        {"id": "SMA", "name": "Simple Moving Average", "overlay": True, "params": {"length": 14}},
        {"id": "EMA", "name": "Exponential Moving Average", "overlay": True, "params": {"length": 14}},
        {"id": "WMA", "name": "Weighted Moving Average", "overlay": True, "params": {"length": 14}},
        {"id": "HMA", "name": "Hull Moving Average", "overlay": True, "params": {"length": 14}},
        {"id": "DEMA", "name": "Double EMA", "overlay": True, "params": {"length": 14}},
        {"id": "TEMA", "name": "Triple EMA", "overlay": True, "params": {"length": 14}},
        {"id": "RSI", "name": "Relative Strength Index", "overlay": False, "params": {"length": 14}},
        {"id": "MACD", "name": "Moving Average Convergence Divergence", "overlay": False, "params": {"fast": 12, "slow": 26, "signal": 9}},
        {"id": "BB", "name": "Bollinger Bands", "overlay": True, "params": {"length": 20, "mult": 2.0}},
        {"id": "ATR", "name": "Average True Range", "overlay": False, "params": {"length": 14}},
        {"id": "SUPERTREND", "name": "Supertrend", "overlay": True, "params": {"length": 10, "mult": 3.0}},
        {"id": "STOCH", "name": "Stochastic Oscillator", "overlay": False, "params": {"k_len": 14, "k_smooth": 3, "d_len": 3}},
        {"id": "STOCHRSI", "name": "Stochastic RSI", "overlay": False, "params": {"rsi_len": 14, "stoch_len": 14, "k_smooth": 3, "d_smooth": 3}},
        {"id": "VWAP", "name": "Volume Weighted Average Price", "overlay": True, "params": {}},
        {"id": "PIVOT", "name": "Pivot Points Standard", "overlay": True, "params": {}},
        {"id": "CCI", "name": "Commodity Channel Index", "overlay": False, "params": {"length": 20}},
        {"id": "ADX", "name": "Average Directional Index / DMI", "overlay": False, "params": {"length": 14}},
        {"id": "MOMENTUM", "name": "Momentum", "overlay": False, "params": {"length": 10}},
        {"id": "ROC", "name": "Rate of Change", "overlay": False, "params": {"length": 14}},
        {"id": "ICHIMOKU", "name": "Ichimoku Cloud", "overlay": True, "params": {}},
        {"id": "DONCHIAN", "name": "Donchian Channels", "overlay": True, "params": {"length": 20}},
        {"id": "WILLIAMS_R", "name": "Williams %R", "overlay": False, "params": {"length": 14}},
    ]
    return Response(
        content=orjson.dumps({"status": "ok", "count": len(catalog), "indicators": catalog}),
        media_type="application/json",
        headers={"Cache-Control": "public, max-age=3600"}
    )


@app.get("/indicators/compute")
@app.get("/api/indicators/compute")
@app.post("/api/indicators/compute")
async def compute_server_indicator(
    symbol: str = Query("XAUUSD.", description="Symbol name"),
    resolution: str = Query("1", description="Resolution / timeframe"),
    indicator: str = Query("SMA", description="Indicator name e.g. SMA, EMA, RSI, MACD, BB, ATR, SUPERTREND, VWAP"),
    params: Optional[str] = Query(None, description="Optional JSON string of parameters"),
    bars: int = Query(1000, description="Number of bars to calculate"),
    to: Optional[int] = Query(None, description="To timestamp in seconds"),
    request: Request = None
) -> Response:
    """
    High-performance server-side indicator computation endpoint.
    Computes technical indicators in vectorized NumPy/Pandas over live MT5 market rates.
    Offloads 90%+ of math processing from the browser to the backend.
    """
    ensure_mt5()
    resolved = resolve_symbol(symbol)
    
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
                resolved = resolve_symbol(symbol)
        except Exception:
            pass

    norm_res = resolution.upper()
    if norm_res == "D": norm_res = "1D"
    elif norm_res == "W": norm_res = "1W"
    elif norm_res == "M": norm_res = "1M"

    mt5_tf = UDF_RESOLUTION_TO_MT5_TIMEFRAME.get(norm_res, mt5.TIMEFRAME_M1)
    safe_count = min(10000, max(50, bars))

    hours_offset = get_broker_timezone_offset(resolved)
    
    t0 = time.perf_counter()
    rates = None
    if to is not None:
        safe_to_broker = int(to + hours_offset)
        rates = mt5.copy_rates_from(resolved, mt5_tf, safe_to_broker, safe_count)
    if rates is None or len(rates) == 0:
        rates = mt5.copy_rates_from_pos(resolved, mt5_tf, 0, safe_count)

    if rates is None or len(rates) == 0:
        return Response(content=orjson.dumps({"s": "no_data", "detail": f"No rates available for {symbol}"}), media_type="application/json")

    rates_copy = rates.copy()
    rates_copy['time'] = rates_copy['time'] - hours_offset

    result = indicators_engine.compute_indicator(indicator, rates_copy, param_dict)
    dt_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    result["status"] = "ok"
    result["symbol"] = symbol
    result["resolution"] = resolution
    result["compute_time_ms"] = dt_ms

    return Response(
        content=orjson.dumps(result),
        media_type="application/json",
        headers={
            "Cache-Control": "public, max-age=5, stale-while-revalidate=15"
        }
    )


@app.get("/search")`;

if (!code.includes(targetSearch)) {
  console.error('Search target not found!');
  process.exit(1);
}
code = code.replace(targetSearch, endpointsCode);

if (isCrlf) code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(serverPyPath, code, 'utf8');
console.log('Successfully patched server.py with indicator endpoints!');
