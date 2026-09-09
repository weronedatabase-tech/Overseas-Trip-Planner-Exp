const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// I am going to check if window.showPairingDetails is present, and add it globally to a place that makes sense if it is missing.
const hasShowPairingDetails = code.includes('window.showPairingDetails');
console.log('Has showPairingDetails:', hasShowPairingDetails);

