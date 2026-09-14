const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');
code = code.replace(/<p class="text-sm font-medium text-gray-400 p-2 text-center">No participants in this group\.<\/p>/, '<p class="text-sm font-medium text-gray-400 p-2 text-center">No volunteers assigned to this group.</p>');
fs.writeFileSync('frontend/js/logistics.js', code);
