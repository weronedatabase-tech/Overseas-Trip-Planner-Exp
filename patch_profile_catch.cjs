const fs = require('fs');

let pf = fs.readFileSync('frontend/js/profile.js', 'utf8');
pf = pf.replace(
    'tabProfile.innerHTML = \'<p class="text-red-500 font-bold text-xs p-2 text-center">Error loading dashboard.</p>\';',
    'console.error(e); tabProfile.innerHTML = \'<p class="text-red-500 font-bold text-xs p-2 text-center">Error loading dashboard: \' + e.message + \'</p>\';'
);

fs.writeFileSync('frontend/js/profile.js', pf);
