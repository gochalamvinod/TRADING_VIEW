const fs = require('fs');

const file = 'e:/TRADINGVIEW ADVANCED/chart_app.js';
let content = fs.readFileSync(file, 'utf8');

const anchor1 = '            // ── Additional Usability & Clean UI Enhancements ─────────────';
const anchor2 = 'const cs = p.customSources ? p.customSources().slice() : [];';

const idx1 = content.indexOf(anchor1);
const idx2 = content.indexOf(anchor2, idx1);

if (idx1 !== -1 && idx2 !== -1) {
  const middle = `\n            "collapsible_header",
            "hide_publish_button",
            "hide_chats_page",
            "hide_ideas_page",
            "hide_ideas_streams_page",
            "remove_library_container_border",
            "no_bars_status",
            "pay_attention_to_ticker_not_symbol",
            "always_show_legend_values_on_mobile",
            "hide_last_na_study_output"
          ]
        });
        window.widget = widget;
        window.tvWidget = widget;

        const STORAGE_KEY = "tv_chart_layout_v3";

        function removeWatermarkLogo() {
          try {
            const chart = widget.activeChart();
            if (!chart) return;
            const model = chart._chartWidget?._model?.model() || chart.model?.();
            if (!model) return;
            const panes = model.panes ? model.panes() : [];
            panes.forEach(p => {\n              `;
  
  content = content.slice(0, idx1 + anchor1.length) + middle + content.slice(idx2);
  fs.writeFileSync(file, content, 'utf8');
  console.log('chart_app.js restored and updated with window.tvWidget successfully!');
} else {
  console.error('Anchors not found:', { idx1, idx2 });
}
