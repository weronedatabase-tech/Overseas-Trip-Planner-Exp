const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

code = code.replace(
    'if (row[7] === "Fees Payment Screenshot" && row[2] === payload.uploaderNric && row[10] !== true) {',
    'const matchNric = payload.familyNrics ? payload.familyNrics.includes(row[2]) : row[2] === payload.uploaderNric;\n    if (row[7] === "Fees Payment Screenshot" && matchNric && row[10] !== true) {'
);
fs.writeFileSync('backend/Code.js', code);
