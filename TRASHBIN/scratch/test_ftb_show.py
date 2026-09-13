import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)

    res = page.evaluate("""() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const iWin = iframe?.contentWindow;
        const tb = iWin?.lineToolPropertiesToolbar;
        if (!tb || !tb._floatingToolbar) return { error: "no floating toolbar" };

        tb._floatingToolbar.show();

        const widget = tb._floatingToolbar._widget;
        const codeBtn = widget?.querySelector('[data-name="source-code"], .tv-floating-code-btn');

        return {
            widgetTag: widget?.tagName,
            widgetClass: widget?.className,
            hasCodeBtn: !!codeBtn,
            codeBtnText: codeBtn?.textContent?.trim(),
            codeBtnTitle: codeBtn?.getAttribute('title'),
            buttons: Array.from(widget?.querySelectorAll('[data-name]') || []).map(b => b.getAttribute('data-name'))
        };
    }""")
    print("Floating Toolbar show result:\n", json.dumps(res, indent=2))
    browser.close()
