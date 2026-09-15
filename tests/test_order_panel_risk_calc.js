/**
 * Test Suite: Order Execution Panel & Automated Risk / Lot Size Calculator
 * Validates index.html DOM structure, CSS styles, contract specifications,
 * and exact mathematical lot sizing formulas for XAUUSD (100 oz contract).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const indexPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(indexPath, 'utf-8');

console.log('================================================================');
console.log('  Testing Order Execution Panel & Risk Calculator in index.html');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// Test Group 1: HTML DOM Structure & Components
// -----------------------------------------------------------------------------
console.log('[Group 1: DOM Elements & Structural Contracts]');

test('order-panel-drawer container exists with collapsed class', () => {
  assert(html.includes('id="order-panel-drawer"'), 'Missing #order-panel-drawer container');
  assert(html.includes('class="order-panel-drawer collapsed"'), 'Drawer should start collapsed');
});

test('Drawer header includes icon, title, symbol badge (XAUUSD.) and action buttons', () => {
  assert(html.includes('op-header-title'), 'Missing op-header-title');
  assert(html.includes('op-symbol-badge') && html.includes('XAUUSD.'), 'Missing XAUUSD. badge');
  assert(html.includes('id="op-btn-expand"'), 'Missing expand toggle button');
  assert(html.includes('id="op-btn-refresh-quotes"'), 'Missing quote refresh button');
  assert(html.includes('id="op-btn-close-drawer"'), 'Missing close button');
});

test('Live market rates strip displays Bid, Spread, and Ask', () => {
  assert(html.includes('id="op-live-bid"'), 'Missing #op-live-bid element');
  assert(html.includes('id="op-live-spread"'), 'Missing #op-live-spread element');
  assert(html.includes('id="op-live-ask"'), 'Missing #op-live-ask element');
});

test('Tab switcher supports Market Execution and Pending Order', () => {
  assert(html.includes('id="op-tab-btn-market"'), 'Missing Market Execution tab button');
  assert(html.includes('id="op-tab-btn-pending"'), 'Missing Pending Order tab button');
  assert(html.includes('id="op-tab-market"'), 'Missing Market tab content');
  assert(html.includes('id="op-tab-pending"'), 'Missing Pending tab content');
});

test('Market Execution tab contains Volume stepper, presets, SL/TP inputs, and action buttons', () => {
  assert(html.includes('id="op-market-volume"'), 'Missing #op-market-volume');
  assert(html.includes('id="op-market-sl"'), 'Missing #op-market-sl');
  assert(html.includes('id="op-market-tp"'), 'Missing #op-market-tp');
  assert(html.includes('id="op-market-rr"'), 'Missing #op-market-rr (risk/reward ratio)');
  assert(html.includes('id="op-btn-sell"'), 'Missing #op-btn-sell');
  assert(html.includes('id="op-btn-buy"'), 'Missing #op-btn-buy');
});

test('Pending Order tab supports Buy Limit, Sell Limit, Buy Stop, Sell Stop and Expiration', () => {
  assert(html.includes('value="buy_limit"'), 'Missing buy_limit option');
  assert(html.includes('value="sell_limit"'), 'Missing sell_limit option');
  assert(html.includes('value="buy_stop"'), 'Missing buy_stop option');
  assert(html.includes('value="sell_stop"'), 'Missing sell_stop option');
  assert(html.includes('id="op-pending-price"'), 'Missing #op-pending-price');
  assert(html.includes('id="op-pending-volume"'), 'Missing #op-pending-volume');
  assert(html.includes('id="op-pending-expiry-type"'), 'Missing expiration type selector');
  assert(html.includes('id="op-btn-place-pending"'), 'Missing place pending button');
});

test('Automatic Risk & Lot Size Calculator Accordion exists with required inputs', () => {
  assert(html.includes('op-calculator-card'), 'Missing op-calculator-card');
  assert(html.includes('id="op-calc-balance"'), 'Missing account balance stat');
  assert(html.includes('id="op-calc-margin"'), 'Missing free margin stat');
  assert(html.includes('id="op-calc-risk-pct"'), 'Missing risk percentage input');
  assert(html.includes('id="op-calc-sl-pips"'), 'Missing stop loss pips input');
  assert(html.includes('id="op-calc-recommended-lots"'), 'Missing recommended lot display');
  assert(html.includes('id="op-btn-apply-lot"'), 'Missing apply lot size button');
});

test('Navigation & Toolbar triggers exist in #buttons and widget.headerReady()', () => {
  assert(html.includes('id="btn-toggle-order-panel"'), 'Missing toggle button in bottom #buttons');
  assert(html.includes('toggleOrderPanel()'), 'toggleOrderPanel() must be bound to button');
  assert(html.includes('New Order (F9)'), 'Header toolbar should have New Order button');
});

// -----------------------------------------------------------------------------
// Test Group 2: CSS Styles & Responsive Architecture
// -----------------------------------------------------------------------------
console.log('\n[Group 2: CSS Styling & Theme Conformance]');

test('order-panel-drawer styles include docked layout, collapsed transform, and dark theme colors', () => {
  assert(html.includes('.order-panel-drawer {'), 'Missing .order-panel-drawer CSS');
  assert(html.includes('transform: translateX(100%)'), 'Collapsed state must slide off-screen');
  assert(html.includes('.order-panel-drawer.expanded {'), 'Expandable width modifier must exist');
  assert(html.includes('width: 550px'), 'Expanded width should be 550px');
  assert(html.includes('--tv-bg-secondary'), 'Should use unified TV theme variables');
});

test('Execution buttons styled with error (red) for Sell and accent (blue) for Buy', () => {
  assert(html.includes('.op-btn-sell {') && html.includes('var(--tv-error)'), 'Sell button must use --tv-error');
  assert(html.includes('.op-btn-buy {') && html.includes('var(--tv-accent)'), 'Buy button must use --tv-accent');
});

// -----------------------------------------------------------------------------
// Test Group 3: JavaScript Engine & Mathematical Precision
// -----------------------------------------------------------------------------
console.log('\n[Group 3: JavaScript Engine & XAUUSD Contract Mathematics]');

// Extract OrderPanel code from index.html and evaluate in isolated context
const opStart = html.indexOf('const OrderPanel = {');
const opEnd = html.indexOf('function toggleOrderPanel()');
assert(opStart !== -1 && opEnd !== -1, 'Could not locate OrderPanel block in index.html');
const opCode = html.substring(opStart, opEnd).trim();

// Mock DOM elements and browser environment
const mockDom = {
  elements: {},
  getElementById(id) {
    if (!this.elements[id]) {
      this.elements[id] = {
        id,
        value: '1.0',
        innerText: '',
        innerHTML: '',
        style: {},
        classList: {
          classes: new Set(['collapsed']),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          toggle(c, force) {
            if (force === undefined) {
              this.classes.has(c) ? this.classes.delete(c) : this.classes.add(c);
            } else {
              force ? this.classes.add(c) : this.classes.delete(c);
            }
          },
          contains(c) { return this.classes.has(c); }
        },
        addEventListener() {}
      };
    }
    return this.elements[id];
  },
  querySelectorAll() { return []; }
};

const context = {
  window: {
    addEventListener: () => {},
    location: { port: '9000', hostname: '127.0.0.1' },
    detectDatafeedUrl: async () => 'http://127.0.0.1:9000'
  },
  document: mockDom,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  parseFloat: parseFloat,
  parseInt: parseInt,
  isNaN: isNaN,
  Math: Math
};

// Evaluate the OrderPanel object declaration
const vm = require('vm');
vm.createContext(context);
vm.runInContext(opCode, context);

const OP = context.OrderPanel;

test('OrderPanel initialized with correct XAUUSD specifications', () => {
  assert.strictEqual(OP.state.symbol, 'XAUUSD.');
  assert.strictEqual(OP.state.specs.contractSize, 100.0, 'Contract size must be 100 oz');
  assert.strictEqual(OP.state.specs.tickSize, 0.01, 'Tick size must be 0.01');
  assert.strictEqual(OP.state.specs.tickValue, 1.0, 'Tick value must be $1.00');
  assert.strictEqual(OP.state.specs.pipValue, 10.0, 'Pip value per standard lot must be $10.00');
  assert.strictEqual(OP.state.specs.volumeMin, 0.01, 'Min volume must be 0.01');
  assert.strictEqual(OP.state.specs.volumeMax, 20.0, 'Max volume must be 20.00');
  assert.strictEqual(OP.state.specs.volumeStep, 0.01, 'Volume step must be 0.01');
});

test('Mathematical Formula 1: Standard $100k account, 1% risk, 50 pips SL -> Exactly 2.00 Lots', () => {
  // Balance = $100,000
  // Risk = 1% -> $1,000 cash risk
  // SL = 50 pips ($5.00 price move)
  // Pip value per lot = 100 oz * $0.10 = $10.00
  // Lots = $1,000 / (50 * $10.00) = 2.00
  const res = OP.calculateLotSize(100000.0, 1.0, 50);
  assert.strictEqual(res.cashRisk, 1000.0);
  assert.strictEqual(res.priceDistance, 5.0);
  assert.strictEqual(res.recommendedLots, 2.0);
  assert.strictEqual(res.exactLoss, 1000.0);
});

test('Mathematical Formula 2: $50k account, 2% risk, 20 pips SL -> Exactly 5.00 Lots', () => {
  // Cash Risk = $50,000 * 0.02 = $1,000
  // SL = 20 pips ($2.00 price move)
  // Lots = $1,000 / (20 * 10) = $1,000 / 200 = 5.00 lots
  const res = OP.calculateLotSize(50000.0, 2.0, 20);
  assert.strictEqual(res.cashRisk, 1000.0);
  assert.strictEqual(res.recommendedLots, 5.0);
  assert.strictEqual(res.exactLoss, 1000.0);
});

test('Mathematical Formula 3: $10k account, 0.5% risk, 100 pips SL -> Exactly 0.05 Lots', () => {
  // Cash Risk = $10,000 * 0.005 = $50
  // SL = 100 pips ($10.00 price move)
  // Lots = $50 / (100 * 10) = $50 / 1000 = 0.05 lots
  const res = OP.calculateLotSize(10000.0, 0.5, 100);
  assert.strictEqual(res.cashRisk, 50.0);
  assert.strictEqual(res.recommendedLots, 0.05);
  assert.strictEqual(res.exactLoss, 50.0);
});

test('Volume Stepping: Ideal lots 0.339 should round down to 0.33 lots', () => {
  // Balance = $10,000, Risk = 1.017% -> $101.70 cash risk
  // SL = 30 pips -> 30 * 10 = 300
  // 101.70 / 300 = 0.339
  const res = OP.calculateLotSize(10000.0, 1.017, 30);
  assert.strictEqual(res.recommendedLots, 0.33);
});

test('Min Volume Clamping: Very tiny risk clamped to minimum 0.01 lot', () => {
  // Balance = $100, Risk = 1% ($1), SL = 100 pips ($1000/lot) -> ideal lots = 0.001
  const res = OP.calculateLotSize(100.0, 1.0, 100);
  assert.strictEqual(res.recommendedLots, 0.01, 'Must clamp to 0.01');
});

test('Max Volume Clamping: Massive account clamped to broker maximum 20.00 lots', () => {
  // Balance = $10,000,000, Risk = 5% ($500,000), SL = 10 pips -> ideal lots = 5,000
  const res = OP.calculateLotSize(10000000.0, 5.0, 10);
  assert.strictEqual(res.recommendedLots, 20.0, 'Must clamp to max 20.00 lots');
});

test('Boundary & Divide-by-Zero Defense: Zero pips or zero balance handled without NaN or crash', () => {
  const zeroPipRes = OP.calculateLotSize(100000.0, 1.0, 0);
  assert(!isNaN(zeroPipRes.recommendedLots), 'Recommended lots must not be NaN');
  assert.strictEqual(zeroPipRes.recommendedLots, 0.01);
  assert(zeroPipRes.error !== null, 'Should return an error description');

  const zeroBalRes = OP.calculateLotSize(0, 1.0, 50);
  assert(!isNaN(zeroBalRes.recommendedLots), 'Recommended lots must not be NaN');
  assert.strictEqual(zeroBalRes.recommendedLots, 0.01);
});

test('Drawer state toggles open, close, and expand seamlessly', () => {
  OP.state.isOpen = false;
  OP.state.isExpanded = false;

  OP.open();
  assert.strictEqual(OP.state.isOpen, true);

  OP.toggleExpand();
  assert.strictEqual(OP.state.isExpanded, true);

  OP.toggleExpand();
  assert.strictEqual(OP.state.isExpanded, false);

  OP.close();
  assert.strictEqual(OP.state.isOpen, false);
});

console.log('\n================================================================');
console.log(`  RESULTS: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY!`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
