let currentCommAttSheetUrl = null;
let commAttData = { participants: [], junctures: [], busJunctures: [], attendance: { '__GONE_HOME__': {} }, busAttendance: {}, meetingLocs: [], dismissalLocs: [] };
let commAttState = {
currentJuncture: null,
selectedGroups: [],
selectedMeets: [],
selectedDismissals: [],
searchQuery: ""
}; 

// BUS STATE
let busState = {
currentJuncture: null,
busOptions: ['Bus 1'], // Default to one bus
searchQuery: ""
};

let pendingCommAttUpdates = {};
let isCommAttSyncing = false;
let commAttSyncTimeout = null;
let commAttPollInterval = null;
let commAttFiltersChanged = false;
let lastCommAttLocalChange = 0;

// Caches for Outing Message and Config
let outingDetailsCache = {};
let currentEditSheetUrl = null;

function hasPendingUpdates() {
for(let junc in pendingCommAttUpdates) {
if(Object.keys(pendingCommAttUpdates[junc]).length > 0) return true;
}
return false;
}

// Data enforcement hook to guarantee foundational UI state integrity
function ensureMeetingJuncture() {
if (!commAttData) return;
if (!commAttData.junctures) commAttData.junctures = [];
if (!commAttData.busJunctures) commAttData.busJunctures = [];
if (!commAttData.junctures.includes("Meeting")) {
commAttData.junctures.unshift("Meeting");
}
if (!commAttData.attendance) commAttData.attendance = {};
if (!commAttData.busAttendance) commAttData.busAttendance = {};
if (!commAttData.attendance['Meeting']) commAttData.attendance['Meeting'] = {};
if (!commAttData.attendance['__GONE_HOME__']) commAttData.attendance['__GONE_HOME__'] = {};

// Ensure bus attendance structures exist for tracked bus junctures
// and safely migrate any legacy exact-name matches to composite keys
commAttData.busJunctures.forEach(bj => {
let prefix = bj.type === 'meet' ? 'Meeting: ' : 'Dismissal: ';
let compositeName = prefix + bj.name;

if (commAttData.busAttendance[bj.name] && !commAttData.busAttendance[compositeName]) {
    commAttData.busAttendance[compositeName] = Object.assign({}, commAttData.busAttendance[bj.name]);
}

if (!commAttData.busAttendance[compositeName]) {
    commAttData.busAttendance[compositeName] = {};
}
});

// Remove the legacy keys to prevent duplicate entries in the UI dropdown
commAttData.busJunctures.forEach(bj => {
if (commAttData.busAttendance[bj.name]) {
    delete commAttData.busAttendance[bj.name];
}
});
}

function loadSheets(viewId, forceRefresh = false) {
let selectorId, loadingId;
if (viewId === 'comm') { 
selectorId = 'commSheetSelector'; 
loadingId = 'commSheetSpinner'; 
} else if (viewId === 'actual-attendance') {
selectorId = 'actualSheetSelector'; 
loadingId = 'actualSheetSpinner'; 
} else { 
selectorId = 'volSheetSelector'; 
loadingId = 'volSheetSpinner'; 
}

const selector = document.getElementById(selectorId);
const spinner = document.getElementById(loadingId);
const listContainer = document.getElementById('upcomingList');

const renderData = (data) => {
currentSheetList = data;
if (selector) {
selector.innerHTML = '';
selector.disabled = false;
data.forEach(item => {
 let opt = document.createElement('option');
 opt.value = item.sheetUrl;
 opt.text = item.displayName;
 selector.appendChild(opt);
});

const closest = window.getClosestEventUrl ? window.getClosestEventUrl(data) : data[0].sheetUrl;
if (closest) {
 selector.value = closest;
} else {
 selector.selectedIndex = 0;
}
}

if (viewId === 'volunteer' && typeof resetVolForm === 'function') {
resetVolForm();
} else if (viewId === 'actual-attendance' && data.length === 1) {
if (typeof launchLiveTracker === 'function') setTimeout(() => launchLiveTracker(), 100);
}

if (viewId === 'comm' && listContainer) {
renderCommDashboardCards(data);
}
};

const localDataStr = localStorage.getItem('myg_sheetList');

// Zero-Latency LocalStorage Hydration logic
if (!forceRefresh && localDataStr) {
try {
const parsed = JSON.parse(localDataStr);
if (parsed && parsed.length > 0) {
 renderData(parsed);
 
 // Silent background update to re-verify
 if(spinner) spinner.classList.remove('hidden');
 apiCall('getRecentOutingSheets', null).then(res => {
     if(spinner) spinner.classList.add('hidden');
     if (res.success && JSON.stringify(res.data) !== localDataStr) {
         localStorage.setItem('myg_sheetList', JSON.stringify(res.data));
         renderData(res.data);
     }
 });
 return;
}
} catch(e) {}
}

if (selector) {
selector.innerHTML = '<option disabled selected>↻ Loading events...</option>';
selector.disabled = true;
}
if(spinner) spinner.classList.remove('hidden');

if(viewId === 'comm' && listContainer) {
document.getElementById('scrubBtn').disabled = true;
document.getElementById('scrubBtn').classList.add('opacity-50', 'cursor-not-allowed');
document.getElementById('manualPairBtn').disabled = true;
document.getElementById('manualPairBtn').classList.add('opacity-50', 'cursor-not-allowed');
document.getElementById('groupBtn').disabled = true;
document.getElementById('groupBtn').classList.add('opacity-50', 'cursor-not-allowed');
document.getElementById('manualGroupBtn').disabled = true;
document.getElementById('manualGroupBtn').classList.add('opacity-50', 'cursor-not-allowed');
const assignBtn = document.getElementById('assignICBtn');
if (assignBtn) {
assignBtn.disabled = true;
assignBtn.classList.add('opacity-50', 'cursor-not-allowed');
}

// Implement Skeleton UI
let skeletonHtml = '';
for(let i=0; i<3; i++) {
skeletonHtml += `
<div class="animate-pulse flex flex-col gap-3 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
<div class="flex justify-between items-start">
 <div class="space-y-2 w-1/2">
     <div class="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-3/4"></div>
     <div class="h-3 bg-gray-100 dark:bg-zinc-800/60 rounded w-1/2"></div>
 </div>
 <div class="flex gap-2">
     <div class="w-8 h-8 bg-gray-200 dark:bg-zinc-800 rounded"></div>
     <div class="w-8 h-8 bg-gray-200 dark:bg-zinc-800 rounded"></div>
 </div>
</div>
<div class="h-12 bg-gray-50 dark:bg-zinc-800/50 rounded w-full mt-1"></div>
</div>`;
}
listContainer.innerHTML = skeletonHtml;
}

apiCall('getRecentOutingSheets', null).then(res => {
if(spinner) spinner.classList.add('hidden');

if (res.success) {
localStorage.setItem('myg_sheetList', JSON.stringify(res.data));
if(res.data.length > 0) {
 renderData(res.data);
} else {
 if (selector) {
     selector.disabled = false;
     selector.innerHTML = '<option disabled selected>No upcoming events</option>';
 }
 if(viewId === 'comm' && listContainer) {
     listContainer.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400 italic">No upcoming outings found.</p>';
 }
}
} else {
if (selector) {
 selector.disabled = false;
 selector.innerHTML = `<option disabled selected>Error: ${res.message}</option>`;
}
if(viewId === 'comm' && listContainer) {
 listContainer.innerHTML = `<p class="text-xs text-red-500 italic font-bold">Failed to load events: ${res.message}</p>`;
}
}
});
}

function renderCommDashboardCards(data) {
const listContainer = document.getElementById('upcomingList');
if(!listContainer) return;

listContainer.innerHTML = '';
outingReminders = {}; 
outingDetailsCache = {};

document.getElementById('scrubBtn').disabled = false;
document.getElementById('scrubBtn').classList.remove('opacity-50', 'cursor-not-allowed');
document.getElementById('manualPairBtn').disabled = false;
document.getElementById('manualPairBtn').classList.remove('opacity-50', 'cursor-not-allowed');
document.getElementById('groupBtn').disabled = false;
document.getElementById('groupBtn').classList.remove('opacity-50', 'cursor-not-allowed');
document.getElementById('manualGroupBtn').disabled = false;
document.getElementById('manualGroupBtn').classList.remove('opacity-50', 'cursor-not-allowed');
const assignBtn = document.getElementById('assignICBtn');
if (assignBtn) {
assignBtn.disabled = false;
assignBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

let allCards = '';
data.forEach((item, index) => {
allCards += `
<div class="flex flex-col gap-2 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm relative transition-colors">
<div class="flex justify-between items-start">
<div>
<div class="font-bold text-gray-900 dark:text-white text-sm">${item.displayName}</div>
<div class="text-gray-500 dark:text-gray-400 text-xs">${item.formattedDate}</div>
<div id="pending-badge-${index}" class="mt-1 hidden"></div>
</div>
<div class="flex gap-2 text-xs">
<button onclick="openEditOutingModal(${index})" class="p-2 bg-gray-100 dark:bg-zinc-800 rounded text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors" title="Edit Outing"><i class="fa-solid fa-pen text-base"></i></button>
<a href="${item.folderUrl}" target="_blank" class="p-2 bg-gray-100 dark:bg-zinc-800 rounded text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"><i class="fa-regular fa-folder-open text-base"></i></a>
<a href="${item.sheetUrl}" target="_blank" class="p-2 bg-gray-100 dark:bg-zinc-800 rounded text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300 transition-colors"><i class="fa-regular fa-file-excel text-base"></i></a>
</div>
</div>
<div id="stats-${index}" class="animate-pulse mt-2"><div class="h-12 bg-gray-100 dark:bg-zinc-800 rounded w-full"></div></div>
<div id="btn-group-${index}" class="hidden grid grid-cols-3 gap-1.5 md:gap-2 mt-2 pt-3 border-t border-gray-100 dark:border-zinc-800">
<button onclick="openReminderModal('${index}')" class="bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 py-1.5 px-1 rounded border border-gray-200 dark:border-zinc-700 transition-colors flex items-center justify-center gap-1 overflow-hidden" title="Remind">
<i class="fa-solid fa-bell text-sm md:text-base shrink-0"></i>
<span class="text-[10px] md:text-[11px] font-semibold truncate">Remind</span>
</button>
<button onclick="copyOutingMessage('${index}', this)" class="bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 py-1.5 px-1 rounded border border-gray-200 dark:border-zinc-700 transition-colors flex items-center justify-center gap-1 overflow-hidden" title="Copy Info">
<i class="fa-regular fa-copy text-sm md:text-base shrink-0"></i>
<span class="text-[10px] md:text-[11px] font-semibold truncate">Copy Info</span>
</button>
<button onclick="openShareTableFromComm('${item.sheetUrl}')" class="bg-gray-50 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 py-1.5 px-1 rounded border border-gray-200 dark:border-zinc-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors flex items-center justify-center gap-1 overflow-hidden" title="Take Screenshot for Volunteers">
<i class="fa-solid fa-camera text-sm md:text-base shrink-0"></i>
<span class="text-[9px] md:text-[11px] font-semibold leading-tight text-center whitespace-normal">Screenshot for Vol</span>
</button>
</div>
</div>`;
});
listContainer.innerHTML = allCards;

let currentIndex = 0;
const MAX_STATS_TO_FETCH = 6; 
const fetchBatchStats = () => {
const batch = data.slice(currentIndex, currentIndex + 2); 
if (batch.length === 0 || currentIndex >= MAX_STATS_TO_FETCH) {
for (let i = currentIndex; i < data.length; i++) {
const container = document.getElementById(`stats-${i}`);
if (container) {
  container.innerHTML = '<span class="text-gray-400 italic text-[10px]">Stats skipped to preserve quota</span>';
  container.classList.remove('animate-pulse');
}
}
return;
}

Promise.all(batch.map((item, localIdx) => {
const globalIdx = currentIndex + localIdx;
return fetchOutingStats(item.sheetUrl, globalIdx);
})).then(() => {
currentIndex += 2;
if (currentIndex < Math.min(data.length, MAX_STATS_TO_FETCH)) {
setTimeout(fetchBatchStats, 1500); 
} else {
for (let i = currentIndex; i < data.length; i++) {
  const container = document.getElementById(`stats-${i}`);
  if (container) {
      container.innerHTML = '<span class="text-gray-400 italic text-[10px]">Stats skipped to preserve quota</span>';
      container.classList.remove('animate-pulse');
  }
}
}
});
};
fetchBatchStats();
}

function fetchOutingStats(url, index) {
return apiCall('getOutingDetails', url).then(res => {
const container = document.getElementById(`stats-${index}`);
const btnGroup = document.getElementById(`btn-group-${index}`);
if(res.success) {
outingDetailsCache[index] = { config: res.outingConfig, message: res.outingMessage };

let html = '<table class="w-full text-[10px] md:text-xs text-left border-collapse"><tr class="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-zinc-700"><th class="pb-1">Proj</th><th class="text-center pb-1">Trainees</th><th class="text-center pb-1">CG</th><th class="text-center pb-1">Vols</th></tr>';

let total_tY = 0, total_tTot = 0, total_cY = 0, total_vY = 0, total_vTot = 0;
const sortedKeys = Object.keys(res.stats).sort();

for(const proj of sortedKeys) {
total_tY += res.stats[proj].tY;
total_tTot += res.stats[proj].tTot;
total_cY += res.stats[proj].cY;
total_vY += res.stats[proj].vY;
total_vTot += res.stats[proj].vTot;
}

const standardProjects = sortedKeys.filter(k => k !== 'Unassigned');

if(sortedKeys.length === 0) {
html += '<tr><td colspan="4" class="text-center py-3 text-gray-400 dark:text-gray-500 italic">No data yet</td></tr>';
} else {
for(const proj of standardProjects) {
const d = res.stats[proj];
html += `<tr class="border-b border-gray-100 dark:border-zinc-800/50 last:border-0"><td class="py-1.5 font-bold text-gray-700 dark:text-gray-300">${proj}</td><td class="text-center text-gray-500 dark:text-gray-400"><span class="text-gray-900 dark:text-white">${d.tY}</span>/${d.tTot}</td><td class="text-center text-gray-900 dark:text-white">${d.cY}</td><td class="text-center text-gray-500 dark:text-gray-400"><span class="text-gray-900 dark:text-white">${d.vY}</span>/${d.vTot}</td></tr>`;
}

// Total Row
html += `<tr class="border-y-2 border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50"><td class="py-1.5 font-black text-gray-900 dark:text-white">Total</td><td class="text-center text-gray-700 dark:text-gray-300 font-bold"><span class="text-gray-900 dark:text-white">${total_tY}</span>/${total_tTot}</td><td class="text-center text-gray-900 dark:text-white font-bold">${total_cY}</td><td class="text-center text-gray-700 dark:text-gray-300 font-bold"><span class="text-gray-900 dark:text-white">${total_vY}</span>/${total_vTot}</td></tr>`;

// Unassigned Row
if(res.stats['Unassigned']) {
const d = res.stats['Unassigned'];
html += `<tr class="opacity-60"><td class="py-1.5 font-bold text-gray-500 dark:text-gray-400 italic">Unassigned</td><td class="text-center text-gray-500 dark:text-gray-400 italic"><span class="text-gray-700 dark:text-gray-300">${d.tY}</span>/${d.tTot}</td><td class="text-center text-gray-700 dark:text-gray-300 italic">${d.cY}</td><td class="text-center text-gray-500 dark:text-gray-400 italic"><span class="text-gray-700 dark:text-gray-300">${d.vY}</span>/${d.vTot}</td></tr>`;
}
}
html += '</table>';
container.innerHTML = html;
container.classList.remove('animate-pulse');

let msg = "";
if(res.pending && res.pending.length > 0) {
const list = res.pending.join('\n');
msg = `Hello👋, gentle reminder for volunteers of these trainees to update their attendance by tomorrow:\n${list}\n\nVolunteers please update your own attendance as well, Thank You!!🙏`;
} else {
msg = "Great news! All trainees have updated their attendance.\n\nVolunteers please ensure your own attendance is updated too, Thank You!!🙏";
}
outingReminders[index] = msg;
if(btnGroup) btnGroup.classList.remove('hidden');
} else {
container.innerHTML = `<span class="text-red-500 dark:text-red-400" title="${res.message || 'Unknown error'}">Error loading stats</span>`;
container.classList.remove('animate-pulse');
}
});
}

function openReminderModal(index) {
const msg = outingReminders[index];
if(!msg) return;
document.getElementById('modalReminderText').value = msg;
document.getElementById('reminderModal').classList.remove('hidden');
}

function closeReminderModal() { document.getElementById('reminderModal').classList.add('hidden'); }
function copyFromModal(btn) { performCopy(document.getElementById('modalReminderText').value, btn); }

function copyOutingMessage(index, btn) {
const cache = outingDetailsCache[index];
if(cache && cache.message) {
performCopy(cache.message, btn);
} else {
alert("No message configured in the template yet.");
}
}

function performCopy(text, btn) {
navigator.clipboard.writeText(text).then(() => {
const original = btn.innerHTML;
btn.innerHTML = '<i class="fa-solid fa-check text-sm md:text-base shrink-0"></i><span class="text-[10px] md:text-[11px] font-semibold truncate">Copied!</span>';
btn.classList.add('text-green-600', 'dark:text-green-400', 'border-green-200', 'dark:border-green-800');
setTimeout(() => {
btn.innerHTML = original;
btn.classList.remove('text-green-600', 'dark:text-green-400', 'border-green-200', 'dark:border-green-800');
}, 2000);
});
}

function handlePair() { 
const url = document.getElementById('commSheetSelector').value; 
const btn = document.getElementById('scrubBtn'); 
const status = document.getElementById('scrubStatus'); 
if(!url || url.includes("Select") || url.includes("Loading") || url.includes("Error")) return alert("Select an event first"); 
btn.disabled = true; 
btn.innerText = "Pairing..."; 
status.classList.add('hidden'); 
apiCall('runAutoPairing', url).then(res => { 
btn.disabled = false; 
btn.innerText = "Auto Pair"; 
showFlashMessage('scrubStatus', res.message, res.success ? 'success' : 'error'); 
}); 
}

function handleGroup() { 
const url = document.getElementById('commSheetSelector').value; 
const btn = document.getElementById('groupBtn'); 
if(!url || url.includes("Select") || url.includes("Loading") || url.includes("Error")) return alert("Select an event first"); 
btn.disabled = true; 
btn.innerText = "Grouping..."; 
apiCall('runAutoGrouping', url).then(res => { 
btn.disabled = false; 
btn.innerText = "Auto Group"; 
showFlashMessage('scrubStatus', res.message, res.success ? 'success' : 'error'); 
}); 
}

function openShareTableFromComm(sheetUrl) {
showOverlay('loading', 'Generating Table...');
apiCall('fetchManualPairingData', { sheetUrl: sheetUrl }).then(res => {
closeOverlay();
if (res.success) {
groupingData = res.data;
currentGroupingSheetUrl = sheetUrl; // Bind globally for image export Context
openTableExportModal();
} else {
alert("Error: " + res.message);
}
});
}

// === CREATE OUTING LOGIC ===
function openModal() { 
const modal = document.getElementById('createModal'); 
const modalPanel = document.getElementById('modalPanel');
modal.classList.remove('hidden'); 
setTimeout(() => { 
modal.classList.remove('opacity-0'); 
modalPanel.classList.remove('scale-95'); 
modalPanel.classList.add('scale-100'); 
}, 10); 
} 

function closeModal() { 
const modal = document.getElementById('createModal'); 
const modalPanel = document.getElementById('modalPanel');
modal.classList.add('opacity-0'); 
modalPanel.classList.remove('scale-100'); 
modalPanel.classList.add('scale-95'); 
setTimeout(() => { 
modal.classList.add('hidden'); 
}, 300); 
} 

function handleCreate(e) { 
e.preventDefault(); 
showOverlay('loading', 'Creating Outing...');

const form = document.getElementById('outingForm'); 
const formData = { 
eventName: document.getElementById('eventName').value, 
eventDate: document.getElementById('eventDate').value, 
meetingLocs: Array.from(document.getElementsByName('meetingLoc')).map(i=>i.value), 
meetingTimes: Array.from(document.getElementsByName('meetingTime')).map(i=>i.value), 
meetingBuses: Array.from(document.getElementsByName('meetingBus')).map(i=>i.checked), 
dismissalLocs: Array.from(document.getElementsByName('dismissalLoc')).map(i=>i.value), 
dismissalTimes: Array.from(document.getElementsByName('dismissalTime')).map(i=>i.value), 
dismissalBuses: Array.from(document.getElementsByName('dismissalBus')).map(i=>i.checked), 
}; 

apiCall('createOuting', formData).then(res => { 
if(res.success) { 
showOverlay('success', 'Outing Created Successfully!');
closeModal(); 
loadSheets('comm', true); 
showFlashMessage('commGlobalStatus', "Outing Created Successfully!", 'success');
} else { 
showOverlay('error', res.message);
} 
}); 
}

// === EDIT OUTING LOGIC ===
function openEditOutingModal(index) {
const cache = outingDetailsCache[index];
if(!cache || !cache.config) return;
const config = cache.config;

document.getElementById('editEventName').value = config.eventName || "";
document.getElementById('editEventDate').value = config.eventDate || "";

const mLocs = document.getElementsByName('editMeetingLoc');
const mTimes = document.getElementsByName('editMeetingTime');
const mBuses = document.getElementsByName('editMeetingBus');
for(let i=0; i<4; i++) {
mLocs[i].value = config.meetingLocs[i] || "";
mTimes[i].value = config.meetingTimes[i] || "";
mBuses[i].checked = config.meetingBuses && config.meetingBuses[i] === true;
}

const dLocs = document.getElementsByName('editDismissalLoc');
const dTimes = document.getElementsByName('editDismissalTime');
const dBuses = document.getElementsByName('editDismissalBus');
for(let i=0; i<4; i++) {
dLocs[i].value = config.dismissalLocs[i] || "";
dTimes[i].value = config.dismissalTimes[i] || "";
dBuses[i].checked = config.dismissalBuses && config.dismissalBuses[i] === true;
}

currentEditSheetUrl = currentSheetList[index].sheetUrl;

const modal = document.getElementById('editModal'); 
const modalPanel = document.getElementById('editModalPanel');
modal.classList.remove('hidden'); 
setTimeout(() => { 
modal.classList.remove('opacity-0'); 
modalPanel.classList.remove('scale-95'); 
modalPanel.classList.add('scale-100'); 
}, 10); 
}

function closeEditModal() {
const modal = document.getElementById('editModal'); 
const modalPanel = document.getElementById('editModalPanel');
modal.classList.add('opacity-0'); 
modalPanel.classList.remove('scale-100'); 
modalPanel.classList.add('scale-95'); 
setTimeout(() => { 
modal.classList.add('hidden'); 
}, 300); 
}

function handleEditSubmit(e) {
e.preventDefault();
if(!currentEditSheetUrl) return;

showOverlay('loading', 'Updating Outing Details...');

const formData = { 
eventName: document.getElementById('editEventName').value, 
eventDate: document.getElementById('editEventDate').value, 
meetingLocs: Array.from(document.getElementsByName('editMeetingLoc')).map(i=>i.value), 
meetingTimes: Array.from(document.getElementsByName('editMeetingTime')).map(i=>i.value), 
meetingBuses: Array.from(document.getElementsByName('editMeetingBus')).map(i=>i.checked), 
dismissalLocs: Array.from(document.getElementsByName('editDismissalLoc')).map(i=>i.value), 
dismissalTimes: Array.from(document.getElementsByName('dismissalTime')).map(i=>i.value), 
dismissalBuses: Array.from(document.getElementsByName('editDismissalBus')).map(i=>i.checked), 
}; 

apiCall('updateOuting', { sheetUrl: currentEditSheetUrl, form: formData }).then(res => { 
if(res.success) { 
showOverlay('success', 'Outing Details Updated!');
closeEditModal(); 
loadSheets('comm', true); 
showFlashMessage('commGlobalStatus', "Outing Updated Successfully!", 'success');
} else { 
showOverlay('error', res.message);
} 
}); 
}

// === LIVE ATTENDANCE LOGIC ===

function scrollCardIntoViewLocally(cardNode) {
if (!cardNode) return;
const container = cardNode.parentElement;
if (container) {
const containerRect = container.getBoundingClientRect();
const cardRect = cardNode.getBoundingClientRect();
const scrollTop = container.scrollTop + (cardRect.top - containerRect.top) - (containerRect.height / 2) + (cardRect.height / 2);
container.scrollTo({ top: scrollTop, behavior: 'smooth' });
}
}

function loadCommAttendanceData() {
const overlay = document.getElementById('commAttLoadingOverlay');
overlay.classList.remove('hidden');

apiCall('fetchCommAttendance', { sheetUrl: currentCommAttSheetUrl }).then(res => {
overlay.classList.add('hidden');
if (res.success) {
commAttData = res;
ensureMeetingJuncture();
renderCommAttFilters();
renderCommAttJunctures();
startCommAttPolling();
} else {
alert("Error: " + res.message);
window.navigateTo('tracker.html');
}
});
}

function renderCommAttFilters() {
let groups = new Set();
let meets = new Set(commAttData.meetingLocs || []);
let dismissals = new Set(commAttData.dismissalLocs || []);

(commAttData.participants || []).forEach(p => {
if (p.group) groups.add(String(p.group));
});

const sortedGroups = Array.from(groups).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
const sortedMeets = Array.from(meets).sort();
const sortedDismissals = Array.from(dismissals).sort();

commAttState.availableGroups = sortedGroups;
commAttState.availableMeets = sortedMeets;
commAttState.availableDismissals = sortedDismissals;

updateCommAttFilterUI('group', sortedGroups, commAttState.selectedGroups);
updateCommAttFilterUI('meet', sortedMeets, commAttState.selectedMeets);
updateCommAttFilterUI('dismiss', sortedDismissals, commAttState.selectedDismissals);
}

function updateCommAttFilterUI(type, availableItems, selectedArray) {
const btnId = type === 'group' ? 'commAttGroupBtn' : (type === 'meet' ? 'commAttMeetBtn' : 'commAttDismissBtn');
const dropdownId = type === 'group' ? 'commAttGroupDropdown' : (type === 'meet' ? 'commAttMeetDropdown' : 'commAttDismissDropdown');
const btn = document.getElementById(btnId);
const dropdown = document.getElementById(dropdownId);

if(!btn || !dropdown) return;

let btnText = type === 'group' ? 'Grp: ' : (type === 'meet' ? 'Meeting: ' : 'Dismissal: ');

if (selectedArray.length === 0) {
btnText += 'All';
btn.classList.remove('ring-1', 'ring-gray-900', 'dark:ring-gray-100');
} else {
btnText += `(${selectedArray.length})`;
btn.classList.add('ring-1', 'ring-gray-900', 'dark:ring-gray-100');
}

btn.innerText = btnText;

let html = `<div class="p-1.5 flex justify-between border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-black sticky top-0 z-10">
<button onclick="clearCommAttFilter('${type}', event)" class="text-[10px] bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded transition">Clear</button>
<button onclick="closeAllCommAttFilters(event)" class="text-[10px] bg-primary hover:bg-blue-600 text-white px-3 py-1 rounded transition">Done</button>
</div>`;

if (availableItems.length === 0) {
html += `<div class="p-2 text-center text-xs text-gray-500 dark:text-gray-400 italic">No options</div>`;
} else {
availableItems.forEach(item => {
const isChecked = selectedArray.includes(item);
html += `
<div class="px-3 py-2 border-b border-gray-100 dark:border-zinc-800 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between transition-colors" onclick="toggleCommAttFilterItem('${type}', '${item.replace(/'/g, "\\'")}', event)">
<span class="text-xs text-gray-700 dark:text-gray-300 font-bold break-words pr-2">${type === 'group' ? 'Grp ' + item : item}</span>
<div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isChecked ? 'bg-blue-500 border-blue-600 text-white' : 'bg-gray-100 border-gray-300 dark:bg-black dark:border-zinc-600 text-transparent'}">
<i class="fa-solid fa-check text-[10px]"></i>
</div>
</div>`;
});
}

const scrollTop = dropdown.scrollTop;
dropdown.innerHTML = html;
dropdown.scrollTop = scrollTop;
}

function toggleCommAttFilter(type) {
const dropdownId = type === 'group' ? 'commAttGroupDropdown' : (type === 'meet' ? 'commAttMeetDropdown' : 'commAttDismissDropdown');
const dropdown = document.getElementById(dropdownId);

const wasHidden = dropdown.classList.contains('hidden');

closeAllCommAttFilters();

if (wasHidden) {
dropdown.classList.remove('hidden');
}
}

function closeAllCommAttFilters(e) {
if (e) e.stopPropagation();
['commAttGroupDropdown', 'commAttMeetDropdown', 'commAttDismissDropdown'].forEach(id => {
const el = document.getElementById(id);
if(el) el.classList.add('hidden');
});

if (commAttFiltersChanged) {
changeCommAttContext();
commAttFiltersChanged = false;
}
}

document.addEventListener('click', function(e) {
const isDropdownClick = e.target.closest('#commAttGroupDropdown') || 
e.target.closest('#commAttMeetDropdown') || 
e.target.closest('#commAttDismissDropdown');

const isBtnClick = e.target.closest('#commAttGroupBtn') || 
e.target.closest('#commAttMeetBtn') || 
e.target.closest('#commAttDismissBtn');

if (!isDropdownClick && !isBtnClick) {
closeAllCommAttFilters();
}
});

function toggleCommAttFilterItem(type, item, e) {
if (e) e.stopPropagation();

let targetArray = type === 'group' ? commAttState.selectedGroups : (type === 'meet' ? commAttState.selectedMeets : commAttState.selectedDismissals);
const available = type === 'group' ? commAttState.availableGroups : (type === 'meet' ? commAttState.availableMeets : commAttState.availableDismissals);

const index = targetArray.indexOf(item);
if (index > -1) {
targetArray.splice(index, 1);
} else {
targetArray.push(item);
}

commAttFiltersChanged = true;
updateCommAttFilterUI(type, available, targetArray);
}

function clearCommAttFilter(type, e) {
if (e) e.stopPropagation();

if (type === 'group') commAttState.selectedGroups = [];
if (type === 'meet') commAttState.selectedMeets = [];
if (type === 'dismiss') commAttState.selectedDismissals = [];

const available = type === 'group' ? commAttState.availableGroups : (type === 'meet' ? commAttState.availableMeets : commAttState.availableDismissals);

commAttFiltersChanged = true;
updateCommAttFilterUI(type, available, []);
}

function renderCommAttJunctures() {
const select = document.getElementById('commAttJunctureSelect');
if(!select) return;
select.innerHTML = '';

commAttData.junctures.forEach(j => {
if (j.startsWith('__BUS__')) return;
select.innerHTML += `<option value="${j}">${j}</option>`;
});

if (commAttState.currentJuncture && commAttData.junctures.includes(commAttState.currentJuncture)) {
select.value = commAttState.currentJuncture;
} else {
commAttState.currentJuncture = "Meeting";
select.value = "Meeting";
}

changeCommAttContext();
}

function changeCommAttContext() {
const select = document.getElementById('commAttJunctureSelect');
if(select) commAttState.currentJuncture = select.value;

renderCommAttLists();
}

function renderCommAttLists() {
const notCheckedList = document.getElementById('commAttNotCheckedList');
const checkedList = document.getElementById('commAttCheckedList');
const goneHomeList = document.getElementById('commAttGoneHomeList');

if (!notCheckedList || !checkedList || !goneHomeList) return;

const scrollNC = notCheckedList.scrollTop;
const scrollC = checkedList.scrollTop;
const scrollGH = goneHomeList.scrollTop;

const juncture = commAttState.currentJuncture;

let notCheckedHtml = '';
let checkedHtml = '';
let goneHomeHtml = '';
let notCheckedCount = 0;
let checkedCount = 0;
let goneHomeCount = 0;

let participants = commAttData.participants || [];

let globalUnpairedCount = 0;
participants.forEach(p => {
const isGoneHome = commAttData.attendance['__GONE_HOME__'] && commAttData.attendance['__GONE_HOME__'][p.name] === true;
if (!isGoneHome && (!p.volPaired || p.volPaired.trim() === '')) {
globalUnpairedCount++;
}
});
updateUnpairedNotification(globalUnpairedCount);

// SORTING: By Group (numeric) then Name (alphabetical)
participants.sort((a, b) => {
const grpA = a.group ? a.group.toString().toLowerCase() : "zzzz";
const grpB = b.group ? b.group.toString().toLowerCase() : "zzzz";
const groupCmp = grpA.localeCompare(grpB, undefined, {numeric: true});
if (groupCmp !== 0) return groupCmp;
return a.name.localeCompare(b.name);
});

if (commAttState.selectedGroups.length > 0) {
participants = participants.filter(p => commAttState.selectedGroups.includes(String(p.group)));
}
if (commAttState.selectedMeets.length > 0) {
participants = participants.filter(p => commAttState.selectedMeets.includes(String(p.meetingLoc)));
}
if (commAttState.selectedDismissals.length > 0) {
participants = participants.filter(p => commAttState.selectedDismissals.includes(String(p.dismissalLoc)));
}

if (commAttState.searchQuery) {
const query = commAttState.searchQuery;
participants = participants.filter(p => 
   p.name.toLowerCase().includes(query) || 
   (p.group && String(p.group).toLowerCase().includes(query)) ||
   (p.volPaired && p.volPaired.toLowerCase().includes(query)) ||
   (p.meetingLoc && p.meetingLoc.toLowerCase().includes(query)) ||
   (p.dismissalLoc && p.dismissalLoc.toLowerCase().includes(query))
);
}

participants.forEach(p => {
const isGoneHome = commAttData.attendance['__GONE_HOME__'] && commAttData.attendance['__GONE_HOME__'][p.name] === true;
const isChecked = juncture && commAttData.attendance[juncture] ? commAttData.attendance[juncture][p.name] === true : false;

const cardHtml = generateCommAttCard(p, isChecked, isGoneHome);

if (isGoneHome) {
goneHomeHtml += cardHtml;
goneHomeCount++;
} else if (isChecked) {
checkedHtml += cardHtml;
checkedCount++;
} else {
notCheckedHtml += cardHtml;
notCheckedCount++;
}
});

notCheckedList.innerHTML = notCheckedHtml || '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';
checkedList.innerHTML = checkedHtml || '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';
goneHomeList.innerHTML = goneHomeHtml || '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';

document.getElementById('commAttNotCheckedCount').textContent = notCheckedCount;
document.getElementById('commAttCheckedCount').textContent = checkedCount;
document.getElementById('commAttGoneHomeCount').textContent = goneHomeCount;

notCheckedList.scrollTop = scrollNC;
checkedList.scrollTop = scrollC;
goneHomeList.scrollTop = scrollGH;

document.querySelectorAll('.comm-att-card').forEach(el => {
uiBindLongPress(el, () => {
const name = el.getAttribute('data-name');
const p = (commAttData.participants || []).find(x => x.name.replace(/'/g, "\\'") === name);
if (p) {
   if (commAttState.searchQuery) {
       commAttState.searchQuery = "";
       document.getElementById('commAttSearchInput').value = "";
       if (typeof toggleClearBtn === 'function') toggleClearBtn('commAttSearchInput');
       renderCommAttLists();
   }
   showPersonInfo(p);
}
});
});
}

function generateCommAttCard(p, isChecked, isGoneHome) {
const safeName = p.name.replace(/'/g, "\\'");

const caregiverBadge = p.caregivers > 0 ? `<span class="inline-flex shrink-0 items-center justify-center min-w-[16px] md:min-w-[20px] h-4 md:h-5 px-1 bg-red-500 rounded-full text-[9px] md:text-[11px] font-black text-white shadow-sm mt-px" title="${p.caregivers} Caregiver(s)">${p.caregivers > 1 ? p.caregivers + 'C' : 'C'}</span>` : '';

let volHtml = '';
if (p.volPaired) {
const vols = p.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
if (vols.length > 0) {
volHtml = vols.map(v => `<span class="text-[9px] md:text-[11px] text-teal-700 dark:text-teal-400 leading-tight font-bold bg-teal-50 dark:bg-teal-900/30 px-1.5 md:px-2 py-0.5 md:py-1 rounded border border-teal-200 dark:border-teal-800/50 whitespace-normal break-words w-fit max-w-full text-left"><i class="fa-solid fa-handshake-angle mr-1"></i>${v}</span>`).join('');
}
} else if (!isGoneHome) {
volHtml = `<span class="text-[9px] md:text-[11px] text-red-700 dark:text-red-400 leading-tight font-black bg-red-50 dark:bg-red-900/30 px-1.5 md:px-2 py-0.5 md:py-1 rounded border border-red-200 dark:border-red-800/50 whitespace-normal break-words w-fit max-w-full text-left uppercase"><i class="fa-solid fa-circle-exclamation mr-1"></i>Unpaired</span>`;
}

let starBadge = '';
if (p.extra && p.extra.t_one_on_one) {
const oneOnOneRaw = String(p.extra.t_one_on_one).trim().toLowerCase();
if (oneOnOneRaw !== '' && !['no', 'n', 'false', '0'].includes(oneOnOneRaw)) {
starBadge = `<i class="fa-solid fa-star text-yellow-500 shrink-0 text-[10px] md:text-xs ml-1" title="1-1 Pairing Required: ${String(p.extra.t_one_on_one).replace(/"/g, '&quot;')}"></i>`;
}
}

let remarksBadge = '';
let remarkContent = null;
if (p.extra && p.extra.remark) {
remarkContent = String(p.extra.remark).trim();
}
if (remarkContent) {
remarksBadge = `<i class="fa-solid fa-note-sticky text-yellow-500 dark:text-yellow-400 shrink-0 text-xs ml-1 cursor-help" title="${remarkContent.replace(/"/g, '&quot;')}"></i>`;
}

let locHtml = '';
if (p.meetingLoc || p.dismissalLoc) {
locHtml = '<div class="flex flex-col gap-1 w-full mt-1 border-t border-gray-100 dark:border-zinc-700/60 pt-1.5">';
if (p.meetingLoc) {
locHtml += `<span class="text-[9px] md:text-[11px] text-blue-700 dark:text-blue-300 leading-tight bg-blue-50 dark:bg-blue-900/20 px-1.5 md:px-2 py-1 md:py-1.5 rounded whitespace-normal break-words w-full text-left"><i class="fa-solid fa-location-dot mr-1 text-blue-500 dark:text-blue-400"></i>Meeting: ${p.meetingLoc}</span>`;
}
if (p.dismissalLoc) {
locHtml += `<span class="text-[9px] md:text-[11px] text-purple-700 dark:text-purple-300 leading-tight bg-purple-50 dark:bg-purple-900/20 px-1.5 md:px-2 py-1 md:py-1.5 rounded whitespace-normal break-words w-full text-left"><i class="fa-solid fa-flag-checkered mr-1 text-purple-500 dark:text-purple-400"></i>Dismissal: ${p.dismissalLoc}</span>`;
}
locHtml += '</div>';
}

const groupBadge = p.group ? `<span class="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800 border px-1.5 md:px-2 py-0.5 md:py-1 rounded font-black text-[9px] md:text-[11px] uppercase shadow-sm whitespace-nowrap">Grp ${p.group}</span>` : '';

const homeBtnClass = isGoneHome ? 'bg-blue-500 text-white border-blue-600 shadow-inner' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-500';
const checkBtnClass = isChecked ? 'bg-green-500 border-green-600 text-white shadow-inner' : 'bg-gray-50 dark:bg-black border-gray-300 dark:border-zinc-600 text-transparent';

return `
<div id="comm-att-card-${p.name.replace(/[^a-zA-Z0-9]/g, '')}" 
data-name="${safeName}"
class="comm-att-card relative bg-white dark:bg-zinc-900 p-2 md:p-3 rounded border border-gray-200 dark:border-zinc-700 shadow-sm transition-all duration-300 flex flex-col gap-1.5 md:gap-2 select-none active:scale-95 cursor-pointer hover:border-teal-500" 
onclick="toggleCommAttStatus('${safeName}', ${!isChecked}, event)">
<div class="flex items-start gap-1.5 md:gap-2 w-full">
<span class="font-extrabold text-xs md:text-sm text-gray-900 dark:text-white leading-tight break-words">${p.name}</span>
${starBadge}
${remarksBadge}
${caregiverBadge}
</div>
<div class="flex justify-between items-center w-full">
<div class="shrink-0 flex items-center">
${groupBadge}
</div>
<div class="shrink-0 flex items-center gap-1.5 md:gap-2">
<button onclick="toggleGoneHomeStatus('${safeName}', ${!isGoneHome}, event)" class="w-6 h-6 md:w-8 md:h-8 rounded flex items-center justify-center border transition-colors ${homeBtnClass}" title="Toggle Gone Home">
<i class="fa-solid fa-house-user text-[10px] md:text-xs"></i>
</button>
<div class="w-6 h-6 md:w-8 md:h-8 rounded flex items-center justify-center border transition-colors ${checkBtnClass}">
<i class="fa-solid fa-check text-xs md:text-sm"></i>
</div>
</div>
</div>
${volHtml ? `<div class="flex flex-col gap-1 md:gap-1.5 w-full">${volHtml}</div>` : ''}
${locHtml}
</div>`;
}

// TARGETED OPTIMISTIC UI LOGIC
function updateCommAttCardDOM(name) {
const p = (commAttData.participants || []).find(x => x.name === name);
if (!p) return;

const juncture = commAttState.currentJuncture;
const isGoneHome = commAttData.attendance['__GONE_HOME__'] && commAttData.attendance['__GONE_HOME__'][p.name] === true;
const isChecked = juncture && commAttData.attendance[juncture] ? commAttData.attendance[juncture][p.name] === true : false;

const cardId = `comm-att-card-${p.name.replace(/[^a-zA-Z0-9]/g, '')}`;
const existingCard = document.getElementById(cardId);

const newHtml = generateCommAttCard(p, isChecked, isGoneHome);

let targetListId = 'commAttNotCheckedList';
if (isGoneHome) targetListId = 'commAttGoneHomeList';
else if (isChecked) targetListId = 'commAttCheckedList';

const targetList = document.getElementById(targetListId);
let pulseClass = isGoneHome ? 'pulse-blue' : (isChecked ? 'pulse-green' : 'pulse-red');

if (existingCard) {
const currentListId = existingCard.parentElement.id;
if (currentListId === targetListId) {
existingCard.outerHTML = newHtml;
rebindCommAttCard(cardId, p);

const newNode = document.getElementById(cardId);
if (newNode) applyCardPulse(newNode, pulseClass);
} else {
// Smoothly collapse
existingCard.style.overflow = 'hidden';
existingCard.style.minHeight = '0';
existingCard.style.transition = 'opacity 0.2s ease, height 0.3s ease, margin 0.3s ease, padding 0.3s ease';
existingCard.style.height = existingCard.offsetHeight + 'px';

// Trigger Reflow
void existingCard.offsetHeight;

existingCard.style.opacity = '0';
existingCard.style.height = '0px';
existingCard.style.margin = '0px';
existingCard.style.padding = '0px';
existingCard.style.border = 'none';

setTimeout(() => {
existingCard.remove();

const temp = document.createElement('div');
temp.innerHTML = newHtml;
const newNode = temp.firstElementChild;

newNode.style.opacity = '0';
newNode.style.transform = 'translateY(-10px)';
newNode.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

insertCardSorted(targetList, newNode, p);

// Trigger Reflow
void newNode.offsetWidth;

newNode.style.opacity = '1';
newNode.style.transform = 'translateY(0)';

updateCommAttCountsDOM();
rebindCommAttCard(cardId, p);

scrollCardIntoViewLocally(newNode);
setTimeout(() => {
   applyCardPulse(newNode, pulseClass);
}, 400); // Trigger pulse exactly when smooth scroll lands
}, 300);
}
}
}

function applyCardPulse(node, pulseClass) {
node.classList.add(pulseClass);
setTimeout(() => { node.classList.remove(pulseClass); }, 800);
}

function rebindCommAttCard(cardId, p) {
const card = document.getElementById(cardId);
if (card) {
uiBindLongPress(card, () => {
const pObj = (commAttData.participants || []).find(x => x.name === p.name);
if (pObj) {
   if (commAttState.searchQuery) {
       commAttState.searchQuery = "";
       document.getElementById('commAttSearchInput').value = "";
       if (typeof toggleClearBtn === 'function') toggleClearBtn('commAttSearchInput');
       renderCommAttLists();
   }
   showPersonInfo(pObj);
}
});
}
}

function insertCardSorted(listEl, newCardNode, pData) {
const children = Array.from(listEl.children).filter(c => c.classList.contains('comm-att-card') || c.classList.contains('bus-att-card'));
let inserted = false;
for (let child of children) {
const childName = child.getAttribute('data-name');
const childP = commAttData.participants.find(x => x.name.replace(/'/g, "\\'") === childName);
if (childP) {
const grpA = pData.group ? pData.group.toString().toLowerCase() : "zzzz";
const grpB = childP.group ? childP.group.toString().toLowerCase() : "zzzz";
let groupCmp = grpA.localeCompare(grpB, undefined, {numeric: true});
if (groupCmp < 0 || (groupCmp === 0 && pData.name.localeCompare(childP.name) < 0)) {
listEl.insertBefore(newCardNode, child);
inserted = true;
break;
}
}
}
if (!inserted) {
listEl.appendChild(newCardNode);
}
}

function updateCommAttCountsDOM() {
const juncture = commAttState.currentJuncture;
let nc = 0, c = 0, gh = 0;
let globalUnpairedCount = 0;

(commAttData.participants || []).forEach(p => {
const isGoneHome = commAttData.attendance['__GONE_HOME__'] && commAttData.attendance['__GONE_HOME__'][p.name] === true;
const isChecked = juncture && commAttData.attendance[juncture] ? commAttData.attendance[juncture][p.name] === true : false;

if (!isGoneHome && (!p.volPaired || p.volPaired.trim() === '')) {
globalUnpairedCount++;
}

// Ignore counts for items filtered out
if (commAttState.selectedGroups.length > 0 && !commAttState.selectedGroups.includes(String(p.group))) return;
if (commAttState.selectedMeets.length > 0 && !commAttState.selectedMeets.includes(String(p.meetingLoc))) return;
if (commAttState.selectedDismissals.length > 0 && !commAttState.selectedDismissals.includes(String(p.dismissalLoc))) return;

if (isGoneHome) gh++;
else if (isChecked) c++;
else nc++;
});

document.getElementById('commAttNotCheckedCount').textContent = nc;
document.getElementById('commAttCheckedCount').textContent = c;
document.getElementById('commAttGoneHomeCount').textContent = gh;
updateUnpairedNotification(globalUnpairedCount);

['commAttNotCheckedList', 'commAttCheckedList', 'commAttGoneHomeList'].forEach(id => {
const el = document.getElementById(id);
if (!el) return;

const cardCount = el.querySelectorAll('.comm-att-card').length;
if (cardCount === 0) {
el.innerHTML = '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';
} else {
const emptyP = el.querySelector('p');
if (emptyP && emptyP.innerText === 'Empty') emptyP.remove();
}
});
}

function triggerSync() {
if (commAttSyncTimeout) clearTimeout(commAttSyncTimeout);
commAttSyncTimeout = setTimeout(() => {
executeCommAttSync();
}, 800);
}

function toggleCommAttStatus(name, forceState, e) {
if(e) e.stopPropagation();

lastCommAttLocalChange = Date.now();
const juncture = commAttState.currentJuncture;
if (!juncture) return;

commAttData.attendance[juncture][name] = forceState;
if (!pendingCommAttUpdates[juncture]) pendingCommAttUpdates[juncture] = {};
pendingCommAttUpdates[juncture][name] = forceState;

if (commAttState.searchQuery) {
commAttState.searchQuery = "";
document.getElementById('commAttSearchInput').value = "";
if (typeof toggleClearBtn === 'function') toggleClearBtn('commAttSearchInput');
renderCommAttLists();
setTimeout(() => {
   const cardNode = document.getElementById(`comm-att-card-${name.replace(/[^a-zA-Z0-9]/g, '')}`);
   if (cardNode) {
       scrollCardIntoViewLocally(cardNode);
       const isGoneHome = commAttData.attendance['__GONE_HOME__'] && commAttData.attendance['__GONE_HOME__'][name] === true;
       const pulseClass = isGoneHome ? 'pulse-blue' : (forceState ? 'pulse-green' : 'pulse-red');
       setTimeout(() => applyCardPulse(cardNode, pulseClass), 400);
   }
}, 50);
} else {
updateCommAttCardDOM(name);
}
triggerSync();
}

function toggleGoneHomeStatus(name, forceState, e) {
if(e) e.stopPropagation();

lastCommAttLocalChange = Date.now();
if (!commAttData.attendance['__GONE_HOME__']) commAttData.attendance['__GONE_HOME__'] = {};

commAttData.attendance['__GONE_HOME__'][name] = forceState;

if (!pendingCommAttUpdates['__GONE_HOME__']) pendingCommAttUpdates['__GONE_HOME__'] = {};
pendingCommAttUpdates['__GONE_HOME__'][name] = forceState;

if (commAttState.searchQuery) {
commAttState.searchQuery = "";
document.getElementById('commAttSearchInput').value = "";
if (typeof toggleClearBtn === 'function') toggleClearBtn('commAttSearchInput');
renderCommAttLists();
setTimeout(() => {
   const cardNode = document.getElementById(`comm-att-card-${name.replace(/[^a-zA-Z0-9]/g, '')}`);
   if (cardNode) {
       scrollCardIntoViewLocally(cardNode);
       const isChecked = juncture && commAttData.attendance[juncture] ? commAttData.attendance[juncture][name] === true : false;
       const pulseClass = forceState ? 'pulse-blue' : (isChecked ? 'pulse-green' : 'pulse-red');
       setTimeout(() => applyCardPulse(cardNode, pulseClass), 400);
   }
}, 50);
} else {
updateCommAttCardDOM(name);
}
triggerSync();
}

function generateColumnText(columnType) {
const juncture = commAttState.currentJuncture;
let participants = commAttData.participants || [];
let listTitle = "";

if (columnType === 'notChecked') listTitle = "NOT PRESENT";
if (columnType === 'checked') listTitle = "PRESENT";
if (columnType === 'goneHome') listTitle = "GONE HOME";

if (commAttState.selectedGroups.length > 0) {
participants = participants.filter(p => commAttState.selectedGroups.includes(String(p.group)));
}
if (commAttState.selectedMeets.length > 0) {
participants = participants.filter(p => commAttState.selectedMeets.includes(String(p.meetingLoc)));
}
if (commAttState.selectedDismissals.length > 0) {
participants = participants.filter(p => commAttState.selectedDismissals.includes(String(p.dismissalLoc)));
}

const targetNames = [];
participants.forEach(p => {
const isGoneHome = commAttData.attendance['__GONE_HOME__'] && commAttData.attendance['__GONE_HOME__'][p.name] === true;
const isChecked = juncture && commAttData.attendance[juncture] ? commAttData.attendance[juncture][p.name] === true : false;

if (columnType === 'goneHome' && isGoneHome) targetNames.push(p.name);
else if (columnType === 'checked' && !isGoneHome && isChecked) targetNames.push(p.name);
else if (columnType === 'notChecked' && !isGoneHome && !isChecked) targetNames.push(p.name);
});

const groupsStr = commAttState.selectedGroups.length > 0 ? "Grp: " + commAttState.selectedGroups.join(", ") : "All Groups";
const meetsStr = commAttState.selectedMeets.length > 0 ? "Meeting: " + commAttState.selectedMeets.join(", ") : "All Meetings";
const dismissStr = commAttState.selectedDismissals.length > 0 ? "Dismissal: " + commAttState.selectedDismissals.join(", ") : "All Dismissals";

let format = DEF_SHARE_FORMAT;

const formattedText = format
.replace(/\{\{Groups\}\}/gi, groupsStr)
.replace(/\{\{Meetings\}\}/gi, meetsStr)
.replace(/\{\{Dismissals\}\}/gi, dismissStr)
.replace(/\{\{Count\}\}/gi, targetNames.length)
.replace(/\{\{List\}\}/gi, targetNames.join('\n'));

return `[${listTitle}]\n${formattedText}`;
}

function copyColumnData(columnType) {
const finalMessage = generateColumnText(columnType);
navigator.clipboard.writeText(finalMessage).then(() => {
showFlashMessage('commGlobalStatus', "List copied to clipboard!", 'success');
}).catch(() => {
alert("Failed to copy list. Clipboard access denied.");
});
}

function shareColumnData(columnType) {
const finalMessage = generateColumnText(columnType);
const listTitle = finalMessage.split('\n')[0].replace(/\[|\]/g, '');

if (navigator.share) {
navigator.share({
title: `${listTitle} List`,
text: finalMessage
}).catch(err => {
console.error("Share failed", err);
});
} else {
copyColumnData(columnType);
}
}

async function executeCommAttSync() {
if (isCommAttSyncing) return; // Prevent concurrent overlaps
if (!hasPendingUpdates()) return;

isCommAttSyncing = true;
setCommAttBtnState('saving');
setBusSyncBtnState('saving');

const payloadUpdates = {};
for (let junc in pendingCommAttUpdates) {
payloadUpdates[junc] = [];
for (let name in pendingCommAttUpdates[junc]) {
payloadUpdates[junc].push({ name: name, status: pendingCommAttUpdates[junc][name] });
}
}

const batchBackup = JSON.parse(JSON.stringify(pendingCommAttUpdates));
pendingCommAttUpdates = {};

try {
const res = await apiCall('syncCommAttendance', { sheetUrl: currentCommAttSheetUrl, multipleUpdates: payloadUpdates });
if (res.success) {
setCommAttBtnState('saved');
setBusSyncBtnState('saved');
} else {
throw new Error(res.message);
}
} catch (e) {
console.error(e);
setCommAttBtnState('error');
setBusSyncBtnState('error');
for (let junc in batchBackup) {
if(!pendingCommAttUpdates[junc]) pendingCommAttUpdates[junc] = {};
for (let name in batchBackup[junc]) {
pendingCommAttUpdates[junc][name] = batchBackup[junc][name];
}
}
} finally {
isCommAttSyncing = false;
if (hasPendingUpdates()) {
triggerSync();
}
}
}

function setCommAttBtnState(state) {
const btn = document.getElementById('btn-sync-comm-att');
if (!btn) return;

const textSpan = btn.querySelector('.btn-text');
const spinner = btn.querySelector('.btn-spinner');

btn.className = "text-[10px] md:text-xs px-1.5 py-1 flex items-center justify-center rounded font-bold transition border border-gray-300 dark:border-zinc-700 focus:outline-none shadow-sm shrink-0";
spinner.classList.add('hidden');

if (state === 'saving') {
btn.classList.add('bg-yellow-50', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400', 'border-yellow-200', 'dark:border-yellow-800');
textSpan.textContent = "Saving...";
spinner.classList.remove('hidden');
} else if (state === 'saved') {
btn.classList.add('bg-green-50', 'dark:bg-green-900/30', 'text-green-700', 'dark:text-green-400', 'border-green-200', 'dark:border-green-800');
textSpan.textContent = "Saved";
setTimeout(() => {
if (!hasPendingUpdates()) {
btn.classList.remove('bg-green-50', 'dark:bg-green-900/30', 'text-green-700', 'dark:text-green-400', 'border-green-200', 'dark:border-green-800');
btn.classList.add('bg-white', 'dark:bg-zinc-800', 'text-gray-700', 'dark:text-gray-300');
textSpan.textContent = "Saved";
}
}, 2000);
} else if (state === 'error') {
btn.classList.add('bg-red-50', 'dark:bg-red-900/30', 'text-red-700', 'dark:text-red-400', 'border-red-200', 'dark:border-red-800');
textSpan.textContent = "Error";
}
}

function promptNewCommJuncture() {
const name = prompt("Enter new juncture name (e.g. Morning Assembly):");
if (!name || !name.trim()) return;

lastCommAttLocalChange = Date.now();
const overlay = document.getElementById('commAttLoadingOverlay');
overlay.classList.remove('hidden');

apiCall('addCommJuncture', { sheetUrl: currentCommAttSheetUrl, junctureName: name.trim() }).then(res => {
overlay.classList.add('hidden');
if (res.success) {
commAttData = res;
ensureMeetingJuncture();
commAttState.currentJuncture = name.trim();
renderCommAttFilters();
renderCommAttJunctures();
showFlashMessage('commGlobalStatus', "Juncture added.", 'success');
} else {
alert(res.message);
}
});
}

function promptDeleteCommJuncture() {
const juncture = document.getElementById('commAttJunctureSelect').value;
if (!juncture) return;

if (juncture === "Meeting") {
alert("The default 'Meeting' juncture cannot be deleted.");
return;
}

if (!confirm(`Are you sure you want to delete the juncture "${juncture}"?`)) return;

lastCommAttLocalChange = Date.now();
const overlay = document.getElementById('commAttLoadingOverlay');
overlay.classList.remove('hidden');

apiCall('deleteCommJuncture', { sheetUrl: currentCommAttSheetUrl, junctureName: juncture }).then(res => {
overlay.classList.add('hidden');
if (res.success) {
commAttData = res;
ensureMeetingJuncture();
commAttState.currentJuncture = "Meeting";
renderCommAttFilters();
renderCommAttJunctures();
showFlashMessage('commGlobalStatus', "Juncture deleted.", 'success');
} else {
alert(res.message);
}
});
}

async function manualSyncCommAttendance() {
if (isCommAttSyncing) return; // Prevent overlapping with automated sync

if (hasPendingUpdates()) {
await executeCommAttSync();
}

setCommAttBtnState('saving');
setBusSyncBtnState('saving');
const overlay = document.getElementById('commAttLoadingOverlay');
overlay.classList.remove('hidden');

const fetchStartTime = Date.now();

apiCall('fetchCommAttendance', { sheetUrl: currentCommAttSheetUrl }).then(res => {
overlay.classList.add('hidden');
if (res.success) {
if (lastCommAttLocalChange > fetchStartTime) return;

commAttData = res;
ensureMeetingJuncture();
renderCommAttFilters();
renderCommAttLists();

if (!document.getElementById('busTrackerModal').classList.contains('hidden')) {
renderBusJunctures();
}

setCommAttBtnState('saved');
setBusSyncBtnState('saved');
} else {
setCommAttBtnState('error');
setBusSyncBtnState('error');
}
});
}

function startCommAttPolling() {
if (commAttPollInterval) clearInterval(commAttPollInterval);

commAttPollInterval = setInterval(() => {
const view = document.getElementById('view-comm-attendance');
if (!view || view.classList.contains('hidden')) return;

if (isCommAttSyncing || hasPendingUpdates()) return;

const fetchStartTime = Date.now();

apiCall('fetchCommAttendance', { sheetUrl: currentCommAttSheetUrl }).then(res => {
if (res.success && !isCommAttSyncing && !hasPendingUpdates()) {
if (lastCommAttLocalChange > fetchStartTime) return;

const oldJunctures = JSON.stringify(commAttData.junctures);
const oldBusJunctures = JSON.stringify(commAttData.busJunctures);
const oldParticipants = JSON.stringify(commAttData.participants);
const oldAttendance = JSON.stringify(commAttData.attendance);
const oldBusAttendance = JSON.stringify(commAttData.busAttendance);

commAttData = res;
ensureMeetingJuncture();

const newJunctures = JSON.stringify(commAttData.junctures);
const newBusJunctures = JSON.stringify(commAttData.busJunctures);
const newParticipants = JSON.stringify(commAttData.participants);
const newAttendance = JSON.stringify(commAttData.attendance);
const newBusAttendance = JSON.stringify(commAttData.busAttendance);

if (oldJunctures !== newJunctures || oldParticipants !== newParticipants) {
renderCommAttFilters();
renderCommAttJunctures();
} else if (oldAttendance !== newAttendance) {
renderCommAttLists();
}

if (!document.getElementById('busTrackerModal').classList.contains('hidden')) {
if (oldBusJunctures !== newBusJunctures) {
renderBusJunctures();
} else if (oldBusAttendance !== newBusAttendance || oldParticipants !== newParticipants) {
renderBusLists();
}
}
}
});
}, 10000); 
}

function handleCommAttSearch() {
const query = document.getElementById('commAttSearchInput').value.toLowerCase().trim();
commAttState.searchQuery = query;
renderCommAttLists();
}

// ==========================================
// BUS TRACKER LOGIC
// ==========================================

function openBusTrackerModal() {
document.getElementById('busTrackerModal').classList.remove('hidden');
renderBusJunctures();
}

function closeBusTrackerModal() {
document.getElementById('busTrackerModal').classList.add('hidden');
}

function extractBusJunctures() {
const juncs = [];
const addedValues = new Set();

if (commAttData.busJunctures) {
commAttData.busJunctures.forEach(b => {
let prefix = b.type === 'meet' ? 'Meeting: ' : 'Dismissal: ';
let compositeName = prefix + b.name;
if (!addedValues.has(compositeName)) {
juncs.push({ value: compositeName, label: compositeName });
addedValues.add(compositeName);
}
});
}

for(let j in commAttData.busAttendance) {
if (!addedValues.has(j)) {
juncs.push({ value: j, label: j });
addedValues.add(j);
}
}
return juncs;
}

function renderBusJunctures() {
const select = document.getElementById('busJunctureSelect');
if(!select) return;
select.innerHTML = '';

const juncs = extractBusJunctures();

if (juncs.length === 0) {
select.innerHTML = '<option value="" disabled selected>No buses catered.</option>';
busState.currentJuncture = null;
renderBusLists();
return;
}

juncs.forEach(j => {
select.innerHTML += `<option value="${j.value}">${j.label}</option>`;
});

const validValues = juncs.map(j => j.value);

if (busState.currentJuncture && validValues.includes(busState.currentJuncture)) {
select.value = busState.currentJuncture;
} else {
busState.currentJuncture = validValues[0];
select.value = validValues[0];
}

changeBusContext();
}

function changeBusContext() {
const select = document.getElementById('busJunctureSelect');
if(select) busState.currentJuncture = select.value;
if(!busState.currentJuncture) return;

const usedBuses = new Set(['Bus 1']);
if (commAttData.busAttendance[busState.currentJuncture]) {
for(let t in commAttData.busAttendance[busState.currentJuncture]) {
const val = commAttData.busAttendance[busState.currentJuncture][t];
if (val) usedBuses.add(val);
}
}
busState.busOptions = Array.from(usedBuses).sort();

renderBusFilterOptions();
renderBusLists();
}

function renderBusFilterOptions() {
const select = document.getElementById('busFilterSelect');
if(!select) return;
select.innerHTML = '<option value="ALL">All Buses</option>';
busState.busOptions.forEach(b => {
select.innerHTML += `<option value="${b}">${b}</option>`;
});
}

function addBusOption() {
const num = busState.busOptions.length + 1;
busState.busOptions.push(`Bus ${num}`);
renderBusFilterOptions();
document.getElementById('busFilterSelect').value = `Bus ${num}`;
renderBusLists();
}

function removeBusOption() {
const juncture = busState.currentJuncture;
const filterBus = document.getElementById('busFilterSelect').value;

if (!juncture) return;
if (filterBus === 'ALL') {
alert("Please select a specific bus from the dropdown to remove.");
return;
}

if (!confirm(`Are you sure you want to remove ${filterBus}? All trainees assigned to this bus will be unassigned.`)) {
return;
}

busState.busOptions = busState.busOptions.filter(b => b !== filterBus);

let hasChanges = false;
const juncKey = '__BUS__' + juncture;

if (commAttData.busAttendance[juncture]) {
for (let name in commAttData.busAttendance[juncture]) {
if (commAttData.busAttendance[juncture][name] === filterBus) {
 commAttData.busAttendance[juncture][name] = ""; 
 
 if (!pendingCommAttUpdates[juncKey]) pendingCommAttUpdates[juncKey] = {};
 pendingCommAttUpdates[juncKey][name] = "";
 
 hasChanges = true;
}
}
}

lastCommAttLocalChange = Date.now();

renderBusFilterOptions();
document.getElementById('busFilterSelect').value = 'ALL';
renderBusLists();

if (hasChanges) {
triggerSync();
}
}

function getEligibleBusTrainees() {
const juncture = busState.currentJuncture;
if(!juncture) return [];

let participants = commAttData.participants || [];

participants = participants.filter(p => !(commAttData.attendance['__GONE_HOME__'] && commAttData.attendance['__GONE_HOME__'][p.name] === true));

let matchMeet = false;
let matchDismiss = false;
let rawLocName = juncture;

if (juncture.startsWith('Meeting: ')) {
matchMeet = true;
rawLocName = juncture.substring(9);
} else if (juncture.startsWith('Dismissal: ')) {
matchDismiss = true;
rawLocName = juncture.substring(11);
} else {
const defaultJunc = (commAttData.busJunctures || []).find(b => b.name === juncture);
if (defaultJunc) {
if (defaultJunc.type === 'meet') matchMeet = true;
else matchDismiss = true;
}
}

if (matchMeet) {
return participants.filter(p => String(p.meetingLoc).toLowerCase() === rawLocName.toLowerCase());
} else if (matchDismiss) {
return participants.filter(p => String(p.dismissalLoc).toLowerCase() === rawLocName.toLowerCase());
}

return participants;
}

function renderBusLists() {
const notBoardedList = document.getElementById('busNotBoardedList');
const boardedList = document.getElementById('busBoardedList');

if (!notBoardedList || !boardedList) return;

const scrollNB = notBoardedList.scrollTop;
const scrollB = boardedList.scrollTop;

const juncture = busState.currentJuncture;
const filterBus = document.getElementById('busFilterSelect').value;

if (!juncture) {
notBoardedList.innerHTML = '<p class="text-[10px] text-gray-400 p-2 text-center mt-2">N/A</p>';
boardedList.innerHTML = '<p class="text-[10px] text-gray-400 p-2 text-center mt-2">N/A</p>';
document.getElementById('busNotBoardedCount').textContent = '0';
document.getElementById('busBoardedCount').textContent = '0';
return;
}

let notBoardedHtml = '';
let boardedHtml = '';
let notBoardedCount = 0;
let boardedCount = 0;

let eligibleTrainees = getEligibleBusTrainees();

if (busState.searchQuery) {
const query = busState.searchQuery;
eligibleTrainees = eligibleTrainees.filter(p => 
   p.name.toLowerCase().includes(query) || 
   (p.volPaired && p.volPaired.toLowerCase().includes(query))
);
}

eligibleTrainees.sort((a, b) => a.name.localeCompare(b.name));

eligibleTrainees.forEach(p => {
const currentBus = commAttData.busAttendance[juncture] ? commAttData.busAttendance[juncture][p.name] : "";

if (currentBus) {
if (filterBus === 'ALL' || filterBus === currentBus) {
boardedHtml += generateBusCard(p, true, currentBus);
boardedCount++;
}
} else {
notBoardedHtml += generateBusCard(p, false, "");
notBoardedCount++;
}
});

notBoardedList.innerHTML = notBoardedHtml || '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';
boardedList.innerHTML = boardedHtml || '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';

document.getElementById('busNotBoardedCount').textContent = notBoardedCount;
document.getElementById('busBoardedCount').textContent = boardedCount;

notBoardedList.scrollTop = scrollNB;
boardedList.scrollTop = scrollB;

document.querySelectorAll('.bus-att-card').forEach(el => {
uiBindLongPress(el, () => {
const name = el.getAttribute('data-name');
const p = (commAttData.participants || []).find(x => x.name.replace(/'/g, "\\'") === name);
if (p) {
   if (busState.searchQuery) {
       busState.searchQuery = "";
       document.getElementById('busSearchInput').value = "";
       if (typeof toggleClearBtn === 'function') toggleClearBtn('busSearchInput');
       renderBusLists();
   }
   showPersonInfo(p);
}
});
});
}

function generateBusCard(p, isBoarded, assignedBus) {
const safeName = p.name.replace(/'/g, "\\'");

let volHtml = '';
if (p.volPaired) {
const vols = p.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
if (vols.length > 0) {
volHtml = vols.map(v => `<span class="text-[9px] text-teal-700 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-900/30 px-1 py-0.5 rounded border border-teal-200 dark:border-teal-800/50 break-words w-fit"><i class="fa-solid fa-handshake-angle mr-1"></i>${v}</span>`).join('');
}
} else {
volHtml = `<span class="text-[9px] text-red-700 dark:text-red-400 font-black bg-red-50 dark:bg-red-900/30 px-1 py-0.5 rounded border border-red-200 dark:border-red-800/50 break-words w-fit uppercase">Unpaired</span>`;
}

const checkBtnClass = isBoarded ? 'bg-green-500 border-green-600 text-white shadow-inner' : 'bg-gray-50 dark:bg-black border-gray-300 dark:border-zinc-600 text-transparent';

let busBadge = isBoarded ? `<span class="text-[10px] font-black uppercase text-yellow-800 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/50 px-1.5 py-0.5 rounded border border-yellow-300 dark:border-yellow-700">${assignedBus}</span>` : '';

return `
<div id="bus-att-card-${p.name.replace(/[^a-zA-Z0-9]/g, '')}" 
data-name="${safeName}"
class="bus-att-card relative bg-white dark:bg-zinc-900 p-2 rounded border border-gray-200 dark:border-zinc-700 shadow-sm transition-all duration-300 flex flex-col gap-1.5 select-none active:scale-95 cursor-pointer hover:border-yellow-500" 
onclick="toggleBusStatus('${safeName}', ${!isBoarded}, event)">
<div class="flex items-start justify-between gap-1 w-full">
<span class="font-extrabold text-xs text-gray-900 dark:text-white leading-tight break-words">${p.name}</span>
<div class="shrink-0 flex items-center gap-1.5">
${busBadge}
<div class="w-6 h-6 rounded flex items-center justify-center border transition-colors ${checkBtnClass}">
<i class="fa-solid fa-check text-xs"></i>
</div>
</div>
</div>
${volHtml ? `<div class="flex flex-col gap-1 w-full">${volHtml}</div>` : ''}
</div>`;
}

function updateBusCardDOM(name) {
const p = (commAttData.participants || []).find(x => x.name === name);
if (!p) return;

const juncture = busState.currentJuncture;
const filterBus = document.getElementById('busFilterSelect').value;
const currentBus = commAttData.busAttendance[juncture] ? commAttData.busAttendance[juncture][p.name] : "";
const isBoarded = !!currentBus;

const cardId = `bus-att-card-${p.name.replace(/[^a-zA-Z0-9]/g, '')}`;
const existingCard = document.getElementById(cardId);

const newHtml = generateBusCard(p, isBoarded, currentBus);

let targetListId = isBoarded && (filterBus === 'ALL' || filterBus === currentBus) ? 'busBoardedList' : 'busNotBoardedList';

if (isBoarded && filterBus !== 'ALL' && filterBus !== currentBus) {
if (existingCard) {
existingCard.remove();
updateBusCountsDOM();
}
return;
}

const targetList = document.getElementById(targetListId);

if (existingCard) {
const currentListId = existingCard.parentElement.id;
if (currentListId === targetListId) {
existingCard.outerHTML = newHtml;
rebindCommAttCard(cardId, p);
const newNode = document.getElementById(cardId);
if (newNode) applyCardPulse(newNode, isBoarded ? 'pulse-green' : 'pulse-red');
} else {
existingCard.style.overflow = 'hidden';
existingCard.style.minHeight = '0';
existingCard.style.transition = 'opacity 0.2s ease, height 0.3s ease, margin 0.3s ease, padding 0.3s ease';
existingCard.style.height = existingCard.offsetHeight + 'px';
void existingCard.offsetHeight;
existingCard.style.opacity = '0';
existingCard.style.height = '0px';
existingCard.style.margin = '0px';
existingCard.style.padding = '0px';
existingCard.style.border = 'none';

setTimeout(() => {
existingCard.remove();
const temp = document.createElement('div');
temp.innerHTML = newHtml;
const newNode = temp.firstElementChild;
newNode.style.opacity = '0';
newNode.style.transform = 'translateY(-10px)';
newNode.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
insertCardSorted(targetList, newNode, p);
void newNode.offsetWidth;
newNode.style.opacity = '1';
newNode.style.transform = 'translateY(0)';
updateBusCountsDOM();
rebindCommAttCard(cardId, p);

scrollCardIntoViewLocally(newNode);
setTimeout(() => {
   applyCardPulse(newNode, isBoarded ? 'pulse-green' : 'pulse-red');
}, 400);
}, 300);
}
}
}

function updateBusCountsDOM() {
const juncture = busState.currentJuncture;
const filterBus = document.getElementById('busFilterSelect').value;
let nb = 0, b = 0;

let eligibleTrainees = getEligibleBusTrainees();

eligibleTrainees.forEach(p => {
const currentBus = commAttData.busAttendance[juncture] ? commAttData.busAttendance[juncture][p.name] : "";
if (currentBus) {
if (filterBus === 'ALL' || filterBus === currentBus) {
b++;
}
} else {
nb++;
}
});

document.getElementById('busNotBoardedCount').textContent = nb;
document.getElementById('busBoardedCount').textContent = b;

['busNotBoardedList', 'busBoardedList'].forEach(id => {
const el = document.getElementById(id);
if (!el) return;
const cardCount = el.querySelectorAll('.bus-att-card').length;
if (cardCount === 0) {
el.innerHTML = '<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';
} else {
const emptyP = el.querySelector('p');
if (emptyP && emptyP.innerText === 'Empty') emptyP.remove();
}
});
}

function toggleBusStatus(name, forceBoarded, e) {
if(e) e.stopPropagation();

const juncture = busState.currentJuncture;
if (!juncture) return;

let selectedBus = "";
if (forceBoarded) {
const filterBus = document.getElementById('busFilterSelect').value;
if (filterBus === 'ALL') {
showFlashMessage('busGlobalStatus', 'Please select a specific bus first.', 'error');
const selectEl = document.getElementById('busFilterSelect');
if (selectEl) {
 selectEl.classList.add('pulse-red');
 setTimeout(() => selectEl.classList.remove('pulse-red'), 800);
}
return;
}
selectedBus = filterBus; 
}

lastCommAttLocalChange = Date.now();
if (!commAttData.busAttendance[juncture]) commAttData.busAttendance[juncture] = {};
commAttData.busAttendance[juncture][name] = selectedBus;

const juncKey = '__BUS__' + juncture;
if (!pendingCommAttUpdates[juncKey]) pendingCommAttUpdates[juncKey] = {};
pendingCommAttUpdates[juncKey][name] = selectedBus;

if (busState.searchQuery) {
busState.searchQuery = "";
document.getElementById('busSearchInput').value = "";
if (typeof toggleClearBtn === 'function') toggleClearBtn('busSearchInput');
renderBusLists();
setTimeout(() => {
   const cardNode = document.getElementById(`bus-att-card-${name.replace(/[^a-zA-Z0-9]/g, '')}`);
   if (cardNode) {
       scrollCardIntoViewLocally(cardNode);
       setTimeout(() => {
           applyCardPulse(cardNode, forceBoarded ? 'pulse-green' : 'pulse-red');
       }, 400);
   }
}, 50);
} else {
updateBusCardDOM(name);
}
triggerSync();
}

function setBusSyncBtnState(state) {
setCommAttBtnState(state);
}

function promptNewBusJuncture() {
const name = prompt("Enter new custom bus location:");
if (!name || !name.trim()) return;

lastCommAttLocalChange = Date.now();
const overlay = document.getElementById('busLoadingOverlay');
overlay.classList.remove('hidden');

apiCall('addCommJuncture', { sheetUrl: currentCommAttSheetUrl, junctureName: '__BUS__' + name.trim() }).then(res => {
overlay.classList.add('hidden');
if (res.success) {
commAttData = res;
ensureMeetingJuncture();
busState.currentJuncture = name.trim();
renderBusJunctures();
} else {
alert(res.message);
}
});
}

function promptDeleteBusJuncture() {
const juncture = busState.currentJuncture;
if (!juncture) return;

if (!confirm(`Are you sure you want to delete the bus tracking for "${juncture}"?`)) return;

lastCommAttLocalChange = Date.now();
const overlay = document.getElementById('busLoadingOverlay');
overlay.classList.remove('hidden');

apiCall('deleteCommJuncture', { sheetUrl: currentCommAttSheetUrl, junctureName: '__BUS__' + juncture }).then(res => {
overlay.classList.add('hidden');
if (res.success) {
commAttData = res;
ensureMeetingJuncture();
renderBusJunctures();
} else {
alert(res.message);
}
});
}

function handleBusSearch() {
const query = document.getElementById('busSearchInput').value.toLowerCase().trim();
busState.searchQuery = query;
renderBusLists();
}

function generateBusColumnText(columnType) {
const juncture = busState.currentJuncture;
const filterBus = document.getElementById('busFilterSelect').value;
if (!juncture) return "";

let listTitle = "";
if (columnType === 'notBoarded') listTitle = `NOT BOARDED`;
if (columnType === 'boarded') listTitle = `BOARDED (${filterBus === 'ALL' ? 'All Buses' : filterBus})`;

let eligibleTrainees = getEligibleBusTrainees();
let targetNames = [];

eligibleTrainees.forEach(p => {
const currentBus = commAttData.busAttendance[juncture] ? commAttData.busAttendance[juncture][p.name] : "";
if (columnType === 'boarded') {
if (currentBus && (filterBus === 'ALL' || filterBus === currentBus)) {
 targetNames.push(`${p.name} ${p.group ? '(Grp ' + p.group + ')' : ''}`);
}
} else if (columnType === 'notBoarded') {
if (!currentBus) {
 targetNames.push(`${p.name} ${p.group ? '(Grp ' + p.group + ')' : ''}`);
}
}
});

targetNames.sort((a,b) => a.localeCompare(b));

return `[${listTitle} - ${juncture}]\nTotal: ${targetNames.length}\n\n${targetNames.join('\n')}`;
}

function copyBusColumnData(columnType) {
const finalMessage = generateBusColumnText(columnType);
if (!finalMessage) return;
navigator.clipboard.writeText(finalMessage).then(() => {
showFlashMessage('busGlobalStatus', "List copied to clipboard!", 'success');
}).catch(() => {
alert("Failed to copy list. Clipboard access denied.");
});
}

function shareBusColumnData(columnType) {
const finalMessage = generateBusColumnText(columnType);
if (!finalMessage) return;
const listTitle = finalMessage.split('\n')[0].replace(/\[|\]/g, '');

if (navigator.share) {
navigator.share({
title: listTitle,
text: finalMessage
}).catch(err => console.error("Share failed", err));
} else {
copyBusColumnData(columnType);
}
}