const fs = require('fs');
let code = fs.readFileSync('frontend/js/registration.js', 'utf8');

code = code.replace(
    /if \(fieldType === 'nric' && typeof isValidNRIC === 'function' && !isValidNRIC\(val\)\) \{/,
    "const isNoNric = inputEl.closest('.grid').querySelector('.reg-f-nonric').checked;\n    if (fieldType === 'nric' && typeof isValidNRIC === 'function' && !isValidNRIC(val) && !isNoNric) {"
);

code = code.replace(
    /if \(fieldType === 'nric' && typeof isValidNRIC === 'function'\) \{/,
    "const isNoNric = inputEl.closest('.grid').querySelector('.reg-f-nonric').checked;\n    if (fieldType === 'nric' && typeof isValidNRIC === 'function' && !isNoNric) {"
);

code += `\nwindow.toggleNoNric = function(cb) {
    const block = cb.closest('.grid');
    const nricInput = block.querySelector('.reg-f-nric');
    const passInput = block.querySelector('.reg-f-pass');
    
    if (cb.checked) {
        nricInput.readOnly = true;
        nricInput.value = passInput.value;
        nricInput.classList.add('bg-gray-200', 'dark:bg-gray-700', 'cursor-not-allowed');
        // Clear errors
        nricInput.classList.remove('border-red-500', 'ring-red-500');
        nricInput.removeAttribute('data-invalid');
        const warnEl = nricInput.previousElementSibling;
        if (warnEl) warnEl.classList.add('hidden-force');
    } else {
        nricInput.readOnly = false;
        nricInput.value = '';
        nricInput.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'cursor-not-allowed');
    }
};

const originalHandleFieldInput = window.handleFieldInput;
window.handleFieldInput = function(inputEl, fieldType) {
    originalHandleFieldInput(inputEl, fieldType);
    
    if (fieldType === 'passport') {
        const block = inputEl.closest('.grid');
        const noNricCb = block.querySelector('.reg-f-nonric');
        if (noNricCb && noNricCb.checked) {
            const nricInput = block.querySelector('.reg-f-nric');
            nricInput.value = inputEl.value;
            checkDuplicateField(nricInput, 'nric');
        }
    }
};
`;

fs.writeFileSync('frontend/js/registration.js', code);
console.log('patched');
