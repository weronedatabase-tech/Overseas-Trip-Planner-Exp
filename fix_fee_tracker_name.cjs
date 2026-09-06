const fs = require('fs');
let c = fs.readFileSync('frontend/js/finance.js', 'utf8');

c = c.replace(/<button onclick="showContactPaymentPopup\('\\${m\.nric}'\)" class="font-bold text-xs text-primary hover:underline focus:outline-none">\\${m\.shortName \|\| m\.name}<\/button>/g, '<span class="font-bold text-xs text-gray-800 dark:text-gray-200">${m.shortName || m.name}</span>');

fs.writeFileSync('frontend/js/finance.js', c);
console.log("Updated name HTML");
