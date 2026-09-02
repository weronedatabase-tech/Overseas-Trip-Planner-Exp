const fs = require('fs');
let s = fs.readFileSync('frontend/js/settings.js', 'utf8');

s = s.replace(
  'if(!nric || !name || !phone) return showToast("Name, NRIC, Phone required", true);',
  `if(!nric || !name || !phone) return showToast("Name, NRIC, Phone required", true); 
  if (typeof isValidNRIC === 'function' && !isValidNRIC(nric)) return showToast("Invalid NRIC/FIN format.", true);`
);

fs.writeFileSync('frontend/js/settings.js', s);
