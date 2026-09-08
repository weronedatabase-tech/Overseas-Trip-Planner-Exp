const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');
code = code.replace(/\\\`/g, '`');
code = code.replace(/\\\$/g, '$');
fs.writeFileSync('frontend/js/logistics.js', code);
