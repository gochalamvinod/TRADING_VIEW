import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DEST_DIR = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"

TEST_PINE_V4 = """//@version=4
study("Custom Momentum Ribbon", overlay=true)
length = input(14, "Length")
src = close
maFast = sma(src, length)
maSlow = ema(src, length * 2)
bullish = crossover(maFast, maSlow)
bearish = crossunder(maFast, maSlow)
valHigh = highest(high, 20)
valLow = lowest(low, 20)
diffSpread = abs(valHigh - valLow)
secClose = security(syminfo.tickerid, "D", close)
strVal = tostring(diffSpread)

plot(maFast, "Fast SMA", color=green)
plot(maSlow, "Slow EMA", color=red)
plotshape(bullish, "Bullish Cross", style=shape.triangleup, color=lime)
plotshape(bearish, "Bearish Cross", style=shape.triangledown, color=orange)
"""

# Also create extra lines to test scrolling in diff modal
TEST_PINE_LONG_V4 = TEST_PINE_V4 + "\n" + "\n".join([f"s{i} = sma(close, {i})\nplot(s{i}, color=blue)" for i in range(1, 35)])

results = {
    "gutter_bulb_verified": False,
    "quickfix_popover_verified": False,
    "diff_modal_verified": False,
    "diff_colors_verified": False,
    "scroll_sync_verified": False,
    "cancel_verified": False,
    "apply_verified": False,
    "screenshots": []
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    
    print("[1/7] Navigating to TradingView Advanced Charts (http://127.0.0.1:9000)...")
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    
    # Open Pine Editor
    print("[2/7] Opening Pine Editor...")
    page.evaluate("window.PineEditorIDE.open()")
    page.wait_for_timeout(500)
    
    # Load v4 Script
    print("[3/7] Loading Pine Script v4 with legacy namespaces and functions...")
    page.evaluate(f"""() => {{
        window.PineEditorIDE.loadScript("Momentum Ribbon v4", `{TEST_PINE_V4}`);
    }}""")
    page.wait_for_timeout(500)
    
    # Step 1: Verify Gutter Lightbulb
    bulb_el = page.query_selector('.pine-version-bulb')
    if bulb_el:
        bulb_version = bulb_el.get_attribute('data-version')
        bulb_title = bulb_el.get_attribute('title')
        print(f"  -> Lightbulb found! data-version={bulb_version}, title='{bulb_title}'")
        results["gutter_bulb_verified"] = (bulb_version == "4" and "Quick Fix" in bulb_title)
    else:
        print("  -> ERROR: Lightbulb not found in gutter!")

    # Screenshot 1: Gutter Lightbulb
    ss1 = os.path.join(DEST_DIR, "verified_version_converter_gutter_lightbulb.png")
    page.screenshot(path=ss1)
    results["screenshots"].append(ss1)
    print(f"  -> Saved screenshot: {ss1}")
    
    # Step 2: Click Lightbulb & Verify Quick Fix Popover
    print("[4/7] Clicking Gutter Lightbulb to trigger Quick Fix popover...")
    bulb_el.click()
    page.wait_for_timeout(400)
    
    popover_info = page.evaluate("""() => {
        const pop = document.getElementById('pine_quickfix_popover');
        if (!pop) return null;
        const rect = pop.getBoundingClientRect();
        const btn = document.getElementById('pine_quickfix_convert_btn');
        return {
            exists: true,
            visible: pop.offsetWidth > 0 && pop.offsetHeight > 0,
            text: pop.innerText.trim(),
            btnText: btn ? btn.innerText.trim() : '',
            x: rect.x,
            y: rect.y
        };
    }""")
    print(f"  -> Popover info: {popover_info}")
    if popover_info and "Convert script to v6" in popover_info["btnText"]:
        results["quickfix_popover_verified"] = True
        
    # Screenshot 2: Quick Fix Popover
    ss2 = os.path.join(DEST_DIR, "verified_version_converter_quickfix_popover.png")
    page.screenshot(path=ss2)
    results["screenshots"].append(ss2)
    print(f"  -> Saved screenshot: {ss2}")
    
    # Step 3: Click "Convert script to v6" & Verify Side-by-Side Diff Modal
    print("[5/7] Selecting 'Convert script to v6' to open Diff Modal...")
    page.query_selector('#pine_quickfix_convert_btn').click()
    page.wait_for_timeout(500)
    
    diff_info = page.evaluate("""() => {
        const overlay = document.getElementById('tv_diff_modal_overlay');
        if (!overlay) return null;
        
        const titleEl = overlay.querySelector('div[style*="font-size: 16px"]');
        const leftPane = document.getElementById('tv_diff_left_pane');
        const rightPane = document.getElementById('tv_diff_right_pane');
        const cancelBtn = document.getElementById('tv_diff_cancel_btn');
        const applyBtn = document.getElementById('tv_diff_apply_btn');
        
        const redRows = leftPane ? leftPane.querySelectorAll('div[style*="rgba(242, 54, 69"]') : [];
        const greenRows = rightPane ? rightPane.querySelectorAll('div[style*="rgba(8, 153, 129"]') : [];
        
        const redTextSample = Array.from(redRows).slice(0, 3).map(r => r.innerText.trim());
        const greenTextSample = Array.from(greenRows).slice(0, 3).map(r => r.innerText.trim());
        
        return {
            hasOverlay: true,
            title: titleEl ? titleEl.innerText : '',
            hasLeftPane: !!leftPane,
            hasRightPane: !!rightPane,
            redCount: redRows.length,
            greenCount: greenRows.length,
            redTextSample: redTextSample,
            greenTextSample: greenTextSample,
            cancelLabel: cancelBtn ? cancelBtn.innerText : '',
            applyLabel: applyBtn ? applyBtn.innerText : ''
        };
    }""")
    print(f"  -> Diff Modal info: {diff_info}")
    
    if diff_info and diff_info["title"] == "Converting script" and diff_info["cancelLabel"] == "Cancel" and diff_info["applyLabel"] == "Apply":
        results["diff_modal_verified"] = True
    if diff_info and diff_info["redCount"] > 0 and diff_info["greenCount"] > 0:
        results["diff_colors_verified"] = True
        
    # Screenshot 3: Side-by-Side Diff Modal
    ss3 = os.path.join(DEST_DIR, "verified_version_converter_diff_modal.png")
    page.screenshot(path=ss3)
    results["screenshots"].append(ss3)
    print(f"  -> Saved screenshot: {ss3}")
    
    # Step 4: Close modal with Cancel, load long script, verify synchronized scrolling
    print("[6/7] Testing synchronized scrolling in Diff Modal...")
    page.evaluate("document.getElementById('tv_diff_cancel_btn').click()")
    page.wait_for_timeout(300)
    
    page.evaluate(f"""() => {{
        window.PineEditorIDE.loadScript("Momentum Ribbon Long v4", `{TEST_PINE_LONG_V4}`);
    }}""")
    page.wait_for_timeout(300)
    page.query_selector('.pine-version-bulb').click()
    page.wait_for_timeout(300)
    page.query_selector('#pine_quickfix_convert_btn').click()
    page.wait_for_timeout(500)
    
    # Scroll left pane and check right pane, then right pane and check left pane
    scroll_sync = page.evaluate("""async () => {
        const left = document.getElementById('tv_diff_left_pane');
        const right = document.getElementById('tv_diff_right_pane');
        
        // Scroll left pane
        left.scrollTop = 420;
        await new Promise(r => setTimeout(r, 120));
        const rightPos = right.scrollTop;
        
        // Scroll right pane
        right.scrollTop = 780;
        await new Promise(r => setTimeout(r, 120));
        const leftPos = left.scrollTop;
        
        return {
            leftTarget: 420,
            rightActual: rightPos,
            rightTarget: 780,
            leftActual: leftPos,
            synchronized: (rightPos === 420 && leftPos === 780)
        };
    }""")
    print(f"  -> Synchronized scroll test: {scroll_sync}")
    results["scroll_sync_verified"] = scroll_sync["synchronized"]
    
    # Screenshot 4: Scrolled Diff Modal
    ss4 = os.path.join(DEST_DIR, "verified_version_converter_diff_scrolled.png")
    page.screenshot(path=ss4)
    results["screenshots"].append(ss4)
    print(f"  -> Saved screenshot: {ss4}")
    
    # Step 5: Test Cancel vs Apply
    # First Cancel
    print("[7/7] Testing [Cancel] and [Apply] actions...")
    page.evaluate("document.getElementById('tv_diff_cancel_btn').click()")
    page.wait_for_timeout(300)
    code_after_cancel = page.evaluate("document.getElementById('pine_code_input').value")
    results["cancel_verified"] = ("//@version=4" in code_after_cancel)
    print(f"  -> Cancel verified: {results['cancel_verified']} (still v4)")
    
    # Now re-open and Apply
    page.query_selector('.pine-version-bulb').click()
    page.wait_for_timeout(300)
    page.query_selector('#pine_quickfix_convert_btn').click()
    page.wait_for_timeout(500)
    
    page.evaluate("document.getElementById('tv_diff_apply_btn').click()")
    page.wait_for_timeout(600)
    
    code_after_apply = page.evaluate("document.getElementById('pine_code_input').value")
    status_ver = page.evaluate("document.getElementById('pine_status_version')?.innerText")
    bulbs_after = page.evaluate("document.querySelectorAll('.pine-version-bulb').length")
    
    results["apply_verified"] = (
        "//@version=6" in code_after_apply and
        "indicator(" in code_after_apply and
        "ta.sma" in code_after_apply and
        "color.green" in code_after_apply and
        bulbs_after == 0 and
        "v6" in status_ver
    )
    print(f"  -> Apply verified: {results['apply_verified']}")
    print(f"  -> Status pill: '{status_ver}'")
    print(f"  -> Bulbs remaining in gutter: {bulbs_after}")
    
    # Screenshot 5: Converted v6 in Editor
    ss5 = os.path.join(DEST_DIR, "verified_version_converter_applied_v6.png")
    page.screenshot(path=ss5)
    results["screenshots"].append(ss5)
    print(f"  -> Saved screenshot: {ss5}")
    
    # Save verification JSON
    json_path = os.path.join(DEST_DIR, "version_converter_verification_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"  -> Saved verification results to: {json_path}")
    
    browser.close()

print("\n=== SUMMARY RESULTS ===")
for k, v in results.items():
    if k != "screenshots":
        print(f"{k}: {v}")
