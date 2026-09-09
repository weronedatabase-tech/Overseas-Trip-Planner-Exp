const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const targetMyProfile = `<span class="text-sm font-black bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block shadow-md">My Profile</span>`;
const replacementMyProfile = `<span class="text-base font-black bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block shadow-md">My Profile</span>`;

code = code.replace(targetMyProfile, replacementMyProfile);
fs.writeFileSync('frontend/js/profile.js', code);
