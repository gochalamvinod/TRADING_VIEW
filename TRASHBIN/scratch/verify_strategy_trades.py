import asyncio
import os
from playwright.async_api import async_playwright

BASE_URL = "http://127.0.0.1:9000"
ARTIFACTS_DIR = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"

async def test_strategy():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1600, "height": 950})
        page = await context.new_page()

        print("Opening app...")
        await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45000)
        await asyncio.sleep(4)

        # Ensure Pine Editor dock is mounted
        await page.evaluate("() => window.PineEditorIDE && window.PineEditorIDE.open()")
        await asyncio.sleep(1)

        # Load SMA Crossover Strategy template
        print("Loading SMA Crossover Strategy...")
        await page.evaluate("""() => {
            const tpl = window.PineEditorIDE.getTemplates().find(t => t.id === 'sma_crossover_strategy');
            if (tpl) {
                window.PineEditorIDE.loadScript(tpl.name, tpl.code, tpl.id);
            }
        }""")
        await asyncio.sleep(1)

        # Open Strategy Tester
        await page.evaluate("() => window.PineEditorIDE.openStrategyTester()")
        await asyncio.sleep(1)

        # Run Backtest
        print("Running Backtest...")
        res = await page.evaluate("""async () => {
            return await window.PineEditorIDE.runStrategyBacktest();
        }""")
        await asyncio.sleep(2)
        print("Backtest result object returned:", bool(res))

        # Check metrics
        metrics = await page.evaluate("""() => {
            return {
                name: document.getElementById('strat_script_name')?.textContent,
                netProfit: document.getElementById('strat_net_profit')?.textContent,
                totalTrades: document.getElementById('strat_total_trades')?.textContent,
                winRate: document.getElementById('strat_win_rate')?.textContent,
                profitFactor: document.getElementById('strat_profit_factor')?.textContent,
                maxDD: document.getElementById('strat_max_dd')?.textContent,
                tradesBadge: document.getElementById('strat_trades_count_badge')?.textContent,
                tradeRowsCount: document.querySelectorAll('#strat_trades_tbody tr').length
            };
        }""")
        print("Strategy Tester UI Metrics:", metrics)

        # Capture screenshot of Overview
        screenshot_overview = os.path.join(ARTIFACTS_DIR, "strategy_tester_overview.png")
        await page.screenshot(path=screenshot_overview)
        print("Saved overview screenshot:", screenshot_overview)

        # Switch to List of Trades
        await page.evaluate("""() => {
            const btn = document.querySelector('.strat-sub-tab[data-tab="trades"]');
            btn?.click();
        }""")
        await asyncio.sleep(1)

        screenshot_trades = os.path.join(ARTIFACTS_DIR, "strategy_tester_trades.png")
        await page.screenshot(path=screenshot_trades)
        print("Saved trades list screenshot:", screenshot_trades)

        # Switch to Performance Summary
        await page.evaluate("""() => {
            const btn = document.querySelector('.strat-sub-tab[data-tab="performance"]');
            btn?.click();
        }""")
        await asyncio.sleep(1)

        screenshot_perf = os.path.join(ARTIFACTS_DIR, "strategy_tester_performance.png")
        await page.screenshot(path=screenshot_perf)
        print("Saved performance summary screenshot:", screenshot_perf)

        await browser.close()
        print("All strategy tester tabs verified!")

if __name__ == "__main__":
    asyncio.run(test_strategy())
