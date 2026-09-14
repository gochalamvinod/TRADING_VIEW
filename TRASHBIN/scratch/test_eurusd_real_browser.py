import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    
    page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))

    print("Navigating to http://127.0.0.1:9000 ...")
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(4)

    # 1. Add study
    study_id = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const id = await chart.createStudy('Custom Symbol Candles', false, false);
        return id;
    }""")
    print("Study added ID:", study_id)

    # Wait 3 seconds for bars to align and study to calculate
    time.sleep(3)

    # 2. Inspect the study's data values in the chart model
    values = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        if (!study || !study.data()) return { error: "No study data" };

        const d = study.data();
        const lastIdx = d.lastIndex();
        const lastVal = d.valueAt(lastIdx);
        const firstVal = d.valueAt(0);

        // Also check legend text
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;
        const legendItems = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]'));
        const candleItem = legendItems.find(el => el.innerText.includes('Custom Symbol'));
        const legendText = candleItem ? candleItem.innerText.replace(/\\s+/g, ' ').trim() : null;

        return {
            size: d.size ? d.size() : 0,
            lastVal: lastVal,
            firstVal: firstVal,
            legendText: legendText
        };
    }""")
    print("Rendered Study Values:", values)

    # Screenshot the chart showing EURUSD. candles in bottom pane while XAUUSD. is on top
    screenshot_path = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\eurusd_candles_verified.png"
    page.screenshot(path=screenshot_path)
    print("Saved screenshot to:", screenshot_path)

    browser.close()
    print("TEST FINISHED.")
