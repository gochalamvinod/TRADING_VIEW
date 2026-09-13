import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)

    page.evaluate("""() => {
        if (window.setAppTheme) window.setAppTheme('Dark');
        if (window.PineEditorIDE && window.PineEditorIDE.open) window.PineEditorIDE.open();
    }""")
    page.wait_for_timeout(1000)

    styles = page.evaluate("""() => {
        const getStyle = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const cs = window.getComputedStyle(el);
            return {
                bg: cs.backgroundColor,
                color: cs.color,
                border: cs.border,
                borderTop: cs.borderTopColor,
                borderRight: cs.borderRightColor
            };
        };
        
        return {
            dock: getStyle('#pine_editor_dock'),
            workspace: getStyle('.pine-workspace'),
            gutter: getStyle('.pine-gutter'),
            textarea: getStyle('.pine-code-textarea'),
            minimap: getStyle('.pine-minimap-strip'),
            statusbar_v2: getStyle('.pine-bottom-statusbar-v2'),
            console_toggle: getStyle('.pine-console-toggle-btn-v2'),
            status_item: getStyle('.pine-status-item-v2'),
            console_drawer_v2: getStyle('.pine-console-drawer-v2')
        };
    }""")
    print("DARK THEME COMPUTED STYLES:", styles)
    browser.close()
