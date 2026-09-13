"""
conftest.py — Comprehensive Test Fixtures & Mock MT5 Environment
Supports both live MT5 terminal connections and deterministic high-fidelity mock fixtures.
"""

import pytest
import os
import sys
import time
import json
import subprocess
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional, Tuple, NamedTuple
import numpy as np
import pandas as pd
from unittest.mock import MagicMock, patch

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import jax
jax.config.update("jax_enable_x64", True)


class MockSymbolInfo:
    """Mock structure mimicking MetaTrader5.SymbolInfo namedtuple."""
    def __init__(
        self,
        name: str,
        digits: int = 5,
        point: float = 0.00001,
        spread: int = 12,
        trade_mode: int = 4,
        select: bool = True,
        visible: bool = True,
        bid: float = 1.08500,
        ask: float = 1.08512,
        last: float = 1.08506,
        volume_min: float = 0.01,
        volume_max: float = 100.0,
        volume_step: float = 0.01,
        description: str = "Euro vs US Dollar",
        path: str = "Forex\\EURUSD",
        currency_base: str = "EUR",
        currency_profit: str = "USD",
    ):
        self.name = name
        self.digits = digits
        self.point = point
        self.spread = spread
        self.trade_mode = trade_mode
        self.select = select
        self.visible = visible
        self.bid = bid
        self.ask = ask
        self.last = last
        self.volume_min = volume_min
        self.volume_max = volume_max
        self.volume_step = volume_step
        self.description = description
        self.path = path
        self.currency_base = currency_base
        self.currency_profit = currency_profit

    def _asdict(self):
        return {
            "name": self.name,
            "digits": self.digits,
            "point": self.point,
            "spread": self.spread,
            "trade_mode": self.trade_mode,
            "select": self.select,
            "visible": self.visible,
            "bid": self.bid,
            "ask": self.ask,
            "last": self.last,
            "description": self.description,
            "currency_base": self.currency_base,
            "currency_profit": self.currency_profit,
        }


class MockTick:
    """Mock structure for MetaTrader5.symbol_info_tick."""
    def __init__(self, time_sec: int, bid: float, ask: float, last: float, volume: int = 1):
        self.time = time_sec
        self.bid = bid
        self.ask = ask
        self.last = last
        self.volume = volume
        self.time_msc = time_sec * 1000
        self.flags = 6
        self.volume_real = float(volume)


class MockMT5Terminal:
    """
    High-fidelity in-memory MetaTrader 5 Terminal simulator.
    Provides realistic tick arrays, rate records, and symbol registries.
    """
    TIMEFRAME_M1 = 1
    TIMEFRAME_M2 = 2
    TIMEFRAME_M3 = 3
    TIMEFRAME_M4 = 4
    TIMEFRAME_M5 = 5
    TIMEFRAME_M6 = 6
    TIMEFRAME_M10 = 10
    TIMEFRAME_M12 = 12
    TIMEFRAME_M15 = 15
    TIMEFRAME_M20 = 20
    TIMEFRAME_M30 = 30
    TIMEFRAME_H1 = 16385
    TIMEFRAME_H2 = 16386
    TIMEFRAME_H3 = 16387
    TIMEFRAME_H4 = 16388
    TIMEFRAME_H6 = 16390
    TIMEFRAME_H8 = 16392
    TIMEFRAME_H12 = 16396
    TIMEFRAME_D1 = 16408
    TIMEFRAME_W1 = 32769
    TIMEFRAME_MN1 = 49153

    COPY_TICKS_ALL = -1
    COPY_TICKS_INFO = 1
    COPY_TICKS_TRADE = 2

    def __init__(self):
        self._initialized = False
        self._last_error = (1, "Success")
        self._should_fail_init = False
        self._should_fail_symbols = False
        self._custom_ticks = None
        self._custom_rates = None
        self._symbols_registry = {
            "EURUSD.": MockSymbolInfo("EURUSD.", 5, 0.00001, 10, description="Euro vs US Dollar (Dot)"),
            "EURUSD": MockSymbolInfo("EURUSD.", 5, 0.00001, 10, description="Euro vs US Dollar"),
            "GBPUSD.": MockSymbolInfo("GBPUSD.", 5, 0.00001, 12, bid=1.27500, ask=1.27515, description="Great Britain Pound vs US Dollar"),
            "XAUUSD.": MockSymbolInfo("XAUUSD.", 2, 0.01, 25, bid=2650.50, ask=2650.75, description="Gold vs US Dollar"),
            "USDIndex": MockSymbolInfo("USDIndex", 3, 0.001, 15, bid=104.250, ask=104.265, description="US Dollar Index"),
            "BTCUSD.": MockSymbolInfo("BTCUSD.", 2, 0.01, 50, bid=65000.00, ask=65005.00, description="Bitcoin vs US Dollar"),
        }

    def initialize(self, *args, **kwargs) -> bool:
        if self._should_fail_init:
            self._initialized = False
            self._last_error = (-10004, "Terminal connection failed")
            return False
        self._initialized = True
        self._last_error = (1, "Success")
        return True

    def shutdown(self) -> None:
        self._initialized = False

    def last_error(self) -> Tuple[int, str]:
        return self._last_error

    def symbol_info(self, symbol: str) -> Optional[MockSymbolInfo]:
        if not self._initialized or self._should_fail_symbols:
            return None
        if symbol in self._symbols_registry:
            return self._symbols_registry[symbol]
        # Check case-insensitive
        for k, v in self._symbols_registry.items():
            if k.lower() == symbol.lower():
                return v
        return None

    def symbol_info_tick(self, symbol: str) -> Optional[MockTick]:
        if not self._initialized:
            return None
        info = self.symbol_info(symbol)
        if not info:
            return None
        now_sec = int(time.time())
        return MockTick(now_sec, info.bid, info.ask, info.last)

    def symbols_get(self, group: Optional[str] = None) -> Optional[List[MockSymbolInfo]]:
        if not self._initialized or self._should_fail_symbols:
            return None
        return list(self._symbols_registry.values())

    def symbol_select(self, symbol: str, enable: bool = True) -> bool:
        if not self._initialized:
            return False
        info = self.symbol_info(symbol)
        if info:
            info.select = enable
            return True
        return False

    def copy_ticks_range(
        self,
        symbol: str,
        date_from: datetime,
        date_to: datetime,
        flags: int = -1
    ) -> Optional[np.ndarray]:
        if not self._initialized:
            return None
        if self._custom_ticks is not None:
            return self._custom_ticks

        # Generate realistic structured tick array
        t_from = int(date_from.timestamp()) if hasattr(date_from, "timestamp") else int(date_from)
        t_to = int(date_to.timestamp()) if hasattr(date_to, "timestamp") else int(date_to)
        if t_from >= t_to:
            return np.array([], dtype=self._tick_dtype())

        # Generate tick data spaced across time interval
        count = min(max(int((t_to - t_from) / 2), 50), 50000)
        times = np.linspace(t_from, t_to, count, dtype=np.int64)
        
        info = self.symbol_info(symbol) or MockSymbolInfo("DEFAULT")
        base_bid = info.bid
        # Random walk for prices
        np.random.seed(42)
        noise = np.cumsum(np.random.normal(0, info.point * 2, count))
        bids = base_bid + noise
        asks = bids + info.spread * info.point
        lasts = bids + (asks - bids) / 2.0
        volumes = np.random.randint(1, 10, count)

        records = np.zeros(count, dtype=self._tick_dtype())
        records["time"] = times
        records["bid"] = bids
        records["ask"] = asks
        records["last"] = lasts
        records["volume"] = volumes
        records["time_msc"] = times * 1000 + np.random.randint(0, 999, count)
        records["flags"] = 6
        records["volume_real"] = volumes.astype(np.float64)

        return records

    def copy_ticks_from(
        self,
        symbol: str,
        date_from: datetime,
        count: int,
        flags: int = -1
    ) -> Optional[np.ndarray]:
        if not self._initialized:
            return None
        t_from = int(date_from.timestamp()) if isinstance(date_from, datetime) else int(date_from)
        times = np.arange(t_from, t_from + count, dtype=np.int64)
        info = self.symbol_info(symbol) or MockSymbolInfo("DEFAULT")
        
        records = np.zeros(count, dtype=self._tick_dtype())
        records["time"] = times
        records["bid"] = np.full(count, info.bid)
        records["ask"] = np.full(count, info.ask)
        records["last"] = np.full(count, info.last)
        records["volume"] = np.ones(count, dtype=np.uint64)
        records["time_msc"] = times * 1000
        records["flags"] = 6
        records["volume_real"] = np.ones(count, dtype=np.float64)
        return records

    def copy_rates_range(
        self,
        symbol: str,
        timeframe: int,
        date_from: datetime,
        date_to: datetime
    ) -> Optional[np.ndarray]:
        if not self._initialized:
            return None
        if self._custom_rates is not None:
            return self._custom_rates

        t_from = int(date_from.timestamp()) if isinstance(date_from, datetime) else int(date_from)
        t_to = int(date_to.timestamp()) if isinstance(date_to, datetime) else int(date_to)
        if t_from >= t_to:
            return np.array([], dtype=self._rate_dtype())

        # Map timeframe to step seconds
        step_seconds = self._timeframe_to_seconds(timeframe)
        if (t_to - t_from) // max(1, step_seconds) > 50000:
            t_from = t_to - 50000 * step_seconds
        timestamps = np.arange(t_from - (t_from % step_seconds), t_to, step_seconds, dtype=np.int64)
        count = len(timestamps)
        if count == 0:
            return np.array([], dtype=self._rate_dtype())

        info = self.symbol_info(symbol) or MockSymbolInfo("DEFAULT")
        base_price = info.bid
        np.random.seed(123)
        walk = base_price + np.cumsum(np.random.normal(0, info.point * 5, count))
        
        opens = walk
        closes = walk + np.random.normal(0, info.point * 3, count)
        highs = np.maximum(opens, closes) + np.abs(np.random.normal(0, info.point * 4, count))
        lows = np.minimum(opens, closes) - np.abs(np.random.normal(0, info.point * 4, count))
        volumes = np.random.randint(10, 500, count)

        records = np.zeros(count, dtype=self._rate_dtype())
        records["time"] = timestamps
        records["open"] = opens
        records["high"] = highs
        records["low"] = lows
        records["close"] = closes
        records["tick_volume"] = volumes
        records["spread"] = np.full(count, info.spread)
        records["real_volume"] = volumes.astype(np.int64)

        return records

    def _tick_dtype(self):
        return np.dtype([
            ("time", "<i8"),
            ("bid", "<f8"),
            ("ask", "<f8"),
            ("last", "<f8"),
            ("volume", "<u8"),
            ("time_msc", "<i8"),
            ("flags", "<u4"),
            ("volume_real", "<f8"),
        ])

    def _rate_dtype(self):
        return np.dtype([
            ("time", "<i8"),
            ("open", "<f8"),
            ("high", "<f8"),
            ("low", "<f8"),
            ("close", "<f8"),
            ("tick_volume", "<u8"),
            ("spread", "<i4"),
            ("real_volume", "<u8"),
        ])

    def _timeframe_to_seconds(self, tf: int) -> int:
        mapping = {
            self.TIMEFRAME_M1: 60,
            self.TIMEFRAME_M5: 300,
            self.TIMEFRAME_M15: 900,
            self.TIMEFRAME_M30: 1800,
            self.TIMEFRAME_H1: 3600,
            self.TIMEFRAME_H4: 14400,
            self.TIMEFRAME_D1: 86400,
            self.TIMEFRAME_W1: 604800,
            self.TIMEFRAME_MN1: 2592000,
        }
        return mapping.get(tf, 60)


@pytest.fixture(scope="session")
def mock_mt5_singleton():
    """Returns a singleton MockMT5Terminal instance."""
    terminal = MockMT5Terminal()
    terminal.initialize()
    return terminal


@pytest.fixture(autouse=True)
def patch_mt5(mock_mt5_singleton):
    """
    Autouse fixture that patches MetaTrader5 across server, ticks, and seconds modules.
    Ensures deterministic, fast, offline-capable unit and integration testing.
    """
    import MetaTrader5 as real_mt5
    import server
    try:
        import seconds
    except ImportError:
        seconds = None

    mock = mock_mt5_singleton
    mock.initialize()

    patches = [
        patch("MetaTrader5.initialize", side_effect=mock.initialize),
        patch("MetaTrader5.shutdown", side_effect=mock.shutdown),
        patch("MetaTrader5.last_error", side_effect=mock.last_error),
        patch("MetaTrader5.symbol_info", side_effect=mock.symbol_info),
        patch("MetaTrader5.symbol_info_tick", side_effect=mock.symbol_info_tick),
        patch("MetaTrader5.symbols_get", side_effect=mock.symbols_get),
        patch("MetaTrader5.symbol_select", side_effect=mock.symbol_select),
        patch("MetaTrader5.copy_ticks_range", side_effect=mock.copy_ticks_range),
        patch("MetaTrader5.copy_ticks_from", side_effect=mock.copy_ticks_from),
        patch("MetaTrader5.copy_rates_range", side_effect=mock.copy_rates_range),
    ]

    for p in patches:
        p.start()

    yield mock

    for p in patches:
        p.stop()


@pytest.fixture
def client(patch_mt5):
    """FastAPI TestClient fixture."""
    from fastapi.testclient import TestClient
    import server
    with TestClient(server.app) as c:
        yield c


class NodePineTranspilerBridge:
    """Bridge for executing and testing Pine Script transpilation via Node.js."""

    @staticmethod
    def transpile_script(pine_code: str) -> Dict[str, Any]:
        """
        Executes transpilation of Pine Script code using Node.js.
        Checks pine_engine.js or prototype transpiler.
        """
        pine_engine_path = os.path.join(PROJECT_ROOT, "pine_engine.js")
        if not os.path.exists(pine_engine_path):
            deleted_path = os.path.join(PROJECT_ROOT, "DELETED", "pine_engine.js")
            if os.path.exists(deleted_path):
                pine_engine_path = deleted_path
        prototype_path = os.path.join(PROJECT_ROOT, ".agents", "explorer_pine_engine", "test_transpiler.js")

        runner_js = f"""
        const fs = require('fs');
        let TranspilerClass = null;

        if (fs.existsSync({json.dumps(pine_engine_path)})) {{
            try {{
                const engine = require({json.dumps(pine_engine_path)});
                TranspilerClass = engine.PineTranspiler || (global.PineEngine && global.PineEngine.Transpiler);
            }} catch (e) {{}}
        }}

        if (!TranspilerClass && fs.existsSync({json.dumps(prototype_path)})) {{
            const code = fs.readFileSync({json.dumps(prototype_path)}, 'utf8');
            const evalScope = {{}};
            // Run prototype
            const script = new (require('vm').Script)(code + '\\nmodule.exports = PineTranspiler;');
            const context = {{ console, require, module: {{ exports: {{}} }}, Set, Map, Array, Object, String, Number, RegExp }};
            script.runInNewContext(context);
            TranspilerClass = context.module.exports;
        }}

        if (!TranspilerClass) {{
            console.log(JSON.stringify({{ error: "No transpiler implementation found" }}));
            process.exit(0);
        }}

        const transpiler = new TranspilerClass();
        const result = transpiler.transpile({json.dumps(pine_code)});
        console.log(JSON.stringify(result));
        """

        try:
            res = subprocess.run(
                ["node", "-e", runner_js],
                capture_output=True,
                text=True,
                timeout=30,
                check=True
            )
            out = json.loads(res.stdout.strip())
            return out
        except Exception as e:
            return {"error": str(e), "metainfo": None}


@pytest.fixture
def pine_bridge():
    """Fixture providing NodePineTranspilerBridge."""
    return NodePineTranspilerBridge()


@pytest.fixture
def sample_pine_scripts():
    """Provides valid and invalid Pine Script v5 test snippets."""
    return {
        "ema_cross": """//@version=5
indicator("EMA Cross Strategy", overlay=true)

fastLen = input.int(9, "Fast EMA Length", minval=1)
slowLen = input.int(21, "Slow EMA Length", minval=1)

fastEMA = ta.ema(close, fastLen)
slowEMA = ta.ema(close, slowLen)

bullish = ta.crossover(fastEMA, slowEMA)
bearish = ta.crossunder(fastEMA, slowEMA)

plot(fastEMA, "Fast EMA", color=color.green, linewidth=2)
plot(slowEMA, "Slow EMA", color=color.red, linewidth=2)
plotshape(bullish, "Buy Signal", style=shape.triangleup, location=location.belowbar, color=color.green)
plotshape(bearish, "Sell Signal", style=shape.triangledown, location=location.abovebar, color=color.red)
""",
        "rsi": """//@version=5
indicator("RSI Indicator", overlay=false, precision=2)

length = input.int(14, "RSI Length", minval=1)
rsiVal = ta.rsi(close, length)

plot(rsiVal, "RSI", color=color.purple, linewidth=2)
hline(70, "Overbought", color=color.red, linestyle=hline.style_dotted)
hline(30, "Oversold", color=color.green, linestyle=hline.style_dotted)
""",
        "macd": """//@version=5
indicator("MACD Oscillator", overlay=false)

fastLen = input.int(12, "Fast Length", minval=1)
slowLen = input.int(26, "Slow Length", minval=1)
sigLen = input.int(9, "Signal Length", minval=1)

[macd, signal, hist] = ta.macd(close, fastLen, slowLen, sigLen)

plot(macd, "MACD", color=color.blue, linewidth=2)
plot(signal, "Signal", color=color.orange, linewidth=2)
plot(hist, "Histogram", color=color.gray, linewidth=1, style=plot.style_histogram)
""",
        "bollinger_bands": """//@version=5
indicator("Bollinger Bands", overlay=true)

length = input.int(20, "Length", minval=1)
mult = input.float(2.0, "Multiplier", minval=0.1, maxval=50.0)

[basis, upper, lower] = ta.bb(close, length, mult)

plot(basis, "Basis", color=color.orange, linewidth=1)
plot(upper, "Upper", color=color.blue, linewidth=1)
plot(lower, "Lower", color=color.blue, linewidth=1)
""",
        "supertrend": """//@version=5
indicator("SuperTrend", overlay=true)

atrPeriod = input.int(10, "ATR Length", minval=1)
factor = input.float(3.0, "Factor", minval=0.1, step=0.1)

[superTrend, direction] = ta.supertrend(factor, atrPeriod)

plot(direction < 0 ? superTrend : na, "Up Trend", color=color.green, style=plot.style_linebr)
plot(direction > 0 ? superTrend : na, "Down Trend", color=color.red, style=plot.style_linebr)
""",
        "invalid_no_header": """
fastLen = input.int(9, "Fast")
plot(close)
""",
        "invalid_unclosed_paren": """//@version=5
indicator("Broken", overlay=true)
fast = ta.ema(close, 14
plot(fast)
""",
        "invalid_unknown_function": """//@version=5
indicator("Unknown Function", overlay=true)
x = ta.non_existent_magic_math(close)
plot(x)
"""
    }
