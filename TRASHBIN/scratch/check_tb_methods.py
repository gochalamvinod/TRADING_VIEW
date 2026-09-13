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
        if (!tb) return { error: "no tb" };

        const protoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(tb));
        const props = Object.keys(tb);

        return {
            protoMethods,
            props
        };
    }""")
    print("lineToolPropertiesToolbar methods:\n", json.dumps(res, indent=2))
    browser.close()
