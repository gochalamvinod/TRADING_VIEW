import sys
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

    # Add a study via PineEditorIDE
    add_study_res = page.evaluate("""async () => {
        try {
            if (window.PineEditorIDE && typeof window.PineEditorIDE.addStudyToChart === 'function') {
                const sId = await window.PineEditorIDE.addStudyToChart();
                await new Promise(r => setTimeout(r, 2000));
                const chart = window.widget?.activeChart?.();
                const studies = chart ? chart.getAllStudies() : [];
                return { sId, studies };
            }
            return { error: 'PineEditorIDE.addStudyToChart not found' };
        } catch (e) {
            return { error: e.message, stack: e.stack };
        }
    }""")
    print("Add study result:\n", json.dumps(add_study_res, indent=2))

    # 1. Test clicking gear icon on indicator
    gear_res = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const win = iframe?.contentWindow;
        
        // Find study item
        const studyItems = Array.from(doc?.querySelectorAll('[data-name="legend-study-item"], [data-name="legend-source-item"], [class*="item-"]') || []);
        const targetStudy = studyItems.find(it => {
            if (it.getAttribute('data-name') === 'legend-series-item' || it.classList.contains('series-l31H9iuA')) return false;
            const gear = it.querySelector('[data-name="legend-settings-action"]');
            return !!gear;
        });

        if (!targetStudy) {
            return {
                error: 'No study item with gear found',
                itemsFound: studyItems.map(it => ({
                    name: it.getAttribute('data-name'),
                    classes: it.className,
                    title: it.querySelector('[data-name="legend-source-title"], .title-l31H9iuA, [class*="title-"]')?.textContent?.trim()
                }))
            };
        }

        const gearBtn = targetStudy.querySelector('[data-name="legend-settings-action"]');
        const titleEl = targetStudy.querySelector('[data-name="legend-source-title"], .title-l31H9iuA, [class*="title-"]');
        const titleText = titleEl ? titleEl.textContent.trim() : '';

        // Click gear button: mousedown then click
        gearBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, view: win }));
        gearBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, view: win }));

        await new Promise(r => setTimeout(r, 800));

        // Check if modal exists in doc or document
        const modalOuter = document.querySelector('#tv_settings_modal_overlay, .pine-indicator-settings-dialog, .tv-settings-dialog');
        const modalInner = doc?.querySelector('#tv_settings_modal_overlay, .pine-indicator-settings-dialog, .tv-settings-dialog');
        const modal = modalOuter || modalInner;

        return {
            studyTitle: titleText,
            modalFound: !!modal,
            modalInOuterDoc: !!modalOuter,
            modalInInnerDoc: !!modalInner,
            modalId: modal?.id,
            modalClasses: modal?.className,
            modalVisible: modal ? (modal.offsetWidth > 0 && modal.offsetHeight > 0) : false
        };
    }""")
    print("Gear click test:\n", json.dumps(gear_res, indent=2))

    # Take screenshot if modal open
    screenshot_dir = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"
    page.screenshot(path=f"{screenshot_dir}\\indicator_settings_modal.png")

    # Close modal
    page.evaluate("""() => {
        const closeBtn = document.querySelector('#tv_settings_close_btn') ||
                         document.querySelector('#tv_settings_modal_overlay [title="Close"]') ||
                         document.querySelector('.tv-settings-dialog [title="Close"]');
        if (closeBtn) closeBtn.click();
        else {
            const modal = document.querySelector('#tv_settings_modal_overlay, .pine-indicator-settings-dialog, .tv-settings-dialog');
            if (modal) modal.remove();
        }
    }""")
    page.wait_for_timeout(500)

    # 2. Test clicking 3-dots on study item
    study_more_res = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const win = iframe?.contentWindow;

        const studyItems = Array.from(doc?.querySelectorAll('[data-name="legend-study-item"], [data-name="legend-source-item"], [class*="item-"]') || []);
        const targetStudy = studyItems.find(it => {
            if (it.getAttribute('data-name') === 'legend-series-item' || it.classList.contains('series-l31H9iuA')) return false;
            const more = it.querySelector('[data-name="legend-more-action"]');
            return !!more;
        });

        if (!targetStudy) return { error: 'No study item with more found' };

        const moreBtn = targetStudy.querySelector('[data-name="legend-more-action"]');
        
        moreBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, view: win }));
        moreBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, view: win }));

        await new Promise(r => setTimeout(r, 600));

        const menus = Array.from(doc.querySelectorAll('.menuWrap-Kq3ruQo8, [class*="menuWrap"], [data-name="menu-inner"]'));
        const activeMenu = menus.find(m => !m.classList.contains('isMeasuring-Kq3ruQo8') && m.offsetHeight > 0);

        let menuDetails = null;
        if (activeMenu) {
            const rect = activeMenu.getBoundingClientRect();
            const items = Array.from(activeMenu.querySelectorAll('[data-role="menuitem"], [class*="item-"], tr, div[role="menuitem"]')).map(el => el.textContent.trim()).filter(Boolean);
            menuDetails = {
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                itemsCount: items.length,
                items: items.slice(0, 10),
                scrollWidth: activeMenu.scrollWidth,
                clientWidth: activeMenu.clientWidth,
                scrollHeight: activeMenu.scrollHeight,
                clientHeight: activeMenu.clientHeight,
                overflow: window.getComputedStyle(activeMenu).overflow,
                overflowX: window.getComputedStyle(activeMenu).overflowX,
                overflowY: window.getComputedStyle(activeMenu).overflowY
            };
        }

        return {
            menusFound: menus.length,
            activeMenu: menuDetails
        };
    }""")
    print("Study 3-dots test:\n", json.dumps(study_more_res, indent=2))

    page.screenshot(path=f"{screenshot_dir}\\study_context_menu.png")

    # Close context menu if open by clicking body
    page.evaluate("""() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        iframe?.contentDocument?.body?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }""")
    page.wait_for_timeout(500)

    # 3. Test clicking 3-dots on series item
    series_more_res = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const win = iframe?.contentWindow;

        const seriesItem = doc?.querySelector('[data-name="legend-series-item"], [class*="series-"]');
        if (!seriesItem) return { error: 'No series item found' };

        const moreBtn = seriesItem.querySelector('[data-name="legend-more-action"]');
        if (!moreBtn) return { error: 'No more button on series item' };

        moreBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, view: win }));
        moreBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, view: win }));

        await new Promise(r => setTimeout(r, 600));

        const menus = Array.from(doc.querySelectorAll('.menuWrap-Kq3ruQo8, [class*="menuWrap"], [data-name="menu-inner"]'));
        const activeMenu = menus.find(m => !m.classList.contains('isMeasuring-Kq3ruQo8') && m.offsetHeight > 0);

        let menuDetails = null;
        if (activeMenu) {
            const rect = activeMenu.getBoundingClientRect();
            const items = Array.from(activeMenu.querySelectorAll('[data-role="menuitem"], [class*="item-"], tr, div[role="menuitem"]')).map(el => el.textContent.trim()).filter(Boolean);
            menuDetails = {
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                itemsCount: items.length,
                items: items.slice(0, 10),
                scrollWidth: activeMenu.scrollWidth,
                clientWidth: activeMenu.clientWidth,
                scrollHeight: activeMenu.scrollHeight,
                clientHeight: activeMenu.clientHeight,
                overflow: window.getComputedStyle(activeMenu).overflow,
                overflowX: window.getComputedStyle(activeMenu).overflowX,
                overflowY: window.getComputedStyle(activeMenu).overflowY
            };
        }

        return {
            menusFound: menus.length,
            activeMenu: menuDetails
        };
    }""")
    print("Series 3-dots test:\n", json.dumps(series_more_res, indent=2))

    page.screenshot(path=f"{screenshot_dir}\\series_context_menu.png")

    browser.close()
