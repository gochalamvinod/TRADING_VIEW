import asyncio
from playwright.async_api import async_playwright
import json

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda exc: console_logs.append(f"[PAGE_ERROR] {exc}"))

        print("Navigating to http://localhost:9000/ ...")
        await page.goto("http://localhost:9000/", timeout=30000, wait_until="networkidle")
        await asyncio.sleep(3)

        with open(r"e:\TRADINGVIEW ADVANCED\scratch_luxalgo.pine", "r", encoding="utf-8") as f:
            script_code = f.read()

        result = await page.evaluate("""async (code) => {
            try {
                if (!window.PineIndicators) {
                    return { success: false, error: "window.PineIndicators is undefined" };
                }
                const compiled = window.PineIndicators.compileAndRegisterPine(code);
                const studyName = compiled.meta.title;
                const isOverlay = compiled.meta.isOverlay;

                const iframe = document.querySelector('#tv_chart_container iframe');
                const innerWin = iframe ? iframe.contentWindow : null;
                if (innerWin && innerWin.JSServer && Array.isArray(innerWin.JSServer.studyLibrary)) {
                    innerWin.JSServer.studyLibrary.push(compiled.study);
                }

                const chart = window.widget ? window.widget.activeChart() : null;
                if (!chart) {
                    return { success: false, error: "window.widget.activeChart() returned null" };
                }

                const repo = typeof chart.studyMetaIntoRepository === 'function' ? chart.studyMetaIntoRepository() : chart.studyMetaIntoRepository;
                if (repo) {
                    if (typeof repo._processLibraryMetaInfo === 'function') {
                        repo._processLibraryMetaInfo([compiled.study.metainfo]);
                    }
                    if (Array.isArray(repo._rawStudiesMetaInfo)) {
                        repo._rawStudiesMetaInfo.push(compiled.study.metainfo);
                    }
                    if (Array.isArray(repo._javaStudiesMetaInfo)) {
                        repo._javaStudiesMetaInfo.push(compiled.study.metainfo);
                    }
                }

                console.log("[TEST] Calling createStudy for:", studyName);
                const studyId = await chart.createStudy(studyName, isOverlay, false);
                console.log("[TEST] Study created with ID:", studyId);

                return {
                    success: true,
                    studyId: studyId,
                    plots: compiled.meta.plots.map(p => p.id),
                    shapes: (compiled.meta.shapes || []).map(s => s.id),
                    inputsCount: compiled.meta.inputs.length
                };
            } catch (err) {
                return { success: false, error: err.message || String(err), stack: err.stack };
            }
        }""", script_code)

        print("Result:", json.dumps(result, indent=2))
        await asyncio.sleep(4)

        print("\n--- Console Logs (relevant) ---")
        for log in console_logs:
            if any(k in log.lower() for k in ["error", "warn", "luxalgo", "study", "pine", "test", "fail", "violation"]):
                print(log)

        await page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\scratch_luxalgo_chart.png")
        print("\nScreenshot saved.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
