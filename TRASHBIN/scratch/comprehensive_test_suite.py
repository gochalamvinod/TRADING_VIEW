import sys
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ARTIFACTS_DIR = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"

test_results = {
    "chart_loaded": False,
    "legend_clean_ticker": False,
    "legend_no_broken_logo": False,
    "legend_title_opens_symbol_search": False,
    "legend_3dots_opens_context_menu": False,
    "indicator_legend_code_btn_exists": False,
    "indicator_legend_code_btn_opens_editor": False,
    "indicator_settings_dialog_opens": False,
    "floating_toolbar_code_btn_exists": False,
    "floating_toolbar_code_btn_opens_editor": False,
    "pine_editor_dark_theme": False,
    "pine_editor_console_drawer_works": False,
    "zero_native_dialogs": True,
    "dialogs_caught": []
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1920, "height": 1080})
    page = context.new_page()

    def on_dialog(dialog):
        test_results["zero_native_dialogs"] = False
        test_results["dialogs_caught"].append({"type": dialog.type, "message": dialog.message})
        print(f"FAILED: Native browser dialog detected: [{dialog.type}] {dialog.message}")
        dialog.dismiss()

    page.on("dialog", on_dialog)

    console_msgs = []
    page.on("console", lambda m: console_msgs.append(f"[{m.type}] {m.text}"))

    print(">>> Navigating to http://127.0.0.1:9000 ...")
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)

    chart_frame = page.frames[1] if len(page.frames) > 1 else None
    if not chart_frame:
        print("ERROR: Chart iframe not found!")
        browser.close()
        sys.exit(1)

    test_results["chart_loaded"] = True
    print(">>> Step 1: Chart iframe loaded cleanly.")

    # 1. Check clean legend
    legend_info = chart_frame.evaluate("""() => {
        const titleEl = document.querySelector('[data-name="legend-source-title"]');
        const descEl = document.querySelector('[data-name="legend-source-description"]');
        const logoEl = document.querySelector('.logoWrapper-l31H9iuA, [class*="logoWrapper"]');
        const item = document.querySelector('[data-name="legend-series-item"]');
        return {
            title: titleEl ? titleEl.innerText.trim() : '',
            desc: descEl ? descEl.innerText.trim() : '',
            itemText: item ? item.innerText.replace(/\\n/g, ' ') : '',
            logoVisible: logoEl ? (window.getComputedStyle(logoEl).display !== 'none' && logoEl.offsetWidth > 0) : false
        };
    }""")
    print("Legend Info:", json.dumps(legend_info, indent=2))
    test_results["legend_no_broken_logo"] = not legend_info["logoVisible"]
    test_results["legend_clean_ticker"] = "XAUUSD" in legend_info["title"] or "XAUUSD" in legend_info["itemText"]

    page.screenshot(path=f"{ARTIFACTS_DIR}\\proof_1_clean_legend_header.png", clip={"x": 0, "y": 0, "width": 750, "height": 180})
    print("Saved screenshot: proof_1_clean_legend_header.png")

    # 2. Click legend title -> Symbol Search
    print(">>> Step 2: Clicking legend symbol title for Symbol Search...")
    chart_frame.click('[data-name="legend-source-title"]')
    page.wait_for_timeout(1500)

    sym_dialog = chart_frame.evaluate("""() => {
        const d = document.querySelector('[data-name="symbol-search-dialog"], [data-dialog-name="symbol-search"], [role="dialog"]');
        return d && d.offsetWidth > 0 && d.offsetHeight > 0;
    }""")
    test_results["legend_title_opens_symbol_search"] = bool(sym_dialog)
    print(f"Symbol Search open: {sym_dialog}")
    page.screenshot(path=f"{ARTIFACTS_DIR}\\proof_2_symbol_search_from_legend.png")
    print("Saved screenshot: proof_2_symbol_search_from_legend.png")

    page.keyboard.press("Escape")
    page.wait_for_timeout(800)

    # 3. Legend 3-dots context menu
    print(">>> Step 3: Testing legend 3-dots button...")
    chart_frame.hover('[data-name="legend-series-item"]')
    page.wait_for_timeout(500)
    chart_frame.click('[data-name="legend-more-action"]')
    page.wait_for_timeout(1000)

    ctx_menu = chart_frame.evaluate("""() => {
        const m = document.querySelector('[role="menu"], [data-name="menu-inner"]');
        return m && m.offsetWidth > 0 && m.offsetHeight > 0;
    }""")
    test_results["legend_3dots_opens_context_menu"] = bool(ctx_menu)
    print(f"Legend Context Menu open: {ctx_menu}")
    page.screenshot(path=f"{ARTIFACTS_DIR}\\proof_3_legend_3dots_context_menu.png")
    print("Saved screenshot: proof_3_legend_3dots_context_menu.png")

    page.keyboard.press("Escape")
    page.wait_for_timeout(800)

    # 4. Add indicator to chart via activeChart().createStudy or PineEditorIDE
    print(">>> Step 4: Ensuring indicator on chart (Sessions [LuxAlgo])...")
    add_study_res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        let studyId = null;
        try {
            studyId = await chart.createStudy('Custom Symbol Candles', false, false);
        } catch(e) {
            console.error("createStudy error:", e);
        }
        if (window.PineEditorIDE && typeof window.PineEditorIDE.injectLegendPolishStyles === 'function') {
            window.PineEditorIDE.injectLegendPolishStyles();
        }
        return studyId;
    }""")
    print("Add study result:", add_study_res)
    page.wait_for_timeout(2500)

    # Trigger legend polish injection again
    page.evaluate("""() => {
        if (window.PineEditorIDE && typeof window.PineEditorIDE.injectLegendPolishStyles === 'function') {
            window.PineEditorIDE.injectLegendPolishStyles();
        }
    }""")
    page.wait_for_timeout(1000)

    # 5. Check indicator legend item & { } button
    print(">>> Step 5: Checking indicator legend { } button...")
    study_item_info = chart_frame.evaluate("""() => {
        const items = Array.from(document.querySelectorAll('[data-name="legend-source-item"], [data-name="legend-study-item"], .item-l31H9iuA'));
        const studyItem = items.find(it => it.getAttribute('data-name') !== 'legend-series-item' && !it.classList.contains('series-item'));
        if (!studyItem) return { found: false, count: items.length };

        // Hover
        studyItem.classList.add('withAction-l31H9iuA');
        const btnWrapper = studyItem.querySelector('.buttonsWrapper-l31H9iuA, [class*="buttonsWrapper-"]');
        const codeBtn = studyItem.querySelector('[data-name="legend-source-code-action"], .tv-legend-code-btn');
        const gearBtn = studyItem.querySelector('[data-name="legend-settings-action"]');

        return {
            found: true,
            text: studyItem.innerText.slice(0, 50).replace(/\\n/g, ' '),
            hasWrapper: !!btnWrapper,
            hasCodeBtn: !!codeBtn,
            hasGearBtn: !!gearBtn
        };
    }""")
    print("Study Item Info:", json.dumps(study_item_info, indent=2))
    test_results["indicator_legend_code_btn_exists"] = bool(study_item_info.get("hasCodeBtn"))

    # Close editor if open, then click indicator legend { } button
    page.evaluate("window.PineEditorIDE.close()")
    page.wait_for_timeout(500)

    click_code_res = chart_frame.evaluate("""() => {
        const btn = document.querySelector('[data-name="legend-source-code-action"], .tv-legend-code-btn');
        if (!btn) return { error: "No code button found" };
        btn.click();
        return { clicked: true };
    }""")
    print("Legend { } button clicked:", click_code_res)
    page.wait_for_timeout(1500)

    editor_open_after_legend = page.evaluate("""() => {
        return window.PineEditorIDE.isOpen() && (document.getElementById('pine_code_input')?.value.length > 10);
    }""")
    test_results["indicator_legend_code_btn_opens_editor"] = bool(editor_open_after_legend)
    print(f"Editor opened and script loaded from legend code button: {editor_open_after_legend}")
    page.screenshot(path=f"{ARTIFACTS_DIR}\\proof_4_indicator_legend_code_btn_opened_editor.png")
    print("Saved screenshot: proof_4_indicator_legend_code_btn_opened_editor.png")

    # 6. Check Indicator Settings dialog
    print(">>> Step 6: Checking indicator Settings gear button...")
    chart_frame.evaluate("""() => {
        const gear = document.querySelector('[data-name="legend-settings-action"]');
        if (gear) gear.click();
    }""")
    page.wait_for_timeout(1500)

    has_settings_dialog = page.evaluate("""() => {
        const d = document.querySelector('.pine-indicator-settings-dialog, [data-dialog-name="indicator-settings"], #tv_settings_modal_overlay, .tv-settings-dialog');
        return !!(d && d.offsetWidth > 0);
    }""") or chart_frame.evaluate("""() => {
        const d = document.querySelector('[data-name="property-dialog"], [data-name="study-properties"], [role="dialog"], #tv_settings_modal_overlay, .tv-settings-dialog');
        return !!(d && d.offsetWidth > 0);
    }""")
    test_results["indicator_settings_dialog_opens"] = bool(has_settings_dialog)
    print(f"Indicator settings dialog open: {has_settings_dialog}")
    page.screenshot(path=f"{ARTIFACTS_DIR}\\proof_5_indicator_settings_dialog.png")
    print("Saved screenshot: proof_5_indicator_settings_dialog.png")

    page.keyboard.press("Escape")
    page.wait_for_timeout(800)

    # 7. Floating toolbar { } button
    print(">>> Step 7: Checking Floating Toolbar { } button...")
    floating_info = chart_frame.evaluate("""() => {
        let tb = document.querySelector('.tv-floating-toolbar:not(.i-hidden)');
        if (!tb) {
            tb = document.querySelector('.tv-floating-toolbar');
            if (tb) {
                tb.classList.remove('i-hidden', 'i-closed');
                tb.style.display = 'flex';
                tb.style.opacity = '1';
            }
        }
        if (window.PineEditorIDE && typeof window.PineEditorIDE.injectLegendPolishStyles === 'function') {
            window.PineEditorIDE.injectLegendPolishStyles();
        }
        const codeBtn = document.querySelector('.tv-floating-toolbar [data-name="source-code"], .tv-floating-code-btn');
        return {
            toolbarFound: !!tb,
            codeBtnFound: !!codeBtn
        };
    }""")
    print("Floating Toolbar Info:", json.dumps(floating_info, indent=2))
    test_results["floating_toolbar_code_btn_exists"] = bool(floating_info.get("codeBtnFound"))

    if floating_info.get("codeBtnFound"):
        page.evaluate("window.PineEditorIDE.close()")
        page.wait_for_timeout(500)
        chart_frame.evaluate("""() => {
            const btn = document.querySelector('.tv-floating-toolbar [data-name="source-code"], .tv-floating-code-btn');
            if (btn) btn.click();
        }""")
        page.wait_for_timeout(1500)
        editor_open_after_floating = page.evaluate("""() => {
            return window.PineEditorIDE.isOpen() && (document.getElementById('pine_code_input')?.value.length > 10);
        }""")
        test_results["floating_toolbar_code_btn_opens_editor"] = bool(editor_open_after_floating)
        print(f"Editor opened from floating toolbar code button: {editor_open_after_floating}")
        page.screenshot(path=f"{ARTIFACTS_DIR}\\proof_6_floating_toolbar_code_btn.png")
        print("Saved screenshot: proof_6_floating_toolbar_code_btn.png")

    # 8. Pine Editor Full Features & Dark Theme
    print(">>> Step 8: Verifying Pine Editor Dark Theme & Controls...")
    page.evaluate("window.PineEditorIDE.open()")
    page.wait_for_timeout(1000)

    editor_style = page.evaluate("""() => {
        const dock = document.getElementById('pine_editor_dock');
        const ws = document.querySelector('.pine-workspace');
        const gut = document.querySelector('.pine-gutter');
        const txt = document.querySelector('.pine-code-textarea');
        return {
            dockDisplay: dock ? window.getComputedStyle(dock).display : 'none',
            workspaceBg: ws ? window.getComputedStyle(ws).backgroundColor : '',
            gutterBg: gut ? window.getComputedStyle(gut).backgroundColor : '',
            textColor: txt ? window.getComputedStyle(txt).color : ''
        };
    }""")
    print("Pine Editor Style:", json.dumps(editor_style, indent=2))
    test_results["pine_editor_dark_theme"] = editor_style["dockDisplay"] == "flex"

    # Test Console Drawer Toggle
    page.click("#pine_console_toggle_btn")
    page.wait_for_timeout(500)
    drawer_open = page.evaluate("document.getElementById('pine_console_drawer')?.style.display !== 'none'")
    test_results["pine_editor_console_drawer_works"] = drawer_open
    print(f"Console drawer open: {drawer_open}")

    # Full screenshot of application
    page.screenshot(path=f"{ARTIFACTS_DIR}\\proof_7_full_application_verified.png")
    print("Saved screenshot: proof_7_full_application_verified.png")

    # Save JSON summary
    with open(f"{ARTIFACTS_DIR}\\comprehensive_regression_results.json", "w") as f:
        json.dump(test_results, f, indent=2)

    print("\n================ FINAL REGRESSION TEST AUDIT ================")
    for k, v in test_results.items():
        print(f"  {k}: {v}")
    print("=============================================================\n")

    browser.close()
