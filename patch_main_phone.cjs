const fs = require('fs');

let main = fs.readFileSync('frontend/js/main.js', 'utf8');

// Replace the first hardcoded string (helpline in header)
main = main.replace(
    /<a href="https:\/\/wa\.me\/65\$\{h\.phone\.replace\(\/\[\\s-\]\/g, ''\)\}" target="_blank" class="flex items-center gap-1 text-\[10px\] md:text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1\.5 py-0\.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition" title="\$\{h\.name\}">\s*<svg[^>]*>.*?<\/svg>\s*\$\{h\.name\}\s*<\/a>/s,
    `<div class="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700"><span>\${h.name}</span> \${renderPhoneLink(h.phone)}</div>`
);

// Replace the second hardcoded string (helpline in bottom section)
main = main.replace(
    /<a href="https:\/\/wa\.me\/65\$\{h\.phone\.replace\(\/\[\\s-\]\/g, ''\)\}" target="_blank" class="w-full flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 py-3 rounded-xl font-bold transition shadow-sm">\s*<svg[^>]*>.*?<\/svg>\s*\$\{h\.name\} - \$\{h\.phone\}\s*<\/a>/s,
    `<div class="w-full flex flex-col items-center justify-center gap-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 py-3 rounded-xl shadow-sm"><span class="font-bold text-sm">\${h.name}</span>\${renderPhoneLink(h.phone)}</div>`
);

fs.writeFileSync('frontend/js/main.js', main);
