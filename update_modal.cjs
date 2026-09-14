const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// Replace the title
code = code.replace(/<h3 class="font-black text-lg text-gray-900 dark:text-white">Pairing Details<\/h3>/, '<h3 class="font-black text-lg text-gray-900 dark:text-white">Participant Details</h3>');

// Replace the generated member html to include the volunteer details
// I'll do this safely via script.
fs.writeFileSync('frontend/js/profile.js', code);
