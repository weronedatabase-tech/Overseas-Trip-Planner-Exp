const fs = require('fs');
let c = fs.readFileSync('frontend/js/files.js', 'utf8');
c = c.replace(/href="#"/g, 'href="javascript:void(0)"');
fs.writeFileSync('frontend/js/files.js', c);
