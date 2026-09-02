const fs = require('fs');
let content;

// Profile.js
let profilePath = './frontend/js/profile.js';
content = fs.readFileSync(profilePath, 'utf8');
content = content.replace(/loadedFamily\[0\]\.pocNric \|\| loadedFamily\[0\]\.nric/g, "loadedFamily[0].pocNric");
fs.writeFileSync(profilePath, content);

// Finance.js
let financePath = './frontend/js/finance.js';
if (fs.existsSync(financePath)) {
    content = fs.readFileSync(financePath, 'utf8');
    content = content.replace(/let targetPoc = window\.resolvePocNric \? window\.resolvePocNric\(p, globalLogistics\.participants\) : \(p\.pocNric \|\| p\.nric\);/g, "let targetPoc = p.pocNric;");
    fs.writeFileSync(financePath, content);
}
