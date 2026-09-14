import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    page.wait_for_timeout(3000)

    # 1. Add study and create shapes
    setup_res = page.evaluate('''async () => {
        const chart = window.widget.activeChart();
        const studyId = await chart.createStudy('SMA Crossover', false, false);
        const shapeId1 = await chart.createMultipointShape([
            { time: Math.floor(Date.now() / 1000) - 3600, price: 4410 },
            { time: Math.floor(Date.now() / 1000), price: 4420 }
        ], {
            shape: 'rectangle',
            overrides: { color: '#ff5d00', backgroundColor: '#ff5d00', fillBackground: true }
        });
        const shapeId2 = await chart.createShape({ time: Math.floor(Date.now() / 1000) - 1800, price: 4415 }, {
            shape: 'vertical_line',
            overrides: { linecolor: '#787b86', showTime: false }
        });

        window.PineIndicators.registerStudyShape(studyId, shapeId1);
        window.PineIndicators.registerStudyShape(studyId, shapeId2);

        // Setup observer
        if (window.PineEditorIDE && window.PineEditorIDE.setupStudyRemovalObserver) {
            window.PineEditorIDE.setupStudyRemovalObserver(chart);
        }

        const studyApi = chart.getStudyById(studyId);
        const props = studyApi.properties();
        const visProp = props.visible || (props.childs && props.childs().visible);
        if (visProp && typeof visProp.subscribe === 'function') {
            visProp.subscribe(null, (val) => {
                const isV = typeof val === 'boolean' ? val : (val && typeof val.value === 'function' ? val.value() : studyApi.isVisible());
                window.PineIndicators.setStudyShapesVisibility(studyId, isV, chart);
            });
        }

        return {
            studyId,
            shapeIds: [shapeId1, shapeId2],
            trackedShapes: window.PineIndicators.getStudyShapes(studyId)
        };
    }''')
    print('Setup res:', setup_res)

    page.wait_for_timeout(500)
    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/verify_sync_initial.png')

    # 2. Hide study
    hide_res = page.evaluate('''() => {
        const chart = window.widget.activeChart();
        const studies = chart.getAllStudies();
        const sApi = chart.getStudyById(studies[0].id);
        sApi.setVisible(false);

        const shapes = window.PineIndicators.getStudyShapes(studies[0].id);
        const hiddenStatuses = shapes.map(sid => {
            const api = chart.getShapeById(sid);
            return api && api.isHidden ? api.isHidden() : null;
        });

        return {
            studyVisible: sApi.isVisible(),
            hiddenStatuses
        };
    }''')
    print('After hide study:', hide_res)

    page.wait_for_timeout(500)
    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/verify_sync_hidden.png')

    # 3. Show study again
    show_res = page.evaluate('''() => {
        const chart = window.widget.activeChart();
        const studies = chart.getAllStudies();
        const sApi = chart.getStudyById(studies[0].id);
        sApi.setVisible(true);

        const shapes = window.PineIndicators.getStudyShapes(studies[0].id);
        const hiddenStatuses = shapes.map(sid => {
            const api = chart.getShapeById(sid);
            return api && api.isHidden ? api.isHidden() : null;
        });

        return {
            studyVisible: sApi.isVisible(),
            hiddenStatuses
        };
    }''')
    print('After show study:', show_res)

    page.wait_for_timeout(500)
    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/verify_sync_shown.png')

    # 4. Remove study completely
    remove_res = page.evaluate('''() => {
        const chart = window.widget.activeChart();
        const studies = chart.getAllStudies();
        chart.removeEntity(studies[0].id);
        window.PineIndicators.clearStudyShapes(studies[0].id, chart);
        return {
            activeStudies: chart.getAllStudies().length,
            activeShapes: chart.getAllShapes().length,
            allPineShapes: window.PineIndicators._allPineShapeIds ? window.PineIndicators._allPineShapeIds.size : 0
        };
    }''')
    print('After remove study:', remove_res)

    page.wait_for_timeout(500)
    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/verify_sync_removed.png')

    browser.close()
