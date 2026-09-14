const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const startPattern = /<script>\s*\/\* =+\s*\* 1\. LocalStorageSaveLoadAdapter Class/;
const endPattern = /<\/script>\s*<\/body>/;

const startMatch = startPattern.exec(html);
const endMatch = endPattern.exec(html);

if (!startMatch || !endMatch) {
  console.error('Could not find pattern matches:', { hasStart: !!startMatch, hasEnd: !!endMatch });
  process.exit(1);
}

const startIdx = startMatch.index;
// Find the exact opening `<script>` tag
const openScriptTag = '<script>';
const openTagPos = html.indexOf(openScriptTag, startIdx);
const jsStart = openTagPos + openScriptTag.length;
const jsEnd = endMatch.index;

const jsContent = html.slice(jsStart, jsEnd).trim();
fs.writeFileSync('chart_app.js', jsContent + '\n', 'utf8');
console.log('chart_app.js written successfully with length:', jsContent.length);

const newHtml = html.slice(0, openTagPos) + '<script src="chart_app.js?v=4.5.0"></script>' + html.slice(endMatch.index + '</script>'.length);
fs.writeFileSync('index.html', newHtml, 'utf8');
console.log('index.html updated successfully with new length:', newHtml.length);
