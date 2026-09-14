function makeSeries(val, arr) {
  const numObj = new Number(val);
  return new Proxy(numObj, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive) return (hint) => val;
      if (prop === 'valueOf') return () => val;
      const idx = parseInt(prop, 10);
      if (!isNaN(idx)) {
        const targetIdx = arr.length - 1 - idx;
        return (targetIdx >= 0 && targetIdx < arr.length) ? arr[targetIdx] : NaN;
      }
      return target[prop];
    }
  });
}

const histO = [100, 102, 105]; // past opens + current open (105)
const histC = [99, 103, 101];  // past closes + current close (101)

const o = makeSeries(105, histO);
const c = makeSeries(101, histC);

console.log('o > c:', o > c); // should be true (105 > 101)
console.log('o - c:', o - c); // should be 4
console.log('o[0]:', o[0]);   // should be 105
console.log('o[1]:', o[1]);   // should be 102
console.log('o[2]:', o[2]);   // should be 100
console.log('o[3]:', o[3]);   // should be NaN
console.log('c[1]:', c[1]);   // should be 103
console.log('o[1] > c[1]:', o[1] > c[1]); // 102 > 103 -> false
