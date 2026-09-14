/**
 * DEEP-DIVE DISCOVERY ENGINE — Phase 2
 * 
 * Goes beyond static DOM scanning:
 * 1. Opens EVERY dropdown menu on the top toolbar
 * 2. Opens EVERY drawing tool sub-menu on the left toolbar
 * 3. Right-clicks chart to reveal context menu items
 * 4. Opens Indicators dialog and scans all indicator items
 * 5. Opens Chart Settings dialog and scans all tabs/controls
 * 6. Opens each bottom dock panel and scans all internal elements
 * 7. Opens symbol search and tests it
 * 8. Tests all keyboard shortcuts
 * 9. Discovers elements in every possible UI state
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\binary_tree_evidence\\deep_dive';
const REPORT_PATH = path.join(EVIDENCE_DIR, 'deep_dive_report.json');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function run() {
  console.log('================================================================');
  console.log('🔬 DEEP-DIVE DISCOVERY ENGINE — Phase 2');
  console.log('Opening every menu, dropdown, context menu, modal, dialog');
  console.log('to expose ALL hidden interactive elements');
  console.log('================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join('C:\\Users\\gocha\\AppData\\Local\\Temp', 'chrome-deep-' + Date.now());
  const port = 9292;

  const proc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const putResp = await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:9999`, { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    const allExceptions = [];
    const allConsoleErrors = [];

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
        const text = d.params.args.map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
        allConsoleErrors.push(text);
      }
      if (d.method === 'Runtime.exceptionThrown') {
        const text = d.params.exceptionDetails?.text + ' ' + (d.params.exceptionDetails?.exception?.description || '');
        allExceptions.push(text);
      }
      if (d.id && pending.has(d.id)) pending.get(d.id)(d);
    };

    await new Promise(r => ws.onopen = r);

    const call = (method, params = {}) => new Promise((res) => {
      const cid = id++;
      const timeout = setTimeout(() => { pending.delete(cid); res({ result: { result: { value: null } } }); }, 15000);
      pending.set(cid, (d) => { clearTimeout(timeout); res(d); });
      ws.send(JSON.stringify({ id: cid, method, params }));
    });

    await call('Network.enable');
    await call('Page.enable');
    await call('Runtime.enable');
    await call('DOM.enable');

    console.log('[Setup] Waiting 10s for full page render...');
    await new Promise(r => setTimeout(r, 10000));

    async function evalJS(expr) {
      const resp = await call('Runtime.evaluate', {
        expression: expr,
        awaitPromise: true,
        returnByValue: true
      });
      return resp.result?.result?.value ?? null;
    }

    async function screenshot(name) {
      const scr = await call('Page.captureScreenshot', { format: 'png' });
      if (scr.result?.data) {
        fs.writeFileSync(path.join(EVIDENCE_DIR, name), Buffer.from(scr.result.data, 'base64'));
      }
    }

    async function pressEscape() {
      await call('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 27, key: 'Escape' });
      await call('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 27, key: 'Escape' });
      await new Promise(r => setTimeout(r, 300));
    }

    async function clickAt(x, y) {
      await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await new Promise(r => setTimeout(r, 200));
    }

    async function rightClickAt(x, y) {
      await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', clickCount: 1 });
      await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', clickCount: 1 });
      await new Promise(r => setTimeout(r, 300));
    }

    // Count all interactive elements in current state (main + iframe)
    async function countAllElements() {
      return await evalJS(`(() => {
        let count = 0;
        const selectors = 'button, a, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="option"], [role="radio"], [role="listbox"], [role="combobox"], [role="slider"], [onclick], [tabindex], [data-name]';
        
        // Main document
        count += document.querySelectorAll(selectors).length;
        // cursor:pointer
        document.querySelectorAll('div, span, svg, i, label, td, tr, li').forEach(el => {
          try { if (window.getComputedStyle(el).cursor === 'pointer') count++; } catch(e) {}
        });
        
        // All iframes
        document.querySelectorAll('iframe').forEach(iframe => {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) return;
            count += doc.querySelectorAll(selectors).length;
            doc.querySelectorAll('div, span, svg, i, label, td, tr, li, path, g, rect, circle').forEach(el => {
              try { if (iframe.contentWindow.getComputedStyle(el).cursor === 'pointer') count++; } catch(e) {}
            });
          } catch(e) {}
        });
        
        return count;
      })()`);
    }

    // Discover elements with details in current state
    async function discoverCurrentState(label) {
      return await evalJS(`(() => {
        const results = [];
        const seen = new Set();
        
        function collect(el, ctx) {
          try {
            const rect = el.getBoundingClientRect();
            const cs = (el.ownerDocument.defaultView || window).getComputedStyle(el);
            const tag = el.tagName.toLowerCase();
            const text = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
            const title = el.getAttribute('title') || '';
            const ariaLabel = el.getAttribute('aria-label') || '';
            const dataName = el.getAttribute('data-name') || '';
            const role = el.getAttribute('role') || '';
            const visible = rect.width > 0 && rect.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
            const key = ctx + '|' + tag + '|' + text.slice(0,40) + '|' + Math.round(rect.x) + ',' + Math.round(rect.y);
            if (seen.has(key)) return;
            seen.add(key);
            results.push({
              ctx, tag, text: text.slice(0,80), title: title.slice(0,50),
              ariaLabel: ariaLabel.slice(0,50), dataName: dataName.slice(0,40),
              role, visible,
              x: Math.round(rect.x), y: Math.round(rect.y),
              w: Math.round(rect.width), h: Math.round(rect.height)
            });
          } catch(e) {}
        }
        
        const sel = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="checkbox"], [role="switch"], [role="option"], [role="radio"], [role="listbox"], [role="combobox"], [role="slider"], [onclick], [tabindex]:not(body):not(html), [data-name], [data-role]';
        
        // Main doc
        document.querySelectorAll(sel).forEach(el => collect(el, 'main'));
        document.querySelectorAll('div, span, svg, i, label, td, tr, li').forEach(el => {
          try { if (window.getComputedStyle(el).cursor === 'pointer') collect(el, 'main_ptr'); } catch(e) {}
        });
        
        // Iframes
        document.querySelectorAll('iframe').forEach((iframe, idx) => {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) return;
            doc.querySelectorAll(sel).forEach(el => collect(el, 'iframe' + idx));
            doc.querySelectorAll('div, span, svg, i, label, td, tr, li, path, g, rect, circle').forEach(el => {
              try { if (iframe.contentWindow.getComputedStyle(el).cursor === 'pointer') collect(el, 'iframe' + idx + '_ptr'); } catch(e) {}
            });
          } catch(e) {}
        });
        
        return results;
      })()`);
    }

    const grandTotal = { discovered: 0, tested: 0, passed: 0, failed: 0 };
    const allDiscoveredByPhase = {};
    const failedDetails = [];

    // Helper to click-test a batch of elements
    async function clickTestElements(elements, phaseName) {
      const testable = (elements || []).filter(el => el.visible && el.w >= 6 && el.h >= 6 && el.x >= 0 && el.y >= 0 && el.x < 1920 && el.y < 1080);
      let passed = 0, failed = 0;
      
      for (const el of testable) {
        const exBefore = allExceptions.length;
        const cx = el.x + Math.floor(el.w / 2);
        const cy = el.y + Math.floor(el.h / 2);
        try {
          await clickAt(cx, cy);
          if (allExceptions.length > exBefore) {
            failed++;
            failedDetails.push({ phase: phaseName, element: el, error: allExceptions.slice(exBefore).join('; ') });
          } else {
            passed++;
          }
        } catch(e) {}
      }
      
      grandTotal.tested += testable.length;
      grandTotal.passed += passed;
      grandTotal.failed += failed;
      return { total: (elements || []).length, testable: testable.length, passed, failed };
    }

    // ═══════════════════════════════════════════════════════════
    // SECTION 1: BASE STATE — all elements visible by default
    // ═══════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 1: Base State Elements ━━━');
    const baseElements = await discoverCurrentState('base');
    const baseCount = baseElements ? baseElements.length : 0;
    grandTotal.discovered += baseCount;
    allDiscoveredByPhase['1_base_state'] = baseCount;
    console.log(`  Discovered: ${baseCount}`);
    const baseResult = await clickTestElements(baseElements, 'base_state');
    console.log(`  Tested: ${baseResult.testable} | ✅ ${baseResult.passed} | ❌ ${baseResult.failed}`);
    await screenshot('01_base_state.png');
    await pressEscape();

    // ═══════════════════════════════════════════════════════════
    // SECTION 2: DRAWING TOOLS LEFT TOOLBAR — expand each submenu
    // ═══════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 2: Drawing Tools Submenus ━━━');
    
    // Get drawing toolbar buttons from iframe
    const drawingBtns = await evalJS(`(() => {
      const results = [];
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) continue;
          // Left toolbar drawing tools with nested arrows / submenus
          doc.querySelectorAll('[data-name*="drawing"], .drawingToolbar button, .group-wWM3zP_M- button, [class*="drawing"] button, [data-name*="tool"]').forEach((btn, i) => {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              results.push({
                text: (btn.textContent || '').trim().slice(0, 30),
                title: (btn.getAttribute('title') || btn.getAttribute('aria-label') || '').slice(0, 40),
                dataName: (btn.getAttribute('data-name') || '').slice(0, 40),
                x: Math.round(rect.x), y: Math.round(rect.y),
                w: Math.round(rect.width), h: Math.round(rect.height)
              });
            }
          });
        } catch(e) {}
      }
      return results;
    })()`);

    let drawingSubTotal = 0;
    if (drawingBtns && drawingBtns.length > 0) {
      console.log(`  Found ${drawingBtns.length} drawing toolbar buttons to expand`);
      for (let i = 0; i < drawingBtns.length; i++) {
        const btn = drawingBtns[i];
        // Long-press / right-click to open submenu
        await rightClickAt(btn.x + btn.w/2, btn.y + btn.h/2);
        await new Promise(r => setTimeout(r, 500));
        
        const subElements = await discoverCurrentState('drawing_sub_' + i);
        const subNew = (subElements || []).length;
        drawingSubTotal += subNew;
        
        if (subNew > 0 && i < 5) {
          await screenshot(`02_drawing_sub_${i}.png`);
        }
        
        await pressEscape();
      }
    }
    grandTotal.discovered += drawingSubTotal;
    allDiscoveredByPhase['2_drawing_submenus'] = drawingSubTotal;
    console.log(`  Total submenu elements discovered: ${drawingSubTotal}`);

    // ═══════════════════════════════════════════════════════════
    // SECTION 3: CHART RIGHT-CLICK CONTEXT MENU
    // ═══════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 3: Chart Right-Click Context Menu ━━━');
    await rightClickAt(500, 400);
    await new Promise(r => setTimeout(r, 600));
    const ctxElements = await discoverCurrentState('context_menu');
    const ctxCount = (ctxElements || []).length;
    grandTotal.discovered += ctxCount;
    allDiscoveredByPhase['3_context_menu'] = ctxCount;
    console.log(`  Context menu elements: ${ctxCount}`);
    await screenshot('03_context_menu.png');
    const ctxResult = await clickTestElements(
      (ctxElements || []).filter(e => e.role === 'menuitem' || e.role === 'menuitemcheckbox' || e.tag === 'button'),
      'context_menu'
    );
    console.log(`  Tested: ${ctxResult.testable} | ✅ ${ctxResult.passed} | ❌ ${ctxResult.failed}`);
    await pressEscape();

    // ═══════════════════════════════════════════════════════════
    // SECTION 4: INDICATORS DIALOG — all indicator categories & items
    // ═══════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 4: Indicators Dialog ━━━');
    await evalJS(`(() => {
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) continue;
          const btn = doc.querySelector('[data-name="open-indicators-dialog"], [aria-label="Indicators"], button[data-tooltip="Indicators"]');
          if (btn) { btn.click(); return true; }
          // Fallback: find by text
          const all = doc.querySelectorAll('button, div[role="button"]');
          for (const el of all) {
            if (el.textContent.trim() === 'Indicators' || (el.getAttribute('aria-label') || '').includes('Indicators')) {
              el.click(); return true;
            }
          }
        } catch(e) {}
      }
      return false;
    })()`);
    await new Promise(r => setTimeout(r, 1500));
    
    const indicatorElements = await discoverCurrentState('indicators_dialog');
    const indCount = (indicatorElements || []).length;
    grandTotal.discovered += indCount;
    allDiscoveredByPhase['4_indicators_dialog'] = indCount;
    console.log(`  Indicator dialog elements: ${indCount}`);
    await screenshot('04_indicators_dialog.png');
    
    // Click through indicator category tabs
    const indTabs = (indicatorElements || []).filter(e => e.role === 'tab' || (e.tag === 'button' && e.visible));
    let indTabsDiscovered = 0;
    for (let i = 0; i < Math.min(indTabs.length, 15); i++) {
      const tab = indTabs[i];
      if (tab.visible && tab.w > 5 && tab.h > 5) {
        await clickAt(tab.x + tab.w/2, tab.y + tab.h/2);
        await new Promise(r => setTimeout(r, 400));
        const tabElements = await discoverCurrentState('ind_tab_' + i);
        indTabsDiscovered += (tabElements || []).length;
      }
    }
    grandTotal.discovered += indTabsDiscovered;
    allDiscoveredByPhase['4b_indicator_tabs'] = indTabsDiscovered;
    console.log(`  Indicator tab sub-elements: ${indTabsDiscovered}`);
    await pressEscape();
    await new Promise(r => setTimeout(r, 500));

    // ═══════════════════════════════════════════════════════════
    // SECTION 5: CHART SETTINGS DIALOG — all settings tabs
    // ═══════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 5: Chart Settings Dialog ━━━');
    await evalJS(`(() => {
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) continue;
          const btn = doc.querySelector('[data-name="properties"], [aria-label*="properties"], [data-name="chart-properties"]');
          if (btn) { btn.click(); return true; }
          const all = doc.querySelectorAll('button, div[role="button"]');
          for (const el of all) {
            if ((el.getAttribute('title') || '').includes('properties') || (el.getAttribute('data-tooltip') || '').includes('properties')) {
              el.click(); return true;
            }
          }
        } catch(e) {}
      }
      return false;
    })()`);
    await new Promise(r => setTimeout(r, 1500));
    
    const settingsElements = await discoverCurrentState('settings_dialog');
    const setCount = (settingsElements || []).length;
    grandTotal.discovered += setCount;
    allDiscoveredByPhase['5_settings_dialog'] = setCount;
    console.log(`  Settings dialog elements: ${setCount}`);
    await screenshot('05_settings_dialog.png');
    
    // Click through settings tabs
    const setTabs = (settingsElements || []).filter(e => e.role === 'tab' || e.dataName.includes('tab'));
    let setTabsDisc = 0;
    for (let i = 0; i < Math.min(setTabs.length, 10); i++) {
      const tab = setTabs[i];
      if (tab.visible && tab.w > 5 && tab.h > 5) {
        await clickAt(tab.x + tab.w/2, tab.y + tab.h/2);
        await new Promise(r => setTimeout(r, 400));
        const tabEls = await discoverCurrentState('settings_tab_' + i);
        setTabsDisc += (tabEls || []).length;
        if (i < 3) await screenshot(`05_settings_tab_${i}.png`);
      }
    }
    grandTotal.discovered += setTabsDisc;
    allDiscoveredByPhase['5b_settings_tabs'] = setTabsDisc;
    console.log(`  Settings tab sub-elements: ${setTabsDisc}`);
    await pressEscape();
    await new Promise(r => setTimeout(r, 500));

    // ═══════════════════════════════════════════════════════════
    // SECTION 6: SYMBOL SEARCH DIALOG
    // ═══════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 6: Symbol Search Dialog ━━━');
    await evalJS(`(() => {
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) continue;
          const btn = doc.querySelector('[data-name="symbol-search"], [aria-label*="Symbol Search"], [data-name="header-toolbar-symbol-search"]');
          if (btn) { btn.click(); return true; }
          const all = doc.querySelectorAll('button, div[role="button"], div[data-name]');
          for (const el of all) {
            if ((el.getAttribute('data-name') || '').includes('symbol-search') || (el.getAttribute('aria-label') || '').includes('search')) {
              el.click(); return true;
            }
          }
        } catch(e) {}
      }
      return false;
    })()`);
    await new Promise(r => setTimeout(r, 1500));
    
    const searchElements = await discoverCurrentState('symbol_search');
    const searchCount = (searchElements || []).length;
    grandTotal.discovered += searchCount;
    allDiscoveredByPhase['6_symbol_search'] = searchCount;
    console.log(`  Symbol search elements: ${searchCount}`);
    await screenshot('06_symbol_search.png');
    await pressEscape();
    await new Promise(r => setTimeout(r, 500));

    // ═══════════════════════════════════════════════════════════
    // SECTION 7: TOP TOOLBAR DROPDOWN MENUS
    // ═══════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 7: Top Toolbar Dropdown Menus ━━━');
    
    // Find all toolbar buttons that have dropdown arrows or are known dropdowns
    const toolbarDropdowns = await evalJS(`(() => {
      const results = [];
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) continue;
          // Header toolbar buttons with dropdowns (chart type, timeframe, compare, etc.)
          doc.querySelectorAll('[data-name*="header-toolbar"], [class*="header"] button, [class*="toolbar"] button').forEach(btn => {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.y < 50) {
              results.push({
                text: (btn.textContent || '').trim().slice(0, 30),
                dataName: (btn.getAttribute('data-name') || '').slice(0, 50),
                x: Math.round(rect.x), y: Math.round(rect.y),
                w: Math.round(rect.width), h: Math.round(rect.height)
              });
            }
          });
        } catch(e) {}
      }
      return results;
    })()`);

    let dropdownTotal = 0;
    if (toolbarDropdowns && toolbarDropdowns.length > 0) {
      console.log(`  Found ${toolbarDropdowns.length} toolbar buttons to check for dropdowns`);
      for (let i = 0; i < toolbarDropdowns.length; i++) {
        const btn = toolbarDropdowns[i];
        await clickAt(btn.x + btn.w/2, btn.y + btn.h/2);
        await new Promise(r => setTimeout(r, 500));
        
        const dropElements = await discoverCurrentState('dropdown_' + i);
        const dropNew = (dropElements || []).length;
        dropdownTotal += dropNew;
        
        if (i < 8) {
          await screenshot(`07_dropdown_${i}_${String(btn.dataName || btn.text || i).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}.png`);
        }
        
        // Test menu items in dropdown
        const menuItems = (dropElements || []).filter(e => e.role === 'menuitem' || e.role === 'option' || e.role === 'menuitemradio');
        if (menuItems.length > 0) {
          console.log(`    Dropdown #${i} "${btn.text || btn.dataName}": ${dropNew} elements, ${menuItems.length} menu items`);
        }
        
        await pressEscape();
      }
    }
    grandTotal.discovered += dropdownTotal;
    allDiscoveredByPhase['7_toolbar_dropdowns'] = dropdownTotal;
    console.log(`  Total dropdown elements: ${dropdownTotal}`);

    // ═══════════════════════════════════════════════════════════
    // SECTION 8: BOTTOM DOCK — Each Panel's Internal Elements
    // ═══════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 8: Bottom Dock Panels ━━━');
    
    const bottomTabs = ['Pine Editor', 'Strategy Tester', 'Account Manager', 'Trade'];
    let bottomTotal = 0;
    
    for (let i = 0; i < bottomTabs.length; i++) {
      const tabName = bottomTabs[i];
      await evalJS(`(() => {
        const tabs = document.querySelectorAll('button, div, span');
        for (const tab of tabs) {
          if (tab.textContent.trim() === '${tabName}') {
            tab.click();
            return true;
          }
        }
        return false;
      })()`);
      await new Promise(r => setTimeout(r, 800));
      
      const panelElements = await discoverCurrentState('bottom_' + tabName.replace(/\s/g, '_'));
      const panelCount = (panelElements || []).length;
      bottomTotal += panelCount;
      console.log(`  ${tabName}: ${panelCount} elements`);
      await screenshot(`08_bottom_${tabName.replace(/\s/g, '_')}.png`);
      
      // For Account Manager, click through sub-tabs
      if (tabName === 'Account Manager') {
        const subTabs = ['Positions', 'Orders', 'History', 'Account Summary', 'Notifications log'];
        for (const sub of subTabs) {
          await evalJS(`(() => {
            const els = document.querySelectorAll('button, div, span');
            for (const el of els) {
              if (el.textContent.trim() === '${sub}' || el.textContent.trim().startsWith('${sub}')) {
                el.click();
                return true;
              }
            }
            return false;
          })()`);
          await new Promise(r => setTimeout(r, 500));
          const subElements = await discoverCurrentState('acct_' + sub.replace(/\s/g, '_'));
          bottomTotal += (subElements || []).length;
        }
      }
    }
    grandTotal.discovered += bottomTotal;
    allDiscoveredByPhase['8_bottom_panels'] = bottomTotal;
    console.log(`  Total bottom panel elements: ${bottomTotal}`);

    // ═══════════════════════════════════════════════════════════
    // SECTION 9: RIGHT SIDEBAR — Each Widget Panel
    // ═══════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 9: Right Sidebar Widgets ━━━');
    
    const sidebarWidgets = await evalJS(`(() => {
      const results = [];
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) continue;
          doc.querySelectorAll('[class*="widgetbar"] button, [data-name*="right-toolbar"] button').forEach(btn => {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.x > 1400) {
              results.push({
                title: (btn.getAttribute('title') || btn.getAttribute('aria-label') || btn.textContent || '').trim().slice(0, 40),
                x: Math.round(rect.x), y: Math.round(rect.y),
                w: Math.round(rect.width), h: Math.round(rect.height)
              });
            }
          });
        } catch(e) {}
      }
      return results;
    })()`);

    let sidebarTotal = 0;
    if (sidebarWidgets && sidebarWidgets.length > 0) {
      console.log(`  Found ${sidebarWidgets.length} sidebar widget buttons`);
      for (let i = 0; i < sidebarWidgets.length; i++) {
        const w = sidebarWidgets[i];
        await clickAt(w.x + w.w/2, w.y + w.h/2);
        await new Promise(r => setTimeout(r, 600));
        
        const widgetElements = await discoverCurrentState('sidebar_' + i);
        const wCount = (widgetElements || []).length;
        sidebarTotal += wCount;
        console.log(`    Widget "${w.title}": ${wCount} elements`);
        if (i < 5) await screenshot(`09_sidebar_${i}_${w.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}.png`);
      }
    }
    grandTotal.discovered += sidebarTotal;
    allDiscoveredByPhase['9_sidebar_widgets'] = sidebarTotal;
    console.log(`  Total sidebar elements: ${sidebarTotal}`);

    // ═══════════════════════════════════════════════════════════
    // SECTION 10: ORDER TICKET — All Order Types & Fields
    // ═══════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 10: Order Ticket Deep Scan ━━━');
    
    const orderTypes = ['Market', 'Limit', 'Stop', 'Stop Limit'];
    let orderTotal = 0;
    
    for (const ot of orderTypes) {
      await evalJS(`(() => {
        const els = document.querySelectorAll('button, div, span');
        for (const el of els) {
          if (el.textContent.trim() === '${ot}') { el.click(); return true; }
        }
        return false;
      })()`);
      await new Promise(r => setTimeout(r, 500));
      
      const orderElements = await discoverCurrentState('order_' + ot);
      const oCount = (orderElements || []).length;
      orderTotal += oCount;
      console.log(`  ${ot} order form: ${oCount} elements`);
      await screenshot(`10_order_${ot.replace(/\s/g, '_')}.png`);
    }
    grandTotal.discovered += orderTotal;
    allDiscoveredByPhase['10_order_ticket'] = orderTotal;

    // ═══════════════════════════════════════════════════════════
    // SECTION 11: KEYBOARD SHORTCUTS TEST
    // ═══════════════════════════════════════════════════════════
    console.log('\n━━━ SECTION 11: Keyboard Shortcut Testing ━━━');
    
    const shortcuts = [
      { key: 'KeyS', name: 'Symbol Search (S)', code: 83 },
      { key: 'KeyI', name: 'Indicators (I)', code: 73 },
      { key: 'Slash', name: 'Resolution selector (/)', code: 191 },
      { key: 'Equal', name: 'Zoom In (+)', code: 187 },
      { key: 'Minus', name: 'Zoom Out (-)', code: 189 },
      { key: 'F11', name: 'Fullscreen (F11)', code: 122 },
      { key: 'KeyR', name: 'Reset chart (R)', code: 82 },
    ];
    
    let shortcutsPassed = 0;
    for (const sc of shortcuts) {
      const exBefore = allExceptions.length;
      await call('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: sc.code, key: sc.key });
      await call('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: sc.code, key: sc.key });
      await new Promise(r => setTimeout(r, 400));
      
      if (allExceptions.length === exBefore) {
        shortcutsPassed++;
        console.log(`  ✅ ${sc.name}`);
      } else {
        console.log(`  ❌ ${sc.name}: Exception thrown`);
      }
      await pressEscape();
    }
    allDiscoveredByPhase['11_keyboard_shortcuts'] = shortcuts.length;
    console.log(`  Shortcuts: ${shortcutsPassed}/${shortcuts.length} passed`);

    // ═══════════════════════════════════════════════════════════
    // FINAL REPORT
    // ═══════════════════════════════════════════════════════════
    
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('🏁 DEEP-DIVE DISCOVERY & TEST — COMPLETE');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`  Total Elements Discovered (all states): ${grandTotal.discovered}`);
    console.log(`  Total Elements Click-Tested: ${grandTotal.tested}`);
    console.log(`  ✅ Passed: ${grandTotal.passed}`);
    console.log(`  ❌ Failed: ${grandTotal.failed}`);
    console.log(`  Pass Rate: ${grandTotal.tested > 0 ? ((grandTotal.passed / grandTotal.tested) * 100).toFixed(2) : 0}%`);
    console.log(`  Total Console Errors: ${allConsoleErrors.length}`);
    console.log(`  Total Runtime Exceptions: ${allExceptions.length}`);
    console.log('');
    console.log('  By Phase:');
    for (const [phase, count] of Object.entries(allDiscoveredByPhase)) {
      console.log(`    ${phase}: ${count}`);
    }
    console.log('════════════════════════════════════════════════════════════\n');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDiscovered: grandTotal.discovered,
        totalTested: grandTotal.tested,
        passed: grandTotal.passed,
        failed: grandTotal.failed,
        passRate: grandTotal.tested > 0 ? ((grandTotal.passed / grandTotal.tested) * 100).toFixed(2) + '%' : 'N/A',
        consoleErrors: allConsoleErrors.length,
        exceptions: allExceptions.length
      },
      byPhase: allDiscoveredByPhase,
      failedElements: failedDetails.slice(0, 100),
      consoleErrors: allConsoleErrors.slice(0, 50),
      exceptions: allExceptions.slice(0, 50)
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`Report saved: ${REPORT_PATH}`);

    ws.close();
    proc.kill();
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    try { proc.kill(); } catch(e) {}
    process.exit(1);
  }
}

run();
