let attendanceState = {};
let attSearchMode = 'single'; 
let pendingAttendanceUpdates = new Set();
let attSyncTimeout = null;
let isAttendanceSyncing = false;
let attendancePollInterval = null;

let savedAttJuncture = null;
let savedAttAssignment = 'ALL';

function buildAttendanceUI() {
const el_tab_attendance = document.getElementById('tab-attendance'); if(el_tab_attendance) el_tab_attendance.innerHTML = `
<div class="admin-only flex flex-col h-full min-h-0 w-full relative">

<div class="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700 p-1.5 md:p-2 shrink-0 flex flex-col gap-1.5 shadow-md rounded-t-xl md:rounded-none">
  <div class="flex justify-between items-center gap-2 w-full">
     <h3 class="text-xs md:text-sm font-black text-gray-900 dark:text-white tracking-tight shrink-0">Live Attendance</h3>
     
     <div class="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded border border-gray-300 dark:border-gray-600 shrink-0 ml-auto">
         <button id="btn-mode-single" onclick="setAttSearchMode('single')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider">Indiv</button>
         <button id="btn-mode-multi" onclick="setAttSearchMode('multi')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider">Family</button>
     </div>

     <button id="btn-sync-attendance" onclick="manualSyncAttendance()" class="text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-md bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
        <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
     </button>
  </div>
  
  <div class="grid grid-cols-2 md:grid-cols-4 gap-1.5">
     <div class="flex gap-1">
         <select id="attJunctureSelect" onchange="changeAttendanceContext()" class="w-full p-1 border-2 border-gray-300 dark:border-gray-700 rounded-md font-bold text-[11px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm appearance-none truncate"></select>
         <button onclick="promptNewJuncture()" class="p-1 bg-green-50 text-green-600 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 rounded-md shadow-sm hover:bg-green-100 transition focus:outline-none shrink-0" title="Add Juncture">
             <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
         </button>
     </div>
     <select id="attAssignmentSelect" onchange="renderAttendanceLists()" class="w-full p-1 border-2 border-gray-300 dark:border-gray-700 rounded-md font-bold text-[11px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm appearance-none truncate">
        <option value="ALL">All Participants</option>
     </select>
     
     <div class="relative col-span-2">
         <input type="text" id="attSearchInput" oninput="handleAttendanceSearch()" placeholder="Search to mark present..." class="w-full p-1 pl-7 pr-7 border-2 border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 font-bold text-[11px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 dark:text-white shadow-sm transition">
         <svg class="w-3 h-3 absolute left-2.5 top-[7px] text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
         <button onclick="clearSearch('attSearchInput', 'handleAttendanceSearch')" class="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
     </div>
  </div>
</div>

<div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative bg-gray-50 dark:bg-gray-950 rounded-b-xl md:rounded-none border-x border-b-2 border-gray-200 dark:border-gray-700">
  
  <div id="attLoadingOverlay" class="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-10 hidden-force flex flex-col justify-center items-center">
      <div class="loader !w-8 !h-8 border-primary mb-2"></div>
      <span class="text-primary dark:text-green-400 font-bold text-xs tracking-wide shadow-md bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading...</span>
  </div>
  
  <div class="flex-1 min-w-0 flex flex-col border-r-2 border-gray-200 dark:border-gray-700 bg-red-50/30 dark:bg-red-900/10">
     <h4 class="font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b-2 border-red-200 dark:border-red-800">Not Checked (<span id="attNotCheckedCount">0</span>)</h4>
     <div id="attNotCheckedList" class="flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6 space-y-1.5"></div>
  </div>
  
  <div class="flex-1 min-w-0 flex flex-col bg-green-50/30 dark:bg-green-900/10">
     <h4 class="font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b-2 border-green-200 dark:border-green-800">Checked (<span id="attCheckedCount">0</span>)</h4>
     <div id="attCheckedList" class="flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6 space-y-1.5"></div>
  </div>
  
</div>

</div>`;


}

async function promptNewJuncture() {
  const name = prompt("Enter new juncture name (e.g. Day 2: Morning):");
  if(!name || !name.trim()) return;
  
  const overlay = document.getElementById('attLoadingOverlay');
  if (overlay) overlay.classList.remove('hidden-force');
  setAttSyncButtonState('loading');
  
  try {
      const res = await apiCall('modifyJunctures', { actionType: 'add', newName: name.trim() });
      appSettings.junctures = res.junctures;
      
      const juncSel = document.getElementById('attJunctureSelect');
      if (juncSel) juncSel.innerHTML = '';
      appSettings.junctures.forEach(j => juncSel.innerHTML += `<option value="${j}">${j}</option>`);
      
      juncSel.value = name.trim();
      savedAttJuncture = name.trim();
      
      showToast("Juncture added.");
      await changeAttendanceContext();
  } catch(e) {
      showToast(e.message, true);
      setAttSyncButtonState('error');
  } finally {
      if (overlay) overlay.classList.add('hidden-force');
  }
}

async function renderAttendanceChecklist() {
if(!document.getElementById('attJunctureSelect')) return;

const juncSel = document.getElementById('attJunctureSelect');
if (juncSel) juncSel.innerHTML = '';
if(appSettings.junctures && appSettings.junctures.length > 0) {
  appSettings.junctures.forEach(j => juncSel.innerHTML += `<option value="${j}">${j}</option>`);
} else {
  if (juncSel) juncSel.innerHTML = `<option value="">No Junctures Defined</option>`;
}

if(savedAttJuncture && appSettings.junctures && appSettings.junctures.includes(savedAttJuncture)) {
  juncSel.value = savedAttJuncture;
}

// Pre-fetch global logistics if null
if(!globalLogistics) {
    try {
        const res = await apiCall('fetchLogistics'); 
        globalLogistics = res;
        if (typeof processDisplayNames === "function") processDisplayNames(globalLogistics.participants);
        if (typeof applyGlobalSorting === "function") globalLogistics.participants = applyGlobalSorting(globalLogistics.participants);
    } catch(e) {}
}

const asgnSel = document.getElementById('attAssignmentSelect');
if (asgnSel) asgnSel.innerHTML = `<option value="ALL">All Participants</option>`;

// Populate Projects
if(appSettings.activeProjects && appSettings.activeProjects.length > 0) {
    const projGroup = document.createElement('optgroup');
    projGroup.label = 'Projects';
    appSettings.activeProjects.forEach(g => {
        projGroup.innerHTML += `<option value="PROJ::${g}">${g}</option>`;
    });
    asgnSel.appendChild(projGroup);
}

// Populate Logistics Groups and Buses
if (globalLogistics && globalLogistics.participants) {
    const groups = new Set();
    const buses = new Set();
    globalLogistics.participants.forEach(p => {
        if (p.logisticsGroup && p.logisticsGroup.trim()) groups.add(p.logisticsGroup.trim());
        if (p.bus && p.bus.trim()) buses.add(p.bus.trim());
    });
    
    if (groups.size > 0) {
        const grpGroup = document.createElement('optgroup');
        grpGroup.label = 'Groups';
        Array.from(groups).sort().forEach(g => {
            grpGroup.innerHTML += `<option value="GRP::${g}">${g}</option>`;
        });
        asgnSel.appendChild(grpGroup);
    }
    
    if (buses.size > 0) {
        const busGroup = document.createElement('optgroup');
        busGroup.label = 'Buses';
        Array.from(buses).sort().forEach(b => {
            busGroup.innerHTML += `<option value="BUS::${b}">${b}</option>`;
        });
        asgnSel.appendChild(busGroup);
    }
}

if(savedAttAssignment) {
    // Need to handle legacy savedAttAssignment (without prefix)
    let finalValue = savedAttAssignment;
    if (savedAttAssignment !== 'ALL' && !savedAttAssignment.includes('::')) {
        finalValue = 'PROJ::' + savedAttAssignment;
    }
    
    // Check if the option exists
    if (asgnSel.querySelector(`option[value="${finalValue}"]`)) {
        asgnSel.value = finalValue;
    }
}

await changeAttendanceContext();
}

async function changeAttendanceContext() {
const juncture = document.getElementById('attJunctureSelect').value;
savedAttJuncture = juncture;

if(!juncture) {
  attendanceState = {};
  renderAttendanceLists();
  return;
}

const overlay = document.getElementById('attLoadingOverlay');
if (overlay) overlay.classList.remove('hidden-force');
setAttSyncButtonState('loading');

try {
  const res = await apiCall('fetchAttendanceData', { juncture });
  attendanceState = res.data || {}; 
  renderAttendanceLists();
  setAttSyncButtonState('saved');
  startAttendancePolling();
} catch(e) {
  showToast("Failed to load attendance", true);
  setAttSyncButtonState('error');
} finally {
  if (overlay) overlay.classList.add('hidden-force');
}
}

function renderAttendanceLists() {
const assignmentEl = document.getElementById('attAssignmentSelect');
if(assignmentEl) {
  savedAttAssignment = assignmentEl.value;
}
const assignment = savedAttAssignment;

const notCheckedList = document.getElementById('attNotCheckedList');
const checkedList = document.getElementById('attCheckedList');

if(!notCheckedList || !checkedList) return;

if(!globalLogistics) {
  if (notCheckedList) notCheckedList.innerHTML = '<div class="flex justify-center p-6"><div class="loader !w-6 !h-6 border-gray-400"></div></div>';
  if (checkedList) checkedList.innerHTML = '<div class="flex justify-center p-6"><div class="loader !w-6 !h-6 border-gray-400"></div></div>';
  document.getElementById('attNotCheckedCount').textContent = '0';
  document.getElementById('attCheckedCount').textContent = '0';
  return;
}

let notCheckedHtml = '';
let checkedHtml = '';
let notCheckedCount = 0;
let checkedCount = 0;

const participants = globalLogistics.participants.filter(p => {
    let matchAssignment = false;
    if (assignment === 'ALL') matchAssignment = true;
    else if (assignment.startsWith('PROJ::')) matchAssignment = (p.group === assignment.split('::')[1]);
    else if (assignment.startsWith('GRP::')) matchAssignment = (p.logisticsGroup === assignment.split('::')[1]);
    else if (assignment.startsWith('BUS::')) matchAssignment = (p.bus === assignment.split('::')[1]);
    else matchAssignment = (p.group === assignment);
    
    if (!matchAssignment) return false;
    
    const searchInput = document.getElementById('attSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (query) {
        const dName = p.displayName || p.name || '';
        const fullName = p.name || '';
        let tName = '';
        if (p.role === 'CAREGIVER') {
            const myPoc = p.pocNric || p.nric;
            const trainee = globalLogistics.participants.find(x => x.role === 'TRAINEE' && (x.pocNric || x.nric) === myPoc);
            if (trainee) {
                tName = trainee.shortName || trainee.name || '';
            } else if (p.relatedTrainee) {
                tName = p.relatedTrainee;
            }
        }
        if (!dName.toLowerCase().includes(query) && !fullName.toLowerCase().includes(query) && !tName.toLowerCase().includes(query)) return false;
    }
    return true;
});

participants.forEach(p => {
  const stateObj = attendanceState[p.nric];
  const isChecked = stateObj ? stateObj.status : false;
  const cardHtml = generateAttCard(p, isChecked);

  if(isChecked) {
     checkedHtml += cardHtml;
     checkedCount++;
  } else {
     notCheckedHtml += cardHtml;
     notCheckedCount++;
  }
});

if (notCheckedList) notCheckedList.innerHTML = notCheckedHtml || '<p class="text-xs text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';
if (checkedList) checkedList.innerHTML = checkedHtml || '<p class="text-xs text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';

document.getElementById('attNotCheckedCount').textContent = notCheckedCount;
document.getElementById('attCheckedCount').textContent = checkedCount;
}

let attLongPressTimer = null;
let attLongPressFired = false;

window.startAttLongPress = function(nric, event) {
    attLongPressFired = false;
    if (event.type === 'mousedown' && event.button !== 0) return;
    
    attLongPressTimer = setTimeout(() => {
        attLongPressFired = true;
        if (typeof showParticipantSummaryModal === 'function') {
            showParticipantSummaryModal(nric);
        }
    }, 600); // 600ms for long press
};

window.cancelAttLongPress = function(event) {
    if (attLongPressTimer) {
        clearTimeout(attLongPressTimer);
        attLongPressTimer = null;
    }
};

window.handleAttClick = function(nric, isChecked, event) {
    if (attLongPressFired) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    toggleAttendanceStatus(nric, !isChecked);
};

function generateAttCard(p, isChecked) {
const dynColor = getProjectColor(p.group);
const roleColor = p.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (p.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
const roleShort = p.role.substring(0,3).toUpperCase();
const dName = p.displayName || p.name;

let relatedTraineeHtml = '';
if (p.role === 'CAREGIVER') {
    let tName = '';
    if (globalLogistics && globalLogistics.participants) {
        const myPoc = p.pocNric || p.nric;
        const trainee = globalLogistics.participants.find(x => x.role === 'TRAINEE' && (x.pocNric || x.nric) === myPoc);
        if (trainee) {
            tName = trainee.shortName || trainee.name;
        } else if (p.relatedTrainee) {
            tName = p.relatedTrainee;
        }
    }
    if (tName) {
        relatedTraineeHtml = `<div class="mt-1 font-bold text-purple-600 dark:text-purple-400 text-xs leading-tight max-w-full break-words whitespace-normal" style="overflow-wrap: break-word;">[${tName.toUpperCase()}]</div>`;
    }
}

return `
<div id="att-card-${p.nric}" class="relative bg-white dark:bg-gray-800 p-1.5 md:p-2 rounded border-2 border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-300 flex items-center justify-between gap-1 select-none active:scale-95 cursor-pointer hover:border-primary dark:hover:border-primary" 
  onpointerdown="startAttLongPress('${p.nric}', event)" 
  onpointerup="cancelAttLongPress(event)" 
  onpointerleave="cancelAttLongPress(event)" 
  onpointercancel="cancelAttLongPress(event)"
  oncontextmenu="if(attLongPressFired) { event.preventDefault(); return false; }"
  onclick="handleAttClick('${p.nric}', ${isChecked}, event)">
  <div class="flex items-start min-w-0 flex-1">
      <div class="flex flex-col min-w-0 flex-1 gap-1">
          <span class="font-extrabold text-sm md:text-[12px] px-1.5 py-0.5 rounded shadow-md border ${dynColor} max-w-full break-words whitespace-normal leading-[1.1] text-left inline-block self-start" style="overflow-wrap: break-word;">${dName}</span>
          ${relatedTraineeHtml}
          <span class="text-[10px] font-black ${roleColor} w-max bg-gray-50 dark:bg-gray-700 px-1 py-0.5 rounded uppercase tracking-wider border-2 border-gray-100 dark:border-gray-600 mt-0.5">${roleShort}</span>
      </div>
  </div>
  <div class="shrink-0 flex items-center justify-center pl-1">
     <div class="w-5 h-5 rounded flex items-center justify-center border transition-colors ${isChecked ? 'bg-green-500 border-green-600 text-white shadow-inner' : 'bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-transparent'}">
         <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
     </div>
  </div>
</div>`;
}

function handleAttendanceSearch() {
  renderAttendanceLists();
}

function toggleAttendanceStatus(nric, forceState) {
attendanceState[nric] = { status: forceState, ts: Date.now() }; 
pendingAttendanceUpdates.add(nric);

const searchInput = document.getElementById('attSearchInput');
const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

if (query) {
    if (attSearchMode === 'single') {
        searchInput.value = '';
    } else {
        // Multi (Family) mode
        const assignment = document.getElementById('attAssignmentSelect').value;
        const matchedParticipants = globalLogistics.participants.filter(p => {
            let matchAssignment = false;
            if (assignment === 'ALL') matchAssignment = true;
            else if (assignment.startsWith('PROJ::')) matchAssignment = (p.group === assignment.split('::')[1]);
            else if (assignment.startsWith('GRP::')) matchAssignment = (p.logisticsGroup === assignment.split('::')[1]);
            else if (assignment.startsWith('BUS::')) matchAssignment = (p.bus === assignment.split('::')[1]);
            else matchAssignment = (p.group === assignment);
            
            if (!matchAssignment) return false;
            
            const dName = p.displayName || p.name || '';
            const fullName = p.name || '';
            let tName = '';
            if (p.role === 'CAREGIVER') {
                const myPoc = p.pocNric || p.nric;
                const trainee = globalLogistics.participants.find(x => x.role === 'TRAINEE' && (x.pocNric || x.nric) === myPoc);
                if (trainee) tName = trainee.shortName || trainee.name || '';
                else if (p.relatedTrainee) tName = p.relatedTrainee;
            }
            
            return dName.toLowerCase().includes(query) || fullName.toLowerCase().includes(query) || tName.toLowerCase().includes(query);
        });

        if (matchedParticipants.length > 0) {
            const firstState = attendanceState[matchedParticipants[0].nric]?.status || false;
            const allSame = matchedParticipants.every(p => {
                const state = attendanceState[p.nric]?.status || false;
                return state === firstState;
            });
            
            if (allSame) {
                searchInput.value = '';
            }
        }
    }
}

renderAttendanceLists();

if (attSyncTimeout) clearTimeout(attSyncTimeout);
attSyncTimeout = setTimeout(() => { executeAttendanceSync(); }, 800);

triggerPulseFeedback(nric, forceState);
}

function triggerPulseFeedback(nric, isChecked) {
setTimeout(() => {
  const card = document.getElementById(`att-card-${nric}`);
  if(card) {
     card.scrollIntoView({ behavior: 'smooth', block: 'center' });
     const ringColor = isChecked ? 'ring-green-400' : 'ring-red-400';
     const bgColor = isChecked ? 'bg-green-50' : 'bg-red-50';
     const darkBgColor = isChecked ? 'dark:bg-green-900/50' : 'dark:bg-red-900/50';
     
     card.classList.add('ring-2', ringColor, 'scale-[1.02]', bgColor, darkBgColor, 'z-10');
     setTimeout(() => {
         card.classList.remove('ring-2', ringColor, 'scale-[1.02]', bgColor, darkBgColor, 'z-10');
     }, 800);
  }
}, 50);
}

async function executeAttendanceSync() {
if(pendingAttendanceUpdates.size === 0) return;

const juncture = document.getElementById('attJunctureSelect').value;
if(!juncture) return;

isAttendanceSyncing = true;
setAttSyncButtonState('saving');

const batch = new Set(pendingAttendanceUpdates);
pendingAttendanceUpdates.clear();

const updates = Array.from(batch).map(nric => ({
  nric: nric,
  status: attendanceState[nric]?.status || false,
  ts: attendanceState[nric]?.ts || Date.now()
}));

try {
  await apiCall('syncAttendanceUpdate', { juncture: juncture, updates: updates, takenBy: currentUser.name });
  setAttSyncButtonState('saved');
} catch(e) {
  showToast("Sync failed. Retrying...", true);
  setAttSyncButtonState('error');
  batch.forEach(nric => pendingAttendanceUpdates.add(nric));
} finally {
  isAttendanceSyncing = false;
}
}

async function manualSyncAttendance() {
if(pendingAttendanceUpdates.size > 0) {
    await executeAttendanceSync();
}
setAttSyncButtonState('loading');
try {
    const juncture = document.getElementById('attJunctureSelect').value;
    if(juncture) {
        const res = await apiCall('fetchAttendanceData', { juncture });
        const remoteData = res.data || {};
        
        globalLogistics.participants.forEach(p => {
            const rEntry = remoteData[p.nric] || { status: false, ts: 0 };
            const lEntry = attendanceState[p.nric] || { status: false, ts: 0 };
            if(rEntry.ts > lEntry.ts && !pendingAttendanceUpdates.has(p.nric)) {
                attendanceState[p.nric] = { status: rEntry.status, ts: rEntry.ts };
            }
        });
        renderAttendanceLists();
    }
    setAttSyncButtonState('saved');
    showToast("Refreshed from server!");
} catch(e) {
    setAttSyncButtonState('error');
    showToast("Sync failed.", true);
}
}

function startAttendancePolling() {
if(attendancePollInterval) clearInterval(attendancePollInterval);

attendancePollInterval = setInterval(async () => {
  const attTab = document.getElementById('tab-attendance');
  if(!attTab || attTab.classList.contains('hidden-force') || isAttendanceSyncing || pendingAttendanceUpdates.size > 0) return;

  const juncture = document.getElementById('attJunctureSelect').value;
  if(!juncture) return;

  const fetchStartTime = Date.now();

  try {
     const res = await apiCall('fetchAttendanceData', { juncture });
     if (lastLocalChange > fetchStartTime) return; 

     const remoteData = res.data || {};
     let hasChanges = false;
     
     globalLogistics.participants.forEach(p => {
         const rEntry = remoteData[p.nric] || { status: false, ts: 0 };
         const lEntry = attendanceState[p.nric] || { status: false, ts: 0 };
         
         if(rEntry.ts > lEntry.ts && !pendingAttendanceUpdates.has(p.nric)) {
             attendanceState[p.nric] = { status: rEntry.status, ts: rEntry.ts };
             hasChanges = true;
         }
     });

     if(hasChanges) {
         renderAttendanceLists();
     }
  } catch(e) { }
}, 8000);
}

function setAttSyncButtonState(state) {
const btn = document.getElementById('btn-sync-attendance');
if(!btn) return;

const textSpan = btn.querySelector('.btn-text'); 
const spinner = btn.querySelector('.btn-spinner');

btn.className = "text-xs md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-md focus:outline-none shrink-0"; 
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
  textSpan.textContent = "Error"; 
}
}
function setAttSearchMode(mode) {
    attSearchMode = mode;
    const btnSingle = document.getElementById('btn-mode-single');
    const btnMulti = document.getElementById('btn-mode-multi');
    if(btnSingle && btnMulti) {
        if(mode === 'single') {
            btnSingle.className = "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider";
            btnMulti.className = "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider";
        } else {
            btnMulti.className = "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider";
            btnSingle.className = "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider";
        }
    }
}
