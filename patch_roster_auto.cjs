const fs = require('fs');

let parts = fs.readFileSync('frontend/js/participants.js', 'utf8');

// Remove table-fixed-layout
parts = parts.replace(
    '<table class="table-fixed-layout',
    '<table class="w-max table-auto'
);

// Remove Full Name column widths
parts = parts.replace(
    /style="width: min\(250px, 33vw\); min-width: min\(250px, 33vw\); max-width: 33vw;"/g,
    'style="min-width: 150px; max-width: 300px;"'
);

// Remove other columns' hardcoded widths from header
parts = parts.replace(
    /style="width: \$\{c\.width\}px; min-width: \$\{c\.width\}px; max-width: \$\{c\.width\}px;"/g,
    'style="white-space: nowrap; padding-left: 12px; padding-right: 12px;"'
);

// Update TD baseClass to use appropriate text wrapping instead of forcing break-words everywhere, and add padding
parts = parts.replace(
    /const baseClass = `p-3 align-top roster-col-\$\{c\.id\} text-xs font-medium text-gray-800 dark:text-gray-200 whitespace-normal break-words`;/g,
    `const baseClass = \`px-3 py-2 align-top roster-col-\$\{c.id\} text-xs font-medium text-gray-800 dark:text-gray-200 \${['address', 'medical', 'diet', 'otherPoints', 'pairings'].includes(c.id) ? 'whitespace-normal break-words min-w-[200px]' : 'whitespace-nowrap'}\`;`
);

fs.writeFileSync('frontend/js/participants.js', parts);
