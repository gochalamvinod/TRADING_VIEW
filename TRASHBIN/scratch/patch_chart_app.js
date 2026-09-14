const fs = require('fs');

let content = fs.readFileSync('chart_app.js', 'utf8');

const targetStart = '          const saveChartLayout = () => {';
const targetEnd = '              // Accelerate countdown loop to 60 FPS (requestAnimationFrame)';

const sIdx = content.indexOf(targetStart);
const eIdx = content.indexOf(targetEnd);

if (sIdx === -1 || eIdx === -1) {
  console.error("Target anchors not found!", sIdx, eIdx);
  process.exit(1);
}

const replacement = `          const saveChartLayout = () => {
            try {
              widget.save(layout => {
                if (layout && layout.charts) {
                  layout.charts.forEach(c => {
                    if (c.panes) {
                      c.panes.forEach(p => {
                        if (p.sources) {
                          p.sources = p.sources.filter(s => {
                            if (s.type === 'Study') {
                              const sName = (s.state?.name || s.state?.description || s.state?.shortId || '').toLowerCase();
                              if (sName.startsWith('volume') && !sName.includes('custom')) return false;
                            }
                            return true;
                          });
                          p.sources.forEach(s => {
                            if (s.state && s.state.statusViewStyle) {
                              s.state.statusViewStyle.symbolTextSource = 'ticker-and-description';
                            }
                          });
                        }
                      });
                    }
                  });
                }
                localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
              });
            } catch (e) {}
          };
          setInterval(saveChartLayout, 30000);
          window.addEventListener('pagehide', saveChartLayout);

          // Hook into Chart Resolution Change Events
          try {
            const chart = widget.activeChart();
            if (chart) {
              if (chart.onIntervalChanged) {
                chart.onIntervalChanged().subscribe(null, function(interval) {
                  updateAdaptiveTimeframe(interval);
                  applyLegendOverrides();
                  if (window.BAR_REPLAY && window.BAR_REPLAY.active) {
                    console.log(\`[BarReplay] onIntervalChanged detected resolution change to \${interval}. Syncing future bars...\`);
                    window.syncReplayFutureBars(null, interval);
                  }
                });
              }
              if (chart.onSymbolResolved) {
                chart.onSymbolResolved().subscribe(null, function() {
                  applyLegendOverrides();
                  if (window.BAR_REPLAY && window.BAR_REPLAY.active) {
                    const s = (typeof chart.symbol === "function") ? chart.symbol() : null;
                    const r = (typeof chart.resolution === "function") ? chart.resolution() : null;
                    window.syncReplayFutureBars(s, r);
                  }
                });
              }
              if (chart.resolution) {
                updateAdaptiveTimeframe(chart.resolution());
              }
            }
          } catch (e) {
            console.warn("[AdaptiveLatency] Could not attach chart interval listener:", e);
          }

          // Hook PriceAxisView countdown & 60 FPS animation loop (F32 & F33)
          try {
            const innerWin = (widget && typeof widget._innerWindow === "function")
              ? widget._innerWindow()
              : document.querySelector("#tv_chart_container iframe")?.contentWindow;

            if (innerWin && innerWin.ChartApiInstance) {
              innerWin.ChartApiInstance.serverTime = () => window.serverTimeSync.nowServerMs();
              innerWin.ChartApiInstance._serverTimeOffset = serverTimeSync.calibratedOffset;
              if (innerWin.ChartApiInstance._studyEngine) {
                innerWin.ChartApiInstance._studyEngine.serverTime = () => window.serverTimeSync.nowServerMs();
                innerWin.ChartApiInstance._studyEngine._serverTimeOffset = serverTimeSync.calibratedOffset;
              }
            }

            const chart = widget.activeChart();
            const mainSeries = (chart && typeof chart.mainSeries === "function") ? chart.mainSeries() : null;
            if (mainSeries && mainSeries._priceAxisView) {
              const peProto = Object.getPrototypeOf(mainSeries._priceAxisView);
              if (peProto && !peProto._m18Patched) {
                const origCountdownText = peProto._countdownText;
                peProto._countdownText = function() {
                  const intervalStr = String(this._source.interval());
                  const isTick = /^\\d+T$/i.test(intervalStr);
                  if (isTick) {
                    const nTicks = parseInt(intervalStr, 10) || 1;
                    const sub = window._activeBarSubscribers ? window._activeBarSubscribers.values().next().value : null;
                    const curTicks = sub ? (sub.ticksCount || 0) : 0;
                    return \`\${curTicks}/\${nTicks}T\`;
                  }
                  const is1S = intervalStr === "1S" || intervalStr === "1s";
                  if (is1S) {
                    const lastBar = this._source.data().bars().last();
                    if (!lastBar) return "";
                    const openTime = 1000 * (lastBar.value ? lastBar.value[0] : (lastBar.time / 1000));
                    const closeTime = openTime + 1000;
                    const now = this._currentTime();
                    const remMs = closeTime - now;
                    if (remMs < -1000) return "";
                    const sec = Math.max(0, Math.min(1.0, remMs / 1000));
                    return sec.toFixed(1) + "s";
                  }
                  return origCountdownText.call(this);
                };
                peProto._m18Patched = true;
              }
            }
          } catch (e) {
            console.warn("[M18] Runtime PriceAxisView patch warning:", e);
          }

`;

content = content.substring(0, sIdx) + replacement + content.substring(eIdx);
fs.writeFileSync('chart_app.js', content, 'utf8');
console.log("chart_app.js successfully patched!");
