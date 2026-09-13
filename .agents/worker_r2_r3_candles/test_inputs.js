const pinets = require('../../PineTS-main/dist/pinets.min.cjs');
const { Indicator } = pinets;

const source = `//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("AAPL", "Symbol")
res = input.timeframe("D", "Resolution")
upColor = input.color(color.green, "Bullish Body Color")
downColor = input.color(color.red, "Bearish Body Color")
wickColor = input.color(color.gray, "Wick Color")
borderUpColor = input.color(color.green, "Bullish Border Color")
borderDownColor = input.color(color.red, "Bearish Border Color")
showBorders = input.bool(true, "Show Borders")
showWicks = input.bool(true, "Show Wicks")
[o, h, l, c] = request.security(sym, res, [open, high, low, close])
plotcandle(o, h, l, c, title="Candles", color=c >= o ? upColor : downColor, wickcolor=showWicks ? wickColor : na, bordercolor=showBorders ? (c >= o ? borderUpColor : borderDownColor) : na)
`;

const ind = Indicator.from(source);
const inputsMeta = ind.getInputsMeta();

const tvInputs = [];
const defaultInputs = {};

inputsMeta.forEach((inp, idx) => {
  const inputId = inp.varId || inp.id || `input_${idx}`;
  const inputName = inp.title || inp.name || inp.varId || `Input ${idx + 1}`;
  let defval = inp.defval;
  let tvType = 'text';

  const t = String(inp.type || '').toLowerCase();
  if (t === 'symbol') {
    tvType = 'symbol';
    if (!defval) defval = 'AAPL';
    tvInputs.push({
      id: inputId,
      name: inputName,
      defval: String(defval),
      type: 'symbol'
    });
  } else if (t === 'timeframe' || t === 'resolution') {
    tvType = 'resolution';
    if (defval === undefined || defval === null) defval = 'D';
    tvInputs.push({
      id: inputId,
      name: inputName,
      defval: String(defval),
      type: 'resolution',
      isMTFResolution: true
    });
  } else if (t === 'bool' || t === 'boolean') {
    tvType = 'bool';
    defval = Boolean(defval);
    tvInputs.push({
      id: inputId,
      name: inputName,
      defval: defval,
      type: 'bool'
    });
  } else if (t === 'color') {
    tvType = 'color';
    if (!defval) defval = '#089981';
    tvInputs.push({
      id: inputId,
      name: inputName,
      defval: String(defval),
      type: 'color'
    });
  } else if (t === 'int' || t === 'integer') {
    tvType = 'integer';
    defval = parseInt(defval, 10);
    if (isNaN(defval)) defval = 0;
    const inpObj = {
      id: inputId,
      name: inputName,
      defval: defval,
      type: 'integer'
    };
    if (inp.minval !== undefined) inpObj.min = inp.minval;
    if (inp.maxval !== undefined) inpObj.max = inp.maxval;
    if (inp.step !== undefined) inpObj.step = inp.step;
    tvInputs.push(inpObj);
  } else if (t === 'float') {
    tvType = 'float';
    defval = parseFloat(defval);
    if (isNaN(defval)) defval = 0.0;
    const inpObj = {
      id: inputId,
      name: inputName,
      defval: defval,
      type: 'float'
    };
    if (inp.minval !== undefined) inpObj.min = inp.minval;
    if (inp.maxval !== undefined) inpObj.max = inp.maxval;
    if (inp.step !== undefined) inpObj.step = inp.step;
    tvInputs.push(inpObj);
  } else if (t === 'source') {
    tvType = 'source';
    defval = String(defval || 'close');
    tvInputs.push({
      id: inputId,
      name: inputName,
      defval: defval,
      type: 'source',
      options: ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4']
    });
  } else {
    tvType = 'text';
    defval = String(defval ?? '');
    const inpObj = {
      id: inputId,
      name: inputName,
      defval: defval,
      type: 'text'
    };
    if (inp.options && Array.isArray(inp.options)) {
      inpObj.options = inp.options.map(String);
    }
    tvInputs.push(inpObj);
  }

  // Populate BOTH variable ID and numeric index into defaults.inputs
  defaultInputs[inputId] = defval;
  defaultInputs[idx] = defval;
  if (inp.varId) {
    defaultInputs[inp.varId] = defval;
  }
});

console.log('TV Inputs (' + tvInputs.length + '):');
console.log(JSON.stringify(tvInputs, null, 2));
console.log('Default Inputs:');
console.log(JSON.stringify(defaultInputs, null, 2));
