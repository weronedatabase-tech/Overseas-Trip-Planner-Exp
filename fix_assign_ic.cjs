const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

const regex = /const assignedArr = globalLogistics\.participants\.filter\(p => p\.logisticsGroup === gName\);/;
const replacement = `const assignedArr = globalLogistics.participants.filter(p => p.logisticsGroup === gName && p.role === 'VOLUNTEER');`;

code = code.replace(regex, replacement);

fs.writeFileSync('frontend/js/logistics.js', code);
