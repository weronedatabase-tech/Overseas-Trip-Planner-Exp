const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

// Replace manualSyncGroups
code = code.replace(
    /async function manualSyncGroups\(\) \{\s*if \(pendingGroupUpdates\.size \> 0\) await executeGroupSync\(\);\s*\}/,
    `async function manualSyncGroups() {
    if (pendingGroupUpdates.size > 0) {
        await executeGroupSync();
    }
    setGroupSyncButtonState('loading');
    try {
        const res = await apiCall('fetchLogistics');
        if (res.participants) {
            let hasChanges = false;
            res.participants.forEach(sPart => {
                if (!pendingGroupUpdates.has(sPart.nric)) {
                    let lPart = globalLogistics.participants.find(p => p.nric === sPart.nric);
                    if (lPart && lPart.logisticsGroup !== sPart.logisticsGroup) {
                        lPart.logisticsGroup = sPart.logisticsGroup;
                        hasChanges = true;
                    }
                }
            });
            if (hasChanges) renderGroups();
        }
        setGroupSyncButtonState('saved');
        showToast("Groups refreshed from server!");
    } catch (err) {
        setGroupSyncButtonState('error');
    }
}`
);

// Replace manualSyncBuses
code = code.replace(
    /async function manualSyncBuses\(\) \{\s*if \(pendingBusUpdates\.size \> 0\) await executeBusSync\(\);\s*\}/,
    `async function manualSyncBuses() {
    if (pendingBusUpdates.size > 0) {
        await executeBusSync();
    }
    setBusSyncButtonState('loading');
    try {
        const res = await apiCall('fetchLogistics');
        if (res.participants) {
            let hasChanges = false;
            res.participants.forEach(sPart => {
                if (!pendingBusUpdates.has(sPart.nric)) {
                    let lPart = globalLogistics.participants.find(p => p.nric === sPart.nric);
                    if (lPart && lPart.bus !== sPart.bus) {
                        lPart.bus = sPart.bus;
                        hasChanges = true;
                    }
                }
            });
            if (hasChanges) renderBuses();
        }
        setBusSyncButtonState('saved');
        showToast("Buses refreshed from server!");
    } catch (err) {
        setBusSyncButtonState('error');
    }
}`
);

// Update executeGroupSync
code = code.replace(
    /async function executeGroupSync\(\) \{\s*if \(isGroupSyncing \|\| pendingGroupUpdates\.size === 0\) return;\s*isGroupSyncing = true;\s*const batch = Array\.from\(pendingGroupUpdates\.values\(\)\);\s*pendingGroupUpdates\.clear\(\);\s*try \{\s*await apiCall\('syncAssignments', \{ updates: batch, column: 'logisticsGroup' \}\);\s*\} finally \{\s*isGroupSyncing = false;\s*if \(pendingGroupUpdates\.size \> 0\) triggerGroupSync\(\);\s*\}/,
    `async function executeGroupSync() {
    if (isGroupSyncing || pendingGroupUpdates.size === 0) return;
    isGroupSyncing = true;
    setGroupSyncButtonState('saving');
    const batch = Array.from(pendingGroupUpdates.values());
    pendingGroupUpdates.clear();
    try {
        await apiCall('syncAssignments', { updates: batch, column: 'logisticsGroup' });
        setGroupSyncButtonState('saved');
    } catch (err) {
        setGroupSyncButtonState('error');
    } finally {
        isGroupSyncing = false;
        if (pendingGroupUpdates.size > 0) triggerGroupSync();
    }
}`
);

// Update executeBusSync
code = code.replace(
    /async function executeBusSync\(\) \{\s*if \(isBusSyncing \|\| pendingBusUpdates\.size === 0\) return;\s*isBusSyncing = true;\s*const batch = Array\.from\(pendingBusUpdates\.values\(\)\);\s*pendingBusUpdates\.clear\(\);\s*try \{\s*await apiCall\('syncAssignments', \{ updates: batch, column: 'bus' \}\);\s*\} finally \{\s*isBusSyncing = false;\s*if \(pendingBusUpdates\.size \> 0\) triggerBusSync\(\);\s*\}/,
    `async function executeBusSync() {
    if (isBusSyncing || pendingBusUpdates.size === 0) return;
    isBusSyncing = true;
    setBusSyncButtonState('saving');
    const batch = Array.from(pendingBusUpdates.values());
    pendingBusUpdates.clear();
    try {
        await apiCall('syncAssignments', { updates: batch, column: 'bus' });
        setBusSyncButtonState('saved');
    } catch (err) {
        setBusSyncButtonState('error');
    } finally {
        isBusSyncing = false;
        if (pendingBusUpdates.size > 0) triggerBusSync();
    }
}`
);

// Add state update functions
code += `
function setGroupSyncButtonState(state) {
    const btn = document.querySelector('.btn-sync-groups');
    if(!btn) return;
    const textSpan = btn.querySelector('.btn-text'); 
    const spinner = btn.querySelector('.btn-spinner');
    btn.className = "btn-sync-groups text-xs md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
    spinner.className = "btn-spinner ml-1 !w-3 !h-3 hidden-force"; 
    if (state === 'loading') { 
        btn.classList.add('bg-gray-100', 'text-gray-500', 'border-gray-200', 'dark:bg-gray-800', 'dark:text-gray-400', 'dark:border-gray-700'); 
        textSpan.textContent = "Loading..."; 
        spinner.classList.remove('hidden-force', 'hidden'); 
        spinner.classList.add('spinner-primary'); 
    } else if(state === 'saving') { 
        btn.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-200', 'dark:bg-yellow-900/30', 'dark:text-yellow-300', 'dark:border-yellow-800'); 
        textSpan.textContent = "Saving..."; 
        spinner.classList.remove('hidden-force', 'hidden'); 
        spinner.classList.add('spinner-yellow'); 
    } else if (state === 'saved') { 
        btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200', 'dark:bg-green-900/30', 'dark:text-green-300', 'dark:border-green-800'); 
        textSpan.textContent = "Saved"; 
    } else if (state === 'error') { 
        btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200', 'dark:bg-red-900/30', 'dark:text-red-300', 'dark:border-red-800'); 
        textSpan.textContent = "Error"; 
    }
}

function setBusSyncButtonState(state) {
    const btn = document.querySelector('.btn-sync-buses');
    if(!btn) return;
    const textSpan = btn.querySelector('.btn-text'); 
    const spinner = btn.querySelector('.btn-spinner');
    btn.className = "btn-sync-buses text-xs md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
    spinner.className = "btn-spinner ml-1 !w-3 !h-3 hidden-force"; 
    if (state === 'loading') { 
        btn.classList.add('bg-gray-100', 'text-gray-500', 'border-gray-200', 'dark:bg-gray-800', 'dark:text-gray-400', 'dark:border-gray-700'); 
        textSpan.textContent = "Loading..."; 
        spinner.classList.remove('hidden-force', 'hidden'); 
        spinner.classList.add('spinner-primary'); 
    } else if(state === 'saving') { 
        btn.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-200', 'dark:bg-yellow-900/30', 'dark:text-yellow-300', 'dark:border-yellow-800'); 
        textSpan.textContent = "Saving..."; 
        spinner.classList.remove('hidden-force', 'hidden'); 
        spinner.classList.add('spinner-yellow'); 
    } else if (state === 'saved') { 
        btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200', 'dark:bg-green-900/30', 'dark:text-green-300', 'dark:border-green-800'); 
        textSpan.textContent = "Saved"; 
    } else if (state === 'error') { 
        btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200', 'dark:bg-red-900/30', 'dark:text-red-300', 'dark:border-red-800'); 
        textSpan.textContent = "Error"; 
    }
}
`;

// One fix for btn HTML in frontend/js/logistics.js (spinner html)
code = code.replace(
    /<button onclick="manualSyncGroups\(this\)" class="btn-sync-groups (.*?)">\s*<span class="btn-text">Saved<\/span><i class="fa-solid fa-circle-notch fa-spin btn-spinner hidden ml-1"><\/i>\s*<\/button>/g,
    `<button onclick="manualSyncGroups()" class="btn-sync-groups $1">\n                <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>\n            </button>`
);

code = code.replace(
    /<button onclick="manualSyncBuses\(this\)" class="btn-sync-buses (.*?)">\s*<span class="btn-text">Saved<\/span><i class="fa-solid fa-circle-notch fa-spin btn-spinner hidden ml-1"><\/i>\s*<\/button>/g,
    `<button onclick="manualSyncBuses()" class="btn-sync-buses $1">\n                <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>\n            </button>`
);

fs.writeFileSync('frontend/js/logistics.js', code);
