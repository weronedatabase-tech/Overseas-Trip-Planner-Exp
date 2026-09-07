window.openChatGroupsModal = function() {
    const groups = new Set();
    const buses = new Set();
    
    if (typeof adminRosterData !== 'undefined') {
        adminRosterData.forEach(p => {
            if(p.group && p.group.trim() !== '') groups.add(p.group);
            if(p.logisticsGroup && p.logisticsGroup.trim() !== '') groups.add(p.logisticsGroup);
            if(p.bus && p.bus.trim() !== '') buses.add(p.bus);
        });
    }
    
    const groupsArr = Array.from(groups).sort();
    const busesArr = Array.from(buses).sort();

    let modalHtml = `
    <div id="chatGroupsModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
        <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col border-2 border-gray-200 dark:border-gray-700 max-h-[90vh]">
            <div class="flex items-center justify-between p-4 border-b-2 border-gray-200 dark:border-gray-800 shrink-0">
                <h3 class="font-black text-gray-900 dark:text-white text-lg"><i class="fa-brands fa-whatsapp text-green-500 mr-2"></i>Generate Chat Group</h3>
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
                    <label class="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-widest block">Groups</label>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <label class="flex items-center gap-2 font-bold text-sm cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"><input type="checkbox" id="cgGrpAll" onchange="toggleAllCheckboxes('cgGrp', this.checked)" checked class="w-4 h-4 accent-primary"> ALL</label>
                        ${groupsArr.map(g => `<label class="flex items-center gap-2 font-bold text-sm cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"><input type="checkbox" name="cgGrp" value="${g}" checked class="w-4 h-4 accent-primary" onchange="uncheckAll('cgGrpAll')"> ${g}</label>`).join('')}
                    </div>
                </div>

                <div class="space-y-2">
                    <label class="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-widest block">Buses</label>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <label class="flex items-center gap-2 font-bold text-sm cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"><input type="checkbox" id="cgBusAll" onchange="toggleAllCheckboxes('cgBus', this.checked)" checked class="w-4 h-4 accent-primary"> ALL</label>
                        ${busesArr.map(b => `<label class="flex items-center gap-2 font-bold text-sm cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"><input type="checkbox" name="cgBus" value="${b}" checked class="w-4 h-4 accent-primary" onchange="uncheckAll('cgBusAll')"> Bus ${b}</label>`).join('')}
                    </div>
                </div>
                
                <button onclick="generateChatGroupsList()" class="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md transition text-sm">Generate List</button>

                <div id="cgResultContainer" class="hidden flex flex-col gap-2 mt-4 border-t-2 border-gray-200 dark:border-gray-800 pt-4">
                    <label class="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-widest block">Generated Output</label>
                    <p class="text-[11px] text-gray-500 mb-1 leading-tight">Copy and paste these numbers into the WhatsApp or Telegram "New Group" search bar.</p>
                    <textarea id="cgOutput" class="w-full h-24 bg-gray-50 dark:bg-black border-2 border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-800 dark:text-gray-200 font-mono resize-none focus:outline-none shadow-inner" readonly></textarea>
                    <button onclick="copyChatGroupsList()" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"><i class="fa-regular fa-copy"></i> Copy to Clipboard</button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.toggleAllCheckboxes = function(name, checked) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(cb => cb.checked = checked);
};
window.uncheckAll = function(id) {
    document.getElementById(id).checked = false;
};

window.generateChatGroupsList = function() {
    const includeVol = document.getElementById('cgRoleVol').checked;
    const includeCgv = document.getElementById('cgRoleCgv').checked;
    
    const grpAll = document.getElementById('cgGrpAll').checked;
    const selectedGrps = Array.from(document.querySelectorAll('input[name="cgGrp"]:checked')).map(cb => cb.value);

    const busAll = document.getElementById('cgBusAll').checked;
    const selectedBuses = Array.from(document.querySelectorAll('input[name="cgBus"]:checked')).map(cb => cb.value);

    let numbers = [];

    if (typeof adminRosterData !== 'undefined') {
        adminRosterData.forEach(p => {
            const isVol = p.role === 'VOLUNTEER';
            const isCgv = p.role === 'CAREGIVER';
            
            if (!((isVol && includeVol) || (isCgv && includeCgv))) return;
            if (!grpAll && !selectedGrps.includes(p.group) && !selectedGrps.includes(p.logisticsGroup)) return;
            if (!busAll && !selectedBuses.includes(p.bus)) return;

            if (p.contact && p.contact.trim() !== '') {
                let cleaned = p.contact.replace(/[^\d+]/g, '');
                if(cleaned.length > 0) numbers.push(cleaned);
            }
        });
    }

    const output = numbers.join(', ');
    const container = document.getElementById('cgResultContainer');
    const textarea = document.getElementById('cgOutput');
    
    container.classList.remove('hidden');
    textarea.value = output;
    
    if(numbers.length === 0) {
        textarea.value = "No matching contacts found.";
    }
};

window.copyChatGroupsList = function() {
    const textarea = document.getElementById('cgOutput');
    textarea.select();
    document.execCommand('copy');
    if (typeof showToast === 'function') {
        showToast("Contacts copied to clipboard!");
    } else {
        alert("Contacts copied to clipboard!");
    }
};
