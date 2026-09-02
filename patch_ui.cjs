const fs = require('fs');
const path = './frontend/js/ui.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/window\.resolvePocNric\(x, allParticipants\)/g, "x.pocNric");
content = content.replace(/window\.resolvePocNric\(p, allParticipants\)/g, "p.pocNric");

fs.writeFileSync(path, content);
