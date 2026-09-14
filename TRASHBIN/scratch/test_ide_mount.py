from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_selector("#tv_chart_container iframe", timeout=30000)
    time.sleep(3)

    state = page.evaluate("""() => {
        return {
            hasPineIDE: !!window.PineEditorIDE,
            hasDock: !!document.getElementById('pine_editor_dock'),
            hasTextarea: !!document.getElementById('pine_code_input'),
            appRoot: !!document.getElementById('app_root')
        };
    }""")
    print("State before open:", state)

    page.evaluate("() => window.PineEditorIDE.open()")
    time.sleep(1)

    state_after = page.evaluate("""() => {
        return {
            hasDock: !!document.getElementById('pine_editor_dock'),
            hasTextarea: !!document.getElementById('pine_code_input'),
            dockDisplay: document.getElementById('pine_editor_dock')?.style.display
        };
    }""")
    print("State after open:", state_after)
    browser.close()
