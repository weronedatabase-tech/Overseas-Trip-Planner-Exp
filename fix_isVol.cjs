const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

code = code.replace(
    /const isVol = currentUser && \(currentUser\.role === 'VOLUNTEER' \|\| currentUser\.role === 'volunteer'\);\n               const isVol = currentUser && currentUser\.role && currentUser\.role\.toUpperCase\(\) === 'VOLUNTEER';/,
    'const isVol = currentUser && currentUser.role && currentUser.role.toUpperCase() === \'VOLUNTEER\';'
);

fs.writeFileSync('frontend/js/profile.js', code);
