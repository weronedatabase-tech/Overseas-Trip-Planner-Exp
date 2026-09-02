const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// 1. Remove the familyHtml calculation completely.
code = code.replace(/let familyArr = loadedFamily\.filter[\s\S]*?    <\/div>\`;\n}/, '');

// 2. Add header label and update card class
code = code.replace(/profilesHtml \+= \`\n   <div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm relative" id="profCard_\$\{i\}">/,
`let headerLabel = i === 0 ? '<span class="text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full uppercase tracking-widest mb-2 inline-block shadow-sm">My Profile</span>' : '<span class="text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-widest mb-2 inline-block shadow-sm">Family Member</span>';

 profilesHtml += \`
   <div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm relative mb-4" id="profCard_\$\{i\}">
     \$\{headerLabel\}`
);

// 3. Remove ${familyHtml} from the card HTML
code = code.replace(/       \$\{familyHtml\}\n/, '');

fs.writeFileSync('frontend/js/profile.js', code);
console.log("Patched!");
