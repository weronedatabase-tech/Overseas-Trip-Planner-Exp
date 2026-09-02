const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

if (!code.includes('function openManageRoomsSheet')) {
    code += `\nfunction openManageRoomsSheet() {
    activeAssignNric = null; // No assignment
    activeAssignType = 'room';
    document.getElementById('sheetTitle').innerHTML = \`Manage <span class="text-primary">Rooms</span>\`;
    const searchInput = document.getElementById('sheetSearchInput');
    if(searchInput) searchInput.value = '';
    renderGroupBusOptions();
    document.getElementById('selectionBottomSheet').classList.remove('hidden-force');
}\n`;
}

// Modify renderGroupBusOptions
code = code.replace(
    /const list = activeAssignType === 'group' \? activeGroupsList : activeBusesList;/g,
    `let list = [];
    if (activeAssignType === 'group') list = activeGroupsList;
    else if (activeAssignType === 'bus') list = activeBusesList;
    else if (activeAssignType === 'room') {
        const activeRooms = (globalLogistics.rooms || []).filter(r => !r.isDeleted);
        list = activeRooms.map(r => ({ id: r.id, name: r.name, ts: r.ts })).sort((a,b) => a.name.localeCompare(b.name));
    }`
);

// We need to change how `list.forEach` is handled in renderGroupBusOptions
const oldForEach = `list.forEach(item => {
        if (query && !item.toLowerCase().includes(query)) return;
        html += \`
        <div class="sheet-list-item p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between transition hover:bg-gray-50 dark:hover:bg-gray-750" data-name="\${item.toLowerCase()}">
            <div class="cursor-pointer flex-1 font-bold text-gray-900 dark:text-white text-sm" onclick="selectGroupBusOption('\${item}')">\${activeAssignType === 'group' ? 'Group ' : 'Bus '}\${item}</div>
            <button onclick="removeGroupBusFromPopup('\${item}')" class="text-red-500 hover:text-red-600 p-2 -mr-2"><i class="fa-solid fa-trash text-sm"></i></button>
        </div>\`;
    });`;

const newForEach = `list.forEach(item => {
        let nameStr = activeAssignType === 'room' ? item.name : item;
        let idVal = activeAssignType === 'room' ? item.id : item;
        
        if (query && !nameStr.toLowerCase().includes(query)) return;
        
        html += \`
        <div class="sheet-list-item p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between transition hover:bg-gray-50 dark:hover:bg-gray-750" data-name="\${nameStr.toLowerCase()}">
            <div class="cursor-pointer flex-1 font-bold text-gray-900 dark:text-white text-sm" onclick="selectGroupBusOption('\${idVal}')">\${activeAssignType === 'group' ? 'Group ' : (activeAssignType === 'bus' ? 'Bus ' : 'Room ')}\${nameStr}</div>
            <button onclick="\${activeAssignType === 'room' ? \`deleteRoom('\${idVal}')\` : \`removeGroupBusFromPopup('\${idVal}')\`}" class="text-red-500 hover:text-red-600 p-2 -mr-2"><i class="fa-solid fa-trash text-sm"></i></button>
        </div>\`;
    });`;

code = code.replace(oldForEach, newForEach);

// Fix addGroupBusFromPopup
const addGroupMatch = `function addGroupBusFromPopup() {`;
const newAddGroup = `function addGroupBusFromPopup() {
    if (activeAssignType === 'room') {
        addRoom();
        renderGroupBusOptions();
        return;
    }`;
code = code.replace(addGroupMatch, newAddGroup);

fs.writeFileSync('frontend/js/logistics.js', code);
