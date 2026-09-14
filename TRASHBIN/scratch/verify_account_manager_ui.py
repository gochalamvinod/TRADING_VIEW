import sys
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

artifact_dir = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    print("Navigating to http://127.0.0.1:9000...")
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(7000)

    # Open bottom dock Account Manager if not already visible
    print("Inspecting broker state...")
    broker_state = page.evaluate("""() => {
        const b = window._mt5Broker;
        if (!b) return { hasBroker: false };
        return {
            hasBroker: true,
            accountData: b._accountData,
            positionsCount: Object.keys(b._positionById || {}).length,
            positions: Object.values(b._positionById || {}).map(p => ({
                ticket: p.ticket,
                symbol: p.symbol,
                qty: p.qty,
                profit: p.profit,
                contract_size: p.contract_size,
                tick_value: p.tick_value
            }))
        };
    }""")
    print("Broker State in Browser:", json.dumps(broker_state, indent=2))

    # Take screenshot of TradingView window showing Account Manager
    page.screenshot(path=f"{artifact_dir}/account_manager_pl_fixed.png")
    print("Screenshot saved: account_manager_pl_fixed.png")

    browser.close()
    print("Verification completed successfully!")
