const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

const targetStart = 'function handleGroupDrop(nric, groupName) {';

let startIdx = code.indexOf(targetStart);
let endIdx = code.indexOf('function handleBusDrop', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const oldFunc = code.substring(startIdx, endIdx);
    
    const newFunc = `window.handleGroupDrop = async function(nric, groupName) {
    const p = globalLogistics.participants.find(x => x.nric === nric);
    if (!p) return;
    
    // Check if moving a Group IC
    if (p.isGroupIC && p.logisticsGroup !== groupName) {
        const confirmMsg = "This participant is currently the Group IC of Group " + (p.logisticsGroup || 'Unknown') + ".\\n\\nMoving them to a different group will unassign them as Group IC.\\n\\nDo you want to proceed and unassign them?";
        if (!confirm(confirmMsg)) {
            return; // Cancel
        }
        
        p.isGroupIC = false;
        try {
            await apiCall('syncAssignments', { updates: [{ nric: nric, value: false }], column: 'isGroupIC' });
        } catch (e) {
            console.error("Failed to unassign Group IC", e);
        }
    }

    p.logisticsGroup = groupName;
    pendingGroupUpdates.set(nric, { nric: nric, value: groupName });

    // Handle pairing logic (auto group paired vols / caregivers)
    let connected = getConnectedParticipants(nric);
    connected.forEach(cNric => {
        let cp = globalLogistics.participants.find(x => x.nric === cNric);
        if (cp && cp.logisticsGroup !== groupName) {
            cp.logisticsGroup = groupName;
            pendingGroupUpdates.set(cNric, { nric: cNric, value: groupName });
        }
    });

    renderGroups();
    triggerGroupSync();
}

`;
    code = code.substring(0, startIdx) + newFunc + code.substring(endIdx);
    fs.writeFileSync('frontend/js/logistics.js', code);
    console.log("Replaced handleGroupDrop");
} else {
    console.log("Could not find start/end idx");
}
