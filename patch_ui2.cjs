const fs = require('fs');
const path = './frontend/js/ui.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/if\(x\.role === 'CAREGIVER'\) famMap\[poc\]\.hasCaregiver = true;\n/g, "");
content = content.replace(/const isFamily = info \? \(info\.count > 1 \|\| info\.hasCaregiver\) : false;/g, "const isFamily = info ? (info.count > 1) : false;");

fs.writeFileSync(path, content);
