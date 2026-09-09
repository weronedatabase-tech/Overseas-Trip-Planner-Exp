const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// Replace formatPairingName logic to use button for the name and ensure case-insensitive role check
code = code.replace(
    /const clickHandler = .*?; \/\/ Always allow clicking for now to debug/g,
    `const isVol = currentUser && currentUser.role && currentUser.role.toUpperCase() === 'VOLUNTEER';
               const clickHandler = isVol ? \`onclick="window.showPairingDetails('\${tp.nric}')"\` : '';
               const clickClasses = isVol ? \`cursor-pointer hover:underline decoration-2 underline-offset-2 relative z-10 focus:outline-none focus:ring-2 focus:ring-primary rounded-sm\` : '';`
);

// We need to carefully replace the return statement of formatPairingName
// Current: return `<span class="inline-flex items-center whitespace-nowrap mb-1 mr-3"><span ${clickHandler}>${name}</span>${projTagHtml}${roleTagHtml}</span>`;
code = code.replace(
    /return `\<span class="inline-flex items-center whitespace-nowrap mb-1 mr-3"\>\<span \$\{clickHandler\}\>\$\{name\}\<\/span\>\$\{projTagHtml\}\$\{roleTagHtml\}\<\/span\>`;/g,
    'return `<span class="inline-flex items-center whitespace-nowrap mb-1 mr-3">` + (isVol ? `<button type="button" ${clickHandler} class="text-left font-bold ${clickClasses}">${name}</button>` : `<span class="font-bold">${name}</span>`) + `${projTagHtml}${roleTagHtml}</span>`;'
);

// Also fix the name assignment in formatPairingName
code = code.replace(
    /const name = tp\.shortName \|\| tp\.fullName;/g,
    'const name = tp.shortName || tp.name || tp.fullName || \'Unknown\';'
);

// Also fix the modal name assignment
code = code.replace(
    /<\h3 class="font-black text-lg text-gray-900 dark:text-white">\$\{p\.shortName \|\| p\.fullName\}<\/h3>/g,
    '<h3 class="font-black text-lg text-gray-900 dark:text-white">${p.shortName || p.name || p.fullName || \'Unknown\'}</h3>'
);

// Add modal existing removal
code = code.replace(
    /let room = 'None';/g,
    'const existing = document.getElementById(\'pairing-details-modal\'); if (existing) existing.remove();\n    let room = \'None\';'
);

fs.writeFileSync('frontend/js/profile.js', code);
