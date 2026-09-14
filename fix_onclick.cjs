const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');
code = code.replace(/openPairingDetailsModal/g, 'showPairingDetails');
fs.writeFileSync('frontend/js/profile.js', code);
