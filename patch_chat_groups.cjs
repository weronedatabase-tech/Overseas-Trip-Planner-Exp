const fs = require('fs');
let code = fs.readFileSync('frontend/js/participants.js', 'utf8');

const regex = /window\.openChatGroupsModal = function\(\) \{[\s\S]*?document\.body\.insertAdjacentHTML\('beforeend', modalHtml\);\s*\};/;

const replacement = `window.openChatGroupsModal = function() {
    const projects = new Set();
    const logisticsGroups = new Set();
    const buses = new Set();
    
    if (typeof adminRosterData !== 'undefined') {
        adminRosterData.forEach(p => {
            if(p.group && p.group.trim() !== '') projects.add(p.group);
            if(p.logisticsGroup && p.logisticsGroup.trim() !== '') logisticsGroups.add(p.logisticsGroup);
            if(p.bus && p.bus.trim() !== '') buses.add(p.bus);
        });
    }
    
    const projectsArr = Array.from(projects).sort();
    const logisticsGroupsArr = Array.from(logisticsGroups).sort();
    const busesArr = Array.from(buses).sort();

    // Automation logic for active logistics group filter
    const activeGroupFilter = (typeof rosterLogisticsGroupFilter !== 'undefined' && rosterLogisticsGroupFilter) ? rosterLogisticsGroupFilter : null;
    const isGrpAllChecked = !activeGroupFilter;

    let modalHtml = \`
    <div id="chatGroupsModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
        <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col border-2 border-gray-200 dark:border-gray-700 max-h-[90vh]">
            <div class="flex items-center justify-between p-4 border-b-2 border-gray-200 dark:border-gray-800 shrink-0">
                <h3 class="font-black text-gray-900 dark:text-white text-lg"><i class="fa-solid fa-address-book text-green-500 mr-2"></i>Export Contacts (CSV)</h3>
                <button onclick="document.getElementById('chatGroupsModal').remove()" class="text-gray-400 hover:text-gray-900 dark:hover:text-white transition"><i class="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div class="p-4 flex-grow overflow-y-auto space-y-4 custom-scrollbar">
                <div class="space-y-2">
                    <label class="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-widest block">Roles</label>
                    <div class="flex gap-4">
                        <label class="flex items-center gap-2 font-bold text-sm cursor-pointer"><input type="checkbox" id="cgRoleVol" value="VOLUNTEER" checked class="w-4 h-4 accent-primary"> Volunteers</label>
                        <label class="flex items-center gap-2 font-bold text-sm cursor-pointer"><input type="checkbox" id="cgRoleCgv" value="CAREGIVER" class="w-4 h-4 accent-primary"> Caregivers</label>
                    </div>
                </div>

                <div class="space-y-2">
                    <label class="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-widest block">Projects</label>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <label class="flex items-center gap-2 font-bold text-sm cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"><input type="checkbox" id="cgProjAll" onchange="toggleAllCheckboxes('cgProj', this.checked)" checked class="w-4 h-4 accent-primary"> ALL</label>
                        \${projectsArr.map(g => \`<label class="flex items-center gap-2 font-bold text-sm cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"><input type="checkbox" name="cgProj" value="\${g}" checked class="w-4 h-4 accent-primary" onchange="uncheckAll('cgProjAll')"> \${g}</label>\`).join('')}
                    </div>
                </div>

                <div class="space-y-2">
                    <label class="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-widest block">Groups</label>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <label class="flex items-center gap-2 font-bold text-sm cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"><input type="checkbox" id="cgGrpAll" onchange="toggleAllCheckboxes('cgGrp', this.checked)" \${isGrpAllChecked ? 'checked' : ''} class="w-4 h-4 accent-primary"> ALL</label>
                        \${logisticsGroupsArr.map(g => {
                            const isChecked = isGrpAllChecked || g === activeGroupFilter;
                            return \`<label class="flex items-center gap-2 font-bold text-sm cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"><input type="checkbox" name="cgGrp" value="\${g}" \${isChecked ? 'checked' : ''} class="w-4 h-4 accent-primary" onchange="uncheckAll('cgGrpAll')"> \${g}</label>\`;
                        }).join('')}
                    </div>
                </div>

                <div class="space-y-2">
                    <label class="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-widest block">Buses</label>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <label class="flex items-center gap-2 font-bold text-sm cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"><input type="checkbox" id="cgBusAll" onchange="toggleAllCheckboxes('cgBus', this.checked)" checked class="w-4 h-4 accent-primary"> ALL</label>
                        \${busesArr.map(b => \`<label class="flex items-center gap-2 font-bold text-sm cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"><input type="checkbox" name="cgBus" value="\${b}" checked class="w-4 h-4 accent-primary" onchange="uncheckAll('cgBusAll')"> Bus \${b}</label>\`).join('')}
                    </div>
                </div>
                
                <button onclick="generateChatGroupsList()" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl shadow-md transition text-sm flex justify-center items-center gap-2"><i class="fa-solid fa-download"></i> Download Contacts CSV</button>
            </div>
        </div>
    </div>\`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};`;

if(code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('frontend/js/participants.js', code);
    console.log('Successfully patched participants.js for openChatGroupsModal');
} else {
    console.log('Regex did not match.');
}
