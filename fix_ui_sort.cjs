const fs = require('fs');
let code = fs.readFileSync('frontend/js/ui.js', 'utf8');

code = code.replace(/const poc = x\.pocNric \|\| x\.nric;/g, "const poc = x.pocNric || x.nric || '';");
code = code.replace(/const poc = p\.pocNric \|\| p\.nric;/g, "const poc = p.pocNric || p.nric || '';");

fs.writeFileSync('frontend/js/ui.js', code);
