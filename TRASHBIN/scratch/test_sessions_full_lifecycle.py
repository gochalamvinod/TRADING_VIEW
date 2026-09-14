import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    page.wait_for_timeout(3000)

    page.evaluate('''() => new Promise((resolve) => {
        if (window.widget && window.widget.onChartReady) {
            window.widget.onChartReady(() => resolve(true));
        } else {
            setTimeout(() => resolve(true), 4000);
        }
    })''')

    with open(r'E:\TRADINGVIEW ADVANCED\scratch_luxalgo.pine', 'r', encoding='utf-8') as f:
        source_code = f.read()

    # Step 1: Add Sessions [LuxAlgo] to chart
    res = page.evaluate('''async (sourceCode) => {
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
        const studyId = await chart.createStudy(title, true, false, [], { lock: false });
        
        // Track active study in PineEditorIDE
        window._pineActiveStudies = window._pineActiveStudies || new Map();
        window._pineActiveStudies.set(studyId, {
            id: studyId,
            name: title,
            isOverlay: true,
            createdAt: Date.now()
        });
        window.PineIndicators.registerStudyAlias(studyId, [title, 'Sessions [LuxAlgo]', 'LuxAlgo - Sessions']);

        if (window.PineIndicators && typeof window.PineIndicators.renderSessionVisuals === 'function') {
            await window.PineIndicators.renderSessionVisuals(chart, sourceCode, studyId);
        }

        // Setup observer
        if (window.PineEditorIDE && window.PineEditorIDE.setupStudyRemovalObserver) {
            window.PineEditorIDE.setupStudyRemovalObserver(chart);
        }

        // Setup direct visibility subscriber
        const studyApi = chart.getStudyById(studyId);
        const props = studyApi.properties();
        const visProp = props.visible || (props.childs && props.childs().visible);
        if (visProp && typeof visProp.subscribe === 'function') {
            visProp.subscribe(null, (val) => {
                const isV = typeof val === 'boolean' ? val : (val && typeof val.value === 'function' ? val.value() : studyApi.isVisible());
                window.PineIndicators.setStudyShapesVisibility(studyId, isV, chart);
            });
        }

        const shapes = window.PineIndicators.getStudyShapes(studyId);
        return {
            studyId,
            title,
            shapesCount: shapes.length
        };
    }''', source_code)
    print('1. Sessions Added:', res)

    page.wait_for_timeout(1500)
    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/sessions_active_verified.png')

    # Step 2: Toggle Visibility to HIDDEN
    hide_res = page.evaluate('''() => {
        const chart = window.widget.activeChart();
        const studies = chart.getAllStudies();
        const studyApi = chart.getStudyById(studies[0].id);
        studyApi.setVisible(false);

        // Also call setStudyShapesVisibility directly to ensure sync
        window.PineIndicators.setStudyShapesVisibility(studies[0].id, false, chart);

        const shapes = window.PineIndicators.getStudyShapes(studies[0].id);
        const hiddenStatuses = shapes.map(sid => {
            try {
                const sApi = chart.getShapeById(sid);
                return sApi && sApi.isHidden ? sApi.isHidden() : null;
            } catch(e) { return null; }
        });

        return {
            studyVisible: studyApi.isVisible(),
            totalShapes: shapes.length,
            hiddenCount: hiddenStatuses.filter(h => h === true).length
        };
    }''')
    print('2. Sessions Hidden:', hide_res)

    page.wait_for_timeout(1000)
    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/sessions_hidden_verified.png')

    # Step 3: Toggle Visibility to SHOWN
    show_res = page.evaluate('''() => {
        const chart = window.widget.activeChart();
        const studies = chart.getAllStudies();
        const studyApi = chart.getStudyById(studies[0].id);
        studyApi.setVisible(true);

        window.PineIndicators.setStudyShapesVisibility(studies[0].id, true, chart);

        const shapes = window.PineIndicators.getStudyShapes(studies[0].id);
        const visibleStatuses = shapes.map(sid => {
            try {
                const sApi = chart.getShapeById(sid);
                return sApi && sApi.isHidden ? !sApi.isHidden() : null;
            } catch(e) { return null; }
        });

        return {
            studyVisible: studyApi.isVisible(),
            totalShapes: shapes.length,
            visibleCount: visibleStatuses.filter(v => v === true).length
        };
    }''')
    print('3. Sessions Shown:', show_res)

    page.wait_for_timeout(1000)
    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/sessions_reshown_verified.png')

    # Step 4: Remove Study
    remove_res = page.evaluate('''() => {
        const chart = window.widget.activeChart();
        const studies = chart.getAllStudies();
        const sId = studies[0].id;
        chart.removeEntity(sId);
        window.PineIndicators.clearStudyShapes(sId, chart);
        window.PineIndicators.clearSessionVisuals(chart);

        return {
            activeStudies: chart.getAllStudies().length,
            activeShapes: chart.getAllShapes().length,
            allPineShapes: window.PineIndicators._allPineShapeIds ? window.PineIndicators._allPineShapeIds.size : 0
        };
    }''')
    print('4. Sessions Removed Cleanly:', remove_res)

    page.wait_for_timeout(1000)
    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/sessions_removed_verified.png')

    browser.close()
