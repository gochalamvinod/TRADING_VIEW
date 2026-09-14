from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe', timeout=20000)
    page.evaluate('''() => new Promise(r => {
        const check = () => { if (window.widget && window.widget.activeChart) r(); else setTimeout(check, 100); };
        check();
    })''')

    res = page.evaluate('''async () => {
        const chart = window.widget.activeChart();
        const innerWin = window.widget._innerWindow ? window.widget._innerWindow() : document.querySelector('#tv_chart_container iframe')?.contentWindow;
        const repo = chart.studyMetaInfoRepository ? chart.studyMetaInfoRepository() : null;
        const allJava = repo ? await repo.findAllJavaStudies() : [];
        return {
            javaCount: allJava.length,
            sample: allJava.slice(0, 5).map(s => ({ id: s.id, desc: s.description }))
        };
    }''')
    print("Java studies:", res)
    b.close()
