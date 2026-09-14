/* =========================================================================
       * 1. LocalStorageSaveLoadAdapter Class
       * ========================================================================= */
      class LocalStorageSaveLoadAdapter {
        constructor() {
          this._charts = this._getFromLocalStorage("LocalStorageSaveLoadAdapter_charts") ?? [];
          this._studyTemplates = this._getFromLocalStorage("LocalStorageSaveLoadAdapter_studyTemplates") ?? [];
          this._drawingTemplates = this._getFromLocalStorage("LocalStorageSaveLoadAdapter_drawingTemplates") ?? [];
          this._chartTemplates = this._getFromLocalStorage("LocalStorageSaveLoadAdapter_chartTemplates") ?? [];
          this._drawings = this._getFromLocalStorage("LocalStorageSaveLoadAdapter_drawings") ?? {};
          this._isDirty = false;
          setInterval(() => { if (this._isDirty) { this._saveAllToLocalStorage(); this._isDirty = false; } }, 1000);
        }
        getAllCharts() { return Promise.resolve(this._charts); }
        removeChart(id) { this._charts = this._charts.filter(c => c.id !== id); this._isDirty = true; return Promise.resolve(); }
        saveChart(chartData) {
          if (!chartData.id) chartData.id = this._generateUniqueChartId();
          else this.removeChart(chartData.id);
          const saved = { ...chartData, id: chartData.id, timestamp: Math.round(Date.now() / 1000) };
          this._charts.push(saved); this._isDirty = true; return Promise.resolve(saved.id);
        }
        getChartContent(id) { const c = this._charts.find(x => x.id === id); return c ? Promise.resolve(c.content) : Promise.reject("Chart not found"); }
        getAllStudyTemplates() { return Promise.resolve(this._studyTemplates); }
        saveStudyTemplate(t) { this._studyTemplates = this._studyTemplates.filter(x=>x.name!==t.name); this._studyTemplates.push(t); this._isDirty=true; return Promise.resolve(); }
        removeStudyTemplate(t) { this._studyTemplates=this._studyTemplates.filter(x=>x.name!==t.name); this._isDirty=true; return Promise.resolve(); }
        getStudyTemplateContent(t){const s=this._studyTemplates.find(x=>x.name===t.name);return s?Promise.resolve(s.content):Promise.reject("Not found");}
        saveDrawingTemplate(tool,name,content){this._drawingTemplates=this._drawingTemplates.filter(x=>!(x.name===name&&x.toolName===tool));this._drawingTemplates.push({toolName:tool,name:name,content});this._isDirty=true;return Promise.resolve();}
        loadDrawingTemplate(tool,name){const t=this._drawingTemplates.find(x=>x.name===name&&x.toolName===tool);return t?Promise.resolve(t.content):Promise.reject("Not found");}
        removeDrawingTemplate(tool,name){this._drawingTemplates=this._drawingTemplates.filter(x=>!(x.name===name&&x.toolName===tool));this._isDirty=true;return Promise.resolve();}
        getDrawingTemplates(){return Promise.resolve(this._drawingTemplates.map(t=>t.name));}
        async getAllChartTemplates(){return this._chartTemplates.map(x=>x.name);}
        async saveChartTemplate(name,content){const t=this._chartTemplates.find(x=>x.name===name);if(t)t.content=content;else this._chartTemplates.push({name,content});this._isDirty=true;}
        async removeChartTemplate(name){this._chartTemplates=this._chartTemplates.filter(x=>x.name!==name);this._isDirty=true;}
        async getChartTemplateContent(name){const c=this._chartTemplates.find(x=>x.name===name)?.content;return {content:structuredClone(c)};}
        async saveLineToolsAndGroups(layoutId,chartId,state){if(!state.sources)return;if(!this._drawings[this._getDrawingKey(layoutId,chartId)])this._drawings[this._getDrawingKey(layoutId,chartId)]={};for(let [k,s] of state.sources){if(s===null)delete this._drawings[this._getDrawingKey(layoutId,chartId)][k];else this._drawings[this._getDrawingKey(layoutId,chartId)][k]=s;}this._isDirty=true;}
        async loadLineToolsAndGroups(layoutId,chartId){if(!layoutId)return null;const raw=this._drawings[this._getDrawingKey(layoutId,chartId)];if(!raw)return null;const sources=new Map(Object.entries(raw));return {sources};}
        _generateUniqueChartId(){let ids=this._charts.map(i=>i.id);while(true){const uid=Math.random().toString(16).slice(2);if(!ids.includes(uid))return uid;}}
        _getFromLocalStorage(k){return JSON.parse(localStorage.getItem(k)||"null");}
        _saveToLocalStorage(k,d){localStorage.setItem(k,JSON.stringify(d));}
        _saveAllToLocalStorage(){this._saveToLocalStorage("LocalStorageSaveLoadAdapter_charts",this._charts);this._saveToLocalStorage("LocalStorageSaveLoadAdapter_studyTemplates",this._studyTemplates);this._saveToLocalStorage("LocalStorageSaveLoadAdapter_drawingTemplates",this._drawingTemplates);this._saveToLocalStorage("LocalStorageSaveLoadAdapter_chartTemplates",this._chartTemplates);this._saveToLocalStorage("LocalStorageSaveLoadAdapter_drawings",this._drawings);}
        _getDrawingKey(l,c){return `${l}/${c}`;}
      }

      /* =========================================================================
       * 3. Chart Init & TradingView Integration Logic
       * ========================================================================= */
      let widget;
      const STORAGE_KEY = "tv_chart_layout";
      const THEME_KEY = "tv_chart_theme";

      function getParameterByName(name) {
        const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
        const results = regex.exec(window.location.search);
        if (!results) return null;
        return decodeURIComponent(results[2] || "");
      }

      function saveLayout() {
        if (!widget) return;
        widget.save(layout => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
          if (window.showTVAlertDialog) {
            window.showTVAlertDialog({ title: "Layout", message: "Chart layout saved successfully." });
          } else if (window.showTradingViewAlert) {
            window.showTradingViewAlert({ title: "Layout", message: "Chart layout saved successfully." });
          }
        });
      }
      // Global Interceptor: Guarantee NO browser alert(), confirm(), or prompt() popups anywhere
      window.alert = function(msg) {
        if (window.showTVAlertDialog) {
          window.showTVAlertDialog({ title: "TradingView Notice", message: String(msg) });
          return;
        }
        if (window.showTradingViewAlert) {
          window.showTradingViewAlert({ title: "TradingView Notice", message: String(msg) });
          return;
        }
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:30px;left:30px;background:#1e222d;border:1px solid #2a2e39;color:#d1d4dc;padding:12px 20px;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.5);z-index:999999;font-size:13px;display:flex;align-items:center;gap:10px;font-family:-apple-system,BlinkMacSystemFont,"Trebuchet MS",Roboto,sans-serif;';
        toast.innerHTML = '<span style="color:#2962ff;font-weight:bold;font-size:15px;">ℹ</span><span>' + (msg || '') + '</span>';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
      };
      window.confirm = function(msg) {
        if (window.showTVConfirmDialog) {
          window.showTVConfirmDialog({ title: "TradingView Confirm", message: String(msg || "") });
          return true;
        }
        if (window.showTradingViewConfirm) {
          window.showTradingViewConfirm({ title: "TradingView Confirm", message: String(msg || "") });
          return true;
        }
        return true;
      };
      window.prompt = function(msg, defaultVal) {
        if (window.showTVPromptDialog) {
          window.showTVPromptDialog({ title: "Input", message: String(msg || ""), defaultValue: String(defaultVal || "") });
          return defaultVal || "";
        }
        if (window.showTradingViewPrompt) {
          window.showTradingViewPrompt({ title: "Input", message: String(msg || ""), defaultValue: String(defaultVal || "") });
          return defaultVal || "";
        }
        return defaultVal || "";
      };

      function loadLayout() {
        if (!widget) return;
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          widget.load(JSON.parse(saved));
          if (window.showTVAlertDialog) {
            window.showTVAlertDialog({ title: "Layout", message: "Layout loaded successfully." });
          } else if (window.showTradingViewAlert) {
            window.showTradingViewAlert({ title: "Layout", message: "Layout loaded successfully." });
          }
        } else {
          if (window.showTVAlertDialog) {
            window.showTVAlertDialog({ title: "Layout", message: "No saved layout found." });
          } else if (window.showTradingViewAlert) {
            window.showTradingViewAlert({ title: "Layout", message: "No saved layout found." });
          }
        }
      }
      function resetLayout() { localStorage.removeItem(STORAGE_KEY); location.reload(); }
      function setAppTheme(newTheme, reloadIfNecessary = false) {
        const theme = (newTheme && newTheme.toLowerCase() === 'light') ? 'Light' : 'Dark';
        localStorage.setItem(THEME_KEY, theme);
        document.documentElement.setAttribute('data-theme', theme.toLowerCase());
        const appRoot = document.getElementById('app_root');
        if (appRoot) {
          appRoot.setAttribute('data-theme', theme.toLowerCase());
          appRoot.classList.toggle('theme-light', theme === 'Light');
          appRoot.classList.toggle('theme-dark', theme === 'Dark');
        }
        if (window.PineEditorIDE && typeof window.PineEditorIDE.setTheme === 'function') {
          window.PineEditorIDE.setTheme(theme);
        }
        if (widget && typeof widget.changeTheme === 'function') {
          try {
            widget.changeTheme(theme.toLowerCase());
          } catch (e) {
            console.warn('[Theme] widget.changeTheme error:', e);
          }
        }
        if (reloadIfNecessary) {
          location.reload();
        }
      }
      window.setAppTheme = setAppTheme;

      function toggleTheme() {
        const cur = localStorage.getItem(THEME_KEY) || "Dark";
        const newTheme = cur === "Dark" ? "Light" : "Dark";
        setAppTheme(newTheme);
      }

      function getDatafeedUrl() {
        const queryUrl = getParameterByName("dataUrl");
        if (queryUrl) return queryUrl;
        if (typeof window !== "undefined" && window.location) {
          if (window.location.port === "9999" || window.location.port === "8080") {
            return window.location.origin;
          }
          if (window.location.hostname) {
            return window.location.protocol + "//" + window.location.hostname + ":9999";
          }
        }
        return "http://127.0.0.1:9999";
      }
      // Async wrapper for backward compatibility with existing tests
      async function detectDatafeedUrl() {
        return getDatafeedUrl();
      }
      window.detectDatafeedUrl = detectDatafeedUrl;
      window.getDatafeedUrl = getDatafeedUrl;

      async function initChart() {
        const datafeedUrl = await detectDatafeedUrl();
        const theme = localStorage.getItem(THEME_KEY) || "Dark";

        const datafeed = new Datafeeds.UDFCompatibleDatafeed(datafeedUrl, 10000);

        // ── Adaptive Latency Configuration Engine ───────────────────────────
        function getAdaptiveLatencyConfig(resolution) {
          const raw = String(resolution || "1").trim();
          const res = raw.toUpperCase();

          // 1. Tick timeframes (1T, 3T, 10T, 20T, 40T, 100T, etc.)
          if (/^\d+T$/.test(res)) {
            return {
              tier: "tick",
              resolution: res,
              pollIntervalMs: 150,     // <= 200ms requirement
              wsReconnectMs: 500,      // <= 500ms requirement
              barPollIntervalMs: 200,
              description: "Tick Resolution (150ms poll, 500ms WS reconnect)"
            };
          }

          // 2. Second timeframes (1S, 5S, 10S, 15S, 20S, 21S, 27S, 30S, 45S, 60S)
          if (/^\d+S$/.test(res)) {
            return {
              tier: "second",
              resolution: res,
              pollIntervalMs: 200,     // <= 250ms requirement
              wsReconnectMs: 500,      // <= 500ms requirement
              barPollIntervalMs: 250,
              description: "Second Resolution (200ms poll, 500ms WS reconnect)"
            };
          }

          // Check if monthly or weekly/daily (e.g. "1M", "2M", "3M", "1W", "1D", "D", "W")
          // In TradingView, uppercase 'M' is month, lowercase 'm' or 'min' is minute
          const isMonth = raw.endsWith("M") && !res.endsWith("MIN");
          const isHigherPeriod = isMonth || res.includes("D") || res.includes("W");

          if (!isHigherPeriod) {
            // Check for sub-5min: "1", "2", "3", "4" or "1m", "2m", "3m", "4m", "1MIN", etc.
            const num = parseInt(res.replace(/[^0-9]/g, ""), 10);
            if (!isNaN(num) && num > 0 && num < 5) {
              return {
                tier: "sub5min",
                resolution: res,
                pollIntervalMs: 350,   // 250-500ms requirement
                wsReconnectMs: 1000,  // 1000ms requirement
                barPollIntervalMs: 350,
                description: "Sub-5min Resolution (350ms poll, 1000ms WS reconnect)"
              };
            }
          }

          // 4. Higher timeframes (5m, 15m+, 1h, 1D, 1W, 1M, etc.)
          return {
            tier: "higher",
            resolution: res,
            pollIntervalMs: 1000,      // 1000ms requirement
            wsReconnectMs: 2000,       // Standard 2000ms
            barPollIntervalMs: 1000,
            description: "Standard/Higher Resolution (1000ms poll, 2000ms WS reconnect)"
          };
        }

        // Adaptive State Management
        let currentResolution = "1";
        let adaptiveConfig = getAdaptiveLatencyConfig(currentResolution);
        const activeQuoteListeners = new Map();
        let quoteWs = null;
        let lastWsQuoteTime = 0;
        let quotePollTimer = null;
        let barPulseTimer = null;
        let wsReconnectTimer = null;

        // Expose state globally for test suites, benchmarks, and CDP verification
        window._adaptiveLatencyConfig = adaptiveConfig;
        window._quotePollIntervalMs = adaptiveConfig.pollIntervalMs;
        window._wsReconnectDelayMs = adaptiveConfig.wsReconnectMs;
        window._currentResolution = currentResolution;

        /* =========================================================================
         * 2. High-Precision Timescale Calibration Engine (Cristian's Alg + EWMA)
         * ========================================================================= */
        class ServerTimeSyncEngine {
          constructor(baseUrl) {
            this.baseUrl = baseUrl;
            this.calibratedOffset = 0; // clock offset in seconds: T_server - T_client
            this.minRtt = 999;         // minimum observed round-trip time in ms
            this.lastRtt = 0;
            this.lastSyncTime = 0;
            this.isInitialized = false;
            this.alphaHttp = 0.20;     // EWMA smoothing factor for periodic HTTP /time
            this.alphaQuote = 0.05;    // EWMA smoothing factor for continuous quote arrivals
            this.syncTimer = null;
            this.quoteCount = 0;
            this.recalibrations = 0;
          }

          // High-precision monotonic client timestamp in milliseconds
          nowClientMs() {
            return (typeof performance !== "undefined" && performance.now)
              ? (performance.timeOrigin ? performance.timeOrigin + performance.now() : Date.now())
              : Date.now();
          }

          // Calibrated high-precision server time in milliseconds
          nowServerMs() {
            return this.nowClientMs() + (this.calibratedOffset * 1000);
          }

          // Drift bound: epsilon <= RTT_min / 2 (guaranteed < 0.5ms under local conditions)
          getDriftBoundMs() {
            return Math.max(0.01, this.minRtt / 2);
          }

          // Calibration via HTTP /time measuring exact RTT and offset
          async calibrateHttp() {
            const t_send = this.nowClientMs();
            try {
              const res = await fetch(`${this.baseUrl}/time?format=float`, {
                cache: "no-store",
                headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
              });
              if (!res.ok) return;
              const text = await res.text();
              const t_recv = this.nowClientMs();
              const t_server = parseFloat(text.trim());
              if (isNaN(t_server) || t_server <= 0) return;

              const rtt = Math.max(0.05, t_recv - t_send);
              this.lastRtt = rtt;
              if (rtt < this.minRtt) this.minRtt = rtt;

              // Cristian's Algorithm offset: T_server - (t_send + t_recv) / 2000
              const sampleOffset = t_server - (t_send + t_recv) / 2000;

              if (!this.isInitialized) {
                this.calibratedOffset = sampleOffset;
                this.isInitialized = true;
              } else {
                // EWMA update with jitter attenuation (weights inversely proportional to RTT)
                const weight = Math.max(0.05, Math.min(0.5, (this.minRtt / Math.max(this.minRtt, rtt)) * this.alphaHttp));
                this.calibratedOffset = (1 - weight) * this.calibratedOffset + weight * sampleOffset;
              }

              this.lastSyncTime = t_recv;
              this.recalibrations++;
              this.injectIntoTradingView();
            } catch (e) {
              console.warn("[TimeSync] HTTP calibration warning:", e);
            }
          }

          // Continuous recalibration on WebSocket quote arrival
          recordQuoteTimestamp(quoteTs, t_recv) {
            if (!quoteTs) return;
            const t_server = typeof quoteTs === "number" ? quoteTs : parseFloat(quoteTs);
            if (isNaN(t_server) || t_server <= 0) return;

            const recvMs = t_recv || this.nowClientMs();
            // Guard: only calibrate clock against quotes within 5 seconds of client wall-clock
            if (Math.abs(t_server - (recvMs / 1000)) > 5.0) return;

            this.quoteCount++;
            const estimatedTransitSec = (this.minRtt > 0 && this.minRtt < 100) ? (this.minRtt / 2000) : 0.0005;
            const sampleOffset = t_server - ((recvMs / 1000) - estimatedTransitSec);

            if (!this.isInitialized) {
              this.calibratedOffset = sampleOffset;
              this.isInitialized = true;
            } else {
              this.calibratedOffset = (1 - this.alphaQuote) * this.calibratedOffset + this.alphaQuote * sampleOffset;
            }

            this.injectIntoTradingView();
          }

          // Inject calibrated offset into TradingView's _serverTimeOffset and chart timekeeper
          injectIntoTradingView() {
            window._serverTimeOffset = this.calibratedOffset;
            const innerWin = (window.widget && typeof window.widget._innerWindow === "function")
              ? window.widget._innerWindow()
              : document.querySelector("#tv_chart_container iframe")?.contentWindow;

            if (innerWin && innerWin.ChartApiInstance) {
              try {
                // Hook serverTime to return high-precision monotonic server milliseconds
                innerWin.ChartApiInstance.serverTime = () => window.serverTimeSync.nowServerMs();
                if (innerWin.ChartApiInstance._studyEngine) {
                  innerWin.ChartApiInstance._studyEngine.serverTime = () => window.serverTimeSync.nowServerMs();
                  innerWin.ChartApiInstance._studyEngine._serverTimeOffset = this.calibratedOffset;
                }
                innerWin.ChartApiInstance._serverTimeOffset = this.calibratedOffset;
              } catch (e) {}
            }
            if (window.ChartApiInstance) {
              try {
                window.ChartApiInstance.serverTime = () => window.serverTimeSync.nowServerMs();
                if (window.ChartApiInstance._studyEngine) {
                  window.ChartApiInstance._studyEngine.serverTime = () => window.serverTimeSync.nowServerMs();
                  window.ChartApiInstance._studyEngine._serverTimeOffset = this.calibratedOffset;
                }
                window.ChartApiInstance._serverTimeOffset = this.calibratedOffset;
              } catch (e) {}
            }
          }

          startContinuousSync(intervalMs = 5000) {
            this.calibrateHttp();
            if (this.syncTimer) clearInterval(this.syncTimer);
            this.syncTimer = setInterval(() => this.calibrateHttp(), intervalMs);
          }
        }

        const serverTimeSync = new ServerTimeSyncEngine(datafeedUrl);
        window.serverTimeSync = serverTimeSync;
        window.serverTime = () => serverTimeSync.nowServerMs();
        window.getServerTimeDriftBound = () => serverTimeSync.getDriftBoundMs();
        window.getServerTimeOffset = () => serverTimeSync.calibratedOffset;
        serverTimeSync.startContinuousSync(5000);

        // Upgrade datafeed.getServerTime with Cristian's Algorithm + EWMA
        datafeed.getServerTime = function(callback) {
          if (serverTimeSync.isInitialized) {
            const t_recv = serverTimeSync.nowClientMs();
            const calibratedServerTime = (t_recv / 1000) + serverTimeSync.calibratedOffset;
            callback(Math.floor(calibratedServerTime));
            return;
          }
          serverTimeSync.calibrateHttp().then(() => {
            const t_recv = serverTimeSync.nowClientMs();
            const calibratedServerTime = (t_recv / 1000) + serverTimeSync.calibratedOffset;
            callback(Math.floor(calibratedServerTime));
          });
        };

        // ── Direct 0ms Real-Time Bar Streaming ───────────────────────────────
        const activeBarSubscribers = new Map();
        window._activeBarSubscribers = activeBarSubscribers;
        window._activeOpenCandle = null;
        const _lastHistoricalBars = new Map();
        window._lastHistoricalBars = _lastHistoricalBars;

        function getResolutionInMs(resolution) {
          const raw = String(resolution || "1").trim().toUpperCase();
          if (/^\d+S$/.test(raw)) {
            return (parseInt(raw, 10) || 1) * 1000;
          }
          if (/^\d+T$/.test(raw)) {
            return 1000;
          }
          if (raw.endsWith("D") || raw === "D") {
            const d = parseInt(raw, 10) || 1;
            return d * 86400 * 1000;
          }
          if (raw.endsWith("W") || raw === "W") {
            const w = parseInt(raw, 10) || 1;
            return w * 7 * 86400 * 1000;
          }
          if (raw.endsWith("M") && !raw.endsWith("MIN")) {
            const m = parseInt(raw, 10) || 1;
            return m * 30 * 86400 * 1000;
          }
          const m = parseInt(raw, 10) || 1;
          return m * 60 * 1000;
        }
        window.getResolutionInMs = getResolutionInMs;

        /* =========================================================================
         * 3. Authentic Bar Replay System (gaozhao7/tradingview-library scissors replay)
         * ========================================================================= */
        const BAR_REPLAY = {
          active: false,
          status: 'idle', // 'idle' | 'selecting' | 'paused' | 'playing'
          cutoffSec: 0,
          cutoffMs: 0,
          currentResolution: '1',
          currentSymbol: '',
          speed: 1.0,
          timer: null,
          futureBars: [],
          futureIndex: 0,
          _isReplayingBar: false,
          currentBar: null,
          isBuffering: false
        };
        window.BAR_REPLAY = BAR_REPLAY;

        function showBarSelectionToast() {
          let toast = document.getElementById('tv_replay_selection_toast');
          if (!toast) {
            toast = document.createElement('div');
            toast.id = 'tv_replay_selection_toast';
            toast.style.cssText = 'position:fixed;top:65px;left:50%;transform:translateX(-50%);background:#2962ff;color:#ffffff;padding:8px 18px;border-radius:20px;box-shadow:0 6px 20px rgba(0,0,0,0.5);font-size:13px;font-weight:600;display:flex;align-items:center;gap:12px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Trebuchet MS",Roboto,sans-serif;pointer-events:auto;';
            toast.innerHTML = `
              <span style="font-size:16px;">✂️</span>
              <span>Select a bar on the chart to start replay</span>
              <button type="button" id="tv_replay_cancel_select_btn" style="background:rgba(255,255,255,0.25);border:none;color:#fff;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:bold;cursor:pointer;margin-left:6px;">Cancel</button>
            `;
            document.body.appendChild(toast);
            document.getElementById('tv_replay_cancel_select_btn')?.addEventListener('click', () => {
              hideBarSelectionToast();
              try {
                const ch = widget.activeChart();
                if (ch && typeof ch.cancelSelectBar === 'function') ch.cancelSelectBar();
              } catch(e) {}
            });
          }
          toast.style.display = 'flex';
        }

        function hideBarSelectionToast() {
          const toast = document.getElementById('tv_replay_selection_toast');
          if (toast) toast.remove();
        }
        window.showBarSelectionToast = showBarSelectionToast;
        window.hideBarSelectionToast = hideBarSelectionToast;

        function mountReplayPlayerUI() {
          let player = document.getElementById('tv_replay_player_bar');
          if (player) return player;

          player = document.createElement('div');
          player.id = 'tv_replay_player_bar';
          player.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:999999;display:none;align-items:center;gap:8px;background:#1e222d;border:1px solid #2a2e39;border-radius:8px;padding:6px 12px;box-shadow:0 8px 24px rgba(0,0,0,0.65);font-family:-apple-system,BlinkMacSystemFont,"Trebuchet MS",Roboto,sans-serif;user-select:none;';
          player.innerHTML = `
            <div id="tv_replay_drag_handle" style="color:#787b86;cursor:grab;padding:2px 4px;font-size:14px;letter-spacing:-2px;" title="Drag to reposition">⋮⋮</div>
            
            <button type="button" id="tv_replay_btn_jump" style="background:#2a2e39;border:none;border-radius:4px;color:#d1d4dc;padding:5px 9px;font-size:12px;font-weight:500;display:flex;align-items:center;gap:5px;cursor:pointer;" title="Select new cutoff bar (Scissors)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
              <span>Jump</span>
            </button>

            <div style="width:1px;height:18px;background:#2a2e39;"></div>

            <button type="button" id="tv_replay_btn_play" style="background:#2962ff;border:none;border-radius:4px;color:#ffffff;padding:5px 12px;font-size:12px;font-weight:bold;display:flex;align-items:center;gap:5px;cursor:pointer;" title="Play / Pause">
              <svg id="tv_replay_icon_play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <svg id="tv_replay_icon_pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              <span id="tv_replay_play_label">Play</span>
            </button>

            <button type="button" id="tv_replay_btn_step" style="background:#2a2e39;border:none;border-radius:4px;color:#d1d4dc;padding:5px 9px;font-size:12px;font-weight:500;display:flex;align-items:center;gap:5px;cursor:pointer;" title="Step forward 1 bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><rect x="18" y="4" width="2" height="16"/></svg>
              <span>Step</span>
            </button>

            <div style="width:1px;height:18px;background:#2a2e39;"></div>

            <select id="tv_replay_speed_select" style="background:#2a2e39;border:none;border-radius:4px;color:#d1d4dc;padding:4px 6px;font-size:12px;cursor:pointer;outline:none;" title="Replay Speed">
              <option value="0.1">0.1x (10s)</option>
              <option value="0.3">0.3x (3s)</option>
              <option value="0.5">0.5x (2s)</option>
              <option value="1" selected>1x (1s)</option>
              <option value="3">3x (0.3s)</option>
              <option value="5">5x (0.2s)</option>
              <option value="10">10x (0.1s)</option>
            </select>

            <div style="width:1px;height:18px;background:#2a2e39;"></div>

            <div style="display:flex;flex-direction:column;gap:1px;font-size:11px;min-width:125px;line-height:1.2;">
              <span id="tv_replay_count_badge" style="color:#2962ff;font-weight:600;">Replay Mode</span>
              <span id="tv_replay_time_text" style="color:#848e9c;font-size:10px;">Ready</span>
            </div>

            <div style="width:1px;height:18px;background:#2a2e39;"></div>

            <button type="button" id="tv_replay_btn_exit" style="background:transparent;border:none;border-radius:4px;color:#787b86;padding:5px 7px;font-size:14px;cursor:pointer;display:flex;align-items:center;" title="Exit Replay">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          `;
          document.body.appendChild(player);

          // Wire player button clicks
          document.getElementById('tv_replay_btn_jump')?.addEventListener('click', () => {
            requestUserSelectBar();
          });
          document.getElementById('tv_replay_btn_play')?.addEventListener('click', () => {
            barReplayTogglePlay();
          });
          document.getElementById('tv_replay_btn_step')?.addEventListener('click', () => {
            barReplayStep();
          });
          document.getElementById('tv_replay_speed_select')?.addEventListener('change', (e) => {
            barReplaySetSpeed(e.target.value);
          });
          document.getElementById('tv_replay_btn_exit')?.addEventListener('click', () => {
            exitReplayMode();
          });

          // Draggable functionality
          let isDragging = false;
          let startX = 0, startY = 0;
          let initLeft = 0, initTop = 0;
          const handle = document.getElementById('tv_replay_drag_handle');
          if (handle) {
            handle.addEventListener('mousedown', (e) => {
              isDragging = true;
              startX = e.clientX;
              startY = e.clientY;
              const rect = player.getBoundingClientRect();
              initLeft = rect.left;
              initTop = rect.top;
              player.style.transform = 'none';
              player.style.left = `${initLeft}px`;
              player.style.top = `${initTop}px`;
              handle.style.cursor = 'grabbing';
            });
            window.addEventListener('mousemove', (e) => {
              if (!isDragging) return;
              const dx = e.clientX - startX;
              const dy = e.clientY - startY;
              player.style.left = `${Math.max(10, Math.min(window.innerWidth - 360, initLeft + dx))}px`;
              player.style.top = `${Math.max(10, Math.min(window.innerHeight - 50, initTop + dy))}px`;
            });
            window.addEventListener('mouseup', () => {
              if (isDragging) {
                isDragging = false;
                handle.style.cursor = 'grab';
              }
            });
          }

          return player;
        }

        function showReplayToolbar() {
          const p = mountReplayPlayerUI();
          p.style.display = 'flex';
        }

        function hideReplayToolbar() {
          const p = document.getElementById('tv_replay_player_bar');
          if (p) p.style.display = 'none';
        }
        window.showReplayToolbar = showReplayToolbar;
        window.hideReplayToolbar = hideReplayToolbar;

        function updateReplayToolbarUI() {
          const p = document.getElementById('tv_replay_player_bar');
          if (!p || !BAR_REPLAY.active) return;

          const isPlaying = BAR_REPLAY.status === 'playing';
          const iconPlay = document.getElementById('tv_replay_icon_play');
          const iconPause = document.getElementById('tv_replay_icon_pause');
          const playLabel = document.getElementById('tv_replay_play_label');
          if (iconPlay && iconPause && playLabel) {
            if (isPlaying) {
              iconPlay.style.display = 'none';
              iconPause.style.display = 'inline';
              playLabel.textContent = 'Pause';
            } else {
              iconPlay.style.display = 'inline';
              iconPause.style.display = 'none';
              playLabel.textContent = 'Play';
            }
          }

          const badge = document.getElementById('tv_replay_count_badge');
          const timeText = document.getElementById('tv_replay_time_text');
          const resTag = BAR_REPLAY.currentResolution ? ` [${BAR_REPLAY.currentResolution}]` : '';
          if (badge) {
            if (BAR_REPLAY.isBuffering) {
              badge.textContent = `Syncing${resTag}...`;
            } else {
              const total = BAR_REPLAY.futureBars.length;
              if (total === 0) {
                badge.textContent = `Replay Active${resTag} (End of data)`;
              } else {
                badge.textContent = `Replay: ${BAR_REPLAY.futureIndex} / ${total} bars${resTag}`;
              }
            }
          }
          if (timeText) {
            if (BAR_REPLAY.cutoffSec > 0) {
              const d = new Date(BAR_REPLAY.cutoffMs || BAR_REPLAY.cutoffSec * 1000);
              timeText.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            } else {
              timeText.textContent = 'Cutoff Set';
            }
          }
        }

        let _replaySyncSeq = 0;

        async function syncReplayFutureBars(targetSymbol, targetResolution) {
          if (!BAR_REPLAY.active || !BAR_REPLAY.cutoffSec) return;

          const seq = ++_replaySyncSeq;
          const wasPlaying = BAR_REPLAY.status === 'playing';
          if (wasPlaying && BAR_REPLAY.timer) {
            clearInterval(BAR_REPLAY.timer);
            BAR_REPLAY.timer = null;
          }

          const chart = widget && typeof widget.activeChart === 'function' ? widget.activeChart() : null;
          const sub = activeBarSubscribers.values().next().value;
          const sym = targetSymbol || (sub ? sub.symbol : (chart && chart.symbol ? chart.symbol() : "EURUSD."));
          const res = String(targetResolution || (sub ? sub.resolution : (chart && chart.resolution ? chart.resolution() : "1")));

          BAR_REPLAY.currentSymbol = sym;
          BAR_REPLAY.currentResolution = res;
          BAR_REPLAY.isBuffering = true;
          updateReplayToolbarUI();

          try {
            // Buffer into the future with 24h expansion to ensure all broker timezones / open sessions are captured
            const nowSec = Math.floor(Date.now() / 1000) + 86400;
            const fromSec = BAR_REPLAY.cutoffSec;
            let historyUrl = `${datafeedUrl}/history?symbol=${encodeURIComponent(sym)}&resolution=${encodeURIComponent(res)}&from=${fromSec}&to=${nowSec}`;
            if (res.endsWith("S") || res.endsWith("T") || res === "T") {
              historyUrl += `&countback=5000`;
            }

            const resp = await fetch(historyUrl);
            if (seq !== _replaySyncSeq) return; // Stale fetch superseded by newer resolution

            if (resp.ok) {
              const data = await resp.json();
              if (data.s === 'ok' && Array.isArray(data.t)) {
                const fBars = [];
                let prevTime = 0;
                for (let i = 0; i < data.t.length; i++) {
                  const bTimeMs = Math.round(data.t[i] * 1000);
                  if (bTimeMs > BAR_REPLAY.cutoffMs && bTimeMs > prevTime) {
                    prevTime = bTimeMs;
                    fBars.push({
                      time: bTimeMs,
                      open: parseFloat(data.o[i]),
                      high: parseFloat(data.h[i]),
                      low: parseFloat(data.l[i]),
                      close: parseFloat(data.c[i]),
                      volume: parseFloat(data.v ? data.v[i] : 0)
                    });
                  }
                }
                BAR_REPLAY.futureBars = fBars;
                BAR_REPLAY.futureIndex = 0;
                console.log(`[BarReplay] Buffered ${fBars.length} future bars for ${sym} @ ${res} starting from cutoff ${BAR_REPLAY.cutoffSec}`);
              } else {
                BAR_REPLAY.futureBars = [];
                BAR_REPLAY.futureIndex = 0;
              }
            }
          } catch (e) {
            console.warn("[BarReplay] Error buffering future candles:", e);
          } finally {
            if (seq === _replaySyncSeq) {
              BAR_REPLAY.isBuffering = false;
              updateReplayToolbarUI();
              if (wasPlaying && BAR_REPLAY.active && BAR_REPLAY.futureBars.length > 0) {
                barReplayPlay();
              }
            }
          }
        }
        window.syncReplayFutureBars = syncReplayFutureBars;

        async function enterReplayMode(cutoffTime) {
          if (!cutoffTime || isNaN(cutoffTime)) return;
          const cutoffMs = (cutoffTime > 1e11) ? Math.round(cutoffTime) : Math.round(cutoffTime * 1000);
          const cutoffSec = Math.floor(cutoffMs / 1000);
          BAR_REPLAY.active = true;
          BAR_REPLAY.status = 'paused';
          BAR_REPLAY.cutoffSec = cutoffSec;
          BAR_REPLAY.cutoffMs = cutoffMs;
          BAR_REPLAY.futureBars = [];
          BAR_REPLAY.futureIndex = 0;
          BAR_REPLAY.currentBar = null;
          if (BAR_REPLAY.timer) {
            clearInterval(BAR_REPLAY.timer);
            BAR_REPLAY.timer = null;
          }

          showReplayToolbar();
          updateReplayToolbarUI();

          const chart = widget && typeof widget.activeChart === 'function' ? widget.activeChart() : null;
          const sub = activeBarSubscribers.values().next().value;
          const sym = sub ? sub.symbol : (chart && chart.symbol ? chart.symbol() : "EURUSD.");
          const res = sub ? sub.resolution : (chart && chart.resolution ? chart.resolution() : "1");

          // Slice chart at cutoff and invalidate feed time cache
          for (const s of activeBarSubscribers.values()) {
            if (typeof s.onResetCacheNeededCallback === 'function') {
              try { s.onResetCacheNeededCallback(); } catch(e) {}
            }
          }
          if (widget && typeof widget.activeChart === 'function') {
            const ch = widget.activeChart();
            if (ch && typeof ch.resetData === 'function') {
              ch.resetData();
            }
          }

          // Buffer future candles for current symbol and resolution
          await syncReplayFutureBars(sym, res);
        }
        window.enterReplayMode = enterReplayMode;

        function barReplayPlay() {
          if (!BAR_REPLAY.active) return;
          BAR_REPLAY.status = 'playing';
          if (BAR_REPLAY.timer) clearInterval(BAR_REPLAY.timer);

          const intervalMs = Math.max(50, Math.round(1000 / (BAR_REPLAY.speed || 1.0)));
          BAR_REPLAY.timer = setInterval(barReplayStep, intervalMs);
          updateReplayToolbarUI();
        }
        window.barReplayPlay = barReplayPlay;

        function barReplayPause() {
          if (!BAR_REPLAY.active) return;
          BAR_REPLAY.status = 'paused';
          if (BAR_REPLAY.timer) {
            clearInterval(BAR_REPLAY.timer);
            BAR_REPLAY.timer = null;
          }
          updateReplayToolbarUI();
        }
        window.barReplayPause = barReplayPause;

        function barReplayTogglePlay() {
          if (BAR_REPLAY.status === 'playing') {
            barReplayPause();
          } else {
            barReplayPlay();
          }
        }
        window.barReplayTogglePlay = barReplayTogglePlay;

        function barReplayStep() {
          if (!BAR_REPLAY.active) return;
          if (BAR_REPLAY.isBuffering) return;
          if (BAR_REPLAY.futureIndex >= BAR_REPLAY.futureBars.length) {
            barReplayPause();
            const badge = document.getElementById('tv_replay_count_badge');
            if (badge) badge.textContent = `Replay Complete [${BAR_REPLAY.currentResolution || ''}]`;
            updateReplayToolbarUI();
            return;
          }

          const nextBar = BAR_REPLAY.futureBars[BAR_REPLAY.futureIndex++];
          BAR_REPLAY.cutoffMs = nextBar.time;
          BAR_REPLAY.cutoffSec = Math.floor(nextBar.time / 1000);
          BAR_REPLAY.currentBar = nextBar;

          BAR_REPLAY._isReplayingBar = true;
          for (const sub of activeBarSubscribers.values()) {
            if (!sub.resolution || String(sub.resolution).toUpperCase() === String(BAR_REPLAY.currentResolution).toUpperCase()) {
              sub.currentBar = { ...nextBar };
              window._activeOpenCandle = sub.currentBar;
              try {
                sub.onRealtimeCallback({ ...nextBar });
              } catch (e) {
                console.warn("[BarReplay] Error dispatching replay candle:", e);
              }
            }
          }
          BAR_REPLAY._isReplayingBar = false;

          updateReplayToolbarUI();
        }
        window.barReplayStep = barReplayStep;

        function barReplaySetSpeed(newSpeed) {
          BAR_REPLAY.speed = parseFloat(newSpeed) || 1.0;
          if (BAR_REPLAY.status === 'playing') {
            barReplayPlay();
          }
          updateReplayToolbarUI();
        }
        window.barReplaySetSpeed = barReplaySetSpeed;

        function exitReplayMode() {
          if (BAR_REPLAY.timer) {
            clearInterval(BAR_REPLAY.timer);
            BAR_REPLAY.timer = null;
          }
          BAR_REPLAY.active = false;
          BAR_REPLAY.status = 'idle';
          BAR_REPLAY.cutoffSec = 0;
          BAR_REPLAY.cutoffMs = 0;
          BAR_REPLAY.futureBars = [];
          BAR_REPLAY.futureIndex = 0;
          BAR_REPLAY.currentBar = null;

          hideReplayToolbar();

          // Restore live real-time MT5 tick streaming and invalidate feed cache
          for (const s of activeBarSubscribers.values()) {
            if (typeof s.onResetCacheNeededCallback === 'function') {
              try { s.onResetCacheNeededCallback(); } catch(e) {}
            }
          }
          if (widget && typeof widget.activeChart === 'function') {
            const ch = widget.activeChart();
            if (ch && typeof ch.resetData === 'function') {
              ch.resetData();
            }
          }
        }
        window.exitReplayMode = exitReplayMode;

        function requestUserSelectBar() {
          const chart = widget && typeof widget.activeChart === 'function' ? widget.activeChart() : null;
          if (!chart) return;

          if (typeof chart.requestSelectBar === 'function') {
            showBarSelectionToast();
            chart.requestSelectBar()
              .then(selectedTime => {
                hideBarSelectionToast();
                enterReplayMode(selectedTime);
              })
              .catch(err => {
                hideBarSelectionToast();
                console.log("[BarReplay] Bar selection cancelled or rejected:", err);
              });
          } else {
            console.warn("[BarReplay] chart.requestSelectBar is not available");
          }
        }
        window.requestUserSelectBar = requestUserSelectBar;

        // Global keyboard shortcut listener for Bar Replay
        window.addEventListener('keydown', (e) => {
          if (!BAR_REPLAY.active) return;
          const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
          if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

          if (e.code === 'Space') {
            e.preventDefault();
            barReplayTogglePlay();
          } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            barReplayStep();
          } else if (e.code === 'Escape') {
            e.preventDefault();
            exitReplayMode();
          }
        });

        // Hook datafeed.getBars to seed open candle & enforce incremental filtering + 3s watchdog
        let _resetDataPromiseResolve = null;
        const origGetBars = datafeed.getBars.bind(datafeed);
        datafeed.getBars = function(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
          // If in Bar Replay mode, strictly clamp periodParams.to to BAR_REPLAY.cutoffSec!
          if (window.BAR_REPLAY && window.BAR_REPLAY.active && window.BAR_REPLAY.cutoffSec) {
            if (periodParams.firstDataRequest || periodParams.to > window.BAR_REPLAY.cutoffSec) {
              periodParams.to = window.BAR_REPLAY.cutoffSec;
            }
          }

          let called = false;
          const timer = setTimeout(() => {
            if (!called) {
              called = true;
              console.warn("⚠️ [DATAFEED] getBars 25s watchdog timeout for", symbolInfo ? symbolInfo.name : resolution, "- returning noData");
              if (typeof _resetDataPromiseResolve === "function") {
                try { _resetDataPromiseResolve(); } catch(_) {}
                _resetDataPromiseResolve = null;
              }
              try {
                onHistoryCallback([], { noData: true });
              } catch (e) {
                console.error("Watchdog getBars callback error:", e);
              }
            }
          }, 25000);

          const safeOnHistory = function(bars, meta) {
            if (called) return;
            called = true;
            clearTimeout(timer);
            if (typeof _resetDataPromiseResolve === "function") {
              try { _resetDataPromiseResolve(); } catch(_) {}
              _resetDataPromiseResolve = null;
            }

            try {
              if (Array.isArray(bars) && bars.length > 0) {
                // Bar Replay cutoff slicing
                if (window.BAR_REPLAY && window.BAR_REPLAY.active && window.BAR_REPLAY.cutoffMs) {
                  bars = bars.filter(b => b.time <= window.BAR_REPLAY.cutoffMs);
                  if (bars.length === 0 && meta) {
                    meta.noData = true;
                  }
                }

                // Filter incremental bars: if not firstDataRequest, filter bars <= periodParams.to * 1000
                if (!periodParams.firstDataRequest && periodParams.to) {
                  const maxAllowedMs = Math.floor(periodParams.to * 1000);
                  bars = bars.filter(b => b.time <= maxAllowedMs);
                }

                // Only update sub.currentBar and _lastHistoricalBars when periodParams.firstDataRequest === true
                if (bars.length > 0 && periodParams.firstDataRequest) {
                  const lastBar = bars[bars.length - 1];
                  const sym = (symbolInfo.ticker || symbolInfo.name || "").replace(/\.$/, "").toUpperCase();
                  const symKey = sym + "_" + String(resolution);
                  _lastHistoricalBars.set(symKey, { ...lastBar });

                  for (const sub of activeBarSubscribers.values()) {
                    if (sub.cleanSymbol === sym && String(sub.resolution) === String(resolution)) {
                      sub.currentBar = { ...lastBar };
                      window._activeOpenCandle = sub.currentBar;
                    }
                  }
                }
              }

              // In Bar Replay mode, if resolution differs from buffered future bars, trigger sync for the new resolution
              if (window.BAR_REPLAY && window.BAR_REPLAY.active && periodParams.firstDataRequest) {
                if (String(resolution) !== String(window.BAR_REPLAY.currentResolution)) {
                  window.syncReplayFutureBars(symbolInfo.ticker || symbolInfo.name, resolution);
                }
              }

              onHistoryCallback(bars, meta);
            } catch (err) {
              console.error("Error in wrappedOnHistory:", err);
              try { onHistoryCallback(bars || [], meta || { noData: true }); } catch (_) {}
            }
          };

          const safeOnError = function(error) {
            if (called) return;
            called = true;
            clearTimeout(timer);
            if (typeof _resetDataPromiseResolve === "function") {
              try { _resetDataPromiseResolve(); } catch(_) {}
              _resetDataPromiseResolve = null;
            }
            try {
              if (typeof onErrorCallback === "function") {
                onErrorCallback(error);
              } else {
                onHistoryCallback([], { noData: true });
              }
            } catch (err) {
              console.error("Error in safeOnError:", err);
            }
          };

          try {
            return origGetBars(symbolInfo, resolution, periodParams, safeOnHistory, safeOnError);
          } catch (err) {
            if (!called) {
              called = true;
              clearTimeout(timer);
              try { onHistoryCallback([], { noData: true }); } catch (_) {}
            }
          }
        };

        // Hook datafeed.subscribeBars
        const origSubscribeBars = datafeed.subscribeBars.bind(datafeed);
        datafeed.subscribeBars = function(symbolInfo, resolution, onRealtimeCallback, listenerGUID, onResetCacheNeededCallback) {
          updateAdaptiveTimeframe(resolution);
          const symName = symbolInfo.ticker || symbolInfo.name || "";
          const cleanSym = symName.replace(/\.$/, "").toUpperCase();
          const resMs = getResolutionInMs(resolution);
          const symKey = cleanSym + "_" + String(resolution);
          const seededBar = _lastHistoricalBars.get(symKey);

          let lastDispatchedTime = 0;
          const monotonicRealtimeCallback = function(bar) {
            if (!bar || typeof bar.time !== 'number') return;
            if (window.BAR_REPLAY && window.BAR_REPLAY.active && !window.BAR_REPLAY._isReplayingBar) {
              return;
            }
            if (bar.time < lastDispatchedTime && !(window.BAR_REPLAY && window.BAR_REPLAY.active)) {
              return; // reject out-of-order bars to eliminate feed time violations
            }
            lastDispatchedTime = bar.time;
            onRealtimeCallback(bar);
          };

          activeBarSubscribers.set(listenerGUID, {
            symbolInfo,
            symbol: symName,
            cleanSymbol: cleanSym,
            resolution: String(resolution),
            resolutionMs: resMs,
            onRealtimeCallback: monotonicRealtimeCallback,
            onResetCacheNeededCallback,
            currentBar: seededBar ? { ...seededBar } : null,
            ticksCount: 0
          });

          if (seededBar) {
            window._activeOpenCandle = { ...seededBar };
          }

          sendWsSubscriptions([symName, cleanSym, cleanSym + "."]);
          return origSubscribeBars(symbolInfo, resolution, monotonicRealtimeCallback, listenerGUID, onResetCacheNeededCallback);
        };

        // Hook datafeed.unsubscribeBars
        const origUnsubscribeBars = datafeed.unsubscribeBars.bind(datafeed);
        datafeed.unsubscribeBars = function(listenerGUID) {
          activeBarSubscribers.delete(listenerGUID);
          return origUnsubscribeBars(listenerGUID);
        };

        // Dispatch incoming tick to active candle with 0ms buffering delay and 60FPS RAF throttle
        function dispatchTickToBar(sub, price, tickVol, tickServerTimeMs) {
          if (window.BAR_REPLAY && window.BAR_REPLAY.active) {
            return;
          }
          if (typeof window.evaluateAlertsForPrice === 'function') {
            window.evaluateAlertsForPrice(sub.symbolInfo ? sub.symbolInfo.name : '', price);
          }
          const isTickRes = /^\d+T$/i.test(sub.resolution);
          if (isTickRes) {
            const nTicks = parseInt(sub.resolution, 10) || 1;
            sub.ticksCount = (sub.ticksCount || 0) + 1;
            if (!sub.currentBar || sub.ticksCount >= nTicks) {
              sub.ticksCount = 0;
              let barTime = Math.round(tickServerTimeMs);
              if (sub.currentBar && barTime <= sub.currentBar.time) {
                barTime = sub.currentBar.time + 1; // Strict 1ms monotonicity
              }
              const newBar = {
                time: barTime,
                open: price,
                high: price,
                low: price,
                close: price,
                volume: tickVol
              };
              sub.currentBar = newBar;
              window._activeOpenCandle = newBar;
              if (sub._rafId) {
                cancelAnimationFrame(sub._rafId);
                sub._rafId = null;
              }
              sub.onRealtimeCallback({ ...newBar });
            } else {
              sub.currentBar.high = Math.max(sub.currentBar.high, price);
              sub.currentBar.low = Math.min(sub.currentBar.low, price);
              sub.currentBar.close = price;
              sub.currentBar.volume = (sub.currentBar.volume || 0) + tickVol;
              window._activeOpenCandle = sub.currentBar;
              if (!sub._rafId) {
                sub._rafId = requestAnimationFrame(() => {
                  sub._rafId = null;
                  if (sub.currentBar) sub.onRealtimeCallback({ ...sub.currentBar });
                });
              }
            }
            return;
          }

          // Time-based resolutions (1S, 5S, 1, 5, 15, etc.)
          const resMs = sub.resolutionMs || getResolutionInMs(sub.resolution);
          const candleStartTime = Math.floor(tickServerTimeMs / resMs) * resMs;

          if (!sub.currentBar) {
            const newBar = {
              time: candleStartTime,
              open: price,
              high: price,
              low: price,
              close: price,
              volume: tickVol
            };
            sub.currentBar = newBar;
            window._activeOpenCandle = newBar;
            if (sub._rafId) {
              cancelAnimationFrame(sub._rafId);
              sub._rafId = null;
            }
            sub.onRealtimeCallback({ ...newBar });
            return;
          }

          if (candleStartTime === sub.currentBar.time) {
            // Update open candle's high, low, close, volume with RAF throttle (60 FPS cap)
            sub.currentBar.high = Math.max(sub.currentBar.high, price);
            sub.currentBar.low = Math.min(sub.currentBar.low, price);
            sub.currentBar.close = price;
            sub.currentBar.volume = (sub.currentBar.volume || 0) + tickVol;
            window._activeOpenCandle = sub.currentBar;

            if (!sub._rafId) {
              sub._rafId = requestAnimationFrame(() => {
                sub._rafId = null;
                if (sub.currentBar) sub.onRealtimeCallback({ ...sub.currentBar });
              });
            }
          } else if (candleStartTime > sub.currentBar.time) {
            // New candle opened - dispatch immediately with zero delay
            const newBar = {
              time: candleStartTime,
              open: price,
              high: price,
              low: price,
              close: price,
              volume: tickVol
            };
            sub.currentBar = newBar;
            window._activeOpenCandle = newBar;
            if (sub._rafId) {
              cancelAnimationFrame(sub._rafId);
              sub._rafId = null;
            }
            sub.onRealtimeCallback({ ...newBar });
          }
        }

        // ── WebSocket Quote Client (Primary Stream) ────────────────────────
        function connectQuoteWebSocket() {
          if (wsReconnectTimer) {
            clearTimeout(wsReconnectTimer);
            wsReconnectTimer = null;
          }
          try {
            const loc = window.location;
            const wsProto = (loc && loc.protocol === "https:") ? "wss:" : "ws:";
            const wsHost = (loc && loc.hostname ? loc.hostname : "127.0.0.1") + ":9999";
            const wsUrl = `${wsProto}//${wsHost}/ws/quotes`;

            quoteWs = new WebSocket(wsUrl);

            quoteWs.onopen = function() {
              // Silence _dataPulseProvider HTTP polling when WebSocket quote stream is active
              if (datafeed && datafeed._dataPulseProvider) {
                datafeed._dataPulseProvider._requestsPending = 999999;
              }
              const allSyms = new Set();
              for (const sub of activeQuoteListeners.values()) {
                sub.symbols.forEach(s => allSyms.add(s));
              }
              for (const sub of activeBarSubscribers.values()) {
                allSyms.add(sub.symbol);
                allSyms.add(sub.cleanSymbol);
                allSyms.add(sub.cleanSymbol + ".");
              }
              if (allSyms.size === 0) {
                ["XAUUSD.", "EURUSD.", "GBPUSD.", "USDJPY.", "BTCUSD."].forEach(s => allSyms.add(s));
              }
              sendWsSubscriptions(Array.from(allSyms));
            };

            quoteWs.onmessage = function(event) {
              try {
                const msg = JSON.parse(event.data);
                if (msg.type === "quote" && msg.data) {
                  const recvTime = (typeof performance !== "undefined" && performance.now)
                    ? (performance.timeOrigin ? performance.timeOrigin + performance.now() : Date.now())
                    : Date.now();
                  lastWsQuoteTime = recvTime;

                  const qData = msg.data;
                  const rawSym = msg.symbol || qData.n || "";
                  const cleanSym = rawSym.replace(/\.$/, "").toUpperCase();
                  const dotSym = cleanSym + ".";

                  // 1. Recalibrate server time continuously from quote timestamp
                  if (serverTimeSync && qData._ts) {
                    serverTimeSync.recordQuoteTimestamp(qData._ts, recvTime);
                  }

                  // 2. Dispatch to active quote listeners
                  for (const sub of activeQuoteListeners.values()) {
                    if (sub.symbols.includes(rawSym) || sub.symbols.includes(qData.n) || sub.symbols.includes(cleanSym) || sub.symbols.includes(dotSym)) {
                      sub.callback([qData]);
                    }
                  }

                  // 3. DIRECT 0MS REAL-TIME BAR STREAMING (Zero Buffering Delay)
                  const v = qData.v || {};
                  const price = parseFloat(qData.lp ?? qData.last_price ?? v.lp ?? v.last_price ?? v.bid ?? qData.p);
                  if (!isNaN(price) && price > 0) {
                    if (typeof window.evaluateAlertsForPrice === 'function') {
                      window.evaluateAlertsForPrice(cleanSym, price);
                    }
                    const tickVol = parseFloat(qData.volume ?? v.volume ?? 1) || 1;
                    const exactTickUtcMs = msg.time_utc_msc || qData.time_utc_msc || (v && v.time_utc_msc);
                    const tickServerTimeSec = parseFloat(qData._ts ?? qData.time ?? v.lp_time);
                    const tickServerTimeMs = (typeof exactTickUtcMs === 'number' && exactTickUtcMs > 0)
                      ? exactTickUtcMs
                      : ((!isNaN(tickServerTimeSec) && tickServerTimeSec > 0)
                          ? tickServerTimeSec * 1000
                          : serverTimeSync.nowServerMs());

                    for (const sub of activeBarSubscribers.values()) {
                      if (sub.cleanSymbol === cleanSym || sub.symbol === rawSym || sub.symbol === qData.n || sub.symbol === dotSym) {
                        if (_isSyncingBackgroundGap) {
                          _gapPendingTicks.push({ sub, price, tickVol, tickServerTimeMs });
                        } else {
                          dispatchTickToBar(sub, price, tickVol, tickServerTimeMs);
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                console.warn("[QUOTES WS] Error processing quote message:", e);
              }
            };

            quoteWs.onerror = function() {};

            quoteWs.onclose = function() {
              const delay = adaptiveConfig.wsReconnectMs;
              console.warn(`⚠️ [QUOTES WS] Disconnected. Reconnecting in ${delay}ms...`);
              quoteWs = null;
              wsConnecting = false;
              scheduleWsReconnect(delay);
            };
          } catch (e) {
            const delay = adaptiveConfig.wsReconnectMs;
            wsReconnectTimer = setTimeout(connectQuoteWebSocket, delay);
          }
        }

        function sendWsSubscriptions(symbols) {
          if (!quoteWs || quoteWs.readyState !== WebSocket.OPEN) return;
          const symList = Array.isArray(symbols) ? symbols : [symbols];
          if (symList.length === 0) return;
          try {
            quoteWs.send(JSON.stringify({ action: "subscribe", type: "subscribe", symbols: symList }));
          } catch (e) {}
          symList.forEach(s => {
            try {
              quoteWs.send(JSON.stringify({ action: "subscribe", symbol: s }));
            } catch (e) {}
          });
        }

        // ── 1ms Mouse Presence & Background/Foreground Gap Replacement Engine ─
        let _mouseInsideTradingView = true;
        let _backgroundEnteredAt = 0;
        let _leaveDebounceTimer = null;
        let _resyncScheduleTimer = null;
        let _isSyncingBackgroundGap = false;
        let _gapPendingTicks = [];

        function handleMouseLeaveImmediate(source) {
          if (_leaveDebounceTimer) clearTimeout(_leaveDebounceTimer);
          if (!_mouseInsideTradingView) return;
          _mouseInsideTradingView = false;
          _backgroundEnteredAt = Date.now();
        }

        function handleMouseEnterImmediate(source) {
          if (_leaveDebounceTimer) {
            clearTimeout(_leaveDebounceTimer);
            _leaveDebounceTimer = null;
          }
          if (_mouseInsideTradingView) return;
          _mouseInsideTradingView = true;
          const awayDurationMs = _backgroundEnteredAt > 0 ? (Date.now() - _backgroundEnteredAt) : 0;
          const recordedEnteredAt = _backgroundEnteredAt;
          _backgroundEnteredAt = 0;

          // "as soon as background to frontground in 1ms fetch history and replace data and then again ws"
          if (recordedEnteredAt > 0) {
            if (_resyncScheduleTimer) clearTimeout(_resyncScheduleTimer);
            _resyncScheduleTimer = setTimeout(() => {
              syncBackgroundGapAndReplace(awayDurationMs);
            }, 1); // Exact 1ms trigger
          }
        }

        function handleMouseLeaveArea(source) {
          if (_leaveDebounceTimer) clearTimeout(_leaveDebounceTimer);
          _leaveDebounceTimer = setTimeout(() => {
            handleMouseLeaveImmediate(source);
          }, 20);
        }

        function handleMouseEnterArea(source) {
          handleMouseEnterImmediate(source);
        }

        // Ensure in foreground mouse is always detected over the page
        ['mouseover', 'mouseenter', 'mousemove', 'pointermove', 'mousedown'].forEach(evt => {
          document.addEventListener(evt, () => handleMouseEnterArea('doc-' + evt), { passive: true });
        });

        // Detect when mouse leaves viewport / window
        document.documentElement.addEventListener('mouseleave', (e) => {
          handleMouseLeaveArea('mouse-leave-window');
        }, { passive: true });

        document.addEventListener('mouseleave', (e) => {
          handleMouseLeaveArea('doc-mouseleave');
        }, { passive: true });

        document.addEventListener('mouseout', (e) => {
          if (!e.relatedTarget && !e.toElement) {
            handleMouseLeaveArea('mouse-out-window');
          }
        }, { passive: true });

        window.addEventListener('blur', () => {
          handleMouseLeaveImmediate('window-blur');
        });

        window.addEventListener('focus', () => {
          handleMouseEnterImmediate('window-focus');
        });

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            handleMouseLeaveImmediate('visibility-hidden');
          } else if (document.visibilityState === 'visible') {
            handleMouseEnterImmediate('visibility-visible');
          }
        });

        const chartContainerEl = document.getElementById('tv_chart_container');
        if (chartContainerEl) {
          ['mouseover', 'mouseenter', 'mousemove', 'pointermove', 'mousedown'].forEach(evt => {
            chartContainerEl.addEventListener(evt, () => handleMouseEnterArea('container-' + evt), { passive: true });
          });
          chartContainerEl.addEventListener('mouseleave', (e) => {
            if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
              handleMouseLeaveArea('container-mouseleave');
            }
          }, { passive: true });
        }

        // Hook chart iframe events to guarantee presence detection when mouse is over chart
        function hookIframePresence() {
          const container = document.getElementById('tv_chart_container');
          if (!container) return;
          const iframe = container.querySelector('iframe');
          if (!iframe || iframe._presenceHooked) return;
          try {
            const iDoc = iframe.contentDocument;
            const iWin = iframe.contentWindow;
            if (iDoc) {
              iframe._presenceHooked = true;
              ['mouseover', 'mouseenter', 'mousemove', 'pointermove', 'mousedown'].forEach(evt => {
                iDoc.addEventListener(evt, () => handleMouseEnterArea('iframe-' + evt), { passive: true });
              });
              iDoc.addEventListener('mouseleave', (e) => {
                if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
                  handleMouseLeaveArea('iframe-mouseleave-window');
                } else {
                  handleMouseLeaveArea('iframe-mouseleave');
                }
              }, { passive: true });
              iDoc.addEventListener('mouseout', (e) => {
                if (!e.relatedTarget && !e.toElement) {
                  handleMouseLeaveArea('iframe-mouseout-null');
                }
              }, { passive: true });
              if (iWin) {
                iWin.addEventListener('focus', () => handleMouseEnterImmediate('iframe-focus'));
                iWin.addEventListener('blur', () => handleMouseLeaveImmediate('iframe-blur'));
              }
            }
          } catch (e) {}
        }
        setInterval(hookIframePresence, 1000);

        async function syncBackgroundGapAndReplace(awayDurationMs) {
          if (window.BAR_REPLAY && window.BAR_REPLAY.active) return;
          if (_isSyncingBackgroundGap) return;
          _isSyncingBackgroundGap = true;
          _gapPendingTicks = [];

          try {
            const nowSec = Math.ceil(Date.now() / 1000) + 10;
            const subs = Array.from(activeBarSubscribers.values());

            // 1. Fetch history directly from MT5 across the gap for each active subscriber
            for (const sub of subs) {
              const lastBarTimeMs = sub.currentBar ? sub.currentBar.time : (Date.now() - 60000);
              const fromSec = Math.max(0, Math.floor(lastBarTimeMs / 1000) - 2);

              try {
                const historyUrl = `${datafeedUrl}/history?symbol=${encodeURIComponent(sub.symbol)}&resolution=${encodeURIComponent(sub.resolution)}&from=${fromSec}&to=${nowSec}`;
                const resp = await fetch(historyUrl);
                if (resp.ok) {
                  const data = await resp.json();
                  if (data.s === "ok" && Array.isArray(data.t) && data.t.length > 0) {
                    const count = data.t.length;

                    // Stream the gap bars sequentially in ascending order
                    for (let i = 0; i < count; i++) {
                      const barTimeMs = Math.round(data.t[i] * 1000);
                      if (barTimeMs >= lastBarTimeMs) {
                        const bar = {
                          time: barTimeMs,
                          open: parseFloat(data.o[i]),
                          high: parseFloat(data.h[i]),
                          low: parseFloat(data.l[i]),
                          close: parseFloat(data.c[i]),
                          volume: parseFloat(data.v[i] || 0)
                        };
                        sub.currentBar = bar;
                        window._activeOpenCandle = bar;
                        sub.onRealtimeCallback({ ...bar });
                      }
                    }
                  }
                }
              } catch (subErr) {}
            }

            // 2. Replace chart data cleanly via resetData() and notify cache reset
            if (widget && typeof widget.activeChart === "function") {
              try {
                const ch = widget.activeChart();
                if (ch && typeof ch.resetData === "function") {
                  const waitPromise = new Promise(resolve => {
                    _resetDataPromiseResolve = resolve;
                    setTimeout(resolve, 600); // 600ms safety limit
                  });
                  ch.resetData();
                  await waitPromise;
                }
              } catch (chErr) {}
            }

            for (const sub of subs) {
              if (typeof sub.onResetCacheNeededCallback === "function") {
                try { sub.onResetCacheNeededCallback(); } catch(e) {}
              }
            }
          } catch (err) {
          } finally {
            // 3. And then again WS: flush buffered ticks and resume live WebSocket dispatch
            _isSyncingBackgroundGap = false;
            if (_gapPendingTicks.length > 0) {
              const pending = _gapPendingTicks;
              _gapPendingTicks = [];
              for (const item of pending) {
                const curTime = item.sub.currentBar ? item.sub.currentBar.time : 0;
                if (item.tickServerTimeMs >= curTime) {
                  dispatchTickToBar(item.sub, item.price, item.tickVol, item.tickServerTimeMs);
                }
              }
            }
          }
        }
        window.syncBackgroundGapAndReplace = syncBackgroundGapAndReplace;
        window.syncBackgroundGap = syncBackgroundGapAndReplace; // backward compat
        window.triggerForegroundResync = () => handleMouseEnterImmediate('manual-trigger');
        window.triggerForeground = () => handleMouseEnterImmediate('manual-trigger');
        window.triggerBackground = () => handleMouseLeaveImmediate('manual-trigger');

        // ── Adaptive HTTP Polling Fallback ──────────────────────────────────
        async function executePollFallback() {
          if (window.BAR_REPLAY && window.BAR_REPLAY.active) return;
          if (activeQuoteListeners.size === 0 && activeBarSubscribers.size === 0) return;
          const allSyms = new Set();
          for (const sub of activeQuoteListeners.values()) {
            sub.symbols.forEach(s => allSyms.add(s));
          }
          for (const sub of activeBarSubscribers.values()) {
            allSyms.add(sub.symbol);
          }
          if (allSyms.size === 0) return;

          // Check if primary WebSocket is healthy and actively streaming (< 5000ms stale)
          const wsIsActive = quoteWs &&
                             quoteWs.readyState === WebSocket.OPEN &&
                             (lastWsQuoteTime === 0 || Date.now() - lastWsQuoteTime < 5000);

          // Real-time WebSocket tick push is primary; skip redundant HTTP fetch when active
          if (wsIsActive) return;

          try {
            const symList = Array.from(allSyms).join(",");
            const res = await fetch(`${datafeedUrl}/quotes?symbols=${encodeURIComponent(symList)}`);
            if (res.ok) {
              const json = await res.json();
              if (json.s === "ok" && Array.isArray(json.d)) {
                for (const sub of activeQuoteListeners.values()) {
                  const filtered = json.d.filter(item => sub.symbols.includes(item.n));
                  if (filtered.length > 0) sub.callback(filtered);
                }
              }
            }
          } catch (e) {}
        }

        function startAdaptiveQuotePoller(intervalMs) {
          if (quotePollTimer) clearInterval(quotePollTimer);
          // Never poll HTTP quotes faster than 2000ms since WebSocket pushes real-time sub-second ticks
          const safeInterval = Math.max(intervalMs || 2000, 2000);
          quotePollTimer = setInterval(executePollFallback, safeInterval);
        }

        // ── Adaptive Bar Pulse Provider (HTTP Fallback) ──────────────────────
        function startAdaptiveBarPulse(intervalMs) {
          if (barPulseTimer) clearInterval(barPulseTimer);
          barPulseTimer = setInterval(() => {
            // Only poll HTTP history if WebSocket is idle/stale > 1500ms
            const wsIsActive = quoteWs && quoteWs.readyState === WebSocket.OPEN && (Date.now() - lastWsQuoteTime < 1500);
            if (!wsIsActive && datafeed && datafeed._dataPulseProvider && typeof datafeed._dataPulseProvider._updateData === "function") {
              datafeed._dataPulseProvider._updateData();
            }
          }, intervalMs);
        }

        // ── Master Adaptive Switcher ─────────────────────────────────────────
        function updateAdaptiveTimeframe(newResolution) {
          if (!newResolution) return;
          currentResolution = String(newResolution).trim();
          adaptiveConfig = getAdaptiveLatencyConfig(currentResolution);

          window._adaptiveLatencyConfig = adaptiveConfig;
          window._quotePollIntervalMs = adaptiveConfig.pollIntervalMs;
          window._wsReconnectDelayMs = adaptiveConfig.wsReconnectMs;
          window._currentResolution = currentResolution;

          // Reschedule pollers and timers
          startAdaptiveQuotePoller(adaptiveConfig.pollIntervalMs);
          startAdaptiveBarPulse(adaptiveConfig.barPollIntervalMs);

          // If broker bridge is attached, inform it as well
          if (window._mt5Broker && typeof window._mt5Broker.setAdaptiveResolution === "function") {
            window._mt5Broker.setAdaptiveResolution(currentResolution);
          }
        }
        window.updateAdaptiveTimeframe = updateAdaptiveTimeframe;

        // Initialize timers with default resolution
        startAdaptiveQuotePoller(adaptiveConfig.pollIntervalMs);
        startAdaptiveBarPulse(adaptiveConfig.barPollIntervalMs);
        connectQuoteWebSocket();

        // ── Datafeed Quotes Hooks ───────────────────────────────────────────
        datafeed.subscribeQuotes = function(symbols, fastSymbols, onRealtimeCallback, listenerGUID) {
          const syms = Array.from(new Set([...(symbols || []), ...(fastSymbols || [])]));
          activeQuoteListeners.set(listenerGUID, { symbols: syms, callback: onRealtimeCallback });
          // Immediate initial fetch
          datafeed.getQuotes(syms, onRealtimeCallback, () => {});
          sendWsSubscriptions(syms);
        };

        datafeed.unsubscribeQuotes = function(listenerGUID) {
          activeQuoteListeners.delete(listenerGUID);
        };

        // Standard base multipliers
        const defaultSecondsMultipliers = ["1", "5", "10", "15", "30"];
        const defaultTicksMultipliers = ["1", "10", "100"];

        // Base standard intervals; custom intervals can be freely added via TradingView's "+ Add custom interval..."
        const standardIntervals = [
          "1S", "5S", "10S", "30S",
          "1T", "10T", "100T",
          "1", "3", "5", "15", "30", "45", "60", "120", "180", "240", "1D", "1W", "1M"
        ];
        window.standardIntervals = standardIntervals;

        // Seed popular intervals (including 3T, 15S) into TradingView's native intervals
        try {
          const stored = JSON.parse(localStorage.getItem("IntervalWidget.intervals") || "[]");
          const needed = ["3T", "15S"];
          const toAdd = needed.filter(x => !stored.includes(x));
          if (toAdd.length > 0) {
            localStorage.setItem("IntervalWidget.intervals", JSON.stringify([...stored, ...toAdd]));
          }
        } catch (e) {}

        // Hook onReady to expose seconds and ticks capability to TradingView widget
        const origOnReady = datafeed.onReady.bind(datafeed);
        datafeed.onReady = function(callback) {
          origOnReady(function(configuration) {
            if (configuration) {
              window.lastKnownDatafeedConfiguration = configuration;
              configuration.has_seconds = true;
              configuration.build_seconds_from_ticks = true;
              configuration["build_seconds_from_ticks"] = true;
              configuration.seconds_multipliers = [];
              configuration.has_ticks = true;
              configuration["is-tickbars-available"] = true;
              configuration.is_tickbars_available = true;
              configuration.ticks_multipliers = defaultTicksMultipliers;
              configuration.tick_multipliers = defaultTicksMultipliers;

              let customIntervals = [];
              try {
                const stored = JSON.parse(localStorage.getItem("IntervalWidget.intervals") || "[]");
                if (Array.isArray(stored)) customIntervals = stored;
              } catch (e) {}

              // Ensure ChartApi defaultResolutions contains all custom intervals
              configuration.supported_resolutions = Array.from(new Set([
                ...(configuration.supported_resolutions || []),
                ...standardIntervals,
                ...customIntervals
              ]));

              const origInc = configuration.supported_resolutions.includes.bind(configuration.supported_resolutions);
              configuration.supported_resolutions.includes = function(val) {
                if (origInc(val)) return true;
                if (typeof val === "string" && (/^\d+[ST]$/i.test(val) || /^\d+$/i.test(val))) return true;
                return false;
              };
            }
            callback(configuration);
          });
        };

        // Hook resolveSymbol to dynamically accept ANY custom seconds and ticks & enforce 3s watchdog
        // Hook resolveSymbol to dynamically accept ANY custom seconds and ticks & enforce 25s watchdog
        const origResolveSymbol = datafeed.resolveSymbol.bind(datafeed);
        datafeed.resolveSymbol = function(symbolName, onSymbolResolvedCallback, onResolveErrorCallback, extension) {
          let called = false;
          const timer = setTimeout(() => {
            if (!called) {
              called = true;
              console.warn("⚠️ [DATAFEED] resolveSymbol 25s watchdog timeout for", symbolName);
              try {
                if (typeof onResolveErrorCallback === "function") {
                  onResolveErrorCallback("Timeout resolving symbol: " + symbolName);
                }
              } catch (e) {
                console.error("Watchdog resolveSymbol callback error:", e);
              }
            }
          }, 25000);

          const safeOnResolved = function(symbolInfo) {
            if (called) return;
            called = true;
            clearTimeout(timer);

            // Guarantee flags for native interval dialog and dropdown with auto-conversion from ticks
            symbolInfo.has_empty_bars = false;
            symbolInfo['has_empty_bars'] = false;
            symbolInfo.has_seconds = true;
            symbolInfo.build_seconds_from_ticks = true;
            symbolInfo['build_seconds_from_ticks'] = true;
            symbolInfo.seconds_multipliers = [];
            symbolInfo.has_ticks = true;
            symbolInfo["is-tickbars-available"] = true;
            symbolInfo.is_tickbars_available = true;
            symbolInfo.has_intraday = true;
            symbolInfo.ticks_multipliers = defaultTicksMultipliers;
            symbolInfo.tick_multipliers = defaultTicksMultipliers;

            // Enforce proper minmove2 for Forex pips and pipette rendering
            if (symbolInfo.type === 'forex' && (symbolInfo.pricescale === 100000 || symbolInfo.pricescale === 1000)) {
              symbolInfo.minmove2 = 10;
              symbolInfo.minmov2 = 10;
              symbolInfo.minmovement2 = 10;
            } else if (symbolInfo.minmove2 !== undefined) {
              symbolInfo.minmov2 = symbolInfo.minmove2;
              symbolInfo.minmovement2 = symbolInfo.minmove2;
            }

            // Load saved user custom intervals from localStorage
            let customIntervals = [];
            try {
              const stored = JSON.parse(localStorage.getItem("IntervalWidget.intervals") || "[]");
              if (Array.isArray(stored)) customIntervals = stored;
            } catch (e) {}

            symbolInfo.supported_resolutions = Array.from(new Set([
              ...(symbolInfo.supported_resolutions || []),
              ...standardIntervals,
              ...customIntervals
            ]));

            // Dynamic resolution validator hook so ANY arbitrary integer seconds/ticks is never rejected
            const origIncludes = symbolInfo.supported_resolutions.includes.bind(symbolInfo.supported_resolutions);
            symbolInfo.supported_resolutions.includes = function(val) {
              if (origIncludes(val)) return true;
              if (typeof val === "string" && (/^\d+[ST]$/i.test(val) || /^\d+$/i.test(val))) {
                return true;
              }
              return false;
            };

            const origIndexOf = symbolInfo.supported_resolutions.indexOf.bind(symbolInfo.supported_resolutions);
            symbolInfo.supported_resolutions.indexOf = function(val) {
              const idx = origIndexOf(val);
              if (idx !== -1) return idx;
              if (typeof val === "string" && (/^\d+[ST]$/i.test(val) || /^\d+$/i.test(val))) {
                return 0;
              }
              return -1;
            };

            onSymbolResolvedCallback(symbolInfo);
          };

          const safeOnError = function(err) {
            if (called) return;
            called = true;
            clearTimeout(timer);
            if (typeof onResolveErrorCallback === "function") {
              onResolveErrorCallback(err);
            }
          };

          try {
            origResolveSymbol(symbolName, safeOnResolved, safeOnError, extension);
          } catch (err) {
            if (!called) {
              called = true;
              clearTimeout(timer);
              if (typeof onResolveErrorCallback === "function") {
                onResolveErrorCallback(err);
              }
            }
          }
        };

        // Hook datafeed.searchSymbols for fast, resilient symbol search without undefined parameter crashes
        datafeed.searchSymbols = async function(userInput, exchange, symbolType, onResultReadyCallback) {
          try {
            const q = (userInput || "").trim();
            const ex = (exchange && typeof exchange === "string") ? exchange.trim() : "";
            const ty = (symbolType && typeof symbolType === "string") ? symbolType.trim() : "";
            const url = `${datafeedUrl}/search?query=${encodeURIComponent(q)}&exchange=${encodeURIComponent(ex)}&type=${encodeURIComponent(ty)}&limit=50`;
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data)) {
                onResultReadyCallback(data);
                return;
              }
            }
          } catch (err) {
            console.warn("⚠️ [DATAFEED] searchSymbols error:", err);
          }
          onResultReadyCallback([]);
        };

        const defaultInitialSymbol = (window.__NODE_SERVER_STATE__ && window.__NODE_SERVER_STATE__.brokerBackend === 'OANDA') ? 'EURUSD' : 'XAUUSD.';
        widget = new TradingView.widget({
          fullscreen: false,
          autosize: true,
          symbol: defaultInitialSymbol,
          interval: "1",
          container: "tv_chart_container",
          library_path: "charting_library/",
          locale: getParameterByName("lang") || "en",
          datafeed: datafeed,
          theme: theme,
          custom_css_url: "/custom.css",
          numeric_formatting: { decimal_sign: "." },
          save_load_adapter: new LocalStorageSaveLoadAdapter(),
          custom_indicators_getter: function(PineJS) {
            return window.getPineIndicators ? window.getPineIndicators(PineJS) : Promise.resolve([]);
          },

          // ── MT5 Native Broker Integration ──────────────────────────
          broker_factory: function(host) {
            var broker = new MT5Broker(host, datafeedUrl);
            window._mt5Broker = broker;
            return broker;
          },
          broker_config: {
            configFlags: {
              supportReversePosition: true,
              supportPositionReverse: true,
              supportStopLoss: true,
              supportClosePosition: true,
              supportPartialClosePosition: true,
              supportEditAmount: false,
              supportLevel2Data: true,
              supportDOM: true,
              supportMarketOrders: true,
              supportLimitOrders: true,
              supportStopOrders: true,
              supportStopLimitOrders: true,
              supportPositionBrackets: true,
              showQuantityInsteadOfAmount: true,
              supportOrderBrackets: true,
              supportModifyOrder: true,
              supportModifyOrderPrice: true,
              supportCancelOrder: true,
              supportModifyBrackets: true,
              supportModifyPositionBrackets: true,
              supportModifyOrderBrackets: true,
              supportAddBracketsToExistingOrder: true,
              // ── Order Preview & Interactive Lines ──
              supportPlaceOrderPreview: false,
              supportModifyOrderPreview: false,
              supportOrdersHistory: true,
              supportExecutions: true,
              supportBalances: false,
              supportMarketBrackets: true,
              supportStopOrdersInBothDirections: true,
              supportStopLimitOrdersInBothDirections: true,
              supportTrailingStop: true,
              supportModifyTrailingStop: true,
              supportPositions: true,
              supportRiskControlsAndInfo: true,
              supportPLUpdate: true,
              showNotificationsLog: true,
              supportDemoLiveSwitcher: false
            }
          },
          // ── Trading & Legend Properties Overrides ───────────────────
          overrides: {
            'tradingProperties.showOrders': true,
            'tradingProperties.showPositions': true,
            'tradingProperties.showReverse': true,
            'tradingProperties.showExecutions': true,
            'tradingProperties.extendLeft': true,
            'tradingProperties.horizontalAlignment': 2,
            'paneProperties.legendProperties.showSeriesTitle': true,
            'paneProperties.legendProperties.showSeriesOHLC': true,
            'paneProperties.legendProperties.showBarChange': true,
            'paneProperties.legendProperties.showLegend': true,
            'paneProperties.legendProperties.showTradingButtons': true,
            'paneProperties.legendProperties.showStudyArguments': true,
            'paneProperties.legendProperties.showStudyTitles': true,
            'paneProperties.legendProperties.showStudyValues': true,
            'mainSeriesProperties.statusViewStyle.symbolTextSource': 'ticker',
            'mainSeriesProperties.statusViewStyle.showExchange': true,
            'mainSeriesProperties.statusViewStyle.showInterval': true,
            'mainSeriesProperties.prePostMarket.preMarketColor': 'transparent',
            'mainSeriesProperties.prePostMarket.postMarketColor': 'transparent',
            'scalesProperties.showPrePostMarketPriceLabel': false
          },
          favorites: {
            intervals: ["1T", "3T", "10T", "1S", "5S", "15S", "30S", "1", "5", "15", "60", "240", "1D", "1W", "1M"],
            chartTypes: ["Area", "Candles", "Heikin Ashi"]
          },
          time_frames: [
            { text: "1d", resolution: "5S", description: "1 Day (5s)" },
            { text: "5d", resolution: "1", description: "5 Days (1m)" },
            { text: "1m", resolution: "15", description: "1 Month (15m)" },
            { text: "3m", resolution: "60", description: "3 Months (1h)" },
            { text: "1y", resolution: "1D", description: "1 Year (1d)" },
            { text: "5y", resolution: "1D", description: "5 Years (1d)" },
            { text: "10y", resolution: "1M", description: "10 Years (1M)" }
          ],

          widgetbar: {
            details: true,
            watchlist: true,
            datawindow: true,
            watchlist_settings: {
              default_symbols: [
                "XAUUSD.",
                "XAGUSD."
              ]
            }
          },
          watchlist: [
            "XAUUSD.",
            "XAGUSD."
          ],
          disabled_features: [
            "news_widget",
            "news_provider",
            "timescale_marks",
            "marks",
            "allow_supported_resolutions_set_only",
            "symbol_search_option_chain_selector",
            "create_volume_indicator_by_default",
            "create_volume_indicator_by_default_once",
            "volume_force_overlay",
            "intraday_inactivity_gaps",
            "pre_post_market_sessions",
            "pre_post_market_price_line",
            "show_symbol_logos"
          ],
          addVolume: false,
          enabled_features: [
            // ── Trading & Execution ────────────────────────────────────
            "trading_terminal", "order_panel", "order_panel_close_button", "order_panel_undock",
            "show_order_panel_on_start", "trading_account_manager", "open_account_manager",
            "buy_sell_buttons", "trading_notifications", "show_trading_notifications_history",
            "chart_property_page_trading", "broker_button",
            "dom_widget", "show_dom_first_time", "enable_dom_data_for_untradable_symbols",
            "always_pass_called_order_to_modify", "order_info",
            "snapshot_trading_drawings",

            // ── Datafeed & Resolutions ─────────────────────────────────
            "seconds_resolution", "tick_resolution", "custom_resolutions",
            "show_average_close_price_line_and_label",
            "countdown", "display_market_status",

            // ── Charts & Styles ────────────────────────────────────────
            "japanese_chart_styles", "chart_style_hilo", "chart_style_hilo_last_price",
            "support_multicharts", "multi_chart_layout", "additional_multichart_layouts",
            "chart_crosshair_menu", "border_around_the_chart",

            // ── Header Controls ────────────────────────────────────────
            "header_resolutions", "header_interval_dialog_button", "show_interval_dialog_on_key_press",
            "header_chart_type", "header_settings", "header_undo_redo",
            "header_quick_search", "header_symbol_search",
            "header_layouttoggle", "header_screenshot", "header_fullscreen_button",
            "header_compare", "header_indicators", "header_saveload",

            // ── Toolbars ───────────────────────────────────────────────
            "left_toolbar", "right_toolbar", "timeframes_toolbar",

            // ── Watchlist & Sidebar ────────────────────────────────────
            "watchlist", "watchlist_context_menu", "watchlist_import_export",
            "watchlist_sections", "watchlist_cross_tab_sync",
            "show_symbol_watchlist", "add_to_watchlist", "multiple_watchlists",
            "widgetbar_tabs", "show_right_widgets_panel_by_default",
            "details", "quote_summary", "data_window",

            // ── Symbol Logos & Info ────────────────────────────────────
            "show_exchange_logos",
            "show_symbol_logo_in_account_manager",
            "symbol_info", "symbol_info_price_source",

            // ── Legend & Studies ────────────────────────────────────────
            "legend_inplace_edit",
            "show_hide_button_in_legend", "study_buttons_in_legend",
            "format_button_in_legend", "delete_button_in_legend",
            "edit_buttons_in_legend", "items_favoriting",
            "study_on_study", "study_templates",

            // ── Drawing & Templates ────────────────────────────────────
            "drawing_templates", "chart_templates", "datasource_copypaste",
            "show_object_tree", "keep_object_tree_widget_in_right_toolbar",

            // ── Scale & Property Pages ─────────────────────────────────
            "main_series_scale_menu",
            "property_pages", "show_chart_property_page",
            "chart_property_page_scales", "property_page_scales",

            // ── Misc UI ────────────────────────────────────────────────
            "go_to_date", "timezone_menu",
            "show_dialog_on_double_click",
            "source_selection_markers", "popup_hints",
            "save_chart_properties_to_local_storage",
            "favorite_timeframes", "save_shortcut",
            "chart_scroll", "chart_zoom",
            "bars_marks", "end_of_period_timescale_marks",
            "charting_library_export_chart_data",

            // ── Advanced Ergonomics, Scaling & Navigation ───────────────
            "chart_property_page_right_margin_editor",
            "chart_template_storage",
            "chart_drag_export",
            "scales_date_format",
            "scales_time_hours_format",
            "shift_visible_range_on_new_bar",
            "cropped_tick_marks",
            "insert_indicator_dialog_shortcut",
            "symbol_search_hot_key",
            "compare_recent_symbols_enabled",
            "clear_price_scale_on_error_or_empty_bars",
            "use_localstorage_for_settings",
            "saveload_storage_customization",
            "refresh_saved_charts_list_on_dialog_show",
            "right_bar_stays_on_scroll",
            "handle_scale",
            "handle_scroll",
            "custom_items_in_context_menu",
            "widget_logo",
            "adaptive_logo",
            "logo_without_link",
            "move_logo_to_main_pane",
            "show_animated_logo",
            "link_to_tradingview",
            "text_notes",

            // ── Scale & Scroll Input Subsets ───────────────────────────
            "mouse_wheel_scale", "pinch_scale", "axis_pressed_mouse_move_scale",
            "mouse_wheel_scroll", "pressed_mouse_move_scroll", "horz_touch_drag_scroll", "vert_touch_drag_scroll",

            // ── Margin, Canvas & Viewport Stability ────────────────────
            "show_percent_option_for_right_margin",
            "lock_visible_range_when_adjusting_percentage_right_margin",
            "lock_visible_time_range_on_resize",
            "side_toolbar_in_fullscreen_mode",
            "header_in_fullscreen_mode",

            // ── Spread Math & Extended Search ──────────────────────────
            "show_spread_operators",
            "studies_symbol_search_spread_operators",
            "compare_symbol_search_spread_operators",

            // ── Context Menus & Template Toolbar ───────────────────────
            "objects_tree_context_menu",
            "linetoolpropertieswidget_template_button",

            // ── Price Scale & Currency/Unit Controls ───────────────────
            "pricescale_currency",
            "pricescale_unit",
            "auto_enable_symbol_labels",
            "two_character_bar_marks_labels",

            // ── Study, Legend & Resolution Synchronization ────────────
            "study_symbol_ticker_description",
            "study_overlay_compare_legend_option",
            "update_study_formatter_on_symbol_resolve",
            "update_timeframes_set_on_symbol_resolve",
            "request_only_visible_range_on_reset",
            "use_overrides_for_overlay",
            "chart_content_overrides_by_defaults",

            // ── Drawings & Watchlists Management ───────────────────────
            "support_manage_drawings",
            "watchlists_from_to_file",
            "show_saved_watchlists",

            // ── Layout Protection & Autosave ───────────────────────────
            "confirm_overwrite_if_chart_layout_with_name_exists",
            "charts_auto_save",

            // ── Symbol Naming & Ergonomics ─────────────────────────────
            "prefer_symbol_name_over_fullname",
            "prefer_quote_short_name",
            "symbol_info_long_description",
            "accessible_keyboard_shortcuts",

            // ── Safe Library Enhancements & Advanced Usability ───────────
            "context_menus",
            "pane_context_menu",
            "legend_context_menu",
            "scales_context_menu",
            "advanced_emoji_in_titles",
            "align_dwm_bars_to_main_series",
            "allow_arbitrary_symbol_search_input",
            "aria_crosshair_price_description",
            "aria_detailed_chart_descriptions",
            "bypass_chart_height_check",
            "charts_emoji_sync",
            "clear_bars_on_series_error",
            "control_bar",
            "determine_first_data_request_size_using_visible_range",
            "display_legend_on_all_charts",
            "extended_extrapolation_limit",
            "fix_left_edge",
            "graying_disabled_tools_enabled",
            "image_drawingtool",
            "library_custom_color_themes",
            "moving_average_study_changable_currency_unit",
            "price_scale_always_last_bar_value",
            "saveload_separate_drawings_storage",
            "secondary_series_extend_time_scale",
            "show_zoom_and_move_buttons_on_touch",
            "star_some_intervals_by_default",
            "studies_extend_time_scale",
            "symbol_search_option_chain_selector",
            "tpo_summary",
            "uppercase_instrument_names",
            "use_last_visible_bar_value_in_legend",
            "use_symbol_name_for_header_toolbar",
            "use_ticker_on_symbol_info_update",

            // ── Additional Usability & Clean UI Enhancements ─────────────
            "collapsible_header",
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
            panes.forEach(p => {
              const cs = p.customSources ? p.customSources().slice() : [];
              cs.forEach(s => {
                if (s._layout === 'library_branding' || s._left === 13 || s.constructor?.name === 'wv' || (s._needToShow !== undefined && s._showBranding !== undefined)) {
                  s._needToShow = false;
                  s._showBranding = false;
                  if (s._powBy) s._powBy.show = false;
                  if (typeof p.removeCustomSource === 'function') {
                    try { p.removeCustomSource(s); } catch(e) {}
                  }
                }
              });
            });
            const allCS = model.customSources ? model.customSources().slice() : [];
            allCS.forEach(s => {
              if (s._layout === 'library_branding' || s._left === 13 || s.constructor?.name === 'wv' || (s._needToShow !== undefined && s._showBranding !== undefined)) {
                s._needToShow = false;
                s._showBranding = false;
                if (s._powBy) s._powBy.show = false;
                if (typeof model.removeCustomSource === 'function') {
                  try { model.removeCustomSource(s); } catch(e) {}
                }
              }
            });
            if (typeof model.fullUpdate === 'function') model.fullUpdate();
          } catch (e) {}
        }

        function removeVolumeStudies() {
          removeWatermarkLogo();
          try {
            const chart = widget.activeChart();
            if (!chart) return;
            const model = chart._chartWidget?._model?.model() || chart.model?.();
            if (!model) return;
            const studies = model.allStudies ? model.allStudies() : [];
            studies.forEach(s => {
              const meta = typeof s.metaInfo === 'function' ? s.metaInfo() : null;
              const name = typeof s.name === 'function' ? s.name() : (meta ? (meta.shortDescription || meta.description) : '');
              const shortId = meta ? (meta.shortId || meta.id || '') : '';
              const id = typeof s.id === 'function' ? s.id() : '';
              const lowerName = (name || '').toLowerCase();
              const lowerShort = (shortId || '').toLowerCase();
              const lowerId = (id || '').toLowerCase();
              if (
                (lowerName.startsWith('volume') && !lowerName.includes('custom')) ||
                lowerShort.startsWith('volume') ||
                lowerId.startsWith('volume')
              ) {
                try {
                  if (typeof chart.removeEntity === 'function' && id) {
                    chart.removeEntity(id);
                  } else if (typeof model.removeSource === 'function') {
                    model.removeSource(s);
                  }
                } catch(e) {}
              }
            });
          } catch (e) {}
        }

        function applyLegendOverrides() {
          removeVolumeStudies();
          try {
            const chart = widget.activeChart();
            if (chart && typeof chart.applyOverrides === "function") {
              chart.applyOverrides({
                'paneProperties.legendProperties.showSeriesTitle': true,
                'paneProperties.legendProperties.showSeriesOHLC': true,
                'paneProperties.legendProperties.showBarChange': true,
                'paneProperties.legendProperties.showLegend': true,
                'paneProperties.legendProperties.showTradingButtons': true,
                'paneProperties.legendProperties.showStudyArguments': true,
                'paneProperties.legendProperties.showStudyTitles': true,
                'paneProperties.legendProperties.showStudyValues': true,
                'mainSeriesProperties.statusViewStyle.symbolTextSource': 'ticker',
                'mainSeriesProperties.statusViewStyle.showExchange': true,
                'mainSeriesProperties.statusViewStyle.showInterval': true
              });
            }
            try {
              const model = chart?._chartWidget?._model || chart?.model?.();
              if (model && model.properties && model.properties().childs().paneProperties) {
                model.properties().childs().paneProperties.childs().legendProperties.childs().showStudyArguments.setValue(true);
              }
              const ms = model?.mainSeries();
              if (ms && ms.properties && ms.properties().childs().statusViewStyle) {
                ms.properties().childs().statusViewStyle.childs().symbolTextSource.setValue('ticker');
              }
            } catch (err) {}
          } catch (e) {
            console.warn("[Legend] Error applying legend overrides:", e);
          }
        }

        widget.onChartReady(() => {
          // Load layout if saved, purging any auto-added volume studies
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed && parsed.charts) {
                parsed.charts.forEach(c => {
                  if (c.panes) {
                    c.panes.forEach(p => {
                      if (p.properties && p.properties.legendProperties) {
                        p.properties.legendProperties.showStudyArguments = true;
                      }
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
                            s.state.statusViewStyle.symbolTextSource = 'ticker';
                            s.state.statusViewStyle.showExchange = true;
                            s.state.statusViewStyle.showInterval = true;
                          }
                        });
                      }
                    });
                  }
                });
              }
              widget.load(parsed);
            } catch (e) {
              console.warn("[Layout] Error loading saved layout:", e);
            }
          }

          removeVolumeStudies();

          // Enforce legend overrides immediately and after potential async load
          applyLegendOverrides();
          setTimeout(applyLegendOverrides, 300);
          setTimeout(applyLegendOverrides, 1000);

          // Mount PineScript IDE (dock & right toolbar & bottom tabs)
          try {
            if (window.PineEditorIDE && typeof window.PineEditorIDE.mount === 'function') {
              window.PineEditorIDE.mount(widget);
              window.PineEditorIDE.attachRightToolbarButton(widget);
              window.PineEditorIDE.attachBottomDockTabs(widget);
              // Do NOT attach header buttons; right toolbar & bottom dock tabs already provide clean authentic access
              window.setAppTheme(theme, false);
            }
          } catch (peErr) {
            console.warn("[PineIDE] Error mounting Pine Editor:", peErr);
          }

          // Native chart.showPropertiesDialog preserved

          // Automatically synchronize and render session boxes & dividers if active on chart,
          // or purge any orphaned shapes if no session study is present on chart
          setTimeout(() => {
            try {
              const chart = widget.activeChart();
              if (chart && window.PineIndicators) {
                const studies = chart.getAllStudies ? chart.getAllStudies() : [];
                const hasSession = studies.some(s => s && s.name && s.name.toLowerCase().includes('session'));
                if (hasSession && typeof window.PineIndicators.renderSessionVisuals === 'function') {
                  window.PineIndicators.renderSessionVisuals(chart);
                } else if (!hasSession && typeof window.PineIndicators.clearSessionVisuals === 'function') {
                  window.PineIndicators.clearSessionVisuals(chart);
                }
              }
            } catch (e) {}
          }, 1200);

          // Mount Replay button in TradingView header toolbar
          try {
            if (typeof widget.headerReady === 'function') {
              widget.headerReady().then(() => {
                const replayBtn = widget.createButton({ align: "left" });
                replayBtn.setAttribute("title", "Bar Replay (Scissors mode)");
                replayBtn.setAttribute("id", "header-toolbar-replay");
                replayBtn.classList.add("apply-common-tooltip");
                replayBtn.innerHTML = `
                  <div style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:0 8px;height:100%;color:#d1d4dc;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="6" cy="6" r="3"></circle>
                      <circle cx="6" cy="18" r="3"></circle>
                      <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                      <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                      <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                    </svg>
                    <span style="font-size:13px;font-weight:500;">Replay</span>
                  </div>
                `;
                replayBtn.addEventListener("click", () => {
                  if (window.BAR_REPLAY && window.BAR_REPLAY.active) {
                    showReplayToolbar();
                  } else {
                    requestUserSelectBar();
                  }
                });
              }).catch(e => console.warn("[BarReplay] headerReady warning:", e));
            }
          } catch (btnErr) {
            console.warn("[BarReplay] Error attaching header replay button:", btnErr);
          }

          // Hook iframe header indicators button to ensure fx Indicators button works reliably
          try {
            const hookIframeIndicators = () => {
              const innerDoc = (widget._innerWindow && widget._innerWindow().document) ||
                               document.querySelector("#tv_chart_container iframe")?.contentWindow?.document;
              if (innerDoc && !innerDoc._indicatorsClickHooked) {
                innerDoc._indicatorsClickHooked = true;
                innerDoc.addEventListener('click', (e) => {
                  
                  const replayBtn = e.target.closest('#header-toolbar-replay, [data-name="replay"], button[aria-label*="Replay"], button[title*="Replay"]');
                  if (replayBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.BAR_REPLAY && window.BAR_REPLAY.active) {
                      showReplayToolbar();
                    } else {
                      requestUserSelectBar();
                    }
                    return;
                  }

                  const alertBtn = e.target.closest('[data-name="alerts"], [data-name="alert"], [data-name="create-alert"], button[aria-label*="Alert"], button[title*="Alert"], #header-toolbar-alerts');
                  if (alertBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.PineEditorIDE && typeof window.PineEditorIDE.openCreateAlert === 'function') {
                      window.PineEditorIDE.openCreateAlert();
                    }
                    return;
                  }

                  const btn = e.target.closest('#header-toolbar-indicators, [data-name="indicators"], [data-name="open-indicators-dialog"], button[aria-label*="Indicators"], div[id*="indicators"], [data-role="button"][title*="Indicator"]');
                  if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.PineEditorIDE && typeof window.PineEditorIDE.openIndicatorsModal === 'function') {
                      window.PineEditorIDE.openIndicatorsModal();
                    } else if (window.openIndicatorsModal) {
                      window.openIndicatorsModal();
                    }
                  }
                }, true);
              }
            };
            hookIframeIndicators();
            setTimeout(hookIframeIndicators, 500);
            setTimeout(hookIframeIndicators, 1500);
            setTimeout(hookIframeIndicators, 3000);
          } catch(e) {}

          // Inject styles into iframe to ensure legend and trading buttons never clip
          try {
            const innerDoc = (widget._innerWindow && widget._innerWindow().document) ||
                             document.querySelector("#tv_chart_container iframe")?.contentWindow?.document;
            if (innerDoc && !innerDoc.getElementById("tv-legend-custom-styles")) {
              const style = innerDoc.createElement("style");
              style.id = "tv-legend-custom-styles";
              style.textContent = `
                [class*="legend-"], [data-name="legend"] { overflow: visible !important; max-width: none !important; }
                [class*="legendMainSourceWrapper"] { overflow: visible !important; max-width: 100% !important; }
                [data-name="legend-source-title"], [data-name="legend-source-description"],
                [data-name="legend-source-interval"], [data-name="legend-source-exchange"],
                [class*="mainTitle"], [class*="descTitle"], [class*="intervalTitle"],
                [class*="exchangeTitle"] { visibility: visible !important; opacity: 1 !important; }
                .valuesWrapper, .valuesAdditionalWrapper,
                [class*="valuesWrapper"], [class*="valuesAdditionalWrapper"],
                .valuesWrapper-l31H9iuA, .valuesAdditionalWrapper-l31H9iuA {
                  display: inline-flex !important; flex-wrap: nowrap !important; white-space: nowrap !important;
                  align-items: center !important; overflow: hidden !important; max-height: 24px !important; line-height: 24px !important;
                  visibility: visible !important; opacity: 1 !important;
                }
                [data-name="legend-interval-show-hide-action"], .intervalEye, [class*="intervalEye"], .intervalEye-l31H9iuA {
                  display: none !important; visibility: hidden !important; width: 0 !important; height: 0 !important;
                  pointer-events: none !important; margin: 0 !important; padding: 0 !important; opacity: 0 !important;
                  position: absolute !important; left: -9999px !important;
                }
                [class*="container-hw_3o_pb"], [class*="buttonsWrapper-hw_3o_pb"],
                [class*="sellBuyAndPresetsButtonsContainer"] { overflow: visible !important; }
                .drawingToolbar-BfVZxb4b, [class*="drawingToolbar"], #drawing-toolbar { display: block !important; visibility: visible !important; opacity: 1 !important; }
              `;
              innerDoc.head.appendChild(style);
            }
          } catch (e) {}

          const saveChartLayout = () => {
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
                    console.log(`[BarReplay] onIntervalChanged detected resolution change to ${interval}. Syncing future bars...`);
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
                  const isTick = /^\d+T$/i.test(intervalStr);
                  if (isTick) {
                    const nTicks = parseInt(intervalStr, 10) || 1;
                    const sub = window._activeBarSubscribers ? window._activeBarSubscribers.values().next().value : null;
                    const curTicks = sub ? (sub.ticksCount || 0) : 0;
                    return `${curTicks}/${nTicks}T`;
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

              // Accelerate countdown loop to 60 FPS (requestAnimationFrame)
              if (mainSeries._countdownUpdateTimer) {
                mainSeries._model.clearInterval(mainSeries._countdownUpdateTimer);
                mainSeries._countdownUpdateTimer = null;
              }
              function animateCountdown() {
                mainSeries._priceAxisView?.updateCountdown?.();
                mainSeries._projectionPriceAxisView?.updateCountdown?.();
                requestAnimationFrame(animateCountdown);
              }
              const renderLoop = animateCountdown;
              requestAnimationFrame(renderLoop);
            }
          } catch (e) {
            console.warn("[M18] Runtime PriceAxisView patch warning:", e);
          }

          /* =========================================================================
           * 5. Two-Finger Tap & Trackpad Secondary Click / Settings Gesture Engine
           * ========================================================================= */
          try {
            function openChartOrStudySettings(clientX, clientY) {
              try {
                const activeChart = widget && typeof widget.activeChart === 'function' ? widget.activeChart() : null;
                if (!activeChart) return;

                // 1. Check if tap/click target was a specific indicator or study
                let targetStudyOpened = false;
                try {
                  const cw = activeChart._chartWidget;
                  const panes = cw?._paneWidgets?.value?.() || [];
                  for (const p of panes) {
                    if (typeof p._dataSourceAtPoint === 'function' && typeof clientX === 'number' && typeof clientY === 'number') {
                      const res = p._dataSourceAtPoint(clientX, clientY);
                      if (res && res.source) {
                        const src = res.source;
                        const srcId = typeof src.id === 'function' ? src.id() : (src._id || src.id);
                        const isMain = typeof src.isMainSeries === 'function' ? src.isMainSeries() : false;
                        if (srcId && !isMain) {
                          // Native properties dialog used
                          if (typeof activeChart.showPropertiesDialog === 'function') {
                            activeChart.showPropertiesDialog(srcId);
                            targetStudyOpened = true;
                            break;
                          }
                        }
                      }
                    }
                  }
                } catch (e) {}

                // 2. If no specific study was tapped, open the main chart settings dialog
                if (!targetStudyOpened) {
                  if (typeof activeChart.executeActionById === 'function') {
                    activeChart.executeActionById("chartProperties");
                  }
                }
              } catch (err) {
                console.warn("[Settings Gesture] Error opening settings:", err);
              }
            }
            window.openChartOrStudySettings = openChartOrStudySettings;

            const setupGestureListeners = () => {
              const innerWin = (widget && typeof widget._innerWindow === "function")
                ? widget._innerWindow()
                : document.querySelector("#tv_chart_container iframe")?.contentWindow;
              const innerDoc = innerWin?.document;
              if (!innerDoc || innerDoc._twoFingerSettingsAttached) return;
              innerDoc._twoFingerSettingsAttached = true;

              // A. Touchscreen Two-Finger Tap Gesture
              let twoFingerTouchState = null;
              let lastSingleTapTime = 0;
              let lastSingleTapPos = { x: 0, y: 0 };

              innerDoc.addEventListener('touchstart', (e) => {
                if (e.touches && e.touches.length === 2) {
                  twoFingerTouchState = {
                    startTime: Date.now(),
                    p1: { x: e.touches[0].clientX, y: e.touches[0].clientY },
                    p2: { x: e.touches[1].clientX, y: e.touches[1].clientY },
                    moved: false
                  };
                } else if (e.touches && e.touches.length > 2) {
                  twoFingerTouchState = null;
                }
              }, { passive: true, capture: true });

              innerDoc.addEventListener('touchmove', (e) => {
                if (twoFingerTouchState && e.touches && e.touches.length === 2) {
                  const d1 = Math.hypot(e.touches[0].clientX - twoFingerTouchState.p1.x, e.touches[0].clientY - twoFingerTouchState.p1.y);
                  const d2 = Math.hypot(e.touches[1].clientX - twoFingerTouchState.p2.x, e.touches[1].clientY - twoFingerTouchState.p2.y);
                  if (d1 > 25 || d2 > 25) {
                    twoFingerTouchState.moved = true;
                  }
                }
              }, { passive: true, capture: true });

              innerDoc.addEventListener('touchend', (e) => {
                // Two-finger tap check
                if (twoFingerTouchState && !twoFingerTouchState.moved) {
                  const elapsed = Date.now() - twoFingerTouchState.startTime;
                  if (elapsed >= 30 && elapsed <= 450) {
                    const tapX = (twoFingerTouchState.p1.x + twoFingerTouchState.p2.x) / 2;
                    const tapY = (twoFingerTouchState.p1.y + twoFingerTouchState.p2.y) / 2;
                    twoFingerTouchState = null;
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    openChartOrStudySettings(tapX, tapY);
                    return;
                  }
                }
                twoFingerTouchState = null;

              }, { passive: false, capture: true });

              innerDoc.addEventListener('touchcancel', () => {
                twoFingerTouchState = null;
              }, { passive: true, capture: true });

              // Allow native TradingView context menu on right click / secondary click
              // (Native TradingView context menu includes "Settings..." which opens the dialog)
            };

            setupGestureListeners();
            setTimeout(setupGestureListeners, 500);
            setTimeout(setupGestureListeners, 1500);

            // Periodic cleanup of watermark logo
            setInterval(removeWatermarkLogo, 3000);
          } catch (e) {
            console.warn("[Settings Gesture] Warning setting up gesture engine:", e);
          }
        });
      }

      /* =========================================================================
       * 4. DOM Initialization
       * ========================================================================= */
      window.addEventListener("DOMContentLoaded", () => {
        initChart();
      });
