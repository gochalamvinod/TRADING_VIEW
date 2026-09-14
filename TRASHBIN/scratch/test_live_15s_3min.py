import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

print("======================================================================")
print("STARTING 15-SECOND RESOLUTION LIVE 3-MINUTE REAL-TIME STREAMING TEST")
print("======================================================================")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    print("Navigating to http://127.0.0.1:9000 ...")
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(4)

    # 1. Set main chart symbol to XAUUSD. and resolution to 15S
    setup_res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        chart.setSymbol('XAUUSD.');
        await new Promise(r => setTimeout(r, 2000));
        chart.setResolution('15S');
        await new Promise(r => setTimeout(r, 2000));
        await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2000));

        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        const inps = study.properties().childs().inputs;

        inps.child('sym').setValue('CADJPY.');
        if (inps.child('0')) inps.child('0').setValue('CADJPY.');

        await new Promise(r => setTimeout(r, 3000));
        if (typeof study.restart === 'function') study.restart();
        model.fullUpdate();

        const d = study.data();
        return {
            symbol: chart.symbol(),
            resolution: chart.resolution(),
            initialCount: d.size ? d.size() : d.length,
            initialLastBar: d.size ? d.valueAt(d.size() - 1) : null
        };
    }""")

    print(f"Initial Setup: Symbol={setup_res.get('symbol')}, Resolution={setup_res.get('resolution')}")
    print(f"Initial Study Bar Count: {setup_res.get('initialCount')}")
    init_last = setup_res.get('initialLastBar')
    if init_last:
        print(f"Initial Last Bar: time={init_last[0]} O={init_last[1]} H={init_last[2]} L={init_last[3]} C={init_last[4]}")

    print("\n>>> WAITING 3 MINUTES (180 SECONDS) TO ACCUMULATE LIVE 15-SECOND BARS <<<", flush=True)
    start_wait = time.time()
    for elapsed in [30, 60, 90, 120, 150, 180]:
        time.sleep(30)
        status = page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const model = chart._chartWidget._model.model();
            const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
            const d = study.data();
            const count = d.size ? d.size() : d.length;
            const last = count > 0 ? d.valueAt(count - 1) : null;
            return { count, last };
        }""")
        l_bar = status.get('last')
        last_str = f"time={l_bar[0]} C={l_bar[4]}" if l_bar else "None"
        print(f"  [Elapsed {elapsed}s / 180s] Current Bars: {status.get('count')} | Latest Bar: {last_str}", flush=True)
        if elapsed == 90:
            page.screenshot(path="C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/live_15s_90s_midpoint.png")

    # Inspect all newly formed bars across the 3 minutes
    eval_res = page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        const d = study.data();
        const count = d.size ? d.size() : d.length;

        const last20 = [];
        for (let i = Math.max(0, count - 20); i < count; i++) {
            last20.push({
                idx: i,
                val: d.valueAt(i)
            });
        }

        const pane = model.panes().find(p => p.dataSources().includes(study));
        let scaleMin = null, scaleMax = null;
        if (pane) {
            const ps = pane.defaultPriceScale();
            if (ps && ps.priceRange()) {
                scaleMin = ps.priceRange().minValue();
                scaleMax = ps.priceRange().maxValue();
            }
        }

        return {
            totalBars: count,
            scaleMin,
            scaleMax,
            last20
        };
    }""")

    print("\n======================================================================")
    print("3-MINUTE LIVE RUN ANALYSIS & VERIFICATION:")
    print("======================================================================")
    print(f"Final Total Bars: {eval_res.get('totalBars')} (started at {setup_res.get('initialCount')})")
    print(f"New Live 15s Bars Formed: {eval_res.get('totalBars') - setup_res.get('initialCount')}")
    print(f"Indicator Scale Range: {eval_res.get('scaleMin')} to {eval_res.get('scaleMax')}")

    last20 = eval_res.get("last20", [])
    consecutive_repeats = 0
    print("\nInspecting the last 15 consecutive bars:")
    for i in range(len(last20) - 15, len(last20)):
        if i < 0: continue
        b = last20[i]
        v = b["val"]
        print(f"  [{b['idx']}] time={v[0]} O={v[1]} H={v[2]} L={v[3]} C={v[4]}")
        if i > 0:
            prev_v = last20[i-1]["val"]
            if v[1] == prev_v[1] and v[2] == prev_v[2] and v[3] == prev_v[3] and v[4] == prev_v[4] and v[1] != v[4]:
                consecutive_repeats += 1

    print(f"\nCloned / Repeating Candle Bodies Detected: {consecutive_repeats}")
    if consecutive_repeats == 0:
        print("[SUCCESS] All 15-second bars streamed live and uniquely without repeating clones!")
    else:
        print(f"[FAIL] Detected {consecutive_repeats} duplicate candles!")

    screenshot_path = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/live_15s_3min_test.png"
    page.screenshot(path=screenshot_path)
    print("Screenshot saved to:", screenshot_path)

    browser.close()
