const fs = require('fs');
let s = fs.readFileSync('frontend/js/auth.js', 'utf8');

s = s.replace(
  'if(!nric) { err.textContent = "Uploader NRIC is required."; return err.classList.remove(\'hidden-force\'); }',
  `if(!nric) { err.textContent = "Uploader NRIC is required."; return err.classList.remove('hidden-force'); }
    if(typeof isValidNRIC === 'function' && !isValidNRIC(nric)) { err.textContent = "Invalid NRIC/FIN format."; return err.classList.remove('hidden-force'); }`
);

fs.writeFileSync('frontend/js/auth.js', s);
