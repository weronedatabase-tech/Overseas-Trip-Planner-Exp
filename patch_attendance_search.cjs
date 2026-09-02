const fs = require('fs');
let code = fs.readFileSync('frontend/js/attendance.js', 'utf8');

code = code.replace(
    /const dName = p\.displayName \|\| p\.name \|\| '';\s*return dName\.toLowerCase\(\)\.includes\(query\);/,
    `const dName = p.displayName || p.name || '';
    const fullName = p.name || '';
    return dName.toLowerCase().includes(query) || fullName.toLowerCase().includes(query);`
);

fs.writeFileSync('frontend/js/attendance.js', code);
