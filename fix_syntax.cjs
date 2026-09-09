const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');
code = code.replace(/const html = \\`/g, 'const html = `');
code = code.replace(/\\` :/g, '` :');
code = code.replace(/\\`;/g, '`;');
code = code.replace(/\\\$\{/g, '${');
fs.writeFileSync('frontend/js/profile.js', code);
