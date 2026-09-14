import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    
    logs = []
    page.on('console', lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
    network_reqs = []
    page.on('request', lambda req: network_reqs.append(req.url) if 'history' in req.url else None)

    print("Navigating to http://127.0.0.1:9000 ...")
    page.goto('http://127.0.0.1:9000', timeout=30000)
    page.wait_for_selector('#tv_chart_container iframe', timeout=20000)
    time.sleep(3)

    chart_info = page.evaluate('''async () => {
        const chart = window.widget.activeChart();
        chart.setSymbol('XAUUSD.');
        await new Promise(r => setTimeout(r, 2000));
        chart.setResolution('15S');
        await new Promise(r => setTimeout(r, 2000));

        // Add Custom Symbol Candles indicator
        await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2000));

        const model = chart._chartWidget._model.model();
        const mainSeries = model.mainSeries();
        const bars = mainSeries.bars();
        const barCount = bars ? (bars.size ? bars.size() : bars.length) : 0;
        const visibleRange = chart.getVisibleRange();

        // Get main series first & last bar times
        let firstBar = null, lastBar = null;
        if (barCount > 0) {
            firstBar = bars.first();
            lastBar = bars.last();
        }

        // Get studies
        const studies = model.priceDataSources().filter(s => s !== mainSeries);
        const studyInfos = studies.map(s => {
            const sd = s.data();
            return {
                name: typeof s.name === 'function' ? s.name() : 'unknown',
                barsCount: sd ? (sd.size ? sd.size() : sd.length) : 0
            };
        });

        return {
            symbol: chart.symbol(),
            resolution: chart.resolution(),
            barCount: barCount,
            barsEmpty: bars ? bars.isEmpty() : true,
            firstBar: firstBar ? { time: firstBar.time, close: firstBar.value[4] } : null,
            lastBar: lastBar ? { time: lastBar.time, close: lastBar.value[4] } : null,
            visibleRange: visibleRange,
            studyInfos: studyInfos,
            chartType: mainSeries.properties().childs().style.value()
        };
    }''')
    print('Chart Info:', chart_info)
    print('\nNetwork requests to history:')
    for r in network_reqs:
        print(' ', r)
    
    screenshot_path = 'C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/inspect_xauusd_15s.png'
    page.screenshot(path=screenshot_path)
    print('Screenshot saved to:', screenshot_path)

    print('\nConsole errors/warnings:')
    for l in logs:
        if 'error' in l.lower() or 'warn' in l.lower():
            print(' ', l)

    browser.close()
