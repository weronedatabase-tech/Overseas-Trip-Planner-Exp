const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

const oldHtmlLoop = `        html += \`
        <div class="sheet-list-item p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md flex items-center justify-between transition hover:bg-gray-50 dark:hover:bg-gray-750" data-name="\${nameStr.toLowerCase()}">
            <div class="cursor-pointer flex-1 font-bold text-gray-900 dark:text-white text-sm" onclick="selectGroupBusOption('\${idVal}')">\${activeAssignType === 'group' ? 'Group ' : (activeAssignType === 'bus' ? 'Bus ' : 'Room ')}\${nameStr}</div>
            <button onclick="\${activeAssignType === 'room' ? \`deleteRoom('\${idVal}')\` : \`removeGroupBusFromPopup('\${idVal}')\`}" class="text-red-500 hover:text-red-600 p-2 -mr-2"><i class="fa-solid fa-trash text-sm"></i></button>
        </div>\`;`;

const newHtmlLoop = `        let icHtml = '';
        if (activeAssignType === 'group') {
            const currentIC = globalLogistics.participants.find(p => p.logisticsGroup === nameStr && p.isGroupIC);
            let icName = currentIC ? (currentIC.displayName || currentIC.name || 'Unknown') : 'None';
            if (!activeAssignNric) { // Manage Mode
                icHtml = \`<div class="mt-1 flex items-center gap-2">
                    <span class="text-[10px] uppercase font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"><i class="fa-solid fa-crown mr-1"></i>IC: \${icName}</span>
                    <button onclick="window.openGroupICSheet('\${nameStr.replace(/'/g, "\\\\'")}')" class="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition">Change IC</button>
                </div>\`;
            } else { // Assign Mode
                icHtml = \`<div class="mt-1">
                    <span class="text-[10px] uppercase font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"><i class="fa-solid fa-crown mr-1"></i>IC: \${icName}</span>
                </div>\`;
            }
        }
        
        html += \`
        <div class="sheet-list-item p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md flex items-center justify-between transition hover:bg-gray-50 dark:hover:bg-gray-750" data-name="\${nameStr.toLowerCase()}">
            <div class="\${activeAssignNric ? 'cursor-pointer ' : ''}flex-1" \${activeAssignNric ? \`onclick="selectGroupBusOption('\${idVal}')"\` : ''}>
                <div class="font-bold text-gray-900 dark:text-white text-sm">\${activeAssignType === 'group' ? 'Group ' : (activeAssignType === 'bus' ? 'Bus ' : 'Room ')}\${nameStr}</div>
                \${icHtml}
            </div>
            <button onclick="\${activeAssignType === 'room' ? \`deleteRoom('\${idVal}')\` : \`removeGroupBusFromPopup('\${idVal}')\`}" class="text-red-500 hover:text-red-600 p-2 -mr-2"><i class="fa-solid fa-trash text-sm"></i></button>
        </div>\`;`;

code = code.replace(oldHtmlLoop, newHtmlLoop);
fs.writeFileSync('frontend/js/logistics.js', code);
