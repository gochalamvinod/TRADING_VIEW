import asyncio
import os
import time
import httpx
from playwright.async_api import async_playwright

ARTIFACTS_DIR = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        page.on("console", lambda msg: print(f"[BROWSER CONSOLE] {msg.type}: {msg.text}"))

        print("1. Navigating to http://127.0.0.1:9000 ...")
        await page.goto("http://127.0.0.1:9000", wait_until="networkidle", timeout=45000)

        # Wait for TradingView chart iframe to mount
        print("2. Waiting for #tv_chart_container iframe...")
        iframe_el = await page.wait_for_selector("#tv_chart_container iframe", timeout=30000)
        assert iframe_el, "TradingView iframe not found"

        # Wait for widget and activeChart to be ready in window
        print("3. Waiting for widget.activeChart()...")
        await page.wait_for_function(
            "() => window.widget && typeof window.widget.activeChart === 'function' && window.widget.activeChart().symbol()",
            timeout=30000
        )

        sym = await page.evaluate("() => window.widget.activeChart().symbol()")
        res = await page.evaluate("() => window.widget.activeChart().resolution()")
        print(f"Chart loaded with Symbol: {sym}, Resolution: {res}")

        # Wait for candles to load in datafeed
        await page.wait_for_timeout(3000)

        # Query backend /history to get the exact real historical bar timestamps
        r = httpx.get(f"http://127.0.0.1:8080/history?symbol={sym}&resolution=1&countback=35")
        data = r.json()
        assert data.get("s") == "ok" and len(data.get("t", [])) >= 20, "Failed to get historical bars from MT5 backend"
        
        # Pick a cutoff bar 15 bars prior to the latest bar
        cutoff_sec = int(data["t"][-15])
        latest_sec = int(data["t"][-1])
        print(f"Latest bar timestamp: {latest_sec}, Cutoff bar timestamp: {cutoff_sec} (15 bars back)")

        # 4. Enter Replay Mode at 1 min resolution
        print("4. Entering Replay Mode at cutoff...")
        await page.evaluate(f"window.enterReplayMode({cutoff_sec})")
        await page.wait_for_timeout(3000)

        # Verify Replay Mode is active
        replay_state = await page.evaluate("""() => ({
            active: window.BAR_REPLAY.active,
            status: window.BAR_REPLAY.status,
            cutoffSec: window.BAR_REPLAY.cutoffSec,
            cutoffMs: window.BAR_REPLAY.cutoffMs,
            currentResolution: window.BAR_REPLAY.currentResolution,
            futureBarsCount: window.BAR_REPLAY.futureBars.length,
            futureIndex: window.BAR_REPLAY.futureIndex,
            toolbarVisible: document.getElementById('tv_replay_player_bar')?.style.display !== 'none',
            badgeText: document.getElementById('tv_replay_count_badge')?.textContent
        })""")
        print("Replay State (1m):", replay_state)
        assert replay_state["active"] is True, "Replay is not active"
        assert replay_state["toolbarVisible"] is True, "Replay toolbar is not visible"
        assert replay_state["cutoffSec"] == cutoff_sec, "CutoffSec mismatch"
        assert replay_state["futureBarsCount"] > 0, f"Expected future bars > 0, got {replay_state['futureBarsCount']}"

        # Screenshot 1: 1-minute cropped chart with player toolbar
        shot1 = os.path.join(ARTIFACTS_DIR, "replay_multires_1min_cropped.png")
        await page.screenshot(path=shot1)
        print(f"Screenshot 1 saved: {shot1}")

        # 5. Step forward 2 bars on 1m
        print("5. Stepping 2 bars forward on 1m...")
        await page.evaluate("window.barReplayStep()")
        await page.wait_for_timeout(400)
        await page.evaluate("window.barReplayStep()")
        await page.wait_for_timeout(400)

        step_state_1m = await page.evaluate("() => ({ futureIndex: window.BAR_REPLAY.futureIndex, cutoffSec: window.BAR_REPLAY.cutoffSec })")
        print("Stepped state 1m:", step_state_1m)
        assert step_state_1m["futureIndex"] == 2, "Expected futureIndex == 2"

        # 6. Switch timeframe to 15 seconds (15S)
        print("6. Switching resolution to 15S...")
        await page.evaluate("window.widget.activeChart().setResolution('15S')")
        await page.wait_for_timeout(4500)

        # Verify Replay remains active, cutoff is preserved, and 15S future bars are buffered
        replay_state_15s = await page.evaluate("""() => ({
            active: window.BAR_REPLAY.active,
            cutoffSec: window.BAR_REPLAY.cutoffSec,
            currentResolution: window.BAR_REPLAY.currentResolution,
            futureBarsCount: window.BAR_REPLAY.futureBars.length,
            futureIndex: window.BAR_REPLAY.futureIndex,
            badgeText: document.getElementById('tv_replay_count_badge')?.textContent
        })""")
        print("Replay State (15S):", replay_state_15s)
        assert replay_state_15s["active"] is True, "Replay exited when switching to 15S!"
        assert replay_state_15s["currentResolution"] == "15S", "Current resolution should be 15S"
        assert replay_state_15s["futureBarsCount"] > 0, "No 15S future bars buffered!"
        assert "15S" in replay_state_15s["badgeText"], f"Badge text should mention 15S: {replay_state_15s['badgeText']}"

        # 7. Step forward 3 bars on 15S
        print("7. Stepping 3 bars forward on 15S...")
        for _ in range(3):
            await page.evaluate("window.barReplayStep()")
            await page.wait_for_timeout(250)

        # 8. Test animated Playback on 15S
        print("8. Testing Play/Pause playback on 15S...")
        await page.evaluate("window.barReplayPlay()")
        await page.wait_for_timeout(1500)
        await page.evaluate("window.barReplayPause()")

        play_state_15s = await page.evaluate("() => ({ futureIndex: window.BAR_REPLAY.futureIndex, cutoffSec: window.BAR_REPLAY.cutoffSec })")
        print("Playback advanced state 15S:", play_state_15s)
        assert play_state_15s["futureIndex"] > 3, "Expected playback to advance bars on 15S"

        # Screenshot 2: 15-second stepped chart with player toolbar
        shot2 = os.path.join(ARTIFACTS_DIR, "replay_multires_15s_stepped.png")
        await page.screenshot(path=shot2)
        print(f"Screenshot 2 saved: {shot2}")

        # 9. Switch timeframe to 10 ticks (10T)
        print("9. Switching resolution to 10T...")
        await page.evaluate("window.widget.activeChart().setResolution('10T')")
        await page.wait_for_timeout(4500)

        replay_state_10t = await page.evaluate("""() => ({
            active: window.BAR_REPLAY.active,
            cutoffSec: window.BAR_REPLAY.cutoffSec,
            currentResolution: window.BAR_REPLAY.currentResolution,
            futureBarsCount: window.BAR_REPLAY.futureBars.length,
            futureIndex: window.BAR_REPLAY.futureIndex,
            badgeText: document.getElementById('tv_replay_count_badge')?.textContent
        })""")
        print("Replay State (10T):", replay_state_10t)
        assert replay_state_10t["active"] is True, "Replay exited when switching to 10T!"
        assert replay_state_10t["currentResolution"] == "10T", "Current resolution should be 10T"
        assert replay_state_10t["futureBarsCount"] > 0, "No 10T future bars buffered!"
        assert "10T" in replay_state_10t["badgeText"], f"Badge text should mention 10T: {replay_state_10t['badgeText']}"

        # 10. Step forward 2 bars on 10T
        print("10. Stepping 2 bars forward on 10T...")
        await page.evaluate("window.barReplayStep()")
        await page.wait_for_timeout(300)
        await page.evaluate("window.barReplayStep()")
        await page.wait_for_timeout(300)

        step_state_10t = await page.evaluate("() => ({ futureIndex: window.BAR_REPLAY.futureIndex, cutoffSec: window.BAR_REPLAY.cutoffSec })")
        print("Stepped state 10T:", step_state_10t)
        assert step_state_10t["futureIndex"] == 2, "Expected futureIndex == 2 on 10T"

        # Screenshot 3: 10-tick verified chart with player toolbar
        shot3 = os.path.join(ARTIFACTS_DIR, "replay_multires_10t_verified.png")
        await page.screenshot(path=shot3)
        print(f"Screenshot 3 saved: {shot3}")

        # 11. Exit Replay Mode
        print("11. Exiting Replay Mode...")
        await page.evaluate("window.exitReplayMode()")
        await page.wait_for_timeout(1500)

        exit_state = await page.evaluate("""() => ({
            active: window.BAR_REPLAY.active,
            status: window.BAR_REPLAY.status,
            toolbarDisplay: document.getElementById('tv_replay_player_bar')?.style.display
        })""")
        print("Exit Replay State:", exit_state)
        assert exit_state["active"] is False, "Replay should be inactive"
        assert exit_state["toolbarDisplay"] == "none", "Toolbar should be hidden"

        print("=== MULTI-RESOLUTION BAR REPLAY VERIFICATION COMPLETE (100% SUCCESS) ===")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
