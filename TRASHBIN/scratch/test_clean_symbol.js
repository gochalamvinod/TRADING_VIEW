function extractCleanSymbol(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  if (str.startsWith('=')) {
    try {
      const p = JSON.parse(str.slice(1));
      if (p && p.symbol) str = String(p.symbol);
    } catch(e) {}
  } else if (str.startsWith('{')) {
    try {
      const p = JSON.parse(str);
      if (p && p.symbol) str = String(p.symbol);
      else if (p && p.ticker) str = String(p.ticker);
    } catch(e) {}
  }
  str = str.replace(/^[A-Za-z0-9_\-\s]+:/, '');
  str = str.replace(/[{"}'\\]/g, '').trim().toUpperCase();
  return str;
}

console.log('1:', extractCleanSymbol('={"session":"regular","symbol":"EURUSD."}'));
console.log('2:', extractCleanSymbol('BINANCE:BTCUSDT'));
console.log('3:', extractCleanSymbol('EURUSD.'));
console.log('4:', extractCleanSymbol('MetaTrader5:EURUSD.'));
console.log('5:', extractCleanSymbol('XAUUSD.'));
