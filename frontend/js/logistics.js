let pairingSyncTimeout = null;
let altSwapMode = false;
let hidePairedVols = false;
let hidePairedTrainees = false;
window.toggleHidePaired = function(type, el) {
  if (type === 'VOLUNTEER') hidePairedVols = el.checked;
  if (type === 'TRAINEE') hidePairedTrainees = el.checked;
  renderPairings();
};

let currentPairingSourceRole = 'TRAINEE';
let pendingPairingsMap = new Map();
let isPairingSyncing = false;
let pairingPollInterval = null;

let pendingRoomUpdates = new Map();
let isRoomSyncing = false;
let roomSyncTimeout = null;
let activeRoomTargetId = null;

// Expose DND state globally
let dndState = {
isDragging: false,
el: null,
clone: null,
startX: 0,
startY: 0,
nameNode: null,
rectWidth: 0,
rectHeight: 0,
type: 'pairing' 
};

// ==========================================
// DRAG & DROP ENGINE (Mouse + Touch)
// ==========================================
if (!window.dndInitialized) {
window.dndInitialized = true;

document.addEventListener('touchstart', (e) => {
    if(e.touches.length > 1) return;
    startDrag(e, e.touches[0].clientX, e.touches[0].clientY, true);
}, {passive: false});

document.addEventListener('touchmove', (e) => {
    moveDrag(e, e.touches[0].clientX, e.touches[0].clientY, true);
}, {passive: false});

document.addEventListener('touchend', (e) => {
    const touch = e.changedTouches ? e.changedTouches[0] : e.touches[0];
    endDrag(e, touch.clientX, touch.clientY);
});

document.addEventListener('touchcancel', (e) => {
    const touch = e.changedTouches ? e.changedTouches[0] : e.touches[0];
    endDrag(e, touch.clientX, touch.clientY);
});

document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; 
    startDrag(e, e.clientX, e.clientY, false);
});

document.addEventListener('mousemove', (e) => {
    moveDrag(e, e.clientX, e.clientY, false);
});

document.addEventListener('mouseup', (e) => {
    endDrag(e, e.clientX, e.clientY);
});

function startDrag(e, clientX, clientY, isTouch) {
    if(e.target.closest('.remove-x') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;

    let draggable = e.target.closest('.dnd-draggable');
    
    let roomDraggable = e.target.closest('.dnd-room-draggable');
    let groupDraggable = e.target.closest('.dnd-group-draggable');
    let busDraggable = e.target.closest('.dnd-bus-draggable');
    if(!draggable && !roomDraggable && !groupDraggable && !busDraggable) return;

    if (draggable) {
        const pairingContainer = document.getElementById('log-pairings');
        if(!pairingContainer || pairingContainer.classList.contains('hidden-force')) return;
        dndState.type = 'pairing';
        dndState.el = draggable;
    } else if (roomDraggable) {
        const roomsContainer = document.getElementById('log-rooms');
        if(!roomsContainer || roomsContainer.classList.contains('hidden-force')) return;
        dndState.type = 'rooming';
        dndState.el = roomDraggable;
    } else if (groupDraggable) {
        const groupsContainer = document.getElementById('log-groups');
        if(!groupsContainer || groupsContainer.classList.contains('hidden-force')) return;
        dndState.type = 'grouping';
        dndState.el = groupDraggable;
    } else if (busDraggable) {
        const busesContainer = document.getElementById('log-buses');
        if(!busesContainer || busesContainer.classList.contains('hidden-force')) return;
        dndState.type = 'busing';
        dndState.el = busDraggable;
    }
    dndState.nameNode = dndState.el.querySelector('.main-name-pill') || dndState.el;
    const rect = dndState.nameNode.getBoundingClientRect();
    dndState.rectWidth = rect.width;
    dndState.rectHeight = rect.height;
    dndState.startX = clientX;
    dndState.startY = clientY;
    dndState.isDragging = false;
}

function moveDrag(e, clientX, clientY, isTouch) {
    if (!dndState.el) return;
    const deltaX = Math.abs(clientX - dndState.startX);
    const deltaY = Math.abs(clientY - dndState.startY);

    if (!dndState.isDragging) {
        const threshold = 8;
        let shouldStartDrag = false;
        let shouldCancelDrag = false;

        if (isTouch) {
            // On touch devices, strictly require horizontal movement to initiate a drag.
            // This prevents interfering with native vertical scrolling.
            if (deltaX > threshold && deltaX > deltaY) {
                shouldStartDrag = true;
            } else if (deltaY > threshold && deltaY > deltaX) {
                shouldCancelDrag = true;
            }
        } else {
            // On desktop/mouse, any movement direction is fine since there's no native scroll conflict
            if (deltaX > threshold || deltaY > threshold) {
                shouldStartDrag = true;
            }
        }

        if (shouldCancelDrag) {
            dndState.el = null;
            return;
        }

        if (shouldStartDrag) {
            dndState.isDragging = true;
            if(isTouch && navigator.vibrate) {
                try { navigator.vibrate(20); } catch(err){}
            }
            dndState.el.classList.add('locked-for-drag');
            
            dndState.clone = dndState.nameNode.cloneNode(true);
            dndState.clone.classList.add('dragging-clone');
            dndState.clone.style.width = dndState.rectWidth + 'px';
            dndState.clone.style.height = dndState.rectHeight + 'px';
            dndState.clone.style.margin = '0px';
            document.body.appendChild(dndState.clone);
        }
    }

    if (dndState.isDragging && dndState.clone) {
        if(e.cancelable) e.preventDefault(); 
        updateClonePosition(clientX, clientY);

        const elAtPoint = document.elementFromPoint(clientX, clientY);

        if (dndState.type === 'pairing') {
            const activeDz = elAtPoint ? elAtPoint.closest('.dnd-dropzone') : null;
            document.querySelectorAll('.dnd-dropzone').forEach(dz => {
                if (dz === activeDz && dz.dataset.role !== dndState.el.dataset.role) {
                    dz.classList.add('border-primary', 'bg-green-50', 'dark:bg-green-900/30', 'dark:border-primary', 'ring-1', 'ring-primary');
                } else {
                    dz.classList.remove('border-primary', 'bg-green-50', 'dark:bg-green-900/30', 'dark:border-primary', 'ring-1', 'ring-primary');
                }
            });
        } else if (dndState.type === 'grouping') {
            const activeGroup = elAtPoint ? elAtPoint.closest('.dnd-group-dropzone') : null;
            document.querySelectorAll('.dnd-group-dropzone').forEach(dz => {
                if (dz === activeGroup) {
                    dz.classList.add('border-primary', 'bg-green-50', 'dark:bg-green-900/30', 'dark:border-primary', 'ring-1', 'ring-primary');
                } else {
                    dz.classList.remove('border-primary', 'bg-green-50', 'dark:bg-green-900/30', 'dark:border-primary', 'ring-1', 'ring-primary');
                }
            });
        } else if (dndState.type === 'busing') {
            const activeBus = elAtPoint ? elAtPoint.closest('.dnd-bus-dropzone') : null;
            document.querySelectorAll('.dnd-bus-dropzone').forEach(dz => {
                if (dz === activeBus) {
                    dz.classList.add('border-primary', 'bg-green-50', 'dark:bg-green-900/30', 'dark:border-primary', 'ring-1', 'ring-primary');
                } else {
                    dz.classList.remove('border-primary', 'bg-green-50', 'dark:bg-green-900/30', 'dark:border-primary', 'ring-1', 'ring-primary');
                }
            });
        }
 else if (dndState.type === 'rooming') {
            const activeRoom = elAtPoint ? elAtPoint.closest('.dnd-room-dropzone') : null;
            document.querySelectorAll('.dnd-room-dropzone').forEach(dz => {
                if (dz === activeRoom) {
                    dz.classList.add('border-primary', 'bg-green-50', 'dark:bg-green-900/30', 'dark:border-primary', 'ring-1', 'ring-primary');
                } else {
                    dz.classList.remove('border-primary', 'bg-green-50', 'dark:bg-green-900/30', 'dark:border-primary', 'ring-1', 'ring-primary');
                }
            });
        }
    }
}

function endDrag(e, clientX, clientY) {
    if(dndState.el) dndState.el.classList.remove('locked-for-drag');

    if (dndState.isDragging && dndState.clone) {
        dndState.clone.remove(); 
        dndState.clone = null; 
        dndState.isDragging = false;

        document.querySelectorAll('.dnd-dropzone, .dnd-room-dropzone, .dnd-group-dropzone, .dnd-bus-dropzone').forEach(dz => dz.classList.remove('border-primary', 'bg-green-50', 'dark:bg-green-900/30', 'dark:border-primary', 'ring-1', 'ring-primary'));

        const elAtPoint = document.elementFromPoint(clientX, clientY);

        if (dndState.type === 'pairing') {
            const dropZone = elAtPoint ? elAtPoint.closest('.dnd-dropzone') : null;
            if(dropZone && dndState.el && dropZone.dataset.role !== dndState.el.dataset.role) {
                const sourceNric = dndState.el.dataset.nric;
                const sourceRole = dndState.el.dataset.role;
                const targetNric = dropZone.dataset.nric;
                if(sourceNric && targetNric) handleDndDrop(sourceNric, sourceRole, targetNric);
            }
        } else if (dndState.type === 'rooming') {
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
        }
    }
    dndState.el = null;
    dndState.nameNode = null;
}

function updateClonePosition(x, y) {
    if(dndState.clone) {
        const centerX = x - (dndState.rectWidth / 2);
        const centerY = y - (dndState.rectHeight / 2);
        dndState.clone.style.transform = `translate3d(${centerX}px, ${centerY}px, 0px) scale(1.05)`;
    }
}
}
// ==========================================
// PAIRING LOGIC
// ==========================================

function handleDndDrop(sourceNric, sourceRole, targetNric) {
let volNric = sourceRole === 'VOLUNTEER' ? sourceNric : targetNric;
let traineeNric = sourceRole === 'TRAINEE' ? sourceNric : targetNric;

// Group Constraint Check
let vPerson = globalLogistics.participants.find(p => p.nric === volNric);
let tPerson = globalLogistics.participants.find(p => p.nric === traineeNric);
let vGroup = (vPerson && vPerson.logisticsGroup) ? String(vPerson.logisticsGroup).trim().toLowerCase() : "";
let tGroup = (tPerson && tPerson.logisticsGroup) ? String(tPerson.logisticsGroup).trim().toLowerCase() : "";
let unassignedVals = ["", "-", "na", "n/a", "none", "unassigned"];
let isVUnassigned = unassignedVals.includes(vGroup);
let isTUnassigned = unassignedVals.includes(tGroup);

if (vPerson && tPerson && !isVUnassigned && !isTUnassigned && vGroup !== tGroup) {
    showToast("Cannot pair: Trainee and Volunteer must be in the same group, or one must be unassigned.", true);
    return;
}


let existing = globalLogistics.pairings.find(p => p.traineeNric === traineeNric && p.volNric === volNric);

if(!existing || existing.status !== 'ACTIVE') {
    const ts = Date.now();
    const key = traineeNric + '_' + volNric;
    pendingPairingsMap.set(key, { action: 'ADD', traineeNric, volNric, ts });

    if(existing) {
        existing.status = 'ACTIVE';
        existing.ts = ts;
    } else {
        globalLogistics.pairings.push({ traineeNric, volNric, status: 'ACTIVE', ts });
    }
    
    clearSearch('pairingSearchInput', 'renderPairings');
    renderPairings(); 
    triggerPairingSync();
} else {
    showToast("Already paired!", true);
}
}

function unpairTrainee(traineeNric, volNric) {
const ts = Date.now();
const key = traineeNric + '_' + volNric;
pendingPairingsMap.set(key, { action: 'REMOVE', traineeNric, volNric, ts });

let existing = globalLogistics.pairings.find(p => p.traineeNric === traineeNric && p.volNric === volNric);
if (existing) {
    existing.status = 'UNPAIRED';
    existing.ts = ts;
}

clearSearch('pairingSearchInput', 'renderPairings');
renderPairings(); 
triggerPairingSync();
}

function setSyncButtonState(state) {
const btns = document.querySelectorAll('.btn-sync-pairings');
if(btns.length === 0) return;
btns.forEach(btn => {
    const textSpan = btn.querySelector('.btn-text'); 
    const spinner = btn.querySelector('.btn-spinner');
    btn.className = "btn-sync-pairings text-xs md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
    spinner.className = "btn-spinner ml-1 !w-3 !h-3 hidden-force"; 
    if (state === 'loading') { 
        btn.classList.add('bg-gray-100', 'text-gray-500', 'border-gray-200', 'dark:bg-gray-800', 'dark:text-gray-400', 'dark:border-gray-700'); 
        textSpan.textContent = "Loading..."; 
        spinner.classList.remove('hidden-force'); 
        spinner.classList.add('spinner-primary'); 
    } else if(state === 'saving') { 
        btn.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-200', 'dark:bg-yellow-900/30', 'dark:text-yellow-300', 'dark:border-yellow-800'); 
        textSpan.textContent = "Saving..."; 
        spinner.classList.remove('hidden-force'); 
        spinner.classList.add('spinner-yellow'); 
    } else if (state === 'saved') { 
        btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200', 'dark:bg-green-900/30', 'dark:text-green-300', 'dark:border-green-800'); 
        textSpan.textContent = "Saved"; 
    } else if (state === 'error') { 
        btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200', 'dark:bg-red-900/30', 'dark:text-red-300', 'dark:border-red-800'); 
        textSpan.textContent = "Save Failed"; 
    }
});
}

function triggerPairingSync() {
setSyncButtonState('saving');
if (pairingSyncTimeout) clearTimeout(pairingSyncTimeout);
pairingSyncTimeout = setTimeout(() => { executePairingSync(); }, 2500); 
}

async function executePairingSync() {
if (pendingPairingsMap.size === 0) return;

isPairingSyncing = true;
setSyncButtonState('saving');

const batch = new Map(pendingPairingsMap);
const updates = Array.from(batch.values());
pendingPairingsMap.clear();

try {
    const res = await apiCall('syncPairingUpdates', { updates: updates, takenBy: currentUser.name });
    if(res.pairings) {
        res.pairings.forEach(sPair => {
            const key = sPair.traineeNric + '_' + sPair.volNric;
            if (!pendingPairingsMap.has(key)) {
                let lPair = globalLogistics.pairings.find(p => p.traineeNric === sPair.traineeNric && p.volNric === sPair.volNric);
                if (lPair) {
                    if (sPair.ts > lPair.ts) {
                        lPair.status = sPair.status;
                        lPair.ts = sPair.ts;
                    }
                } else {
                    globalLogistics.pairings.push(sPair);
                }
            }
        });
        if (!dndState.el && !dndState.isDragging && dndState.type === 'pairing') {
            renderPairings();
        }
    }
    setSyncButtonState('saved');
} catch(e) {
    showToast("Sync failed. Retrying...", true);
    setSyncButtonState('error');
    batch.forEach((val, key) => pendingPairingsMap.set(key, val));
} finally {
    isPairingSyncing = false;
}
}

function startPairingPolling() {
if (pairingPollInterval) clearInterval(pairingPollInterval);

pairingPollInterval = setInterval(async () => {
    const logTab = document.getElementById('tab-logistics');
    if(!logTab || logTab.classList.contains('hidden-force') || isPairingSyncing || pendingPairingsMap.size > 0 || (dndState.type === 'pairing' && (dndState.el || dndState.isDragging))) return;

    const fetchStartTime = Date.now();
    try {
        const res = await apiCall('fetchPairingsOnly');
        if (lastLocalChange > fetchStartTime) return; 

        if(res.pairings) {
            let hasChanges = false;
            res.pairings.forEach(sPair => {
                const key = sPair.traineeNric + '_' + sPair.volNric;
                if (!pendingPairingsMap.has(key)) {
                    let lPair = globalLogistics.pairings.find(p => p.traineeNric === sPair.traineeNric && p.volNric === sPair.volNric);
                    if (lPair) {
                        if (sPair.ts > lPair.ts) {
                            lPair.status = sPair.status;
                            lPair.ts = sPair.ts;
                            hasChanges = true;
                        }
                    } else {
                        globalLogistics.pairings.push(sPair);
                        hasChanges = true;
                    }
                }
            });
            
            if (hasChanges && !dndState.el && !dndState.isDragging) {
                renderPairings();
                const sheet = document.getElementById('selectionBottomSheet');
                if(sheet && !sheet.classList.contains('hidden-force') && currentPairingTarget) {
                    openPairingSheet(currentPairingTarget, currentPairingSourceRole);
                }
            }
        }
    } catch(e) { }
}, 8000);
}

// ==========================================
// ROOMS LOGIC
// ==========================================
function generateRoomUUID(idx) { 
return 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + (idx !== undefined ? '_' + idx : ''); 
}

function setRoomSyncButtonState(state) {
const btn = document.getElementById('btn-sync-rooms');
if(!btn) return;
const textSpan = btn.querySelector('.btn-text'); 
const spinner = btn.querySelector('.btn-spinner');
btn.className = "text-xs md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
spinner.className = "btn-spinner ml-1 !w-3 !h-3 hidden-force"; 
if (state === 'loading') { 
    btn.classList.add('bg-gray-100', 'text-gray-500', 'border-gray-200', 'dark:bg-gray-800', 'dark:text-gray-400', 'dark:border-gray-700'); 
    textSpan.textContent = "Loading..."; 
    spinner.classList.remove('hidden-force'); 
    spinner.classList.add('spinner-primary'); 
} else if(state === 'saving') { 
    btn.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-200', 'dark:bg-yellow-900/30', 'dark:text-yellow-300', 'dark:border-yellow-800'); 
    textSpan.textContent = "Saving..."; 
    spinner.classList.remove('hidden-force'); 
    spinner.classList.add('spinner-yellow'); 
} else if (state === 'saved') { 
    btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200', 'dark:bg-green-900/30', 'dark:text-green-300', 'dark:border-green-800'); 
    textSpan.textContent = "Saved"; 
} else if (state === 'error') { 
    btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200', 'dark:bg-red-900/30', 'dark:text-red-300', 'dark:border-red-800'); 
    textSpan.textContent = "Save Failed"; 
}
}

function addRoom() {
const prefix = prompt("Enter Room Base Name (e.g. 'Room', 'Tent', 'Block A'):", "Room");
if (!prefix || !prefix.trim()) return;
const capStr = prompt("Enter Capacity per room:", "2");
const capacity = parseInt(capStr) || 2;
const qtyStr = prompt("Quantity of this room type to create:", "1");
const qty = parseInt(qtyStr) || 1;

if(!globalLogistics.rooms) globalLogistics.rooms = [];

let existingCount = globalLogistics.rooms.filter(r => !r.isDeleted && r.name.startsWith(prefix.trim())).length;

for(let i=0; i<qty; i++) {
    let roomName = prefix.trim();
    if (qty > 1 || existingCount > 0) {
        roomName = `${prefix.trim()} ${existingCount + i + 1}`;
    }
    const newRoom = { id: generateRoomUUID(i), name: roomName, capacity: capacity, occupants: [], ts: Date.now(), isDeleted: false };
    globalLogistics.rooms.push(newRoom);
    queueRoomUpdate(newRoom.id);
}
renderRooms();
showToast(`Created ${qty} room(s).`);
}

function promptEditRoom(id) {
const room = globalLogistics.rooms.find(r => r.id === id);
if(!room) return;
const name = prompt("Edit Room Name:", room.name);
if(!name || !name.trim()) return;
const capStr = prompt("Edit Room Capacity:", room.capacity);
const capacity = parseInt(capStr) || room.capacity;

room.name = name.trim();
room.capacity = capacity;
room.ts = Date.now();
queueRoomUpdate(id);
renderRooms();
}

function deleteRoom(id) {
if(!confirm("Are you sure you want to delete this room? Users inside will be unassigned.")) return;
const room = globalLogistics.rooms.find(r => r.id === id);
if(room) {
    room.isDeleted = true;
    room.ts = Date.now();
    room.occupants = [];
    queueRoomUpdate(id);
    renderRooms();
}
}

function deleteAllRooms() {
if(!confirm("⚠️ DANGER: This will delete ALL rooms and unassign everyone. Are you sure you want to proceed?")) return;
let changed = false;
globalLogistics.rooms.forEach(r => {
    if(!r.isDeleted) {
        r.isDeleted = true;
        r.ts = Date.now();
        r.occupants = [];
        queueRoomUpdate(r.id);
        changed = true;
    }
});
if(changed) {
    renderRooms();
    showToast("All rooms have been deleted.");
}
}

function resetRoomAssignments() {
if(!confirm("Are you sure you want to unassign everyone from all rooms?")) return;
let changed = false;
globalLogistics.rooms.forEach(r => {
    if(!r.isDeleted && r.occupants.length > 0) {
        r.occupants = [];
        r.ts = Date.now();
        queueRoomUpdate(r.id);
        changed = true;
    }
});
if(changed) {
    renderRooms();
    showToast("All assignments cleared.");
}
}

function autoAssignRooms() {
if(!confirm("This will automatically assign unassigned participants into EXISTING rooms based on their connections. Continue?")) return;
const activeRooms = globalLogistics.rooms.filter(r => !r.isDeleted);
const roomAssignments = {};
activeRooms.forEach(r => {
    r.occupants.forEach(n => roomAssignments[n] = r.id);
});

// Helper to accurately determine room state
function getRoomState(roomId) {
    const r = activeRooms.find(x => x.id === roomId);
    let hasFamily = false;
    let hasVolunteer = false;
    let genderSet = new Set();
    r.occupants.forEach(n => {
        const p = globalLogistics.participants.find(x => x.nric === n);
        if (p) {
            if (p.role === 'VOLUNTEER') hasVolunteer = true;
            if (p.role === 'CAREGIVER') hasFamily = true;
            
            if (window.isFamily(p.nric, globalLogistics.participants)) hasFamily = true;
            if (p.gender) genderSet.add(p.gender.toLowerCase());
        }
    });
    let gender = 'empty';
    if (genderSet.size > 1) gender = 'mixed';
    else if (genderSet.has('male')) gender = 'male';
    else if (genderSet.has('female')) gender = 'female';
    return { hasFamily, hasVolunteer, gender, available: r.capacity - r.occupants.length };
}

let placedCount = 0;
const unassigned = globalLogistics.participants.filter(p => !roomAssignments[p.nric]);
if(unassigned.length === 0) { showToast("Everyone is already assigned."); return; }

const familyGroups = {};
unassigned.forEach(p => {
    let targetPoc = p.pocNric;
    if(!familyGroups[targetPoc]) familyGroups[targetPoc] = [];
    familyGroups[targetPoc].push(p);
});
const families = [];
const nonFamily = [];
Object.keys(familyGroups).forEach(poc => {
    const group = familyGroups[poc];
    if(group.length > 1) {
        families.push(group);
    } else {
        nonFamily.push(...group);
    }
});

families.sort((a,b) => b.length - a.length);

// 2. Assign Families First (Must be kept together)
families.forEach(fam => {
    let bestRoom = activeRooms.find(r => {
        const state = getRoomState(r.id);
        return state.available >= fam.length && !state.hasVolunteer;
    });
    if (bestRoom) {
        fam.forEach(p => {
            bestRoom.occupants.push(p.nric);
            roomAssignments[p.nric] = bestRoom.id;
            placedCount++;
        });
        bestRoom.ts = Date.now();
        queueRoomUpdate(bestRoom.id);
    }
});

// 3. Build Pairing Clusters for remaining (Non-Family)
const pairClusters = [];
const visited = new Set();
const remainingUnassigned = nonFamily.filter(p => !roomAssignments[p.nric]);
const pairingsMap = {};
(globalLogistics.pairings || []).forEach(p => {
    if(p.status === 'ACTIVE') {
        if(!pairingsMap[p.traineeNric]) pairingsMap[p.traineeNric] = [];
        pairingsMap[p.traineeNric].push(p.volNric);
        if(!pairingsMap[p.volNric]) pairingsMap[p.volNric] = [];
        pairingsMap[p.volNric].push(p.traineeNric);
    }
});

remainingUnassigned.forEach(p => {
    if(!visited.has(p.nric)) {
        const cluster = [];
        const q = [p.nric];
        let cGender = p.gender ? p.gender.toLowerCase() : null;
        
        while(q.length > 0) {
            const curr = q.shift();
            if(!visited.has(curr)) {
                const pObj = globalLogistics.participants.find(x => x.nric === curr);
                if(pObj && !roomAssignments[curr]) {
                    const pGen = pObj.gender ? pObj.gender.toLowerCase() : null;
                    if (!cGender && pGen) cGender = pGen;
                    // Do not violate gender rule
                    if (pGen && cGender && pGen !== cGender) {
                        continue;
                    }
                    visited.add(curr);
                    cluster.push(pObj);
                    (pairingsMap[curr] || []).forEach(n => { if(!visited.has(n)) q.push(n); });
                }
            }
        }
        if(cluster.length > 0) pairClusters.push(cluster);
    }
});

// Sort clusters: volunteers first, then by size
pairClusters.sort((a,b) => {
    const aHasVol = a.some(p => p.role === 'VOLUNTEER') ? 1 : 0;
    const bHasVol = b.some(p => p.role === 'VOLUNTEER') ? 1 : 0;
    if (aHasVol !== bHasVol) return bHasVol - aHasVol;
    return b.length - a.length;
});

// 4. Assign Pair Clusters (Independent Trainees & Volunteers)
pairClusters.forEach(cluster => {
    let cGender = 'empty';
    const gSet = new Set(cluster.map(p => p.gender ? p.gender.toLowerCase() : ''));
    if(gSet.size > 1) cGender = 'mixed';
    else if(gSet.has('male')) cGender = 'male';
    else if(gSet.has('female')) cGender = 'female';
    
    const hasVol = cluster.some(p => p.role === 'VOLUNTEER');
    
    let bestRoom = activeRooms.find(r => {
        const state = getRoomState(r.id);
        if(state.available < cluster.length) return false;
        if(state.hasFamily) return false; // Prevent Vol/Trainee mixing with Family
        if(state.gender !== 'empty' && cGender !== 'empty' && state.gender !== cGender) return false;
        
        // "There must never be a room that only has trainees."
        if(!hasVol && !state.hasVolunteer) return false;
        
        return true;
    });
    
    if (bestRoom) {
        cluster.forEach(p => {
            bestRoom.occupants.push(p.nric);
            roomAssignments[p.nric] = bestRoom.id;
            placedCount++;
        });
        bestRoom.ts = Date.now();
        queueRoomUpdate(bestRoom.id);
    }
});
renderRooms();
if (placedCount > 0) {
    showToast(`Auto-assigned ${placedCount} participants.`);
} else {
    showToast("No clusters could be completely fitted.");
}
}

function handleRoomDrop(nric, targetRoomId) {
globalLogistics.rooms.forEach(r => {
    if(!r.isDeleted && r.occupants.includes(nric)) {
        r.occupants = r.occupants.filter(n => n !== nric);
        r.ts = Date.now();
        queueRoomUpdate(r.id);
    }
});

const targetRoom = globalLogistics.rooms.find(r => r.id === targetRoomId);
if(targetRoom && !targetRoom.isDeleted) {
    if(targetRoom.occupants.length >= targetRoom.capacity) {
        showToast("Room is full!", true);
        renderRooms(); 
        return;
    }
    targetRoom.occupants.push(nric);
    targetRoom.ts = Date.now();
    queueRoomUpdate(targetRoom.id);
}
clearSearch('roomSearchInput', 'renderRooms');
renderRooms();
}

function unassignFromRoom(nric, roomId) {
const room = globalLogistics.rooms.find(r => r.id === roomId);
if(room && !room.isDeleted) {
    room.occupants = room.occupants.filter(n => n !== nric);
    room.ts = Date.now();
    queueRoomUpdate(roomId);
    clearSearch('roomSearchInput', 'renderRooms');
    renderRooms();
}
}

function queueRoomUpdate(roomId) {
const room = globalLogistics.rooms.find(r => r.id === roomId);
if(room) {
    pendingRoomUpdates.set(roomId, room);
    setRoomSyncButtonState('saving');
    if(roomSyncTimeout) clearTimeout(roomSyncTimeout);
    roomSyncTimeout = setTimeout(() => { executeRoomSync(); }, 2500);
}
}

async function executeRoomSync() {
if (pendingRoomUpdates.size === 0) return;
isRoomSyncing = true;
setRoomSyncButtonState('saving');

const batch = new Map(pendingRoomUpdates);
const updates = Array.from(batch.values());
pendingRoomUpdates.clear();

try {
    const res = await apiCall('syncRoomUpdates', { updates: updates, takenBy: currentUser.name });
    if(res.rooms) {
        res.rooms.forEach(sRoom => {
            if (!pendingRoomUpdates.has(sRoom.id)) {
                let lRoom = globalLogistics.rooms.find(r => r.id === sRoom.id);
                if (lRoom) {
                    if (sRoom.ts > (lRoom.ts || 0)) {
                        lRoom.name = sRoom.name;
                        lRoom.capacity = sRoom.capacity;
                        lRoom.occupants = sRoom.occupants;
                        lRoom.isDeleted = sRoom.isDeleted;
                        lRoom.ts = sRoom.ts;
                    }
                } else {
                    globalLogistics.rooms.push(sRoom);
                }
            }
        });
        if (!dndState.el && !dndState.isDragging && dndState.type === 'rooming') {
            renderRooms();
        }
    }
    setRoomSyncButtonState('saved');
} catch(e) {
    setRoomSyncButtonState('error');
    batch.forEach((val, key) => pendingRoomUpdates.set(key, val));
} finally {
    isRoomSyncing = false;
}
}

function startRoomPolling() {
setInterval(async () => {
    const logTab = document.getElementById('tab-logistics');
    const roomSec = document.getElementById('log-rooms');
    if(!logTab || logTab.classList.contains('hidden-force') || !roomSec || roomSec.classList.contains('hidden-force') || isRoomSyncing || pendingRoomUpdates.size > 0 || (dndState.type === 'rooming' && (dndState.el || dndState.isDragging))) return;

    const fetchStartTime = Date.now();
    try {
        const res = await apiCall('fetchRoomsOnly');
        if (lastLocalChange > fetchStartTime) return;

        if(res.rooms) {
            let hasChanges = false;
            res.rooms.forEach(sRoom => {
                if (!pendingRoomUpdates.has(sRoom.id)) {
                    let lRoom = globalLogistics.rooms.find(r => r.id === sRoom.id);
                    if (lRoom) {
                        if (sRoom.ts > (lRoom.ts || 0)) {
                            lRoom.name = sRoom.name;
                            lRoom.capacity = sRoom.capacity;
                            lRoom.occupants = sRoom.occupants;
                            lRoom.isDeleted = sRoom.isDeleted;
                            lRoom.ts = sRoom.ts;
                            hasChanges = true;
                        }
                    } else {
                        globalLogistics.rooms.push(sRoom);
                        hasChanges = true;
                    }
                }
            });
            if(hasChanges && !dndState.el && !dndState.isDragging) {
                renderRooms();
            }
        }
    } catch(e){}
}, 10000);
}

async function manualSyncRooms(btn) {
if (pendingRoomUpdates.size > 0) {
    await executeRoomSync();
}
setRoomSyncButtonState('loading');
try {
    const res = await apiCall('fetchRoomsOnly');
    if(res.rooms) {
        let hasChanges = false;
        res.rooms.forEach(sRoom => {
            if (!pendingRoomUpdates.has(sRoom.id)) {
                let lRoom = globalLogistics.rooms.find(r => r.id === sRoom.id);
                if (lRoom) {
                    if (sRoom.ts > (lRoom.ts || 0)) {
                        lRoom.name = sRoom.name;
                        lRoom.capacity = sRoom.capacity;
                        lRoom.occupants = sRoom.occupants;
                        lRoom.isDeleted = sRoom.isDeleted;
                        lRoom.ts = sRoom.ts;
                        hasChanges = true;
                    }
                } else {
                    globalLogistics.rooms.push(sRoom);
                    hasChanges = true;
                }
            }
        });
        if(hasChanges) renderRooms();
    }
    setRoomSyncButtonState('saved');
    showToast("Refreshed from server!");
} catch (e) {
    setRoomSyncButtonState('error');
}
}

// ==========================================
// UI RENDERERS
// ==========================================
function buildLogisticsUI() {
document.getElementById('tab-logistics').innerHTML = `
<div class="sticky top-0 z-40 flex overflow-x-auto bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 scrollbar-hide shrink-0 rounded-t-xl md:rounded-none px-2 pt-1">
    <button onclick="switchLogisticsSubTab('pairings')" id="subTab-pairings" class="px-3 py-2 font-semibold border-b-2 border-primary text-primary whitespace-nowrap text-xs md:text-sm transition focus:outline-none">1. Pairings</button>
    <button onclick="switchLogisticsSubTab('rooms')" id="subTab-rooms" class="px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none">2. Rooms</button>
    <button onclick="switchLogisticsSubTab('groups')" id="subTab-groups" class="px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none">3. Groups</button>
    <button onclick="switchLogisticsSubTab('buses')" id="subTab-buses" class="px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none">4. Buses</button>
</div>

<div id="log-pairings" class="flex-1 flex flex-col min-h-0 w-full relative">
    <div id="logLoadingOverlay" class="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-20 hidden-force flex flex-col justify-center items-center">
        <div class="loader !w-8 !h-8 border-primary mb-2"></div>
        <span class="text-primary dark:text-green-400 font-bold text-xs tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading...</span>
    </div>
    <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-2 md:p-3 shrink-0 flex flex-col gap-1 shadow-sm sticky top-0 z-30">
        <div class="flex justify-between items-center px-1">
            <div class="flex items-center gap-2">
                <h3 class="text-sm md:text-base font-black text-gray-900 dark:text-white tracking-tight">Pairings</h3>
                <button onclick="toggleAltSwap()" class="bg-gray-100 dark:bg-gray-800 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition focus:outline-none border border-gray-200 dark:border-gray-700 shadow-sm" title="Swap Columns">
                    <svg class="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                </button>
            </div>
            <button onclick="manualSyncPairings(this)" class="btn-sync-pairings text-xs md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
                <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
            </button>
        </div>
        <div class="flex justify-between items-center px-1 gap-2 mt-1 mb-1">
            <div class="relative w-full">
                <input type="text" id="pairingSearchInput" oninput="renderPairings()" placeholder="Search pairings..." class="w-full p-1.5 pl-7 pr-8 border border-gray-300 dark:border-gray-700 rounded text-xs font-bold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition">
                <svg class="w-3.5 h-3.5 absolute left-2 top-2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <button onclick="clearSearch('pairingSearchInput', 'renderPairings')" class="absolute right-1.5 top-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
        </div>
    </div>
    <div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative bg-gray-50 dark:bg-gray-950 border-x border-b border-gray-200 dark:border-gray-700 rounded-b-xl md:rounded-none">
        <div id="dnd-source-col" class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors border-r border-gray-200 dark:border-gray-700">
            <h4 id="dnd-source-title" class="font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b"></h4>
            <div id="dnd-source-pool" class="space-y-1.5 flex-grow overflow-y-auto p-1.5 custom-scrollbar bg-opacity-50 pb-6"></div>
        </div>
        <div id="dnd-target-col" class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors">
            <h4 id="dnd-target-title" class="font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b"></h4>
            <div id="dnd-target-list" class="space-y-1.5 flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6 bg-opacity-50"></div>
        </div>
    </div>
</div>

<div id="log-rooms" class="hidden-force flex-1 flex flex-col min-h-0 w-full relative">
    <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-2 md:p-3 shrink-0 flex flex-col gap-2 shadow-sm sticky top-0 z-30">
        <div class="flex justify-between items-center px-1">
            <div class="flex flex-wrap items-center gap-1 md:gap-1.5">
                <h3 class="text-xs md:text-base font-black text-gray-900 dark:text-white tracking-tight mr-1 shrink-0">Room Assignments</h3>
                <button onclick="resetRoomAssignments()" class="bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 text-[11px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-orange-100 transition focus:outline-none flex items-center gap-0.5 md:gap-1" title="Clear all Assignments">
                    <svg class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    <span class="whitespace-nowrap">Assignment</span>
                </button>
                <button onclick="deleteAllRooms()" class="bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 text-[11px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-red-100 transition focus:outline-none flex items-center gap-0.5 md:gap-1" title="Delete All Rooms">
                    <svg class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    <span class="whitespace-nowrap">Rooms</span>
                </button>
                <button onclick="autoAssignRooms()" class="bg-green-50 text-green-600 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 text-[11px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-green-100 transition focus:outline-none whitespace-nowrap">Auto-Room</button>
                
            </div>
            <button id="btn-sync-rooms" onclick="manualSyncRooms(this)" class="text-xs md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
                <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
            </button>
        </div>
        <div class="flex justify-between items-center px-1 gap-2 mt-1">
            <div class="relative w-full max-w-sm">
                <input type="text" id="roomSearchInput" oninput="renderRooms()" placeholder="Search participants/rooms..." class="w-full p-1.5 pl-7 pr-8 border border-gray-300 dark:border-gray-700 rounded text-xs font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition">
                <svg class="w-3.5 h-3.5 absolute left-2 top-2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <button onclick="clearSearch('roomSearchInput', 'renderRooms')" class="absolute right-1.5 top-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
            <select id="roomFilterSelect" onchange="renderRooms()" class="text-xs font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1.5 outline-none shrink-0">
                <option value="ALL">All Roles</option>
                <option value="TRAINEE">Trainees</option>
                <option value="CAREGIVER">Caregivers</option>
                <option value="VOLUNTEER">Volunteers</option>
            </select>
        </div>
    </div>
    <div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative bg-gray-50 dark:bg-gray-950 rounded-b-xl md:rounded-none">
        <div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-900/50">
            <h4 class="font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest bg-gray-200/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Unassigned (<span id="unassignedCount">0</span>)</h4>
            <div id="roomUnassignedPool" class="space-y-1.5 flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6"></div>
        </div>
        <div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors bg-white dark:bg-gray-950">
            <div class="flex items-center justify-between px-2 py-1.5 shrink-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Assigned Rooms</span>
                <button onclick="openManageRoomsSheet()" class="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-primary hover:border-primary transition focus:outline-none"><i class="fa-solid fa-cog mr-1"></i>Manage</button>
            </div>
            <div id="roomListContainer" class="flex-grow overflow-y-auto p-1.5 md:p-2 custom-scrollbar flex flex-col gap-2 md:gap-3 pb-6"></div>
        </div>
    </div>
</div>

<div id="log-groups" class="hidden-force flex-1 flex flex-col min-h-0 w-full relative">
    <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-2 md:p-3 shrink-0 flex flex-col gap-2 shadow-sm sticky top-0 z-30">
        <div class="flex justify-between items-center px-1">
            <div class="flex flex-wrap items-center gap-1 md:gap-1.5">
                <h3 class="text-xs md:text-base font-black text-gray-900 dark:text-white tracking-tight mr-1 shrink-0">Groups</h3>
                <button onclick="autoGroup()" class="bg-green-50 text-green-600 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 text-[11px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-green-100 transition focus:outline-none flex items-center gap-0.5 md:gap-1" title="Auto Group">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    <span class="whitespace-nowrap">Auto Group</span>
                </button>
                <button onclick="resetGroupAssignments()" class="bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 text-[11px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-orange-100 transition focus:outline-none flex items-center gap-0.5 md:gap-1" title="Clear all Assignments">
                    <svg class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    <span class="whitespace-nowrap">Clear</span>
                </button>
            </div>
            <button onclick="manualSyncGroups()" class="btn-sync-groups text-xs md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
                <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
            </button>
        </div>
        <div class="relative w-full flex items-center gap-2">
            <div class="relative flex-1">
                <input type="text" id="groupSearchInput" oninput="renderGroups()" placeholder="Search..." class="w-full p-1.5 pl-7 pr-8 border border-gray-300 dark:border-gray-700 rounded text-xs font-bold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition">
                <i class="fa-solid fa-search absolute left-2.5 top-2 text-gray-400 text-xs"></i>
                <button onclick="clearSearch('groupSearchInput', 'renderGroups')" class="absolute right-1.5 top-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
        </div>
    </div>
    <div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative">
        <div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h4 class="font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50">Unassigned (<span id="groupUnassignedCount">0</span>)</h4>
            <div id="groupUnassignedPool" class="dnd-group-dropzone space-y-1.5 flex-grow overflow-y-auto p-1.5 md:p-2 custom-scrollbar pb-6"></div>
        </div>
        <div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors bg-white dark:bg-gray-950">
            <div class="flex items-center justify-between px-2 py-1.5 shrink-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Assigned Groups</span>
                <button onclick="openManageGroupsSheet()" class="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-primary hover:border-primary transition focus:outline-none"><i class="fa-solid fa-cog mr-1"></i>Manage</button>
            </div>
            <div id="groupListContainer" class="flex-grow overflow-y-auto p-1.5 md:p-2 custom-scrollbar flex flex-col gap-2 md:gap-3 pb-6"></div>
        </div>
    </div>
</div>
<div id="log-buses" class="hidden-force flex-1 flex flex-col min-h-0 w-full relative">
    <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-2 md:p-3 shrink-0 flex flex-col gap-2 shadow-sm sticky top-0 z-30">
        <div class="flex justify-between items-center px-1">
            <div class="flex flex-wrap items-center gap-1 md:gap-1.5">
                <h3 class="text-xs md:text-base font-black text-gray-900 dark:text-white tracking-tight mr-1 shrink-0">Buses</h3>
                <button onclick="autoBus()" class="bg-green-50 text-green-600 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 text-[11px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-green-100 transition focus:outline-none flex items-center gap-0.5 md:gap-1" title="Auto Bus">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                    <span class="whitespace-nowrap">Auto Bus</span>
                </button>
                <button onclick="resetBusAssignments()" class="bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 text-[11px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-orange-100 transition focus:outline-none flex items-center gap-0.5 md:gap-1" title="Clear all Assignments">
                    <svg class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    <span class="whitespace-nowrap">Clear</span>
                </button>
            </div>
            <button onclick="manualSyncBuses()" class="btn-sync-buses text-xs md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
                <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
            </button>
        </div>
        <div class="relative w-full flex items-center gap-2">
            <div class="relative flex-1">
                <input type="text" id="busSearchInput" oninput="renderBuses()" placeholder="Search..." class="w-full p-1.5 pl-7 pr-8 border border-gray-300 dark:border-gray-700 rounded text-xs font-bold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition">
                <i class="fa-solid fa-search absolute left-2.5 top-2 text-gray-400 text-xs"></i>
                <button onclick="clearSearch('busSearchInput', 'renderBuses')" class="absolute right-1.5 top-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
        </div>
    </div>
    <div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative">
        <div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h4 class="font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50">Unassigned (<span id="busUnassignedCount">0</span>)</h4>
            <div id="busUnassignedPool" class="dnd-bus-dropzone space-y-1.5 flex-grow overflow-y-auto p-1.5 md:p-2 custom-scrollbar pb-6"></div>
        </div>
        <div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors bg-white dark:bg-gray-950">
            <div class="flex items-center justify-between px-2 py-1.5 shrink-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Assigned Buses</span>
                <button onclick="openManageBusesSheet()" class="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-primary hover:border-primary transition focus:outline-none"><i class="fa-solid fa-cog mr-1"></i>Manage</button>
            </div>
            <div id="busListContainer" class="flex-grow overflow-y-auto p-1.5 md:p-2 custom-scrollbar flex flex-col gap-2 md:gap-3 pb-6"></div>
        </div>
    </div>
</div>
`;
}


let pendingGroupUpdates = new Map();
let pendingBusUpdates = new Map();
let isGroupSyncing = false;
let isBusSyncing = false;
let activeGroupsList = JSON.parse(localStorage.getItem('activeGroupsList')) || [];
let activeBusesList = JSON.parse(localStorage.getItem('activeBusesList')) || [];

function renderGroups() {
    if(!globalLogistics || !document.getElementById('groupListContainer')) return;
    const query = document.getElementById('groupSearchInput') ? document.getElementById('groupSearchInput').value.toLowerCase().trim() : '';
    
    let unassigned = [];
    let groupMap = {};
    activeGroupsList.forEach(g => groupMap[g] = []);

    globalLogistics.participants.forEach(p => {
        let pGroup = String(p.logisticsGroup || "").trim();
        if (pGroup && !activeGroupsList.includes(pGroup)) {
            activeGroupsList.push(pGroup);
            groupMap[pGroup] = [];
        }
        
        let match = false;
        if (query) {
            const dName = (p.displayName || p.name).toLowerCase();
            const fullName = (p.name || '').toLowerCase();
            match = dName.includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || pGroup.toLowerCase().includes(query);
        } else {
            match = true;
        }
        
        if (!match) return;

        if (pGroup) {
            groupMap[pGroup].push(p);
        } else {
            unassigned.push(p);
        }
    });

    document.getElementById('groupUnassignedCount').innerText = unassigned.length;
if (window.sortParticipantsSpecial) window.sortParticipantsSpecial(unassigned, globalLogistics.participants);
let unHtml = '';
    unassigned.forEach(item => {
        unHtml += generateGroupCardHtml(item);
    });
    document.getElementById('groupUnassignedPool').innerHTML = unHtml || '<p class="text-xs text-gray-500 font-bold p-2 text-center mt-2">All assigned / No matches.</p>';

    let grpHtml = '';
    activeGroupsList.forEach(gName => {
        let occHtml = '';
        groupMap[gName].forEach(item => {
            occHtml += generateGroupCardHtml(item);
        });

        grpHtml += `
        <div class="dnd-group-dropzone bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 shadow-sm transition-colors" data-group="${gName}">
            <div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-1.5 mb-1.5">
                <div class="flex items-center gap-2">
                    <span class="font-black text-sm md:text-sm text-gray-900 dark:text-white leading-tight">Group ${gName}</span>
                    <button onclick="removeGroupList('${gName}')" class="text-red-500 hover:text-red-600 focus:outline-none"><i class="fa-solid fa-trash text-sm"></i></button>
                </div>
                <span class="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shadow-inner">${groupMap[gName].length} Pax</span>
            </div>
            <div class="flex flex-col gap-1 min-h-[40px] relative pointer-events-auto z-10 w-full rounded border border-transparent transition-all">
                ${occHtml || '<span class="text-xs font-medium text-gray-400 dark:text-gray-500 m-1 pointer-events-none text-center py-2 w-full">Drop here...</span>'}
            </div>
        </div>
        `;
    });
    document.getElementById('groupListContainer').innerHTML = grpHtml;
}

function generateGroupCardHtml(item) {
    const dynColor = getProjectColor(item.group);
    const dName = item.displayName || item.name;
    const roleColor = item.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (item.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
    const roleShort = item.role.substring(0,3).toUpperCase();
    return `
    <div class="dnd-group-draggable bg-white dark:bg-gray-800 p-1 md:p-1.5 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col gap-1" data-nric="${item.nric}" onclick="openGroupAssignSheet('${item.nric}')">
        <div class="main-name-pill font-extrabold text-xs md:text-sm px-1.5 py-1 rounded shadow-sm border ${dynColor} w-full flex items-start justify-between gap-1">
            <span class="break-words whitespace-normal text-left flex-1">${dName}</span>
        </div>
        <span class="text-[10px] md:text-[10px] font-black ${roleColor} bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded uppercase border border-gray-100 dark:border-gray-600 shrink-0 self-start w-max">${roleShort}</span>
    </div>
    `;
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
    document.getElementById('busUnassignedPool').innerHTML = unHtml || '<p class="text-xs text-gray-500 font-bold p-2 text-center mt-2">All assigned / No matches.</p>';

    let busHtml = '';
    activeBusesList.forEach(bName => {
        let occHtml = '';
        busMap[bName].forEach(item => {
            occHtml += generateBusCardHtml(item);
        });

        busHtml += `
        <div class="dnd-bus-dropzone bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 shadow-sm transition-colors" data-bus="${bName}">
            <div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-1.5 mb-1.5">
                <div class="flex items-center gap-2">
                    <span class="font-black text-sm md:text-sm text-gray-900 dark:text-white leading-tight">Bus ${bName}</span>
                    <button onclick="removeBusList('${bName}')" class="text-red-500 hover:text-red-600 focus:outline-none"><i class="fa-solid fa-trash text-sm"></i></button>
                </div>
                <span class="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shadow-inner">${busMap[bName].length} Pax</span>
            </div>
            <div class="flex flex-col gap-1 min-h-[40px] relative pointer-events-auto z-10 w-full rounded border border-transparent transition-all">
                ${occHtml || '<span class="text-xs font-medium text-gray-400 dark:text-gray-500 m-1 pointer-events-none text-center py-2 w-full">Drop here...</span>'}
            </div>
        </div>
        `;
    });
    document.getElementById('busListContainer').innerHTML = busHtml;
}

function generateBusCardHtml(item) {
    const dynColor = getProjectColor(item.group);
    const dName = item.displayName || item.name;
    const roleColor = item.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (item.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
    const roleShort = item.role.substring(0,3).toUpperCase();
    return `
    <div class="dnd-bus-draggable bg-white dark:bg-gray-800 p-1 md:p-1.5 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col gap-1" data-nric="${item.nric}" onclick="openBusAssignSheet('${item.nric}')">
        <div class="main-name-pill font-extrabold text-xs md:text-sm px-1.5 py-1 rounded shadow-sm border ${dynColor} w-full flex items-start justify-between gap-1">
            <span class="break-words whitespace-normal text-left flex-1">${dName}</span>
        </div>
        <span class="text-[10px] md:text-[10px] font-black ${roleColor} bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded uppercase border border-gray-100 dark:border-gray-600 shrink-0 self-start w-max">${roleShort}</span>
    </div>
    `;
}

function handleGroupDrop(nric, groupName) {
    const p = globalLogistics.participants.find(x => x.nric === nric);
    if (!p) return;
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

function handleBusDrop(nric, busName) {
    const p = globalLogistics.participants.find(x => x.nric === nric);
    if (!p) return;
    p.bus = busName;
    pendingBusUpdates.set(nric, { nric: nric, value: busName });

    // Handle pairing logic (auto bus paired vols / caregivers)
    let connected = getConnectedParticipants(nric);
    connected.forEach(cNric => {
        let cp = globalLogistics.participants.find(x => x.nric === cNric);
        if (cp && cp.bus !== busName) {
            cp.bus = busName;
            pendingBusUpdates.set(cNric, { nric: cNric, value: busName });
        }
    });

    renderBuses();
    triggerBusSync();
}

function getConnectedParticipants(startNric) {
    const connected = new Set([startNric]);
    const queue = [startNric];
    const activePairings = (globalLogistics.pairings || []).filter(p => (!p.status || p.status === 'ACTIVE'));
    
    while(queue.length > 0) {
        const current = queue.shift();
        const p = globalLogistics.participants.find(x => x.nric === current);
        if (!p) continue;
        
        let pTarget = p.pocNric;
        globalLogistics.participants.forEach(x => {
            if (x.pocNric === pTarget && !connected.has(x.nric)) {
                connected.add(x.nric);
                queue.push(x.nric);
            }
        });

        // Auto link pairings
        activePairings.forEach(pair => {
            if (pair.traineeNric === current && !connected.has(pair.volNric)) {
                connected.add(pair.volNric);
                queue.push(pair.volNric);
            }
            if (pair.volNric === current && !connected.has(pair.traineeNric)) {
                connected.add(pair.traineeNric);
                queue.push(pair.traineeNric);
            }
        });
    }
    return Array.from(connected);
}

function autoGroup() {
    if (activeGroupsList.length === 0) return showToast("Please add at least one group first.");
    let unassigned = globalLogistics.participants.filter(p => !p.logisticsGroup);
    if (unassigned.length === 0) return;
    
    // Basic greedy grouping for demonstration
    let groupIdx = 0;
    unassigned.forEach(p => {
        if (!p.logisticsGroup) {
            let connected = getConnectedParticipants(p.nric);
            let targetGroup = activeGroupsList[groupIdx % activeGroupsList.length];
            connected.forEach(cNric => {
                let cp = globalLogistics.participants.find(x => x.nric === cNric);
                if (cp && !cp.logisticsGroup) {
                    cp.logisticsGroup = targetGroup;
                    pendingGroupUpdates.set(cNric, { nric: cNric, value: targetGroup });
                }
            });
            groupIdx++;
        }
    });
    renderGroups();
    triggerGroupSync();
}

function autoBus() {
    if (activeBusesList.length === 0) return showToast("Please add at least one bus first.");
    let unassigned = globalLogistics.participants.filter(p => !p.bus);
    if (unassigned.length === 0) return;
    
    // Auto bus assigns by groups first, then connected
    let busIdx = 0;
    unassigned.forEach(p => {
        if (!p.bus) {
            let connected = getConnectedParticipants(p.nric);
            // Additionally pull in people from the same group
            if (p.logisticsGroup) {
                globalLogistics.participants.forEach(x => {
                    if (x.logisticsGroup === p.logisticsGroup && !connected.includes(x.nric)) {
                        connected.push(x.nric);
                    }
                });
            }
            let targetBus = activeBusesList[busIdx % activeBusesList.length];
            connected.forEach(cNric => {
                let cp = globalLogistics.participants.find(x => x.nric === cNric);
                if (cp && !cp.bus) {
                    cp.bus = targetBus;
                    pendingBusUpdates.set(cNric, { nric: cNric, value: targetBus });
                }
            });
            busIdx++;
        }
    });
    renderBuses();
    triggerBusSync();
}

function resetGroupAssignments() {
    if (!confirm("Clear all group assignments?")) return;
    globalLogistics.participants.forEach(p => {
        if (p.logisticsGroup) {
            p.logisticsGroup = "";
            pendingGroupUpdates.set(p.nric, { nric: p.nric, value: "" });
        }
    });
    renderGroups();
    triggerGroupSync();
}

function resetBusAssignments() {
    if (!confirm("Clear all bus assignments?")) return;
    globalLogistics.participants.forEach(p => {
        if (p.bus) {
            p.bus = "";
            pendingBusUpdates.set(p.nric, { nric: p.nric, value: "" });
        }
    });
    renderBuses();
    triggerBusSync();
}

async function manualSyncGroups() {
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
}
async function manualSyncBuses() {
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
}

let groupSyncTimeout = null;
function triggerGroupSync() {
    if (groupSyncTimeout) clearTimeout(groupSyncTimeout);
    groupSyncTimeout = setTimeout(executeGroupSync, 2500);
}

let busSyncTimeout = null;
function triggerBusSync() {
    if (busSyncTimeout) clearTimeout(busSyncTimeout);
    busSyncTimeout = setTimeout(executeBusSync, 2500);
}

async function executeGroupSync() {
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
}

async function executeBusSync() {
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
}

function switchLogisticsSubTab(tabId) {
['pairings', 'rooms', 'groups', 'buses'].forEach(id => { 
    const el = document.getElementById(`log-${id}`);
    if(el) el.classList.add('hidden-force'); 
    const btn = document.getElementById(`subTab-${id}`); 
    if(btn) { btn.classList.remove('border-primary', 'text-primary'); btn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400'); } 
}); 
const targetEl = document.getElementById(`log-${tabId}`);
if(targetEl) targetEl.classList.remove('hidden-force'); 
const targetBtn = document.getElementById(`subTab-${tabId}`); 
if(targetBtn) { targetBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400'); targetBtn.classList.add('border-primary', 'text-primary'); } 
}

async function loadLogisticsData() { 
const overlay = document.getElementById('logLoadingOverlay');
if (overlay) overlay.classList.remove('hidden-force');
setSyncButtonState('loading');
setRoomSyncButtonState('loading');

try { 
    const res = await apiCall('fetchLogistics'); 
    globalLogistics = res; 
    if(!globalLogistics.rooms) globalLogistics.rooms = [];

    if (typeof processDisplayNames === "function") {
        processDisplayNames(globalLogistics.participants);
    }
    if (typeof applyGlobalSorting === "function") {
        globalLogistics.participants = applyGlobalSorting(globalLogistics.participants);
    }
    renderPairings();
    renderRooms();
    renderGroups();
    renderBuses();

    setSyncButtonState('saved');
    setRoomSyncButtonState('saved');
    startPairingPolling();
    startRoomPolling();
} catch(e) { 
    showToast("Failed to load logistics.", true); 
    setSyncButtonState('error');
    setRoomSyncButtonState('error');
} finally {
    if (overlay) overlay.classList.add('hidden-force');
}
}

function toggleAltSwap() { altSwapMode = !altSwapMode; renderPairings(); }

function generatePillHtml(targetName, targetColorClass, traineeNric, volNric) {
return `<div class="relative flex w-full align-top pointer-events-auto">
<div class="${targetColorClass} text-xs md:text-sm pl-2 pr-6 py-1 rounded shadow-sm border border-gray-300 dark:border-gray-600 font-bold opacity-90 leading-tight break-words whitespace-normal text-left w-full">
${targetName}
</div>
<div class="remove-x" onclick="unpairTrainee('${traineeNric}', '${volNric}')">×</div>
</div>`;
}

function generateCardHtml(item, traineesWithCaregivers, activePairings, vols, trainees) {
const dynColor = getProjectColor(item.group);

const isFam = item.role === 'TRAINEE' && traineesWithCaregivers.has(String(item.name).trim().toLowerCase());
const famBadge = isFam ? `<span class="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-[10px] uppercase font-black tracking-wider px-1 py-0.5 rounded shrink-0 shadow-sm border border-purple-200 dark:border-purple-700 pointer-events-none whitespace-nowrap">FAM</span>` : '';

const myPairings = item.role === 'TRAINEE' ? activePairings.filter(p => p.traineeNric === item.nric) : activePairings.filter(p => p.volNric === item.nric);

let pairedPills = '';
myPairings.forEach(pair => {
    const pairedPerson = item.role === 'TRAINEE' ? vols.find(v => v.nric === pair.volNric) : trainees.find(t => t.nric === pair.traineeNric);
    if(pairedPerson) {
        const pColor = getProjectColor(pairedPerson.group);
        pairedPills += generatePillHtml(pairedPerson.displayName || pairedPerson.name, pColor, pair.traineeNric, pair.volNric);
    }
});

const btnLabel = item.role === 'TRAINEE' ? '+ Vol' : '+ Trn';
const displayName = item.displayName || item.name;

return `
<div class="dnd-draggable dnd-dropzone bg-white dark:bg-gray-800 p-1.5 md:p-2 rounded-md border border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col min-h-[60px] gap-1" data-nric="${item.nric}" data-role="${item.role}">
    <div class="flex justify-between items-start w-full gap-1">
        <div class="main-name-pill font-extrabold text-sm md:text-[12px] px-1.5 py-0.5 rounded shadow-sm border ${dynColor} max-w-full inline-flex flex-wrap items-center gap-1 self-start min-w-0 leading-[1.1]">
            <span class="break-words whitespace-normal min-w-0 text-left">${displayName}</span>
            ${famBadge}
        </div>
        <button onclick="openPairingSheet('${item.nric}', '${item.role}')" class="text-[11px] md:text-xs bg-green-50 dark:bg-gray-700 text-green-600 dark:text-green-400 font-bold px-1.5 py-1 rounded border border-green-200 dark:border-gray-600 hover:bg-green-100 transition whitespace-nowrap focus:outline-none shrink-0 pointer-events-auto shadow-sm">${btnLabel}</button>
    </div>
    <div class="flex flex-col pointer-events-auto bg-gray-50/50 dark:bg-gray-900/50 p-1.5 rounded min-h-[36px] border border-dashed border-gray-200 dark:border-gray-700 mt-1 w-full gap-1.5">
        ${pairedPills || '<span class="text-[11px] md:text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5 pointer-events-none text-center w-full py-1">Drop pair here</span>'}
    </div>
</div>
`;
}

function renderPairings() {
if(!globalLogistics || !document.getElementById('dnd-source-pool')) return;
const trainees = globalLogistics.participants.filter(p => p.role === 'TRAINEE');
const vols = globalLogistics.participants.filter(p => p.role === 'VOLUNTEER');
const activePairings = (globalLogistics.pairings || []).filter(p => (!p.status || p.status === 'ACTIVE'));

const traineesWithCaregivers = new Set();
globalLogistics.participants.forEach(p => {
    if (p.role === 'CAREGIVER' && p.relatedTrainee) {
        const rNames = p.relatedTrainee.split(',').map(n => n.trim().toLowerCase());
        rNames.forEach(n => traineesWithCaregivers.add(n));
    }
});

const isSourceVol = !altSwapMode;
let sourceArr = isSourceVol ? vols : trainees;
let targetArr = isSourceVol ? trainees : vols;

if (hidePairedVols) {
    const pairedVolNrics = new Set(activePairings.map(p => p.volNric));
    if (isSourceVol) sourceArr = sourceArr.filter(p => !pairedVolNrics.has(p.nric));
    else targetArr = targetArr.filter(p => !pairedVolNrics.has(p.nric));
}
if (hidePairedTrainees) {
    const pairedTraineeNrics = new Set(activePairings.map(p => p.traineeNric));
    if (!isSourceVol) sourceArr = sourceArr.filter(p => !pairedTraineeNrics.has(p.nric));
    else targetArr = targetArr.filter(p => !pairedTraineeNrics.has(p.nric));
}

const query = document.getElementById('pairingSearchInput') ? document.getElementById('pairingSearchInput').value.toLowerCase().trim() : '';
if (query) {
    const matchFn = (p) => {
        const dName = (p.displayName || p.name).toLowerCase();
        const fullName = (p.name || '').toLowerCase();
        return dName.includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || p.group.toLowerCase().includes(query);
    };
    sourceArr = sourceArr.filter(matchFn);
    targetArr = targetArr.filter(matchFn);
}

const volColClass = "bg-orange-50/30 dark:bg-orange-900/10";
const traineeColClass = "bg-green-50/30 dark:bg-green-900/10";
const sourceColClass = isSourceVol ? volColClass : traineeColClass;
const targetColClass = isSourceVol ? traineeColClass : volColClass;

const volTitleClass = "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 border-b border-orange-200 dark:border-orange-800";
const traineeTitleClass = "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 border-b border-green-200 dark:border-green-800";

const sourceCol = document.getElementById('dnd-source-col');
const targetCol = document.getElementById('dnd-target-col');
sourceCol.className = `flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors border-r border-gray-200 dark:border-gray-700 ${sourceColClass}`;
targetCol.className = `flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors ${targetColClass}`;

const sourceTitle = document.getElementById('dnd-source-title');
const targetTitle = document.getElementById('dnd-target-title');
const volLabel = `<div class="flex items-center justify-between px-2 w-full"><span class="w-16"></span><span class="flex-1 text-center">Volunteers</span><label class="flex items-center gap-1 cursor-pointer w-16 justify-end" onclick="event.stopPropagation()"><input type="checkbox" ${hidePairedVols ? 'checked' : ''} onchange="toggleHidePaired('VOLUNTEER', this)" class="w-3 h-3 text-orange-600 focus:ring-orange-500 rounded-sm cursor-pointer border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800"><span class="text-[9px] font-bold tracking-normal normal-case opacity-80 mt-[1px]">Unpaired</span></label></div>`;
const traineeLabel = `<div class="flex items-center justify-between px-2 w-full"><span class="w-16"></span><span class="flex-1 text-center">Trainees</span><label class="flex items-center gap-1 cursor-pointer w-16 justify-end" onclick="event.stopPropagation()"><input type="checkbox" ${hidePairedTrainees ? 'checked' : ''} onchange="toggleHidePaired('TRAINEE', this)" class="w-3 h-3 text-green-600 focus:ring-green-500 rounded-sm cursor-pointer border-green-300 dark:border-green-700 bg-white dark:bg-gray-800"><span class="text-[9px] font-bold tracking-normal normal-case opacity-80 mt-[1px]">Unpaired</span></label></div>`;

sourceTitle.innerHTML = isSourceVol ? volLabel : traineeLabel;
targetTitle.innerHTML = isSourceVol ? traineeLabel : volLabel;
sourceTitle.className = `font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b ${isSourceVol ? volTitleClass : traineeTitleClass}`;
targetTitle.className = `font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b ${!isSourceVol ? volTitleClass : traineeTitleClass}`;

let sourceHtml = '';
sourceArr.forEach(item => { sourceHtml += generateCardHtml(item, traineesWithCaregivers, activePairings, vols, trainees); });
document.getElementById('dnd-source-pool').innerHTML = sourceHtml || '<p class="text-xs text-gray-500 font-bold p-2 text-center mt-2">No items.</p>';

let targetHtml = '';
targetArr.forEach(item => { targetHtml += generateCardHtml(item, traineesWithCaregivers, activePairings, vols, trainees); });
document.getElementById('dnd-target-list').innerHTML = targetHtml || '<p class="text-xs text-gray-500 font-bold p-2 text-center mt-2">No items.</p>';
}

function renderRooms() {
if(!globalLogistics || !document.getElementById('roomListContainer')) return;

const rFilter = document.getElementById('roomFilterSelect') ? document.getElementById('roomFilterSelect').value : 'ALL';
const query = document.getElementById('roomSearchInput') ? document.getElementById('roomSearchInput').value.toLowerCase().trim() : '';

const allNricsInRooms = new Set();
const activeRooms = (globalLogistics.rooms || []).filter(r => !r.isDeleted);
activeRooms.forEach(r => r.occupants.forEach(n => allNricsInRooms.add(n)));

const unassignedArr = globalLogistics.participants.filter(p => !allNricsInRooms.has(p.nric) && (rFilter === 'ALL' || p.role === rFilter));

let filteredUnassigned = unassignedArr;
if (query) {
    filteredUnassigned = unassignedArr.filter(p => {
        const dName = (p.displayName || p.name).toLowerCase();
        const fullName = (p.name || '').toLowerCase();
        return dName.includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || p.group.toLowerCase().includes(query);
    });
}

document.getElementById('unassignedCount').innerText = filteredUnassigned.length;
if (window.sortParticipantsSpecial) window.sortParticipantsSpecial(filteredUnassigned, globalLogistics.participants);
let unHtml = '';
filteredUnassigned.forEach(item => {
    const dynColor = getProjectColor(item.group);
    const dName = item.displayName || item.name;
    const roleColor = item.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (item.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
    const roleShort = item.role.substring(0,3).toUpperCase();

    const sleepingTooltip = item.sleeping ? `Request: ${item.sleeping.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}` : '';
    const sleepingIndicator = item.sleeping ? `<button onclick="openSleepingModal('${item.nric}')" class="ml-1 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 pointer-events-auto transition-transform hover:scale-110 focus:outline-none shrink-0" title="${sleepingTooltip}"><svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg></button>` : '';

    unHtml += `
    <div class="dnd-room-draggable bg-white dark:bg-gray-800 p-1 md:p-1.5 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col gap-1" data-nric="${item.nric}" data-role="${item.role}">
        <div class="main-name-pill font-extrabold text-xs md:text-sm px-1.5 py-1 rounded shadow-sm border ${dynColor} w-full flex items-start justify-between gap-1">
            <span class="break-words whitespace-normal text-left flex-1">${dName}</span>
            ${sleepingIndicator}
        </div>
        <span class="text-[10px] md:text-[10px] font-black ${roleColor} bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded uppercase border border-gray-100 dark:border-gray-600 shrink-0 self-start w-max">${roleShort}</span>
    </div>
    `;
});
document.getElementById('roomUnassignedPool').innerHTML = unHtml || '<p class="text-xs text-gray-500 font-bold p-2 text-center mt-2">All assigned / No matches.</p>';

let roomsToRender = activeRooms;
if (query) {
    roomsToRender = activeRooms.filter(r => {
        if (r.name.toLowerCase().includes(query)) return true;
        return r.occupants.some(nric => {
            const p = globalLogistics.participants.find(x => x.nric === nric);
            if (!p) return false;
            const dName = (p.displayName || p.name).toLowerCase();
            const fullName = (p.name || '').toLowerCase();
            return dName.includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || p.group.toLowerCase().includes(query);
        });
    });
}

let roomHtml = '';
roomsToRender.forEach(room => {
    const occCount = room.occupants.length;
    const isFull = occCount >= room.capacity;

    let occHtml = '';
    room.occupants.forEach(nric => {
        const p = globalLogistics.participants.find(x => x.nric === nric);
        if(p) {
            const dName = p.displayName || p.name;
            const dynColor = getProjectColor(p.group);
            let isMatch = false;
            if (query) {
                const fullName = (p.name || '').toLowerCase();
                isMatch = dName.toLowerCase().includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || p.group.toLowerCase().includes(query);
            }
            const matchClass = isMatch ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-gray-800 scale-105 z-10' : '';
            
            const pSleepingTooltip = p.sleeping ? `Request: ${p.sleeping.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}` : '';
            const sleepingIndicator = p.sleeping ? `<button onclick="openSleepingModal('${p.nric}')" class="ml-1 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 pointer-events-auto transition-transform hover:scale-110 focus:outline-none shrink-0" title="${pSleepingTooltip}"><svg class="w-3 h-3 md:w-3.5 md:h-3.5 inline-block" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg></button>` : '';
            
            occHtml += `
            <div class="dnd-room-draggable relative flex w-full cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform pointer-events-auto" data-nric="${p.nric}">
                <div class="main-name-pill ${dynColor} ${matchClass} text-xs md:text-sm px-2 py-1.5 rounded shadow-sm border font-bold opacity-90 leading-tight flex items-start justify-between w-full pr-5 gap-1">
                    <span class="break-words whitespace-normal text-left flex-1">${dName}</span>
                    ${sleepingIndicator}
                </div>
                <div class="remove-x" onclick="unassignFromRoom('${p.nric}', '${room.id}')">×</div>
            </div>`;
        }
    });

    const occDisplay = isFull ? `<span class="text-green-600 dark:text-green-400 font-black tracking-widest">${occCount}/${room.capacity} (FULL)</span>` : `<span class="text-gray-500 dark:text-gray-400 font-bold tracking-widest">${occCount}/${room.capacity}</span>`;

    roomHtml += `
    <div class="dnd-room-dropzone flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors" data-room-id="${room.id}">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-gray-50/80 dark:bg-gray-900/50 p-2 border-b border-gray-100 dark:border-gray-700 rounded-t-xl shrink-0 gap-2 w-full">
            <div class="flex items-start justify-between w-full lg:w-auto gap-2 flex-1">
                <span class="font-black text-[12px] md:text-sm text-gray-900 dark:text-white break-words whitespace-normal leading-tight">${room.name}</span>
                <span class="text-[11px] bg-gray-200/50 dark:bg-gray-700/50 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 shrink-0 mt-0.5">${occDisplay}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0 w-full lg:w-auto justify-end">
                <button onclick="openRoomAddSheet('${room.id}')" class="text-[11px] bg-green-50 text-green-600 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 font-bold px-1.5 py-0.5 rounded hover:bg-green-100 transition focus:outline-none" ${isFull ? 'disabled style="opacity:0.5;"' : ''}>+ Add</button>
                <button onclick="promptEditRoom('${room.id}')" class="text-gray-400 hover:text-primary transition p-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                <button onclick="deleteRoom('${room.id}')" class="text-red-500 hover:text-red-600 transition p-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
        </div>
        <div class="p-1.5 min-h-[40px] flex flex-col pointer-events-auto bg-transparent gap-1.5 w-full">
            ${occHtml || '<span class="text-xs font-medium text-gray-400 dark:text-gray-500 m-1 pointer-events-none text-center py-2 w-full">Drop here...</span>'}
        </div>
    </div>
    `;
});

document.getElementById('roomListContainer').innerHTML = roomHtml || '<div class="flex justify-center items-center h-20 text-xs font-bold text-gray-400">No rooms match criteria.</div>';
}

function openSleepingModal(nric) {
if (!globalLogistics) return;
const p = globalLogistics.participants.find(x => x.nric === nric);
if (!p || !p.sleeping) return;

const modalTitle = document.getElementById('sleepingModalTitle');
const modalContent = document.getElementById('sleepingModalContent');

if (modalTitle) modalTitle.textContent = `Request: ${p.displayName || p.name}`;
if (modalContent) modalContent.textContent = p.sleeping;

const modal = document.getElementById('sleepingInfoModal');
if (modal) modal.classList.remove('hidden-force');
}

function closeSleepingModal() {
const modal = document.getElementById('sleepingInfoModal');
if (modal) modal.classList.add('hidden-force');
}

// ==========================================
// BOTTOM SHEET (REUSABLE)
// ==========================================
function openPairingSheet(sourceNric, sourceRole = 'TRAINEE') {
currentPairingTarget = sourceNric; 
currentPairingSourceRole = sourceRole;
dndState.type = 'pairing';

const sourcePerson = globalLogistics.participants.find(p => p.nric === sourceNric);
let titleHtml = sourceRole === 'TRAINEE' ? "Select Volunteer" : "Select Trainee";

if (sourcePerson) {
    const dynColor = getProjectColor(sourcePerson.group);
    const dName = sourcePerson.displayName || sourcePerson.name;
    titleHtml = `Pair with <span class="ml-1 font-bold text-sm md:text-xs px-1.5 py-0.5 rounded shadow-sm border ${dynColor}">${dName}</span>`;
}

document.getElementById('sheetTitle').innerHTML = titleHtml;
const searchInput = document.getElementById('sheetSearchInput');
if(searchInput) searchInput.value = '';
document.getElementById('selectionBottomSheet').classList.remove('hidden-force');

const targetRole = sourceRole === 'TRAINEE' ? 'VOLUNTEER' : 'TRAINEE';
const targets = globalLogistics.participants.filter(p => p.role === targetRole);
const activePairings = (globalLogistics.pairings || []).filter(p => (!p.status || p.status === 'ACTIVE'));
let html = '';

targets.forEach(t => {
    const isPaired = sourceRole === 'TRAINEE' 
        ? activePairings.some(p => p.volNric === t.nric && p.traineeNric === sourceNric)
        : activePairings.some(p => p.traineeNric === t.nric && p.volNric === sourceNric);

    if(isPaired) return; 

    const tDynColor = getProjectColor(t.group);
    const roleLabel = t.role === 'VOLUNTEER' ? 'Volunteer' : 'Trainee';
    const roleColor = t.role === 'VOLUNTEER' ? 'text-orange-700 bg-orange-100 dark:bg-orange-900/50 border-orange-200 dark:border-orange-800' : 'text-green-700 bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800';
    const dName = t.displayName || t.name;
    const fullName = (t.name || '').toLowerCase();

    html += `<div onclick="confirmPairing('${t.nric}')" class="sheet-list-item flex flex-col bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-pointer hover:border-primary transition mb-1.5" data-name="${dName.toLowerCase()}" data-fullname="${fullName}">
    <div class="flex justify-between items-start w-full gap-2">
        <span class="font-extrabold text-sm md:text-xs px-1.5 py-0.5 rounded shadow-sm border ${tDynColor} break-words whitespace-normal min-w-0 flex-1 text-left leading-[1.1]">${dName}</span>
        <span class="text-[11px] font-black ${roleColor} border px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap uppercase tracking-wider">${roleLabel}</span>
    </div>
    </div>`;
});
document.getElementById('sheetListContainer').innerHTML = html || `<p class="text-xs font-bold text-gray-400 p-2 text-center mt-2">No available options.</p>`;
}

function openRoomAddSheet(roomId) {
activeRoomTargetId = roomId;
dndState.type = 'rooming';

const room = globalLogistics.rooms.find(r => r.id === roomId);
document.getElementById('sheetTitle').innerHTML = `Add to <span class="ml-1 font-black text-primary">${room.name}</span>`;
const searchInput = document.getElementById('sheetSearchInput');
if(searchInput) searchInput.value = '';
document.getElementById('selectionBottomSheet').classList.remove('hidden-force');

const allNricsInRooms = new Set();
const activeRooms = (globalLogistics.rooms || []).filter(r => !r.isDeleted);
activeRooms.forEach(r => r.occupants.forEach(n => allNricsInRooms.add(n)));

const unassignedArr = globalLogistics.participants.filter(p => !allNricsInRooms.has(p.nric));
let html = '';

unassignedArr.forEach(t => {
    const tDynColor = getProjectColor(t.group);
    const roleColor = t.role === 'TRAINEE' ? 'text-green-700 bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800' : (t.role === 'CAREGIVER' ? 'text-purple-700 bg-purple-100 dark:bg-purple-900/50 border-purple-200 dark:border-purple-800' : 'text-orange-700 bg-orange-100 dark:bg-orange-900/50 border-orange-200 dark:border-orange-800');
    const dName = t.displayName || t.name;
    const fullName = (t.name || '').toLowerCase();

    html += `<div onclick="confirmRoomAdd('${t.nric}')" class="sheet-list-item flex flex-col bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-pointer hover:border-primary transition mb-1.5" data-name="${dName.toLowerCase()}" data-fullname="${fullName}">
    <div class="flex justify-between items-start w-full gap-2">
        <span class="font-extrabold text-sm md:text-xs px-1.5 py-0.5 rounded shadow-sm border ${tDynColor} break-words whitespace-normal min-w-0 flex-1 text-left leading-[1.1]">${dName}</span>
        <span class="text-[11px] font-black ${roleColor} border px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap uppercase tracking-wider">${t.role.substring(0,3)}</span>
    </div>
    </div>`;
});
document.getElementById('sheetListContainer').innerHTML = html || `<p class="text-xs font-bold text-gray-400 p-2 text-center mt-2">Everyone is assigned.</p>`;
}

function filterBottomSheet() {
    const query = document.getElementById('sheetSearchInput').value.toLowerCase();
    const items = document.querySelectorAll('.sheet-list-item');
    items.forEach(item => {
        if (item.dataset.name.includes(query) || (item.dataset.fullname && item.dataset.fullname.includes(query))) {
            item.classList.remove('hidden-force');
        } else {
            item.classList.add('hidden-force');
        }
    });
}


function confirmPairing(targetNric) {
if(!currentPairingTarget) return; 

const traineeNric = currentPairingSourceRole === 'TRAINEE' ? currentPairingTarget : targetNric;
const volNric = currentPairingSourceRole === 'TRAINEE' ? targetNric : currentPairingTarget;

// Group Constraint Check
let vPerson = globalLogistics.participants.find(p => p.nric === volNric);
let tPerson = globalLogistics.participants.find(p => p.nric === traineeNric);
let vGroup = (vPerson && vPerson.logisticsGroup) ? String(vPerson.logisticsGroup).trim().toLowerCase() : "";
let tGroup = (tPerson && tPerson.logisticsGroup) ? String(tPerson.logisticsGroup).trim().toLowerCase() : "";
let unassignedVals = ["", "-", "na", "n/a", "none", "unassigned"];
let isVUnassigned = unassignedVals.includes(vGroup);
let isTUnassigned = unassignedVals.includes(tGroup);

if (vPerson && tPerson && !isVUnassigned && !isTUnassigned && vGroup !== tGroup) {
    showToast("Cannot pair: Trainee and Volunteer must be in the same group, or one must be unassigned.", true);
    closeSelectionSheet();
    return;
}

closeSelectionSheet();
let existing = globalLogistics.pairings.find(p => p.traineeNric === traineeNric && p.volNric === volNric);

if(!existing || existing.status !== 'ACTIVE') {
    const ts = Date.now();
    const key = traineeNric + '_' + volNric;
    pendingPairingsMap.set(key, { action: 'ADD', traineeNric, volNric, ts });

    if(existing) { existing.status = 'ACTIVE'; existing.ts = ts; } 
    else { globalLogistics.pairings.push({ traineeNric, volNric, status: 'ACTIVE', ts }); }

    clearSearch('pairingSearchInput', 'renderPairings');
    renderPairings(); 
    triggerPairingSync();
}
}

function confirmRoomAdd(nric) {
if(!activeRoomTargetId) return;
handleRoomDrop(nric, activeRoomTargetId);

const room = globalLogistics.rooms.find(r => r.id === activeRoomTargetId);
if(room && room.occupants.length >= room.capacity) {
    closeSelectionSheet();
} else {
    clearSearch('sheetSearchInput', 'filterBottomSheet');
    openRoomAddSheet(activeRoomTargetId); 
}
}

async function manualSyncPairings(btn) {
if (pendingPairingsMap.size > 0) await executePairingSync();
setSyncButtonState('loading');
try { 
    const res = await apiCall('fetchPairingsOnly'); 
    if(res.pairings) {
        res.pairings.forEach(sPair => {
            const key = sPair.traineeNric + '_' + sPair.volNric;
            if (!pendingPairingsMap.has(key)) {
                let lPair = globalLogistics.pairings.find(p => p.traineeNric === sPair.traineeNric && p.volNric === sPair.volNric);
                if (lPair) {
                    if (sPair.ts > lPair.ts) { lPair.status = sPair.status; lPair.ts = sPair.ts; }
                } else { globalLogistics.pairings.push(sPair); }
            }
        });
        renderPairings();
    }
    setSyncButtonState('saved'); showToast("Refreshed from server!"); 
} catch(e) { setSyncButtonState('error'); } 
}

function closeSelectionSheet() { 
document.getElementById('selectionBottomSheet').classList.add('hidden-force'); 
activeRoomTargetId = null; 
}

let activeAssignNric = null;
let activeAssignType = null; // 'group' or 'bus'

function openGroupAssignSheet(nric) {
    activeAssignNric = nric;
    activeAssignType = 'group';
    const p = globalLogistics.participants.find(x => x.nric === nric);
    if (!p) return;
    
    document.getElementById('sheetTitle').innerHTML = `Assign <span class="text-primary">${p.displayName || p.name}</span>`;
    const searchInput = document.getElementById('sheetSearchInput');
    if(searchInput) searchInput.value = '';
    
    renderGroupBusOptions();
    
    document.getElementById('selectionBottomSheet').classList.remove('hidden-force');
}

function openBusAssignSheet(nric) {
    activeAssignNric = nric;
    activeAssignType = 'bus';
    const p = globalLogistics.participants.find(x => x.nric === nric);
    if (!p) return;
    
    document.getElementById('sheetTitle').innerHTML = `Assign <span class="text-primary">${p.displayName || p.name}</span>`;
    const searchInput = document.getElementById('sheetSearchInput');
    if(searchInput) searchInput.value = '';
    
    renderGroupBusOptions();
    
    document.getElementById('selectionBottomSheet').classList.remove('hidden-force');
}

function renderGroupBusOptions() {
    const query = document.getElementById('sheetSearchInput').value.toLowerCase().trim();
    let list = [];
    if (activeAssignType === 'group') list = activeGroupsList;
    else if (activeAssignType === 'bus') list = activeBusesList;
    else if (activeAssignType === 'room') {
        const activeRooms = (globalLogistics.rooms || []).filter(r => !r.isDeleted);
        list = activeRooms.map(r => ({ id: r.id, name: r.name, ts: r.ts })).sort((a,b) => a.name.localeCompare(b.name));
    }
    
    let html = `<div class="flex flex-col gap-2">`;
    
    // Unassign option
    if (activeAssignNric && (!query || "unassign".includes(query))) {
        html += `
        <div onclick="selectGroupBusOption('')" class="sheet-list-item cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition" data-name="unassign">
            <span class="font-bold text-gray-700 dark:text-gray-200 text-sm">Unassigned</span>
        </div>`;
    }
    
    list.forEach(item => {
        let nameStr = activeAssignType === 'room' ? item.name : item;
        let idVal = activeAssignType === 'room' ? item.id : item;
        
        if (query && !nameStr.toLowerCase().includes(query)) return;
        
        html += `
        <div class="sheet-list-item p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between transition hover:bg-gray-50 dark:hover:bg-gray-750" data-name="${nameStr.toLowerCase()}">
            <div class="cursor-pointer flex-1 font-bold text-gray-900 dark:text-white text-sm" onclick="selectGroupBusOption('${idVal}')">${activeAssignType === 'group' ? 'Group ' : (activeAssignType === 'bus' ? 'Bus ' : 'Room ')}${nameStr}</div>
            <button onclick="${activeAssignType === 'room' ? `deleteRoom('${idVal}')` : `removeGroupBusFromPopup('${idVal}')`}" class="text-red-500 hover:text-red-600 p-2 -mr-2"><i class="fa-solid fa-trash text-sm"></i></button>
        </div>`;
    });
    
    // Add new
    html += `
    <div onclick="addGroupBusFromPopup()" class="cursor-pointer p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition">
        <span class="font-bold text-primary text-sm flex items-center gap-2"><i class="fa-solid fa-plus"></i> Add New ${activeAssignType === 'group' ? 'Group' : 'Bus'}</span>
    </div>`;
    
    html += `</div>`;
    
    document.getElementById('sheetListContainer').innerHTML = html;
}

function selectGroupBusOption(value) {
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
}

function addGroupBusFromPopup() {
    if (activeAssignType === 'room') {
        addRoom();
        renderGroupBusOptions();
        return;
    }
    const typeName = activeAssignType === 'group' ? 'Group' : 'Bus';
    const name = prompt(`Enter new ${typeName} name:`);
    if (!name || !name.trim()) return;
    const val = name.trim();
    
    if (activeAssignType === 'group') {
        if (!activeGroupsList.includes(val)) {
            activeGroupsList.push(val);
            localStorage.setItem('activeGroupsList', JSON.stringify(activeGroupsList));
        }
    } else {
        if (!activeBusesList.includes(val)) {
            activeBusesList.push(val);
            localStorage.setItem('activeBusesList', JSON.stringify(activeBusesList));
        }
    }
    renderGroupBusOptions();
    if (activeAssignType === 'group') renderGroups();
    else renderBuses();
}

function removeGroupBusFromPopup(val) {
    const typeName = activeAssignType === 'group' ? 'Group' : 'Bus';
    if (!confirm(`Are you sure you want to remove ${typeName} ${val}?`)) return;
    
    if (activeAssignType === 'group') {
        globalLogistics.participants.forEach(p => {
            if (p.logisticsGroup === val) {
                p.logisticsGroup = "";
                pendingGroupUpdates.set(p.nric, { nric: p.nric, value: "" });
            }
        });
        activeGroupsList = activeGroupsList.filter(x => x !== val);
        localStorage.setItem('activeGroupsList', JSON.stringify(activeGroupsList));
        renderGroups();
        if (pendingGroupUpdates.size > 0) triggerGroupSync();
    } else {
        globalLogistics.participants.forEach(p => {
            if (p.bus === val) {
                p.bus = "";
                pendingBusUpdates.set(p.nric, { nric: p.nric, value: "" });
            }
        });
        activeBusesList = activeBusesList.filter(x => x !== val);
        localStorage.setItem('activeBusesList', JSON.stringify(activeBusesList));
        renderBuses();
        if (pendingBusUpdates.size > 0) triggerBusSync();
    }
    renderGroupBusOptions();
}


function openManageGroupsSheet() {
    activeAssignNric = null; // No assignment
    activeAssignType = 'group';
    document.getElementById('sheetTitle').innerHTML = `Manage <span class="text-primary">Groups</span>`;
    const searchInput = document.getElementById('sheetSearchInput');
    if(searchInput) searchInput.value = '';
    renderGroupBusOptions();
    document.getElementById('selectionBottomSheet').classList.remove('hidden-force');
}

function openManageBusesSheet() {
    activeAssignNric = null; // No assignment
    activeAssignType = 'bus';
    document.getElementById('sheetTitle').innerHTML = `Manage <span class="text-primary">Buses</span>`;
    const searchInput = document.getElementById('sheetSearchInput');
    if(searchInput) searchInput.value = '';
    renderGroupBusOptions();
    document.getElementById('selectionBottomSheet').classList.remove('hidden-force');
}



function removeGroupList(gName) {
    activeAssignType = 'group';
    removeGroupBusFromPopup(gName);
}

function removeBusList(bName) {
    activeAssignType = 'bus';
    removeGroupBusFromPopup(bName);
}


function openManageRoomsSheet() {
    activeAssignNric = null; // No assignment
    activeAssignType = 'room';
    document.getElementById('sheetTitle').innerHTML = `Manage <span class="text-primary">Rooms</span>`;
    const searchInput = document.getElementById('sheetSearchInput');
    if(searchInput) searchInput.value = '';
    renderGroupBusOptions();
    document.getElementById('selectionBottomSheet').classList.remove('hidden-force');
}

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
