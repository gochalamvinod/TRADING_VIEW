from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    
    res = page.evaluate("""async () => {
        await new Promise(r => window.widget.onChartReady(r));
        
        // Compile a script via PineIndicators
        const samplePine = `//@version=5
indicator("Custom Symbol Candles Test", overlay=false)
plot(close, "Test Close", color=color.blue)
`;
        const res = window.PineIndicators.compileAndRegisterPine(samplePine);
        const studyName = res.meta.title;
        const isOverlay = res.meta.isOverlay;

        const innerWin = window.widget._innerWindow();
        if (innerWin && innerWin.JSServer && Array.isArray(innerWin.JSServer.studyLibrary)) {
            innerWin.JSServer.studyLibrary.push(res.study);
        }

        const chart = window.widget.activeChart();
        const repo = typeof chart.studyMetaIntoRepository === 'function' ? chart.studyMetaIntoRepository() : chart.studyMetaIntoRepository;
        if (repo) {
            if (typeof repo._processLibraryMetaInfo === 'function') {
                repo._processLibraryMetaInfo([res.study.metainfo]);
            }
            if (Array.isArray(repo._rawStudiesMetaInfo)) {
                repo._rawStudiesMetaInfo.push(res.study.metainfo);
            }
            if (Array.isArray(repo._javaStudiesMetaInfo)) {
                repo._javaStudiesMetaInfo.push(res.study.metainfo);
            }
        }

        // Add to chart
        const entityId = await chart.createStudy(studyName, isOverlay, false);
        return {
            entityId,
            studies: chart.getAllStudies()
        };
    }""")
    print("Direct study injection test:", res)
    b.close()
