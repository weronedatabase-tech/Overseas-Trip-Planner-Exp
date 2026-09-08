const fs = require('fs');
let code = fs.readFileSync('frontend/js/settings.js', 'utf8');

code = code.replace(
    /if \(typeof isValidNRIC === 'function' && !isValidNRIC\(nric\)\) return showToast\("Invalid NRIC\/FIN.", true\);/,
    "if (typeof isValidNRIC === 'function' && !isValidNRIC(nric) && nric.length < 5) return showToast(\"Invalid NRIC/FIN or Passport format.\", true);"
);

fs.writeFileSync('frontend/js/settings.js', code);

let code2 = fs.readFileSync('frontend/js/auth.js', 'utf8');

code2 = code2.replace(
    /if\(typeof isValidNRIC === 'function' && !isValidNRIC\(nric\)\) \{ err.textContent = "Invalid NRIC\/FIN."; return err.classList.remove\('hidden-force'\); \}/,
    "if(typeof isValidNRIC === 'function' && !isValidNRIC(nric) && nric.length < 5) { err.textContent = \"Invalid NRIC/FIN or Passport format.\"; return err.classList.remove('hidden-force'); }"
);

fs.writeFileSync('frontend/js/auth.js', code2);
console.log('patched settings and auth');
