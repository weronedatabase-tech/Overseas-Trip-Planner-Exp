const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

// 1. Update Group Dropzone Header
code = code.replace(
    /<div class="flex justify-between items-center border-b-2 border-gray-100 dark:border-gray-700 pb-1\.5 mb-1\.5">\s*<span class="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">\$\{gName\}<\/span>\s*<span class="text-xs bg-gray-200\/50 dark:bg-gray-700\/50 px-1\.5 py-0\.5 rounded border-2 border-gray-300 dark:border-gray-600 font-bold">\$\{groupMap\[gName\]\.length\} Pax<\/span>\s*<\/div>/g,
    `<div class="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-2 border-gray-100 dark:border-gray-700 pb-1.5 mb-1.5 gap-2 w-full">
                <div class="flex items-start justify-between w-full lg:w-auto gap-2 flex-1">
                    <span class="font-black text-[12px] md:text-sm text-gray-900 dark:text-white break-words whitespace-normal leading-tight uppercase tracking-wider">\${gName}</span>
                    <span class="text-[11px] bg-gray-200/50 dark:bg-gray-700/50 px-1.5 py-0.5 rounded border-2 border-gray-300 dark:border-gray-600 shrink-0 mt-0.5">\${groupMap[gName].length} Pax</span>
                </div>
                <div class="flex items-center gap-1 shrink-0 w-full lg:w-auto justify-end">
                    <button onclick="openGroupAddSheet('\${gName.replace(/'/g, '\\\\\\'')}')" class="text-[11px] bg-green-50 text-green-600 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 font-bold px-1.5 py-0.5 rounded hover:bg-green-100 transition focus:outline-none">+ Add</button>
                    <button onclick="promptEditGroup('\${gName.replace(/'/g, '\\\\\\'')}')" class="text-gray-400 hover:text-primary transition p-0.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded shadow-md"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    <button onclick="removeGroupList('\${gName.replace(/'/g, '\\\\\\'')}')" class="text-red-500 hover:text-red-600 transition p-0.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded shadow-md"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
            </div>`
);

// 2. Update Bus Dropzone Header
code = code.replace(
    /<div class="flex justify-between items-center border-b-2 border-gray-100 dark:border-gray-700 pb-1\.5 mb-1\.5">\s*<span class="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">\$\{bName\}<\/span>\s*<span class="text-xs bg-gray-200\/50 dark:bg-gray-700\/50 px-1\.5 py-0\.5 rounded border-2 border-gray-300 dark:border-gray-600 font-bold">\$\{busMap\[bName\]\.length\} \/ \$\{cap\} Pax<\/span>\s*<\/div>/g,
    `<div class="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-2 border-gray-100 dark:border-gray-700 pb-1.5 mb-1.5 gap-2 w-full">
                <div class="flex items-start justify-between w-full lg:w-auto gap-2 flex-1">
                    <span class="font-black text-[12px] md:text-sm text-gray-900 dark:text-white break-words whitespace-normal leading-tight uppercase tracking-wider">\${bName}</span>
                    <span class="text-[11px] bg-gray-200/50 dark:bg-gray-700/50 px-1.5 py-0.5 rounded border-2 border-gray-300 dark:border-gray-600 shrink-0 mt-0.5">\${busMap[bName].length} / \${cap} Pax</span>
                </div>
                <div class="flex items-center gap-1 shrink-0 w-full lg:w-auto justify-end">
                    <button onclick="openBusAddSheet('\${bName.replace(/'/g, '\\\\\\'')}')" class="text-[11px] bg-green-50 text-green-600 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 font-bold px-1.5 py-0.5 rounded hover:bg-green-100 transition focus:outline-none" \${busMap[bName].length >= cap ? 'disabled style="opacity:0.5;"' : ''}>+ Add</button>
                    <button onclick="promptEditBus('\${bName.replace(/'/g, '\\\\\\'')}')" class="text-gray-400 hover:text-primary transition p-0.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded shadow-md"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    <button onclick="removeBusList('\${bName.replace(/'/g, '\\\\\\'')}')" class="text-red-500 hover:text-red-600 transition p-0.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded shadow-md"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
            </div>`
);

// We need to inject openGroupAddSheet, promptEditGroup, openBusAddSheet, promptEditBus
const helperCode = `
window.activeGroupTargetName = null;
window.activeBusTargetName = null;

window.openGroupAddSheet = function(gName) {
    activeGroupTargetName = gName;
    dndState.type = 'grouping';
    const el_sheetTitle = document.getElementById('sheetTitle'); 
    if(el_sheetTitle) el_sheetTitle.innerHTML = \`Add to <span class="ml-1 font-black text-primary">\${gName}</span>\`;
    const searchInput = document.getElementById('sheetSearchInput');
    if(searchInput) searchInput.value = '';
    document.getElementById('selectionBottomSheet').classList.remove('hidden-force');

    const unassignedArr = globalLogistics.participants.filter(p => p.logisticsGroup !== gName);
    let html = '';
    unassignedArr.forEach(t => {
        const tDynColor = getProjectColor(t.group);
        const roleColor = t.role === 'TRAINEE' ? 'text-green-700 bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800' : (t.role === 'CAREGIVER' ? 'text-purple-700 bg-purple-100 dark:bg-purple-900/50 border-purple-200 dark:border-purple-800' : 'text-orange-700 bg-orange-100 dark:bg-orange-900/50 border-orange-200 dark:border-orange-800');
        html += \`
        <div class="sheet-list-item cursor-pointer p-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition" onclick="assignToGroupFromSheet('\${t.nric}', '\${gName.replace(/'/g, '\\\\\\'')}')" data-name="\${(t.displayName || t.name).toLowerCase()} \${t.nric.toLowerCase()}">
            <div class="flex items-center gap-2">
                <span class="\${roleColor} text-[10px] font-black px-1.5 py-0.5 rounded border-2 uppercase tracking-wide">\${t.role.substring(0,3)}</span>
                <span class="font-bold text-gray-800 dark:text-gray-200 text-sm">\${t.displayName || t.name}</span>
            </div>
            <i class="fa-solid fa-plus text-gray-400"></i>
        </div>
        \`;
    });
    
    const el_sheetListContainer = document.getElementById('sheetListContainer'); 
    if(el_sheetListContainer) el_sheetListContainer.innerHTML = html || '<div class="text-center p-4 text-gray-500 font-bold text-sm">No available participants.</div>';
};

window.assignToGroupFromSheet = function(nric, gName) {
    handleGroupDrop(nric, gName);
    closeSelectionSheet();
};

window.openBusAddSheet = function(bName) {
    activeBusTargetName = bName;
    dndState.type = 'bussing';
    const el_sheetTitle = document.getElementById('sheetTitle'); 
    if(el_sheetTitle) el_sheetTitle.innerHTML = \`Add to <span class="ml-1 font-black text-primary">\${bName}</span>\`;
    const searchInput = document.getElementById('sheetSearchInput');
    if(searchInput) searchInput.value = '';
    document.getElementById('selectionBottomSheet').classList.remove('hidden-force');

    const unassignedArr = globalLogistics.participants.filter(p => p.bus !== bName);
    let html = '';
    unassignedArr.forEach(t => {
        const tDynColor = getProjectColor(t.group);
        const roleColor = t.role === 'TRAINEE' ? 'text-green-700 bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800' : (t.role === 'CAREGIVER' ? 'text-purple-700 bg-purple-100 dark:bg-purple-900/50 border-purple-200 dark:border-purple-800' : 'text-orange-700 bg-orange-100 dark:bg-orange-900/50 border-orange-200 dark:border-orange-800');
        html += \`
        <div class="sheet-list-item cursor-pointer p-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition" onclick="assignToBusFromSheet('\${t.nric}', '\${bName.replace(/'/g, '\\\\\\'')}')" data-name="\${(t.displayName || t.name).toLowerCase()} \${t.nric.toLowerCase()}">
            <div class="flex items-center gap-2">
                <span class="\${roleColor} text-[10px] font-black px-1.5 py-0.5 rounded border-2 uppercase tracking-wide">\${t.role.substring(0,3)}</span>
                <span class="font-bold text-gray-800 dark:text-gray-200 text-sm">\${t.displayName || t.name}</span>
            </div>
            <i class="fa-solid fa-plus text-gray-400"></i>
        </div>
        \`;
    });
    
    const el_sheetListContainer = document.getElementById('sheetListContainer'); 
    if(el_sheetListContainer) el_sheetListContainer.innerHTML = html || '<div class="text-center p-4 text-gray-500 font-bold text-sm">No available participants.</div>';
};

window.assignToBusFromSheet = function(nric, bName) {
    handleBusDrop(nric, bName);
    closeSelectionSheet();
};

window.promptEditGroup = function(oldName) {
    const newName = prompt("Edit Group Name:", oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const val = newName.trim();
    if (activeGroupsList.includes(val)) {
        alert("A group with this name already exists.");
        return;
    }
    
    const index = activeGroupsList.indexOf(oldName);
    if (index !== -1) {
        activeGroupsList[index] = val;
        localStorage.setItem('activeGroupsList', JSON.stringify(activeGroupsList));
    }
    
    globalLogistics.participants.forEach(p => {
        if (p.logisticsGroup === oldName) {
            p.logisticsGroup = val;
            pendingGroupUpdates.set(p.nric, { nric: p.nric, value: val });
        }
    });
    renderGroups();
    if (pendingGroupUpdates.size > 0) triggerGroupSync();
};

window.promptEditBus = function(oldName) {
    const newName = prompt("Edit Bus Name:", oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const val = newName.trim();
    if (activeBusesList.includes(val)) {
        alert("A bus with this name already exists.");
        return;
    }
    
    const index = activeBusesList.indexOf(oldName);
    if (index !== -1) {
        activeBusesList[index] = val;
        localStorage.setItem('activeBusesList', JSON.stringify(activeBusesList));
    }
    
    globalLogistics.participants.forEach(p => {
        if (p.bus === oldName) {
            p.bus = val;
            pendingBusUpdates.set(p.nric, { nric: p.nric, value: val });
        }
    });
    renderBuses();
    if (pendingBusUpdates.size > 0) triggerBusSync();
};
`;

fs.writeFileSync('frontend/js/logistics.js', code + "\n" + helperCode);
