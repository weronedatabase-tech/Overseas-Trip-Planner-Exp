const fs = require('fs');
let content = fs.readFileSync('frontend/js/main.js', 'utf8');
content = content.replace(
  'if(typeof window.initPage === \'function\') {',
  'if(typeof applyHydrationDOMUpdates === \'function\') applyHydrationDOMUpdates();\n        if(typeof window.initPage === \'function\') {'
);
fs.writeFileSync('frontend/js/main.js', content);