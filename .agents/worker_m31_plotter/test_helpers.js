function resolveColorHex(color) {
  if (!color || color === 'na' || color === 'transparent') return null;
  if (typeof color === 'string') {
    let c = color.trim();
    if (c.startsWith('#')) {
      if (c.length === 9) return c.slice(0, 7);
      if (c.length === 7 || c.length === 4) return c;
    }
    const map = {
      'color.green': '#089981', 'green': '#089981',
      'color.red': '#f23645', 'red': '#f23645',
      'color.blue': '#2962ff', 'blue': '#2962ff',
      'color.aqua': '#00bcd4', 'aqua': '#00bcd4',
      'color.orange': '#ff9800', 'orange': '#ff9800',
      'color.purple': '#9c27b0', 'purple': '#9c27b0',
      'color.teal': '#00897b', 'teal': '#00897b',
      'color.white': '#ffffff', 'white': '#ffffff',
      'color.black': '#000000', 'black': '#000000',
      'color.gray': '#787b86', 'gray': '#787b86',
      'color.yellow': '#ffeb3b', 'yellow': '#ffeb3b'
    };
    if (map[c.toLowerCase()]) return map[c.toLowerCase()];
    if (c.startsWith('rgb')) return c;
  }
  return '#2962ff';
}

function parseColorTransparency(color, defaultTransp = 85) {
  if (!color) return defaultTransp;
  if (typeof color === 'string') {
    const hex = color.trim();
    if (hex.startsWith('#') && hex.length === 9) {
      const alphaHex = hex.slice(7, 9);
      const alpha = parseInt(alphaHex, 16) / 255;
      return Math.round((1 - alpha) * 100);
    }
    const match = hex.match(/rgba\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/i);
    if (match) {
      const alpha = parseFloat(match[1]);
      return Math.round((1 - alpha) * 100);
    }
  }
  return defaultTransp;
}

console.log("Hex test #ff5d001A:", resolveColorHex("#ff5d001A"), "transp:", parseColorTransparency("#ff5d001A"));
console.log("Color.green:", resolveColorHex("color.green"), "transp:", parseColorTransparency("color.green"));
