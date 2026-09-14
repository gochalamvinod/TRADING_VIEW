import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

print("======================================================================")
print("TESTING VOLUME INDICATOR REMOVAL & 15S CANDLES ON XAUUSD + CSC")
print("======================================================================")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    # Clear localStorage first so no residual layout creates old studies
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(2)

    page.evaluate("() => { localStorage.clear(); }")
    page.reload()
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(4)

    # 1. Inspect studies right after clean startup
    studies_info = page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const all = model.allStudies ? model.allStudies() : [];
        return all.map(s => {
            const meta = typeof s.metaInfo === 'function' ? s.metaInfo() : null;
            return {
                name: typeof s.name === 'function' ? s.name() : (meta ? meta.description : ''),
                shortId: meta ? meta.shortId : ''
            };
        });
    }""")
    print("Studies on fresh start:", studies_info)
    has_volume = any("volume" in (s["name"] or "").lower() for s in studies_info)
    if has_volume:
        print("[FAIL] Volume indicator still present!")
    else:
        print("[PASS] Volume indicator successfully removed from default startup!")

    # 2. Switch symbol to XAUUSD. and timeframe to 15S
    setup_info = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        chart.setSymbol('XAUUSD.');
        await new Promise(r => setTimeout(r, 2000));
        chart.setResolution('15S');
        await new Promise(r => setTimeout(r, 2500));

        // Add Custom Symbol Candles (overlay=false)
        await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 3000));

        const model = chart._chartWidget._model.model();
        const mainSeries = model.mainSeries();
        const mainBars = mainSeries.bars();
        const mCount = mainBars ? mainBars.size() : 0;

        const studies = model.priceDataSources().filter(s => s !== mainSeries);
        const csc = studies.find(s => s.name && s.name().includes('Custom Symbol'));
        const cscData = csc ? csc.data() : null;
        const cscCount = cscData ? (cscData.size ? cscData.size() : cscData.length) : 0;

        return {
            symbol: chart.symbol(),
            resolution: chart.resolution(),
            mainBarCount: mCount,
            cscBarCount: cscCount,
            panesCount: model.panes().length
        };
    }""")

    print(f"\nSetup: Symbol={setup_info['symbol']}, Resolution={setup_info['resolution']}")
    print(f"Main Chart Bars ({setup_info['symbol']}): {setup_info['mainBarCount']}")
    print(f"CSC Indicator Bars: {setup_info['cscBarCount']}")
    print(f"Total Chart Panes: {setup_info['panesCount']}")

    # Wait 5 seconds to let real-time streaming tick
    time.sleep(5)

    post_check = page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const mainSeries = model.mainSeries();
        const allStudies = model.allStudies ? model.allStudies() : [];

        return {
            mainBars: mainSeries.bars() ? mainSeries.bars().size() : 0,
            hasVolumeNow: allStudies.some(s => {
                const n = typeof s.name === 'function' ? s.name() : '';
                return n.toLowerCase().startsWith('volume') && !n.toLowerCase().includes('custom');
            })
        };
    }""")

    print(f"After streaming: Main Bars={post_check['mainBars']}, HasVolume={post_check['hasVolumeNow']}")

    screenshot_path = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/verified_15s_no_volume.png"
    page.screenshot(path=screenshot_path)
    print(f"\nSaved verification screenshot to: {screenshot_path}")

    browser.close()
