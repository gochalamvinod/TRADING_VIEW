# Comprehensive Investigation Report: TradingView Native "Security Info" Dialog Specifications & Missing Metadata Root Cause Analysis

## Executive Summary
This investigation analyzed why instrument specifications (specifically **Point value**, **Currency**, **Pip size**, and **Tick size**) display as dashes (`-`) or disappear in TradingView's native "Security Info" dialog.

By reverse-engineering TradingView Charting Library bundles (`charting_library/bundles/symbol-info-dialog-impl.23e8feddd0326a1feabb.js`, `library.e8d44337c84d65489d2c.js`, `en.8622.9181e2b364297c860b4f.js`, and `datafeeds/udf/dist/bundle.js`), we mapped the exact property names, getters, formatters, and mathematical formulas required by the dialog.

### Key Finding
The primary root cause is that **`server.py`'s `/symbols` endpoint completely omits `pointvalue`, `currency_code`, `original_currency_code`, `minmove2`, `pip_size`, and `tick_size`**, and `index.html`'s `datafeed.resolveSymbol` wrapper only injects resolution multipliers without populating or defaulting these essential instrument specifications.

---

## 1. TradingView Security Info Dialog Reverse-Engineering

In `charting_library/bundles/symbol-info-dialog-impl.23e8feddd0326a1feabb.js` (lines ~33500 to ~38000), the native Security Info dialog builds its row definitions as follows:

```javascript
// Field list definition in symbol-info-dialog-impl.js:
[
  // Group 1: Identity & Categorization
  { title: "Symbol Name",      group: 1, propName: "name" },
  { title: "Description",      group: 1, propName: "description" },
  { title: "Current contract", group: 1, propName: "front_contract", visibility: () => false },
  { title: "Sector",           group: 1, propName: "sector" },
  { title: "Industry",         group: 1, propName: "industry" },

  // Group 2: Financial & Trading Specifications
  { title: "Type",             group: 2, propName: "type", getter: se },
  { title: "Point value",      group: 2, propName: "pointvalue" }, // Direct lookup
  { title: "Listed exchange",  group: 2, propName: "listed_exchange" },
  { title: "Exchange",         group: 2, propName: "exchange" },
  { title: "Currency",         group: 2, propName: "currency_code",
    getter: (e, t) => symbolOriginalCurrency(e, true),
    visibility: (e, t) => Boolean(symbolOriginalCurrency(e, true)),
    formatter: e => e ?? "", defValue: ""
  },
  { title: "Unit",             group: 2, propName: "unit_id",
    getter: (t, n) => unitDescription(symbolOriginalUnit(t, true)),
    visibility: (t, n) => Boolean(symbolOriginalUnit(t, true))
  },
  { title: "Pip size",         group: 2, propName: "pip_size",
    getter: re,
    visibility: oe
  },
  { title: "Tick size",        group: 2, propName: "tick_size",
    getter: ie
  }
]
```

### Rendering & Fallback Mechanism
When retrieving values:
```javascript
_defaultFormatter(e) {
    return e?.toString() ?? "-"
}
_retrieveValues(e, t, n) {
    const o = n ?? t; // t is symbolInfo
    for (let r = 0; r < e.length; r++) {
        const i = e[r].getter;
        if (i) {
            const val = i(t, n);
            if (val !== null) this._setFieldValue(e[r], val);
            continue;
        }
        const l = e[r].propName;
        if (l in o) {
            this._setFieldValue(e[r], (e[r].formatter || this._defaultFormatter)(o[l]));
        }
    }
}
```
And in row rendering:
```javascript
const n = function(e) {
    const t = e.value || e.defValue || "-";
    return !1 === e.capitalize || Array.isArray(t) ? t : capitalizeFirstLetter(t);
}(e);
```

---

## 2. Root Cause Analysis for Each Specification

### 2.1 `pointvalue` (Point value)
- **Dialog Code**: `{ title: "Point value", group: 2, propName: "pointvalue" }`
- **Mechanism**: Has no custom getter. It looks up `symbolInfo["pointvalue"]`. If `"pointvalue" in symbolInfo` is false, `e.value` remains undefined, which triggers the fallback:
  `const t = e.value || e.defValue || "-";` $\rightarrow$ displays **`-`**.
- **Current `server.py` / `/symbols` Output**:
  ```python
  # server.py line 705-735
  meta = {
      "name": symbol_info.name,
      "ticker": symbol_info.name,
      # ... pointvalue IS COMPLETELY OMITTED ...
  }
  ```
- **Live MT5 Source**: MT5 provides `symbol_info.trade_contract_size`:
  - `XAUUSD.`: `trade_contract_size = 100.0` $\rightarrow$ Contract size / Point value = **100**
  - `EURUSD.`: `trade_contract_size = 100000.0` $\rightarrow$ Contract size / Point value = **100,000**
  - `BTCUSD`: `trade_contract_size = 1.0` $\rightarrow$ Contract size / Point value = **1**

### 2.2 `currency_code` & `original_currency_code` (Currency)
- **Dialog Code**:
  ```javascript
  {
    title: "Currency", group: 2, propName: "currency_code",
    getter: (e, t) => symbolOriginalCurrency(e, true),
    visibility: (e, t) => Boolean(symbolOriginalCurrency(e, true))
  }
  ```
- **Mechanism in `library.js`**:
  `symbolOriginalCurrency(e, true)` resolves:
  `(true ? e.original_currency_code : e.original_currency_id) ?? (e.currency_code ?? null)`
- **Failure Cause**:
  `server.py` `/symbols` provides neither `currency_code` nor `original_currency_code` nor `currency_id`.
  Consequently, `symbolOriginalCurrency(e, true)` returns `null`.
  `visibility` evaluates to `Boolean(null)` $\rightarrow$ `false`, so the Currency field is either stripped completely by `_removeHiddenFields` or rendered as `"-"` / blank.
- **Live MT5 Source**:
  - `symbol_info.currency_profit`: Profit/quote currency (e.g. `"USD"`)
  - `symbol_info.currency_base`: Base currency (e.g. `"EUR"` for EURUSD, `"USD"` for Gold/Crypto)

### 2.3 `pip_size` (Pip size)
- **Dialog Code**:
  ```javascript
  { title: "Pip size", group: 2, propName: "pip_size", getter: re, visibility: oe }
  ```
- **Exact Calculation Functions in `symbol-info-dialog-impl.js`**:
  ```javascript
  function oe(e, t) {
      return (e.minmove2 ?? 0) > 0 && !e.fractional && 0 !== e.pricescale;
  }
  function re(e, t) {
      return oe(e) && void 0 !== e.pricescale 
          ? new ee.PriceFormatter({
              priceScale: e.pricescale / (0, J.ensureDefined)(e.minmove2)
            }).format((0, J.ensureDefined)(e.minmove2) / e.pricescale) 
          : null;
  }
  ```
- **Crucial Mathematical Insight**:
  TradingView **does NOT** read a property called `symbolInfo.pip_size` to render this field in the dialog!
  Instead, TradingView calculates Pip size strictly as:
  $$\text{Pip Size} = \frac{\text{minmove2}}{\text{pricescale}}$$
  Formatted using `priceScale = pricescale / minmove2`.
  - If `minmove2` is undefined, `0`, or missing:
    `oe(e)` evaluates to `(undefined ?? 0) > 0` $\rightarrow$ **`false`**.
    Because `visibility: oe` is false, `_removeHiddenFields` removes the Pip size field or `re` returns `null`, displaying `"-"`!
- **Target Calculations**:
  1. **5-Digit Forex (`EURUSD.`)**:
     - `pricescale = 100000` (5 decimals)
     - Standard pip = `0.0001`
     - $\text{minmove2} = \text{pricescale} \times 0.0001 = 100000 \times 0.0001 = \mathbf{10}$
     - Formatter `priceScale = 100000 / 10 = 10000` (4 decimals)
     - Formatted text: `10 / 100000` = **`"0.0001"`**
  2. **3-Digit JPY Pairs (`USDJPY.`)**:
     - `pricescale = 1000` (3 decimals)
     - Standard pip = `0.01`
     - $\text{minmove2} = \text{pricescale} \times 0.01 = 1000 \times 0.01 = \mathbf{10}$
     - Formatter `priceScale = 1000 / 10 = 100` (2 decimals)
     - Formatted text: `10 / 1000` = **`"0.01"`**
  3. **Gold (`XAUUSD.`)**:
     - `pricescale = 100` (2 decimals)
     - Standard pip = `0.01`
     - $\text{minmove2} = \text{pricescale} \times 0.01 = 100 \times 0.01 = \mathbf{1}$
     - Formatter `priceScale = 100 / 1 = 100` (2 decimals)
     - Formatted text: `1 / 100` = **`"0.01"`**
  4. **Crypto (`BTCUSD`)**:
     - `pricescale = 100` (2 decimals)
     - Standard pip = `0.01` (or $1.00)
     - $\text{minmove2} = 1$
     - Formatted text: `1 / 100` = **`"0.01"`**

### 2.4 `tick_size` (Tick size)
- **Dialog Code**:
  ```javascript
  { title: "Tick size", group: 2, propName: "tick_size", getter: ie }
  ```
- **Exact Calculation Function in `symbol-info-dialog-impl.js`**:
  ```javascript
  function ie(e, t) {
      const { minmov: o, pricescale: r, fractional: s, minmove2: a } = e;
      if (void 0 === o || void 0 === r) return null;
      if (s && r && o) return a ? ... : `${o}/${r}`;
      const { variable_tick_size: l, ...c } = e;
      return (0, Y.createSeriesFormatter)(c, "default").format(o / r);
  }
  ```
- **Mechanism**:
  Tick size is calculated as $\frac{\text{minmov}}{\text{pricescale}}$ formatted via series price formatter with `pricescale`.
  In MT5, `trade_tick_size` represents the broker's minimum tick movement.
  - `XAUUSD.`: `trade_tick_size = 0.01`, `pricescale = 100` $\rightarrow \text{minmov} = \text{round}(0.01 \times 100) = 1$. $\frac{1}{100} = \mathbf{0.01}$.
  - `EURUSD.`: `trade_tick_size = 0.00001`, `pricescale = 100000` $\rightarrow \text{minmov} = \text{round}(0.00001 \times 100000) = 1$. $\frac{1}{100000} = \mathbf{0.00001}$.
  - `BTCUSD`: `trade_tick_size = 0.01`, `pricescale = 100` $\rightarrow \text{minmov} = \text{round}(0.01 \times 100) = 1$. $\frac{1}{100} = \mathbf{0.01}$.
- In `server.py`:
  `minmov` was hardcoded to `1`, but `trade_tick_size` and explicit `tick_size` properties were not exposed.

---

## 3. Datafeed & Broker Flow Analysis

1. **Backend (`server.py` `/symbols`)**:
   Returns raw metadata dictionary over HTTP.
2. **UDF Protocol Client (`datafeeds/udf/dist/bundle.js`)**:
   Executes `this._send("symbols", t)` and creates `LibrarySymbolInfo`:
   ```javascript
   a({
     ...e,
     name: s,
     base_name: [t + ":" + s],
     listed_exchange: t,
     exchange: r,
     ticker: e.ticker,
     currency_code: e.currency_code ?? e["currency-code"],
     original_currency_code: e.original_currency_code ?? e["original-currency-code"],
     unit_id: e.unit_id ?? e["unit-id"],
     original_unit_id: e.original_unit_id ?? e["original-unit-id"],
     minmov: e.minmovement ?? e.minmov ?? 0,
     minmove2: e.minmovement2 ?? e.minmove2,
     ...
   })
   ```
   Notice that the UDF client preserves all extra properties via `...e`, and specifically passes `currency_code`, `original_currency_code`, and `minmove2`!
3. **Frontend Resolution Hook (`index.html`)**:
   `datafeed.resolveSymbol` intercepts the resolved `symbolInfo` before handing it to TradingView. Currently it only injects resolution multipliers.
4. **Broker Adapter (`mt5_broker.js`)**:
   Calls `/symbols` in its `symbolInfo(symbol)` method:
   Currently lines 218-220 have:
   ```javascript
   pipValue: minTick * 100 || 1,
   pipSize: minTick * 10 || 0.1,
   ```
   For `XAUUSD.` (`minTick = 0.01`), this computed `pipSize = 0.1` instead of `0.01`.
   Once `/symbols` returns `pip_size`, `tick_size`, and `pointvalue`, `mt5_broker.js` can read the exact MT5 values directly.

---

## 4. Comprehensive Fix Proposal

### Fix 1: `server.py` `/symbols` Endpoint
Enrich `meta` in `server.py` (around line 705) using live MT5 `symbol_info`:

```python
    # Determine accurate quote/base currency
    quote_currency = symbol_info.currency_profit or "USD"
    base_currency = symbol_info.currency_base or ("EUR" if "EUR" in symbol_info.name else "USD")

    # Contract size / Point value
    contract_size = symbol_info.trade_contract_size if symbol_info.trade_contract_size > 0 else (100000.0 if is_forex else 1.0)
    pointvalue = int(contract_size) if contract_size.is_integer() else contract_size

    # Tick size & minmov calculation
    tick_size = symbol_info.trade_tick_size if (symbol_info.trade_tick_size and symbol_info.trade_tick_size > 0) else (1.0 / pricescale)
    minmov = max(1, int(round(tick_size * pricescale)))

    # minmove2 & Pip size calculation
    # For 5-digit forex (1.16280) or 3-digit JPY (155.250), 1 pip = 10 points -> minmove2 = 10
    # For Gold (4398.78), Crypto (78785.33), 1 pip = 0.01 -> minmove2 = 1
    if is_forex and symbol_info.digits in (3, 5):
        minmove2 = 10
    else:
        minmove2 = 1

    pip_size = minmove2 / pricescale

    meta = {
        "name": symbol_info.name,
        "ticker": symbol_info.name,
        "description": symbol_info.description or symbol_info.name,
        "type": "forex" if is_forex else "cfd",
        "session": "24x7",
        "exchange": "MetaTrader5",
        "listed_exchange": "MetaTrader5",
        "timezone": "Etc/UTC",

        # Scale and formatting
        "minmov": minmov,
        "minmovement": minmov,
        "pricescale": pricescale,
        "minmove2": minmove2,
        "minmovement2": minmove2,
        "fractional": False,

        # Specifications required by TradingView Security Info dialog
        "pointvalue": pointvalue,
        "currency_code": quote_currency,
        "original_currency_code": quote_currency,
        "currency_id": quote_currency,
        "original_currency_id": quote_currency,
        "base_currency": base_currency,
        "quote_currency": quote_currency,
        "unit_id": "",
        "original_unit_id": "",
        "pip_size": pip_size,
        "pipSize": pip_size,
        "tick_size": tick_size,
        "minTick": tick_size,

        # Contract & broker limits
        "contract_size": pointvalue,
        "lot_size": pointvalue,
        "trade_tick_size": tick_size,
        "trade_tick_value": symbol_info.trade_tick_value,
        "volume_min": symbol_info.volume_min,
        "volume_max": symbol_info.volume_max,
        "volume_step": symbol_info.volume_step,

        # Resolutions
        "has_intraday": True,
        "intraday_multipliers": ["1", "3", "5", "15", "30", "60", "120", "240"],
        "has_seconds": True,
        "seconds_multipliers": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12", "15", "20", "21", "24", "25", "27", "30", "45", "60"],
        "has_ticks": True,
        "is-tickbars-available": True,
        "is_tickbars_available": True,
        "tick_multipliers": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12", "15", "20", "25", "30", "40", "50", "60", "75", "100", "200", "500", "1000"],
        "ticks_multipliers": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12", "15", "20", "25", "30", "40", "50", "60", "75", "100", "200", "500", "1000"],
        "has_daily": True,
        "daily_multipliers": ["1"],
        "has_weekly_and_monthly": True,
        "weekly_multipliers": ["1"],
        "monthly_multipliers": ["1", "3", "6", "12"],
        "has_empty_bars": False,
        "has_no_volume": False,
        "volume_precision": 0,
        "supported_resolutions": SUPPORTED_RESOLUTIONS,
        "format": "price"
    }
```

### Fix 2: `index.html` Frontend `resolveSymbol` Hook
In `index.html` (lines 815-862), add a safety fallback layer in `datafeed.resolveSymbol` so that even if the backend cache returns old metadata or client transitions symbols:

```javascript
        datafeed.resolveSymbol = function(symbolName, onSymbolResolvedCallback, onResolveErrorCallback, extension) {
          origResolveSymbol(symbolName, function(symbolInfo) {
            // ── Guarantee Security Info Metadata Completeness ──────────────────
            const sym = (symbolInfo.name || symbolName || "").toUpperCase();

            // 1. Point value (Contract size)
            if (symbolInfo.pointvalue === undefined || symbolInfo.pointvalue === null || isNaN(symbolInfo.pointvalue)) {
              if (sym.startsWith("XAU") || sym.startsWith("GOLD")) {
                symbolInfo.pointvalue = 100;
              } else if (sym.startsWith("BTC")) {
                symbolInfo.pointvalue = 1;
              } else if (symbolInfo.type === "forex" || symbolInfo.pricescale === 100000 || symbolInfo.pricescale === 1000) {
                symbolInfo.pointvalue = 100000;
              } else {
                symbolInfo.pointvalue = 1;
              }
            }

            // 2. Currency Codes
            if (!symbolInfo.currency_code) {
              symbolInfo.currency_code = symbolInfo.quote_currency || "USD";
            }
            if (!symbolInfo.original_currency_code) {
              symbolInfo.original_currency_code = symbolInfo.currency_code;
            }
            if (!symbolInfo.currency_id) {
              symbolInfo.currency_id = symbolInfo.currency_code;
            }
            if (!symbolInfo.original_currency_id) {
              symbolInfo.original_currency_id = symbolInfo.currency_code;
            }

            // 3. minmove2 & Pip Size: pip_size = minmove2 / pricescale
            const ps = symbolInfo.pricescale || 100;
            if (symbolInfo.minmove2 === undefined || symbolInfo.minmove2 === null || symbolInfo.minmove2 <= 0) {
              if (ps === 100000 || ps === 1000) {
                symbolInfo.minmove2 = 10;
              } else {
                symbolInfo.minmove2 = 1;
              }
            }
            if (symbolInfo.pip_size === undefined || symbolInfo.pip_size === null) {
              symbolInfo.pip_size = symbolInfo.minmove2 / ps;
            }
            symbolInfo.pipSize = symbolInfo.pip_size;

            // 4. Tick Size & minmov
            if (!symbolInfo.minmov) symbolInfo.minmov = 1;
            if (symbolInfo.tick_size === undefined || symbolInfo.tick_size === null) {
              symbolInfo.tick_size = symbolInfo.minmov / ps;
            }
            symbolInfo.minTick = symbolInfo.tick_size;

            // Guarantee flags for native interval dialog and dropdown
            symbolInfo.has_seconds = true;
            symbolInfo.has_ticks = true;
            // ... [existing interval registration logic] ...
            onSymbolResolvedCallback(symbolInfo);
          }, onResolveErrorCallback, extension);
        };
```

### Fix 3: `mt5_broker.js` Broker Adapter Synchronization
In `mt5_broker.js` `symbolInfo(symbol)`:
Read `info.pip_size`, `info.tick_size`, and `info.pointvalue` returned by `/symbols`:
```javascript
minTick: info.tick_size || (info.pricescale ? (1 / info.pricescale) : 0.01),
pipSize: info.pip_size || (info.minmove2 && info.pricescale ? info.minmove2 / info.pricescale : 0.01),
pipValue: info.trade_tick_value || (info.pointvalue ? info.pointvalue * (info.pip_size || 0.01) : 1),
lotSize: info.pointvalue || info.contract_size || 1,
quoteCurrency: info.currency_code || info.quote_currency || 'USD',
baseCurrency: info.base_currency || '',
```

---

## 5. Verification Matrix

| Instrument | MT5 Digits | MT5 Contract Size | `pointvalue` | `currency_code` | `minmove2` | Computed `pip_size` | MT5 `trade_tick_size` | `minmov` | Computed `tick_size` | Security Info Display |
|---|---|---|---|---|---|---|---|---|---|---|
| **`XAUUSD.`** | 2 | 100.0 | **100** | **USD** | 1 | **0.01** | 0.01 | 1 | **0.01** | Point value: `100`, Currency: `USD`, Pip size: `0.01`, Tick size: `0.01` |
| **`EURUSD.`** | 5 | 100000.0 | **100,000** | **USD** | 10 | **0.0001** | 0.00001 | 1 | **0.00001** | Point value: `100000`, Currency: `USD`, Pip size: `0.0001`, Tick size: `0.00001` |
| **`BTCUSD`** | 2 | 1.0 | **1** | **USD** | 1 | **0.01** | 0.01 | 1 | **0.01** | Point value: `1`, Currency: `USD`, Pip size: `0.01`, Tick size: `0.01` |
| **`USDJPY.`** | 3 | 100000.0 | **100,000** | **JPY** | 10 | **0.01** | 0.001 | 1 | **0.001** | Point value: `100000`, Currency: `JPY`, Pip size: `0.01`, Tick size: `0.001` |

Zero dashes (`-`) will be rendered for any of these specifications.
