import sys
import json
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    console_msgs = []
    page.on("console", lambda m: console_msgs.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: console_msgs.append(f"[ERROR] {e}"))

    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    # Wait for chart to be fully ready
    page.wait_for_timeout(6000)

    chart_frame = page.frames[1] if len(page.frames) > 1 else None
    if not chart_frame:
        print("ERROR: Chart frame not found!")
        browser.close()
        sys.exit(1)

    print("=== 1. VERIFYING LEGEND TEXT & CLEAN LOOK (NO DUPLICATES, NO [X] BADGE) ===")
    legend_status = chart_frame.evaluate("""() => {
        const titleEl = document.querySelector('[data-name="legend-source-title"]');
        const descEl = document.querySelector('[data-name="legend-source-description"]');
        const logoEl = document.querySelector('.logoWrapper-l31H9iuA, [class*="logoWrapper"]');
        const item = document.querySelector('[data-name="legend-series-item"]');
        return {
            titleText: titleEl ? titleEl.innerText.trim() : null,
            descText: descEl ? descEl.innerText.trim() : null,
            itemText: item ? item.innerText.replace(/\\n/g, ' ') : null,
            logoDisplay: logoEl ? window.getComputedStyle(logoEl).display : 'none',
            logoVisible: logoEl ? (logoEl.offsetWidth > 0 && logoEl.offsetHeight > 0) : false
        };
    }""")
    print("Legend status:", json.dumps(legend_status, indent=2))

    # Screenshot legend before click
    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\verified_clean_legend_header.png", clip={"x": 0, "y": 0, "width": 800, "height": 200})
    print("Screenshot 1 saved: verified_clean_legend_header.png")

    print("\n=== 2. CLICKING LEGEND SYMBOL TITLE TO OPEN SYMBOL SEARCH ===")
    title_clicked = chart_frame.evaluate("""() => {
        const el = document.querySelector('[data-name="legend-source-title"]') || document.querySelector('.title-l31H9iuA');
        if (!el) return { error: "No title element found" };
        el.click();
        return { clicked: true };
    }""")
    print("Title click result:", title_clicked)
    page.wait_for_timeout(1500)

    # Check if Symbol Search dialog opened
    search_modal_status = chart_frame.evaluate("""() => {
        const dialog = document.querySelector('[data-name="symbol-search-dialog"], [data-dialog-name="symbol-search"], [role="dialog"]');
        const input = document.querySelector('input[data-role="search"], input[type="text"]');
        return {
            dialogFound: !!dialog,
            dialogClass: dialog ? dialog.className : null,
            dialogText: dialog ? dialog.innerText.slice(0, 100).replace(/\\n/g, ' ') : null,
            inputFound: !!input,
            inputPlaceholder: input ? input.placeholder : null
        };
    }""")
    print("Symbol Search Dialog status:", json.dumps(search_modal_status, indent=2))

    # Screenshot of open Symbol Search dialog
    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\verified_symbol_search_opened_from_legend.png")
    print("Screenshot 2 saved: verified_symbol_search_opened_from_legend.png")

    # Close the symbol search dialog by pressing Escape
    page.keyboard.press("Escape")
    page.wait_for_timeout(1000)

    print("\n=== 3. HOVERING OVER LEGEND & CLICKING 3-DOTS BUTTON ===")
    # Hover over legend item
    chart_frame.hover('[data-name="legend-series-item"]')
    page.wait_for_timeout(500)

    more_clicked = chart_frame.evaluate("""() => {
        const moreBtn = document.querySelector('[data-name="legend-more-action"]');
        if (!moreBtn) return { error: "3-dots more button not found" };
        const style = window.getComputedStyle(moreBtn);
        const rect = moreBtn.getBoundingClientRect();
        moreBtn.click();
        return {
            clicked: true,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            rect: rect
        };
    }""")
    print("3-dots button click result:", json.dumps(more_clicked, indent=2))
    page.wait_for_timeout(1000)

    # Check if context menu opened
    menu_status = chart_frame.evaluate("""() => {
        const menu = document.querySelector('[role="menu"], [data-name="menu-inner"], [class*="menu-"]');
        return {
            menuFound: !!menu,
            menuClass: menu ? menu.className : null,
            menuText: menu ? menu.innerText.slice(0, 150).replace(/\\n/g, ' ') : null
        };
    }""")
    print("Menu status:", json.dumps(menu_status, indent=2))

    # Screenshot of open context menu from 3-dots
    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\verified_legend_3dots_menu_opened.png")
    print("Screenshot 3 saved: verified_legend_3dots_menu_opened.png")

    print("\n=== 4. VERIFYING DARK THEME IN PINE EDITOR WORKSPACE ===")
    # Open Pine Editor
    page.evaluate("""() => {
        if (window.PineEditorIDE && typeof window.PineEditorIDE.setDockOpen === 'function') {
            window.PineEditorIDE.setDockOpen(true);
        }
    }""")
    page.wait_for_timeout(1000)

    editor_colors = page.evaluate("""() => {
        const ws = document.querySelector('.pine-workspace');
        const gut = document.querySelector('.pine-gutter');
        const txt = document.querySelector('.pine-code-textarea');
        const bar = document.querySelector('.pine-bottom-statusbar-v2');
        return {
            workspaceBg: ws ? window.getComputedStyle(ws).backgroundColor : null,
            gutterBg: gut ? window.getComputedStyle(gut).backgroundColor : null,
            textareaColor: txt ? window.getComputedStyle(txt).color : null,
            statusbarBg: bar ? window.getComputedStyle(bar).backgroundColor : null
        };
    }""")
    print("Editor Dark Theme Colors:", json.dumps(editor_colors, indent=2))

    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\verified_dark_editor_workspace.png")
    print("Screenshot 4 saved: verified_dark_editor_workspace.png")

    browser.close()
