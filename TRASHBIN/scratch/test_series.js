function createSeriesVar(currentVal, historyArray) {
  const numObj = new Number(currentVal);
  return new Proxy(numObj, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive || prop === 'valueOf') return () => currentVal;
      const idx = parseInt(prop, 10);
      if (!isNaN(idx)) {
        if (idx === 0) return currentVal;
        if (historyArray && historyArray.length >= idx) {
          return historyArray[historyArray.length - idx];
        }
        return currentVal;
      }
      return target[prop];
    }
  });
}

const history = [1.08, 1.09, 1.10];
const close = createSeriesVar(1.12, history);

console.log('close:', Number(close));
console.log('close arithmetic 1/close:', 1 / close);
console.log('close[0]:', close[0]);
console.log('close[1]:', close[1]);
console.log('close[2]:', close[2]);
console.log('comparison close > 1.11:', close > 1.11);
