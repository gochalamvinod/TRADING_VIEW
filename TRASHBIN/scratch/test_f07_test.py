import json
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

code = '''//@version=6
indicator("Feature 07 - Hline Levels", overlay=true)
h1 = hline(4400.0, "Resistance Level", color=color.red, linestyle=hline.style_dashed, linewidth=2)
h2 = hline(4390.0, "Support Level", color=color.green, linestyle=hline.style_solid, linewidth=2)
'''

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.on("console", lambda msg: print(f"PAGE CONSOLE [{msg.type}]: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR STACK: {getattr(err, 'stack', err)}"))
    print("Navigating to page...")
    page.goto('http://127.0.0.1:9000')
    print("Waiting for iframe...")
    page.wait_for_selector('#tv_chart_container iframe', timeout=20000)
    print("Waiting for onChartReady...")
    page.evaluate('''() => new Promise(res => {
        if (window.widget && window.widget.onChartReady) {
            window.widget.onChartReady(() => res(true));
        } else {
            setTimeout(() => res(true), 5000);
        }
    })''')
    print("Chart ready! Evaluating...")
    res = page.evaluate('''async (c) => {
        const steps = [];
        try {
            steps.push("1. getting chart");
            const chart = window.widget.activeChart();
            steps.push("chart exists: " + (!!chart));
            
            steps.push("2. compileAndRegisterPine check");
            const hasComp = !!(window.PineIndicators && window.PineIndicators.compileAndRegisterPine);
            steps.push("hasComp: " + hasComp);
            
            steps.push("3. compiling");
            const reg = window.PineIndicators.compileAndRegisterPine(c);
            steps.push("reg title: " + (reg && reg.meta && reg.meta.title));
            
            steps.push("4. registering to JSServer and repo");
            const innerWin = window.widget._innerWindow ? window.widget._innerWindow() : document.querySelector('#tv_chart_container iframe')?.contentWindow;
            if (innerWin && innerWin.JSServer && Array.isArray(innerWin.JSServer.studyLibrary)) {
                innerWin.JSServer.studyLibrary.push(reg.study);
            }
            const repo = typeof chart.studyMetaInfoRepository === 'function' ? chart.studyMetaInfoRepository() : (chart.studyMetaIntoRepository ? chart.studyMetaIntoRepository() : null);
            if (repo) {
                if (typeof repo._processLibraryMetaInfo === 'function') repo._processLibraryMetaInfo([reg.study.metainfo]);
                if (Array.isArray(repo._rawStudiesMetaInfo)) repo._rawStudiesMetaInfo.push(reg.study.metainfo);
                if (Array.isArray(repo._javaStudiesMetaInfo)) repo._javaStudiesMetaInfo.push(reg.study.metainfo);
            }
            steps.push("5. calling createStudy");
            const title = reg.meta.title;
            const overlay = reg.meta.isOverlay !== undefined ? reg.meta.isOverlay : true;
            
            let id = null;
            try {
                id = await chart.createStudy(title, overlay, false);
                steps.push("createStudy returned: " + id);
            } catch (err) {
                steps.push("createStudy threw: " + err.toString());
            }
            
            return { success: true, steps, id };
        } catch (e) {
            return { success: false, steps, err: e.toString() };
        }
    }''', code)
    print("Browser execution result:", json.dumps(res, indent=2))
    b.close()
