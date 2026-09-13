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

    res = page.evaluate("""() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const iWin = iframe?.contentWindow;
        const tb = iWin?.lineToolPropertiesToolbar;
        if (!tb || !tb._floatingToolbar) return { error: "no tb" };

        tb._floatingToolbar.show();
        
        // Let mutation observer or direct inject run
        const doc = iframe.contentDocument;
        const toolbarEl = tb._floatingToolbar._widget;
        toolbarEl.classList.remove('i-closed', 'i-hidden');
        toolbarEl.style.display = 'flex';
        toolbarEl.style.visibility = 'visible';
        toolbarEl.style.left = '300px';
        toolbarEl.style.top = '200px';

        // Direct inject via PineEditorIDE helper
        const container = toolbarEl.querySelector('.floating-toolbar-react-widgets') || toolbarEl.querySelector('.tv-floating-toolbar__content') || toolbarEl.querySelector('.tv-floating-toolbar__widget-wrapper');
        
        let injected = false;
        if (container && !toolbarEl.querySelector('[data-name="source-code"]')) {
            const codeWidget = doc.createElement('div');
            codeWidget.className = 'tv-floating-toolbar__widget js-widget tv-floating-code-btn-wrapper';
            codeWidget.innerHTML = `
                <button type="button" class="floating-toolbar-react-widgets__button button-BuUjli6L tv-floating-code-btn" data-name="source-code" title="Source code" aria-label="Source code">
                  <span style="font-family: monospace; font-weight: 700; font-size: 15px; letter-spacing: -1px; pointer-events: none; color: inherit;">{ }</span>
                </button>
            `;
            container.appendChild(codeWidget);
            injected = true;
        }

        const codeBtn = toolbarEl.querySelector('[data-name="source-code"], .tv-floating-code-btn');

        return {
            injected,
            hasCodeBtn: !!codeBtn,
            codeBtnText: codeBtn?.textContent?.trim(),
            codeBtnTitle: codeBtn?.getAttribute('title'),
            visible: toolbarEl.offsetWidth > 0 && toolbarEl.offsetHeight > 0
        };
    }""")
    print("Floating Toolbar test result:\n", json.dumps(res, indent=2))
    browser.close()
