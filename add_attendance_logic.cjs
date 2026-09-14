const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const searchHtmlStr = `tabProfile.innerHTML = navHtml + topBannersHtml + personalDetailsHeader + profilesHtml + receiptsHtml + paymentHtml + '</div>' + myGroupHtml;`;
const replaceHtmlStr = `
let myAttendanceHtml = "";
if (isCurrentUserGroupIC && loadedGroupMembers.length > 0) {
    myAttendanceHtml = \`<div id="section-my-attendance" class="hidden-force bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 shadow-md mb-4">
        <div class="flex justify-between items-center border-b-2 border-blue-200 dark:border-blue-800 pb-2 mb-3">
            <h3 class="text-sm font-black text-blue-900 dark:text-blue-100 tracking-tight">
                <i class="fa-regular fa-calendar-check text-blue-500 mr-2"></i> Attendance
            </h3>
            <button onclick="promptAddIcJuncture()" class="text-[11px] bg-blue-50 text-blue-600 border-2 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 font-bold px-2 py-0.5 rounded hover:bg-blue-100 transition focus:outline-none">+ New</button>
        </div>
        <div class="mb-3">
            <select id="icJunctureSelect" onchange="renderGroupAttendance()" class="w-full p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold">
                <option value="">Select a juncture...</option>
                <optgroup label="Admin Junctures" id="optgroup-admin-junctures"></optgroup>
                <optgroup label="My Custom Junctures" id="optgroup-ic-junctures"></optgroup>
            </select>
        </div>
        <div id="icAttendanceContainer" class="min-h-[100px] flex items-center justify-center text-sm font-bold text-gray-400">
            Select a juncture to take attendance
        </div>
        
        <div class="flex justify-between items-center border-t-2 border-gray-100 dark:border-gray-800 mt-4 pt-3">
            <button onclick="promptDeleteIcJuncture()" class="text-xs text-red-500 hover:text-red-700 transition font-bold"><i class="fa-solid fa-trash mr-1"></i> Delete Juncture</button>
            <button id="icSyncBtn" onclick="syncIcAttendance()" class="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow flex items-center gap-2">
                <span>Save</span>
                <div id="icSyncSpinner" class="hidden-force spinner-white w-3 h-3 border-2"></div>
            </button>
        </div>
    </div>\`;
}
tabProfile.innerHTML = navHtml + topBannersHtml + personalDetailsHeader + profilesHtml + receiptsHtml + paymentHtml + '</div>' + myGroupHtml + myAttendanceHtml;
`;

code = code.replace(searchHtmlStr, replaceHtmlStr);

const logicStr = `
let currentIcAttendanceData = {};
let pendingIcAttendanceUpdates = new Map();

window.renderGroupAttendance = async function(forceRebuild = false) {
    const select = document.getElementById('icJunctureSelect');
    if (!select) return;

    if (select.options.length <= 1) {
        let adminHtml = '';
        (appSettings.junctures || []).forEach(j => {
            adminHtml += \`<option value="\${j}">\${j}</option>\`;
        });
        document.getElementById('optgroup-admin-junctures').innerHTML = adminHtml;

        let icHtml = '';
        loadedIcJunctures.forEach(j => {
            icHtml += \`<option value="[IC] \${j}">\${j}</option>\`;
        });
        document.getElementById('optgroup-ic-junctures').innerHTML = icHtml;
    }

    const juncture = select.value;
    const container = document.getElementById('icAttendanceContainer');
    if (!juncture) {
        container.innerHTML = 'Select a juncture to take attendance';
        return;
    }

    container.innerHTML = '<div class="loader w-6 h-6 border-blue-500 mx-auto"></div>';
    
    try {
        const res = await apiCall('fetchAttendanceData', { juncture: juncture, forceRebuild });
        currentIcAttendanceData = res.data || {};
    } catch(e) {
        console.error("Failed to load attendance", e);
        container.innerHTML = '<div class="text-red-500">Failed to load attendance data.</div>';
        return;
    }

    pendingIcAttendanceUpdates.clear();

    let html = '<div class="flex flex-col gap-2">';
    
    // Sort logic
    let sortedMembers = [...loadedGroupMembers];
    sortedMembers.sort((a,b) => String(a.fullName).localeCompare(String(b.fullName)));

    sortedMembers.forEach(member => {
        const dName = member.fullName || member.name;
        const shortRole = member.role.substring(0,3);
        const roleColor = member.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (member.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
        
        const isPresent = currentIcAttendanceData[member.nric] ? currentIcAttendanceData[member.nric].status : false;
        const ts = currentIcAttendanceData[member.nric] ? currentIcAttendanceData[member.nric].ts : 0;
        
        let tsStr = '';
        if (ts > 0) {
            const d = new Date(ts);
            tsStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true});
        }

        const bgClass = isPresent ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';

        html += \`
        <div class="flex items-center justify-between p-2 rounded-lg border-2 \${bgClass} cursor-pointer select-none transition-colors" onclick="toggleIcAttendance('\${member.nric}')" id="att-card-\${member.nric}">
            <div class="flex items-center gap-2 overflow-hidden flex-1">
                <div class="shrink-0 w-5 h-5 rounded border-2 \${isPresent ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'} flex items-center justify-center transition-colors" id="att-check-\${member.nric}">
                    \${isPresent ? '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}
                </div>
                <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-1.5">
                        <span class="text-[9px] font-black uppercase \${roleColor} bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">\${shortRole}</span>
                        <span class="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">\${dName}</span>
                    </div>
                    \${tsStr ? \`<span class="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5" id="att-ts-\${member.nric}">\${tsStr}</span>\` : \`<span class="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5 hidden-force" id="att-ts-\${member.nric}"></span>\`}
                </div>
            </div>
        </div>
        \`;
    });

    html += '</div>';
    container.innerHTML = html;
};

window.toggleIcAttendance = function(nric) {
    let currentStatus = false;
    if (pendingIcAttendanceUpdates.has(nric)) {
        currentStatus = pendingIcAttendanceUpdates.get(nric).status;
    } else {
        currentStatus = currentIcAttendanceData[nric] ? currentIcAttendanceData[nric].status : false;
    }
    
    const newStatus = !currentStatus;
    
    pendingIcAttendanceUpdates.set(nric, { nric: nric, status: newStatus });
    
    const card = document.getElementById('att-card-' + nric);
    const check = document.getElementById('att-check-' + nric);
    const tsEl = document.getElementById('att-ts-' + nric);
    
    if(card && check && tsEl) {
        if(newStatus) {
            card.className = "flex items-center justify-between p-2 rounded-lg border-2 bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 cursor-pointer select-none transition-colors";
            check.className = "shrink-0 w-5 h-5 rounded border-2 bg-green-500 border-green-500 flex items-center justify-center transition-colors";
            check.innerHTML = '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
            
            const now = new Date();
            tsEl.innerText = 'Just now';
            tsEl.classList.remove('hidden-force');
        } else {
            card.className = "flex items-center justify-between p-2 rounded-lg border-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer select-none transition-colors";
            check.className = "shrink-0 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-colors";
            check.innerHTML = '';
            tsEl.classList.add('hidden-force');
        }
    }
    
    document.getElementById('icSyncBtn').classList.remove('bg-gray-400');
    document.getElementById('icSyncBtn').classList.add('bg-blue-600');
};

window.syncIcAttendance = async function() {
    if (pendingIcAttendanceUpdates.size === 0) return;
    const juncture = document.getElementById('icJunctureSelect').value;
    if (!juncture) return;

    const btn = document.getElementById('icSyncBtn');
    const spinner = document.getElementById('icSyncSpinner');
    btn.disabled = true;
    spinner.classList.remove('hidden-force');
    
    const updates = Array.from(pendingIcAttendanceUpdates.values());
    
    try {
        await apiCall('syncAttendanceUpdate', { juncture: juncture, updates: updates, takenBy: currentUser.displayName || currentUser.name || currentUser.nric });
        pendingIcAttendanceUpdates.clear();
        btn.classList.remove('bg-blue-600');
        btn.classList.add('bg-green-500');
        btn.querySelector('span').innerText = 'Saved';
        setTimeout(() => {
            btn.classList.remove('bg-green-500');
            btn.classList.add('bg-blue-600');
            btn.querySelector('span').innerText = 'Save';
            renderGroupAttendance(true);
        }, 1500);
    } catch(e) {
        showToast("Failed to save attendance: " + e.message, true);
        btn.classList.remove('bg-blue-600');
        btn.classList.add('bg-red-500');
        setTimeout(() => {
            btn.classList.remove('bg-red-500');
            btn.classList.add('bg-blue-600');
        }, 1500);
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden-force');
    }
};

window.promptAddIcJuncture = async function() {
    const name = prompt("Enter new juncture name (e.g. Breakfast, Gathering):");
    if (!name) return;
    
    showToast("Creating juncture...");
    try {
        const res = await apiCall('modifyICJunctures', { actionType: 'add', newName: name.trim(), groupName: loadedLogisticsGroup });
        if (res.status === 'success') {
            loadedIcJunctures = res.icJunctures;
            const select = document.getElementById('icJunctureSelect');
            let icHtml = '';
            loadedIcJunctures.forEach(j => {
                icHtml += \`<option value="[IC] \${j}">\${j}</option>\`;
            });
            document.getElementById('optgroup-ic-junctures').innerHTML = icHtml;
            select.value = \`[IC] \${name.trim()}\`;
            renderGroupAttendance();
            showToast("Juncture created!");
        }
    } catch (e) {
        showToast("Error creating juncture", true);
    }
};

window.promptDeleteIcJuncture = async function() {
    const select = document.getElementById('icJunctureSelect');
    const val = select.value;
    if (!val || !val.startsWith('[IC] ')) {
        alert("You can only delete your custom junctures.");
        return;
    }
    const realName = val.substring(5);
    
    if (!confirm(\`Are you sure you want to delete the custom juncture '\${realName}'?\`)) return;
    
    showToast("Deleting juncture...");
    try {
        const res = await apiCall('modifyICJunctures', { actionType: 'remove', oldName: realName, groupName: loadedLogisticsGroup });
        if (res.status === 'success') {
            loadedIcJunctures = res.icJunctures;
            let icHtml = '';
            loadedIcJunctures.forEach(j => {
                icHtml += \`<option value="[IC] \${j}">\${j}</option>\`;
            });
            document.getElementById('optgroup-ic-junctures').innerHTML = icHtml;
            select.value = '';
            renderGroupAttendance();
            showToast("Juncture deleted.");
        }
    } catch (e) {
        showToast("Error deleting juncture", true);
    }
};
`;

code += '\n' + logicStr;

fs.writeFileSync('frontend/js/profile.js', code);
