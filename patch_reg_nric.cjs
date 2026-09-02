const fs = require('fs');

let reg = fs.readFileSync('frontend/js/registration.js', 'utf8');

reg = reg.replace(
  "if (!val) return;",
  `if (!val) {
        inputEl.classList.remove('border-red-500', 'ring-red-500');
        inputEl.removeAttribute('data-invalid');
        inputEl.previousElementSibling.classList.add('hidden-force');
        return;
    }
    
    if (fieldType === 'nric' && typeof isValidNRIC === 'function' && !isValidNRIC(val)) {
        const warnEl = inputEl.previousElementSibling;
        warnEl.innerHTML = "Invalid NRIC/FIN format.";
        warnEl.classList.remove('hidden-force');
        inputEl.classList.add('border-red-500', 'ring-red-500');
        inputEl.setAttribute('data-invalid', 'true');
        return;
    }`
);

fs.writeFileSync('frontend/js/registration.js', reg);
