import asyncio
import os
from playwright.async_api import async_playwright

BASE_URL = "http://127.0.0.1:9000"
ARTIFACTS_DIR = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"

async def test_all_gestures():
    async with async_playwright() as p:
        # Launch with touch support enabled
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 850}, has_touch=True)
        page = await context.new_page()

        print("1. Navigating to TradingView Advanced...")
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await asyncio.sleep(4)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        assert iframe_el, "Chart iframe must exist"
        frame = await iframe_el.content_frame()
        assert frame, "Content frame must exist"

        print("2. Verifying gesture engine attached...")
        attached = await frame.evaluate("() => Boolean(document._twoFingerSettingsAttached)")
        print(f"Gesture engine attached in iframe: {attached}")

        # -------------------------------------------------------------
        # TEST 1: Touchscreen Two-Finger Tap
        # -------------------------------------------------------------
        print("\n3. Testing Touchscreen Two-Finger Tap...")
        touch_tap_result = await frame.evaluate("""() => {
            const canvas = document.querySelector("canvas[data-name='pane-top-canvas']") || document.querySelector("canvas");
            if (!canvas) return { error: "canvas not found" };

            const rect = canvas.getBoundingClientRect();
            const x1 = rect.left + 250, y1 = rect.top + 200;
            const x2 = rect.left + 280, y2 = rect.top + 205;

            const t1 = new Touch({ identifier: 1, target: canvas, clientX: x1, clientY: y1, pageX: x1, pageY: y1 });
            const t2 = new Touch({ identifier: 2, target: canvas, clientX: x2, clientY: y2, pageX: x2, pageY: y2 });

            // touchstart with 2 fingers
            canvas.dispatchEvent(new TouchEvent("touchstart", {
                touches: [t1, t2],
                targetTouches: [t1, t2],
                changedTouches: [t1, t2],
                bubbles: true,
                cancelable: true
            }));

            // short tap: touchend 100ms later
            return new Promise(resolve => {
                setTimeout(() => {
                    canvas.dispatchEvent(new TouchEvent("touchend", {
                        touches: [],
                        targetTouches: [],
                        changedTouches: [t1, t2],
                        bubbles: true,
                        cancelable: true
                    }));
                    resolve({ dispatched: true });
                }, 100);
            });
        }""")
        print("Touch tap dispatched:", touch_tap_result)
        await asyncio.sleep(1)

        # Check if settings dialog opened
        touch_dialog = await frame.evaluate("""() => {
            const dialog = document.querySelector('[data-name="property-dialog"], [class*="dialog-"]');
            if (!dialog) return { found: false };
            const title = dialog.querySelector('[class*="title-"]')?.textContent;
            const text = dialog.textContent;
            return {
                found: true,
                title: title,
                hasSymbol: text.includes("Symbol"),
                hasStatusLine: text.includes("Status line"),
                hasScales: text.includes("Scales"),
                hasCanvas: text.includes("Canvas"),
                hasTrading: text.includes("Trading")
            };
        }""")
        print("Settings dialog after Two-Finger Tap:", touch_dialog)
        assert touch_dialog["found"], "Settings dialog MUST open on touchscreen two-finger tap!"

        # Take screenshot of open settings dialog
        ss_path = os.path.join(ARTIFACTS_DIR, "two_finger_settings_verified.png")
        await page.screenshot(path=ss_path)
        print("Screenshot saved to:", ss_path)

        # Close the dialog via close button or Escape
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.5)

        # Verify closed
        closed = await frame.evaluate("() => !document.querySelector('[class*=\"dialog-\"]')")
        print("Dialog closed after Escape:", closed)

        # -------------------------------------------------------------
        # TEST 2: Trackpad Two-Finger Tap / Secondary Click (Right-Click)
        # -------------------------------------------------------------
        print("\n4. Testing Trackpad Two-Finger Tap (Secondary Click / contextmenu)...")
        await frame.locator("canvas[data-name='pane-top-canvas']").click(button="right", position={"x": 300, "y": 250})
        await asyncio.sleep(1)

        rc_dialog = await frame.evaluate("""() => {
            const dialog = document.querySelector('[data-name="property-dialog"], [class*="dialog-"]');
            if (!dialog) return { found: false };
            return {
                found: true,
                title: dialog.querySelector('[class*="title-"]')?.textContent,
                textSnippet: dialog.textContent.slice(0, 100)
            };
        }""")
        print("Settings dialog after Trackpad Right Click / Two-Finger Tap:", rc_dialog)
        assert rc_dialog["found"], "Settings dialog MUST open on trackpad two-finger tap / right click!"

        # Close again
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.5)

        # -------------------------------------------------------------
        # TEST 3: Canvas Double-Click
        # -------------------------------------------------------------
        print("\n5. Testing Canvas Double Click...")
        await frame.locator("canvas[data-name='pane-top-canvas']").dblclick(position={"x": 350, "y": 250})
        await asyncio.sleep(1)

        dbl_dialog = await frame.evaluate("""() => {
            const dialog = document.querySelector('[data-name="property-dialog"], [class*="dialog-"]');
            if (!dialog) return { found: false };
            return {
                found: true,
                title: dialog.querySelector('[class*="title-"]')?.textContent
            };
        }""")
        print("Settings dialog after Double Click:", dbl_dialog)
        assert dbl_dialog["found"], "Settings dialog MUST open on canvas double-click!"

        print("\nALL GESTURE TESTS PASSED PERFECTLY!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_all_gestures())
