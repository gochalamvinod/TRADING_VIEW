import os
import sys
import time
from playwright.sync_api import sync_playwright

ARTIFACTS_DIR = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    print("[Test] Opening chart at http://127.0.0.1:9000 ...")
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_selector("#tv_chart_container iframe", timeout=30000)
    page.wait_for_function("() => window.widget && window.widget.activeChart && typeof window.widget.activeChart === 'function'", timeout=30000)
    time.sleep(3)

    # 1. Add Inverse OHLC and Sessions [LuxAlgo] to chart
    print("[Test] Adding Inverse OHLC and Sessions [LuxAlgo]...")
    with open(r"E:\TRADINGVIEW ADVANCED\scratch_luxalgo.pine", "r", encoding="utf-8") as f:
        luxalgo_code = f.read()

    init_res = page.evaluate("""async (code) => {
        const chart = window.widget.activeChart();

        // 1. Add Inverse OHLC
        await window.PineIndicators.addStudyToChart(window.widget, "Inverse OHLC", false);

        // 2. Add Sessions [LuxAlgo]
        const reg = window.PineIndicators.compileAndRegisterPine(code);
        const title = reg.meta.title;
        const studyId = await window.PineIndicators.addStudyToChart(window.widget, title, true);
        if (window.PineIndicators && typeof window.PineIndicators.renderSessionVisuals === 'function') {
            await window.PineIndicators.renderSessionVisuals(chart, code, studyId);
        }

        return { title, studyId };
    }""", luxalgo_code)
    print("[Test] Initialized studies:", init_res)
    time.sleep(2)

    # Capture initial screenshot with both studies active
    page.screenshot(path=os.path.join(ARTIFACTS_DIR, "step1_both_active_before_delete.png"))
    print("[Test] Saved step1_both_active_before_delete.png")

    # 2. Inspect legend items inside the chart iframe
    iframe_element = page.wait_for_selector("#tv_chart_container iframe")
    frame = iframe_element.content_frame()

    legend_info = page.evaluate("""() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe ? iframe.contentDocument : document;
        const items = Array.from(doc.querySelectorAll('[data-name="legend-source-item"], .item-b6scapli, [class*="legendSourceItem"]'));
        return items.map((el, i) => {
            const titleEl = el.querySelector('[data-name="legend-source-title"], [class*="title-"]');
            const title = titleEl ? titleEl.innerText : el.innerText;
            const buttons = Array.from(el.querySelectorAll('button, [role="button"], [data-name]')).map(b => ({
                dataName: b.getAttribute('data-name'),
                ariaLabel: b.getAttribute('aria-label'),
                className: b.className
            }));
            return { index: i, text: el.innerText, title, buttons };
        });
    }""")
    print("[Test] Legend items found in iframe:", legend_info)

    # 3. Hover over Sessions legend item and click the delete button
    print("[Test] Hovering over Sessions legend item and clicking delete button...")
    click_res = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe ? iframe.contentDocument : document;
        const items = Array.from(doc.querySelectorAll('[data-name="legend-source-item"], .item-b6scapli, [class*="legendSourceItem"]'));
        const sessionItem = items.find(el => el.innerText.toLowerCase().includes('session') || el.innerText.toLowerCase().includes('luxalgo'));
        if (!sessionItem) return { error: 'Sessions legend item not found' };

        // Dispatch mouseover/mouseenter to reveal action buttons
        sessionItem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        sessionItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 400));

        // Find delete button
        const delBtn = sessionItem.querySelector('[data-name="legend-delete-action"], [data-name="delete-button"], [data-name="remove"], [aria-label*="Delete" i], [aria-label*="Remove" i], [title*="Delete" i], [title*="Remove" i]');
        if (!delBtn) {
            // Check all buttons inside the item
            const allBtns = Array.from(sessionItem.querySelectorAll('button, [role="button"], [class*="button"]'));
            return { error: 'Delete button not found by selector', allBtns: allBtns.map(b => ({ dn: b.getAttribute('data-name'), al: b.getAttribute('aria-label'), cl: b.className })) };
        }

        // Click delete button
        const rect = delBtn.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: 1 };
        delBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
        delBtn.dispatchEvent(new MouseEvent('mousedown', opts));
        delBtn.dispatchEvent(new PointerEvent('pointerup', opts));
        delBtn.dispatchEvent(new MouseEvent('mouseup', opts));
        delBtn.dispatchEvent(new MouseEvent('click', opts));

        return { clicked: true, delBtnDataName: delBtn.getAttribute('data-name') };
    }""")
    print("[Test] Delete click result:", click_res)

    # Wait for deletion and shape cleanup
    time.sleep(2)

    # 4. Check shapes remaining on chart
    shapes_after_delete = page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const allShapes = chart.getAllShapes ? chart.getAllShapes() : [];
        const sessionKeywords = ['sydney', 'tokyo', 'london', 'new york', 'thursday', 'wednesday', 'tuesday', 'monday', 'friday', 'session'];
        const sessionShapes = [];
        for (const s of allShapes) {
            const shapeApi = chart.getShapeById ? chart.getShapeById(s.id) : null;
            const props = shapeApi && shapeApi.getProperties ? shapeApi.getProperties() : null;
            const text = (props && props.text ? String(props.text) : (s.text || '')).toLowerCase();
            if (sessionKeywords.some(k => text.includes(k))) {
                sessionShapes.push({ id: s.id, text, name: s.name });
            }
        }

        const allStudies = chart.getAllStudies ? chart.getAllStudies() : [];

        return {
            totalShapes: allShapes.length,
            sessionShapeCount: sessionShapes.length,
            sessionShapes,
            remainingStudies: allStudies.map(s => ({ id: s.id, name: s.name }))
        };
    }""")
    print("[Test] State after delete:", shapes_after_delete)

    # 5. Capture post-delete screenshot
    page.screenshot(path=os.path.join(ARTIFACTS_DIR, "step2_after_legend_delete.png"))
    print("[Test] Saved step2_after_legend_delete.png")

    browser.close()
