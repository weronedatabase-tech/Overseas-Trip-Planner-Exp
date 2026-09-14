const fs = require('fs');
let content = fs.readFileSync('frontend/js/logistics.js', 'utf8');

const newFuncs = `
window.openGroupICSheet = function(gName) {
    const el_sheetTitle = document.getElementById('sheetTitle'); 
    if(el_sheetTitle) el_sheetTitle.innerHTML = \`Assign IC for <span class="ml-1 font-black text-primary">\${gName}</span>\`;
    const searchInput = document.getElementById('sheetSearchInput');
    if(searchInput) searchInput.value = '';
    document.getElementById('selectionBottomSheet').classList.remove('hidden-force');

    const assignedArr = globalLogistics.participants.filter(p => p.logisticsGroup === gName);
    let html = '';
    assignedArr.forEach(t => {
        const roleColor = t.role === 'TRAINEE' ? 'text-green-700 bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800' : (t.role === 'CAREGIVER' ? 'text-purple-700 bg-purple-100 dark:bg-purple-900/50 border-purple-200 dark:border-purple-800' : 'text-orange-700 bg-orange-100 dark:bg-orange-900/50 border-orange-200 dark:border-orange-800');
        const icCrown = t.isGroupIC ? '<i class="fa-solid fa-crown text-amber-500 text-lg"></i>' : '<i class="fa-regular fa-circle text-gray-300"></i>';
        html += \`
        <div class="sheet-list-item cursor-pointer p-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition" onclick="assignICToGroupFromSheet('\${t.nric}', '\${gName.replace(/'/g, '\\\\\\'')}')" data-name="\${(t.displayName || t.name).toLowerCase()} \${t.nric.toLowerCase()}">
            <div class="flex items-center gap-2">
                <span class="\${roleColor} text-[10px] font-black px-1.5 py-0.5 rounded border-2 uppercase tracking-wide">\${t.role.substring(0,3)}</span>
                <span class="font-bold text-gray-800 dark:text-gray-200 text-sm">\${t.displayName || t.name}</span>
            </div>
            \${icCrown}
        </div>
        \`;
    });
    
    const el_sheetListContainer = document.getElementById('sheetListContainer'); 
    if(el_sheetListContainer) el_sheetListContainer.innerHTML = html || '<p class="text-sm font-medium text-gray-400 p-2 text-center">No participants in this group.</p>';
};

window.assignICToGroupFromSheet = async function(nric, gName) {
    const groupMembers = globalLogistics.participants.filter(p => p.logisticsGroup === gName);
    const updates = [];
    
    groupMembers.forEach(p => {
        if (p.isGroupIC && p.nric !== nric) {
            p.isGroupIC = false;
            updates.push({ nric: p.nric, value: false });
        }
    });
    
    const target = globalLogistics.participants.find(p => p.nric === nric);
    if (target) {
        target.isGroupIC = true;
        updates.push({ nric: nric, value: true });
    }
    
    closeSelectionSheet();
    renderGroups(); 
    
    showToast("Assigning Group IC...");
    try {
        await apiCall('syncAssignments', { updates: updates, column: 'isGroupIC' });
        showToast("Group IC assigned successfully.");
    } catch (e) {
        showToast("Error assigning Group IC", true);
    }
};
`;

content = content.replace(
    'window.assignToGroupFromSheet = function(nric, gName) {\n    handleGroupDrop(nric, gName);\n    closeSelectionSheet();\n};',
    'window.assignToGroupFromSheet = function(nric, gName) {\n    handleGroupDrop(nric, gName);\n    closeSelectionSheet();\n};\n\n' + newFuncs
);

fs.writeFileSync('frontend/js/logistics.js', content);
