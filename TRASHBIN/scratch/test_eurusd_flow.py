import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    
    requests_log = []
    page.on("request", lambda req: requests_log.append(req.url) if "history" in req.url or "pine" in req.url else None)
    page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}"))

    print("Navigating to http://127.0.0.1:9000 ...")
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(4)

    # Add study
    add_res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const id = await chart.createStudy('Custom Symbol Candles', false, false);
        return id;
    }""")
    print("Study added ID:", add_res)

    # Wait 4 seconds for any fetch
    time.sleep(4)

    # Inspect _securityCache and study data
    cache_info = page.evaluate("""() => {
        const cache = window.PineIndicators ? window.PineIndicators._securityCache : null;
        const cacheEntries = [];
        if (cache) {
            for (const [k, v] of cache.entries()) {
                cacheEntries.push({ key: k, fetching: v.fetching, barsCount: v.bars ? v.bars.length : 0, firstBar: v.bars?.[0], lastBar: v.bars?.[v.bars.length - 1] });
            }
        }

        const chart = window.widget.activeChart();
        const study = chart.getStudyById(window.lastStudyId || chart.getAllStudies().find(s => s.name.includes('Custom Symbol'))?.id);
        const model = chart._chartWidget._model.model();
        const priceSource = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));

        // Let's inspect the study data points!
        let lastData = null;
        if (priceSource && priceSource.data()) {
            const d = priceSource.data();
            const lastIdx = d.lastIndex();
            lastData = {
                size: d.size ? d.size() : 0,
                lastIndex: lastIdx,
                valueAtLast: d.valueAt(lastIdx)
            };
        }

        return {
            cacheEntries,
            lastData,
            chartSymbol: chart.symbol(),
            chartResolution: chart.resolution()
        };
    }""")
    print("Cache & Study info after 4s:", cache_info)
    print("History requests captured:", requests_log)

    browser.close()
