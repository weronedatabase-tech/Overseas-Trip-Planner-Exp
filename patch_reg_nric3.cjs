const fs = require('fs');
let reg = fs.readFileSync('frontend/js/registration.js', 'utf8');

reg = reg.replace(
    /window\.handleFieldInput = function[\s\S]*?;\n\}/,
    `window.handleFieldInput = function(inputEl, fieldType) {
    const val = inputEl.value.trim().toUpperCase();
    const warnEl = inputEl.previousElementSibling;
    
    // Auto-clear invalid format errors if it becomes valid
    if (fieldType === 'nric' && typeof isValidNRIC === 'function') {
        if (isValidNRIC(val)) {
            if (warnEl.innerHTML === "Invalid NRIC/FIN.") {
                warnEl.classList.add('hidden-force');
                inputEl.classList.remove('border-red-500', 'ring-red-500');
                inputEl.removeAttribute('data-invalid');
                // Re-check duplicate now that it's valid
                checkDuplicateField(inputEl, 'nric');
            }
        }
    }
    
    // Auto-clear local duplicate errors if the user modifies the text, wait for blur to re-check
    if (warnEl && warnEl.innerHTML.includes("unsubmitted form")) {
        warnEl.classList.add('hidden-force');
        inputEl.classList.remove('border-red-500', 'ring-red-500');
        inputEl.removeAttribute('data-invalid');
    }
}`
);

fs.writeFileSync('frontend/js/registration.js', reg);
