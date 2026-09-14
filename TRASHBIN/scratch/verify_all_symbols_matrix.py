import sys, time, json
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

ALL_SYMBOL_TESTS = [
    {
        "id": "FX_INVERSE",
        "category": "Forex Inverse",
        "main": "EURUSD.",
        "study": "USDCHF.",
        "expMin": 0.70,
        "expMax": 0.95,
        "screenshot": "matrix_fx_inverse_usdchf.png"
    },
    {
        "id": "FX_JPY",
        "category": "Forex JPY Scale",
        "main": "EURUSD.",
        "study": "USDJPY.",
        "expMin": 140.0,
        "expMax": 170.0,
        "screenshot": "matrix_fx_jpy_scale.png"
    },
    {
        "id": "COMMODITY_GOLD",
        "category": "Commodity (Gold)",
        "main": "EURUSD.",
        "study": "XAUUSD.",
        "expMin": 4000.0,
        "expMax": 5000.0,
        "screenshot": "matrix_commodity_gold.png"
    },
    {
        "id": "COMMODITY_SILVER",
        "category": "Commodity (Silver)",
        "main": "EURUSD.",
        "study": "XAGUSD.",
        "expMin": 50.0,
        "expMax": 90.0,
        "screenshot": "matrix_commodity_silver.png"
    },
    {
        "id": "CRYPTO_BTC",
        "category": "Crypto (Bitcoin)",
        "main": "EURUSD.",
        "study": "BTCUSD",
        "expMin": 70000.0,
        "expMax": 95000.0,
        "screenshot": "matrix_crypto_btcusd.png"
    },
    {
        "id": "CRYPTO_ETH",
        "category": "Crypto (Ethereum)",
        "main": "EURUSD.",
        "study": "ETHUSD",
        "expMin": 2000.0,
        "expMax": 3500.0,
        "screenshot": "matrix_crypto_ethusd.png"
    },
    {
        "id": "INDEX_US30",
        "category": "Index (Dow Jones / US30)",
        "main": "EURUSD.",
        "study": "US30.",
        "expMin": 45000.0,
        "expMax": 60000.0,
        "screenshot": "matrix_index_us30.png"
    },
    {
        "id": "INDEX_NAS100",
        "category": "Index (Nasdaq / NAS100)",
        "main": "EURUSD.",
        "study": "NAS100.",
        "expMin": 25000.0,
        "expMax": 35000.0,
        "screenshot": "matrix_index_nas100.png"
    },
    {
        "id": "EQUITY_APPLE",
        "category": "Equity (Apple Inc)",
        "main": "EURUSD.",
        "study": "Apple",
        "expMin": 250.0,
        "expMax": 400.0,
        "screenshot": "matrix_equity_apple.png"
    },
    {
        "id": "EQUITY_TESLA",
        "category": "Equity (Tesla Inc)",
        "main": "EURUSD.",
        "study": "Tesla",
        "expMin": 300.0,
        "expMax": 450.0,
        "screenshot": "matrix_equity_tesla.png"
    },
    {
        "id": "REVERSE_GOLD_EUR",
        "category": "Commodity Base / Forex Study",
        "main": "XAUUSD.",
        "study": "EURUSD.",
        "expMin": 1.05,
        "expMax": 1.25,
        "screenshot": "matrix_reverse_gold_eur.png"
    },
    {
        "id": "CRYPTO_INDEX_CROSS",
        "category": "Crypto Base / Index Study",
        "main": "BTCUSD",
        "study": "US30.",
        "expMin": 45000.0,
        "expMax": 60000.0,
        "screenshot": "matrix_crypto_index_cross.png"
    }
]

print("======================================================================")
print("STARTING ALL SYMBOLS & ALL PAIRS COMBINATIONS VERIFICATION HARNESS")
print("======================================================================")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    print("Navigating to http://127.0.0.1:9000 ...")
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(4)

    # Add Custom Symbol Candles study once
    add_res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const id = await chart.createStudy('Custom Symbol Candles', false, false);
        return id;
    }""")
    print("Initial Custom Symbol Candles study added:", add_res)
    time.sleep(2)

    results = []

    for idx, tc in enumerate(ALL_SYMBOL_TESTS, start=1):
        print(f"\n[{idx}/{len(ALL_SYMBOL_TESTS)}] Testing: Main='{tc['main']}' | Study='{tc['study']}' ({tc['category']})...")

        res = page.evaluate("""async (cfg) => {
            const chart = window.widget.activeChart();
            chart.setSymbol(cfg.main);
            await new Promise(r => setTimeout(r, 2000));

            const model = chart._chartWidget._model.model();
            const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
            if (!study) return { error: 'Study not found' };

            const inps = study.properties().childs().inputs;
            if (inps.child('sym')) inps.child('sym').setValue(cfg.study);
            if (inps.child('0')) inps.child('0').setValue(cfg.study);

            // Wait 3.0s for security bars to download and study to restart
            await new Promise(r => setTimeout(r, 3000));
            if (typeof study.restart === 'function') study.restart();
            model.fullUpdate();
            await new Promise(r => setTimeout(r, 1000));

            const d = study.data();
            const count = d.size ? d.size() : d.length;

            const pane = model.panes().find(p => p.dataSources().includes(study));
            let scaleMin = null, scaleMax = null;
            if (pane) {
                const ps = pane.defaultPriceScale();
                if (ps && ps.priceRange()) {
                    scaleMin = ps.priceRange().minValue();
                    scaleMax = ps.priceRange().maxValue();
                }
            }

            const firstBar = count > 0 ? d.valueAt(0) : null;
            const lastBar = count > 0 ? d.valueAt(count - 1) : null;

            return {
                mainSymbol: chart.symbol(),
                studySymbol: inps.child('sym') ? inps.child('sym').value() : null,
                barCount: count,
                scaleMin,
                scaleMax,
                firstOHLC: firstBar ? [firstBar[1], firstBar[2], firstBar[3], firstBar[4]] : null,
                lastOHLC: lastBar ? [lastBar[1], lastBar[2], lastBar[3], lastBar[4]] : null
            };
        }""", tc)

        if "error" in res:
            print(f"  [FAIL] {res['error']}")
            results.append({"id": tc["id"], "pass": False, "error": res["error"]})
            continue

        bar_count = res.get("barCount", 0)
        s_min = res.get("scaleMin")
        s_max = res.get("scaleMax")
        exp_min = tc["expMin"]
        exp_max = tc["expMax"]

        has_bars = bar_count > 0
        scale_in_range = (s_min is not None and s_max is not None and s_min >= exp_min * 0.8 and s_max <= exp_max * 1.2)
        ohlc_valid = (res.get("lastOHLC") is not None and not any(v is None or v != v for v in res["lastOHLC"]))

        passed = has_bars and scale_in_range and ohlc_valid

        print(f"  Main: {res.get('mainSymbol')} | Study: {res.get('studySymbol')}")
        print(f"  Bars Count: {bar_count} | Scale: [{s_min}, {s_max}]")
        print(f"  Last OHLC: {res.get('lastOHLC')}")
        print(f"  Status: {'[PASS]' if passed else '[FAIL]'}")

        if tc.get("screenshot"):
            shot_path = f"C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/{tc['screenshot']}"
            page.screenshot(path=shot_path)
            print(f"  Screenshot saved: {tc['screenshot']}")

        results.append({
            "id": tc["id"],
            "pass": passed,
            "main": res.get("mainSymbol"),
            "study": res.get("studySymbol"),
            "barCount": bar_count,
            "scaleMin": s_min,
            "scaleMax": s_max,
            "lastOHLC": res.get("lastOHLC")
        })

    print("\n======================================================================")
    print("ALL SYMBOLS & ALL PAIRS TEST RESULTS SUMMARY:")
    print("======================================================================")
    all_passed = True
    for r in results:
        status = "PASS" if r["pass"] else "FAIL"
        if not r["pass"]: all_passed = False
        print(f"[{status}] {r['id']:22} | Main={str(r.get('main')):10} | Study={str(r.get('study')):10} | Scale=[{r.get('scaleMin')}, {r.get('scaleMax')}] | Bars={r.get('barCount')}")
    
    print(f"\nFinal Result: {'ALL SYMBOLS PASSED (100% SUCCESS RATE)' if all_passed else 'SOME SYMBOLS FAILED'}")
    browser.close()
