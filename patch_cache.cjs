const fs = require('fs');
const path = './backend/Code.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/return type \+ "_" \+ getDbId\(\);/, 'return type + "_v2_" + getDbId();');
fs.writeFileSync(path, content);
