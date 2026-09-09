const fs = require('fs');
let code = fs.readFileSync('frontend/js/main.js', 'utf8');

const target = `<span class="font-bold text-xs text-gray-800 dark:text-gray-200">${"${f.fullName}"}</span>`;
const replacement = `<span class="font-bold text-xs text-gray-800 dark:text-gray-200">${"${f.fullName || f.name || 'Unknown'}${f.shortName ? ' (' + f.shortName + ')' : ''}"}</span>`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    console.log("Replaced successfully in main.js");
} else {
    console.log("Target not found in main.js");
}

fs.writeFileSync('frontend/js/main.js', code);
