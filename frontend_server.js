/**
 * High-Performance Node.js Powerhouse Backend Engine & Reverse Proxy
 * 
 * Features:
 * - Ultra-Fast In-Memory Trade State Engine (Sub-1ms GET /trade/bundle, /trade/positions, /trade/orders, /trade/account)
 * - In-Process Pine Script Transpiler & Compiler (<5ms POST /pine/transpile, POST /pine/compile via PineTS CJS)
 * - Dynamic RAM Asset Cache with GZIP pre-compression for instant static asset delivery
 * - TradingView Advanced Charts static assets on http://127.0.0.1:8080
 * - Reverse-proxies UDF market data endpoints (/history, /quotes, /symbols, /time, /search, etc.) to Python backend on port 9000
 * - Reverse-proxies WebSocket streams (/ws/quotes) to ws://127.0.0.1:9000/ws/quotes via low-latency TCP socket tunneling
 * - Autonomous TradingView CDN fallback downloader for missing library chunks
 */

const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { parse: parseUrl } = require('url');

const WEBSITE_PORT = parseInt(process.env.WEBSITE_PORT || '9000', 10);
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '9999', 10);
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = parseInt(process.env.DATAFEED_PORT || process.env.BACKEND_PORT || '8080', 10);
const PUBLIC_DIR = path.resolve(__dirname);

// MIME Types Map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

// ── In-Process PineTS Engine ─────────────────────────────────────────────
let pinets = null;
try {
  const cjsCandidate1 = path.join(PUBLIC_DIR, 'PineTS-main', 'dist', 'pinets.min.cjs');
  const cjsCandidate2 = path.join(PUBLIC_DIR, 'pinets.min.cjs');
  if (fs.existsSync(cjsCandidate1)) {
    pinets = require(cjsCandidate1);
    console.log('[PINE ENGINE] Loaded PineTS CJS from:', cjsCandidate1);
  } else if (fs.existsSync(cjsCandidate2)) {
    pinets = require(cjsCandidate2);
    console.log('[PINE ENGINE] Loaded PineTS CJS from:', cjsCandidate2);
  }
  // Pre-warm the Pine compiler in memory
  if (pinets && typeof pinets.pineToJS === 'function') {
    pinets.pineToJS('//@version=5\nindicator("Warmup", overlay=true)\nplot(close)');
    console.log('[PINE ENGINE] JIT Compiler pre-warmed and ready (sub-5ms transpilation enabled)');
  }
} catch (pineErr) {
  console.warn('[PINE ENGINE WARN] Could not initialize in-process PineTS:', pineErr.message);
}

// ── In-Memory Trade State Engine (0-1ms Subsystem) ──────────────────────
const tradeState = {
  positions: [],
  orders: [],
  account: {
    login: 0,
    balance: 0,
    equity: 0,
    margin: 0,
    margin_free: 0,
    margin_level: 0,
    profit: 0
  },
  version: 1,
  lastUpdated: 0,
  hash: '',
  syncing: false,
  backendOnline: false
};

const backendAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 20,
  keepAliveMsecs: 10000,
  timeout: 3000
});

function computeTradeHash(positions, orders, account) {
  const pStr = (positions || []).map(p => `${p.ticket}:${p.profit}:${p.sl}:${p.tp}:${p.price_current}:${p.volume}`).join(';');
  const oStr = (orders || []).map(o => `${o.ticket}:${o.price_open}:${o.sl}:${o.tp}:${o.volume_current || o.volume}`).join(';');
  const aStr = account ? `${account.balance}:${account.equity}:${account.margin}:${account.margin_free || account.free_margin}:${account.profit}` : '';
  return `${pStr}|${oStr}|${aStr}`;
}

function fetchJsonFromBackend(subpath) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: subpath,
      method: 'GET',
      agent: backendAgent,
      headers: {
        'Accept': 'application/json',
        'Connection': 'keep-alive'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

async function syncTradeStateFromBackend() {
  if (tradeState.syncing) return;
  tradeState.syncing = true;

  try {
    const [posData, ordData, accData] = await Promise.all([
      fetchJsonFromBackend('/trade/positions'),
      fetchJsonFromBackend('/trade/orders'),
      fetchJsonFromBackend('/trade/account')
    ]);

    if (posData !== null || ordData !== null || accData !== null) {
      tradeState.backendOnline = true;
      const positions = Array.isArray(posData) ? posData : (posData && posData.positions ? posData.positions : tradeState.positions);
      const orders = Array.isArray(ordData) ? ordData : (ordData && ordData.orders ? ordData.orders : tradeState.orders);
      const account = (accData && typeof accData === 'object' && !Array.isArray(accData)) ? accData : tradeState.account;

      const newHash = computeTradeHash(positions, orders, account);
      if (newHash !== tradeState.hash || tradeState.lastUpdated === 0) {
        tradeState.positions = positions;
        tradeState.orders = orders;
        tradeState.account = account;
        tradeState.hash = newHash;
        tradeState.version++;
        tradeState.lastUpdated = Date.now();
      }
    } else {
      tradeState.backendOnline = false;
    }
  } catch (err) {
    tradeState.backendOnline = false;
  } finally {
    tradeState.syncing = false;
  }
}

// Background sync loop: sync every 400ms from MT5 backend
setInterval(syncTradeStateFromBackend, 400);
// Trigger immediate initial sync
setTimeout(syncTradeStateFromBackend, 50);

function triggerImmediateSync() {
  setTimeout(syncTradeStateFromBackend, 20);
  setTimeout(syncTradeStateFromBackend, 150);
}

// ── In-Memory Asset Cache (0ms Static Delivery) ─────────────────────────
const assetCache = new Map(); // filePath -> { content, gzip, mtimeMs, contentType }

function getCachedAsset(filePath, isGzipSupported) {
  try {
    const stat = fs.statSync(filePath);
    let entry = assetCache.get(filePath);

    if (!entry || entry.mtimeMs !== stat.mtimeMs) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const rawContent = fs.readFileSync(filePath);
      const isCompressible = /text|javascript|json|wasm|xml|svg/i.test(contentType);
      const gzipContent = isCompressible ? zlib.gzipSync(rawContent, { level: 6 }) : null;

      entry = {
        content: rawContent,
        gzip: gzipContent,
        mtimeMs: stat.mtimeMs,
        contentType: contentType,
        size: rawContent.length
      };

      // Only cache files under 15MB to protect RAM
      if (rawContent.length < 15 * 1024 * 1024) {
        assetCache.set(filePath, entry);
      }
    }

    if (isGzipSupported && entry.gzip) {
      return {
        buffer: entry.gzip,
        contentType: entry.contentType,
        isGzip: true,
        mtimeMs: entry.mtimeMs
      };
    }
    return {
      buffer: entry.content,
      contentType: entry.contentType,
      isGzip: false,
      mtimeMs: entry.mtimeMs
    };
  } catch (e) {
    return null;
  }
}

// Invalidate cache on file changes in PUBLIC_DIR
try {
  fs.watch(PUBLIC_DIR, { recursive: false }, (event, filename) => {
    if (filename) {
      const full = path.join(PUBLIC_DIR, filename);
      assetCache.delete(full);
    }
  });
} catch (e) {}

// API routes to reverse proxy to Python backend
const PROXY_PREFIXES = [
  '/config',
  '/symbols',
  '/history',
  '/time',
  '/ticks',
  '/search',
  '/quotes',
  '/marks',
  '/timescale_marks',
  '/trade',
  '/order',
  '/health',
  '/market_status',
  '/symbols_status',
  '/cached_charts',
  '/pine',
  '/pine-converter',
  '/indicators',
  '/openapi.json',
  '/docs',
  '/redoc',
  '/api/',
];

function shouldProxy(pathname) {
  if (!pathname) return false;
  const lower = pathname.toLowerCase();
  for (const prefix of PROXY_PREFIXES) {
    if (lower === prefix || lower.startsWith(prefix + '/') || lower.startsWith(prefix + '?') || lower.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

// ── Native In-Memory Route Handlers ─────────────────────────────────────
function handleTradeBundle(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const clientETag = req.headers['if-none-match'];
  const query = parseUrl(req.url, true).query;
  const clientVersion = clientETag || query.v;

  if (clientVersion && (clientVersion === String(tradeState.version) || clientVersion === tradeState.hash)) {
    res.writeHead(304);
    res.end();
    return;
  }

  const payload = JSON.stringify({
    s: 'ok',
    version: tradeState.version,
    hash: tradeState.hash,
    lastUpdated: tradeState.lastUpdated,
    backendOnline: tradeState.backendOnline,
    positions: tradeState.positions,
    orders: tradeState.orders,
    account: tradeState.account,
    serverTime: Date.now()
  });

  res.setHeader('ETag', String(tradeState.version));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(payload));
  res.writeHead(200);
  res.end(payload);
}

function handleInMemoryTradePositions(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const payload = JSON.stringify(tradeState.positions);
  res.writeHead(200, { 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function handleInMemoryTradeOrders(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const payload = JSON.stringify(tradeState.orders);
  res.writeHead(200, { 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function handleInMemoryTradeAccount(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const payload = JSON.stringify(tradeState.account);
  res.writeHead(200, { 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function handlePineTranspile(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}');
      const source = (payload.source || payload.code || '').trim();
      if (!source) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'PineScript source code is empty' }));
        return;
      }

      if (!pinets || typeof pinets.pineToJS !== 'function') {
        // Fall back to backend proxy if in-process pinets is not loaded
        return handleProxy(req, res);
      }

      const t0 = Date.now();
      const pRes = pinets.pineToJS(source);
      const duration = Date.now() - t0;

      if (pRes && pRes.success === false) {
        const lineColMatch = (pRes.error || '').match(/(?:at|line)\s*(\d+)(?::|,?\s*col(?:umn)?\s*)(\d+)?/i);
        const l = (typeof pRes.line === 'number') ? pRes.line : (lineColMatch ? parseInt(lineColMatch[1], 10) : 1);
        const c = (typeof pRes.column === 'number') ? pRes.column : ((lineColMatch && lineColMatch[2]) ? parseInt(lineColMatch[2], 10) : 1);
        const errs = (Array.isArray(pRes.errors) && pRes.errors.length > 0)
          ? pRes.errors
          : [{ line: l, column: c, message: pRes.error, severity: 'error' }];

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: pRes.error,
          line: l,
          column: c,
          errors: errs,
          durationMs: duration
        }));
        return;
      }

      // Server-Side Metadata Parsing
      let title = "Custom Script";
      let isOverlay = false;
      let shortTitle = "";
      const indMatch = source.match(/(?:indicator|strategy|study)\s*\(\s*(?:title\s*=\s*)?["']([^"']+)["'](?:[\s\S]*?overlay\s*=\s*(true|false))?/i);
      if (indMatch) {
        title = indMatch[1] || title;
        if (indMatch[2]) isOverlay = indMatch[2].toLowerCase() === 'true';
      }
      if (!isOverlay) {
        const overlayExplicit = source.match(/overlay\s*=\s*(true|false)/i);
        if (overlayExplicit) isOverlay = overlayExplicit[1].toLowerCase() === 'true';
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        version: pRes.version || 5,
        title: title,
        isOverlay: isOverlay,
        shortTitle: shortTitle || title,
        code: pRes.code,
        ast: pRes.ast,
        inputs: pRes.inputs || [],
        plots: pRes.plots || [],
        durationMs: duration,
        engine: 'NodeJS-InProcess-PineTS'
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  });
}

// ── Julia LLVM SIMD Microservice Proxy (port 8085) ─────────────────────
function handleJuliaProxy(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const subPath = req.url.replace(/^\/julia/, '') || '/';
  const options = {
    hostname: '127.0.0.1',
    port: 8085,
    path: subPath,
    method: req.method,
    headers: { ...req.headers, host: '127.0.0.1:8085' }
  };

  const juliaReq = http.request(options, (juliaRes) => {
    res.writeHead(juliaRes.statusCode, {
      ...juliaRes.headers,
      'Access-Control-Allow-Origin': '*'
    });
    juliaRes.pipe(res);
  });

  juliaReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ s: 'error', error: 'Julia server unavailable: ' + err.message }));
    }
  });

  req.pipe(juliaReq);
}

// ── In-Memory Quotes Cache (350ms Micro-Cache) ──────────────────────────
const quotesCache = new Map(); // key -> { buffer, contentType, expiresAt }

function handleQuotes(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const now = Date.now();
  const cacheKey = req.url;
  const cached = quotesCache.get(cacheKey);

  if (cached && now < cached.expiresAt) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Content-Length', cached.buffer.length);
    res.setHeader('X-Cache', 'HIT-RAM');
    res.writeHead(200);
    res.end(cached.buffer);
    return;
  }

  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: req.url,
    method: 'GET',
    agent: backendAgent,
    headers: {
      ...req.headers,
      host: `${BACKEND_HOST}:${BACKEND_PORT}`,
      'x-forwarded-for': req.socket.remoteAddress || '127.0.0.1',
      'x-forwarded-proto': 'http',
      'x-forwarded-host': req.headers.host || `127.0.0.1:${FRONTEND_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const chunks = [];
    proxyRes.on('data', chunk => chunks.push(chunk));
    proxyRes.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const contentType = proxyRes.headers['content-type'] || 'application/json; charset=utf-8';
      if (proxyRes.statusCode === 200) {
        quotesCache.set(cacheKey, {
          buffer: buffer,
          contentType: contentType,
          expiresAt: Date.now() + 350
        });
      }
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS'
      });
      res.end(buffer);
    });
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ s: 'error', errmsg: 'Backend unreachable: ' + err.message }));
    }
  });

  proxyReq.end();
}

// ── In-Memory General API Cache (Symbols, Config, History) ───────────────
const apiCache = new Map(); // key -> { buffer, contentType, expiresAt }

function handleCachedProxy(req, res, ttlMs) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const now = Date.now();
  const cacheKey = req.url;
  const cached = apiCache.get(cacheKey);

  if (cached && now < cached.expiresAt) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Content-Length', cached.buffer.length);
    res.setHeader('X-Cache', 'HIT-RAM');
    res.writeHead(200);
    res.end(cached.buffer);
    return;
  }

  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: req.url,
    method: 'GET',
    agent: backendAgent,
    headers: {
      ...req.headers,
      'accept-encoding': 'identity',
      host: `${BACKEND_HOST}:${BACKEND_PORT}`,
      'x-forwarded-for': req.socket.remoteAddress || '127.0.0.1',
      'x-forwarded-proto': 'http',
      'x-forwarded-host': req.headers.host || `127.0.0.1:${PROXY_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const chunks = [];
    proxyRes.on('data', chunk => chunks.push(chunk));
    proxyRes.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const contentType = proxyRes.headers['content-type'] || 'application/json; charset=utf-8';
      if (proxyRes.statusCode === 200) {
        apiCache.set(cacheKey, {
          buffer: buffer,
          contentType: contentType,
          expiresAt: Date.now() + ttlMs
        });
      }
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS'
      });
      res.end(buffer);
    });
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ s: 'error', errmsg: 'Backend unreachable: ' + err.message }));
    }
  });

  proxyReq.end();
}

// ── Dynamic HTML Generation Engine (Sub-1ms Bootstrap Delivery) ──────────
function handleDynamicHtml(req, res, filePath) {
  try {
    let html = fs.readFileSync(filePath, 'utf-8');
    const bootstrapPayload = JSON.stringify({
      serverTime: Date.now(),
      version: tradeState.version,
      backendOnline: tradeState.backendOnline,
      positions: tradeState.positions,
      orders: tradeState.orders,
      account: tradeState.account
    });

    const injection = `
    <!-- Dynamic State Injected by Node.js Powerhouse Engine -->
    <script id="__NODE_POWERED_BOOTSTRAP__">
      window.__NODE_SERVER_STATE__ = ${bootstrapPayload};
    </script>
  </head>`;

    html = html.replace('</head>', injection);
    const buffer = Buffer.from(html, 'utf-8');
    const acceptEncoding = req.headers['accept-encoding'] || '';

    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Powered-By': 'NodeJS-Powerhouse-DynamicHTML'
    };

    if (acceptEncoding.includes('gzip')) {
      headers['Content-Encoding'] = 'gzip';
      const gzip = zlib.gzipSync(buffer, { level: 6 });
      headers['Content-Length'] = gzip.length;
      res.writeHead(200, headers);
      res.end(gzip);
    } else {
      headers['Content-Length'] = buffer.length;
      res.writeHead(200, headers);
      res.end(buffer);
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Dynamic HTML Generation Error: ' + err.message);
  }
}

// ── HTTP Reverse Proxy Handler ──────────────────────────────────────────
function handleProxy(req, res) {
  const isModifyingTrade = req.method === 'POST' && (req.url.startsWith('/trade/') || req.url.startsWith('/order'));

  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      'accept-encoding': 'identity',
      host: `${BACKEND_HOST}:${BACKEND_PORT}`,
      'x-forwarded-for': req.socket.remoteAddress || '127.0.0.1',
      'x-forwarded-proto': 'http',
      'x-forwarded-host': req.headers.host || `127.0.0.1:${PROXY_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    headers['access-control-allow-origin'] = '*';
    headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH';
    headers['access-control-allow-headers'] = '*';

    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);

    // If trade order was placed/modified/closed, trigger fast background sync
    if (isModifyingTrade) {
      proxyRes.on('end', () => {
        triggerImmediateSync();
      });
    }
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({
        s: 'error',
        errmsg: `Backend proxy error: Python backend at ${BACKEND_HOST}:${BACKEND_PORT} is unreachable. (${err.message})`
      }));
    }
  });

  req.pipe(proxyReq);
}

// ── TradingView CDN Fallback & Proxy Downloader ────────────────────────
const TV_CDN_BASE = process.env.CDN_URL || 'https://trading-terminal.tradingview-widget.com';

function fetchFromCdnAndServe(req, res, remoteSubpath, targetSavePath, safePath) {
  const remoteUrl = `${TV_CDN_BASE}${remoteSubpath.startsWith('/') ? '' : '/'}${remoteSubpath}`;
  console.log(`[CDN PROXY] Missing locally: ${safePath} -> Fetching from TV CDN: ${remoteUrl}`);

  const cdnReq = https.get(remoteUrl, (cdnRes) => {
    if (cdnRes.statusCode !== 200) {
      console.warn(`[CDN PROXY ${cdnRes.statusCode}] Remote CDN returned status ${cdnRes.statusCode} for ${remoteUrl}`);
      if (!res.headersSent) {
        res.writeHead(cdnRes.statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404 Not Found: ${safePath}`);
      }
      return;
    }

    const chunks = [];
    cdnRes.on('data', (c) => chunks.push(c));
    cdnRes.on('end', () => {
      const buffer = Buffer.concat(chunks);
      try {
        const dir = path.dirname(targetSavePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const tempPath = targetSavePath + `.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;
        fs.writeFileSync(tempPath, buffer);
        fs.renameSync(tempPath, targetSavePath);
        console.log(`[CDN SAVED] Cached to local disk: ${targetSavePath} (${buffer.length} bytes)`);
      } catch (fsErr) {
        console.warn(`[CDN CACHE WARN] Could not write cache file ${targetSavePath}:`, fsErr.message);
      }

      if (!res.headersSent) {
        const ext = path.extname(targetSavePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || cdnRes.headers['content-type'] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': buffer.length,
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=86400, immutable'
        });
        res.end(buffer);
      }
    });
  });

  cdnReq.setTimeout(5000, () => {
    cdnReq.destroy(new Error('CDN request timed out'));
  });

  cdnReq.on('error', (err) => {
    console.error(`[CDN ERROR] Failed to fetch ${remoteUrl}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`502 Bad Gateway: TV CDN fetch error: ${err.message}`);
    }
  });
}

// ── Static File Server Handler ──────────────────────────────────────────
function handleStatic(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  let safePath = pathname === '/' ? '/index.html' : pathname;
  try {
    safePath = decodeURIComponent(safePath);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  // Dynamic HTML Generation for index.html (Injects live in-memory server state)
  if (path.basename(filePath).toLowerCase() === 'index.html') {
    return handleDynamicHtml(req, res, filePath);
  }

  // Fast In-Memory Cache Lookup for static files
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const isGzipSupported = acceptEncoding.includes('gzip');
  const cached = getCachedAsset(filePath, isGzipSupported);

  if (cached) {
    const isIndex = path.basename(filePath).toLowerCase() === 'index.html';
    const headers = {
      'Content-Type': cached.contentType,
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    };

    if (cached.isGzip) {
      headers['Content-Encoding'] = 'gzip';
    }
    headers['Content-Length'] = cached.buffer.length;

    if (isIndex) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    } else if (filePath.includes('charting_library') || filePath.includes('bundles') || filePath.endsWith('.wasm')) {
      headers['Cache-Control'] = 'public, max-age=86400, immutable';
    } else {
      headers['Cache-Control'] = 'no-cache';
    }

    res.writeHead(200, headers);
    res.end(cached.buffer);
    return;
  }

  // If not cached, check filesystem and CDN fallback
  fs.stat(filePath, (err, stats) => {
    if (err) {
      if (err.code === 'ENOENT') {
        const altPath = filePath + '.html';
        if (fs.existsSync(altPath)) {
          return serveFile(req, res, altPath);
        }

        const cleanSubpath = safePath.replace(/^\/+/, '');
        if (cleanSubpath.startsWith('bundles/')) {
          const altBundle = path.join(PUBLIC_DIR, 'charting_library', cleanSubpath);
          if (fs.existsSync(altBundle)) {
            return serveFile(req, res, altBundle);
          }
        }

        const isCdnCandidate = cleanSubpath.startsWith('bundles/') ||
                               cleanSubpath.startsWith('charting_library/');

        if (isCdnCandidate) {
          const remoteSubpath = cleanSubpath.startsWith('bundles/')
            ? '/charting_library/' + cleanSubpath
            : '/' + cleanSubpath;
          const targetSavePath = cleanSubpath.startsWith('bundles/')
            ? path.join(PUBLIC_DIR, 'charting_library', cleanSubpath)
            : filePath;
          return fetchFromCdnAndServe(req, res, remoteSubpath, targetSavePath, safePath);
        }

        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404 Not Found: ${safePath}`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`500 Server Error: ${err.message}`);
      }
      return;
    }

    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return serveFile(req, res, indexPath);
      }
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Directory listing forbidden');
      return;
    }

    serveFile(req, res, filePath, stats);
  });
}

function serveFile(req, res, filePath, stats) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const isIndex = path.basename(filePath).toLowerCase() === 'index.html';

  const headers = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  };

  if (isIndex) {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  } else if (filePath.includes('charting_library') || filePath.includes('bundles') || ext === '.wasm') {
    headers['Cache-Control'] = 'public, max-age=86400, immutable';
  } else {
    headers['Cache-Control'] = 'no-cache';
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  const isCompressible = /text|javascript|json|wasm|xml|svg/i.test(contentType);

  if (isCompressible && acceptEncoding.includes('gzip')) {
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    const rawStream = fs.createReadStream(filePath);
    const gzip = zlib.createGzip({ level: 6 });
    rawStream.pipe(gzip).pipe(res);
  } else {
    if (stats && stats.size !== undefined) {
      headers['Content-Length'] = stats.size;
    }
    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}

// ── Create Main HTTP Server ─────────────────────────────────────────────
// ── Request Handler & Dispatcher ─────────────────────────────────────────
function handleHttpRequest(req, res) {
  // Global CORS Preflight Handler
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = parseUrl(req.url);
  const pathname = parsed.pathname || '/';

  // 1. High-Priority In-Memory Node Routes
  if (pathname === '/trade/bundle' || pathname === '/trade/state') {
    return handleTradeBundle(req, res);
  }
  if (req.method === 'GET' && pathname === '/trade/positions' && tradeState.lastUpdated > 0) {
    return handleInMemoryTradePositions(req, res);
  }
  if (req.method === 'GET' && pathname === '/trade/orders' && tradeState.lastUpdated > 0) {
    return handleInMemoryTradeOrders(req, res);
  }
  if (req.method === 'GET' && pathname === '/trade/account' && tradeState.lastUpdated > 0) {
    return handleInMemoryTradeAccount(req, res);
  }
  if (pathname.startsWith('/julia')) {
    return handleJuliaProxy(req, res);
  }
  if (req.method === 'POST' && (pathname === '/pine/transpile' || pathname === '/pine/compile')) {
    return handlePineTranspile(req, res);
  }
  if (req.method === 'GET' && pathname === '/quotes') {
    return handleQuotes(req, res);
  }
  if (req.method === 'GET' && pathname === '/config') {
    return handleCachedProxy(req, res, 3600000); // 1 hour
  }
  if (req.method === 'GET' && pathname === '/symbols') {
    return handleCachedProxy(req, res, 60000); // 60s
  }
  if (req.method === 'GET' && pathname === '/history') {
    return handleCachedProxy(req, res, 800); // 800ms
  }

  // 2. Reverse-Proxy API calls to Python backend
  if (shouldProxy(pathname)) {
    handleProxy(req, res);
  } else {
    // 3. Ultra-Fast Static Asset Delivery & Dynamic HTML
    handleStatic(req, res, pathname);
  }
}

// ── WebSocket Tunneling Reverse Proxy ────────────────────────────────────
function handleUpgrade(req, clientSocket, head) {
  const backendSocket = net.connect(BACKEND_PORT, BACKEND_HOST, () => {
    backendSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i];
      const val = req.rawHeaders[i + 1];
      if (key.toLowerCase() === 'host') {
        backendSocket.write(`Host: ${BACKEND_HOST}:${BACKEND_PORT}\r\n`);
      } else {
        backendSocket.write(`${key}: ${val}\r\n`);
      }
    }
    backendSocket.write('\r\n');

    if (head && head.length > 0) {
      backendSocket.write(head);
    }

    backendSocket.pipe(clientSocket);
    clientSocket.pipe(backendSocket);
  });

  backendSocket.on('error', (err) => {
    console.error('[WS PROXY ERROR] Backend WebSocket connection error:', err.message);
    clientSocket.destroy();
  });

  clientSocket.on('error', () => {
    backendSocket.destroy();
  });

  clientSocket.on('close', () => {
    backendSocket.end();
  });

  backendSocket.on('close', () => {
    clientSocket.end();
  });
}

// ── Create Website & Proxy HTTP Servers ───────────────────────────────────
// Server 1: Website URL Server on Port 9000 (Dynamic HTML, Charts, Static Assets)
const websiteServer = http.createServer(handleHttpRequest);
websiteServer.on('upgrade', handleUpgrade);

// Server 2: Proxy Site Server on Port 9999 (In-Memory Engine & Reverse Proxy)
const proxyServer = http.createServer(handleHttpRequest);
proxyServer.on('upgrade', handleUpgrade);

// ── Start Both Listeners ────────────────────────────────────────────────
let serversStarted = 0;
function onServerStarted() {
  serversStarted++;
  if (serversStarted === 2) {
    console.log('================================================================================');
    console.log('  NODE.JS POWERHOUSE ENGINE & TRI-SERVICE SYSTEM READY');
    console.log('================================================================================');
    console.log(`  1. Website URL:      http://localhost:${WEBSITE_PORT} (Dynamic HTML & TV UI)`);
    console.log(`  2. Proxy Site:       http://127.0.0.1:${PROXY_PORT} (In-Memory Engine & Reverse Proxy)`);
    console.log(`  3. Datafeed Engine:  http://${BACKEND_HOST}:${BACKEND_PORT} (Python FastAPI MT5 Backend)`);
    console.log(`  In-Memory Engine:    http://127.0.0.1:${PROXY_PORT}/trade/bundle (Sub-1ms RAM state)`);
    console.log(`  PineTS Transpiler:   http://127.0.0.1:${PROXY_PORT}/pine/transpile (In-Process AST)`);
    console.log(`  WebSocket URL:       ws://127.0.0.1:${PROXY_PORT}/ws/quotes`);
    console.log('================================================================================');
  }
}

websiteServer.listen(WEBSITE_PORT, '0.0.0.0', onServerStarted);
proxyServer.listen(PROXY_PORT, '0.0.0.0', onServerStarted);

process.on('SIGINT', () => {
  websiteServer.close();
  proxyServer.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  websiteServer.close();
  proxyServer.close();
  process.exit(0);
});

