const fs = require('fs');
const path = './frontend/js/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const targetOld = `         <button id="btn-mode-single" onclick="setAttSearchMode('single')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider">Individual</button>
         <button id="btn-mode-multi" onclick="setAttSearchMode('multi')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider">Family</button>`;

if (content.includes(targetOld)) {
   // Wait, it is already Indiv in the HTML patch above... let's just make sure.
   console.log("Found old");
} else {
   console.log("Didn't find old");
}
