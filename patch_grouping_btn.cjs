const fs = require('fs');
let code = fs.readFileSync('frontend/js/grouping.js', 'utf8');

const targetStr = `\${!isUnassigned ? \`<button onclick="window.deleteGroup('\${g}', event)" class="flex items-center justify-center w-6 h-6 bg-transparent hover:bg-red-500 text-red-500 hover:text-white dark:hover:bg-red-600 rounded shadow-none hover:shadow-md transition-colors opacity-70 hover:opacity-100" title="Delete Group"><i class="fa-solid fa-trash text-xs"></i></button>\` : ''}`;

const replacementStr = `\${!isUnassigned ? \`
<button onclick="openAssignICModal(currentGroupingSheetUrl)" class="flex items-center justify-center w-6 h-6 bg-transparent hover:bg-orange-500 text-orange-600 hover:text-white dark:hover:bg-orange-600 rounded shadow-none hover:shadow-md transition-colors opacity-70 hover:opacity-100" title="Assign ICs"><i class="fa-solid fa-crown text-xs"></i></button>
<button onclick="window.deleteGroup('\${g}', event)" class="flex items-center justify-center w-6 h-6 bg-transparent hover:bg-red-500 text-red-500 hover:text-white dark:hover:bg-red-600 rounded shadow-none hover:shadow-md transition-colors opacity-70 hover:opacity-100" title="Delete Group"><i class="fa-solid fa-trash text-xs"></i></button>\` : ''}`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('frontend/js/grouping.js', code, 'utf8');
    console.log("Patched Grouping JS successfully");
} else {
    console.log("Could not find target string");
}
