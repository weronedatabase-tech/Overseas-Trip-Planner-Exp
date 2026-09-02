const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

code = code.replace(
    'paidByNric: recNricInput ? recNricInput.value.trim() : currentUser.nric,',
    'paidByNric: recNricInput ? recNricInput.value.trim() : currentUser.nric,\n           familyNrics: loadedFamily.map(f => f.nric),'
);
fs.writeFileSync('frontend/js/profile.js', code);
