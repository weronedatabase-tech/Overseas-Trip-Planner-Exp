const fs = require('fs');

function patch(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // For functions like async function loadParticipantsData() {
    // we want to insert await new Promise(r => setTimeout(r, 0)); 
    // right after the opening brace.
    const regex = /(async function load[A-Za-z]+\(\)\s*\{)/g;
    content = content.replace(regex, `$1\n    await new Promise(resolve => setTimeout(resolve, 10)); // Yield to allow browser paint\n`);
    
    // Also patch buildFinanceUI which is async and does heavy rendering if cached
    if (file.includes('finance.js')) {
        content = content.replace(/(async function buildFinanceUI\(\)\s*\{)/, `$1\n    await new Promise(resolve => setTimeout(resolve, 10));\n`);
    }
    
    fs.writeFileSync(file, content);
}

['frontend/js/participants.js', 'frontend/js/diet.js', 'frontend/js/expired.js', 'frontend/js/medical.js', 'frontend/js/other.js', 'frontend/js/logistics.js', 'frontend/js/finance.js', 'frontend/js/minutes.js'].forEach(patch);

