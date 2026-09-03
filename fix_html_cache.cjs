const fs = require('fs');
let content = fs.readFileSync('frontend/js/main.js', 'utf8');
content = content.replace(
  'async function loadPage(url) {',
  'const htmlCache = new Map();\n\nasync function loadPage(url) {\n    const urlKey = url.split("?")[0];'
);
content = content.replace(
  'const response = await fetch(url);\n        if (!response.ok) throw new Error("Page not found");\n        const html = await response.text();',
  'let html;\n        if (htmlCache.has(urlKey)) {\n            html = htmlCache.get(urlKey);\n        } else {\n            const response = await fetch(url);\n            if (!response.ok) throw new Error("Page not found");\n            html = await response.text();\n            htmlCache.set(urlKey, html);\n        }'
);
fs.writeFileSync('frontend/js/main.js', content);
