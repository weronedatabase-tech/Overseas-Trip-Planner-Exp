const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

const missingCode = `
function generateBusCardHtml(item, isAssigned = false) {
    const dynColor = getProjectColor(item.group);
    const shortName = item.shortName || item.displayName || item.name;
    const roleColor = item.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (item.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
    const roleShort = item.role.substring(0,3).toUpperCase();
    const isFam = item.role === 'TRAINEE' && item.caregiverFor; 
    const cgBadge = item.caregiverFor ? \\\`<div class="mt-1 font-bold text-purple-600 dark:text-purple-400 text-[10px] uppercase">[\\\${item.caregiverFor}]</div>\\\` : '';
    
    return \\\`
    <div class="dnd-bus-draggable relative bg-white dark:bg-gray-800 p-1 md:p-1.5 rounded-md border-2 border-gray-200 dark:border-gray-700 shadow-md cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col gap-1 w-full" data-nric="\\\${item.nric}" onclick="openBusAssignSheet('\\\${item.nric}')">
        <div class="font-bold text-gray-900 dark:text-gray-100 text-xs md:text-sm leading-tight whitespace-normal break-words">\\\${shortName.toUpperCase()}</div>
        <div class="flex items-center gap-1 flex-wrap">
            <span class="text-[10px] md:text-[10px] font-black \\\${roleColor} bg-gray-50 dark:bg-gray-800 px-1 py-[1px] leading-tight rounded-sm border-2 border-gray-200 dark:border-gray-700 uppercase tracking-wide">\\\${roleShort}</span>
            <span class="px-1 py-[1px] leading-tight rounded-sm border shadow-md text-[10px] md:text-[10px] font-bold \\\${dynColor} whitespace-normal break-words inline-block" title="\\\${(item.group || 'None').toUpperCase()}">\\\${getProjectAbbreviation(item.group || 'None')}</span>
        </div>
        \\\${cgBadge}
        \\\${isAssigned ? \\\`<div class="remove-x" onclick="unassignFromBus('\\\${item.nric}')">×</div>\\\` : ''}
    </div>
    \\\`;
}

function renderBuses() {
    if(!globalLogistics || !document.getElementById('busListContainer')) return;
    const query = document.getElementById('busSearchInput') ? document.getElementById('busSearchInput').value.toLowerCase().trim() : '';
    
    let unassigned = [];
    let busMap = {};
    activeBusesList.forEach(b => busMap[b] = []);

    globalLogistics.participants.forEach(p => {
        let pBus = String(p.bus || "").trim();
        if (pBus && !activeBusesList.includes(pBus)) {
            activeBusesList.push(pBus);
            busMap[pBus] = [];
        }
        
        let match = false;
        if (query) {
            const dName = (p.displayName || p.name).toLowerCase();
            const fullName = (p.name || '').toLowerCase();
            match = dName.includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || pBus.toLowerCase().includes(query);
        } else {
            match = true;
        }
        
        if (!match) return;

        if (pBus) {
            busMap[pBus].push(p);
        } else {
            unassigned.push(p);
        }
    });

    document.getElementById('busUnassignedCount').innerText = unassigned.length;
    if (window.sortParticipantsSpecial) window.sortParticipantsSpecial(unassigned, globalLogistics.participants);
    
    let unHtml = '';
    unassigned.forEach(item => {
        unHtml += generateBusCardHtml(item);
    });
    const el_busUnassignedPool = document.getElementById('busUnassignedPool'); 
    if(el_busUnassignedPool) el_busUnassignedPool.innerHTML = unHtml || '<p class="text-xs text-gray-500 font-bold p-2 text-center mt-2">All assigned / No matches.</p>';

    let listHtml = '';
    activeBusesList.forEach(b => {
        if (window.sortParticipantsSpecial) window.sortParticipantsSpecial(busMap[b], globalLogistics.participants);
        let itemsHtml = '';
        busMap[b].forEach(item => {
            itemsHtml += generateBusCardHtml(item, true);
        });
        listHtml += \\\`
        <div class="bg-gray-100 dark:bg-gray-800/80 p-2 md:p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 min-h-[120px] shadow-inner dnd-bus-zone flex flex-col transition" data-bus="\\\${b}" ondragover="event.preventDefault();" ondrop="handleBusDrop(event, '\\\${b}')">
            <div class="flex justify-between items-center mb-2 shrink-0">
                <h4 class="font-black text-gray-800 dark:text-gray-100 uppercase tracking-widest text-xs md:text-sm flex items-center gap-1.5"><svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>\\\${b}</h4>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold bg-white dark:bg-gray-900 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 shadow-sm">\\\${busMap[b].length} PAX</span>
                    <button onclick="promptDeleteGroupBus('bus', '\\\${b}')" class="text-red-400 hover:text-red-600 transition focus:outline-none"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
            </div>
            <div class="flex-1 flex flex-col gap-1.5 md:gap-2">
                \\\${itemsHtml || '<p class="text-[11px] text-gray-400 font-bold p-2 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded mt-1">Drop participants here</p>'}
            </div>
        </div>
        \\\`;
    });
    
    listHtml += \\\`
    <div onclick="addGroupBusFromPopup()" class="cursor-pointer p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition">
        <span class="text-sm font-black text-primary flex items-center gap-1"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg> Add New Bus</span>
    </div>
    \\\`;

    const el_busListContainer = document.getElementById('busListContainer');
    if(el_busListContainer) el_busListContainer.innerHTML = listHtml;
    
    if (typeof initBusDragAndDrop === 'function') initBusDragAndDrop();
}
`;

code = code.replace(
  /function autoGroup\(\) \{/,
  missingCode + '\nfunction autoGroup() {'
);

fs.writeFileSync('frontend/js/logistics.js', code);
console.log('Restored generateBusCardHtml and renderBuses');
