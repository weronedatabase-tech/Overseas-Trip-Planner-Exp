const fs = require('fs');

let parts = fs.readFileSync('frontend/js/participants.js', 'utf8');

parts = parts.replace(
    '<table class="w-max table-auto',
    '<table class="w-full table-auto'
);

parts = parts.replace(
    /const baseClass = `px-3 py-2 align-top roster-col-\$\{c.id\} text-xs font-medium text-gray-800 dark:text-gray-200 \$\{.*\}\`;/,
    `const baseClass = \`px-3 py-2 align-top roster-col-\$\{c.id\} text-xs font-medium text-gray-800 dark:text-gray-200 \${['address', 'medical', 'diet', 'otherPoints', 'pairings'].includes(c.id) ? 'whitespace-normal break-words min-w-[150px] max-w-[300px]' : 'whitespace-nowrap'}\`;`
);

fs.writeFileSync('frontend/js/participants.js', parts);
