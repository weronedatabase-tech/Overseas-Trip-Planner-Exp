const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

code = code.replace(
    /\} else if \(dndState\.type === 'rooming'\) \{\s*const roomDropZone = elAtPoint \? elAtPoint\.closest\('\.dnd-room-dropzone'\) : null;\s*if \(roomDropZone && dndState\.el\) \{\s*const sourceNric = dndState\.el\.dataset\.nric;\s*const targetRoomId = roomDropZone\.dataset\.roomId;\s*if \(sourceNric && targetRoomId\) handleRoomDrop\(sourceNric, targetRoomId\);\s*\}\s*\}/,
    `} else if (dndState.type === 'rooming') {
            const roomDropZone = elAtPoint ? elAtPoint.closest('.dnd-room-dropzone') : null;
            if (roomDropZone && dndState.el) {
                const sourceNric = dndState.el.dataset.nric;
                const targetRoomId = roomDropZone.dataset.roomId;
                if (sourceNric && targetRoomId) handleRoomDrop(sourceNric, targetRoomId);
            }
        } else if (dndState.type === 'grouping') {
            const groupDropZone = elAtPoint ? elAtPoint.closest('.dnd-group-dropzone') : null;
            if (groupDropZone && dndState.el) {
                const sourceNric = dndState.el.dataset.nric;
                // If it's the unassigned pool, dropZone.dataset.group will be undefined or empty
                const targetGroup = groupDropZone.id === 'groupUnassignedPool' ? '' : groupDropZone.dataset.group;
                if (sourceNric && typeof targetGroup !== 'undefined') handleGroupDrop(sourceNric, targetGroup);
            }
        } else if (dndState.type === 'busing') {
            const busDropZone = elAtPoint ? elAtPoint.closest('.dnd-bus-dropzone') : null;
            if (busDropZone && dndState.el) {
                const sourceNric = dndState.el.dataset.nric;
                const targetBus = busDropZone.id === 'busUnassignedPool' ? '' : busDropZone.dataset.bus;
                if (sourceNric && typeof targetBus !== 'undefined') handleBusDrop(sourceNric, targetBus);
            }
        }`
);

fs.writeFileSync('frontend/js/logistics.js', code);
