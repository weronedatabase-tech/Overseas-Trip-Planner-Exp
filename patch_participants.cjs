const fs = require('fs');
const path = './frontend/js/participants.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /const poc = window\.resolvePocNric \? window\.resolvePocNric\(x, adminRosterData\) : \(x\.pocNric \|\| x\.nric\);/g,
    "const poc = x.pocNric;"
);

content = content.replace(
    /const poc = window\.resolvePocNric \? window\.resolvePocNric\(p, adminRosterData\) : \(p\.pocNric \|\| p\.nric\);/g,
    "const poc = p.pocNric;"
);

content = content.replace(
    /if\(x\.role === 'CAREGIVER'\) famMap\[poc\]\.hasCaregiver = true;/g,
    ""
);

content = content.replace(
    /const isFamily = info \? \(info\.count > 1 \|\| info\.hasCaregiver\) : false;/g,
    "const isFamily = info ? info.count > 1 : false;"
);

fs.writeFileSync(path, content);
