function makeSeriesCallable(val, arr, fn) {
  const f = function(...args) {
    if (typeof fn === 'function') return fn(...args);
    return val;
  };
  f.valueOf = () => val;
  f[Symbol.toPrimitive] = (hint) => val;
  return new Proxy(f, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive) return (hint) => val;
      if (prop === 'valueOf') return () => val;
      const idx = parseInt(prop, 10);
      if (!isNaN(idx)) {
        if (idx === 0) return val;
        const targetIdx = arr.length - 1 - idx;
        return (targetIdx >= 0 && targetIdx < arr.length) ? arr[targetIdx] : NaN;
      }
      return target[prop];
    },
    apply(target, thisArg, argList) {
      if (typeof fn === 'function') return fn(...argList);
      return val;
    }
  });
}

const history = [1000, 2000, 3000];
const time = makeSeriesCallable(3000, history, (tf, sess) => 3000);

console.log('time + 10:', time + 10); // 3010
console.log('time[0]:', time[0]);     // 3000
console.log('time[1]:', time[1]);     // 2000
console.log('time():', time());       // 3000
console.log('time("1", "0930-1600"):', time('1', '0930-1600')); // 3000
