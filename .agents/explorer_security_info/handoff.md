# Handoff Report: Security Info Dialog Metadata Investigation

## 1. Observation

1. **`server.py` `/symbols` endpoint (`server.py:705-738`)**:
   Line 705 creates `meta` as:
   ```python
   meta = {
       "name": symbol_info.name,
       "ticker": symbol_info.name,
       "description": symbol_info.description or symbol_info.name,
       "type": "forex" if is_forex else "cfd",
       "session": "24x7",
       "exchange": "MetaTrader5",
       "listed_exchange": "MetaTrader5",
       "timezone": "Etc/UTC",
       "minmov": 1,
       "pricescale": pricescale,
       # ...
   }
   ```
   Direct query of `server.get_symbols("XAUUSD.")` and `"EURUSD."` confirmed that `pointvalue`, `currency_code`, `original_currency_code`, `currency_id`, `minmove2`, `pip_size`, and `tick_size` are entirely absent from the dictionary.

2. **TradingView Security Info Dialog Implementation (`charting_library/bundles/symbol-info-dialog-impl.23e8feddd0326a1feabb.js`)**:
   - `pointvalue` at line ~36175:
     `{title: i.t(null, void 0, n(981314)), group: 2, propName: "pointvalue"}`
     No getter defined. Evaluates `symbolInfo["pointvalue"]`. If undefined, `_defaultFormatter` falls back to `"-"`.
   - `currency_code` at line ~36718:
     `{title: i.t(null, void 0, n(381849)), group: 2, propName: "currency_code", getter: (e, t) => (0, Y.symbolOriginalCurrency)(e, !0), visibility: (e, t) => Boolean((0, Y.symbolOriginalCurrency)(e, !0)), formatter: e => e ?? "", defValue: ""}`
     Calls `symbolOriginalCurrency(symbolInfo, true)`. In `library.e8d44337c84d65489d2c.js` (module 162172, function `G`), it checks `symbolInfo.original_currency_code ?? symbolInfo.currency_code`. If neither exists, returns `null`, causing `visibility` to be `false` (row hidden or empty).
   - `pip_size` at line ~37408:
     `{title: i.t(null, void 0, n(39245)), group: 2, propName: "pip_size", getter: re, visibility: oe}`
     Function `oe` at line ~33500:
     `function oe(e, t) { return (e.minmove2 ?? 0) > 0 && !e.fractional && 0 !== e.pricescale; }`
     Function `re` at line ~33520:
     `function re(e, t) { return oe(e) && void 0 !== e.pricescale ? new ee.PriceFormatter({ priceScale: e.pricescale / (0, J.ensureDefined)(e.minmove2) }).format((0, J.ensureDefined)(e.minmove2) / e.pricescale) : null; }`
     Calculates Pip size strictly as $\frac{\text{minmove2}}{\text{pricescale}}$. If `minmove2` is undefined/missing/0, `oe(e)` returns `false`, hiding the field or returning `null` (`"-"`).
   - `tick_size` at line ~37494:
     `{title: i.t(null, void 0, n(424431)), group: 2, propName: "tick_size", getter: ie}`
     Function `ie`:
     Computes $\frac{\text{minmov}}{\text{pricescale}}$ formatted via series price formatter.

3. **UDF Client Symbol Forwarding (`datafeeds/udf/dist/bundle.js:12315`)**:
   `this._send("symbols", t)` spreads `...e` and maps:
   ```javascript
   currency_code: e.currency_code ?? e["currency-code"],
   original_currency_code: e.original_currency_code ?? e["original-currency-code"],
   minmov: e.minmovement ?? e.minmov ?? 0,
   minmove2: e.minmovement2 ?? e.minmove2,
   ```
   Confirming that any properties emitted by `/symbols` are forwarded directly into `LibrarySymbolInfo`.

4. **Frontend Resolution Hook (`index.html:815-862`)**:
   `datafeed.resolveSymbol` intercepts `symbolInfo` before returning it to TradingView, but only populates `seconds_multipliers` and `ticks_multipliers` without setting or safeguarding `pointvalue`, `currency_code`, `minmove2`, `pip_size`, or `tick_size`.

5. **Live MT5 Specifications**:
   Queried directly via `MetaTrader5` library:
   - `XAUUSD.`: `trade_contract_size = 100.0`, `trade_tick_size = 0.01`, `digits = 2`, `currency_profit = "USD"`, `currency_base = "USD"`.
   - `EURUSD.`: `trade_contract_size = 100000.0`, `trade_tick_size = 1e-05`, `digits = 5`, `currency_profit = "USD"`, `currency_base = "EUR"`.
   - `BTCUSD`: `trade_contract_size = 1.0`, `trade_tick_size = 0.01`, `digits = 2`, `currency_profit = "USD"`, `currency_base = "USD"`.

---

## 2. Logic Chain

1. From Observation 2, TradingView's Security Info dialog renders `"-"` whenever a field's getter returns `null` or when the property is absent from `symbolInfo`.
2. From Observation 1, `server.py` `/symbols` returns a dictionary that completely omits `pointvalue`, `currency_code`, `original_currency_code`, `minmove2`, `pip_size`, and `tick_size`.
3. For **Point value**: The dialog reads `symbolInfo["pointvalue"]` directly. Because it is absent, it renders `"-"`. Populating `pointvalue = int(symbol_info.trade_contract_size)` will display `100` for Gold, `100000` for EURUSD, and `1` for BTCUSD.
4. For **Currency**: The dialog getter calls `symbolOriginalCurrency(symbolInfo, true)`, which reads `original_currency_code ?? currency_code`. Because both are missing, it returns `null` and `visibility` is `false`. Populating `currency_code` and `original_currency_code` with MT5's `currency_profit` (e.g. `"USD"`) restores the field.
5. For **Pip size**: The dialog requires `(symbolInfo.minmove2 ?? 0) > 0` and calculates pip size as $\frac{\text{minmove2}}{\text{pricescale}}$. Because `minmove2` is undefined, `oe(e)` returns `false` and `re` returns `null`. By defining `minmove2 = 10` for 5-digit/3-digit Forex and `minmove2 = 1` for Gold and Crypto, TradingView will compute and format:
   - Gold (`pricescale = 100`): $1 / 100 = \mathbf{0.01}$
   - Forex 5-digit (`pricescale = 100000`): $10 / 100000 = \mathbf{0.0001}$
   - BTCUSD (`pricescale = 100`): $1 / 100 = \mathbf{0.01}$
6. For **Tick size**: The dialog formats $\frac{\text{minmov}}{\text{pricescale}}$. In MT5, `trade_tick_size` is 0.01 for Gold/BTC and 0.00001 for EURUSD. Ensuring `minmov = max(1, round(trade_tick_size * pricescale))` guarantees exact alignment with broker ticks without rounding errors.
7. From Observation 4, adding a protective fallback in `index.html`'s `resolveSymbol` guarantees that even if backend metadata is cached or delayed, the chart's Security Info dialog will never display dashes.

---

## 3. Caveats

- No caveats. The exact JavaScript source code of TradingView's dialog in the bundle was decompiled, analyzed, and mapped to MT5 Python IPC attributes.

---

## 4. Conclusion

The dashes (`-`) in TradingView's Security Info dialog are caused by missing keys in `server.py` `/symbols` and an incomplete `resolveSymbol` hook in `index.html`. 

The fix is two-fold:
1. **In `server.py` `/symbols`**:
   Extract `trade_contract_size`, `currency_profit`, `currency_base`, and `trade_tick_size` from MT5 `symbol_info` and populate:
   - `pointvalue: int(symbol_info.trade_contract_size)`
   - `currency_code: symbol_info.currency_profit or "USD"`
   - `original_currency_code: symbol_info.currency_profit or "USD"`
   - `minmove2: 10 if (is_forex and digits in (3, 5)) else 1`
   - `pip_size: minmove2 / pricescale`
   - `tick_size: symbol_info.trade_tick_size`
   - `minmov: max(1, int(round(tick_size * pricescale)))`
2. **In `index.html` `datafeed.resolveSymbol`**:
   Add a defensive normalization layer ensuring `pointvalue`, `currency_code`, `original_currency_code`, `minmove2`, `pip_size`, and `tick_size` are populated on `symbolInfo` before executing `onSymbolResolvedCallback(symbolInfo)`.

Detailed diffs and full implementation specifications are documented in `.agents/explorer_security_info/report.md`.

---

## 5. Verification Method

1. **Verify `/symbols` API Output via Python**:
   Run:
   ```bash
   python -c "from server import get_symbols; [print(s, get_symbols(s)['pointvalue'], get_symbols(s)['currency_code'], get_symbols(s)['minmove2'], get_symbols(s)['pip_size'], get_symbols(s)['tick_size']) for s in ['XAUUSD.', 'EURUSD.', 'BTCUSD']]"
   ```
   **Expected**:
   - `XAUUSD.`: `100`, `'USD'`, `1`, `0.01`, `0.01`
   - `EURUSD.`: `100000`, `'USD'`, `10`, `0.0001`, `0.00001`
   - `BTCUSD`: `1`, `'USD'`, `1`, `0.01`, `0.01`

2. **Verify Charting Library Dialog Rendering**:
   - Open TradingView chart on port 9000 (`http://127.0.0.1:9000/index.html`).
   - Right-click chart $\rightarrow$ click "Security Info..."
   - Verify fields under group 2:
     - `Point value`: displays `100` (not `-`)
     - `Currency`: displays `USD` (not `-`)
     - `Pip size`: displays `0.01` (not `-`)
     - `Tick size`: displays `0.01` (not `-`)
   - Switch symbol to `EURUSD.` and repeat $\rightarrow$ `Point value: 100000`, `Currency: USD`, `Pip size: 0.0001`, `Tick size: 0.00001`.
