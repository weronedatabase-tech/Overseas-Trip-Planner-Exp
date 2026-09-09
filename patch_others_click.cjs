const fs = require('fs');
let code = fs.readFileSync('frontend/js/ui.js', 'utf8');

code = code.replace(
    /if \(val === 'Others'\) \{\s*dropdown\.classList\.add\('hidden-force'\);\s*setManualMode\(true\);\s*return;\s*\}/,
    `if (val === 'Others') {
                    dropdown.classList.add('hidden-force');
                    input.value = ''; // clear original input so manual input starts empty
                    input.dispatchEvent(new Event('input', {bubbles:true}));
                    input.dispatchEvent(new Event('change', {bubbles:true}));
                    setManualMode(true);
                    return;
                }`
);

fs.writeFileSync('frontend/js/ui.js', code);
console.log("Patched others click handler");
