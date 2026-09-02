const fs = require('fs');

let reg = fs.readFileSync('frontend/js/registration.js', 'utf8');

reg = reg.replace(
  `onblur="checkDuplicateField(this, 'nric')"`,
  `onblur="checkDuplicateField(this, 'nric')" oninput="handleFieldInput(this, 'nric')"`
);

reg = reg.replace(
  `onblur="checkDuplicateField(this, 'passport')"`,
  `onblur="checkDuplicateField(this, 'passport')" oninput="handleFieldInput(this, 'passport')"`
);

reg = reg.replace(
    'warnEl.innerHTML = "Invalid NRIC/FIN format.";',
    'warnEl.innerHTML = "Invalid NRIC/FIN.";'
);

reg = reg.replace(
    'warnEl.innerHTML = `Duplicate ${fieldType.toUpperCase()} in this form.`;',
    'warnEl.innerHTML = fieldType === "nric" ? "This NRIC/FIN is already entered in another participant block within this unsubmitted form." : "This Passport No. is already entered in another participant block within this unsubmitted form.";'
);

if (!reg.includes('handleFieldInput')) {
    reg += `\nwindow.handleFieldInput = function(inputEl, fieldType) {
    const val = inputEl.value.trim().toUpperCase();
    const warnEl = inputEl.previousElementSibling;
    
    if (fieldType === 'nric' && typeof isValidNRIC === 'function') {
        if (isValidNRIC(val)) {
            if (warnEl.innerHTML === "Invalid NRIC/FIN.") {
                warnEl.classList.add('hidden-force');
                inputEl.classList.remove('border-red-500', 'ring-red-500');
                inputEl.removeAttribute('data-invalid');
                checkDuplicateField(inputEl, 'nric');
            }
        } else if (val.length >= 9) {
            // Optional: If they typed 9+ chars and it's invalid, we could show it immediately.
            // But let's just stick to the requirement: "when a valid NRIC is filled in, the Invalid notification should auto disappear"
        }
    }
};\n`;
}

fs.writeFileSync('frontend/js/registration.js', reg);
