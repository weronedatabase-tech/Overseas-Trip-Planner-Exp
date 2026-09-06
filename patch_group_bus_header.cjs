const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

// Replace Group Header
const groupRegex = /<div class="flex justify-between items-center border-b-2 border-gray-100 dark:border-gray-700 pb-1\.5 mb-1\.5">\s*<div class="flex items-center gap-2">\s*<span class="font-black text-sm md:text-sm text-gray-900 dark:text-white leading-tight">Group \$\{gName\}<\/span>\s*<button onclick="removeGroupList\('\\$\\{gName\\}'\)" class="text-red-500 hover:text-red-600 focus:outline-none"><i class="fa-solid fa-trash text-sm"><\/i><\/button>\s*<\/div>\s*<span class="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-1\.5 py-0\.5 rounded shadow-inner">\$\{groupMap\[gName\]\.length\} Pax<\/span>\s*<\/div>/g;

const newGroupHeader = `<div class="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-2 border-gray-100 dark:border-gray-700 pb-1.5 mb-1.5 gap-2 w-full">
                <div class="flex items-start justify-between w-full lg:w-auto gap-2 flex-1">
                    <span class="font-black text-[12px] md:text-sm text-gray-900 dark:text-white break-words whitespace-normal leading-tight">Group \${gName}</span>
                    <span class="text-[11px] bg-gray-200/50 dark:bg-gray-700/50 px-1.5 py-0.5 rounded border-2 border-gray-300 dark:border-gray-600 shrink-0 mt-0.5">\${groupMap[gName].length} Pax</span>
                </div>
                <div class="flex items-center gap-1 shrink-0 w-full lg:w-auto justify-end">
                    <button onclick="openGroupAddSheet('\${gName.replace(/'/g, '\\\\\\'')}')" class="text-[11px] bg-green-50 text-green-600 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 font-bold px-1.5 py-0.5 rounded hover:bg-green-100 transition focus:outline-none shadow-md">+ Add</button>
                    <button onclick="promptEditGroup('\${gName.replace(/'/g, '\\\\\\'')}')" class="text-gray-400 hover:text-primary transition p-0.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded shadow-md"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    <button onclick="removeGroupList('\${gName.replace(/'/g, '\\\\\\'')}')" class="text-red-500 hover:text-red-600 transition p-0.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded shadow-md"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
            </div>`;

code = code.replace(groupRegex, newGroupHeader);

// Replace Bus Header
const busRegex = /<div class="flex justify-between items-center border-b-2 border-gray-100 dark:border-gray-700 pb-1\.5 mb-1\.5">\s*<div class="flex items-center gap-2">\s*<span class="font-black text-sm md:text-sm text-gray-900 dark:text-white leading-tight">Bus \$\{bName\}<\/span>\s*<button onclick="removeBusList\('\\$\\{bName\\}'\)" class="text-red-500 hover:text-red-600 focus:outline-none"><i class="fa-solid fa-trash text-sm"><\/i><\/button>\s*<\/div>\s*<span class="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-1\.5 py-0\.5 rounded shadow-inner">\$\{busMap\[bName\]\.length\} Pax<\/span>\s*<\/div>/g;

const newBusHeader = `<div class="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-2 border-gray-100 dark:border-gray-700 pb-1.5 mb-1.5 gap-2 w-full">
                <div class="flex items-start justify-between w-full lg:w-auto gap-2 flex-1">
                    <span class="font-black text-[12px] md:text-sm text-gray-900 dark:text-white break-words whitespace-normal leading-tight">Bus \${bName}</span>
                    <span class="text-[11px] bg-gray-200/50 dark:bg-gray-700/50 px-1.5 py-0.5 rounded border-2 border-gray-300 dark:border-gray-600 shrink-0 mt-0.5">\${busMap[bName].length} Pax</span>
                </div>
                <div class="flex items-center gap-1 shrink-0 w-full lg:w-auto justify-end">
                    <button onclick="openBusAddSheet('\${bName.replace(/'/g, '\\\\\\'')}')" class="text-[11px] bg-green-50 text-green-600 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 font-bold px-1.5 py-0.5 rounded hover:bg-green-100 transition focus:outline-none shadow-md">+ Add</button>
                    <button onclick="promptEditBus('\${bName.replace(/'/g, '\\\\\\'')}')" class="text-gray-400 hover:text-primary transition p-0.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded shadow-md"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    <button onclick="removeBusList('\${bName.replace(/'/g, '\\\\\\'')}')" class="text-red-500 hover:text-red-600 transition p-0.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded shadow-md"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
            </div>`;

code = code.replace(busRegex, newBusHeader);

fs.writeFileSync('frontend/js/logistics.js', code);
