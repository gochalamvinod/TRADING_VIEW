import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)

    # Check chart ready
    chart_ready = False
    for i in range(25):
        val = page.evaluate("() => !!(window.widget && window.widget.activeChart && window.widget.activeChart())")
        if val:
            chart_ready = True
            print(f"Chart ready after {i+1}s")
            break
        page.wait_for_timeout(1000)

    # Probe all target elements
    probe_results = page.evaluate("""() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;

        // Top toolbar
        const topSymbolBtn = doc?.querySelector('.layout__area--top button[aria-label="Symbol Search"]');
        const topIntervalBtns = Array.from(doc?.querySelectorAll('.layout__area--top button') || []).map(b => b.textContent?.trim()).filter(Boolean);
        const topFxBtn = doc?.querySelector('.layout__area--top button[aria-label*="Indicator"], [data-name="open-indicators-dialog"]');

        // Chart legend
        const legendTitle = doc?.querySelector('[data-name="legend-source-title"], .title-l31H9iuA, [class*="mainTitle"]');
        const eyeBtn = doc?.querySelector('[data-name="legend-show-hide-action"]');
        const gearBtn = doc?.querySelector('[data-name="legend-settings-action"]');
        const moreBtn = doc?.querySelector('[data-name="legend-more-action"]');
        const codeBtn = doc?.querySelector('[data-name="legend-source-code-action"], .tv-legend-code-btn');

        // Bottom dock tabs
        const peTab = doc?.querySelector('#tv_footer_pine_editor_tab button, [data-name="scripteditor"]');
        const stTab = doc?.querySelector('#tv_footer_strategy_tester_tab button, [data-name="strategy_tester_tab"]');
        const amTab = doc?.querySelector('button[data-name="paper_trading"], button[aria-label*="account manager"]');

        // Pine Editor elements
        const peDock = document.getElementById('pine_editor_dock');
        const peMoreBtn = document.getElementById('pine_more_btn');
        const peMoreMenu = document.getElementById('pine_more_menu');
        const peMenuItems = Array.from(peMoreMenu?.querySelectorAll('.pine-menu-item-v2') || []).map(i => ({ id: i.id, text: i.textContent?.trim() }));
        const peAddBtn = document.getElementById('pine_add_to_chart_btn');
        const pePublishBtn = document.getElementById('pine_publish_btn');
        const peConsoleToggle = document.getElementById('pine_console_toggle_btn');

        // Themes
        const theme = localStorage.getItem('tv_chart_theme');
        const rootTheme = document.documentElement.getAttribute('data-theme');
        const appTheme = document.getElementById('app_root')?.getAttribute('data-theme');

        return {
            topSymbolBtn: !!topSymbolBtn,
            topIntervalBtnsSample: topIntervalBtns.slice(0, 8),
            topFxBtn: !!topFxBtn,
            legendTitle: !!legendTitle,
            legendTitleText: legendTitle?.textContent?.trim(),
            eyeBtn: !!eyeBtn,
            gearBtn: !!gearBtn,
            moreBtn: !!moreBtn,
            codeBtn: !!codeBtn,
            peTab: !!peTab,
            stTab: !!stTab,
            amTab: !!amTab,
            peDock: !!peDock,
            peMoreBtn: !!peMoreBtn,
            peMenuItemsCount: peMenuItems.length,
            peMenuItems,
            peAddBtn: !!peAddBtn,
            pePublishBtn: !!pePublishBtn,
            peConsoleToggle: !!peConsoleToggle,
            theme,
            rootTheme,
            appTheme
        };
    }""")
    print("Probe results:\n", json.dumps(probe_results, indent=2))
    browser.close()
