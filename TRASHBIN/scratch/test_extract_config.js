const fs = require('fs');
const src = fs.readFileSync('scratch_luxalgo.pine', 'utf8');

function extractSessionConfig(source) {
  const code = String(source || '');
  const cfg = {
    showDayDivider: true,
    transparency: 82,
    showOutline: false,
    showLabel: true,
    sessions: [
      { id: 'A', name: 'New York', color: '#ff5d00', start: 1300, end: 2200, enabled: true },
      { id: 'B', name: 'London', color: '#2157f3', start: 700, end: 1600, enabled: true },
      { id: 'C', name: 'Tokyo', color: '#e91e63', start: 0, end: 900, enabled: true },
      { id: 'D', name: 'Sydney', color: '#ffeb3b', start: 2100, end: 600, enabled: true }
    ]
  };

  const dayMatch = code.match(/showDayDividerInput\s*=\s*input(?:\.bool)?\s*\(\s*(true|false)/i);
  if (dayMatch) cfg.showDayDivider = dayMatch[1].toLowerCase() === 'true';

  const transMatch = code.match(/rangeTransparencyInput\s*=\s*input(?:\.int)?\s*\(\s*(\d+)/i);
  if (transMatch) cfg.transparency = parseInt(transMatch[1], 10);

  const outlineMatch = code.match(/showRangeOutlineInput\s*=\s*input(?:\.bool)?\s*\(\s*(true|false)/i);
  if (outlineMatch) cfg.showOutline = outlineMatch[1].toLowerCase() === 'true';

  const labelMatch = code.match(/showRangeLabelInput\s*=\s*input(?:\.bool)?\s*\(\s*(true|false)/i);
  if (labelMatch) cfg.showLabel = labelMatch[1].toLowerCase() === 'true';

  ['A', 'B', 'C', 'D'].forEach(letter => {
    const s = cfg.sessions.find(x => x.id === letter);
    if (!s) return;
    const nameMatch = code.match(new RegExp('session' + letter + 'NameInput\\s*=\\s*input(?:\\.string)?\\s*\\(\\s*["\']([^"\']+)["\']', 'i'));
    if (nameMatch) s.name = nameMatch[1];

    const colMatch = code.match(new RegExp('session' + letter + 'ColorInput\\s*=\\s*input(?:\\.color)?\\s*\\(\\s*([^,\\)]+)', 'i'));
    if (colMatch) {
      let c = colMatch[1].trim().replace(/['"]/g, '');
      if (c.startsWith('#') && c.length === 9) c = c.slice(0, 7);
      s.color = c;
    }

    const timeMatch = code.match(new RegExp('session' + letter + 'TimeInput\\s*=\\s*input(?:\\.session)?\\s*\\(\\s*["\']([^"\']+)["\']', 'i'));
    if (timeMatch) {
      const parts = timeMatch[1].split('-');
      s.start = parseInt(parts[0], 10);
      s.end = parseInt(parts[1], 10);
    }

    const showMatch = code.match(new RegExp('showSession' + letter + 'Input\\s*=\\s*input(?:\\.bool)?\\s*\\(\\s*(true|false)', 'i'));
    const rangeMatch = code.match(new RegExp('session' + letter + 'RangeInput\\s*=\\s*input(?:\\.bool)?\\s*\\(\\s*(true|false)', 'i'));
    const isShow = showMatch ? showMatch[1].toLowerCase() === 'true' : true;
    const isRange = rangeMatch ? rangeMatch[1].toLowerCase() === 'true' : true;
    s.enabled = isShow && isRange;
  });

  return cfg;
}

const config = extractSessionConfig(src);
console.log('Extracted config:', JSON.stringify(config, null, 2));
