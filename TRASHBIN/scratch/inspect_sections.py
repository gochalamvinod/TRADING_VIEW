import sys
import json
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)

    chart_frame = page.frames[1] if len(page.frames) > 1 else None

    # Let's inspect:
    # 1. Top Header Toolbar in chart_frame
    header_info = chart_frame.evaluate("""() => {
        const header = document.querySelector('#header-toolbar, [data-name="header-toolbar"], [class*="header-toolbar"]');
        if (!header) return { error: 'No header toolbar found' };
        const buttons = Array.from(header.querySelectorAll('button, [role="button"], [data-name]')).map(b => ({
            tag: b.tagName,
            id: b.id,
            dataName: b.getAttribute('data-name') || '',
            ariaLabel: b.getAttribute('aria-label') || '',
            title: b.getAttribute('title') || '',
            text: b.innerText ? b.innerText.trim() : '',
            classes: b.className
        }));
        return { count: buttons.length, buttons };
    }""")
    print("=== HEADER TOOLBAR BUTTONS ===")
    print(json.dumps(header_info, indent=2))

    # 2. Left Drawing Toolbar in chart_frame
    drawing_info = chart_frame.evaluate("""() => {
        const toolbar = document.querySelector('#drawing-toolbar, [data-name="drawing-toolbar"], [class*="drawingToolbar"]');
        if (!toolbar) return { error: 'No drawing toolbar found' };
        const buttons = Array.from(toolbar.querySelectorAll('button, [role="button"], [data-name]')).map(b => ({
            tag: b.tagName,
            id: b.id,
            dataName: b.getAttribute('data-name') || '',
            ariaLabel: b.getAttribute('aria-label') || '',
            title: b.getAttribute('title') || '',
            text: b.innerText ? b.innerText.trim() : '',
            classes: b.className
        }));
        return { count: buttons.length, buttons };
    }""")
    print("=== DRAWING TOOLBAR BUTTONS ===")
    print(json.dumps(drawing_info, indent=2))

    # 3. Chart Legend in chart_frame
    legend_info = chart_frame.evaluate("""() => {
        const legend = document.querySelector('[data-name="legend"], [class*="legend-"], [id*="legend"]');
        if (!legend) return { error: 'No legend found' };
        const buttons = Array.from(legend.querySelectorAll('button, [role="button"], [data-name]')).map(b => ({
            tag: b.tagName,
            id: b.id,
            dataName: b.getAttribute('data-name') || '',
            ariaLabel: b.getAttribute('aria-label') || '',
            title: b.getAttribute('title') || '',
            text: b.innerText ? b.innerText.trim() : '',
            classes: b.className
        }));
        return { count: buttons.length, buttons, html: legend.innerHTML.slice(0, 500) };
    }""")
    print("=== CHART LEGEND ===")
    print(json.dumps(legend_info, indent=2))

    # 4. Right Side Toolbar in chart_frame
    right_info = chart_frame.evaluate("""() => {
        const right = document.querySelector('[data-name="right-toolbar"], [class*="right-toolbar"], #right-toolbar');
        if (!right) return { error: 'No right toolbar found' };
        const buttons = Array.from(right.querySelectorAll('button, [role="button"], [data-name]')).map(b => ({
            tag: b.tagName,
            id: b.id,
            dataName: b.getAttribute('data-name') || '',
            ariaLabel: b.getAttribute('aria-label') || '',
            title: b.getAttribute('title') || '',
            text: b.innerText ? b.innerText.trim() : ''
        }));
        return { count: buttons.length, buttons };
    }""")
    print("=== RIGHT TOOLBAR ===")
    print(json.dumps(right_info, indent=2))

    # 5. Bottom Dock Tabs in chart_frame
    bottom_tabs = chart_frame.evaluate("""() => {
        const bottom = document.querySelector('[data-name="bottom-area"], [class*="bottom-widgetbar"], [class*="bottomToolbar"], [data-name="underline-tabs-buttons"]');
        const tabs = Array.from(document.querySelectorAll('[data-name="scripteditor"], [data-name="strategy_tester_tab"], [data-name="paper_trading"], [data-name="trade-panel-button"], [class*="bottomTabs"] button')).map(b => ({
            tag: b.tagName,
            id: b.id,
            dataName: b.getAttribute('data-name') || '',
            ariaLabel: b.getAttribute('aria-label') || '',
            title: b.getAttribute('title') || '',
            text: b.innerText ? b.innerText.trim() : ''
        }));
        return tabs;
    }""")
    print("=== BOTTOM TABS ===")
    print(json.dumps(bottom_tabs, indent=2))

    # 6. Pine Editor in Main Page or Frame
    pine_main = page.evaluate("""() => {
        const editor = document.querySelector('#pine-editor-ide, .pine-editor-ide, [class*="pine-editor"], #pine_editor_container');
        if (!editor) return { error: 'No pine editor in main page' };
        const buttons = Array.from(editor.querySelectorAll('button, [role="button"], select, input, .btn')).map(b => ({
            tag: b.tagName,
            id: b.id,
            className: b.className,
            title: b.getAttribute('title') || '',
            ariaLabel: b.getAttribute('aria-label') || '',
            text: b.innerText ? b.innerText.trim() : ''
        }));
        return { count: buttons.length, buttons, visible: editor.offsetParent !== null };
    }""")
    print("=== PINE EDITOR (MAIN PAGE) ===")
    print(json.dumps(pine_main, indent=2))

    browser.close()
