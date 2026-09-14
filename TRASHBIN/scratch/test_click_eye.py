import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    
    page.evaluate('''() => new Promise((resolve) => {
        if (window.widget && window.widget.onChartReady) {
            window.widget.onChartReady(() => resolve(true));
        } else {
            setTimeout(() => resolve(true), 4000);
        }
    })''')

    with open(r'E:\TRADINGVIEW ADVANCED\scratch_luxalgo.pine', 'r', encoding='utf-8') as f:
        source_code = f.read()

    add_res = page.evaluate('''async (sourceCode) => {
        const chart = window.widget.activeChart();
        const reg = window.PineIndicators.compileAndRegisterPine(sourceCode);
        const innerWin = (window.widget._innerWindow && typeof window.widget._innerWindow === 'function')
            ? window.widget._innerWindow()
            : document.querySelector('#tv_chart_container iframe')?.contentWindow;

        if (innerWin && innerWin.JSServer && Array.isArray(innerWin.JSServer.studyLibrary)) {
            if (!innerWin.JSServer.studyLibrary.some(s => s && s.name === reg.meta.title)) {
                innerWin.JSServer.studyLibrary.push(reg.study);
            }
        }

        const repo = typeof chart.studyMetaInfoRepository === 'function' ? chart.studyMetaInfoRepository() : (chart.studyMetaIntoRepository ? chart.studyMetaIntoRepository() : null);
        if (repo) {
            if (typeof repo._processLibraryMetaInfo === 'function') repo._processLibraryMetaInfo([reg.study.metainfo]);
            if (Array.isArray(repo._rawStudiesMetaInfo)) repo._rawStudiesMetaInfo.push(reg.study.metainfo);
            if (Array.isArray(repo._javaStudiesMetaInfo) && !repo._javaStudiesMetaInfo.some(s => s && s.id === reg.study.metainfo.id)) {
                repo._javaStudiesMetaInfo.push(reg.study.metainfo);
            }
        }

        const title = reg.meta.title;
        const entityId = await chart.createStudy(title, true, false, [], { lock: false });
        if (window.PineIndicators && typeof window.PineIndicators.renderSessionVisuals === 'function') {
            await window.PineIndicators.renderSessionVisuals(chart, sourceCode, entityId);
        }
        return {
            entityId,
            title,
            allStudies: chart.getAllStudies(),
            shapesCount: window.PineIndicators._allPineShapeIds ? window.PineIndicators._allPineShapeIds.size : 0
        };
    }''', source_code)
    print('Study added:', add_res)
    page.wait_for_timeout(2000)
    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/sessions_active_before_hide.png')

    # Now let's hover the legend item and click the eye button!
    frame = page.frame_locator('#tv_chart_container iframe')
    legend_item = frame.locator('[data-name="legend-source-item"]').nth(1)
    legend_item.hover()
    page.wait_for_timeout(500)
    
    # Locate eye button
    eye_btn = legend_item.locator('[data-name="legend-show-hide-action"], [data-name="toggle-visibility-button"], .action-l31H9iuA').first
    print('Eye button visible:', eye_btn.is_visible())
    eye_btn.click()
    page.wait_for_timeout(1500)

    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/sessions_after_click_eye.png')

    status_after_hide = page.evaluate('''() => {
        const chart = window.widget.activeChart();
        const studies = chart.getAllStudies();
        const s = studies.find(x => x.name.toLowerCase().includes('session'));
        let isVis = null;
        if (s) {
            const api = chart.getStudyById(s.id);
            isVis = api && api.isVisible ? api.isVisible() : null;
        }
        return {
            isVis,
            shapesCount: window.PineIndicators._allPineShapeIds ? window.PineIndicators._allPineShapeIds.size : 0
        };
    }''')
    print('Status after hide:', status_after_hide)

    browser.close()
