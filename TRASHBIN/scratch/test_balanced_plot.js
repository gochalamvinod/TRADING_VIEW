const fs = require('fs');
const source = fs.readFileSync('scratch_luxalgo.pine', 'utf-8');

function extractFunctionCalls(src, fnName) {
  const calls = [];
  const regex = new RegExp('(?:^|[^a-zA-Z0-9_])' + fnName + '\\s*\\(', 'g');
  let match;
  while ((match = regex.exec(src)) !== null) {
    const startIdx = match.index + match[0].length;
    let depth = 1;
    let inString = null;
    let endIdx = startIdx;
    while (depth > 0 && endIdx < src.length) {
      const ch = src[endIdx];
      if (inString) {
        if (ch === inString && src[endIdx - 1] !== '\\\\') inString = null;
      } else {
        if (ch === '"' || ch === "'") inString = ch;
        else if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      endIdx++;
    }
    if (depth === 0) {
      const argsStr = src.substring(startIdx, endIdx - 1).trim();
      calls.push(argsStr);
    }
  }
  return calls;
}

const plots = extractFunctionCalls(source, 'plot');
console.log("Total plot() calls found:", plots.length);
plots.forEach((p, i) => {
  console.log(`Plot ${i+1}:`, p.substring(0, 60));
});

const shapes = extractFunctionCalls(source, 'plotshape');
console.log("\nTotal plotshape() calls found:", shapes.length);
shapes.forEach((s, i) => {
  console.log(`Shape ${i+1}:`, s.substring(0, 60));
});
