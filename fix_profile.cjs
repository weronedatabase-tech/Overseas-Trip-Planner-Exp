const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// Replace label fonts
code = code.replace(/text-\[11px\]/g, 'text-xs md:text-sm');

// Replace value fonts (font-semibold) in the info grid
code = code.replace(/<p class="font-semibold/g, '<p class="font-bold text-sm md:text-base');
code = code.replace(/<div class="font-semibold flex items-center gap-1"/g, '<div class="font-bold text-sm md:text-base flex items-center gap-1"');

// Replace the full name span
code = code.replace(/text-\[13px\] md:text-sm/g, 'text-base md:text-lg');

// Replace "text-xs text-gray-800" in the grid container to be base if applicable, 
// wait, the grid is: <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-gray-800 dark:text-gray-200">
// Let's replace "gap-y-2.5 text-xs text-gray-800"
code = code.replace(/gap-y-2\.5 text-xs/g, 'gap-y-4 text-sm');

// Replace border-t-2 border-gray-100 pt-2 with more padding
code = code.replace(/pt-2/g, 'pt-3');

fs.writeFileSync('frontend/js/profile.js', code);
