import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)
    page.evaluate("window.PineEditorIDE.addStudyToChart()")
    page.wait_for_timeout(2500)

    res = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const win = iframe?.contentWindow;

        const more = doc.querySelector('[data-name="legend-more-action"]');
        more.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, view: win }));
        more.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, view: win }));

        await new Promise(r => setTimeout(r, 600));

        const menu = doc.querySelector('.menuWrap-Kq3ruQo8, [class*="menuWrap"]');
        let parent = menu?.parentElement;
        const parents = [];
        while (parent) {
            parents.push({
                tag: parent.tagName,
                id: parent.id,
                className: parent.className,
                overflow: window.getComputedStyle(parent).overflow,
                overflowX: window.getComputedStyle(parent).overflowX,
                overflowY: window.getComputedStyle(parent).overflowY,
                zIndex: window.getComputedStyle(parent).zIndex
            });
            parent = parent.parentElement;
        }
        return {
            menuFound: !!menu,
            menuStyle: menu ? {
                position: window.getComputedStyle(menu).position,
                top: window.getComputedStyle(menu).top,
                left: window.getComputedStyle(menu).left,
                width: window.getComputedStyle(menu).width,
                height: window.getComputedStyle(menu).height,
                overflow: window.getComputedStyle(menu).overflow,
                overflowX: window.getComputedStyle(menu).overflowX,
                overflowY: window.getComputedStyle(menu).overflowY,
                zIndex: window.getComputedStyle(menu).zIndex
            } : null,
            parents
        };
    }""")
    print(json.dumps(res, indent=2))
    browser.close()
