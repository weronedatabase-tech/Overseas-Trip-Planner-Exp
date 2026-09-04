const fs = require('fs');
let content = fs.readFileSync('frontend/js/minutes.js', 'utf8');
content = content.replace(
  'async function loadInitialMinutes() {',
  'async function loadInitialMinutes() {\nif (minutesMap.size > 0) {\n  renderAllMinutes();\n  startMinutesPolling();\n  return;\n}'
);
fs.writeFileSync('frontend/js/minutes.js', content);
