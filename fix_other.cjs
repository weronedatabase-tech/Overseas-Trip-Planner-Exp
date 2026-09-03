const fs = require('fs');
let code = fs.readFileSync('frontend/js/other.js', 'utf8');
code = code.replace(/const hasNotes = p.otherPoints && p.otherPoints.trim\(\) && p.otherPoints.trim\(\).toLowerCase\(\) !== 'nil' && p.otherPoints.trim\(\).toLowerCase\(\) !== 'none';\s*if \(hasNotes\) \{\s*html \+= \`<div><span class="text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900\/20 px-2 py-1 rounded inline-block whitespace-pre-wrap">\$\{p.otherPoints\}<\/span><\/div>\`;\s*\}/, `
   const hasNotes = p.otherPoints && p.otherPoints.trim() && p.otherPoints.trim().toLowerCase() !== 'nil' && p.otherPoints.trim().toLowerCase() !== 'none';
   const hasSleep = p.sleeping && p.sleeping.trim() && p.sleeping.trim().toLowerCase() !== 'nil' && p.sleeping.trim().toLowerCase() !== 'none';
   if (hasSleep) {
       html += \`<div><span class="text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded inline-block whitespace-pre-wrap">\${p.sleeping}</span></div>\`;
   }
   if (hasNotes) {
       html += \`<div><span class="text-orange-700 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded inline-block whitespace-pre-wrap">\${p.otherPoints}</span></div>\`;
   }
`);
fs.writeFileSync('frontend/js/other.js', code);
