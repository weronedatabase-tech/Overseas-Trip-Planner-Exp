const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

code = code.replace(
    /function selectGroupBusOption\(value\) \{\s*if \(\!activeAssignNric\) return;\s*if \(activeAssignType === 'group'\) \{\s*handleGroupDrop\(activeAssignNric, value\);\s*\} else \{\s*handleBusDrop\(activeAssignNric, value\);\s*\}\s*closeSelectionSheet\(\);\s*\}/,
    `function selectGroupBusOption(value) {
    if (!activeAssignNric) return;
    if (activeAssignType === 'group') {
        handleGroupDrop(activeAssignNric, value);
    } else if (activeAssignType === 'bus') {
        handleBusDrop(activeAssignNric, value);
    } else if (activeAssignType === 'room') {
        if (value === "") { // Handle unassign
            globalLogistics.rooms.forEach(r => {
                if(!r.isDeleted && r.occupants.includes(activeAssignNric)) {
                    r.occupants = r.occupants.filter(n => n !== activeAssignNric);
                    r.ts = Date.now();
                    queueRoomUpdate(r.id);
                }
            });
            renderRooms();
        } else {
            handleRoomDrop(activeAssignNric, value);
        }
    }
    closeSelectionSheet();
}`
);

fs.writeFileSync('frontend/js/logistics.js', code);
