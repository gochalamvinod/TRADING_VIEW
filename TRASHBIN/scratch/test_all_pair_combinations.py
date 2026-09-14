import sys, time, json
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

TEST_CASES = [
    {
        "id": "eur_btc",
        "category": "Extreme Disparity",
        "main": "EURUSD.",
        "study": "BTCUSD",
        "expectedStudyRange": (70000, 90000),
        "screenshot": "eurusd_chart_btcusd_candles.png"
    },
    {
        "id": "eur_gold",
        "category": "Commodity vs Forex",
        "main": "EURUSD.",
        "study": "XAUUSD.",
        "expectedStudyRange": (4000, 5000),
        "screenshot": "eurusd_chart_xauusd_candles.png"
    },
    {
        "id": "eur_jpy",
        "category": "High Denomination Forex",
        "main": "EURUSD.",
        "study": "USDJPY.",
        "expectedStudyRange": (140, 170),
        "screenshot": "eurusd_chart_usdjpy_candles.png"
    },
    {
        "id": "eur_chf",
        "category": "Inverse Forex",
        "main": "EURUSD.",
        "study": "USDCHF.",
        "expectedStudyRange": (0.75, 0.90),
        "screenshot": "eurusd_chart_usdchf_candles.png"
    },
    {
        "id": "gbp_cad",
        "category": "Cross Forex",
        "main": "GBPUSD.",
        "study": "USDCAD.",
        "expectedStudyRange": (1.30, 1.45),
        "screenshot": "gbpusd_chart_usdcad_candles.png"
    },
    {
        "id": "gold_eur",
        "category": "Commodity Base",
        "main": "XAUUSD.",
        "study": "EURUSD.",
        "expectedStudyRange": (1.10, 1.25),
        "screenshot": "xauusd_chart_eurusd_candles.png"
    },
    {
        "id": "btc_eth",
        "category": "Crypto Cross",
        "main": "BTCUSD",
        "study": "ETHUSD",
        "expectedStudyRange": (2000, 3000),
        "screenshot": "btcusd_chart_ethusd_candles.png"
    }
]

print("======================================================================")
print("STARTING EXHAUSTIVE MULTI-PAIR COMBINATIONS VERIFICATION HARNESS")
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
    print("Initial study added:", add_res)
    time.sleep(2)

    results = []

    for idx, tc in enumerate(TEST_CASES, start=1):
        print(f"\n[{idx}/{len(TEST_CASES)}] Testing: Main='{tc['main']}' | Study='{tc['study']}' ({tc['category']})...")
        
        # Configure Main Symbol & Study Symbol
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

            // Wait 2.5s for security data to download and study to restart
            await new Promise(r => setTimeout(r, 2500));
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
        exp_min, exp_max = tc["expectedStudyRange"]

        has_bars = bar_count > 0
        scale_in_range = (s_min is not None and s_max is not None and s_min >= exp_min * 0.8 and s_max <= exp_max * 1.2)
        ohlc_valid = (res.get("lastOHLC") is not None and not any(v is None or v != v for v in res["lastOHLC"]))

        passed = has_bars and scale_in_range and ohlc_valid

        print(f"  Main: {res.get('mainSymbol')} | Study: {res.get('studySymbol')}")
        print(f"  Bars Count: {bar_count} | Scale: [{s_min}, {s_max}]")
        print(f"  Last OHLC: {res.get('lastOHLC')}")
        print(f"  Status: {'[PASS]' if passed else '[FAIL]'}")

        # Capture screenshot for selected key combinations
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
    print("ALL PAIR COMBINATIONS TEST RESULTS SUMMARY:")
    print("======================================================================")
    all_passed = True
    for r in results:
        status = "PASS" if r["pass"] else "FAIL"
        if not r["pass"]: all_passed = False
        print(f"[{status}] {r['id'].upper():12} | Main={r.get('main')} | Study={r.get('study')} | Scale=[{r.get('scaleMin')}, {r.get('scaleMax')}] | Bars={r.get('barCount')}")
    
    print(f"\nFinal Result: {'ALL COMBINATIONS PASSED (100%)' if all_passed else 'SOME COMBINATIONS FAILED'}")
    browser.close()
