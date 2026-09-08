const fs = require('fs');
let html = fs.readFileSync('finance.html', 'utf8');
let docStr = html.match(/<div id="financeRatesModal"[\s\S]*?<\/div>\s*<\/div>/)[0];
console.log(docStr.includes('financeRatesList'));
