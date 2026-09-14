import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    page.wait_for_timeout(4000)

    # Use PineEditorIDE to select sessions template and click Add to Chart
    res = page.evaluate('''async () => {
        const ide = window.PineEditorIDE;
        if (ide && ide.selectTemplate) {
            ide.selectTemplate('sessions_luxalgo');
            await ide.compileAndAddCurrentScript();
        }
        return {
            studies: window.widget.activeChart().getAllStudies().map(s => ({ id: s.id, name: s.name })),
            shapes: window.PineIndicators._allPineShapeIds ? Array.from(window.PineIndicators._allPineShapeIds) : []
        };
    }''')
    print('Add to chart result:', res)
    page.wait_for_timeout(2000)
    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/sessions_loaded.png')

    # Now let's inspect the iframe DOM for the eye icon in the legend
    eye_res = page.evaluate('''() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentWindow.document;
        const legendItems = doc.querySelectorAll('[data-name="legend-series-item"], [data-name="legend-source-item"]');
        const items = [];
        legendItems.forEach(item => {
            const titleEl = item.querySelector('[data-name="legend-source-title"]');
            const title = titleEl ? titleEl.textContent : item.textContent;
            const eyeBtn = item.querySelector('[data-name="legend-show-hide-action"], [data-name="toggle-visibility-button"], [data-name="show-hide-action"], .action-l31H9iuA');
            items.push({
                title: title.slice(0, 50),
                hasEye: !!eyeBtn
            });
        });
        return { items };
    }''')
    print('Legend items:', eye_res)

    browser.close()
