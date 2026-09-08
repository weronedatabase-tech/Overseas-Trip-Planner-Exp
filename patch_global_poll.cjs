const fs = require('fs');
let code = fs.readFileSync('frontend/js/main.js', 'utf8');

const syncMetadataPolling = `
let metadataPollInterval = setInterval(async () => {
    if (!currentUser) return;
    try {
        const res = await apiCall('fetchSyncMetadata');
        if (res.status === 'success') {
            let hasChanges = false;
            
            // Junctures
            if (JSON.stringify(appSettings.junctures) !== JSON.stringify(res.junctures)) {
                appSettings.junctures = res.junctures;
                const juncSel = document.getElementById('attJunctureSelect');
                if (juncSel) {
                    const currentVal = juncSel.value;
                    juncSel.innerHTML = '';
                    appSettings.junctures.forEach(j => juncSel.innerHTML += \`<option value="\${j}">\${j}</option>\`);
                    if (appSettings.junctures.includes(currentVal)) {
                        juncSel.value = currentVal;
                    }
                }
                hasChanges = true;
            }
            
            // Groups
            if (typeof activeGroupsList !== 'undefined' && JSON.stringify(activeGroupsList) !== JSON.stringify(res.groups)) {
                activeGroupsList = res.groups || [];
                localStorage.setItem('activeGroupsList', JSON.stringify(activeGroupsList));
                if (typeof renderGroups === 'function') renderGroups();
                if (typeof renderGroupBusOptions === 'function') renderGroupBusOptions();
            }
            
            // Buses
            if (typeof activeBusesList !== 'undefined' && JSON.stringify(activeBusesList) !== JSON.stringify(res.buses)) {
                activeBusesList = res.buses || [];
                localStorage.setItem('activeBusesList', JSON.stringify(activeBusesList));
                if (typeof renderBuses === 'function') renderBuses();
                if (typeof renderGroupBusOptions === 'function') renderGroupBusOptions();
            }
        }
    } catch(e){}
}, 15000);
`;

code = code.replace(
  /function initApp\(\) \{/,
  syncMetadataPolling + '\nfunction initApp() {'
);

fs.writeFileSync('frontend/js/main.js', code);
console.log('Patched global poll');
