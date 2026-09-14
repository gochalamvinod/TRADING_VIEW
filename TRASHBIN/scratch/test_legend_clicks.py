import sys
import json
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    # Capture all console logs and errors
    console_logs = []
    page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda exc: console_logs.append(f"[PAGE_ERROR] {exc}"))

    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)

    chart_frame = page.frames[1] if len(page.frames) > 1 else None
    if not chart_frame:
        print("ERROR: Chart frame not found!")
        browser.close()
        sys.exit(1)

    # Hover over legend to make action buttons visible
    legend_item = chart_frame.locator('[data-name="legend-source-title"]').first
    print("Found legend source title:", legend_item.count())

    # Check click on legend title
    print("\n--- Clicking legend source title (Change Symbol) ---")
    legend_item.click()
    page.wait_for_timeout(1000)

    # Check if symbol search dialog or any dialog opened in chart or main page
    chart_dialogs = chart_frame.evaluate("""() => {
        const dialogs = document.querySelectorAll('[role="dialog"], [class*="dialog"], [data-name*="dialog"], [class*="modal"], [class*="popup"]');
        return Array.from(dialogs).map(d => ({
            tag: d.tagName,
            class: (typeof d.className === 'string') ? d.className : '',
            id: d.id,
            visible: d.offsetParent !== null || window.getComputedStyle(d).display !== 'none',
            text: (d.innerText || '').slice(0, 100).replace(/\\n/g, ' ')
        })).filter(d => d.visible);
    }""")
    main_dialogs = page.evaluate("""() => {
        const dialogs = document.querySelectorAll('[role="dialog"], [class*="dialog"], [data-name*="dialog"], [class*="modal"], [class*="popup"]');
        return Array.from(dialogs).map(d => ({
            tag: d.tagName,
            class: (typeof d.className === 'string') ? d.className : '',
            id: d.id,
            visible: d.offsetParent !== null || window.getComputedStyle(d).display !== 'none',
            text: (d.innerText || '').slice(0, 100).replace(/\\n/g, ' ')
        })).filter(d => d.visible);
    }""")

    print(f"Chart frame visible dialogs after title click: {len(chart_dialogs)}")
    for d in chart_dialogs:
        print(f"  Chart Dialog: {d['class']} | {d['text']}")
    print(f"Main page visible dialogs after title click: {len(main_dialogs)}")
    for d in main_dialogs:
        print(f"  Main Dialog: {d['class']} | {d['text']}")

    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\after_title_click.png")

    # Close any open dialog or press Escape
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)

    # Now hover over legend and click 3-dots
    print("\n--- Hovering over legend to reveal 3-dots and clicking ---")
    legend_title_box = legend_item.bounding_box()
    if legend_title_box:
        chart_frame.hover('[data-name="legend-source-title"]')
        page.wait_for_timeout(500)

    more_btn = chart_frame.locator('[data-name="legend-more-action"]').first
    print("Found more button:", more_btn.count())
    if more_btn.count() > 0:
        is_visible = more_btn.is_visible()
        print("More button is_visible:", is_visible)
        more_btn.click(force=True)
        page.wait_for_timeout(1000)

        # Check for menu or dropdown
        menus = chart_frame.evaluate("""() => {
            const items = document.querySelectorAll('[role="menu"], [class*="menu"], [class*="dropdown"], [data-name*="menu"], [class*="context"]');
            return Array.from(items).map(m => ({
                tag: m.tagName,
                class: (typeof m.className === 'string') ? m.className : '',
                visible: m.offsetParent !== null || window.getComputedStyle(m).display !== 'none',
                text: (m.innerText || '').slice(0, 200).replace(/\\n/g, ' ')
            })).filter(m => m.visible && m.text.length > 0);
        }""")
        print(f"Chart frame visible menus after 3-dots click: {len(menus)}")
        for m in menus:
            print(f"  Menu: {m['class']} | {m['text']}")

    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\after_more_click.png")

    print("\n=== RECENT CONSOLE LOGS ===")
    for log in console_logs[-25:]:
        print(log)

    browser.close()
