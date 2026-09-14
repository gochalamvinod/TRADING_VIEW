const fs = require('fs');
const path = require('path');

const rootDir = 'e:\\TRADINGVIEW ADVANCED';

// -------------------------------------------------------------
// 1. UPDATE pine_indicators.js: Authentic Study Settings Dialog
// -------------------------------------------------------------
const pineIndPath = path.join(rootDir, 'pine_indicators.js');
let indCode = fs.readFileSync(pineIndPath, 'utf8');

// Replace the openSettingsDialog function in pine_indicators.js with the complete 1:1 authentic implementation
const newOpenSettingsDialog = `  /* =========================================================================
   * 6.5. Authentic TradingView Indicator Settings Dialog (1:1 UI Match)
   * ========================================================================= */
  const TV_PALETTE_COLORS = [
    ["#ffffff", "#d1d4dc", "#b2b5be", "#9598a1", "#787b86", "#5d606b", "#434651", "#2a2e39", "#131722", "#000000"],
    ["#f23645", "#ff9800", "#ffeb3b", "#4caf50", "#00bcd4", "#2962ff", "#673ab7", "#9c27b0", "#e91e63", "#795548"],
    ["#ffcdd2", "#ffe0b2", "#fff9c4", "#c8e6c9", "#b2ebf2", "#bbdefb", "#d1c4e9", "#e1bee7", "#f8bbd0", "#d7ccc8"],
    ["#ef9a9a", "#ffcc80", "#fff59d", "#a5d6a7", "#80deea", "#90caf9", "#b39ddb", "#ce93d8", "#f48fb1", "#bcaaa4"],
    ["#e57373", "#ffb74d", "#fff176", "#81c784", "#4dd0e1", "#64b5f6", "#9575cd", "#ba68c8", "#f06292", "#a1887f"],
    ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#00acc1", "#1e88e5", "#5e35b1", "#8e24aa", "#d81b60", "#6d4c41"],
    ["#c62828", "#ef6c00", "#f9a825", "#2e7d32", "#00838f", "#1565c0", "#4527a0", "#6a1b9a", "#ad1457", "#4e342e"],
    ["#b71c1c", "#e65100", "#f57f17", "#1b5e20", "#006064", "#0d47a1", "#311b92", "#4a148c", "#880e4f", "#3e2723"]
  ];

  const PLOT_STYLE_OPTIONS = [
    { id: 'line', label: 'Line', icon: '<path d="M2 17l6-6 4 4 10-10" stroke="currentColor" stroke-width="2" fill="none"/>' },
    { id: 'line_with_breaks', label: 'Line with breaks', icon: '<path d="M2 17l4-4M10 9l3 3M17 8l5-5" stroke="currentColor" stroke-width="2" stroke-dasharray="3,2" fill="none"/>' },
    { id: 'step_line', label: 'Step line', icon: '<path d="M2 18h6v-6h6V6h8" stroke="currentColor" stroke-width="2" fill="none"/>' },
    { id: 'step_line_with_breaks', label: 'Step line with breaks', icon: '<path d="M2 18h4v-6h4V6h4" stroke="currentColor" stroke-width="2" stroke-dasharray="2,2" fill="none"/>' },
    { id: 'step_line_with_diamonds', label: 'Step line with diamonds', icon: '<path d="M2 18h6v-6h6V6h8" stroke="currentColor" stroke-width="1.5" fill="none"/><polygon points="8,12 10,10 8,8 6,10" fill="currentColor"/>' },
    { id: 'histogram', label: 'Histogram', icon: '<rect x="4" y="10" width="3" height="10" fill="currentColor"/><rect x="10" y="5" width="3" height="15" fill="currentColor"/><rect x="16" y="12" width="3" height="8" fill="currentColor"/>' },
    { id: 'cross', label: 'Cross', icon: '<path d="M6 6l4 4m0-4l-4 4M14 14l4 4m0-4l-4 4" stroke="currentColor" stroke-width="2"/>' },
    { id: 'area', label: 'Area', icon: '<path d="M2 18l6-8 5 5 9-9v12H2z" fill="currentColor" opacity="0.4"/><path d="M2 18l6-8 5 5 9-9" stroke="currentColor" stroke-width="2" fill="none"/>' },
    { id: 'area_with_breaks', label: 'Area with breaks', icon: '<path d="M2 18l5-6v6zm8 0l4-5v5zm7 0l5-6v6z" fill="currentColor" opacity="0.4"/>' },
    { id: 'columns', label: 'Columns', icon: '<rect x="3" y="8" width="4" height="12" fill="currentColor"/><rect x="10" y="4" width="4" height="16" fill="currentColor"/><rect x="17" y="11" width="4" height="9" fill="currentColor"/>' },
    { id: 'circles', label: 'Circles', icon: '<circle cx="6" cy="14" r="2.5" fill="currentColor"/><circle cx="12" cy="7" r="2.5" fill="currentColor"/><circle cx="18" cy="11" r="2.5" fill="currentColor"/>' }
  ];

  function openSettingsDialog(studyId, chartInstance) {
    const chart = chartInstance || (root.widget && typeof root.widget.activeChart === 'function' ? root.widget.activeChart() : null);
    if (chart && typeof hookChartSettings === 'function') hookChartSettings(chart);

    // 1. Resolve studyId / source object
    let actualStudyId = studyId;
    if (studyId && typeof studyId === 'object') {
      actualStudyId = typeof studyId.id === 'function' ? studyId.id() : (studyId._id || studyId.id || studyId.name);
    }

    // 2. Locate studyObj
    let studyObj = null;
    if (actualStudyId) {
      studyObj = _registeredStudies.get(actualStudyId);
      if (!studyObj) {
        const alias = _studyAliases.get(actualStudyId);
        if (alias) {
          if (typeof alias === 'string') {
            studyObj = _registeredStudies.get(alias);
          } else if (alias.forEach) {
            for (const a of alias) {
              studyObj = _registeredStudies.get(a);
              if (studyObj) break;
            }
          }
        }
      }
      if (!studyObj) {
        for (const s of _registeredStudies.values()) {
          if (s && s.metainfo && (s.metainfo.id === actualStudyId || s.name === actualStudyId || s.metainfo.description === actualStudyId)) {
            studyObj = s;
            break;
          }
        }
      }
    }

    // Check chart studies & model
    if (!studyObj && chart) {
      try {
        const allStudies = chart.getAllStudies ? chart.getAllStudies() : [];
        const match = allStudies.find(s => s && (s.id === actualStudyId || s.name === actualStudyId));
        if (match) {
          const matchName = match.name || match.description;
          for (const s of _registeredStudies.values()) {
            if (s && (s.name === matchName || (s.metainfo && (s.metainfo.id === matchName || s.metainfo.description === matchName)) || matchName.includes(s.name) || s.name.includes(matchName))) {
              studyObj = s;
              break;
            }
          }
        }

        const model = chart._chartWidget?._model?.model() || chart.model?.();
        if (!studyObj && model) {
          const allSources = [];
          if (typeof model.panes === 'function') {
            model.panes().forEach(p => {
              if (typeof p.dataSources === 'function') allSources.push(...p.dataSources());
            });
          }
          if (typeof model.priceDataSources === 'function') allSources.push(...model.priceDataSources());
          const src = allSources.find(s => {
            const sid = typeof s.id === 'function' ? s.id() : (s._id || s.id);
            return sid === actualStudyId;
          });
          if (src) {
            const sName = typeof src.name === 'function' ? src.name() : (src._name || '');
            const mId = src._metaInfo?.id;
            for (const s of _registeredStudies.values()) {
              if (s && (s.name === sName || (mId && s.metainfo && s.metainfo.id === mId) || (s.name && sName.includes(s.name)))) {
                studyObj = s;
                break;
              }
            }
          }
        }
      } catch (e) {}
    }

    // Check custom pine studies
    if (!studyObj && root._customPineStudies && root._customPineStudies.length > 0) {
      studyObj = root._customPineStudies.find(s => s && (s.name === actualStudyId || (s.metainfo && s.metainfo.id === actualStudyId))) || root._customPineStudies[root._customPineStudies.length - 1];
    }

    // If still null, check if current editor script matches
    if (!studyObj && root.PineEditorIDE && typeof root.PineEditorIDE.getCurrentScript === 'function') {
      const cur = root.PineEditorIDE.getCurrentScript();
      if (cur && (cur.id === actualStudyId || cur.name === actualStudyId || (actualStudyId && actualStudyId.includes(cur.name)))) {
        studyObj = {
          name: cur.name,
          code: cur.code,
          metainfo: {
            description: cur.name,
            name: cur.name,
            id: cur.id,
            inputs: [],
            plots: [{ id: 'plot_0', type: 'line' }],
            styles: { plot_0: { title: cur.name } },
            defaults: { styles: { plot_0: { color: '#2962ff', linewidth: 1, plottype: 'line' } } }
          }
        };
      }
    }

    // Fallback: create dynamic descriptor from chart study name
    if (!studyObj) {
      let displayName = actualStudyId || 'Custom Indicator';
      if (chart && chart.getAllStudies) {
        const s = chart.getAllStudies().find(x => x.id === actualStudyId);
        if (s && s.name) displayName = s.name;
      }
      studyObj = {
        name: displayName,
        metainfo: {
          description: displayName,
          name: displayName,
          id: actualStudyId || 'study_custom',
          inputs: [],
          plots: [
            { id: 'plot_0', type: 'line', title: 'Upper' },
            { id: 'plot_1', type: 'line', title: 'Lower' }
          ],
          styles: {
            plot_0: { title: 'Upper', color: '#ff9800', linewidth: 1, plottype: 'line' },
            plot_1: { title: 'Lower', color: '#2962ff', linewidth: 1, plottype: 'line' }
          },
          defaults: {
            styles: {
              plot_0: { color: '#ff9800', linewidth: 1, plottype: 'line', visible: true },
              plot_1: { color: '#2962ff', linewidth: 1, plottype: 'line', visible: true }
            }
          }
        }
      };
    }

    // Extract plots dynamically if Pine code is available
    if (studyObj && studyObj.code) {
      const pMatches = Array.from(studyObj.code.matchAll(/plot(?:shape|char|bar)?\\s*\\([^,]+?,\\s*["']([^"']+)["']/g));
      if (pMatches.length > 0) {
        studyObj.metainfo.plots = studyObj.metainfo.plots || [];
        studyObj.metainfo.styles = studyObj.metainfo.styles || {};
        studyObj.metainfo.defaults = studyObj.metainfo.defaults || { styles: {} };
        pMatches.forEach((m, pIdx) => {
          const pId = 'plot_' + pIdx;
          const pTitle = m[1];
          if (!studyObj.metainfo.plots.some(p => p.id === pId)) {
            studyObj.metainfo.plots.push({ id: pId, type: 'line' });
          }
          studyObj.metainfo.styles[pId] = studyObj.metainfo.styles[pId] || { title: pTitle };
          studyObj.metainfo.defaults.styles[pId] = studyObj.metainfo.defaults.styles[pId] || {
            color: pIdx === 0 ? '#ff9800' : '#2962ff',
            linewidth: 1,
            plottype: 'line',
            visible: true
          };
        });
      }
    }

    // Remove any existing overlay
    const existing = document.getElementById('tv_settings_modal_overlay');
    if (existing) existing.remove();

    const title = studyObj.metainfo.description || studyObj.metainfo.name || studyObj.name || 'Indicator Settings';
    const inputs = studyObj.metainfo.inputs || [];

    const currentValues = {};
    inputs.forEach(inp => {
      currentValues[inp.id] = inp.defval !== undefined ? inp.defval : '';
    });

    // Style & Visibility state
    const plots = (studyObj.metainfo.plots && studyObj.metainfo.plots.length > 0) ? studyObj.metainfo.plots : [
      { id: 'plot_0', type: 'line' },
      { id: 'plot_1', type: 'line' }
    ];
    const styles = studyObj.metainfo.styles || {};
    const defaultStyles = (studyObj.metainfo.defaults && studyObj.metainfo.defaults.styles) || {};

    const styleState = {};
    plots.forEach((p, idx) => {
      const def = defaultStyles[p.id] || {};
      const st = styles[p.id] || {};
      styleState[p.id] = {
        visible: def.visible !== false,
        title: st.title || p.title || (idx === 0 ? 'Upper' : (idx === 1 ? 'Lower' : ('Plot ' + (idx + 1)))),
        color: def.color || (idx === 0 ? '#ff9800' : '#2962ff'),
        opacity: def.transparency ? (100 - def.transparency) : 100,
        thickness: def.linewidth || 1,
        plotType: def.plottype || 'line',
        priceLine: def.trackPrice || false
      };
    });

    const visibilityState = {
      ticks: true,
      seconds: { enabled: true, min: 1, max: 59 },
      minutes: { enabled: true, min: 1, max: 59 },
      hours: { enabled: true, min: 1, max: 24 },
      days: { enabled: true, min: 1, max: 366 },
      weeks: { enabled: true, min: 1, max: 52 },
      months: { enabled: true, min: 1, max: 12 }
    };

    let precisionVal = 'Default';
    let labelsOnPriceScale = true;
    let valuesInStatusLine = true;

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'tv_settings_modal_overlay';
    overlay.className = 'tv-settings-overlay';
    overlay.style.cssText = \`
      position: fixed; inset: 0; z-index: 250000;
      background: rgba(0, 0, 0, 0.65);
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif;
      user-select: none; -webkit-font-smoothing: antialiased;
      backdrop-filter: blur(2px);
    \`;

    // Modal dialog
    const modal = document.createElement('div');
    modal.className = 'tv-settings-dialog';
    modal.style.cssText = \`
      background: #1e222d; color: #d1d4dc;
      border: 1px solid #2a2e39; border-radius: 6px;
      width: 480px; max-width: 95vw; max-height: 88vh;
      display: flex; flex-direction: column;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
      position: relative; overflow: visible; z-index: 250001;
    \`;

    // Header
    const header = document.createElement('div');
    header.style.cssText = \`
      height: 48px; min-height: 48px; padding: 0 18px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid #2a2e39;
    \`;
    header.innerHTML = \`
      <div style="font-size: 16px; font-weight: 600; color: #d1d4dc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        \${escapeHtml(title)}
      </div>
      <button type="button" id="tv_settings_close_btn" style="
        background: transparent; border: none; color: #787b86;
        cursor: pointer; padding: 6px; display: flex; align-items: center;
        justify-content: center; border-radius: 4px; font-size: 18px; line-height: 1;
      " title="Close">&times;</button>
    \`;

    // Tabs Bar: Inputs, Style, Visibility
    const hasInputs = inputs && inputs.length > 0;
    let currentTab = hasInputs ? 'inputs' : 'style';

    const tabsBar = document.createElement('div');
    tabsBar.style.cssText = \`
      height: 40px; min-height: 40px; padding: 0 18px;
      display: flex; align-items: center; gap: 24px;
      border-bottom: 1px solid #2a2e39; position: relative;
    \`;
    tabsBar.innerHTML = \`
      \${hasInputs ? \`<div class="tv-settings-tab \${currentTab === 'inputs' ? 'active' : ''}" data-tab="inputs" style="font-size: 14px; font-weight: \${currentTab === 'inputs' ? '600' : '500'}; color: \${currentTab === 'inputs' ? '#ffffff' : '#787b86'}; border-bottom: \${currentTab === 'inputs' ? '2px solid #ffffff' : '2px solid transparent'}; height: 100%; display: flex; align-items: center; cursor: pointer;">Inputs</div>\` : ''}
      <div class="tv-settings-tab \${currentTab === 'style' ? 'active' : ''}" data-tab="style" style="font-size: 14px; font-weight: \${currentTab === 'style' ? '600' : '500'}; color: \${currentTab === 'style' ? '#ffffff' : '#787b86'}; border-bottom: \${currentTab === 'style' ? '2px solid #ffffff' : '2px solid transparent'}; height: 100%; display: flex; align-items: center; cursor: pointer;">Style</div>
      <div class="tv-settings-tab \${currentTab === 'visibility' ? 'active' : ''}" data-tab="visibility" style="font-size: 14px; font-weight: \${currentTab === 'visibility' ? '600' : '500'}; color: \${currentTab === 'visibility' ? '#ffffff' : '#787b86'}; border-bottom: \${currentTab === 'visibility' ? '2px solid #ffffff' : '2px solid transparent'}; height: 100%; display: flex; align-items: center; cursor: pointer;">Visibility</div>
    \`;

    // Body
    const body = document.createElement('div');
    body.className = 'tv-settings-tab-content';
    body.style.cssText = \`
      padding: 16px 20px 20px; overflow-y: auto; flex: 1; min-height: 240px;
    \`;

    // -------------------------------------------------------------
    // TAB 1: Inputs Tab
    // -------------------------------------------------------------
    function renderInputsTab() {
      if (!inputs || inputs.length === 0) {
        return \`<div style="color: #787b86; font-size: 13px; text-align: center; padding: 40px 0;">This indicator has no user-configurable inputs.</div>\`;
      }
      let html = '<div style="display: flex; flex-direction: column; gap: 14px;">';
      inputs.forEach(inp => {
        const val = currentValues[inp.id] !== undefined ? currentValues[inp.id] : inp.defval;
        if (inp.type === 'bool') {
          html += \`
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: #d1d4dc;">
              <input type="checkbox" class="tv-input-field" data-input-id="\${escapeHtml(inp.id)}" \${val ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2962ff; cursor: pointer;">
              <span>\${escapeHtml(inp.name || inp.id)}</span>
            </label>
          \`;
        } else if (inp.options && Array.isArray(inp.options)) {
          html += \`
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <span style="font-size: 13px; color: #d1d4dc;">\${escapeHtml(inp.name || inp.id)}</span>
              <select class="tv-input-field" data-input-id="\${escapeHtml(inp.id)}" style="background: #131722; border: 1px solid #363a45; color: #d1d4dc; border-radius: 4px; padding: 6px 10px; font-size: 13px; outline: none; width: 140px;">
                \${inp.options.map(opt => \`<option value="\${escapeHtml(opt)}" \${String(val) === String(opt) ? 'selected' : ''}>\${escapeHtml(opt)}</option>\`).join('')}
              </select>
            </div>
          \`;
        } else if (inp.type === 'integer' || inp.type === 'float') {
          html += \`
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <span style="font-size: 13px; color: #d1d4dc;">\${escapeHtml(inp.name || inp.id)}</span>
              <input type="number" class="tv-input-field" data-input-id="\${escapeHtml(inp.id)}" step="\${inp.step || (inp.type === 'float' ? '0.1' : '1')}" \${inp.min !== undefined ? \`min="\${inp.min}"\` : ''} \${inp.max !== undefined ? \`max="\${inp.max}"\` : ''} value="\${val}" style="background: #131722; border: 1px solid #363a45; color: #d1d4dc; border-radius: 4px; padding: 6px 10px; font-size: 13px; outline: none; width: 90px;">
            </div>
          \`;
        } else {
          html += \`
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <span style="font-size: 13px; color: #d1d4dc;">\${escapeHtml(inp.name || inp.id)}</span>
              <input type="text" class="tv-input-field" data-input-id="\${escapeHtml(inp.id)}" value="\${escapeHtml(String(val || ''))}" style="background: #131722; border: 1px solid #363a45; color: #d1d4dc; border-radius: 4px; padding: 6px 10px; font-size: 13px; outline: none; width: 140px;">
            </div>
          \`;
        }
      });
      html += '</div>';
      return html;
    }

    // -------------------------------------------------------------
    // TAB 2: Style Tab (Image 2, 3, 4)
    // -------------------------------------------------------------
    function renderStyleTab() {
      let html = '<div style="display: flex; flex-direction: column; gap: 14px;">';

      // 1. Plots list
      plots.forEach(p => {
        const st = styleState[p.id];
        const selectedPlotStyle = PLOT_STYLE_OPTIONS.find(opt => opt.id === st.plotType) || PLOT_STYLE_OPTIONS[0];

        html += \`
          <div class="tv-style-plot-row" data-plot-id="\${escapeHtml(p.id)}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; position: relative;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: #d1d4dc;">
              <input type="checkbox" class="tv-plot-visibility" data-plot-id="\${escapeHtml(p.id)}" \${st.visible ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2962ff; cursor: pointer;">
              <span>\${escapeHtml(st.title)}</span>
            </label>

            <div style="display: flex; align-items: center; gap: 8px;">
              <!-- Color swatch button with line segment preview (Image 2) -->
              <button type="button" class="tv-color-swatch-btn" data-plot-id="\${escapeHtml(p.id)}" style="
                background: #131722; border: 1px solid #363a45; border-radius: 4px;
                height: 28px; width: 56px; padding: 0 4px; display: flex; align-items: center; justify-content: space-between;
                cursor: pointer; position: relative;
              ">
                <span class="tv-color-box" style="width: 18px; height: 18px; border-radius: 2px; background: \${st.color}; opacity: \${st.opacity / 100}; display: inline-block;"></span>
                <span class="tv-color-line-preview" style="width: 22px; height: 0; border-bottom: \${st.thickness}px solid \${st.color}; opacity: \${st.opacity / 100}; display: inline-block;"></span>
              </button>

              <!-- Plot Style button (wave / line icon) (Image 2) -->
              <button type="button" class="tv-plot-style-btn" data-plot-id="\${escapeHtml(p.id)}" style="
                background: #131722; border: 1px solid #363a45; border-radius: 4px;
                width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
                color: #d1d4dc; cursor: pointer;
              ">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  \${selectedPlotStyle.icon}
                </svg>
              </button>
            </div>
          </div>
        \`;
      });

      // 2. OUTPUTS Section
      html += \`
        <div style="margin-top: 18px; margin-bottom: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #787b86;">
          OUTPUTS
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 13px; color: #d1d4dc;">Precision</span>
          <select id="tv_precision_select" style="background: #131722; border: 1px solid #363a45; color: #d1d4dc; border-radius: 4px; padding: 6px 10px; font-size: 13px; outline: none; width: 140px; cursor: pointer;">
            <option value="Default" \${precisionVal === 'Default' ? 'selected' : ''}>Default</option>
            \${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => \`<option value="\${n}" \${String(precisionVal) === String(n) ? 'selected' : ''}>\${n}</option>\`).join('')}
          </select>
        </div>

        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: #d1d4dc;">
          <input type="checkbox" id="tv_labels_price_scale" \${labelsOnPriceScale ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2962ff; cursor: pointer;">
          <span>Labels on price scale</span>
        </label>

        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: #d1d4dc;">
          <input type="checkbox" id="tv_values_status_line" \${valuesInStatusLine ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2962ff; cursor: pointer;">
          <span>Values in status line</span>
        </label>
      \`;

      html += '</div>';
      return html;
    }

    // -------------------------------------------------------------
    // TAB 3: Visibility Tab (Image 1)
    // -------------------------------------------------------------
    function renderVisibilityTab() {
      const rows = [
        { key: 'seconds', label: 'Seconds', minVal: 1, maxVal: 59 },
        { key: 'minutes', label: 'Minutes', minVal: 1, maxVal: 59 },
        { key: 'hours', label: 'Hours', minVal: 1, maxVal: 24 },
        { key: 'days', label: 'Days', minVal: 1, maxVal: 366 },
        { key: 'weeks', label: 'Weeks', minVal: 1, maxVal: 52 },
        { key: 'months', label: 'Months', minVal: 1, maxVal: 12 }
      ];

      let html = '<div style="display: flex; flex-direction: column; gap: 14px;">';

      // Ticks checkbox (Image 1)
      html += \`
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: #d1d4dc;">
          <input type="checkbox" id="tv_vis_ticks" \${visibilityState.ticks ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2962ff; cursor: pointer;">
          <span>Ticks</span>
        </label>
      \`;

      // Timeframe rows with sliders (Image 1)
      rows.forEach(r => {
        const state = visibilityState[r.key];
        html += \`
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: #d1d4dc; width: 90px; flex-shrink: 0;">
              <input type="checkbox" class="tv-vis-check" data-vis-key="\${r.key}" \${state.enabled ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2962ff; cursor: pointer;">
              <span>\${r.label}</span>
            </label>

            <div style="display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end;">
              <input type="number" class="tv-vis-min" data-vis-key="\${r.key}" value="\${state.min}" min="1" max="\${r.maxVal}" style="background: #131722; border: 1px solid #363a45; color: #d1d4dc; border-radius: 4px; padding: 4px 8px; font-size: 13px; width: 55px; height: 32px; outline: none; text-align: center;">

              <!-- Visual dual-range track (Image 1) -->
              <div style="flex: 1; max-width: 120px; height: 4px; background: #363a45; border-radius: 2px; position: relative; display: flex; align-items: center;">
                <div style="position: absolute; left: 0; right: 0; height: 4px; background: #b2b5be; border-radius: 2px;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #ffffff; border: 2px solid #131722; position: absolute; left: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.5);"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #ffffff; border: 2px solid #131722; position: absolute; right: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.5);"></div>
              </div>

              <input type="number" class="tv-vis-max" data-vis-key="\${r.key}" value="\${state.max}" min="1" max="\${r.maxVal}" style="background: #131722; border: 1px solid #363a45; color: #d1d4dc; border-radius: 4px; padding: 4px 8px; font-size: 13px; width: 55px; height: 32px; outline: none; text-align: center;">
            </div>
          </div>
        \`;
      });

      html += '</div>';
      return html;
    }

    // -------------------------------------------------------------
    // Popovers: Color Picker Popover (Image 4) & Plot Style Popover (Image 3)
    // -------------------------------------------------------------
    let activePopover = null;
    function closePopover() {
      if (activePopover) {
        activePopover.remove();
        activePopover = null;
      }
    }

    function openColorPicker(btn, plotId) {
      closePopover();
      const st = styleState[plotId];
      const popover = document.createElement('div');
      popover.className = 'tv-color-picker-popover';
      popover.style.cssText = \`
        position: fixed; z-index: 300000;
        background: #1e222d; border: 1px solid #2a2e39; border-radius: 6px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.75); padding: 14px; width: 260px;
        color: #d1d4dc; font-family: inherit; font-size: 12px;
      \`;

      const rect = btn.getBoundingClientRect();
      let top = rect.bottom + 6;
      let left = rect.left - 100;
      if (left + 260 > window.innerWidth) left = window.innerWidth - 270;
      if (top + 320 > window.innerHeight) top = rect.top - 326;
      popover.style.top = Math.max(10, top) + 'px';
      popover.style.left = Math.max(10, left) + 'px';

      // 80 Colors Palette (Image 4)
      let paletteHtml = '<div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; margin-bottom: 12px;">';
      TV_PALETTE_COLORS.forEach(row => {
        row.forEach(c => {
          const isSelected = (st.color.toLowerCase() === c.toLowerCase());
          paletteHtml += \`
            <div class="tv-palette-cell" data-color="\${c}" style="
              width: 18px; height: 18px; background: \${c}; border-radius: 2px;
              cursor: pointer; box-sizing: border-box;
              border: \${isSelected ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.2)'};
            " title="\${c}"></div>
          \`;
        });
      });
      paletteHtml += '</div>';

      popover.innerHTML = \`
        \${paletteHtml}

        <!-- Custom Color [+] -->
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
          <label style="
            width: 22px; height: 22px; border: 1px solid #363a45; border-radius: 4px;
            display: flex; align-items: center; justify-content: center; cursor: pointer;
            color: #787b86; font-size: 16px; font-weight: 600; line-height: 1;
          " title="Custom color">
            +
            <input type="color" id="tv_custom_color_native" value="\${st.color}" style="position: absolute; opacity: 0; width: 0; height: 0;">
          </label>
        </div>

        <!-- Opacity Slider (Image 4) -->
        <div style="margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #787b86; margin-bottom: 6px;">
            <span>Opacity</span>
            <span id="tv_opacity_val">\${st.opacity}%</span>
          </div>
          <input type="range" id="tv_opacity_range" min="0" max="100" value="\${st.opacity}" style="
            width: 100%; -webkit-appearance: none; height: 6px; border-radius: 3px; outline: none; cursor: pointer;
            background: linear-gradient(to right, transparent, \${st.color});
          ">
        </div>

        <!-- Thickness Segmented Buttons (Image 4) -->
        <div>
          <div style="font-size: 11px; color: #787b86; margin-bottom: 6px;">Thickness</div>
          <div style="display: flex; border: 1px solid #363a45; border-radius: 4px; overflow: hidden; background: #131722;">
            \${[1, 2, 3, 4].map(th => \`
              <button type="button" class="tv-thick-btn" data-thick="\${th}" style="
                flex: 1; height: 28px; background: \${st.thickness === th ? '#2a2e39' : 'transparent'};
                border: none; border-right: \${th < 4 ? '1px solid #363a45' : 'none'};
                display: flex; align-items: center; justify-content: center; cursor: pointer;
              ">
                <span style="width: 20px; border-bottom: \${th}px solid #ffffff; display: inline-block;"></span>
              </button>
            \`).join('')}
          </div>
        </div>
      \`;

      document.body.appendChild(popover);
      activePopover = popover;

      // Event handlers
      popover.querySelectorAll('.tv-palette-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          st.color = cell.dataset.color;
          updateSwatchButton(btn, st);
          closePopover();
        });
      });

      const nativeColor = popover.querySelector('#tv_custom_color_native');
      nativeColor?.addEventListener('input', (e) => {
        st.color = e.target.value;
        updateSwatchButton(btn, st);
      });

      const opRange = popover.querySelector('#tv_opacity_range');
      const opText = popover.querySelector('#tv_opacity_val');
      opRange?.addEventListener('input', (e) => {
        st.opacity = parseInt(e.target.value, 10);
        if (opText) opText.textContent = st.opacity + '%';
        updateSwatchButton(btn, st);
      });

      popover.querySelectorAll('.tv-thick-btn').forEach(thBtn => {
        thBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          st.thickness = parseInt(thBtn.dataset.thick, 10);
          updateSwatchButton(btn, st);
          closePopover();
        });
      });
    }

    function openPlotStyleMenu(btn, plotId) {
      closePopover();
      const st = styleState[plotId];
      const popover = document.createElement('div');
      popover.className = 'tv-plot-style-popover';
      popover.style.cssText = \`
        position: fixed; z-index: 300000;
        background: #1e222d; border: 1px solid #2a2e39; border-radius: 6px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.75); padding: 6px 0; width: 220px;
        color: #d1d4dc; font-family: inherit; font-size: 13px; max-height: 380px; overflow-y: auto;
      \`;

      const rect = btn.getBoundingClientRect();
      let top = rect.bottom + 6;
      let left = rect.left - 100;
      if (left + 220 > window.innerWidth) left = window.innerWidth - 230;
      if (top + 360 > window.innerHeight) top = rect.top - 366;
      popover.style.top = Math.max(10, top) + 'px';
      popover.style.left = Math.max(10, left) + 'px';

      let menuHtml = \`
        <!-- Price line switch (Image 3) -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; cursor: pointer;" id="tv_price_line_row">
          <span style="font-size: 13px; color: #d1d4dc;">Price line</span>
          <div style="
            width: 34px; height: 18px; border-radius: 9px;
            background: \${st.priceLine ? '#2962ff' : '#363a45'};
            position: relative; transition: background 0.15s;
          ">
            <div style="
              width: 14px; height: 14px; border-radius: 7px; background: #ffffff;
              position: absolute; top: 2px; left: \${st.priceLine ? '18px' : '2px'}; transition: left 0.15s;
            "></div>
          </div>
        </div>

        <div style="border-bottom: 1px solid #2a2e39; margin: 4px 0;"></div>
      \`;

      PLOT_STYLE_OPTIONS.forEach(opt => {
        const isSelected = st.plotType === opt.id;
        menuHtml += \`
          <div class="tv-plot-style-opt" data-opt-id="\${opt.id}" style="
            display: flex; align-items: center; gap: 10px; padding: 8px 14px;
            cursor: pointer; background: \${isSelected ? 'rgba(41,98,255,0.12)' : 'transparent'};
            color: \${isSelected ? '#2962ff' : '#d1d4dc'};
            transition: background 0.1s;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink: 0;">
              \${opt.icon}
            </svg>
            <span style="font-size: 13px;">\${opt.label}</span>
          </div>
        \`;
      });

      popover.innerHTML = menuHtml;
      document.body.appendChild(popover);
      activePopover = popover;

      popover.querySelector('#tv_price_line_row')?.addEventListener('click', (e) => {
        e.stopPropagation();
        st.priceLine = !st.priceLine;
        openPlotStyleMenu(btn, plotId);
      });

      popover.querySelectorAll('.tv-plot-style-opt').forEach(optEl => {
        optEl.addEventListener('mouseenter', () => {
          optEl.style.background = 'rgba(255,255,255,0.06)';
        });
        optEl.addEventListener('mouseleave', () => {
          optEl.style.background = (st.plotType === optEl.dataset.optId) ? 'rgba(41,98,255,0.12)' : 'transparent';
        });
        optEl.addEventListener('click', (e) => {
          e.stopPropagation();
          st.plotType = optEl.dataset.optId;
          const optMatch = PLOT_STYLE_OPTIONS.find(x => x.id === st.plotType);
          if (optMatch) {
            btn.innerHTML = \`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">\${optMatch.icon}</svg>\`;
          }
          closePopover();
        });
      });
    }

    function updateSwatchButton(btn, st) {
      const box = btn.querySelector('.tv-color-box');
      const line = btn.querySelector('.tv-color-line-preview');
      if (box) {
        box.style.background = st.color;
        box.style.opacity = String(st.opacity / 100);
      }
      if (line) {
        line.style.borderBottom = \`\${st.thickness}px solid \${st.color}\`;
        line.style.opacity = String(st.opacity / 100);
      }
    }

    // Attach listeners for tab content
    function attachTabEvents() {
      // Style tab events
      body.querySelectorAll('.tv-color-swatch-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openColorPicker(btn, btn.dataset.plotId);
        });
      });

      body.querySelectorAll('.tv-plot-style-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openPlotStyleMenu(btn, btn.dataset.plotId);
        });
      });

      body.querySelectorAll('.tv-plot-visibility').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const st = styleState[chk.dataset.plotId];
          if (st) st.visible = e.target.checked;
        });
      });

      const precSel = body.querySelector('#tv_precision_select');
      precSel?.addEventListener('change', (e) => {
        precisionVal = e.target.value;
      });

      const lblCheck = body.querySelector('#tv_labels_price_scale');
      lblCheck?.addEventListener('change', (e) => {
        labelsOnPriceScale = e.target.checked;
      });

      const valCheck = body.querySelector('#tv_values_status_line');
      valCheck?.addEventListener('change', (e) => {
        valuesInStatusLine = e.target.checked;
      });

      // Visibility tab events
      const ticksChk = body.querySelector('#tv_vis_ticks');
      ticksChk?.addEventListener('change', (e) => {
        visibilityState.ticks = e.target.checked;
      });

      body.querySelectorAll('.tv-vis-check').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const key = chk.dataset.visKey;
          if (visibilityState[key]) visibilityState[key].enabled = e.target.checked;
        });
      });

      body.querySelectorAll('.tv-vis-min').forEach(minInp => {
        minInp.addEventListener('change', (e) => {
          const key = minInp.dataset.visKey;
          if (visibilityState[key]) visibilityState[key].min = parseInt(e.target.value, 10) || 1;
        });
      });

      body.querySelectorAll('.tv-vis-max').forEach(maxInp => {
        maxInp.addEventListener('change', (e) => {
          const key = maxInp.dataset.visKey;
          if (visibilityState[key]) visibilityState[key].max = parseInt(e.target.value, 10) || 59;
        });
      });
    }

    function switchTab(newTab) {
      currentTab = newTab;
      closePopover();
      tabsBar.querySelectorAll('.tv-settings-tab').forEach(t => {
        const isAct = t.dataset.tab === newTab;
        t.style.fontWeight = isAct ? '600' : '500';
        t.style.color = isAct ? '#ffffff' : '#787b86';
        t.style.borderBottom = isAct ? '2px solid #ffffff' : '2px solid transparent';
      });

      if (newTab === 'inputs') {
        body.innerHTML = renderInputsTab();
      } else if (newTab === 'style') {
        body.innerHTML = renderStyleTab();
      } else if (newTab === 'visibility') {
        body.innerHTML = renderVisibilityTab();
      }
      attachTabEvents();
    }

    // Initial render
    switchTab(currentTab);

    // Tab clicks
    tabsBar.querySelectorAll('.tv-settings-tab').forEach(tabEl => {
      tabEl.addEventListener('click', () => {
        switchTab(tabEl.dataset.tab);
      });
    });

    // Footer: Defaults dropdown, Cancel, Ok buttons
    const footer = document.createElement('div');
    footer.style.cssText = \`
      height: 52px; min-height: 52px; padding: 0 18px;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid #2a2e39; background: #1e222d;
    \`;
    footer.innerHTML = \`
      <div style="position: relative;">
        <button type="button" id="tv_settings_defaults_btn" style="
          background: transparent; border: none; color: #787b86;
          font-size: 13px; cursor: pointer; padding: 6px 10px;
          border-radius: 4px; display: flex; align-items: center; gap: 6px;
        ">
          <span>Defaults</span>
          <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor"><path d="M0 0l4 4 4-4z"/></svg>
        </button>
        <div id="tv_settings_defaults_menu" style="
          display: none; position: absolute; bottom: 100%; left: 0;
          margin-bottom: 6px; background: #1e222d; border: 1px solid #2a2e39;
          border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); width: 150px;
          z-index: 10000; overflow: hidden;
        ">
          <div class="tv-def-item" id="tv_defaults_reset" style="padding: 8px 12px; font-size: 12px; color: #d1d4dc; cursor: pointer;">Reset settings</div>
          <div class="tv-def-item" id="tv_defaults_save" style="padding: 8px 12px; font-size: 12px; color: #d1d4dc; cursor: pointer; border-top: 1px solid #2a2e39;">Save as default</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button type="button" id="tv_settings_cancel_btn" style="
          background: transparent; border: 1px solid #363a45; color: #d1d4dc;
          font-size: 13px; font-weight: 500; padding: 6px 16px; border-radius: 4px; cursor: pointer;
        ">Cancel</button>
        <button type="button" id="tv_settings_ok_btn" style="
          background: #2962ff; border: none; color: #ffffff;
          font-size: 13px; font-weight: 600; padding: 6px 20px; border-radius: 4px; cursor: pointer;
        ">Ok</button>
      </div>
    \`;

    modal.appendChild(header);
    modal.appendChild(tabsBar);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeDialog = () => {
      closePopover();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onOutsideClick);
      overlay.remove();
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeDialog();
    };
    const onOutsideClick = (e) => {
      if (activePopover && !activePopover.contains(e.target) && !e.target.closest('.tv-color-swatch-btn') && !e.target.closest('.tv-plot-style-btn')) {
        closePopover();
      }
      const defMenu = footer.querySelector('#tv_settings_defaults_menu');
      if (defMenu && defMenu.style.display === 'block' && !e.target.closest('#tv_settings_defaults_btn')) {
        defMenu.style.display = 'none';
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onOutsideClick);

    header.querySelector('#tv_settings_close_btn').addEventListener('click', closeDialog);
    footer.querySelector('#tv_settings_cancel_btn').addEventListener('click', closeDialog);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog();
    });

    // Defaults dropdown
    const defBtn = footer.querySelector('#tv_settings_defaults_btn');
    const defMenu = footer.querySelector('#tv_settings_defaults_menu');
    defBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      defMenu.style.display = defMenu.style.display === 'block' ? 'none' : 'block';
    });

    footer.querySelector('#tv_defaults_reset')?.addEventListener('click', () => {
      inputs.forEach(inp => { currentValues[inp.id] = inp.defval !== undefined ? inp.defval : ''; });
      switchTab(currentTab);
      defMenu.style.display = 'none';
    });
    footer.querySelector('#tv_defaults_save')?.addEventListener('click', () => {
      try {
        localStorage.setItem('tv_indicator_defaults_' + (studyObj.metainfo.id || title), JSON.stringify({ currentValues, styleState }));
      } catch(e) {}
      defMenu.style.display = 'none';
    });

    // Apply values on OK
    footer.querySelector('#tv_settings_ok_btn').addEventListener('click', () => {
      // Collect inputs
      body.querySelectorAll('.tv-input-field').forEach(field => {
        const id = field.getAttribute('data-input-id');
        if (!id) return;
        if (field.type === 'checkbox') currentValues[id] = field.checked;
        else if (field.type === 'number') currentValues[id] = parseFloat(field.value) || 0;
        else currentValues[id] = field.value;
      });

      closeDialog();

      // Apply to active chart study properties in TradingView
      try {
        if (chart) {
          const model = chart._chartWidget?._model?.model() || chart.model?.();
          if (model) {
            const allSources = [];
            if (typeof model.panes === 'function') {
              model.panes().forEach(p => { if (typeof p.dataSources === 'function') allSources.push(...p.dataSources()); });
            }
            if (typeof model.priceDataSources === 'function') allSources.push(...model.priceDataSources());
            const src = allSources.find(s => {
              const sid = typeof s.id === 'function' ? s.id() : (s._id || s.id);
              return sid === actualStudyId || (s._metaInfo && s._metaInfo.id === studyObj.metainfo.id) || (typeof s.name === 'function' && s.name().includes(studyObj.name));
            });

            if (src && src.properties) {
              const pChilds = src.properties().childs();
              if (pChilds.inputs) {
                Object.keys(currentValues).forEach(k => {
                  const ch = pChilds.inputs.child(k);
                  if (ch && typeof ch.setValue === 'function') ch.setValue(currentValues[k]);
                });
              }
              if (pChilds.styles) {
                Object.keys(styleState).forEach(pid => {
                  const pStyle = pChilds.styles.child(pid);
                  if (pStyle) {
                    const st = styleState[pid];
                    if (pStyle.color && typeof pStyle.color.setValue === 'function') pStyle.color.setValue(st.color);
                    if (pStyle.linewidth && typeof pStyle.linewidth.setValue === 'function') pStyle.linewidth.setValue(st.thickness);
                    if (pStyle.visible && typeof pStyle.visible.setValue === 'function') pStyle.visible.setValue(st.visible);
                    if (pStyle.transparency && typeof pStyle.transparency.setValue === 'function') pStyle.transparency.setValue(100 - st.opacity);
                  }
                });
              }
            }
          }
        }
      } catch(err) {
        console.warn('[PineIndicators] Error applying study properties:', err);
      }
    });

    return true;
  }
`;

const startIdx = indCode.indexOf('6.5. Authentic TradingView Indicator Settings Dialog');
const endIdx = indCode.indexOf('7. Public API Exports');

if (startIdx !== -1 && endIdx !== -1) {
  const commentStart = indCode.lastIndexOf('/*', startIdx);
  const commentEnd = indCode.lastIndexOf('/*', endIdx);
  indCode = indCode.substring(0, commentStart) + newOpenSettingsDialog + '\n\n  ' + indCode.substring(commentEnd);
  fs.writeFileSync(pineIndPath, indCode, 'utf8');
  console.log('Successfully updated pine_indicators.js with authentic 1:1 Study Settings Dialog.');
} else {
  console.error('Could not locate openSettingsDialog bounds in pine_indicators.js', { startIdx, endIdx });
}
