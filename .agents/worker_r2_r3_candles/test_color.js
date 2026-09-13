function colorToInt(color, alpha = 1.0) {
  if (typeof color === 'number') return Math.round(color);
  if (!color || typeof color !== 'string') return 4286683400; // fallback green #089981 with alpha=1
  
  const cStr = color.trim().toLowerCase();
  if (cStr === 'na' || cStr === 'transparent') {
    return 0; // alpha = 0 -> transparent
  }

  const PINE_COLOR_MAP = {
    'color.green': '#089981',
    'color.red': '#f23645',
    'color.blue': '#2962ff',
    'color.aqua': '#00bcd4',
    'color.orange': '#ff9800',
    'color.purple': '#9c27b0',
    'color.teal': '#00897b',
    'color.white': '#ffffff',
    'color.black': '#000000',
    'color.gray': '#787b86',
    'color.yellow': '#ffeb3b',
    'green': '#089981',
    'red': '#f23645',
    'blue': '#2962ff',
    'aqua': '#00bcd4',
    'orange': '#ff9800',
    'purple': '#9c27b0',
    'teal': '#00897b',
    'white': '#ffffff',
    'black': '#000000',
    'gray': '#787b86',
    'yellow': '#ffeb3b'
  };

  const resolved = PINE_COLOR_MAP[cStr] || color.trim();
  let r = 8, g = 153, b = 129, a = alpha !== undefined ? alpha : 1.0;

  if (resolved.startsWith('#')) {
    const hex = resolved.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 8) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
      a = parseInt(hex.substring(6, 8), 16) / 255;
    }
  } else if (resolved.startsWith('rgb')) {
    const match = resolved.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (match) {
      r = parseInt(match[1], 10);
      g = parseInt(match[2], 10);
      b = parseInt(match[3], 10);
      if (match[4] !== undefined) a = parseFloat(match[4]);
    }
  }

  // TradingView bitwise packaging: (r & 255) + ((g & 255) * 256) + ((b & 255) * 65536) + (Math.round(Math.max(0, Math.min(1, a)) * 255) * 16777216)
  return (Math.round(r) & 255) +
         ((Math.round(g) & 255) * 256) +
         ((Math.round(b) & 255) * 65536) +
         (Math.round(Math.max(0, Math.min(1, a)) * 255) * 16777216);
}

function decodeTVInt(val) {
  const r = Math.round(val) % 256;
  const g = Math.floor(val / 256) % 256;
  const b = Math.floor(val / 65536) % 256;
  const a = Math.floor(val / 16777216) / 255;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

console.log('Testing colorToInt:');
const tests = [
  '#089981',
  '#f23645',
  '#4CAF50FF',
  'color.green',
  'color.red',
  'color.gray',
  'rgba(255, 0, 0, 0.5)',
  'na',
  'transparent'
];

tests.forEach(t => {
  const enc = colorToInt(t);
  const dec = decodeTVInt(enc);
  console.log(`${t.padEnd(22)} -> int: ${String(enc).padEnd(12)} -> decoded: ${dec}`);
});
