import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:9000"
PINE_FILE = r"E:\TRADINGVIEW ADVANCED\scratch_luxalgo.pine"
SCREENSHOT_PATH = r"E:\TRADINGVIEW ADVANCED\screenshots\user_flow_verification.png"

with open(PINE_FILE, "r", encoding="utf-8") as f:
    pine_code = f.read()

print("=" * 80)
print("TESTING USER INTERACTIVE FLOW: PINE EDITOR -> ADD TO CHART")
print("=" * 80)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    page.on("console", lambda msg: print(f"PAGE CONSOLE [{msg.type}]: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

    print("\n1. Navigating to TradingView chart...")
    page.goto(BASE_URL, timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)

    page.evaluate("""() => new Promise(res => {
        if (window.widget && window.widget.onChartReady) {
            window.widget.onChartReady(() => res(true));
        } else {
            setTimeout(() => res(true), 5000);
        }
    })""")
    print("  [OK] Chart ready!")

    # Check if Pine Editor button exists and open it
    print("\n2. Opening Pine Editor Dock...")
    editor_opened = page.evaluate("""() => {
        if (window.PineEditorIDE && typeof window.PineEditorIDE.open === 'function') {
            window.PineEditorIDE.open();
            return true;
        }
        // Try clicking editor button
        const btn = document.querySelector('#btn-pine-editor') || document.querySelector('[data-name="pine-editor"]');
        if (btn) { btn.click(); return true; }
        return false;
    }""")
    print(f"  [OK] Pine Editor open call: {editor_opened}")
    time.sleep(1)

    # Set the code into the Pine Editor
    print("\n3. Setting LuxAlgo Sessions Pine Script in Editor...")
    set_code_res = page.evaluate("""(code) => {
        if (window.PineEditorIDE && typeof window.PineEditorIDE.loadScript === 'function') {
            window.PineEditorIDE.loadScript("Sessions [LuxAlgo]", code, "luxalgo_sessions");
            return { method: 'loadScript', success: true };
        }
        const textarea = document.querySelector('#pine_code_input');
        if (textarea) {
            textarea.value = code;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            return { method: 'textarea', success: true };
        }
        return { success: false, error: 'Could not find editor input' };
    }""", pine_code)
    print(f"  [OK] Set code result: {set_code_res}")
    time.sleep(1)

    # Click "Add to chart" button in Pine Editor UI
    print("\n4. Clicking 'Add to chart' button in UI...")
    add_btn_res = page.evaluate("""() => {
        const addBtn = document.querySelector('#btn-pine-add-chart') || 
                       document.querySelector('.btn-pine-add-chart') ||
                       Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Add to chart'));
        if (addBtn) {
            addBtn.click();
            return { clicked: true, text: addBtn.innerText };
        }
        if (window.PineEditorIDE && typeof window.PineEditorIDE.addCurrentToChart === 'function') {
            window.PineEditorIDE.addCurrentToChart();
            return { clicked: true, method: 'addCurrentToChart' };
        }
        return { clicked: false, error: 'Add to chart button not found' };
    }""")
    print(f"  [OK] Add to chart button click: {add_btn_res}")

    print("\n5. Waiting for compilation, registration, and chart study rendering...")
    page.wait_for_timeout(6000)

    # Verify chart state
    print("\n6. Inspecting active studies and shapes on chart...")
    chart_info = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        if (!chart) return { error: 'No active chart' };
        
        let allStudies = chart.getAllStudies ? chart.getAllStudies() : [];
        let allShapes = chart.getAllShapes ? chart.getAllShapes() : [];
        
        // Wait up to 5s for shapes if not yet populated
        for (let attempt = 0; attempt < 10; attempt++) {
            if (allShapes.length > 0) break;
            await new Promise(r => setTimeout(r, 500));
            allShapes = chart.getAllShapes ? chart.getAllShapes() : [];
        }
        
        // Find legend elements in iframe
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe ? iframe.contentDocument : document;
        const legendSources = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]')).map(el => el.innerText);
        
        return {
            studiesCount: allStudies.length,
            studies: allStudies,
            shapesCount: allShapes.length,
            shapes: allShapes,
            legendSources: legendSources
        };
    }""")
    print("  Chart Inspection Result:")
    import json
    print(json.dumps(chart_info, indent=2))

    # Take full-resolution screenshot
    page.screenshot(path=SCREENSHOT_PATH)
    print(f"\n  [OK] Saved screenshot to: {SCREENSHOT_PATH}")

    browser.close()

print("\n" + "=" * 80)
print("USER INTERACTIVE FLOW COMPLETED")
print("=" * 80)
