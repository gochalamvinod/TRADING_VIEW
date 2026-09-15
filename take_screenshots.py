"""
take_screenshots.py — Automated UI and Endpoint Verification with Screenshots
"""

import time
import os
import sys
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\gocha\.gemini\antigravity\brain\b2ac4af1-293b-4e36-9d76-3b7d3d6947b5"
os.makedirs(ARTIFACT_DIR, exist_ok=True)

chart_shot_path = os.path.join(ARTIFACT_DIR, "chart_ui.png")
device_shot_path = os.path.join(ARTIFACT_DIR, "device_profile.png")

def main():
    print("[TEST] Launching Playwright Chromium...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1600, "height": 900})
        page = context.new_page()

        # 1. Capture Chart UI via Proxy Port 9999
        print("[TEST] Navigating to TradingView Chart via PROXY at http://localhost:9999/ ...")
        page.goto("http://localhost:9999/", wait_until="domcontentloaded", timeout=20000)
        # Give chart library 5 seconds to fully render canvas, candlesticks, and indicators
        time.sleep(5)
        page.screenshot(path=chart_shot_path)
        proxy_chart_shot = os.path.join(ARTIFACT_DIR, "chart_ui_proxy_9999.png")
        page.screenshot(path=proxy_chart_shot)
        print(f"[TEST] Saved Chart UI screenshot (proxy :9999) to: {chart_shot_path} and {proxy_chart_shot}")

        # 2. Capture /device endpoint via Proxy Port 9999
        print("[TEST] Navigating to http://localhost:9999/device ...")
        page.goto("http://localhost:9999/device", wait_until="domcontentloaded", timeout=10000)
        time.sleep(1)
        page.screenshot(path=device_shot_path)
        proxy_device_shot = os.path.join(ARTIFACT_DIR, "device_profile_proxy_9999.png")
        page.screenshot(path=proxy_device_shot)
        print(f"[TEST] Saved Device Profile screenshot (proxy :9999) to: {device_shot_path} and {proxy_device_shot}")

        # 3. Capture /history active bar response via Proxy Port 9999
        active_shot_path = os.path.join(ARTIFACT_DIR, "history_active_bar_proxy_9999.png")
        print("[TEST] Navigating to http://localhost:9999/history?symbol=EURUSD.&resolution=1S&countback=2 ...")
        page.goto("http://localhost:9999/history?symbol=EURUSD.&resolution=1S&countback=2", wait_until="domcontentloaded", timeout=10000)
        time.sleep(1)
        page.screenshot(path=active_shot_path)
        print(f"[TEST] Saved History Active Bar screenshot (proxy :9999) to: {active_shot_path}")

        browser.close()

    print("[TEST] All screenshots successfully captured via Proxy Port 9999!")

if __name__ == "__main__":
    main()
