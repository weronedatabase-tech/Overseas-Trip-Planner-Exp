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

// Expose DND state globally to this module so polling logic can detect drag activity
let dndState = {
isDragging: false,
el: null,
clone: null,
startX: 0,
startY: 0,
nameNode: null,
rectWidth: 0,
rectHeight: 0,
type: 'pairing' // 'pairing' or 'rooming'
};

// ==========================================
// ROBUST DRAG & DROP ENGINE (Mouse + Touch)
// ==========================================
if (!window.dndInitialized) {
window.dndInitialized = true;

// --- TOUCH EVENTS (MOBILE) ---
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

// --- MOUSE EVENTS (DESKTOP) ---
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

// --- CORE LOGIC ---
function startDrag(e, clientX, clientY, isTouch) {
// Prevent interfering with buttons or scrollbars
if(e.target.closest('.remove-x') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;

let draggable = e.target.closest('.dnd-draggable');
let roomDraggable = e.target.closest('.dnd-room-draggable');

if(!draggable && !roomDraggable) return;

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

// If user hasn't triggered drag, check direction of movement
if (!dndState.isDragging) {
// Allow dragging into columns beside or below (for side-by-side rooming & pairing)
const threshold = 8;

if ((dndState.type === 'pairing' && deltaX > threshold && deltaX > deltaY) || (dndState.type === 'rooming' && (deltaX > threshold || deltaY > threshold))) {
    
    // For pairing mostly horizontal intent is required
    if (dndState.type === 'pairing' && deltaY > 8 && deltaY > deltaX) {
        dndState.el = null;
        return;
    }

    dndState.isDragging = true;
    
    if(isTouch && navigator.vibrate) navigator.vibrate(20);
    
    dndState.el.classList.add('locked-for-drag');
    
    // Generate visually identical clone
    dndState.clone = dndState.nameNode.cloneNode(true);
    dndState.clone.classList.add('dragging-clone');
    
    // Force size to exact bounding box constraints so centering works perfectly
    dndState.clone.style.width = dndState.rectWidth + 'px';
    dndState.clone.style.height = dndState.rectHeight + 'px';
    dndState.clone.style.margin = '0px';
    
    document.body.appendChild(dndState.clone);
} else if (dndState.type === 'pairing' && deltaY > 8) {
    dndState.el = null;
    return;
}
}

if (dndState.isDragging && dndState.clone) {
if(e.cancelable) e.preventDefault(); 

updateClonePosition(clientX, clientY);

// Highlight valid drop zones
const elAtPoint = document.elementFromPoint(clientX, clientY);

if (dndState.type === 'pairing') {
    const activeDz = elAtPoint ? elAtPoint.closest('.dnd-dropzone') : null;
    document.querySelectorAll('.dnd-dropzone').forEach(dz => {
        if (dz === activeDz && dz.dataset.role !== dndState.el.dataset.role) {
            dz.classList.add('border-primary', 'bg-blue-50', 'dark:bg-gray-800', 'dark:border-primary', 'ring-1', 'ring-primary');
        } else {
            dz.classList.remove('border-primary', 'bg-blue-50', 'dark:bg-gray-800', 'dark:border-primary', 'ring-1', 'ring-primary');
        }
    });
} else if (dndState.type === 'rooming') {
    const activeRoom = elAtPoint ? elAtPoint.closest('.dnd-room-dropzone') : null;
    document.querySelectorAll('.dnd-room-dropzone').forEach(dz => {
        if (dz === activeRoom) {
            dz.classList.add('border-primary', 'bg-blue-50', 'dark:bg-gray-800', 'dark:border-primary', 'ring-1', 'ring-primary');
        } else {
            dz.classList.remove('border-primary', 'bg-blue-50', 'dark:bg-gray-800', 'dark:border-primary', 'ring-1', 'ring-primary');
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

document.querySelectorAll('.dnd-dropzone, .dnd-room-dropzone').forEach(dz => dz.classList.remove('border-primary', 'bg-blue-50', 'dark:bg-gray-800', 'dark:border-primary', 'ring-1', 'ring-primary'));

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

renderPairings(); 
triggerPairingSync();
}

function setSyncButtonState(state) {
const btns = document.querySelectorAll('.btn-sync-pairings');
if(btns.length === 0) return;
btns.forEach(btn => {
const textSpan = btn.querySelector('.btn-text'); const spinner = btn.querySelector('.btn-spinner');
btn.className = "btn-sync-pairings text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
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
pairingSyncTimeout = setTimeout(() => {
executePairingSync();
}, 800); 
}

async function executePairingSync() {
if (pendingPairingsMap.size === 0) return;

isPairingSyncing = true;
setSyncButtonState('saving');

const batch = new Map(pendingPairingsMap);
const updates = Array.from(batch.values());
pendingPairingsMap.clear();

try {
const res = await callBackend('syncPairingUpdates', { updates: updates, takenBy: currentUser.name });

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
if(!logTab || logTab.classList.contains('hidden-force') || isPairingSyncing || (dndState.type === 'pairing' && (dndState.el || dndState.isDragging))) return;

try {
const res = await callBackend('fetchPairingsOnly');
if(res.pairings) {
   const server = res.pairings;
   let hasChanges = false;
   
   server.forEach(sPair => {
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
       if(!document.getElementById('selectionBottomSheet').classList.contains('hidden-force') && currentPairingTarget) {
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
const textSpan = btn.querySelector('.btn-text'); const spinner = btn.querySelector('.btn-spinner');
btn.className = "text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
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

const familyMap = {}; 
const pairingsMap = {}; 

globalLogistics.participants.forEach(p => {
if (p.pocNric) {
    if(!familyMap[p.pocNric]) familyMap[p.pocNric] = [];
    familyMap[p.pocNric].push(p.nric);
}
});

(globalLogistics.pairings || []).forEach(p => {
if(p.status === 'ACTIVE') {
    if(!pairingsMap[p.traineeNric]) pairingsMap[p.traineeNric] = [];
    pairingsMap[p.traineeNric].push(p.volNric);
}
});

const clusters = [];
const visited = new Set();

function buildCluster(startNric) {
const cluster = [];
const queue = [startNric];

while(queue.length > 0) {
    const curr = queue.shift();
    if(!visited.has(curr)) {
        visited.add(curr);
        cluster.push(curr);
        
        const pObj = globalLogistics.participants.find(x => x.nric === curr);
        if(pObj) {
            if(familyMap[pObj.pocNric]) {
                familyMap[pObj.pocNric].forEach(fam => {
                    if(!visited.has(fam)) queue.push(fam);
                });
            }
            if(pairingsMap[curr]) {
                pairingsMap[curr].forEach(vol => {
                    if(!visited.has(vol)) queue.push(vol);
                });
            }
            Object.keys(pairingsMap).forEach(tNric => {
                if(pairingsMap[tNric].includes(curr) && !visited.has(tNric)) {
                    queue.push(tNric);
                }
            });
        }
    }
}
return cluster;
}

globalLogistics.participants.forEach(p => {
if(!visited.has(p.nric)) {
    clusters.push(buildCluster(p.nric));
}
});

const roomAssignments = {}; 
const activeRooms = globalLogistics.rooms.filter(r => !r.isDeleted);

activeRooms.forEach(r => {
r.occupants.forEach(n => roomAssignments[n] = r.id);
});

function getGender(nrics) {
if (!nrics || nrics.length === 0) return 'Empty';
let hasM = false, hasF = false;
nrics.forEach(n => {
    const p = globalLogistics.participants.find(x => x.nric === n);
    if (p) {
        if (p.gender === 'Male') hasM = true;
        if (p.gender === 'Female') hasF = true;
    }
});
if (hasM && hasF) return 'Mixed';
if (hasM) return 'Male';
if (hasF) return 'Female';
return 'Unknown';
}

let placedCount = 0;

clusters.forEach(cluster => {
const unassigned = cluster.filter(n => !roomAssignments[n]);
if (unassigned.length === 0) return; // All assigned

const assigned = cluster.filter(n => roomAssignments[n]);

if (assigned.length > 0) {
    // Partially assigned cluster - Must be with family. If cannot fit EXACT same room, abort.
    const roomIds = [...new Set(assigned.map(n => roomAssignments[n]))];
    if (roomIds.length === 1) {
        const targetRoom = activeRooms.find(r => r.id === roomIds[0]);
        if (targetRoom && (targetRoom.capacity - targetRoom.occupants.length) >= unassigned.length) {
            unassigned.forEach(n => {
                targetRoom.occupants.push(n);
                roomAssignments[n] = targetRoom.id;
                placedCount++;
            });
            targetRoom.ts = Date.now();
            queueRoomUpdate(targetRoom.id);
        }
    }
} else {
    // Completely unassigned cluster. Fit if room matches gender natively.
    const clusterGender = getGender(unassigned);
    
    let roomToFit = activeRooms.find(r => {
        const available = r.capacity - r.occupants.length;
        if (available < unassigned.length) return false;
        
        const roomGender = getGender(r.occupants);
        if (roomGender === 'Empty') return true;
        if (clusterGender === 'Mixed' || roomGender === 'Mixed') return false; 
        return clusterGender === roomGender;
    });
    
    if (roomToFit) {
        unassigned.forEach(n => {
            roomToFit.occupants.push(n);
            roomAssignments[n] = roomToFit.id;
            placedCount++;
        });
        roomToFit.ts = Date.now();
        queueRoomUpdate(roomToFit.id);
    }
}
});

renderRooms();
if (placedCount > 0) {
showToast(`Auto-assigned ${placedCount} participants.`);
} else {
showToast("No clusters could be completely fitted based on strict family/gender rules.");
}
}

function handleRoomDrop(nric, targetRoomId) {
// Remove from all other rooms locally first
globalLogistics.rooms.forEach(r => {
if(!r.isDeleted && r.occupants.includes(nric)) {
    r.occupants = r.occupants.filter(n => n !== nric);
    r.ts = Date.now();
    queueRoomUpdate(r.id);
}
});

// Add to target room
const targetRoom = globalLogistics.rooms.find(r => r.id === targetRoomId);
if(targetRoom && !targetRoom.isDeleted) {
if(targetRoom.occupants.length >= targetRoom.capacity) {
    showToast("Room is full!", true);
    // Still try to render if we stripped them from another room
    renderRooms(); 
    return;
}
targetRoom.occupants.push(nric);
targetRoom.ts = Date.now();
queueRoomUpdate(targetRoom.id);
}

renderRooms();
}

function unassignFromRoom(nric, roomId) {
const room = globalLogistics.rooms.find(r => r.id === roomId);
if(room && !room.isDeleted) {
room.occupants = room.occupants.filter(n => n !== nric);
room.ts = Date.now();
queueRoomUpdate(roomId);
renderRooms();
}
}

function queueRoomUpdate(roomId) {
const room = globalLogistics.rooms.find(r => r.id === roomId);
if(room) {
pendingRoomUpdates.set(roomId, room);
setRoomSyncButtonState('saving');
if(roomSyncTimeout) clearTimeout(roomSyncTimeout);
roomSyncTimeout = setTimeout(() => { executeRoomSync(); }, 1500);
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
const res = await callBackend('syncRoomUpdates', { updates: updates, takenBy: currentUser.name });

if(res.rooms) {
    // Global Sweep Mutex logic
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
if(!logTab || logTab.classList.contains('hidden-force') || !roomSec || roomSec.classList.contains('hidden-force') || isRoomSyncing || (dndState.type === 'rooming' && (dndState.el || dndState.isDragging))) return;

try {
    const res = await callBackend('fetchRoomsOnly');
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
    const res = await callBackend('fetchRoomsOnly');
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
<div class="flex overflow-x-auto bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 scrollbar-hide shrink-0 rounded-t-xl md:rounded-none px-2 pt-1 z-10">
<button onclick="switchLogisticsSubTab('pairings')" id="subTab-pairings" class="px-3 py-2 font-semibold border-b-2 border-primary text-primary whitespace-nowrap text-xs md:text-sm transition focus:outline-none">1. Pairings</button>
<button onclick="switchLogisticsSubTab('rooms')" id="subTab-rooms" class="px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none">2. Rooms</button>
<button onclick="switchLogisticsSubTab('groups')" id="subTab-groups" class="px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none">3. Groups</button>
<button onclick="switchLogisticsSubTab('buses')" id="subTab-buses" class="px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none">4. Buses</button>
</div>

<!-- Drag & Drop Pairing UI -->
<div id="log-pairings" class="flex-1 flex flex-col min-h-0 w-full relative">
<div id="logLoadingOverlay" class="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-20 hidden-force flex flex-col justify-center items-center">
<div class="loader !w-8 !h-8 border-primary mb-2"></div>
<span class="text-primary dark:text-blue-400 font-bold text-[10px] tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading...</span>
</div>

<div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 md:p-3 shrink-0 z-10 flex flex-col gap-1 shadow-sm">
<div class="flex justify-between items-center px-1">
<div class="flex items-center gap-2">
 <h3 class="text-sm md:text-base font-black text-gray-900 dark:text-white tracking-tight">Pairings</h3>
 <button onclick="toggleAltSwap()" class="bg-gray-100 dark:bg-gray-800 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition focus:outline-none border border-gray-200 dark:border-gray-700 shadow-sm" title="Swap Columns">
    <svg class="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
 </button>
</div>
<button onclick="manualSyncPairings(this)" class="btn-sync-pairings text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
<span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
</button>
</div>
<p class="text-[9px] md:text-[10px] text-gray-500 dark:text-gray-400 px-1 leading-tight">Slide between columns to pair. Tap 'X' to unpair.</p>
</div>

<div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative bg-gray-50 dark:bg-gray-950 border-x border-b border-gray-200 dark:border-gray-800 rounded-b-xl md:rounded-none">
<div id="dnd-source-col" class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors border-r border-gray-200 dark:border-gray-800">
<h4 id="dnd-source-title" class="font-black text-[10px] py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b"></h4>
<div id="dnd-source-pool" class="space-y-1.5 flex-grow overflow-y-auto p-1.5 custom-scrollbar bg-opacity-50 pb-6"></div>
</div>
<div id="dnd-target-col" class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors">
<h4 id="dnd-target-title" class="font-black text-[10px] py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b"></h4>
<div id="dnd-target-list" class="space-y-1.5 flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6 bg-opacity-50"></div>
</div>
</div>
</div>

<!-- Drag & Drop Rooming UI -->
<div id="log-rooms" class="hidden-force flex-1 flex flex-col min-h-0 w-full relative">
<div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 md:p-3 shrink-0 z-10 flex flex-col gap-2 shadow-sm">
<div class="flex justify-between items-center px-1">
    <div class="flex flex-wrap items-center gap-1 md:gap-1.5">
        <h3 class="text-xs md:text-base font-black text-gray-900 dark:text-white tracking-tight mr-1 shrink-0">Room Assignments</h3>
        <button onclick="resetRoomAssignments()" class="bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 text-[9px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-orange-100 transition focus:outline-none flex items-center gap-0.5 md:gap-1" title="Clear all Assignments">
            <svg class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            <span class="whitespace-nowrap">Assignment</span>
        </button>
        <button onclick="deleteAllRooms()" class="bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 text-[9px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-red-100 transition focus:outline-none flex items-center gap-0.5 md:gap-1" title="Delete All Rooms">
            <svg class="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            <span class="whitespace-nowrap">Rooms</span>
        </button>
        <button onclick="autoAssignRooms()" class="bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 text-[9px] md:text-xs font-bold px-1.5 py-1 md:px-2 md:py-1.5 rounded shadow-sm hover:bg-blue-100 transition focus:outline-none whitespace-nowrap">Auto-Room</button>
        <button onclick="addRoom()" class="bg-gray-100 dark:bg-gray-800 p-1 md:p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition focus:outline-none border border-gray-200 dark:border-gray-700 shadow-sm shrink-0" title="Add Room(s)">
            <svg class="w-3 h-3 md:w-4 md:h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
        </button>
    </div>
    <button id="btn-sync-rooms" onclick="manualSyncRooms(this)" class="text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
      <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
    </button>
</div>
<div class="flex justify-between items-center px-1 gap-2 mt-1">
    <div class="relative w-full max-w-sm">
        <input type="text" id="roomSearchInput" oninput="renderRooms()" placeholder="Fuzzy search participants/rooms..." class="w-full p-1.5 pl-7 border border-gray-300 dark:border-gray-700 rounded text-[10px] font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition">
        <svg class="w-3.5 h-3.5 absolute left-2 top-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
    </div>
    <select id="roomFilterSelect" onchange="renderRooms()" class="text-[10px] font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1.5 outline-none shrink-0">
      <option value="ALL">All Roles</option>
      <option value="TRAINEE">Trainees</option>
      <option value="CAREGIVER">Caregivers</option>
      <option value="VOLUNTEER">Volunteers</option>
    </select>
</div>
</div>

<div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative bg-gray-50 dark:bg-gray-950 rounded-b-xl md:rounded-none">
<!-- Unassigned Pool -->
<div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden border-r border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-900/50">
<h4 class="font-black text-[10px] py-1.5 shrink-0 text-center uppercase tracking-widest bg-gray-200/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Unassigned (<span id="unassignedCount">0</span>)</h4>
<div id="roomUnassignedPool" class="space-y-1.5 flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6"></div>
</div>
<!-- Rooms Display -->
<div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
<div id="roomListContainer" class="flex-grow overflow-y-auto p-1.5 md:p-2 custom-scrollbar flex flex-col gap-2 md:gap-3 pb-6"></div>
</div>
</div>
</div>

<div id="log-groups" class="hidden-force flex-1 mt-2 w-full"><div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"><p class="text-sm text-gray-500 dark:text-gray-400">Group builder in development...</p></div></div>
<div id="log-buses" class="hidden-force flex-1 mt-2 w-full"><div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"><p class="text-sm text-gray-500 dark:text-gray-400">Bus Allocation in development...</p></div></div>
`;
}

function switchLogisticsSubTab(tabId) {['pairings', 'rooms', 'groups', 'buses'].forEach(id => { 
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
const res = await callBackend('fetchLogistics'); 
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

if (typeof renderAttendanceLists === "function" && document.getElementById('attAssignmentSelect')) {
renderAttendanceLists();
}

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

// ---------------------------------------------------------
// PAIRING RENDERERS
// ---------------------------------------------------------
function generatePillHtml(targetName, targetColorClass, traineeNric, volNric) {
return `<div class="relative flex w-full align-top pointer-events-auto">
<div class="${targetColorClass} text-[10px] md:text-[11px] pl-2 pr-6 py-1 rounded shadow-sm border border-gray-300 dark:border-gray-600 font-bold opacity-90 leading-tight break-words whitespace-normal text-left w-full">
${targetName}
</div>
<div class="remove-x" onclick="unpairTrainee('${traineeNric}', '${volNric}')">×</div>
</div>`;
}

function generateCardHtml(item, traineesWithCaregivers, activePairings, vols, trainees) {
const dynColor = getProjectColor(item.group);

const isFam = item.role === 'TRAINEE' && traineesWithCaregivers.has(String(item.name).trim().toLowerCase());
const famBadge = isFam ? `<span class="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-[8px] uppercase font-black tracking-wider px-1 py-0.5 rounded shrink-0 shadow-sm border border-purple-200 dark:border-purple-700 pointer-events-none whitespace-nowrap">FAM</span>` : '';

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
<div class="main-name-pill font-extrabold text-[11px] md:text-[12px] px-1.5 py-0.5 rounded shadow-sm border ${dynColor} max-w-full inline-flex flex-wrap items-center gap-1 self-start min-w-0 leading-[1.1]">
<span class="break-words whitespace-normal min-w-0 text-left">${displayName}</span>
${famBadge}
</div>
<button onclick="openPairingSheet('${item.nric}', '${item.role}')" class="text-[9px] md:text-[10px] bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-1 rounded border border-blue-200 dark:border-gray-600 hover:bg-blue-100 transition whitespace-nowrap focus:outline-none shrink-0 pointer-events-auto shadow-sm">${btnLabel}</button>
</div>
<div class="flex flex-col pointer-events-auto bg-gray-50/50 dark:bg-gray-900/50 p-1.5 rounded min-h-[36px] border border-dashed border-gray-200 dark:border-gray-700 mt-1 w-full gap-1.5">
${pairedPills || '<span class="text-[9px] md:text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 pointer-events-none text-center w-full py-1">Drop pair here</span>'}
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
traineesWithCaregivers.add(p.relatedTrainee.trim().toLowerCase());
}
});

const isSourceVol = !altSwapMode;
const sourceArr = isSourceVol ? vols : trainees;
const targetArr = isSourceVol ? trainees : vols;

const volColClass = "bg-green-50/30 dark:bg-green-900/10";
const traineeColClass = "bg-blue-50/30 dark:bg-blue-900/10";
const sourceColClass = isSourceVol ? volColClass : traineeColClass;
const targetColClass = isSourceVol ? traineeColClass : volColClass;

const volTitleClass = "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 border-b border-green-200 dark:border-green-800";
const traineeTitleClass = "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border-b border-blue-200 dark:border-blue-800";

const sourceCol = document.getElementById('dnd-source-col');
const targetCol = document.getElementById('dnd-target-col');
sourceCol.className = `flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors border-r border-gray-200 dark:border-gray-800 ${sourceColClass}`;
targetCol.className = `flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors ${targetColClass}`;

const sourceTitle = document.getElementById('dnd-source-title');
const targetTitle = document.getElementById('dnd-target-title');
sourceTitle.innerText = isSourceVol ? "Volunteers" : "Trainees";
targetTitle.innerText = isSourceVol ? "Trainees" : "Volunteers";
sourceTitle.className = `font-black text-[10px] py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b ${isSourceVol ? volTitleClass : traineeTitleClass}`;
targetTitle.className = `font-black text-[10px] py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b ${!isSourceVol ? volTitleClass : traineeTitleClass}`;

let sourceHtml = '';
sourceArr.forEach(item => { sourceHtml += generateCardHtml(item, traineesWithCaregivers, activePairings, vols, trainees); });
document.getElementById('dnd-source-pool').innerHTML = sourceHtml || '<p class="text-[10px] text-gray-500 font-bold p-2 text-center mt-2">No items.</p>';

let targetHtml = '';
targetArr.forEach(item => { targetHtml += generateCardHtml(item, traineesWithCaregivers, activePairings, vols, trainees); });
document.getElementById('dnd-target-list').innerHTML = targetHtml || '<p class="text-[10px] text-gray-500 font-bold p-2 text-center mt-2">No items.</p>';
}

// ---------------------------------------------------------
// ROOM RENDERERS
// ---------------------------------------------------------
function renderRooms() {
if(!globalLogistics || !document.getElementById('roomListContainer')) return;

const rFilter = document.getElementById('roomFilterSelect') ? document.getElementById('roomFilterSelect').value : 'ALL';
const query = document.getElementById('roomSearchInput') ? document.getElementById('roomSearchInput').value.toLowerCase().trim() : '';

const allNricsInRooms = new Set();
const activeRooms = (globalLogistics.rooms || []).filter(r => !r.isDeleted);
activeRooms.forEach(r => r.occupants.forEach(n => allNricsInRooms.add(n)));

const unassignedArr = globalLogistics.participants.filter(p => !allNricsInRooms.has(p.nric) && (rFilter === 'ALL' || p.role === rFilter));

// Filter unassigned pool based on search query
let filteredUnassigned = unassignedArr;
if (query) {
filteredUnassigned = unassignedArr.filter(p => {
    const dName = (p.displayName || p.name).toLowerCase();
    return dName.includes(query) || p.nric.toLowerCase().includes(query) || p.group.toLowerCase().includes(query);
});
}

document.getElementById('unassignedCount').innerText = filteredUnassigned.length;

let unHtml = '';
filteredUnassigned.forEach(item => {
const dynColor = getProjectColor(item.group);
const dName = item.displayName || item.name;
const roleColor = item.role === 'TRAINEE' ? 'text-blue-600 dark:text-blue-400' : (item.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400');
const roleShort = item.role.substring(0,3).toUpperCase();

const sleepingTooltip = item.sleeping ? `Request: ${item.sleeping.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}` : '';
const sleepingIndicator = item.sleeping ? `<button onclick="openSleepingModal('${item.nric}')" class="ml-1 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 pointer-events-auto transition-transform hover:scale-110 focus:outline-none shrink-0" title="${sleepingTooltip}"><svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg></button>` : '';

unHtml += `
<div class="dnd-room-draggable bg-white dark:bg-gray-800 p-1 md:p-1.5 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col gap-1" data-nric="${item.nric}" data-role="${item.role}">
    <div class="main-name-pill font-extrabold text-[10px] md:text-[11px] px-1.5 py-1 rounded shadow-sm border ${dynColor} w-full flex items-start justify-between gap-1">
        <span class="break-words whitespace-normal text-left flex-1">${dName}</span>
        ${sleepingIndicator}
    </div>
    <span class="text-[7px] md:text-[8px] font-black ${roleColor} bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded uppercase border border-gray-100 dark:border-gray-600 shrink-0 self-start w-max">${roleShort}</span>
</div>
`;
});
document.getElementById('roomUnassignedPool').innerHTML = unHtml || '<p class="text-[10px] text-gray-500 font-bold p-2 text-center mt-2">All assigned / No matches.</p>';

// Filter active rooms based on search query
let roomsToRender = activeRooms;
if (query) {
roomsToRender = activeRooms.filter(r => {
    if (r.name.toLowerCase().includes(query)) return true;
    return r.occupants.some(nric => {
        const p = globalLogistics.participants.find(x => x.nric === nric);
        if (!p) return false;
        const dName = (p.displayName || p.name).toLowerCase();
        return dName.includes(query) || p.nric.toLowerCase().includes(query) || p.group.toLowerCase().includes(query);
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
            isMatch = dName.toLowerCase().includes(query) || p.nric.toLowerCase().includes(query) || p.group.toLowerCase().includes(query);
        }
        const matchClass = isMatch ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-gray-800 scale-105 z-10' : '';
        
        const pSleepingTooltip = p.sleeping ? `Request: ${p.sleeping.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}` : '';
        const sleepingIndicator = p.sleeping ? `<button onclick="openSleepingModal('${p.nric}')" class="ml-1 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 pointer-events-auto transition-transform hover:scale-110 focus:outline-none shrink-0" title="${pSleepingTooltip}"><svg class="w-3 h-3 md:w-3.5 md:h-3.5 inline-block" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg></button>` : '';
        
        occHtml += `
        <div class="dnd-room-draggable relative flex w-full cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform pointer-events-auto" data-nric="${p.nric}">
            <div class="main-name-pill ${dynColor} ${matchClass} text-[10px] md:text-[11px] px-2 py-1.5 rounded shadow-sm border font-bold opacity-90 leading-tight flex items-start justify-between w-full pr-5 gap-1">
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
            <span class="text-[9px] bg-gray-200/50 dark:bg-gray-700/50 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 shrink-0 mt-0.5">${occDisplay}</span>
        </div>
        <div class="flex items-center gap-1 shrink-0 w-full lg:w-auto justify-end">
            <button onclick="openRoomAddSheet('${room.id}')" class="text-[9px] bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 font-bold px-1.5 py-0.5 rounded hover:bg-blue-100 transition focus:outline-none" ${isFull ? 'disabled style="opacity:0.5;"' : ''}>+ Add</button>
            <button onclick="promptEditRoom('${room.id}')" class="text-gray-400 hover:text-primary transition p-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
            <button onclick="deleteRoom('${room.id}')" class="text-gray-400 hover:text-red-500 transition p-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
        </div>
    </div>
    <div class="p-1.5 min-h-[40px] flex flex-col pointer-events-auto bg-transparent gap-1.5 w-full">
        ${occHtml || '<span class="text-[10px] font-medium text-gray-400 dark:text-gray-500 m-1 pointer-events-none text-center py-2 w-full">Drop here...</span>'}
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

// ---------------------------------------------------------
// BOTTOM SHEET (REUSABLE)
// ---------------------------------------------------------
function openPairingSheet(sourceNric, sourceRole = 'TRAINEE') {
currentPairingTarget = sourceNric; 
currentPairingSourceRole = sourceRole;
dndState.type = 'pairing';

const sourcePerson = globalLogistics.participants.find(p => p.nric === sourceNric);
let titleHtml = sourceRole === 'TRAINEE' ? "Select Volunteer" : "Select Trainee";

if (sourcePerson) {
const dynColor = getProjectColor(sourcePerson.group);
const dName = sourcePerson.displayName || sourcePerson.name;
titleHtml = `Pair with <span class="ml-1 font-bold text-[11px] md:text-xs px-1.5 py-0.5 rounded shadow-sm border ${dynColor}">${dName}</span>`;
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
const roleColor = t.role === 'VOLUNTEER' ? 'text-green-700 bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800' : 'text-blue-700 bg-blue-100 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800';
const dName = t.displayName || t.name;

html += `<div onclick="confirmPairing('${t.nric}')" class="sheet-list-item flex flex-col bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-pointer hover:border-primary transition mb-1.5" data-name="${dName.toLowerCase()}">
<div class="flex justify-between items-start w-full gap-2">
<span class="font-extrabold text-[11px] md:text-xs px-1.5 py-0.5 rounded shadow-sm border ${tDynColor} break-words whitespace-normal min-w-0 flex-1 text-left leading-[1.1]">${dName}</span>
<span class="text-[9px] font-black ${roleColor} border px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap uppercase tracking-wider">${roleLabel}</span>
</div>
</div>`;
});
document.getElementById('sheetListContainer').innerHTML = html || `<p class="text-[10px] font-bold text-gray-400 p-2 text-center mt-2">No available options.</p>`;
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
const roleColor = t.role === 'TRAINEE' ? 'text-blue-700 bg-blue-100 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800' : (t.role === 'CAREGIVER' ? 'text-purple-700 bg-purple-100 dark:bg-purple-900/50 border-purple-200 dark:border-purple-800' : 'text-green-700 bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800');
const dName = t.displayName || t.name;

html += `<div onclick="confirmRoomAdd('${t.nric}')" class="sheet-list-item flex flex-col bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-pointer hover:border-primary transition mb-1.5" data-name="${dName.toLowerCase()}">
<div class="flex justify-between items-start w-full gap-2">
<span class="font-extrabold text-[11px] md:text-xs px-1.5 py-0.5 rounded shadow-sm border ${tDynColor} break-words whitespace-normal min-w-0 flex-1 text-left leading-[1.1]">${dName}</span>
<span class="text-[9px] font-black ${roleColor} border px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap uppercase tracking-wider">${t.role.substring(0,3)}</span>
</div>
</div>`;
});
document.getElementById('sheetListContainer').innerHTML = html || `<p class="text-[10px] font-bold text-gray-400 p-2 text-center mt-2">Everyone is assigned.</p>`;
}

function filterBottomSheet() {
const query = document.getElementById('sheetSearchInput').value.toLowerCase();
const items = document.querySelectorAll('.sheet-list-item');
items.forEach(item => {
if (item.dataset.name.includes(query)) item.classList.remove('hidden-force');
else item.classList.add('hidden-force');
});
}

function confirmPairing(targetNric) {
if(!currentPairingTarget) return; 
closeSelectionSheet(); 
const traineeNric = currentPairingSourceRole === 'TRAINEE' ? currentPairingTarget : targetNric;
const volNric = currentPairingSourceRole === 'TRAINEE' ? targetNric : currentPairingTarget;
let existing = globalLogistics.pairings.find(p => p.traineeNric === traineeNric && p.volNric === volNric);

if(!existing || existing.status !== 'ACTIVE') {
const ts = Date.now();
const key = traineeNric + '_' + volNric;
pendingPairingsMap.set(key, { action: 'ADD', traineeNric, volNric, ts });

if(existing) { existing.status = 'ACTIVE'; existing.ts = ts; } 
else { globalLogistics.pairings.push({ traineeNric, volNric, status: 'ACTIVE', ts }); }

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
openRoomAddSheet(activeRoomTargetId); 
}
}

async function manualSyncPairings(btn) {
if (pendingPairingsMap.size > 0) await executePairingSync();
setSyncButtonState('loading');
try { 
const res = await callBackend('fetchPairingsOnly'); 
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

function closeSelectionSheet() { document.getElementById('selectionBottomSheet').classList.add('hidden-force'); activeRoomTargetId = null; }