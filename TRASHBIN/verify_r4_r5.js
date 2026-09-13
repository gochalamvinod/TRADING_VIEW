/**
 * verify_r4_r5.js
 * Comprehensive automated verification test for R4 (Legend Polish & Defect Fixes)
 * and R5 (100% Authentic TradingView GUI for Pine Editor).
 */
const { spawn } = require('child_process');
const fs = require('fs');

async function runVerification() {
  console.log("=== STARTING R4 & R5 AUTOMATED VERIFICATION SUITE ===");
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-r4r5-test-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const putResp = await fetch('http://127.0.0.1:9225/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) pending.get(d.id)(d); };
    await new Promise(r => ws.onopen = r);

    const call = (method, params = {}) => new Promise(res => {
      const cid = id++;
      pending.set(cid, res);
      ws.send(JSON.stringify({ id: cid, method, params }));
    });

    await call('Page.enable');
    await call('Runtime.enable');
    await call('DOM.enable');

    console.log("1. Waiting 10 seconds for TradingView chart and PineTS engine to load...");
    await new Promise(r => setTimeout(r, 10000));

    // ── Phase 1: Test R5 Pine Editor Architecture & Templates ──────────
    console.log("\n--- PHASE 1: Verify R5 Pine Editor Architecture & Templates ---");
    const templatesCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const ide = window.PineEditorIDE;
        if (!ide) return { error: "window.PineEditorIDE not found" };
        const tpls = ide.getTemplates();
        const cur = ide.getCurrentScript();
        const required = [
          "Custom Symbol Candles",
          "SMA Crossover",
          "Smoothed RSI",
          "MACD",
          "Bollinger Bands",
          "ATR",
          "SuperTrend"
        ];
        const missing = required.filter(r => !tpls.some(t => t.name === r));
        return {
          templatesCount: tpls.length,
          allTemplateNames: tpls.map(t => t.name),
          requiredChecked: required.length,
          missing,
          currentScriptName: cur.name,
          dockPresent: !!document.getElementById('pine_editor_dock'),
          saveBtnPresent: !!document.getElementById('pine_save_btn'),
          addChartBtnPresent: !!document.getElementById('pine_add_to_chart_btn'),
          publishBtnPresent: !!document.getElementById('pine_publish_btn'),
          dropdownPresent: !!document.getElementById('pine_script_dropdown_trigger'),
          statusPillPresent: !!document.getElementById('pine_compiler_status')
        };
      })()`,
      returnByValue: true
    });
    console.log("Templates & UI Elements Result:", JSON.stringify(templatesCheck.result?.result?.value, null, 2));

    // ── Phase 2: Test Switching Templates ──────────────────────────────
    console.log("\n--- PHASE 2: Test Switching to 'Smoothed RSI' and 'Custom Symbol Candles' ---");
    const switchCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const ide = window.PineEditorIDE;
        const rsiTpl = ide.getTemplates().find(t => t.name === 'Smoothed RSI');
        ide.loadScript(rsiTpl.name, rsiTpl.code, rsiTpl.id);
        const codeInput = document.getElementById('pine_code_input');
        const titleDisplay = document.getElementById('pine_script_title_display');
        const rsiOk = codeInput.value.includes('ta.rsi') && titleDisplay.textContent === 'Smoothed RSI';

        // Now load Custom Symbol Candles back
        const cscTpl = ide.getTemplates().find(t => t.name === 'Custom Symbol Candles');
        ide.loadScript(cscTpl.name, cscTpl.code, cscTpl.id);
        const cscOk = codeInput.value.includes('plotcandle') && titleDisplay.textContent === 'Custom Symbol Candles';

        return { rsiOk, cscOk, currentCodeSnippet: codeInput.value.substring(0, 80) };
      })()`,
      returnByValue: true
    });
    console.log("Switch Template Result:", JSON.stringify(switchCheck.result?.result?.value, null, 2));

    // ── Phase 3: Open Pine Editor Dock & Test Add to Chart ──────────────
    console.log("\n--- PHASE 3: Open Pine Editor Dock and Add Study to Chart ---");
    await call('Runtime.evaluate', {
      expression: `window.PineEditorIDE.open()`
    });
    await new Promise(r => setTimeout(r, 1000));

    const addStudyRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const addBtn = document.getElementById('pine_add_to_chart_btn');
        addBtn.click();
        await new Promise(r => setTimeout(r, 2000));
        const chart = window.widget?.activeChart();
        const studies = chart ? chart.getAllStudies() : [];
        return {
          studiesCount: studies.length,
          studies: studies.map(s => ({ id: s.id, name: s.name })),
          status: document.getElementById('pine_compiler_status_text')?.textContent
        };
      })()`,
      returnByValue: true
    });
    console.log("Add Study Result:", JSON.stringify(addStudyRes.result?.result?.value, null, 2));

    // ── Phase 4: Test R4 Legend Polish & Defect Fixes ───────────────────
    console.log("\n--- PHASE 4: Test R4 Legend Polish & Defect Fixes in Chart Iframe ---");
    const legendInspection = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: "No chart iframe document" };

        // 1. Check interval eye suppression
        const intervalEyeElements = doc.querySelectorAll('[data-name="legend-interval-show-hide-action"], .intervalEye, [class*="intervalEye"]');
        const intervalEyeStyles = Array.from(intervalEyeElements).map(el => {
          const comp = doc.defaultView.getComputedStyle(el);
          return { display: comp.display, visibility: comp.visibility, width: comp.width };
        });

        // 2. Check valuesWrapper nowrap enforcement
        const valWrappers = doc.querySelectorAll('[class*="valuesWrapper"], [class*="valuesAdditionalWrapper"]');
        const wrapperStyles = Array.from(valWrappers).map(el => {
          const comp = doc.defaultView.getComputedStyle(el);
          return {
            whiteSpace: comp.whiteSpace,
            flexWrap: comp.flexWrap,
            display: comp.display,
            overflow: comp.overflow
          };
        });

        // 3. Find study legend items and their action buttons
        const studyItems = doc.querySelectorAll('[data-name="legend-series-item"], [data-name="legend-study-item"], [class*="item-l31H9iuA"], [class*="legend-"] [class*="item-"]');
        const itemsInfo = Array.from(studyItems).map(item => {
          const titleEl = item.querySelector('[class*="title-"], [data-name="legend-source-title"]');
          const title = titleEl ? titleEl.textContent.trim() : item.textContent.substring(0, 30).trim();
          const actions = item.querySelector('[class*="actions-"]');
          const eyeBtn = item.querySelector('[data-name="legend-show-hide-action"], [class*="eye-"]');
          const gearBtn = item.querySelector('[data-name="legend-settings-action"], [class*="formatButton"]');
          const trashBtn = item.querySelector('[data-name="legend-delete-action"], [class*="deleteButton"]');
          return {
            title,
            hasActions: !!actions,
            hasEye: !!eyeBtn,
            hasGear: !!gearBtn,
            hasTrash: !!trashBtn
          };
        });

        return {
          intervalEyeCount: intervalEyeElements.length,
          intervalEyeSuppressed: intervalEyeStyles.every(s => s.display === 'none'),
          valuesWrappersCount: valWrappers.length,
          wrappersNowrap: wrapperStyles.every(s => s.whiteSpace === 'nowrap' && s.flexWrap === 'nowrap'),
          studyLegendItems: itemsInfo
        };
      })()`,
      returnByValue: true
    });
    console.log("Legend Polish Inspection:", JSON.stringify(legendInspection.result?.result?.value, null, 2));

    // ── Phase 5: Test Legend Action Hover & Clicking ───────────────────
    console.log("\n--- PHASE 5: Test Legend Action Hover, Settings Gear, and Delete Trash ---");
    const actionClicks = await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: "No chart iframe" };

        // Find Custom Symbol Candles legend item
        const allItems = Array.from(doc.querySelectorAll('[class*="item-l31H9iuA"], [class*="legend-"] [class*="item-"]'));
        const customCandleItem = allItems.find(it => it.textContent.includes('Custom Symbol'));
        if (!customCandleItem) return { error: "Custom Symbol Candles item not found in legend" };

        // Simulate hover
        customCandleItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        customCandleItem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        const actions = customCandleItem.querySelector('[class*="actions-"], .buttonsWrapper-l31H9iuA');
        const gearBtn = customCandleItem.querySelector('[data-name="legend-settings-action"]');
        const trashBtn = customCandleItem.querySelector('[data-name="legend-delete-action"]');
        const eyeBtn = customCandleItem.querySelector('[data-name="legend-show-hide-action"]');

        let gearClicked = false;
        let dialogOpened = false;

        if (gearBtn) {
          gearBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          gearBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          gearBtn.click();
          gearClicked = true;
          await new Promise(r => setTimeout(r, 1200));
          const overlap = doc.querySelector('#overlap-manager-root');
          const dialog = (overlap && overlap.children.length > 0) || doc.querySelector('[data-name="edit-object-dialog"], [class*="dialog-"], [data-dialog-name]');
          dialogOpened = !!dialog;
          if (overlap && overlap.children.length > 0) {
            const closeBtn = overlap.querySelector('[data-name="close"], button[name="cancel"], [class*="close-"]');
            if (closeBtn) closeBtn.click();
          }
        }

        let eyeClicked = false;
        if (eyeBtn) {
          eyeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          eyeClicked = true;
        }

        let trashClicked = false;
        let studyCountAfterDelete = -1;

        if (trashBtn) {
          trashBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          trashBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          trashBtn.click();
          trashClicked = true;
          await new Promise(r => setTimeout(r, 1200));
          const chart = window.widget?.activeChart();
          const remainingStudies = chart ? chart.getAllStudies() : [];
          studyCountAfterDelete = remainingStudies.length;
        }

        return {
          foundItem: true,
          hasGearBtn: !!gearBtn,
          hasTrashBtn: !!trashBtn,
          hasEyeBtn: !!eyeBtn,
          eyeClicked,
          gearClicked,
          dialogOpened,
          trashClicked,
          studyCountAfterDelete
        };
      })()`,
      returnByValue: true
    });
    console.log("Legend Action Clicks Result:", JSON.stringify(actionClicks.result?.result?.value, null, 2));

    // ── Phase 6: Test Bottom Dock Tabs Integration ────────────────────
    console.log("\n--- PHASE 6: Test Bottom Dock Tabs Integration ---");
    const bottomTabsRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: "No chart iframe" };

        const pineTab = doc.querySelector('#tv_footer_pine_editor_tab');
        const stratTab = doc.querySelector('#tv_footer_strategy_tester_tab');
        const tradingTab = doc.querySelector('[data-name="paper_trading"]');

        return {
          hasPineTab: !!pineTab,
          pineTabText: pineTab?.textContent.trim(),
          hasStratTab: !!stratTab,
          stratTabText: stratTab?.textContent.trim(),
          hasTradingTab: !!tradingTab,
          isDockOpenNow: window.PineEditorIDE.isOpen(),
          pineTabActive: pineTab?.classList.contains('active-n3UmcVi3')
        };
      })()`,
      returnByValue: true
    });
    console.log("Bottom Tabs State:", JSON.stringify(bottomTabsRes.result?.result?.value, null, 2));

    // Capture screenshot of final state
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');
      fs.writeFileSync('screenshots/test_r4_r5_verified.png', Buffer.from(shot.result.data, 'base64'));
      console.log("Saved screenshots/test_r4_r5_verified.png");
    }

    console.log("\n=== ALL R4 & R5 CHECKS COMPLETED ===");
    ws.close();
  } catch (err) {
    console.error("Verification Error:", err);
  } finally {
    proc.kill();
  }
}

runVerification();
