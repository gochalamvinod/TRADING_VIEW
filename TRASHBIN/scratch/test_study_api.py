import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    page.wait_for_timeout(4000)

    res = page.evaluate('''async () => {
        const chart = window.widget.activeChart();
        const studyId = await chart.createStudy('SMA Crossover', false, false);
        const studyApi = chart.getStudyById(studyId);
        const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(studyApi));
        
        let hasPropVisible = false;
        let isVis = null;
        if (typeof studyApi.isVisible === 'function') {
            isVis = studyApi.isVisible();
        }
        
        // Also check raw study from model
        const modelStudy = window.widget._innerWindow 
            ? window.widget._innerWindow().document 
            : null;
            
        return {
            studyId,
            isVis,
            methods: proto.filter(m => /visib|prop|show|hide/i.test(m))
        };
    }''')
    print('Study API test:', res)

    # Now test studyApi.setVisible(false)
    toggle_res = page.evaluate('''() => {
        const chart = window.widget.activeChart();
        const studies = chart.getAllStudies();
        const studyApi = chart.getStudyById(studies[0].id);
        const before = studyApi.isVisible();
        studyApi.setVisible(false);
        const after = studyApi.isVisible();
        return { before, after };
    }''')
    print('Study API toggle test:', toggle_res)

    browser.close()
