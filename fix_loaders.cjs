const fs = require('fs');

function patch(file, loaderId) {
    let content = fs.readFileSync(file, 'utf8');
    const regex = /(if \([^)]+\) {\s*(?:.+?\n)+?\s*)(render[A-Za-z]+\(\);\s*)(return;\s*})/g;
    
    // special case for logistics
    if (file.includes('logistics.js')) {
        content = content.replace(/(if \(globalLogistics && globalLogistics\.rooms\) {[\s\S]*?renderBuses\(\);\s*)(return;\s*})/, `$1const loader = document.getElementById('${loaderId}');\n    if(loader) loader.classList.add('hidden-force');\n    $2`);
    } else if (file.includes('finance.js')) {
        content = content.replace(/(if \(window\.financeConfig && window\.financeConfig\.ts\) {\s*\/\/ Already cached\s*\/\/ do not fetch\s*)(\} else \{)/, `$1const loader = document.getElementById('${loaderId}');\n            if(loader) loader.classList.add('hidden-force');\n        $2`);
    } else if (file.includes('minutes.js')) {
        content = content.replace(/(if \(minutesMap\.size > 0\) {[\s\S]*?startMinutesPolling\(\);\s*)(return;\s*})/, `$1const loader = document.getElementById('${loaderId}');\n  if(loader) loader.classList.add('hidden-force');\n  $2`);
    } else {
        content = content.replace(regex, `$1$2const loader = document.getElementById('${loaderId}');\n    if(loader) loader.classList.add('hidden-force');\n    $3`);
    }
    fs.writeFileSync(file, content);
}

patch('frontend/js/participants.js', 'rosterLoading');
patch('frontend/js/diet.js', 'dietLoading');
patch('frontend/js/expired.js', 'expiredLoading');
patch('frontend/js/medical.js', 'medicalLoading');
patch('frontend/js/other.js', 'otherLoading');
patch('frontend/js/logistics.js', 'logLoadingOverlay');
patch('frontend/js/finance.js', 'finLoadingOverlay');
patch('frontend/js/minutes.js', 'minutesLoadingOverlay');

