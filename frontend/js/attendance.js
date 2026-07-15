let attendanceState = {}; // Now stores objects: { status: boolean, ts: number }
let pendingAttendanceUpdates = new Set();
let attSyncTimeout = null;
let isAttendanceSyncing = false;
let attendancePollInterval = null;

// State persistence variables for UX
let savedAttJuncture = null;
let savedAttAssignment = 'ALL';

function buildAttendanceUI() {
document.getElementById('tab-attendance').innerHTML = `
<div class="admin-only flex flex-col h-full min-h-0 w-full relative">

<!-- Tighter Header & Controls Array (No nested outer padding, flush to container) -->
<div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 md:p-3 shrink-0 z-10 flex flex-col gap-2 shadow-sm rounded-t-xl md:rounded-none">
   <div class="flex justify-between items-center">
      <h3 class="text-sm md:text-base font-black text-gray-900 dark:text-white tracking-tight">Live Attendance</h3>
      <button id="btn-sync-attendance" onclick="manualSyncAttendance()" class="text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
         <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
      </button>
   </div>
   
   <div class="grid grid-cols-2 gap-2">
      <div class="flex gap-1">
          <select id="attJunctureSelect" onchange="changeAttendanceContext()" class="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-md font-bold text-xs bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm appearance-none truncate"></select>
          <button onclick="promptNewJuncture()" class="p-1.5 bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 rounded-md shadow-sm hover:bg-blue-100 transition focus:outline-none shrink-0" title="Add Juncture">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
          </button>
      </div>
      <select id="attAssignmentSelect" onchange="renderAttendanceLists()" class="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-md font-bold text-xs bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm appearance-none truncate">
         <option value="ALL">All Participants</option>
      </select>
   </div>
   
   <div class="relative">
      <input type="text" id="attSearchInput" oninput="handleAttendanceSearch()" placeholder="Search to mark present..." class="w-full p-1.5 pl-8 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 font-bold text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 dark:text-white shadow-sm transition">
      <svg class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      <ul id="attSearchResults" class="absolute z-20 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-2xl mt-1 max-h-56 overflow-y-auto hidden-force custom-scrollbar"></ul>
   </div>
</div>

<!-- Flush List Columns -->
<div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative bg-gray-50 dark:bg-gray-950 rounded-b-xl md:rounded-none border-x border-b border-gray-200 dark:border-gray-800">
   
   <!-- Loading Overlay -->
   <div id="attLoadingOverlay" class="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-10 hidden-force flex flex-col justify-center items-center">
       <div class="loader !w-8 !h-8 border-primary mb-2"></div>
       <span class="text-primary dark:text-blue-400 font-bold text-[10px] tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading...</span>
   </div>
   
   <!-- NOT Checked (Red) -->
   <div class="flex-1 min-w-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-red-50/30 dark:bg-red-900/10">
      <h4 class="font-black text-[10px] py-1.5 shrink-0 text-center uppercase tracking-widest bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-red-200 dark:border-red-800">Not Checked (<span id="attNotCheckedCount">0</span>)</h4>
      <div id="attNotCheckedList" class="flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6 space-y-1.5"></div>
   </div>
   
   <!-- Checked (Green) -->
   <div class="flex-1 min-w-0 flex flex-col bg-green-50/30 dark:bg-green-900/10">
      <h4 class="font-black text-[10px] py-1.5 shrink-0 text-center uppercase tracking-widest bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-green-200 dark:border-green-800">Checked (<span id="attCheckedCount">0</span>)</h4>
      <div id="attCheckedList" class="flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6 space-y-1.5"></div>
   </div>
   
</div>

</div>`;

// Close search results if clicked outside
document.addEventListener('click', (e) => {
const results = document.getElementById('attSearchResults');
const input = document.getElementById('attSearchInput');
if(results && !results.classList.contains('hidden-force') && e.target !== input && !results.contains(e.target)) {
    results.classList.add('hidden-force');
}
});
}

async function promptNewJuncture() {
   const name = prompt("Enter new juncture name (e.g. Day 2: Morning):");
   if(!name || !name.trim()) return;
   
   const overlay = document.getElementById('attLoadingOverlay');
   if (overlay) overlay.classList.remove('hidden-force');
   setAttSyncButtonState('loading');
   
   try {
       const res = await callBackend('modifyJunctures', { actionType: 'add', newName: name.trim() });
       appSettings.junctures = res.junctures;
       
       // Re-render select
       const juncSel = document.getElementById('attJunctureSelect');
       juncSel.innerHTML = '';
       appSettings.junctures.forEach(j => juncSel.innerHTML += `<option value="${j}">${j}</option>`);
       
       // Select the new one
       juncSel.value = name.trim();
       savedAttJuncture = name.trim();
       
       showToast("Juncture added.");
       await changeAttendanceContext();
       
       // Also re-render settings list if it happens to be in DOM (not strictly necessary but good)
       if(typeof renderJunctureList === "function" && document.getElementById('junctureList')) {
           renderJunctureList(appSettings.junctures);
       }
   } catch(e) {
       showToast(e.message, true);
       setAttSyncButtonState('error');
   } finally {
       if (overlay) overlay.classList.add('hidden-force');
   }
}

async function renderAttendanceChecklist() {
if(!document.getElementById('attJunctureSelect')) return;

// 1. Populate Junctures immediately from settings
const juncSel = document.getElementById('attJunctureSelect');
juncSel.innerHTML = '';
if(appSettings.junctures && appSettings.junctures.length > 0) {
appSettings.junctures.forEach(j => juncSel.innerHTML += `<option value="${j}">${j}</option>`);
} else {
juncSel.innerHTML = `<option value="">No Junctures Defined</option>`;
}

// Restore saved juncture if it exists
if(savedAttJuncture && appSettings.junctures && appSettings.junctures.includes(savedAttJuncture)) {
juncSel.value = savedAttJuncture;
}

// 2. Populate Assignments immediately from settings
const asgnSel = document.getElementById('attAssignmentSelect');
asgnSel.innerHTML = `<option value="ALL">All Participants</option>`;
if(appSettings.activeProjects && appSettings.activeProjects.length > 0) {
appSettings.activeProjects.forEach(g => asgnSel.innerHTML += `<option value="${g}">${g}</option>`);
}

// Restore saved assignment if valid
if(savedAttAssignment && (savedAttAssignment === 'ALL' || (appSettings.activeProjects && appSettings.activeProjects.includes(savedAttAssignment)))) {
asgnSel.value = savedAttAssignment;
}

// 3. Trigger network sync for the newly populated context
await changeAttendanceContext();
}

async function changeAttendanceContext() {
const juncture = document.getElementById('attJunctureSelect').value;
savedAttJuncture = juncture; // Persist state

if(!juncture) {
attendanceState = {};
renderAttendanceLists();
return;
}

const overlay = document.getElementById('attLoadingOverlay');
if (overlay) overlay.classList.remove('hidden-force');
setAttSyncButtonState('loading');

try {
const res = await callBackend('fetchAttendanceData', { juncture });
attendanceState = res.data || {}; // Now stores `{ status, ts }`
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
// Capture and persist assignment state
const assignmentEl = document.getElementById('attAssignmentSelect');
if(assignmentEl) {
savedAttAssignment = assignmentEl.value;
}
const assignment = savedAttAssignment;

const notCheckedList = document.getElementById('attNotCheckedList');
const checkedList = document.getElementById('attCheckedList');

if(!notCheckedList || !checkedList) return;

// If lists aren't ready yet, show loader and bail cleanly
if(!globalLogistics) {
notCheckedList.innerHTML = '<div class="flex justify-center p-6"><div class="loader !w-6 !h-6 border-gray-400"></div></div>';
checkedList.innerHTML = '<div class="flex justify-center p-6"><div class="loader !w-6 !h-6 border-gray-400"></div></div>';
document.getElementById('attNotCheckedCount').textContent = '0';
document.getElementById('attCheckedCount').textContent = '0';
return;
}

let notCheckedHtml = '';
let checkedHtml = '';
let notCheckedCount = 0;
let checkedCount = 0;

const participants = globalLogistics.participants.filter(p => assignment === 'ALL' || p.group === assignment);

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

notCheckedList.innerHTML = notCheckedHtml || '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';
checkedList.innerHTML = checkedHtml || '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';

document.getElementById('attNotCheckedCount').textContent = notCheckedCount;
document.getElementById('attCheckedCount').textContent = checkedCount;
}

function generateAttCard(p, isChecked) {
const dynColor = getProjectColor(p.group);
const roleColor = p.role === 'TRAINEE' ? 'text-blue-600 dark:text-blue-400' : (p.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400');
const roleShort = p.role.substring(0,3).toUpperCase();
const dName = p.displayName || p.name;

return `
<div id="att-card-${p.nric}" class="relative bg-white dark:bg-gray-800 p-1.5 md:p-2 rounded border border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-300 flex items-center justify-between gap-1 select-none active:scale-95 cursor-pointer hover:border-primary dark:hover:border-primary" onclick="toggleAttendanceStatus('${p.nric}', ${!isChecked})">
 <div class="flex items-start min-w-0 flex-1">
     <div class="flex flex-col min-w-0 flex-1 gap-1">
         <span class="font-extrabold text-[11px] md:text-[12px] px-1.5 py-0.5 rounded shadow-sm border ${dynColor} max-w-full break-words whitespace-normal leading-[1.1] text-left inline-block self-start" style="overflow-wrap: break-word;">${dName}</span>
         <span class="text-[8px] font-black ${roleColor} w-max bg-gray-50 dark:bg-gray-700 px-1 py-0.5 rounded uppercase tracking-wider border border-gray-100 dark:border-gray-600">${roleShort}</span>
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
const query = document.getElementById('attSearchInput').value.toLowerCase().trim();
const resultsContainer = document.getElementById('attSearchResults');

if(!query) {
resultsContainer.classList.add('hidden-force');
return;
}

const assignment = document.getElementById('attAssignmentSelect').value;
const participants = globalLogistics.participants.filter(p => {
if(assignment !== 'ALL' && p.group !== assignment) return false;
const dName = p.displayName || p.name || '';
return dName.toLowerCase().includes(query);
});

let html = '';
participants.forEach(p => {
const stateObj = attendanceState[p.nric];
const isChecked = stateObj ? stateObj.status : false;
const dynColor = getProjectColor(p.group);
const dName = p.displayName || p.name;

html += `
<li class="px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center border-b border-gray-100 dark:border-gray-700 last:border-0 transition" onclick="selectFromSearch('${p.nric}')">
    <span class="font-bold text-[11px] md:text-xs ${dynColor} px-1.5 py-0.5 rounded-md border shadow-sm leading-tight max-w-[70%] break-words whitespace-normal" style="overflow-wrap: anywhere;">${dName}</span>
    ${isChecked ? '<span class="text-[9px] bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 px-1 py-0.5 rounded font-black uppercase">Checked</span>' : '<span class="text-[9px] bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 px-1 py-0.5 rounded font-black uppercase">NOT Checked</span>'}
</li>`;
});

resultsContainer.innerHTML = html || '<li class="px-3 py-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 text-center">No matches found.</li>';
resultsContainer.classList.remove('hidden-force');
}

function selectFromSearch(nric) {
document.getElementById('attSearchInput').value = '';
document.getElementById('attSearchResults').classList.add('hidden-force');
toggleAttendanceStatus(nric, true);
}

function toggleAttendanceStatus(nric, forceState) {
attendanceState[nric] = { status: forceState, ts: Date.now() }; // Attach exact timestamp
pendingAttendanceUpdates.add(nric);
renderAttendanceLists();

if (attSyncTimeout) clearTimeout(attSyncTimeout);
attSyncTimeout = setTimeout(() => {
executeAttendanceSync();
}, 800);

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

// Capture the current batch and clear the pending set immediately to allow concurrent local edits
const batch = new Set(pendingAttendanceUpdates);
pendingAttendanceUpdates.clear();

const updates = Array.from(batch).map(nric => ({
nric: nric,
status: attendanceState[nric]?.status || false,
ts: attendanceState[nric]?.ts || Date.now()
}));

try {
await callBackend('syncAttendanceUpdate', { 
    juncture: juncture, 
    updates: updates, 
    takenBy: currentUser.name 
});
setAttSyncButtonState('saved');
} catch(e) {
showToast("Sync failed. Retrying...", true);
setAttSyncButtonState('error');
// Re-add to pending if failed so it tries again on next interaction
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
           const res = await callBackend('fetchAttendanceData', { juncture });
           const remoteData = res.data || {};
           
           globalLogistics.participants.forEach(p => {
               const rEntry = remoteData[p.nric] || { status: false, ts: 0 };
               const lEntry = attendanceState[p.nric] || { status: false, ts: 0 };
               // LAST-WRITE-WINS Mutex Check
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
if(!attTab || attTab.classList.contains('hidden-force') || isAttendanceSyncing) return;

const juncture = document.getElementById('attJunctureSelect').value;
if(!juncture) return;

try {
    const res = await callBackend('fetchAttendanceData', { juncture });
    const remoteData = res.data || {};
    let hasChanges = false;
    
    globalLogistics.participants.forEach(p => {
        const rEntry = remoteData[p.nric] || { status: false, ts: 0 };
        const lEntry = attendanceState[p.nric] || { status: false, ts: 0 };
        
        // LAST-WRITE-WINS: Only apply remote change if its timestamp is strictly newer AND no local pending syncs exist
        if(rEntry.ts > lEntry.ts && !pendingAttendanceUpdates.has(p.nric)) {
            attendanceState[p.nric] = { status: rEntry.status, ts: rEntry.ts };
            hasChanges = true;
        }
    });

    if(hasChanges) {
        renderAttendanceLists();
        
        // Update search results if currently open
        const searchInput = document.getElementById('attSearchInput');
        const searchResults = document.getElementById('attSearchResults');
        if (searchInput && searchInput.value && searchResults && !searchResults.classList.contains('hidden-force')) {
            handleAttendanceSearch();
        }
    }
} catch(e) {
    // Silent fail on polling
}
}, 8000);
}

function setAttSyncButtonState(state) {
const btn = document.getElementById('btn-sync-attendance');
if(!btn) return;

const textSpan = btn.querySelector('.btn-text'); 
const spinner = btn.querySelector('.btn-spinner');

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
textSpan.textContent = "Error"; 
}
}