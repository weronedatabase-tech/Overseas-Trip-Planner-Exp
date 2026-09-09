const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');
code = code.replace(/onclick="showPairingDetails\('/g, 'onclick="window.showPairingDetails(\'');
fs.writeFileSync('frontend/js/profile.js', code);
