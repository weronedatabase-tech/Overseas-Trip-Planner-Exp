const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

code = code.replace(
    /tabProfile\.innerHTML = '<p class="text-red-500 font-bold text-xs p-2 text-center">Error loading dashboard\.<\/p>';/,
    "tabProfile.innerHTML = '<p class=\"text-red-500 font-bold text-xs p-2 text-center\">Error loading dashboard: ' + (e.message || e) + '</p>';"
);

fs.writeFileSync('frontend/js/profile.js', code);
