/**
 * EXHAUSTIVE ELEMENT DISCOVERY ENGINE
 * 
 * Phase 1: Discover ALL interactive elements across the entire page + iframes
 * Phase 2: Categorize and count them
 * Phase 3: Test each one in batches with screenshot evidence
 * 
 * This finds EVERY: button, a[href], input, select, [role=button], [onclick],
 * [tabindex], .clickable, cursor:pointer elements — in both the main page
 * AND the TradingView charting_library iframe.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\binary_tree_evidence\\exhaustive';
const REPORT_PATH = path.join(EVIDENCE_DIR, 'full_discovery_report.json');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function run() {
  console.log('================================================================');
  console.log('🔬 EXHAUSTIVE ELEMENT DISCOVERY ENGINE');
  console.log('Crawling EVERY interactive element on page + all iframes');
  console.log('================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join('C:\\Users\\gocha\\AppData\\Local\\Temp', 'chrome-exhaust-' + Date.now());
  const port = 9291;

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
    const consoleErrors = [];
    const exceptions = [];

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
        const text = d.params.args.map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
        consoleErrors.push(text);
      }
      if (d.method === 'Runtime.exceptionThrown') {
        const text = d.params.exceptionDetails?.text + ' ' + (d.params.exceptionDetails?.exception?.description || '');
        exceptions.push(text);
      }
      if (d.id && pending.has(d.id)) pending.get(d.id)(d);
    };

    await new Promise(r => ws.onopen = r);

    const call = (method, params = {}) => new Promise((res, rej) => {
      const cid = id++;
      const timeout = setTimeout(() => { pending.delete(cid); res({ result: { result: { value: null } } }); }, 15000);
      pending.set(cid, (d) => { clearTimeout(timeout); res(d); });
      ws.send(JSON.stringify({ id: cid, method, params }));
    });

    await call('Network.enable');
    await call('Page.enable');
    await call('Runtime.enable');
    await call('DOM.enable');

    console.log('[Setup] Waiting 10s for full page + charting library + all panels to render...');
    await new Promise(r => setTimeout(r, 10000));

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: DISCOVER ALL ELEMENTS IN MAIN DOCUMENT
    // ═══════════════════════════════════════════════════════════
    
    async function evalJS(expr) {
      const resp = await call('Runtime.evaluate', {
        expression: expr,
        awaitPromise: true,
        returnByValue: true
      });
      return resp.result?.result?.value ?? null;
    }

    console.log('\n── PHASE 1: Main Document Element Discovery ──');
    
    const mainElements = await evalJS(`(() => {
      const results = [];
      const seen = new Set();
      
      function getInfo(el, context) {
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
        const title = el.getAttribute('title') || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const role = el.getAttribute('role') || '';
        const dataName = el.getAttribute('data-name') || '';
        const type = el.getAttribute('type') || '';
        const className = (el.className || '').toString().slice(0, 80);
        const id = el.id || '';
        const visible = rect.width > 0 && rect.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
        const clickable = cs.cursor === 'pointer' || cs.pointerEvents !== 'none';
        
        // Generate a unique key
        const key = tag + '|' + text.slice(0,30) + '|' + title + '|' + ariaLabel + '|' + Math.round(rect.x) + ',' + Math.round(rect.y);
        if (seen.has(key)) return null;
        seen.add(key);
        
        return {
          context,
          tag,
          text: text.slice(0, 60),
          title: title.slice(0, 50),
          ariaLabel: ariaLabel.slice(0, 50),
          role,
          dataName: dataName.slice(0, 40),
          type,
          id: id.slice(0, 40),
          className: className.slice(0, 80),
          visible,
          clickable,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        };
      }
      
      // All button elements
      document.querySelectorAll('button').forEach(el => {
        const info = getInfo(el, 'main_button');
        if (info) results.push(info);
      });
      
      // All anchor links
      document.querySelectorAll('a').forEach(el => {
        const info = getInfo(el, 'main_link');
        if (info) results.push(info);
      });
      
      // All inputs
      document.querySelectorAll('input, select, textarea').forEach(el => {
        const info = getInfo(el, 'main_input');
        if (info) results.push(info);
      });
      
      // All role=button, role=tab, role=menuitem, role=checkbox, role=switch, role=option
      document.querySelectorAll('[role="button"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="option"], [role="radio"], [role="listbox"], [role="combobox"], [role="slider"]').forEach(el => {
        const info = getInfo(el, 'main_aria_role');
        if (info) results.push(info);
      });
      
      // All elements with onclick attribute
      document.querySelectorAll('[onclick]').forEach(el => {
        const info = getInfo(el, 'main_onclick');
        if (info) results.push(info);
      });
      
      // All elements with tabindex (keyboard accessible)
      document.querySelectorAll('[tabindex]').forEach(el => {
        const info = getInfo(el, 'main_tabindex');
        if (info) results.push(info);
      });
      
      // All elements with data-name (TradingView custom data attributes)
      document.querySelectorAll('[data-name]').forEach(el => {
        const info = getInfo(el, 'main_data_name');
        if (info) results.push(info);
      });
      
      // All elements with cursor: pointer (clickable styling)
      document.querySelectorAll('div, span, svg, i, label, td, tr, li').forEach(el => {
        const cs = window.getComputedStyle(el);
        if (cs.cursor === 'pointer') {
          const info = getInfo(el, 'main_cursor_pointer');
          if (info) results.push(info);
        }
      });
      
      return results;
    })()`);

    console.log(`  Main document: ${mainElements ? mainElements.length : 0} interactive elements found`);

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: DISCOVER ALL ELEMENTS INSIDE IFRAMES
    // ═══════════════════════════════════════════════════════════
    
    console.log('\n── PHASE 2: IFrame Element Discovery ──');
    
    const iframeElements = await evalJS(`(() => {
      const results = [];
      const seen = new Set();
      
      function getInfo(el, context) {
        try {
          const rect = el.getBoundingClientRect();
          const cs = window.getComputedStyle(el);
          const tag = el.tagName.toLowerCase();
          const text = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
          const title = el.getAttribute('title') || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const role = el.getAttribute('role') || '';
          const dataName = el.getAttribute('data-name') || '';
          const type = el.getAttribute('type') || '';
          const className = (el.className || '').toString().slice(0, 80);
          const elId = el.id || '';
          const visible = rect.width > 0 && rect.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
          
          const key = context + '|' + tag + '|' + text.slice(0,30) + '|' + title + '|' + Math.round(rect.x) + ',' + Math.round(rect.y);
          if (seen.has(key)) return null;
          seen.add(key);
          
          return {
            context,
            tag,
            text: text.slice(0, 60),
            title: title.slice(0, 50),
            ariaLabel: ariaLabel.slice(0, 50),
            role,
            dataName: dataName.slice(0, 40),
            type,
            id: elId.slice(0, 40),
            className: className.slice(0, 80),
            visible,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height)
          };
        } catch(e) { return null; }
      }
      
      const iframes = document.querySelectorAll('iframe');
      let iframeIdx = 0;
      
      for (const iframe of iframes) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) continue;
          const ctx = 'iframe_' + iframeIdx;
          iframeIdx++;
          
          // All buttons
          doc.querySelectorAll('button').forEach(el => {
            const info = getInfo(el, ctx + '_button');
            if (info) results.push(info);
          });
          
          // All links
          doc.querySelectorAll('a').forEach(el => {
            const info = getInfo(el, ctx + '_link');
            if (info) results.push(info);
          });
          
          // All inputs
          doc.querySelectorAll('input, select, textarea').forEach(el => {
            const info = getInfo(el, ctx + '_input');
            if (info) results.push(info);
          });
          
          // All role-based elements
          doc.querySelectorAll('[role="button"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="option"], [role="radio"], [role="listbox"], [role="combobox"], [role="slider"]').forEach(el => {
            const info = getInfo(el, ctx + '_aria');
            if (info) results.push(info);
          });
          
          // onclick elements
          doc.querySelectorAll('[onclick]').forEach(el => {
            const info = getInfo(el, ctx + '_onclick');
            if (info) results.push(info);
          });
          
          // tabindex elements
          doc.querySelectorAll('[tabindex]').forEach(el => {
            const info = getInfo(el, ctx + '_tabindex');
            if (info) results.push(info);
          });
          
          // data-name elements (TV widgets)
          doc.querySelectorAll('[data-name]').forEach(el => {
            const info = getInfo(el, ctx + '_data_name');
            if (info) results.push(info);
          });
          
          // cursor:pointer elements
          doc.querySelectorAll('div, span, svg, i, label, td, tr, li, path, g').forEach(el => {
            try {
              const cs = iframe.contentWindow.getComputedStyle(el);
              if (cs.cursor === 'pointer') {
                const info = getInfo(el, ctx + '_cursor_pointer');
                if (info) results.push(info);
              }
            } catch(e) {}
          });
          
        } catch(e) {
          // Cross-origin iframe, skip
        }
      }
      
      return results;
    })()`);

    console.log(`  Iframe elements: ${iframeElements ? iframeElements.length : 0} interactive elements found`);

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: COMBINE & CATEGORIZE
    // ═══════════════════════════════════════════════════════════
    
    const allElements = [...(mainElements || []), ...(iframeElements || [])];
    const visibleElements = allElements.filter(e => e.visible);
    const hiddenElements = allElements.filter(e => !e.visible);
    
    // Categorize
    const categories = {};
    for (const el of allElements) {
      const cat = el.context.split('_')[0] + '_' + el.context.split('_').slice(1).join('_');
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(el);
    }

    console.log('\n── PHASE 3: Category Breakdown ──');
    console.log(`  TOTAL interactive elements: ${allElements.length}`);
    console.log(`  Visible: ${visibleElements.length}`);
    console.log(`  Hidden/Off-screen: ${hiddenElements.length}`);
    console.log('');
    
    for (const [cat, items] of Object.entries(categories).sort((a,b) => b[1].length - a[1].length)) {
      const vis = items.filter(e => e.visible).length;
      console.log(`  ${cat}: ${items.length} total (${vis} visible)`);
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 4: CLICK-TEST VISIBLE ELEMENTS IN BATCHES
    // ═══════════════════════════════════════════════════════════
    
    console.log('\n── PHASE 4: Click-Testing ALL Visible Elements ──');
    
    // Filter to only visible, reasonably-sized clickable elements
    const testable = visibleElements.filter(el => 
      el.w >= 8 && el.h >= 8 &&   // at least 8x8 pixels
      el.x >= 0 && el.y >= 0 &&   // on screen
      el.x < 1920 && el.y < 1080
    );
    
    console.log(`  Testable visible elements (>=8x8, on-screen): ${testable.length}`);
    
    const batchSize = 50;
    const totalBatches = Math.ceil(testable.length / batchSize);
    let totalPassed = 0;
    let totalFailed = 0;
    const failedElements = [];
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const start = batch * batchSize;
      const end = Math.min(start + batchSize, testable.length);
      const batchElements = testable.slice(start, end);
      
      console.log(`\n  [Batch ${batch + 1}/${totalBatches}] Testing elements ${start + 1}-${end}...`);
      
      const errsBefore = exceptions.length;
      
      for (let i = 0; i < batchElements.length; i++) {
        const el = batchElements[i];
        const globalIdx = start + i + 1;
        const exBefore = exceptions.length;
        
        // Click at the center of the element
        const cx = el.x + Math.floor(el.w / 2);
        const cy = el.y + Math.floor(el.h / 2);
        
        try {
          await call('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: cx, y: cy,
            button: 'left',
            clickCount: 1
          });
          await call('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: cx, y: cy,
            button: 'left',
            clickCount: 1
          });
          
          // Small wait for click handler execution
          await new Promise(r => setTimeout(r, 100));
          
          // Check for new exceptions
          if (exceptions.length > exBefore) {
            totalFailed++;
            const newEx = exceptions.slice(exBefore);
            failedElements.push({
              index: globalIdx,
              element: el,
              error: newEx.join('; ')
            });
            if (globalIdx % 100 === 0 || exceptions.length > exBefore) {
              console.log(`    ❌ #${globalIdx} [${el.context}] "${el.text || el.title || el.ariaLabel || el.dataName}" @ (${cx},${cy}) — Exception: ${newEx[0].slice(0, 80)}`);
            }
          } else {
            totalPassed++;
          }
          
          // Dismiss any modals/popups that may have appeared (press Escape every 200 elements)
          if (globalIdx % 200 === 0) {
            await call('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 27, key: 'Escape' });
            await call('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 27, key: 'Escape' });
            await new Promise(r => setTimeout(r, 200));
          }
          
        } catch (clickErr) {
          // CDP error, skip
        }
        
        // Progress every 200 elements
        if (globalIdx % 200 === 0) {
          console.log(`    Progress: ${globalIdx}/${testable.length} elements tested (${totalPassed} pass, ${totalFailed} fail)`);
        }
      }
      
      // Take batch screenshot evidence
      if (batch % 5 === 0 || batch === totalBatches - 1) {
        const scr = await call('Page.captureScreenshot', { format: 'png' });
        if (scr.result?.data) {
          const scrPath = path.join(EVIDENCE_DIR, `batch_${String(batch + 1).padStart(3, '0')}_screenshot.png`);
          fs.writeFileSync(scrPath, Buffer.from(scr.result.data, 'base64'));
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 5: FINAL REPORT
    // ═══════════════════════════════════════════════════════════
    
    console.log('\n════════════════════════════════════════════════════');
    console.log('🏁 EXHAUSTIVE DISCOVERY & TEST COMPLETE');
    console.log('════════════════════════════════════════════════════');
    console.log(`  Total Interactive Elements Discovered: ${allElements.length}`);
    console.log(`  Visible Elements: ${visibleElements.length}`);
    console.log(`  Hidden/Off-screen Elements: ${hiddenElements.length}`);
    console.log(`  Testable (visible, >=8x8, on-screen): ${testable.length}`);
    console.log(`  ✅ Passed (no exception on click): ${totalPassed}`);
    console.log(`  ❌ Failed (exception on click): ${totalFailed}`);
    console.log(`  Pass Rate: ${testable.length > 0 ? ((totalPassed / testable.length) * 100).toFixed(2) : 0}%`);
    console.log(`  Total Console Errors: ${consoleErrors.length}`);
    console.log(`  Total Runtime Exceptions: ${exceptions.length}`);
    console.log(`  Failed Elements Details: ${failedElements.length}`);
    console.log('════════════════════════════════════════════════════\n');

    // Write full report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDiscovered: allElements.length,
        visible: visibleElements.length,
        hidden: hiddenElements.length,
        testable: testable.length,
        passed: totalPassed,
        failed: totalFailed,
        passRate: testable.length > 0 ? ((totalPassed / testable.length) * 100).toFixed(2) + '%' : 'N/A',
        totalConsoleErrors: consoleErrors.length,
        totalExceptions: exceptions.length
      },
      categories: Object.fromEntries(
        Object.entries(categories).map(([k, v]) => [k, { total: v.length, visible: v.filter(e => e.visible).length }])
      ),
      failedElements: failedElements.slice(0, 100),
      consoleErrors: consoleErrors.slice(0, 50),
      allElements: allElements.slice(0, 200) // First 200 for reference
    };
    
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`Full report saved to: ${REPORT_PATH}`);

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
