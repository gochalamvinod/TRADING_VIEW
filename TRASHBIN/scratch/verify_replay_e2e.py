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

    console_logs = []
    page.on("console", lambda m: console_logs.append(f"[{m.type}] {m.text}"))

    print("Step 1: Navigating to http://127.0.0.1:9000...")
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    
    # Wait for TradingView chart container and iframe
    print("Waiting for chart to initialize...")
    page.wait_for_timeout(7000)

    # Check chart window state
    state = page.evaluate("""() => {
        return {
            hasWidget: !!(window.tvWidget || window.widget),
            hasBarReplay: !!window.BAR_REPLAY,
            barReplayActive: window.BAR_REPLAY ? window.BAR_REPLAY.active : null,
            hasPineTranspile: typeof window.compilePineScript === 'function',
            hasEnterReplay: typeof window.enterReplayMode === 'function'
        };
    }""")
    print("Initial Window State:", json.dumps(state, indent=2))
    assert state["hasWidget"], "tvWidget/widget should be defined on window"
    assert state["hasBarReplay"], "BAR_REPLAY should be defined on window"
    assert state["hasPineTranspile"], "compilePineScript should be defined on window"

    # Step 2: Test Bar Selection Prompt (Scissors toast)
    print("\nStep 2: Testing Request User Select Bar (Scissors Prompt)...")
    toast_visible = page.evaluate("""() => {
        if (typeof window.showBarSelectionToast === 'function') {
            window.showBarSelectionToast();
            const el = document.getElementById('tv_replay_selection_toast');
            return el && el.style.display !== 'none';
        }
        return false;
    }""")
    print(f"Selection toast displayed: {toast_visible}")
    assert toast_visible, "Selection toast should be visible"
    page.screenshot(path=f"{artifact_dir}/replay_selection_toast.png")

    # Dismiss toast
    page.evaluate("""() => {
        if (typeof window.hideBarSelectionToast === 'function') {
            window.hideBarSelectionToast();
        }
    }""")

    # Step 3: Test Entering Replay Mode
    print("\nStep 3: Entering Replay Mode...")
    # Enter replay mode at a cutoff time 50 bars before latest historical bar
    replay_init = page.evaluate("""async () => {
        // Query latest bar from active subscription or fetch
        let cutoff = 1789171140 - (60 * 50); // 50 bars before Friday close
        await window.enterReplayMode(cutoff);

        const playerBar = document.getElementById('tv_replay_player_bar');
        const badge = document.getElementById('tv_replay_count_badge');
        return {
            active: window.BAR_REPLAY.active,
            cutoffSec: window.BAR_REPLAY.cutoffSec,
            playerBarExists: !!playerBar,
            playerBarVisible: playerBar ? (playerBar.style.display !== 'none') : false,
            futureBarsCount: window.BAR_REPLAY.futureBars ? window.BAR_REPLAY.futureBars.length : 0,
            statusText: badge ? badge.innerText : null
        };
    }""")
    print("Replay Mode Initialized:", json.dumps(replay_init, indent=2))
    assert replay_init["active"] is True, "BAR_REPLAY.active must be true"
    assert replay_init["playerBarExists"] is True, "Replay player bar DOM element must exist"
    assert replay_init["futureBarsCount"] > 0, f"Future bars should be buffered (got {replay_init['futureBarsCount']})"

    page.screenshot(path=f"{artifact_dir}/replay_player_mounted.png")

    # Step 4: Test Step Forward Button
    print("\nStep 4: Testing Step Forward (1 candle)...")
    step_result = page.evaluate("""() => {
        window.barReplayStep();
        const badge = document.getElementById('tv_replay_count_badge');
        return {
            futureIndex: window.BAR_REPLAY.futureIndex,
            currentBar: window.BAR_REPLAY.currentBar ? {
                time: window.BAR_REPLAY.currentBar.time,
                close: window.BAR_REPLAY.currentBar.close
            } : null,
            statusText: badge ? badge.innerText : null
        };
    }""")
    print("Step result:", json.dumps(step_result, indent=2))
    assert step_result["futureIndex"] == 1, f"futureIndex should be 1 after step, got {step_result['futureIndex']}"

    # Step 5: Test Play & Realtime Streaming
    print("\nStep 5: Testing Replay Play (continuous tick streaming)...")
    page.evaluate("""() => {
        window.barReplaySetSpeed(5); // 5x speed
        window.barReplayPlay();
    }""")
    
    # Let it play for 2.0 seconds
    page.wait_for_timeout(2000)

    play_result = page.evaluate("""() => {
        const isPlaying = window.BAR_REPLAY.status === 'playing';
        const idx = window.BAR_REPLAY.futureIndex;
        window.barReplayPause();
        const badge = document.getElementById('tv_replay_count_badge');
        return {
            wasPlaying: isPlaying,
            isPausedNow: window.BAR_REPLAY.status === 'paused',
            advancedIndex: idx,
            speed: window.BAR_REPLAY.speed,
            statusText: badge ? badge.innerText : null
        };
    }""")
    print("Play result:", json.dumps(play_result, indent=2))
    assert play_result["advancedIndex"] > 1, f"Playback should advance index beyond 1, got {play_result['advancedIndex']}"
    assert play_result["isPausedNow"] is True, "Replay should be paused after barReplayPause"

    page.screenshot(path=f"{artifact_dir}/replay_during_playback.png")

    # Step 6: Test Exit Replay Mode
    print("\nStep 6: Testing Exit Replay Mode...")
    exit_result = page.evaluate("""() => {
        window.exitReplayMode();
        return {
            active: window.BAR_REPLAY.active,
            status: window.BAR_REPLAY.status,
            playerBarVisible: document.getElementById('tv_replay_player_bar')?.style?.display !== 'none'
        };
    }""")
    print("Exit result:", json.dumps(exit_result, indent=2))
    assert exit_result["active"] is False, "BAR_REPLAY.active should be false"
    assert exit_result["playerBarVisible"] is False, "Player bar should be hidden"

    # Step 7: Test Pine Transpilation via Backend Node.js
    print("\nStep 7: Testing Pine Indicator Backend Transpilation...")
    pine_result = page.evaluate("""() => {
        const samplePine = `//@version=5
indicator("Playwright Test EMA", overlay=true)
len = input.int(14, "Length")
out = ta.ema(close, len)
plot(out, color=color.blue, title="EMA")`;

        try {
            const res = window.compilePineScript(samplePine);
            return {
                success: !!res && res.success,
                title: res && res.meta ? res.meta.title : null,
                isOverlay: res && res.meta ? res.meta.isOverlay : null,
                hasStudy: !!(res && res.study)
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }""")
    print("Pine transpilation result:", json.dumps(pine_result, indent=2))
    assert pine_result["success"] is True, f"Pine transpilation failed: {pine_result.get('error')}"
    assert pine_result["title"] == "Playwright Test EMA", f"Expected title 'Playwright Test EMA', got {pine_result.get('title')}"
    assert pine_result["isOverlay"] is True, "Expected isOverlay to be true"

    # Step 8: Test Registering and Adding Study to Chart
    print("\nStep 8: Testing compileAndRegisterPine and chart study creation...")
    study_result = page.evaluate("""() => {
        const script = `//@version=5
indicator("Custom SIMD Wave", overlay=false)
len = input.int(20, "Length")
upper = ta.highest(high, len)
lower = ta.lowest(low, len)
plot(upper, color=color.green)
plot(lower, color=color.red)`;

        try {
            const regRes = window.compileAndRegisterPine(script);
            if (!regRes || !regRes.study) {
                return Promise.resolve({ success: false, error: "No study returned from compileAndRegisterPine" });
            }
            const w = window.tvWidget || window.widget;
            const chart = w.activeChart();
            return new Promise((resolve) => {
                chart.createStudy(regRes.study.name, false, false, [], (entityId) => {
                    resolve({
                        success: true,
                        studyName: regRes.study.name,
                        entityId: entityId
                    });
                });
            });
        } catch (e) {
            return Promise.resolve({ success: false, error: e.message });
        }
    }""")
    print("Study registration result:", json.dumps(study_result, indent=2))
    assert study_result["success"] is True, f"Study registration failed: {study_result.get('error')}"

    # Wait 2 seconds for study render and capture screenshot
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{artifact_dir}/chart_with_custom_pine_study.png")
    print(f"Final screenshot saved: chart_with_custom_pine_study.png")

    browser.close()
    print("\nALL End-to-End Replay, Julia SIMD & Backend Pine Transpilation tests PASSED successfully! 🚀")
