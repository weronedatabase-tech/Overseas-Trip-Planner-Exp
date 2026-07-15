// ==========================================
// Pairing_Grouping.js - Logistics & Rooms Engine
// ==========================================
// [CONSIDERATION - SPA to MPA Migration]: `globalLogistics` is initialized globally here.
// [CONSIDERATION - OPTIMISTIC UI]: Calls `AppCore.trackMutation()` on local drops. 
// Syncs use `AppCore.apiFetch(..., true)` to abort if local modifications occurred during transit.

window.globalLogistics = null;
let pairingSyncTimeout = null;
let altSwapMode = false;
let currentPairingSourceRole = 'TRAINEE';
let pendingPairingsMap = new Map();
let isPairingSyncing = false;
let pairingPollInterval = null;

let pendingRoomUpdates = new Map();
let isRoomSyncing = false;
let roomSyncTimeout = null;
let activeRoomTargetId = null;

let dndState = {
    isDragging: false, el: null, clone: null, startX: 0, startY: 0, nameNode: null, rectWidth: 0, rectHeight: 0, type: 'pairing'
};

if (!window.dndInitialized) {
    window.dndInitialized = true;
    document.addEventListener('touchstart', (e) => { if(e.touches.length === 1) startDrag(e, e.touches[0].clientX, e.touches[0].clientY, true); }, {passive: false});
    document.addEventListener('touchmove', (e) => { if(e.touches.length === 1) moveDrag(e, e.touches[0].clientX, e.touches[0].clientY, true); }, {passive: false});
    document.addEventListener('touchend', (e) => { const touch = e.changedTouches ? e.changedTouches[0] : e.touches[0]; endDrag(e, touch.clientX, touch.clientY); });
    document.addEventListener('touchcancel', (e) => { const touch = e.changedTouches ? e.changedTouches[0] : e.touches[0]; endDrag(e, touch.clientX, touch.clientY); });
    document.addEventListener('mousedown', (e) => { if (e.button === 0) startDrag(e, e.clientX, e.clientY, false); });
    document.addEventListener('mousemove', (e) => { moveDrag(e, e.clientX, e.clientY, false); });
    document.addEventListener('mouseup', (e) => { endDrag(e, e.clientX, e.clientY); });

    function startDrag(e, clientX, clientY, isTouch) {
        if(e.target.closest('.remove-x') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
        let draggable = e.target.closest('.dnd-draggable');
        let roomDraggable = e.target.closest('.dnd-room-draggable');
        if(!draggable && !roomDraggable) return;

        if (draggable) {
            const container = document.getElementById('log-pairings');
            if(!container || container.classList.contains('hidden-force')) return;
            dndState.type = 'pairing'; dndState.el = draggable;
        } else if (roomDraggable) {
            const container = document.getElementById('log-rooms');
            if(!container || container.classList.contains('hidden-force')) return;
            dndState.type = 'rooming'; dndState.el = roomDraggable;
        }

        dndState.nameNode = dndState.el.querySelector('.main-name-pill') || dndState.el;
        const rect = dndState.nameNode.getBoundingClientRect();
        dndState.rectWidth = rect.width; dndState.rectHeight = rect.height;
        dndState.startX = clientX; dndState.startY = clientY; dndState.isDragging = false;
    }

    function moveDrag(e, clientX, clientY, isTouch) {
        if (!dndState.el) return;
        const deltaX = Math.abs(clientX - dndState.startX); const deltaY = Math.abs(clientY - dndState.startY);

        if (!dndState.isDragging) {
            const threshold = 8;
            if ((dndState.type === 'pairing' && deltaX > threshold && deltaX > deltaY) || (dndState.type === 'rooming' && (deltaX > threshold || deltaY > threshold))) {
                if (dndState.type === 'pairing' && deltaY > 8 && deltaY > deltaX) { dndState.el = null; return; }
                dndState.isDragging = true;
                if(isTouch && navigator.vibrate) navigator.vibrate(20);
                dndState.el.classList.add('locked-for-drag');
                dndState.clone = dndState.nameNode.cloneNode(true);
                dndState.clone.classList.add('dragging-clone');
                dndState.clone.style.width = dndState.rectWidth + 'px';
                dndState.clone.style.height = dndState.rectHeight + 'px';
                dndState.clone.style.margin = '0px';
                document.body.appendChild(dndState.clone);
            } else if (dndState.type === 'pairing' && deltaY > 8) {
                dndState.el = null; return;
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
                        dz.classList.add('border-primary', 'bg-blue-50/50', 'dark:bg-zinc-800', 'ring-1', 'ring-primary');
                    } else {
                        dz.classList.remove('border-primary', 'bg-blue-50/50', 'dark:bg-zinc-800', 'ring-1', 'ring-primary');
                    }
                });
            } else if (dndState.type === 'rooming') {
                const activeRoom = elAtPoint ? elAtPoint.closest('.dnd-room-dropzone') : null;
                document.querySelectorAll('.dnd-room-dropzone').forEach(dz => {
                    if (dz === activeRoom) dz.classList.add('border-primary', 'bg-blue-50/50', 'dark:bg-zinc-800', 'ring-1', 'ring-primary');
                    else dz.classList.remove('border-primary', 'bg-blue-50/50', 'dark:bg-zinc-800', 'ring-1', 'ring-primary');
                });
            }
        }
    }

    function endDrag(e, clientX, clientY) {
        if(dndState.el) dndState.el.classList.remove('locked-for-drag');
        if (dndState.isDragging && dndState.clone) {
            dndState.clone.remove(); dndState.clone = null; dndState.isDragging = false;
            document.querySelectorAll('.dnd-dropzone, .dnd-room-dropzone').forEach(dz => dz.classList.remove('border-primary', 'bg-blue-50/50', 'dark:bg-zinc-800', 'ring-1', 'ring-primary'));

            const elAtPoint = document.elementFromPoint(clientX, clientY);
            if (dndState.type === 'pairing') {
                const dropZone = elAtPoint ? elAtPoint.closest('.dnd-dropzone') : null;
                if(dropZone && dndState.el && dropZone.dataset.role !== dndState.el.dataset.role) {
                    const sourceNric = dndState.el.dataset.nric;
                    const targetNric = dropZone.dataset.nric;
                    if(sourceNric && targetNric) handleDndDrop(sourceNric, dndState.el.dataset.role, targetNric);
                }
            } else if (dndState.type === 'rooming') {
                const roomDropZone = elAtPoint ? elAtPoint.closest('.dnd-room-dropzone') : null;
                if (roomDropZone && dndState.el) {
                    const sourceNric = dndState.el.dataset.nric;
                    const targetRoomId = roomDropZone.dataset.roomId;
                    if (sourceNric && targetRoomId) handleRoomDrop(sourceNric, targetRoomId);
                }
            }
        }
        dndState.el = null; dndState.nameNode = null;
    }

    function updateClonePosition(x, y) {
        if(dndState.clone) {
            const centerX = x - (dndState.rectWidth / 2); const centerY = y - (dndState.rectHeight / 2);
            dndState.clone.style.transform = `translate3d(${centerX}px, ${centerY}px, 0px) scale(1.05)`;
        }
    }
}

// ==========================================
// PAIRING LOGIC
// ==========================================
function handleDndDrop(sourceNric, sourceRole, targetNric) {
    AppCore.trackMutation(); // [CONSIDERATION - OPTIMISTIC UI] Track mutation globally
    let volNric = sourceRole === 'VOLUNTEER' ? sourceNric : targetNric;
    let traineeNric = sourceRole === 'TRAINEE' ? sourceNric : targetNric;
    let existing = globalLogistics.pairings.find(p => p.traineeNric === traineeNric && p.volNric === volNric);

    if(!existing || existing.status !== 'ACTIVE') {
        const ts = Date.now();
        const key = traineeNric + '_' + volNric;
        pendingPairingsMap.set(key, { action: 'ADD', traineeNric, volNric, ts });

        if(existing) { existing.status = 'ACTIVE'; existing.ts = ts; } 
        else { globalLogistics.pairings.push({ traineeNric, volNric, status: 'ACTIVE', ts }); }

        renderPairings(); 
        triggerPairingSync();
    } else {
        AppCore.showToast("Already paired!", true);
    }
}

function unpairTrainee(traineeNric, volNric) {
    AppCore.trackMutation();
    const ts = Date.now();
    const key = traineeNric + '_' + volNric;
    pendingPairingsMap.set(key, { action: 'REMOVE', traineeNric, volNric, ts });

    let existing = globalLogistics.pairings.find(p => p.traineeNric === traineeNric && p.volNric === volNric);
    if (existing) { existing.status = 'UNPAIRED'; existing.ts = ts; }

    renderPairings(); 
    triggerPairingSync();
}

function setSyncButtonState(state) {
    document.querySelectorAll('.btn-sync-pairings').forEach(btn => {
        const textSpan = btn.querySelector('.btn-text'); const spinner = btn.querySelector('.btn-spinner');
        btn.className = "btn-sync-pairings text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center shadow-sm focus:outline-none shrink-0 border"; 
        spinner.className = "btn-spinner ml-1 !w-3 !h-3 hidden-force"; 
        if (state === 'loading') { 
            btn.classList.add('bg-zinc-100', 'text-zinc-500', 'border-zinc-200', 'dark:bg-zinc-800', 'dark:text-zinc-400', 'dark:border-zinc-700'); 
            textSpan.textContent = "Loading..."; spinner.classList.remove('hidden-force'); spinner.classList.add('spinner-primary'); 
        } else if(state === 'saving') { 
            btn.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-200', 'dark:bg-yellow-900/30', 'dark:text-yellow-300', 'dark:border-yellow-800'); 
            textSpan.textContent = "Saving..."; spinner.classList.remove('hidden-force'); spinner.classList.add('spinner-yellow'); 
        } else if (state === 'saved') { 
            btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200', 'dark:bg-green-900/30', 'dark:text-green-300', 'dark:border-green-800'); 
            textSpan.textContent = "Saved"; 
        } else if (state === 'error') { 
            btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200', 'dark:bg-red-900/30', 'dark:text-red-300', 'dark:border-red-800'); 
            textSpan.textContent = "Failed"; 
        }
    });
}

function triggerPairingSync() {
    setSyncButtonState('saving');
    if (pairingSyncTimeout) clearTimeout(pairingSyncTimeout);
    pairingSyncTimeout = setTimeout(() => { executePairingSync(); }, 800); 
}

async function executePairingSync() {
    if (pendingPairingsMap.size === 0) return;
    isPairingSyncing = true;
    setSyncButtonState('saving');
    const batch = new Map(pendingPairingsMap);
    const updates = Array.from(batch.values());
    pendingPairingsMap.clear();

    try {
        const res = await AppCore.apiFetch('syncPairingUpdates', { updates: updates, takenBy: AppCore.currentUser?.name || 'User' });
        if(res && res.pairings) {
            res.pairings.forEach(sPair => {
                const key = sPair.traineeNric + '_' + sPair.volNric;
                if (!pendingPairingsMap.has(key)) {
                    let lPair = globalLogistics.pairings.find(p => p.traineeNric === sPair.traineeNric && p.volNric === sPair.volNric);
                    if (lPair) { if (sPair.ts > lPair.ts) { lPair.status = sPair.status; lPair.ts = sPair.ts; } } 
                    else { globalLogistics.pairings.push(sPair); }
                }
            });
            if (!dndState.el && !dndState.isDragging && dndState.type === 'pairing') renderPairings();
        }
        setSyncButtonState('saved');
    } catch(e) {
        AppCore.showToast("Sync failed. Retrying...", true);
        setSyncButtonState('error');
        batch.forEach((val, key) => pendingPairingsMap.set(key, val));
    } finally {
        isPairingSyncing = false;
    }
}

function startPairingPolling() {
    if (pairingPollInterval) clearInterval(pairingPollInterval);
    pairingPollInterval = setInterval(async () => {
        const logTab = document.getElementById('log-pairings');
        if(!logTab || logTab.classList.contains('hidden-force') || isPairingSyncing || (dndState.type === 'pairing' && (dndState.el || dndState.isDragging))) return;

        try {
            // [CONSIDERATION - OPTIMISTIC UI]: `true` flags this as a background poll, dropping response if stale.
            const res = await AppCore.apiFetch('fetchPairingsOnly', {}, true);
            if(!res || !res.pairings) return; 

            let hasChanges = false;
            res.pairings.forEach(sPair => {
                const key = sPair.traineeNric + '_' + sPair.volNric;
                if (!pendingPairingsMap.has(key)) {
                    let lPair = globalLogistics.pairings.find(p => p.traineeNric === sPair.traineeNric && p.volNric === sPair.volNric);
                    if (lPair) {
                        if (sPair.ts > lPair.ts) { lPair.status = sPair.status; lPair.ts = sPair.ts; hasChanges = true; }
                    } else { globalLogistics.pairings.push(sPair); hasChanges = true; }
                }
            });
            
            if (hasChanges && !dndState.el && !dndState.isDragging) {
                renderPairings();
                if(!document.getElementById('selectionBottomSheet').classList.contains('hidden-force') && currentPairingTarget) {
                    openPairingSheet(currentPairingTarget, currentPairingSourceRole);
                }
            }
        } catch(e) { }
    }, 8000);
}

// ==========================================
// ROOMS LOGIC
// ==========================================
function generateRoomUUID(idx) { return 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + (idx !== undefined ? '_' + idx : ''); }

function setRoomSyncButtonState(state) {
    const btn = document.getElementById('btn-sync-rooms');
    if(!btn) return;
    const textSpan = btn.querySelector('.btn-text'); const spinner = btn.querySelector('.btn-spinner');
    btn.className = "text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
    spinner.className = "btn-spinner ml-1 !w-3 !h-3 hidden-force"; 
    if (state === 'loading') { 
        btn.classList.add('bg-zinc-100', 'text-zinc-500', 'border-zinc-200', 'dark:bg-zinc-800', 'dark:text-zinc-400', 'dark:border-zinc-700'); 
        textSpan.textContent = "Loading..."; spinner.classList.remove('hidden-force'); spinner.classList.add('spinner-primary'); 
    } else if(state === 'saving') { 
        btn.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-200', 'dark:bg-yellow-900/30', 'dark:text-yellow-300', 'dark:border-yellow-800'); 
        textSpan.textContent = "Saving..."; spinner.classList.remove('hidden-force'); spinner.classList.add('spinner-yellow'); 
    } else if (state === 'saved') { 
        btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200', 'dark:bg-green-900/30', 'dark:text-green-300', 'dark:border-green-800'); 
        textSpan.textContent = "Saved"; 
    } else if (state === 'error') { 
        btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200', 'dark:bg-red-900/30', 'dark:text-red-300', 'dark:border-red-800'); 
        textSpan.textContent = "Failed"; 
    }
}

function queueRoomUpdate(roomId) {
    AppCore.trackMutation();
    const room = globalLogistics.rooms.find(r => r.id === roomId);
    if(room) {
        pendingRoomUpdates.set(roomId, room);
        setRoomSyncButtonState('saving');
        if(roomSyncTimeout) clearTimeout(roomSyncTimeout);
        roomSyncTimeout = setTimeout(() => { executeRoomSync(); }, 1500);
    }
}

function handleRoomDrop(nric, targetRoomId) {
    globalLogistics.rooms.forEach(r => {
        if(!r.isDeleted && r.occupants.includes(nric)) { r.occupants = r.occupants.filter(n => n !== nric); r.ts = Date.now(); queueRoomUpdate(r.id); }
    });
    const targetRoom = globalLogistics.rooms.find(r => r.id === targetRoomId);
    if(targetRoom && !targetRoom.isDeleted) {
        if(targetRoom.occupants.length >= targetRoom.capacity) { AppCore.showToast("Room is full!", true); renderRooms(); return; }
        targetRoom.occupants.push(nric); targetRoom.ts = Date.now(); queueRoomUpdate(targetRoom.id);
    }
    renderRooms();
}

function unassignFromRoom(nric, roomId) {
    const room = globalLogistics.rooms.find(r => r.id === roomId);
    if(room && !room.isDeleted) { room.occupants = room.occupants.filter(n => n !== nric); room.ts = Date.now(); queueRoomUpdate(roomId); renderRooms(); }
}

function addRoom() {
    const prefix = prompt("Enter Room Base Name (e.g. 'Room', 'Tent', 'Block A'):", "Room");
    if (!prefix || !prefix.trim()) return;
    const capacity = parseInt(prompt("Enter Capacity per room:", "2")) || 2;
    const qty = parseInt(prompt("Quantity of this room type to create:", "1")) || 1;

    if(!globalLogistics.rooms) globalLogistics.rooms = [];
    let existingCount = globalLogistics.rooms.filter(r => !r.isDeleted && r.name.startsWith(prefix.trim())).length;

    for(let i=0; i<qty; i++) {
        let roomName = (qty > 1 || existingCount > 0) ? `${prefix.trim()} ${existingCount + i + 1}` : prefix.trim();
        const newRoom = { id: generateRoomUUID(i), name: roomName, capacity: capacity, occupants: [], ts: Date.now(), isDeleted: false };
        globalLogistics.rooms.push(newRoom); queueRoomUpdate(newRoom.id);
    }
    renderRooms(); AppCore.showToast(`Created ${qty} room(s).`);
}

function promptEditRoom(id) {
    const room = globalLogistics.rooms.find(r => r.id === id); if(!room) return;
    const name = prompt("Edit Room Name:", room.name); if(!name || !name.trim()) return;
    const capacity = parseInt(prompt("Edit Room Capacity:", room.capacity)) || room.capacity;
    room.name = name.trim(); room.capacity = capacity; room.ts = Date.now(); queueRoomUpdate(id); renderRooms();
}

function deleteRoom(id) {
    if(!confirm("Are you sure you want to delete this room? Users inside will be unassigned.")) return;
    const room = globalLogistics.rooms.find(r => r.id === id);
    if(room) { room.isDeleted = true; room.ts = Date.now(); room.occupants = []; queueRoomUpdate(id); renderRooms(); }
}

function deleteAllRooms() {
    if(!confirm("⚠️ DANGER: This will delete ALL rooms and unassign everyone. Are you sure you want to proceed?")) return;
    let changed = false;
    globalLogistics.rooms.forEach(r => { if(!r.isDeleted) { r.isDeleted = true; r.ts = Date.now(); r.occupants = []; queueRoomUpdate(r.id); changed = true; } });
    if(changed) { renderRooms(); AppCore.showToast("All rooms have been deleted."); }
}

function resetRoomAssignments() {
    if(!confirm("Are you sure you want to unassign everyone from all rooms?")) return;
    let changed = false;
    globalLogistics.rooms.forEach(r => { if(!r.isDeleted && r.occupants.length > 0) { r.occupants = []; r.ts = Date.now(); queueRoomUpdate(r.id); changed = true; } });
    if(changed) { renderRooms(); AppCore.showToast("All assignments cleared."); }
}

function autoAssignRooms() {
    if(!confirm("This will automatically assign unassigned participants into EXISTING rooms based on their connections. Continue?")) return;
    
    // Simplistic port of the existing clustering logic...
    const familyMap = {}; const pairingsMap = {}; 
    globalLogistics.participants.forEach(p => { if (p.pocNric) { if(!familyMap[p.pocNric]) familyMap[p.pocNric] = []; familyMap[p.pocNric].push(p.nric); } });
    (globalLogistics.pairings || []).forEach(p => { if(p.status === 'ACTIVE') { if(!pairingsMap[p.traineeNric]) pairingsMap[p.traineeNric] = []; pairingsMap[p.traineeNric].push(p.volNric); } });

    const clusters = []; const visited = new Set();
    function buildCluster(startNric) {
        const cluster = []; const queue = [startNric];
        while(queue.length > 0) {
            const curr = queue.shift();
            if(!visited.has(curr)) {
                visited.add(curr); cluster.push(curr);
                const pObj = globalLogistics.participants.find(x => x.nric === curr);
                if(pObj) {
                    if(familyMap[pObj.pocNric]) familyMap[pObj.pocNric].forEach(fam => { if(!visited.has(fam)) queue.push(fam); });
                    if(pairingsMap[curr]) pairingsMap[curr].forEach(vol => { if(!visited.has(vol)) queue.push(vol); });
                    Object.keys(pairingsMap).forEach(tNric => { if(pairingsMap[tNric].includes(curr) && !visited.has(tNric)) queue.push(tNric); });
                }
            }
        }
        return cluster;
    }

    globalLogistics.participants.forEach(p => { if(!visited.has(p.nric)) clusters.push(buildCluster(p.nric)); });
    
    const roomAssignments = {}; const activeRooms = globalLogistics.rooms.filter(r => !r.isDeleted);
    activeRooms.forEach(r => r.occupants.forEach(n => roomAssignments[n] = r.id));

    function getGender(nrics) {
        if (!nrics || nrics.length === 0) return 'Empty';
        let hasM = false, hasF = false;
        nrics.forEach(n => { const p = globalLogistics.participants.find(x => x.nric === n); if (p) { if (p.gender === 'Male') hasM = true; if (p.gender === 'Female') hasF = true; } });
        if (hasM && hasF) return 'Mixed'; if (hasM) return 'Male'; if (hasF) return 'Female'; return 'Unknown';
    }

    let placedCount = 0;
    clusters.forEach(cluster => {
        const unassigned = cluster.filter(n => !roomAssignments[n]); if (unassigned.length === 0) return;
        const assigned = cluster.filter(n => roomAssignments[n]);

        if (assigned.length > 0) {
            const roomIds = [...new Set(assigned.map(n => roomAssignments[n]))];
            if (roomIds.length === 1) {
                const targetRoom = activeRooms.find(r => r.id === roomIds[0]);
                if (targetRoom && (targetRoom.capacity - targetRoom.occupants.length) >= unassigned.length) {
                    unassigned.forEach(n => { targetRoom.occupants.push(n); roomAssignments[n] = targetRoom.id; placedCount++; });
                    targetRoom.ts = Date.now(); queueRoomUpdate(targetRoom.id);
                }
            }
        } else {
            const clusterGender = getGender(unassigned);
            let roomToFit = activeRooms.find(r => {
                const available = r.capacity - r.occupants.length; if (available < unassigned.length) return false;
                const roomGender = getGender(r.occupants);
                if (roomGender === 'Empty') return true; if (clusterGender === 'Mixed' || roomGender === 'Mixed') return false; 
                return clusterGender === roomGender;
            });
            if (roomToFit) {
                unassigned.forEach(n => { roomToFit.occupants.push(n); roomAssignments[n] = roomToFit.id; placedCount++; });
                roomToFit.ts = Date.now(); queueRoomUpdate(roomToFit.id);
            }
        }
    });

    renderRooms();
    AppCore.showToast(placedCount > 0 ? `Auto-assigned ${placedCount} participants.` : "No clusters could be completely fitted based on strict family/gender rules.");
}

async function executeRoomSync() {
    if (pendingRoomUpdates.size === 0) return;
    isRoomSyncing = true;
    setRoomSyncButtonState('saving');
    const batch = new Map(pendingRoomUpdates);
    const updates = Array.from(batch.values());
    pendingRoomUpdates.clear();

    try {
        const res = await AppCore.apiFetch('syncRoomUpdates', { updates: updates, takenBy: AppCore.currentUser?.name || 'Admin' });
        if(res && res.rooms) {
            res.rooms.forEach(sRoom => {
                if (!pendingRoomUpdates.has(sRoom.id)) {
                    let lRoom = globalLogistics.rooms.find(r => r.id === sRoom.id);
                    if (lRoom) { if (sRoom.ts > (lRoom.ts || 0)) { Object.assign(lRoom, sRoom); } } 
                    else { globalLogistics.rooms.push(sRoom); }
                }
            });
            if (!dndState.el && !dndState.isDragging && dndState.type === 'rooming') renderRooms();
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
        const roomSec = document.getElementById('log-rooms');
        if(!roomSec || roomSec.classList.contains('hidden-force') || isRoomSyncing || (dndState.type === 'rooming' && (dndState.el || dndState.isDragging))) return;

        try {
            const res = await AppCore.apiFetch('fetchRoomsOnly', {}, true);
            if(res && res.rooms) {
                let hasChanges = false;
                res.rooms.forEach(sRoom => {
                    if (!pendingRoomUpdates.has(sRoom.id)) {
                        let lRoom = globalLogistics.rooms.find(r => r.id === sRoom.id);
                        if (lRoom) {
                            if (sRoom.ts > (lRoom.ts || 0)) { Object.assign(lRoom, sRoom); hasChanges = true; }
                        } else { globalLogistics.rooms.push(sRoom); hasChanges = true; }
                    }
                });
                if(hasChanges && !dndState.el && !dndState.isDragging) renderRooms();
            }
        } catch(e){}
    }, 10000);
}

// ==========================================
// UI & RENDERERS
// ==========================================
function buildLogisticsUI() {
    document.getElementById('tab-logistics').innerHTML = `
    <div class="flex overflow-x-auto bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 scrollbar-hide shrink-0 rounded-t-xl md:rounded-none px-2 pt-1 z-10">
        <button onclick="switchLogisticsSubTab('pairings')" id="subTab-pairings" class="px-3 py-2 font-semibold border-b-2 border-primary text-primary whitespace-nowrap text-xs md:text-sm transition focus:outline-none">1. Pairings</button>
        <button onclick="switchLogisticsSubTab('rooms')" id="subTab-rooms" class="px-3 py-2 font-semibold border-b-2 border-transparent text-zinc-500 dark:text-zinc-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none">2. Rooms</button>
        <button onclick="switchLogisticsSubTab('groups')" id="subTab-groups" class="px-3 py-2 font-semibold border-b-2 border-transparent text-zinc-500 dark:text-zinc-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none">3. Groups</button>
    </div>

    <!-- Pairings -->
    <div id="log-pairings" class="flex-1 flex flex-col min-h-0 w-full relative">
        <div id="logLoadingOverlay" class="absolute inset-0 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm z-20 hidden-force flex flex-col justify-center items-center">
            <div class="loader !w-8 !h-8 border-primary mb-2"></div>
            <span class="text-primary dark:text-blue-400 font-bold text-[10px] tracking-wide shadow-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1 rounded-full">Loading...</span>
        </div>
        <div class="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-2 md:p-3 shrink-0 z-10 flex flex-col gap-1 shadow-sm">
            <div class="flex justify-between items-center px-1">
                <div class="flex items-center gap-2">
                    <h3 class="text-sm md:text-base font-black text-zinc-900 dark:text-white tracking-tight">Pairings</h3>
                    <button onclick="toggleAltSwap()" class="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition focus:outline-none border border-zinc-200 dark:border-zinc-700 shadow-sm" title="Swap Columns">
                        <svg class="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                    </button>
                </div>
                <button onclick="manualSyncPairings(this)" class="btn-sync-pairings text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0"><span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div></button>
            </div>
        </div>
        <div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative bg-zinc-50 dark:bg-zinc-950 border-x border-b border-zinc-200 dark:border-zinc-800 rounded-b-xl md:rounded-none">
            <div id="dnd-source-col" class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors border-r border-zinc-200 dark:border-zinc-800">
                <h4 id="dnd-source-title" class="font-black text-[10px] py-1.5 shrink-0 text-center uppercase tracking-widest border-b"></h4>
                <div id="dnd-source-pool" class="space-y-1.5 flex-grow overflow-y-auto p-1.5 custom-scrollbar bg-opacity-50 pb-6"></div>
            </div>
            <div id="dnd-target-col" class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors">
                <h4 id="dnd-target-title" class="font-black text-[10px] py-1.5 shrink-0 text-center uppercase tracking-widest border-b"></h4>
                <div id="dnd-target-list" class="space-y-1.5 flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6 bg-opacity-50"></div>
            </div>
        </div>
    </div>

    <!-- Rooms -->
    <div id="log-rooms" class="hidden-force flex-1 flex flex-col min-h-0 w-full relative">
        <div class="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-2 md:p-3 shrink-0 z-10 flex flex-col gap-2 shadow-sm">
            <div class="flex justify-between items-center px-1">
                <div class="flex flex-wrap items-center gap-1 md:gap-1.5">
                    <h3 class="text-xs md:text-base font-black text-zinc-900 dark:text-white mr-1 shrink-0">Rooms</h3>
                    <button onclick="resetRoomAssignments()" class="bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 text-[9px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-orange-100 transition focus:outline-none">Unassign</button>
                    <button onclick="deleteAllRooms()" class="bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 text-[9px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-red-100 transition focus:outline-none">Delete All</button>
                    <button onclick="autoAssignRooms()" class="bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 text-[9px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-blue-100 transition focus:outline-none">Auto-Room</button>
                    <button onclick="addRoom()" class="bg-zinc-100 dark:bg-zinc-800 p-1 md:p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition focus:outline-none border border-zinc-200 dark:border-zinc-700 shadow-sm shrink-0" title="Add Room(s)"><svg class="w-3 h-3 md:w-4 md:h-4 text-zinc-700 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg></button>
                </div>
                <button id="btn-sync-rooms" onclick="manualSyncRooms(this)" class="text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0"><span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div></button>
            </div>
            <div class="flex justify-between items-center px-1 gap-2 mt-1">
                <input type="text" id="roomSearchInput" oninput="renderRooms()" placeholder="Fuzzy search..." class="w-full max-w-sm p-1.5 px-3 border border-zinc-300 dark:border-zinc-700 rounded text-[10px] font-bold bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:border-primary shadow-sm transition">
                <select id="roomFilterSelect" onchange="renderRooms()" class="text-[10px] font-bold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1.5 outline-none shrink-0">
                    <option value="ALL">All Roles</option><option value="TRAINEE">Trainees</option><option value="CAREGIVER">Caregivers</option><option value="VOLUNTEER">Volunteers</option>
                </select>
            </div>
        </div>
        <div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative bg-zinc-50 dark:bg-zinc-950 rounded-b-xl md:rounded-none">
            <div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50">
                <h4 class="font-black text-[10px] py-1.5 shrink-0 text-center uppercase tracking-widest bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">Unassigned (<span id="unassignedCount">0</span>)</h4>
                <div id="roomUnassignedPool" class="space-y-1.5 flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6"></div>
            </div>
            <div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
                <div id="roomListContainer" class="flex-grow overflow-y-auto p-1.5 md:p-2 custom-scrollbar flex flex-col gap-2 md:gap-3 pb-6"></div>
            </div>
        </div>
    </div>
    
    <div id="log-groups" class="hidden-force flex-1 mt-2 w-full"><div class="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700"><p class="text-sm text-zinc-500 dark:text-zinc-400">Group builder in development...</p></div></div>
    `;
}

function switchLogisticsSubTab(tabId) {
    ['pairings', 'rooms', 'groups'].forEach(id => { 
        const el = document.getElementById(`log-${id}`); if(el) el.classList.add('hidden-force'); 
        const btn = document.getElementById(`subTab-${id}`); if(btn) { btn.classList.remove('border-primary', 'text-primary'); btn.classList.add('border-transparent', 'text-zinc-500', 'dark:text-zinc-400'); } 
    }); 
    const targetEl = document.getElementById(`log-${tabId}`); if(targetEl) targetEl.classList.remove('hidden-force'); 
    const targetBtn = document.getElementById(`subTab-${tabId}`); if(targetBtn) { targetBtn.classList.remove('border-transparent', 'text-zinc-500', 'dark:text-zinc-400'); targetBtn.classList.add('border-primary', 'text-primary'); } 
}

async function loadLogisticsData() { 
    const overlay = document.getElementById('logLoadingOverlay');
    if (overlay) overlay.classList.remove('hidden-force');
    setSyncButtonState('loading'); setRoomSyncButtonState('loading');

    try { 
        const res = await AppCore.apiFetch('fetchLogistics'); 
        globalLogistics = res; 
        if(!globalLogistics.rooms) globalLogistics.rooms = [];
        if (typeof processDisplayNames === "function") processDisplayNames(globalLogistics.participants);
        if (typeof applyGlobalSorting === "function") globalLogistics.participants = applyGlobalSorting(globalLogistics.participants);
        
        renderPairings(); renderRooms();
        setSyncButtonState('saved'); setRoomSyncButtonState('saved');
        startPairingPolling(); startRoomPolling();
    } catch(e) { 
        AppCore.showToast("Failed to load logistics.", true); 
        setSyncButtonState('error'); setRoomSyncButtonState('error');
    } finally {
        if (overlay) overlay.classList.add('hidden-force');
    }
}

function toggleAltSwap() { altSwapMode = !altSwapMode; renderPairings(); }

function renderPairings() {
    if(!globalLogistics || !document.getElementById('dnd-source-pool')) return;
    const trainees = globalLogistics.participants.filter(p => p.role === 'TRAINEE');
    const vols = globalLogistics.participants.filter(p => p.role === 'VOLUNTEER');
    const activePairings = (globalLogistics.pairings || []).filter(p => (!p.status || p.status === 'ACTIVE'));
    const isSourceVol = !altSwapMode;
    const sourceArr = isSourceVol ? vols : trainees;
    const targetArr = isSourceVol ? trainees : vols;

    const sourceTitle = document.getElementById('dnd-source-title'); const targetTitle = document.getElementById('dnd-target-title');
    sourceTitle.innerText = isSourceVol ? "Volunteers" : "Trainees"; targetTitle.innerText = isSourceVol ? "Trainees" : "Volunteers";
    
    // Core Generation
    const genCards = (arr) => arr.map(item => {
        const dynColor = typeof getProjectColor === 'function' ? getProjectColor(item.group) : 'bg-zinc-100 dark:bg-zinc-800';
        const myPairings = item.role === 'TRAINEE' ? activePairings.filter(p => p.traineeNric === item.nric) : activePairings.filter(p => p.volNric === item.nric);
        let pairedPills = myPairings.map(pair => {
            const pPerson = item.role === 'TRAINEE' ? vols.find(v => v.nric === pair.volNric) : trainees.find(t => t.nric === pair.traineeNric);
            if(pPerson) return `<div class="relative flex w-full align-top pointer-events-auto"><div class="${typeof getProjectColor === 'function' ? getProjectColor(pPerson.group) : 'bg-zinc-100 dark:bg-zinc-800'} text-[10px] md:text-[11px] pl-2 pr-6 py-1 rounded shadow-sm border font-bold opacity-90 leading-tight break-words whitespace-normal text-left w-full">${pPerson.displayName || pPerson.name}</div><div class="remove-x" onclick="unpairTrainee('${pair.traineeNric}', '${pair.volNric}')">×</div></div>`;
            return '';
        }).join('');

        return `<div class="dnd-draggable dnd-dropzone bg-white dark:bg-zinc-800 p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col gap-1" data-nric="${item.nric}" data-role="${item.role}">
            <div class="flex justify-between items-start w-full gap-1">
                <div class="main-name-pill font-extrabold text-[11px] px-1.5 py-0.5 rounded border ${dynColor} max-w-full leading-[1.1]"><span class="break-words whitespace-normal">${item.displayName || item.name}</span></div>
                <button onclick="openPairingSheet('${item.nric}', '${item.role}')" class="text-[9px] bg-blue-50 dark:bg-zinc-700 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-1 rounded border hover:bg-blue-100 transition whitespace-nowrap focus:outline-none shrink-0 pointer-events-auto shadow-sm">${item.role === 'TRAINEE' ? '+ Vol' : '+ Trn'}</button>
            </div>
            <div class="flex flex-col pointer-events-auto bg-zinc-50/50 dark:bg-zinc-900/50 p-1.5 rounded min-h-[36px] border border-dashed border-zinc-200 dark:border-zinc-700 w-full gap-1.5">
                ${pairedPills || '<span class="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 text-center py-1">Drop pair here</span>'}
            </div>
        </div>`;
    }).join('');

    document.getElementById('dnd-source-pool').innerHTML = genCards(sourceArr) || '<p class="text-[10px] text-zinc-500 font-bold p-2 text-center mt-2">No items.</p>';
    document.getElementById('dnd-target-list').innerHTML = genCards(targetArr) || '<p class="text-[10px] text-zinc-500 font-bold p-2 text-center mt-2">No items.</p>';
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
    if (query) filteredUnassigned = unassignedArr.filter(p => (p.displayName || p.name).toLowerCase().includes(query) || p.group.toLowerCase().includes(query));
    document.getElementById('unassignedCount').innerText = filteredUnassigned.length;

    document.getElementById('roomUnassignedPool').innerHTML = filteredUnassigned.map(item => {
        const dynColor = typeof getProjectColor === 'function' ? getProjectColor(item.group) : 'bg-zinc-100 dark:bg-zinc-800';
        return `<div class="dnd-room-draggable bg-white dark:bg-zinc-800 p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col gap-1" data-nric="${item.nric}">
            <div class="main-name-pill font-extrabold text-[10px] px-1.5 py-1 rounded border ${dynColor} w-full flex items-start justify-between gap-1"><span class="break-words whitespace-normal text-left flex-1">${item.displayName || item.name}</span></div>
        </div>`;
    }).join('') || '<p class="text-[10px] text-zinc-500 font-bold p-2 text-center mt-2">All assigned.</p>';

    let roomsToRender = activeRooms;
    if (query) roomsToRender = activeRooms.filter(r => r.name.toLowerCase().includes(query) || r.occupants.some(nric => { const p = globalLogistics.participants.find(x => x.nric === nric); return p && (p.displayName || p.name).toLowerCase().includes(query); }));

    document.getElementById('roomListContainer').innerHTML = roomsToRender.map(room => {
        const isFull = room.occupants.length >= room.capacity;
        let occHtml = room.occupants.map(nric => {
            const p = globalLogistics.participants.find(x => x.nric === nric);
            if(p) return `<div class="dnd-room-draggable relative flex w-full cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform pointer-events-auto" data-nric="${p.nric}"><div class="main-name-pill ${typeof getProjectColor === 'function' ? getProjectColor(p.group) : 'bg-zinc-100'} text-[10px] px-2 py-1.5 rounded shadow-sm border font-bold opacity-90 leading-tight w-full pr-5">${p.displayName || p.name}</div><div class="remove-x" onclick="unassignFromRoom('${p.nric}', '${room.id}')">×</div></div>`;
            return '';
        }).join('');

        return `<div class="dnd-room-dropzone flex flex-col bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm" data-room-id="${room.id}">
            <div class="flex justify-between items-center bg-zinc-50/80 dark:bg-zinc-900/50 p-2 border-b border-zinc-100 dark:border-zinc-700 rounded-t-xl gap-2 w-full">
                <span class="font-black text-[12px] text-zinc-900 dark:text-white break-words">${room.name} <span class="text-[9px] text-zinc-500 font-normal">(${room.occupants.length}/${room.capacity})</span></span>
                <div class="flex items-center gap-1 shrink-0">
                    <button onclick="openRoomAddSheet('${room.id}')" class="text-[9px] bg-blue-50 text-blue-600 border border-blue-200 font-bold px-1.5 py-0.5 rounded hover:bg-blue-100 transition focus:outline-none" ${isFull?'disabled style="opacity:0.5;"':''}>+ Add</button>
                    <button onclick="deleteRoom('${room.id}')" class="text-zinc-400 hover:text-red-500 p-0.5 bg-white dark:bg-zinc-800 border rounded shadow-sm">✕</button>
                </div>
            </div>
            <div class="p-1.5 min-h-[40px] flex flex-col pointer-events-auto bg-transparent gap-1.5 w-full">${occHtml || '<span class="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 text-center py-2 w-full">Drop here...</span>'}</div>
        </div>`;
    }).join('') || '<div class="text-center text-xs font-bold text-zinc-400 mt-5">No rooms found.</div>';
}

function openPairingSheet(sourceNric, sourceRole) {
    currentPairingTarget = sourceNric; currentPairingSourceRole = sourceRole; dndState.type = 'pairing';
    const sourcePerson = globalLogistics.participants.find(p => p.nric === sourceNric);
    document.getElementById('sheetTitle').innerHTML = `Pair with ${sourcePerson ? sourcePerson.displayName||sourcePerson.name : ''}`;
    document.getElementById('selectionBottomSheet').classList.remove('hidden-force');
    
    const targetRole = sourceRole === 'TRAINEE' ? 'VOLUNTEER' : 'TRAINEE';
    const targets = globalLogistics.participants.filter(p => p.role === targetRole);
    const activePairings = (globalLogistics.pairings || []).filter(p => (!p.status || p.status === 'ACTIVE'));

    document.getElementById('sheetListContainer').innerHTML = targets.map(t => {
        const isPaired = activePairings.some(p => (sourceRole === 'TRAINEE' ? p.volNric === t.nric && p.traineeNric === sourceNric : p.traineeNric === t.nric && p.volNric === sourceNric));
        if(isPaired) return ''; 
        return `<div onclick="confirmPairing('${t.nric}')" class="sheet-list-item flex flex-col bg-white dark:bg-zinc-800 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm cursor-pointer hover:border-primary transition mb-1.5" data-name="${(t.displayName||t.name).toLowerCase()}"><span class="font-extrabold text-[11px] ${typeof getProjectColor === 'function' ? getProjectColor(t.group) : 'bg-zinc-100'} px-1.5 py-0.5 rounded shadow-sm border">${t.displayName||t.name}</span></div>`;
    }).join('') || `<p class="text-[10px] font-bold text-zinc-400 p-2 text-center mt-2">No available options.</p>`;
}

function openRoomAddSheet(roomId) {
    activeRoomTargetId = roomId; dndState.type = 'rooming';
    document.getElementById('sheetTitle').innerHTML = `Add to Room`;
    document.getElementById('selectionBottomSheet').classList.remove('hidden-force');
    const allNricsInRooms = new Set();
    globalLogistics.rooms.forEach(r => { if(!r.isDeleted) r.occupants.forEach(n => allNricsInRooms.add(n)); });
    const unassignedArr = globalLogistics.participants.filter(p => !allNricsInRooms.has(p.nric));
    
    document.getElementById('sheetListContainer').innerHTML = unassignedArr.map(t => `<div onclick="confirmRoomAdd('${t.nric}')" class="sheet-list-item flex flex-col bg-white dark:bg-zinc-800 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm cursor-pointer hover:border-primary transition mb-1.5" data-name="${(t.displayName||t.name).toLowerCase()}"><span class="font-extrabold text-[11px] ${typeof getProjectColor === 'function' ? getProjectColor(t.group) : 'bg-zinc-100'} px-1.5 py-0.5 rounded shadow-sm border">${t.displayName||t.name}</span></div>`).join('') || `<p class="text-[10px] font-bold text-zinc-400 p-2 text-center mt-2">Everyone is assigned.</p>`;
}

function filterBottomSheet() {
    const q = document.getElementById('sheetSearchInput').value.toLowerCase();
    document.querySelectorAll('.sheet-list-item').forEach(item => { item.classList.toggle('hidden-force', !item.dataset.name.includes(q)); });
}

function confirmPairing(targetNric) {
    if(!currentPairingTarget) return; 
    closeSelectionSheet(); 
    handleDndDrop(currentPairingTarget, currentPairingSourceRole, targetNric);
}

function confirmRoomAdd(nric) {
    if(!activeRoomTargetId) return;
    handleRoomDrop(nric, activeRoomTargetId);
    const room = globalLogistics.rooms.find(r => r.id === activeRoomTargetId);
    if(room && room.occupants.length >= room.capacity) closeSelectionSheet(); else openRoomAddSheet(activeRoomTargetId); 
}

function closeSelectionSheet() { document.getElementById('selectionBottomSheet').classList.add('hidden-force'); activeRoomTargetId = null; }

async function manualSyncPairings(btn) {
    if (pendingPairingsMap.size > 0) await executePairingSync();
    setSyncButtonState('loading');
    try { 
        const res = await AppCore.apiFetch('fetchPairingsOnly'); 
        if(res && res.pairings) {
            res.pairings.forEach(sPair => {
                const key = sPair.traineeNric + '_' + sPair.volNric;
                if (!pendingPairingsMap.has(key)) {
                    let lPair = globalLogistics.pairings.find(p => p.traineeNric === sPair.traineeNric && p.volNric === sPair.volNric);
                    if (lPair) { if (sPair.ts > lPair.ts) { lPair.status = sPair.status; lPair.ts = sPair.ts; } } else { globalLogistics.pairings.push(sPair); }
                }
            });
            renderPairings();
        }
        setSyncButtonState('saved'); AppCore.showToast("Refreshed from server!"); 
    } catch(e) { setSyncButtonState('error'); } 
}

async function manualSyncRooms(btn) {
    if (pendingRoomUpdates.size > 0) await executeRoomSync();
    setRoomSyncButtonState('loading');
    try {
        const res = await AppCore.apiFetch('fetchRoomsOnly');
        if(res && res.rooms) {
            let hasChanges = false;
            res.rooms.forEach(sRoom => {
                if (!pendingRoomUpdates.has(sRoom.id)) {
                    let lRoom = globalLogistics.rooms.find(r => r.id === sRoom.id);
                    if (lRoom) { if (sRoom.ts > (lRoom.ts || 0)) { Object.assign(lRoom, sRoom); hasChanges = true; } } else { globalLogistics.rooms.push(sRoom); hasChanges = true; }
                }
            });
            if(hasChanges) renderRooms();
        }
        setRoomSyncButtonState('saved'); AppCore.showToast("Refreshed from server!");
    } catch (e) { setRoomSyncButtonState('error'); }
}