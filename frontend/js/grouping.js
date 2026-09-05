let currentGroupingSheetUrl = null;
let groupingData = { trainees: [], volunteers: [], meetingLocs: [], dismissalLocs: [] };
let pendingGroupingUpdates = [];
let isGroupingSyncing = false;
let groupingSyncTimeout = null;
let groupingPollInterval = null;
let currentGroupingSearch = "";
let lastGroupingLocalChange = 0;
let activeGroups = ["1", "2", "3", "4", "5"]; // Pre-populate standard groups

const EXPORT_COLORS = [
'#fef2f2', '#eff6ff', '#f0fdf4', '#fefce8', 
'#faf5ff', '#fff7ed', '#f0fdfa', '#fdf2f8', '#eef2ff'
];

// ==========================================
// VERTICAL GROUPING CORE
// ==========================================

function openManualGrouping(url) {
if(!url) return;

currentGroupingSheetUrl = url;
currentGroupingSearch = "";
const searchInput = document.getElementById('groupingSearchInput');
if(searchInput) searchInput.value = "";
if (typeof toggleClearBtn === 'function') toggleClearBtn('groupingSearchInput');

loadGroupingData();
}

function loadGroupingData() {
const overlay = document.getElementById('groupingLoadingOverlay');
if(overlay) overlay.classList.remove('hidden');

apiCall('fetchManualPairingData', { sheetUrl: currentGroupingSheetUrl }).then(res => {
if(overlay) overlay.classList.add('hidden');
if (res.success) {
groupingData = res.data;
renderGroupingList();
startGroupingPolling();
} else {
alert("Error: " + res.message);
window.navigateTo('admin.html');
}
});
}

let groupingSearchTimeout = null;
function changeGroupingSearch() {
if (groupingSearchTimeout) clearTimeout(groupingSearchTimeout);
groupingSearchTimeout = setTimeout(() => {
const input = document.getElementById('groupingSearchInput');
if(input) {
currentGroupingSearch = input.value.toLowerCase().trim();
renderGroupingList();
}
}, 300);
}

// ==========================================
// GROUP DELETION LOGIC
// ==========================================

window.deleteGroup = function(g, event) {
if (event) event.stopPropagation();
if (!confirm(`Are you sure you want to delete Group ${g}? All trainees will be unassigned and ICs removed.`)) return false;

let changed = false;
let volsInGroup = new Set();

// 1. Unassign all trainees in this group
(groupingData.trainees || []).forEach(t => {
if (String(t.group).trim() === String(g)) {
t.group = "";
changed = true;
const updateIndex = pendingGroupingUpdates.findIndex(u => u.name === t.name && u.role === 'TRAINEE');
if (updateIndex > -1) {
  pendingGroupingUpdates[updateIndex].group = "";
} else {
  pendingGroupingUpdates.push({ role: 'TRAINEE', name: t.name, group: "" });
}

if (t.volPaired) {
  t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v).forEach(v => volsInGroup.add(v.toLowerCase()));
}
}
});

// 2. Remove Group IC from volunteers paired with these trainees
(groupingData.volunteers || []).forEach(v => {
if (v.groupIC && volsInGroup.has(v.name.toLowerCase())) {
v.groupIC = false;
changed = true;
let updateIndex = pendingGroupingUpdates.findIndex(u => u.name === v.name && u.role === 'VOLUNTEER');
if (updateIndex > -1) {
  pendingGroupingUpdates[updateIndex].groupIC = false;
} else {
  pendingGroupingUpdates.push({ role: 'VOLUNTEER', name: v.name, groupIC: false });
}
}
});

// 3. Remove group from active arrays
activeGroups = activeGroups.filter(x => String(x) !== String(g));
if (typeof window.extractedActiveGroups !== 'undefined') {
window.extractedActiveGroups = window.extractedActiveGroups.filter(x => String(x) !== String(g));
}

lastGroupingLocalChange = Date.now();
renderGroupingList();
if (changed) {
triggerGroupingSync();
}

showFlashMessage('groupingGlobalStatus', `Group ${g} deleted.`, 'success');
return true;
};


// ==========================================
// RENDER VERTICAL LIST UI
// ==========================================

function renderGroupingList() {
const container = document.getElementById('groupingList');
if(!container) return;

const scrollPos = container.scrollTop;

let activeTrainees = (groupingData.trainees || []).filter(t => t.attending === 'y' && !t.isGoneHome);

let groupSet = new Set(activeGroups);
activeTrainees.forEach(t => {
const g = String(t.group || "").trim();
if (g) groupSet.add(g);
});
activeGroups = Array.from(groupSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

if (currentGroupingSearch) {
activeTrainees = activeTrainees.filter(item => {
return item.name.toLowerCase().includes(currentGroupingSearch) || 
  (item.volPaired && item.volPaired.toLowerCase().includes(currentGroupingSearch));
});
}

const cols = ["UNASSIGNED", ...activeGroups];
let html = '';

cols.forEach(g => {
const isUnassigned = g === "UNASSIGNED";
const title = isUnassigned ? "Unassigned" : `Group ${g}`;

const colTrainees = activeTrainees.filter(t => isUnassigned ? String(t.group||"").trim() === "" : String(t.group||"").trim() === g);

if (colTrainees.length === 0 && !isUnassigned) return;

colTrainees.sort((a,b) => a.name.localeCompare(b.name));

let cardsHtml = '';
colTrainees.forEach(t => {
const jsSafeName = t.name.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '&quot;');
const htmlSafeName = t.name.replace(/"/g, '&quot;');
const cardId = `grouping-card-${t.name.replace(/[^a-zA-Z0-9]/g, '')}`;

let volBadge = '';
if (t.volPaired) {
volBadge = `<div class="mt-2 text-[10px] text-teal-600 dark:text-teal-400 font-bold leading-tight bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800/50 inline-block"><i class="fa-solid fa-handshake-angle mr-1"></i>${t.volPaired}</div>`;
} else {
volBadge = `<div class="mt-2 text-[9px] uppercase tracking-wider text-red-500 font-black bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded inline-block"><i class="fa-solid fa-circle-exclamation mr-1"></i>Unpaired</div>`;
}

let extras = '';
if (t.extra?.t_one_on_one) {
const oneOnOneRaw = String(t.extra.t_one_on_one).trim().toLowerCase();
if (oneOnOneRaw !== '' && !['no', 'n', 'false', '0'].includes(oneOnOneRaw)) {
   extras += `<i class="fa-solid fa-star text-yellow-500 text-[10px] ml-1" title="1-1 Required: ${String(t.extra.t_one_on_one).replace(/"/g, '&quot;')}"></i>`;
}
}
if (t.extra?.remark) {
extras += `<i class="fa-solid fa-note-sticky text-yellow-500 text-[10px] ml-1 cursor-help" title="${t.extra.remark.replace(/"/g, '&quot;')}"></i>`;
}

let cgBadge = '';
if (t.caregivers > 0) {
cgBadge = `<span class="inline-flex shrink-0 items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] font-black text-white shadow-sm ml-1">${t.caregivers > 1 ? t.caregivers + 'C' : 'C'}</span>`;
}

cardsHtml += `
<div id="${cardId}" class="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm cursor-pointer hover:border-orange-500 transition relative grouping-card group select-none active:scale-95" data-name="${htmlSafeName}" onclick="openQuickGroupModal('${jsSafeName}')">
<div class="flex justify-between items-start gap-1 w-full">
   <div class="text-sm font-black text-gray-900 dark:text-white leading-tight break-words flex-1 flex items-center flex-wrap gap-1">
       <span>${t.name}</span>
       <div class="flex items-center">
           ${extras}
           ${cgBadge}
       </div>
   </div>
</div>
${volBadge}
</div>
`;
});

const headerBg = isUnassigned ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300';
const borderCol = isUnassigned ? 'border-red-200 dark:border-red-800' : 'border-orange-200 dark:border-orange-800';
const innerBorderCol = isUnassigned ? 'border-red-100 dark:border-red-900/20' : 'border-orange-100 dark:border-orange-900/20';

html += `
<div class="flex flex-col mb-4">
<div class="${headerBg} px-3 py-2 rounded-t-lg font-black flex justify-between items-center text-xs md:text-sm uppercase tracking-wide border-b-2 ${borderCol} relative">
<div class="flex items-center gap-2">
   <span>${title}</span>
   ${!isUnassigned ? `<button onclick="window.deleteGroup('${g}', event)" class="flex items-center justify-center w-6 h-6 bg-transparent hover:bg-red-500 text-red-500 hover:text-white dark:hover:bg-red-600 rounded shadow-none hover:shadow-sm transition-colors opacity-70 hover:opacity-100" title="Delete Group"><i class="fa-solid fa-trash text-xs"></i></button>` : ''}
</div>
<span class="bg-white/60 dark:bg-black/50 px-2.5 py-0.5 rounded-full text-[10px] shadow-inner">${colTrainees.length}</span>
</div>
<div class="bg-white/50 dark:bg-zinc-900/50 p-2 md:p-3 rounded-b-lg border border-t-0 ${innerBorderCol} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
${cardsHtml || `<div class="col-span-full text-center p-3 text-xs font-bold text-gray-400 italic bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-dashed border-gray-200 dark:border-zinc-700">No trainees</div>`}
</div>
</div>
`;
});

container.innerHTML = html;
container.scrollTop = scrollPos;

document.querySelectorAll('#groupingList .grouping-card').forEach(el => {
uiBindLongPress(el, () => {
const name = el.getAttribute('data-name');
const p = (groupingData.trainees || []).find(x => x.name === name);
if (p) showPersonInfo(p);
});
});
}

// ==========================================
// QUICK GROUP ALGORITHM & MODAL
// ==========================================

let currentGroupingTrainee = null;

function openQuickGroupModal(traineeName) {
currentGroupingTrainee = traineeName;
const title = document.getElementById('quickGroupModalTitle');
if(title) title.innerHTML = `Group for <span class="text-orange-500">${traineeName}</span>`;

const grid = document.getElementById('quickGroupGrid');
if(grid) {
grid.innerHTML = '';
let allG = new Set([...activeGroups]);
Array.from(allG).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).forEach(g => {
grid.innerHTML += `
<div class="relative group/btn">
  <button onclick="handleGroupSelection('${g}')" class="w-full bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-700 py-2 md:py-3 rounded-lg text-sm font-bold hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 transition-colors shadow-sm focus:outline-none">Grp ${g}</button>
  <button onclick="if(window.deleteGroup('${g}', event)) closeQuickGroupModal()" class="absolute -top-1.5 -right-1.5 bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-gray-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm border border-gray-300 dark:border-zinc-600 transition-colors z-10"><i class="fa-solid fa-xmark"></i></button>
</div>`;
});
}

const modal = document.getElementById('quickGroupModal');
const panel = document.getElementById('modalPanelQuickGroup');
if(modal) {
modal.classList.remove('hidden');
setTimeout(() => {
modal.classList.remove('opacity-0');
if(panel) { panel.classList.remove('scale-95'); panel.classList.add('scale-100'); }
}, 10);
}
}

function closeQuickGroupModal() {
const modal = document.getElementById('quickGroupModal');
const panel = document.getElementById('modalPanelQuickGroup');
if(modal) {
modal.classList.add('opacity-0');
if(panel) { panel.classList.remove('scale-100'); panel.classList.add('scale-95'); }
setTimeout(() => {
modal.classList.add('hidden');
currentGroupingTrainee = null;
}, 300);
}
}

function getConnectedTrainees(startName) {
const connected = new Set([startName]);
const queue = [startName];

while(queue.length > 0) {
const current = queue.shift();
const t = groupingData.trainees.find(x => x.name === current);
if (!t || !t.volPaired) continue;

const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);

groupingData.trainees.forEach(otherT => {
if (connected.has(otherT.name) || !otherT.volPaired) return;
const otherVols = otherT.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
const hasShared = otherVols.some(v => vols.includes(v));
if (hasShared) {
connected.add(otherT.name);
queue.push(otherT.name);
}
});
}
return Array.from(connected);
}

function handleGroupSelection(targetGroupRaw) {
if(!currentGroupingTrainee) return;
const traineeName = currentGroupingTrainee;
const targetGroup = targetGroupRaw === "UNASSIGNED" ? "" : targetGroupRaw;
lastGroupingLocalChange = Date.now();

const connectedTrainees = getConnectedTrainees(traineeName);

let changed = false;
connectedTrainees.forEach(tName => {
let t = groupingData.trainees.find(x => x.name === tName);
if (t && String(t.group).trim() !== targetGroup) {
t.group = targetGroup;
changed = true;

const updateIndex = pendingGroupingUpdates.findIndex(u => u.name === tName && u.role === 'TRAINEE');
if (updateIndex > -1) {
pendingGroupingUpdates[updateIndex].group = targetGroup;
} else {
pendingGroupingUpdates.push({ role: 'TRAINEE', name: tName, group: targetGroup });
}
}
});

if (changed) {
if (targetGroup !== "" && !activeGroups.includes(targetGroup)) {
activeGroups.push(targetGroup);
}

if (connectedTrainees.length > 1 && targetGroup !== "") {
showFlashMessage('groupingGlobalStatus', `Auto-Grouped ${connectedTrainees.length} trainees due to shared volunteers.`, 'success');
}

renderGroupingList();
triggerGroupingSync();

// Auto-scroll logic for UIUX
setTimeout(() => {
requestAnimationFrame(() => {
const cardId = `grouping-card-${traineeName.replace(/[^a-zA-Z0-9]/g, '')}`;
const card = document.getElementById(cardId);
const container = document.getElementById('groupingList');
if (card && container) {
    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const scrollTop = container.scrollTop + (cardRect.top - containerRect.top) - (containerRect.height / 2) + (cardRect.height / 2);
    
    container.scrollTo({ top: scrollTop, behavior: 'smooth' });
    card.classList.add('pulse-green');
    setTimeout(() => card.classList.remove('pulse-green'), 800);
}
});
}, 100);
}

closeQuickGroupModal();
}

function handleNewGroupSelection() {
if(!currentGroupingTrainee) return;
const g = prompt("Enter new Group Name or Number:");
if (g && g.trim()) {
const cleanName = g.trim();
if (!activeGroups.includes(cleanName)) {
activeGroups.push(cleanName);
}
handleGroupSelection(cleanName);
}
}

// ==========================================
// SYNC ENGINE
// ==========================================

function setGroupingSyncButtonState(state) {
const btn = document.getElementById('btn-sync-manual-grouping');
if(!btn) return;
const textSpan = btn.querySelector('.btn-text'); const spinner = btn.querySelector('.btn-spinner');

btn.className = "text-[10px] md:text-xs px-1.5 py-1 rounded font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
spinner.className = "fa-solid fa-circle-notch fa-spin btn-spinner ml-1 hidden"; 

if (state === 'loading' || state === 'saving') { 
btn.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-200', 'dark:bg-yellow-900/30', 'dark:text-yellow-400', 'dark:border-yellow-800'); 
textSpan.textContent = state === 'loading' ? "Loading..." : "Saving..."; 
spinner.classList.remove('hidden'); 
} else if (state === 'saved') { 
btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200', 'dark:bg-green-900/30', 'dark:text-green-400', 'dark:border-green-800'); 
textSpan.textContent = "Saved"; 
setTimeout(() => {
if (pendingGroupingUpdates.length === 0) {
btn.className = "text-[10px] md:text-xs px-1.5 py-1 rounded font-bold transition flex items-center border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 shadow-sm focus:outline-none shrink-0";
textSpan.textContent = "Saved";
}
}, 2000);
} else if (state === 'error') { 
btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200', 'dark:bg-red-900/30', 'dark:text-red-400', 'dark:border-red-800'); 
textSpan.textContent = "Save Failed"; 
}
}

function triggerGroupingSync() {
setGroupingSyncButtonState('saving');
if (groupingSyncTimeout) clearTimeout(groupingSyncTimeout);
groupingSyncTimeout = setTimeout(() => {
executeGroupingSync();
}, 800); 
}

async function executeGroupingSync() {
if (isGroupingSyncing) return; 
if (pendingGroupingUpdates.length === 0) return;

isGroupingSyncing = true;
setGroupingSyncButtonState('saving');

const updatesToSync = [...pendingGroupingUpdates];
pendingGroupingUpdates = [];

try {
const res = await apiCall('syncManualGroupingUpdates', { sheetUrl: currentGroupingSheetUrl, updates: updatesToSync });

if (res.success) {
setGroupingSyncButtonState('saved');
} else {
throw new Error(res.message);
}
} catch(e) {
console.error(e);
setGroupingSyncButtonState('error');
updatesToSync.forEach(u => {
const idx = pendingGroupingUpdates.findIndex(p => p.name === u.name && p.role === u.role);
if (idx === -1) pendingGroupingUpdates.push(u);
});
} finally {
isGroupingSyncing = false;
if (pendingGroupingUpdates.length > 0) {
triggerGroupingSync();
}
}
}

function startGroupingPolling() {
if (groupingPollInterval) clearInterval(groupingPollInterval);

groupingPollInterval = setInterval(async () => {
if (isGroupingSyncing) return;

if (document.activeElement && document.activeElement.id === 'groupingSearchInput') return;

if (pendingGroupingUpdates.length > 0) return;

const fetchStartTime = Date.now();

try {
const res = await apiCall('fetchManualPairingData', { sheetUrl: currentGroupingSheetUrl });
if(res.success && !isGroupingSyncing && pendingGroupingUpdates.length === 0) {
if (lastGroupingLocalChange > fetchStartTime) return;

const newDataStr = JSON.stringify(res.data);
const oldDataStr = JSON.stringify(groupingData);

if (newDataStr !== oldDataStr) {
groupingData = res.data;
renderGroupingList();
}
}
} catch(e) { }
}, 10000); 
}

async function manualSyncGrouping() {
if (isGroupingSyncing) return; 

if (pendingGroupingUpdates.length > 0) {
await executeGroupingSync();
}

setGroupingSyncButtonState('loading');
const overlay = document.getElementById('groupingLoadingOverlay');
if(overlay) overlay.classList.remove('hidden');

const fetchStartTime = Date.now();

try {
const res = await apiCall('fetchManualPairingData', { sheetUrl: currentGroupingSheetUrl });
if(overlay) overlay.classList.add('hidden');
if (res.success) {
if (lastGroupingLocalChange > fetchStartTime) return;

groupingData = res.data;
renderGroupingList();
setGroupingSyncButtonState('saved');
} else {
setGroupingSyncButtonState('error');
}
} catch (e) {
if(overlay) overlay.classList.add('hidden');
setGroupingSyncButtonState('error');
}
}

// ==========================================
// ASSIGN ICs MODAL LOGIC
// ==========================================

function openAssignICModal(sheetUrl) {
if(!sheetUrl || sheetUrl.includes("Select")) return alert("Select an event first");

currentGroupingSheetUrl = sheetUrl;
showOverlay('loading', 'Loading Roles...');

apiCall('fetchManualPairingData', { sheetUrl: sheetUrl }).then(res => {
closeOverlay();
if (res.success) {
groupingData = res.data;
renderAssignICModal();
document.getElementById('assignICModal').classList.remove('hidden');
} else {
alert("Error: " + res.message);
}
});
}

function closeAssignICModal() {
document.getElementById('assignICModal').classList.add('hidden');
if (pendingGroupingUpdates.length > 0) {
triggerGroupingSync();
}
}

window.toggleAssignICDropdown = function(id, e) {
if(e) e.stopPropagation();
const el = document.getElementById(id);
const isHidden = el.classList.contains('hidden');
document.querySelectorAll('.assign-ic-dropdown-list').forEach(list => list.classList.add('hidden'));
if(isHidden) el.classList.remove('hidden');
};

document.addEventListener('click', function(e) {
if(!e.target.closest('.assign-ic-dropdown-list') && !e.target.closest('button[onclick^="toggleAssignICDropdown"]')) {
document.querySelectorAll('.assign-ic-dropdown-list').forEach(list => list.classList.add('hidden'));
}
});

function generateCustomDropdownHtml(type, targetId, label, options, currentICName) {
const jsSafeTarget = targetId.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '&quot;');
const dropdownId = `dropdown-${type}-${targetId.replace(/[^a-zA-Z0-9]/g, '')}`;

let listHtml = `<div class="p-2 border-b border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors" onclick="handleAssignICChange('${type}', '${jsSafeTarget}', '')">
<div class="font-bold text-sm text-gray-500">-- No IC Assigned --</div>
</div>`;

if (options.length === 0) {
listHtml += `<div class="p-3 text-xs text-gray-400 italic text-center">No eligible volunteers active.</div>`;
} else {
options.forEach(v => {
const remark = (v.extra && v.extra.remark) ? `<div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 whitespace-normal leading-tight break-words"><i class="fa-solid fa-note-sticky text-yellow-500 mr-1"></i>${v.extra.remark}</div>` : '';
const isSelected = (v.name === currentICName);
const bgClass = isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500' : 'hover:bg-gray-50 dark:hover:bg-zinc-700 border-l-2 border-transparent';

const jsSafeVolName = v.name.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '&quot;');

listHtml += `<div class="p-2 border-b border-gray-100 dark:border-zinc-800 ${bgClass} cursor-pointer transition-colors" onclick="handleAssignICChange('${type}', '${jsSafeTarget}', '${jsSafeVolName}')">
 <div class="font-bold text-sm text-gray-900 dark:text-white flex justify-between items-center">
     <span>${v.name}</span>
     ${isSelected ? '<i class="fa-solid fa-check text-blue-500 text-xs"></i>' : ''}
 </div>
 ${remark}
</div>`;
});
}

const displayLabel = currentICName || "-- No IC Assigned --";

return `
<div class="bg-gray-50 dark:bg-zinc-800/50 p-3 md:p-4 rounded-xl border border-gray-200 dark:border-zinc-700 relative">
<label class="block text-xs font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wide">${label}</label>
<div class="relative">
<button type="button" onclick="toggleAssignICDropdown('${dropdownId}', event)" class="w-full bg-white dark:bg-black border border-gray-300 dark:border-zinc-600 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white shadow-sm focus:outline-none focus:border-blue-500 flex justify-between items-center">
 <span class="truncate">${displayLabel}</span>
 <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
</button>
<div id="${dropdownId}" class="assign-ic-dropdown-list hidden absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar text-left">
 ${listHtml}
</div>
</div>
</div>
`;
}

function renderAssignICModal() {
const container = document.getElementById('assignICContainer');
let html = '<div class="space-y-6">';

const volLookup = new Map();
(groupingData.volunteers || []).forEach(v => volLookup.set(v.name.toLowerCase(), v));

// --- 1. GROUP ICs ---
let activeTrainees = (groupingData.trainees || []).filter(t => t.attending === 'y' && !t.isGoneHome && String(t.group).trim() !== "");
let allGroups = new Set();
activeTrainees.forEach(t => allGroups.add(String(t.group).trim()));
let sortedGroups = Array.from(allGroups).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

if (sortedGroups.length > 0) {
html += `<div><h4 class="font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-700 pb-2 mb-3"><i class="fa-solid fa-users text-orange-500 mr-2"></i>Group ICs</h4><div class="space-y-3">`;
sortedGroups.forEach(g => {
let tList = activeTrainees.filter(t => String(t.group).trim() === g);
let groupVolKeys = new Set();
tList.forEach(t => {
 if (t.volPaired) {
     const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
     vols.forEach(v => groupVolKeys.add(v.toLowerCase()));
 }
});

let options = [];
let currentICName = "";
Array.from(groupVolKeys).sort().forEach(vKey => {
 const vObj = volLookup.get(vKey);
 if (vObj) {
     if (vObj.groupIC) currentICName = vObj.name;
     options.push(vObj);
 }
});
html += generateCustomDropdownHtml('group', g, `Group ${g} IC`, options, currentICName);
});
html += `</div></div>`;
} else {
html += `<div><h4 class="font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-700 pb-2 mb-3"><i class="fa-solid fa-users text-orange-500 mr-2"></i>Group ICs</h4>
<p class="text-xs text-gray-500 italic text-center py-2">No groups assigned yet.</p></div>`;
}

// --- 2. MEETING ICs ---
let meetingLocs = groupingData.meetingLocs || [];
if (meetingLocs.length > 0) {
html += `<div><h4 class="font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-700 pb-2 mb-3"><i class="fa-solid fa-location-dot text-blue-500 mr-2"></i>Meeting ICs</h4><div class="space-y-3">`;
meetingLocs.forEach(loc => {
let options = [];
let currentICName = "";
(groupingData.volunteers || []).forEach(v => {
 if(v.extra && v.extra.v_meet && v.extra.v_meet.toLowerCase() === loc.toLowerCase()) {
     if(v.meetIC) currentICName = v.name;
     options.push(v);
 }
});
options.sort((a,b) => a.name.localeCompare(b.name));
html += generateCustomDropdownHtml('meet', loc, `Meet: ${loc}`, options, currentICName);
});
html += `</div></div>`;
}

// --- 3. DISMISSAL ICs ---
let dismissalLocs = groupingData.dismissalLocs || [];
if (dismissalLocs.length > 0) {
html += `<div><h4 class="font-black text-gray-900 dark:text-white border-b border-gray-200 dark:border-zinc-700 pb-2 mb-3"><i class="fa-solid fa-flag-checkered text-purple-500 mr-2"></i>Dismissal ICs</h4><div class="space-y-3">`;
dismissalLocs.forEach(loc => {
let options = [];
let currentICName = "";
(groupingData.volunteers || []).forEach(v => {
 if(v.extra && v.extra.v_dismiss && v.extra.v_dismiss.toLowerCase() === loc.toLowerCase()) {
     if(v.dismissIC) currentICName = v.name;
     options.push(v);
 }
});
options.sort((a,b) => a.name.localeCompare(b.name));
html += generateCustomDropdownHtml('dismiss', loc, `Dismiss: ${loc}`, options, currentICName);
});
html += `</div></div>`;
}

html += '</div>';
container.innerHTML = html;
}

function handleAssignICChange(type, target, newVolName) {
lastGroupingLocalChange = Date.now();
document.querySelectorAll('.assign-ic-dropdown-list').forEach(list => list.classList.add('hidden'));

let groupVolKeys = new Set();

if (type === 'group') {
let tList = (groupingData.trainees || []).filter(t => t.attending === 'y' && !t.isGoneHome && String(t.group).trim() === String(target));
tList.forEach(t => {
if (t.volPaired) {
 t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v).forEach(v => groupVolKeys.add(v.toLowerCase()));
}
});
} else if (type === 'meet') {
(groupingData.volunteers || []).forEach(v => {
if (v.extra && v.extra.v_meet && v.extra.v_meet.toLowerCase() === target.toLowerCase()) {
 groupVolKeys.add(v.name.toLowerCase());
}
});
} else if (type === 'dismiss') {
(groupingData.volunteers || []).forEach(v => {
if (v.extra && v.extra.v_dismiss && v.extra.v_dismiss.toLowerCase() === target.toLowerCase()) {
 groupVolKeys.add(v.name.toLowerCase());
}
});
}

const newVolKey = newVolName ? newVolName.toLowerCase() : null;

(groupingData.volunteers || []).forEach(v => {
const vKey = v.name.toLowerCase();

if (groupVolKeys.has(vKey)) {
const shouldBeIC = (vKey === newVolKey);

let changed = false;
if (type === 'group' && v.groupIC !== shouldBeIC) { v.groupIC = shouldBeIC; changed = true; }
else if (type === 'meet' && v.meetIC !== shouldBeIC) { v.meetIC = shouldBeIC; changed = true; }
else if (type === 'dismiss' && v.dismissIC !== shouldBeIC) { v.dismissIC = shouldBeIC; changed = true; }

if (changed) {
 let updateIndex = pendingGroupingUpdates.findIndex(u => u.name === v.name && u.role === 'VOLUNTEER');
 if (updateIndex === -1) {
     pendingGroupingUpdates.push({ role: 'VOLUNTEER', name: v.name });
     updateIndex = pendingGroupingUpdates.length - 1;
 }
 if (type === 'group') pendingGroupingUpdates[updateIndex].groupIC = shouldBeIC;
 if (type === 'meet') pendingGroupingUpdates[updateIndex].meetIC = shouldBeIC;
 if (type === 'dismiss') pendingGroupingUpdates[updateIndex].dismissIC = shouldBeIC;
}
}
});

renderAssignICModal();
triggerGroupingSync();
}

// ==========================================
// EXPORT TABLE LOGIC
// ==========================================

function openTableExportModal() {
const btn = document.getElementById('shareTableBtn');
const preview = document.getElementById('exportTablePreview');
const container = document.getElementById('exportTableContainer');

if (btn) {
btn.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Share';
btn.onclick = shareExportTable; 
btn.className = 'px-4 md:px-5 py-2 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors';
btn.disabled = false;
}

if (preview) {
preview.innerHTML = '';
preview.classList.add('hidden');
}

if (container) {
container.classList.remove('hidden');
}

// Force scroll container to allow horizontal scrolling on narrow screens
const scrollContainer = preview ? preview.parentElement : null;
if (scrollContainer) {
scrollContainer.classList.remove('overflow-x-hidden');
scrollContainer.classList.add('overflow-x-auto');
}

buildExportTable();
document.getElementById('exportTableModal').classList.remove('hidden');
}

function closeTableExportModal() {
document.getElementById('exportTableModal').classList.add('hidden');
}

function buildExportTable() {
const container = document.getElementById('exportTableContainer');
container.classList.remove('min-w-max');
container.classList.add('w-full');

let allGroups = new Set();
groupingData.trainees.forEach(t => {
if (t.attending === 'y' && !t.isGoneHome && String(t.group).trim() !== "") {
allGroups.add(String(t.group).trim());
}
});

let sortedGroups = Array.from(allGroups).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

const volLookup = new Map();
groupingData.volunteers.forEach(v => {
volLookup.set(v.name.toLowerCase(), v);
});

let displayedVols = new Set();
let allTrs = [];

sortedGroups.forEach((g, index) => {
const bgColor = EXPORT_COLORS[index % EXPORT_COLORS.length];

let tList = groupingData.trainees.filter(t => t.attending === 'y' && !t.isGoneHome && String(t.group).trim() === g);

let volMap = new Map();
let unpairedTrainees = [];

tList.forEach(t => {
const remarks = t.extra?.remarks || t.extra?.remark || '';
if (t.volPaired) {
const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
vols.forEach(v => {
    const vKey = v.toLowerCase();
    displayedVols.add(vKey);
    if (!volMap.has(vKey)) {
        const vObj = volLookup.get(vKey);
        volMap.set(vKey, {
            name: vObj ? vObj.name : v, 
            isGroupIC: vObj ? vObj.groupIC === true : false,
            isMeetIC: vObj ? vObj.meetIC === true : false,
            isDismissIC: vObj ? vObj.dismissIC === true : false,
            meetLoc: vObj ? (vObj.extra?.v_meet || '').trim() : '',
            dismissLoc: vObj ? (vObj.extra?.v_dismiss || '').trim() : '',
            volRemark: vObj ? (vObj.extra?.remarks || vObj.extra?.remark || '') : '',
            trainees: [],
            remarks: []
        });
    }
    const vData = volMap.get(vKey);
    vData.trainees.push(t.name);
    if (remarks) vData.remarks.push(`<strong>[Trn] ${t.name}:</strong> ${remarks}`);
});
} else {
unpairedTrainees.push({ name: t.name, remarks: remarks });
}
});

let rows = Array.from(volMap.values());

rows.sort((a, b) => {
const aIsIC = a.isGroupIC || a.isMeetIC || a.isDismissIC;
const bIsIC = b.isGroupIC || b.isMeetIC || b.isDismissIC;
if (aIsIC && !bIsIC) return -1;
if (!aIsIC && bIsIC) return 1;
return a.name.localeCompare(b.name);
});

if (rows.length === 0 && unpairedTrainees.length === 0) {
allTrs.push(`<tr style="background-color: ${bgColor};">
<td colspan="2" style="padding: 6px 4px; border: 1px solid #ccc; font-style: italic; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;">No assignments</td>
<td style="padding: 6px 4px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: middle; line-height: 1.3; font-size: 11px; color: #333;">${g}</td>
<td style="padding: 6px 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;"></td>
</tr>`);
}

rows.forEach(r => {
let volDisplay = `<span style="font-weight: bold;">${r.name}</span>`;
if (r.isGroupIC) volDisplay += `<br><strong style="color: #0369a1; font-size: 0.9em; display:inline-block; margin-top:2px;">(Grp ${g} IC)</strong>`;
if (r.isMeetIC) {
const locDisplay = r.meetLoc ? `Meeting - ${r.meetLoc}` : 'Meeting';
volDisplay += `<br><strong style="color: #047857; font-size: 0.9em; display:inline-block; margin-top:2px;">(${locDisplay} IC)</strong>`;
}
if (r.isDismissIC) {
const locDisplay = r.dismissLoc ? `Dismissal - ${r.dismissLoc}` : 'Dismissal';
volDisplay += `<br><strong style="color: #6d28d9; font-size: 0.9em; display:inline-block; margin-top:2px;">(${locDisplay} IC)</strong>`;
}

let tDisplay = r.trainees.length > 0 ? r.trainees.join('<br>') : '-';

let allRemarks = [];
if (r.volRemark) allRemarks.push(`<strong>[Vol] ${r.name}:</strong> ${r.volRemark}`);
if (r.remarks.length > 0) allRemarks = allRemarks.concat(r.remarks);
let rDisplay = allRemarks.join('<br><br>');

allTrs.push(`<tr style="background-color: ${bgColor};">
<td style="padding: 6px 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;">${volDisplay}</td>
<td style="padding: 6px 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;">${tDisplay}</td>
<td style="padding: 6px 4px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: middle; line-height: 1.3; font-size: 11px; color: #333;">${g}</td>
<td contenteditable="true" style="padding: 6px 4px; border: 1px solid #ccc; outline: none; transition: background 0.2s; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;" onfocus="this.style.backgroundColor='#fff'" onblur="this.style.backgroundColor='transparent'">${rDisplay}</td>
</tr>`);
});

unpairedTrainees.forEach(ut => {
let rDisplay = ut.remarks ? `<strong>[Trn] ${ut.name}:</strong> ${ut.remarks}` : '';
allTrs.push(`<tr style="background-color: ${bgColor};">
<td style="padding: 6px 4px; border: 1px solid #ccc; font-weight: bold; color: #dc2626; text-align: center; vertical-align: middle; line-height: 1.3; font-size: 11px;">-</td>
<td style="padding: 6px 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;">${ut.name}</td>
<td style="padding: 6px 4px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: middle; line-height: 1.3; font-size: 11px; color: #333;">${g}</td>
<td contenteditable="true" style="padding: 6px 4px; border: 1px solid #ccc; outline: none; transition: background 0.2s; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;" onfocus="this.style.backgroundColor='#fff'" onblur="this.style.backgroundColor='transparent'">${rDisplay}</td>
</tr>`);
});
});

let unassignedTrainees = groupingData.trainees.filter(t => t.attending === 'y' && !t.isGoneHome && String(t.group).trim() === "");
let volMapUnassigned = new Map();
let orphanedTrainees = [];

unassignedTrainees.forEach(t => {
const remarks = t.extra?.remarks || t.extra?.remark || '';
if (t.volPaired) {
const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
vols.forEach(v => {
  const vKey = v.toLowerCase();
  displayedVols.add(vKey);
  if (!volMapUnassigned.has(vKey)) {
      const vObj = volLookup.get(vKey);
      volMapUnassigned.set(vKey, {
          name: vObj ? vObj.name : v, 
          isGroupIC: false,
          isMeetIC: vObj ? vObj.meetIC === true : false,
          isDismissIC: vObj ? vObj.dismissIC === true : false,
          meetLoc: vObj ? (vObj.extra?.v_meet || '').trim() : '',
          dismissLoc: vObj ? (vObj.extra?.v_dismiss || '').trim() : '',
          volRemark: vObj ? (vObj.extra?.remarks || vObj.extra?.remark || '') : '',
          trainees: [],
          remarks: []
      });
  }
  const vData = volMapUnassigned.get(vKey);
  vData.trainees.push(t.name);
  if (remarks) vData.remarks.push(`<strong>[Trn] ${t.name}:</strong> ${remarks}`);
});
} else {
orphanedTrainees.push({ name: t.name, remarks: remarks });
}
});

let unpairedVols = groupingData.volunteers.filter(v => !displayedVols.has(v.name.toLowerCase()));
unpairedVols.forEach(v => {
volMapUnassigned.set(v.name.toLowerCase(), {
name: v.name,
isGroupIC: false,
isMeetIC: v.meetIC === true,
isDismissIC: v.dismissIC === true,
meetLoc: (v.extra?.v_meet || '').trim(),
dismissLoc: (v.extra?.v_dismiss || '').trim(),
volRemark: (v.extra?.remarks || v.extra?.remark || ''),
trainees: [],
remarks: []
});
});

let unassignedRows = Array.from(volMapUnassigned.values());

if (unassignedRows.length > 0 || orphanedTrainees.length > 0) {
const bgColor = '#f3f4f6'; 

unassignedRows.sort((a, b) => {
const aIsIC = a.isMeetIC || a.isDismissIC;
const bIsIC = b.isMeetIC || b.isDismissIC;
if (aIsIC && !bIsIC) return -1;
if (!aIsIC && bIsIC) return 1;
return a.name.localeCompare(b.name);
});

unassignedRows.forEach(r => {
let volDisplay = `<span style="font-weight: bold;">${r.name}</span>`;
if (r.isMeetIC) {
  const locDisplay = r.meetLoc ? `Meeting - ${r.meetLoc}` : 'Meeting';
  volDisplay += `<br><strong style="color: #047857; font-size: 0.9em; display:inline-block; margin-top:2px;">(${locDisplay} IC)</strong>`;
}
if (r.isDismissIC) {
  const locDisplay = r.dismissLoc ? `Dismissal - ${r.dismissLoc}` : 'Dismissal';
  volDisplay += `<br><strong style="color: #6d28d9; font-size: 0.9em; display:inline-block; margin-top:2px;">(${locDisplay} IC)</strong>`;
}

let tDisplay = r.trainees.length > 0 ? r.trainees.join('<br>') : '-';

let allRemarks = [];
if (r.volRemark) allRemarks.push(`<strong>[Vol] ${r.name}:</strong> ${r.volRemark}`);
if (r.remarks.length > 0) allRemarks = allRemarks.concat(r.remarks);
let rDisplay = allRemarks.join('<br><br>');

allTrs.push(`<tr style="background-color: ${bgColor};">
  <td style="padding: 6px 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;">${volDisplay}</td>
  <td style="padding: 6px 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;">${tDisplay}</td>
  <td style="padding: 6px 4px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: middle; line-height: 1.3; font-size: 11px; color: #333;">-</td>
  <td contenteditable="true" style="padding: 6px 4px; border: 1px solid #ccc; outline: none; transition: background 0.2s; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;" onfocus="this.style.backgroundColor='#fff'" onblur="this.style.backgroundColor='transparent'">${rDisplay}</td>
</tr>`);
});

orphanedTrainees.forEach(ut => {
let rDisplay = ut.remarks ? `<strong>[Trn] ${ut.name}:</strong> ${ut.remarks}` : '';
allTrs.push(`<tr style="background-color: ${bgColor};">
  <td style="padding: 6px 4px; border: 1px solid #ccc; font-weight: bold; color: #dc2626; text-align: center; vertical-align: middle; line-height: 1.3; font-size: 11px;">-</td>
  <td style="padding: 6px 4px; border: 1px solid #ccc; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;">${ut.name}</td>
  <td style="padding: 6px 4px; border: 1px solid #ccc; text-align: center; font-weight: bold; vertical-align: middle; line-height: 1.3; font-size: 11px; color: #333;">-</td>
  <td contenteditable="true" style="padding: 6px 4px; border: 1px solid #ccc; outline: none; transition: background 0.2s; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 11px; color: #333;" onfocus="this.style.backgroundColor='#fff'" onblur="this.style.backgroundColor='transparent'">${rDisplay}</td>
</tr>`);
});
}

// Slice rows into distinct pages to maintain aspect ratio resolution on long tables
// UI remains responsive (no fixed width), but onclone forces the width for the canvas snapshot
const ROWS_PER_PAGE = 18;
let pagesHtml = '';

if (allTrs.length === 0) {
allTrs.push(`<tr><td colspan="4" style="padding: 10px; text-align: center; font-style: italic;">No data.</td></tr>`);
}

let pageIndex = 1;
for (let i = 0; i < allTrs.length; i += ROWS_PER_PAGE) {
const chunk = allTrs.slice(i, i + ROWS_PER_PAGE);

pagesHtml += `
<div id="export-page-${pageIndex}" class="export-table-page" style="background: #ffffff; padding: 8px; margin-bottom: 16px; border-radius: 8px; border: 1px solid #e5e7eb; box-sizing: border-box;">
 <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px; text-align: right; font-family: sans-serif; font-weight: bold;">
    Page ${pageIndex} of ${Math.ceil(allTrs.length / ROWS_PER_PAGE)}
 </div>
 <table style="font-family: Arial, sans-serif; border: 1px solid #333; table-layout: fixed; width: 100%; word-break: break-word; hyphens: auto; background-color: #ffffff; border-collapse: collapse;">
 <thead>
 <tr style="background-color: #333; color: #fff;">
  <th style="padding: 6px 4px; border: 1px solid #555; width: 27%; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 12px; font-weight: bold; color: #fff;">Volunteer</th>
  <th style="padding: 6px 4px; border: 1px solid #555; width: 26%; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 12px; font-weight: bold; color: #fff;">Trainee(s)</th>
  <th style="padding: 6px 4px; border: 1px solid #555; width: 11%; vertical-align: middle; text-align: center; line-height: 1.3; font-size: 12px; font-weight: bold; color: #fff;">Grp</th>
  <th style="padding: 6px 4px; border: 1px solid #555; width: 36%; vertical-align: middle; text-align: left; line-height: 1.3; font-size: 12px; font-weight: bold; color: #fff;">Remarks</th>
 </tr>
 </thead>
 <tbody>
     ${chunk.join('')}
 </tbody>
 </table>
</div>`;
pageIndex++;
}

container.innerHTML = pagesHtml;
}

let generatedImageBlobs = []; 

async function shareExportTable() {
const container = document.getElementById('exportTableContainer');
const btn = document.getElementById('shareTableBtn');
const preview = document.getElementById('exportTablePreview');
if(!container || !btn || !preview) return;

const originalText = btn.innerHTML;
btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
btn.disabled = true;

container.querySelectorAll('[contenteditable]').forEach(el => {
el.style.outline = 'none';
});

setTimeout(async () => {
try {
if (typeof html2canvas === 'undefined') throw new Error("html2canvas not loaded");

const pages = container.querySelectorAll('.export-table-page');
let previewHtml = `<p class="text-xs text-green-600 dark:text-green-400 font-bold mb-3 text-center">Images ready! Long press to save or share directly.</p>`;
generatedImageBlobs = [];
let dataUrls = [];

for (let i = 0; i < pages.length; i++) {
  const pageEl = pages[i];
  const pageId = pageEl.id;
  
  const canvas = await html2canvas(pageEl, {
      scale: 3, // 500px width * 3 = 1500px output. High-res while respecting 500px desktop format.
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: 500,
      onclone: (clonedDoc) => {
          const clonedPage = clonedDoc.getElementById(pageId);
          if (clonedPage) {
              clonedPage.style.width = '500px';
              clonedPage.style.minWidth = '500px';
              clonedPage.style.maxWidth = '500px';
              // Prevent parent containers from clipping the 500px forced layout
              let p = clonedPage.parentElement;
              while(p && p.tagName !== 'HTML') {
                  p.style.overflow = 'visible';
                  p.style.width = 'auto';
                  p = p.parentElement;
              }
          }
      }
  });

  const dataUrl = canvas.toDataURL('image/png', 1.0);
  dataUrls.push(dataUrl);
  previewHtml += `<img src="${dataUrl}" class="w-full h-auto shadow-md rounded border border-gray-200 dark:border-zinc-700 mx-auto mb-4" style="display:block; max-width: 100%;" />`;

  const blob = await (await fetch(dataUrl)).blob();
  generatedImageBlobs.push(blob);
}

container.classList.add('hidden');
preview.classList.remove('hidden');
preview.innerHTML = previewHtml;

btn.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Share via Apps';
btn.onclick = executeNativeShare;
btn.className = 'px-4 md:px-5 py-2 md:py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors';

if (currentGroupingSheetUrl && dataUrls.length > 0) {
  apiCall('uploadExportTable', {
      sheetUrl: currentGroupingSheetUrl,
      imageBase64: dataUrls[0]
  }).then(res => {
      if(res.success) {
          showFlashMessage('groupingGlobalStatus', "Backup saved to Drive.", 'success');
      }
  });
}

} catch (e) {
console.error(e);
alert("Failed to share table: " + e.message);
btn.innerHTML = originalText;
} finally {
btn.disabled = false;
}
}, 100);
}

async function executeNativeShare() {
if (!generatedImageBlobs || generatedImageBlobs.length === 0) return;

const filesArray = generatedImageBlobs.map((blob, index) => {
return new File([blob], `outing-groups-page-${index + 1}.png`, { type: 'image/png' });
});

try {
if (navigator.canShare && navigator.canShare({ files: filesArray })) {
await navigator.share({
  title: 'Outing Groups',
  files: filesArray
});
} else {
if (navigator.clipboard && window.ClipboardItem) {
  const clipboardItems = generatedImageBlobs.map(blob => new ClipboardItem({ 'image/png': blob }));
  await navigator.clipboard.write(clipboardItems);
  showFlashMessage('groupingGlobalStatus', "Tables copied to clipboard!", 'success');
} else {
  alert("Sharing not supported on this device. Long press the images to save them.");
}
}
} catch (e) {
console.log('Share canceled or failed', e);
}
}