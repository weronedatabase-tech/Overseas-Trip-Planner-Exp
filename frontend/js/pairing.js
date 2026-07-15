let currentManualPairingSheetUrl = null;
let manualPairingData = { trainees: [], volunteers: [], priVolMap: new Map() };
let pendingPairingUpdates = [];
let isManualPairingSyncing = false;
let manualPairingSyncTimeout = null;
let manualPairingPollInterval = null;
let lastPairingLocalChange = 0;

let isFilteredManualPairingMode = false;
let filteredManualPairingSourceView = null;

// ==========================================
// MANUAL PAIRING LOGIC
// ==========================================

function openManualPairing(url) {
if(!url) return;

currentActiveView = 'manual-pairing';
isFilteredManualPairingMode = false;
currentManualPairingSheetUrl = url;

loadManualPairingData();
}

function openFilteredManualPairing(url, source = null) {
if(!url) return;

if (!isAdminAuthenticated) {
requestAccess(null, () => openFilteredManualPairing(url, source));
return;
}

currentActiveView = 'manual-pairing';
filteredManualPairingSourceView = source;
isFilteredManualPairingMode = true;
currentManualPairingSheetUrl = url;

loadManualPairingData();
}

function loadManualPairingData() {
const overlay = document.getElementById('manualPairingLoadingOverlay');
if(overlay) overlay.classList.remove('hidden');

apiCall('fetchManualPairingData', { sheetUrl: currentManualPairingSheetUrl }).then(res => {
if(overlay) overlay.classList.add('hidden');
if (res.success) {
manualPairingData = res.data;
renderManualPairings();
startManualPairingPolling();
} else {
alert("Error: " + res.message);
if (isFilteredManualPairingMode && filteredManualPairingSourceView === 'tracker.html') {
window.navigateTo('tracker.html', { url: currentManualPairingSheetUrl });
} else {
window.navigateTo('admin.html');
}
}
});
}

function filterPairingPools() {
renderManualPairings();
}

function triggerManualPairingPulse(sourceName, targetName, isPaired) {
setTimeout(() => {
requestAnimationFrame(() => {
const sourceCard = document.querySelector(`.dnd-dropzone[data-name="${sourceName.replace(/'/g, "\\'")}"]`);
const targetCard = document.querySelector(`.dnd-dropzone[data-name="${targetName.replace(/'/g, "\\'")}"]`);

[sourceCard, targetCard].forEach(card => {
 if (card) {
     const container = card.parentElement;
     if (container) {
         const containerRect = container.getBoundingClientRect();
         const cardRect = card.getBoundingClientRect();
         
         if (cardRect.height > 0) {
             const scrollTop = container.scrollTop + (cardRect.top - containerRect.top) - (containerRect.height / 2) + (cardRect.height / 2);
             
             container.scrollTo({
                 top: scrollTop,
                 behavior: 'smooth'
             });
         }
     }
     
     const pulseClass = isPaired ? 'pulse-green' : 'pulse-red';
     
     card.classList.add(pulseClass);
     setTimeout(() => {
         card.classList.remove(pulseClass);
     }, 800);
 }
});
});
}, 150);
}

function generatePairingPillHtml(pillName, traineeName, volName, isTraineeGoneHome = false) {
const goneHomeBadge = isTraineeGoneHome ? `<i class="fa-solid fa-house-user text-blue-500 ml-1" title="Gone Home"></i>` : '';
const removeBtn = isTraineeGoneHome ? '' : `<div class="remove-x flex items-center justify-center font-bold text-[10px] bg-transparent text-red-500 shadow-none border-none hover:bg-transparent hover:text-red-700 hover:scale-125 top-0 right-1" onclick="unpairTrainee('${traineeName.replace(/'/g, "\\'")}', '${volName.replace(/'/g, "\\'")}')">✕</div>`;

return `<div class="relative flex w-full align-top pointer-events-auto">
<div class="bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-gray-100 text-[10px] md:text-[11px] pl-2 ${isTraineeGoneHome ? 'pr-2' : 'pr-6'} py-1 rounded shadow-sm border font-bold opacity-90 leading-tight break-words whitespace-normal text-left w-full flex items-center">
<span>${pillName}</span>${goneHomeBadge}
</div>
${removeBtn}
</div>`;
}

function generatePairingCardHtml(item, pairedNames) {
const isVol = item.role === 'VOLUNTEER';
let pairedPills = '';

pairedNames.forEach(pairedName => {
const tName = isVol ? pairedName : item.name;
const vName = isVol ? item.name : pairedName;

let isTraineeGoneHome = false;
if (isVol) {
const traineeObj = (manualPairingData.trainees || []).find(t => t.name === tName);
if (traineeObj && traineeObj.isGoneHome) {
isTraineeGoneHome = true;
}
}

pairedPills += generatePairingPillHtml(pairedName, tName, vName, isTraineeGoneHome);
});

const safeName = item.name.replace(/'/g, "\\'");
const displayName = item.name;
const isGoneHome = item.isGoneHome === true;

let sysBadge = '';
let opacityClass = '';

if (isGoneHome) {
sysBadge = `<i class="fa-solid fa-house-user text-blue-500 dark:text-blue-400 shrink-0 text-[10px] md:text-xs ml-0.5" title="Gone Home"></i>`;
opacityClass = 'opacity-50 grayscale pointer-events-none';
} else if (item.isAttendingUnknown) {
sysBadge = `<span class="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 text-[8px] uppercase font-black tracking-wider px-1 py-0.5 rounded shrink-0 shadow-sm pointer-events-none whitespace-nowrap">? ATTENDING</span>`;
}

let cgBadge = '';
if (!isVol && item.caregivers > 0) {
cgBadge = `<span class="inline-flex shrink-0 items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] font-black text-white shadow-sm">${item.caregivers > 1 ? item.caregivers + 'C' : 'C'}</span>`;
}

let starBadge = '';
if (!isVol && item.extra && item.extra.t_one_on_one) {
const oneOnOneRaw = String(item.extra.t_one_on_one).trim().toLowerCase();
if (oneOnOneRaw !== '' && !['no', 'n', 'false', '0'].includes(oneOnOneRaw)) {
starBadge = `<i class="fa-solid fa-star text-yellow-500 shrink-0 text-xs ml-1" title="1-1 Pairing Required: ${String(item.extra.t_one_on_one).replace(/"/g, '&quot;')}"></i>`;
}
}

let remarksBadge = '';
let remarkContent = null;
if (item.extra && item.extra.remark) {
remarkContent = String(item.extra.remark).trim();
}

if (remarkContent) {
remarksBadge = `<i class="fa-solid fa-note-sticky text-yellow-500 dark:text-yellow-400 shrink-0 text-xs ml-1 cursor-help" title="${remarkContent.replace(/"/g, '&quot;')}"></i>`;
}

let projectInfo = '';
if (item.project) {
projectInfo = `<span class="text-[10px] text-gray-500 dark:text-gray-400 font-medium">${item.project}</span>`;
if (!isVol && item.group) {
projectInfo += `<span class="ml-1.5 bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800 border px-1.5 py-0.5 rounded font-black text-[8px] uppercase shadow-sm whitespace-nowrap">Grp ${item.group}</span>`;
}
} else if (!isVol && item.group) {
projectInfo = `<span class="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800 border px-1.5 py-0.5 rounded font-black text-[8px] uppercase shadow-sm whitespace-nowrap">Grp ${item.group}</span>`;
}

const addBtnHtml = isGoneHome ? '' : `<button class="shrink-0 text-xs text-gray-500 dark:text-gray-400 hover:text-primary transition-colors bg-gray-50 dark:bg-black hover:bg-gray-100 dark:hover:bg-zinc-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-700 shadow-sm pointer-events-auto flex items-center justify-center font-bold" onclick="event.stopPropagation(); openQuickPairModal('${safeName}', '${item.role}')">+${isVol ? 'Trn' : 'Vol'}</button>`;

return `
<div class="dnd-draggable dnd-dropzone bg-white dark:bg-zinc-900 p-2 rounded-md border border-gray-200 dark:border-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col min-h-[70px] gap-1.5 ${opacityClass}" data-name="${safeName}" data-role="${item.role}" data-source-array="${isVol ? 'volunteers' : 'trainees'}">
<div class="flex justify-between items-center w-full gap-2">
<div class="main-name-pill font-extrabold text-[11px] md:text-[12px] text-gray-900 dark:text-white leading-tight break-words whitespace-normal flex items-center gap-1 min-w-0 flex-1">
<span class="break-words">${displayName}</span>
${starBadge}
${remarksBadge}
${cgBadge}
${sysBadge}
</div>
${addBtnHtml}
</div>
<div class="flex flex-row items-center w-full mt-0.5">
${projectInfo}
</div>
<div class="flex flex-col pointer-events-auto bg-gray-50/50 dark:bg-black/50 p-1.5 rounded min-h-[36px] border border-dashed border-gray-200 dark:border-zinc-700 mt-1 w-full gap-1.5">
${pairedPills || `<span class="text-[9px] md:text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 pointer-events-none text-center w-full py-1">Drop ${isVol ? 'trainee' : 'volunteer'} here</span>`}
</div>
</div>
`;
}

function updateGlobalUnpairedCount() {
let count = 0;
(manualPairingData.trainees || []).forEach(t => {
const att = t.attending ? String(t.attending).toLowerCase().trim() : "";
if (att === 'y' && !t.isGoneHome && (!t.volPaired || t.volPaired.trim() === '')) {
count++;
}
});
if (typeof updateUnpairedNotification === 'function') updateUnpairedNotification(count);
}

function updatePairingCardDOM(name, role) {
const arr = role === 'VOLUNTEER' ? manualPairingData.volunteers : manualPairingData.trainees;
const item = (arr || []).find(x => x.name === name);
if (!item) return;

let pairedNames = [];
if (role === 'VOLUNTEER') {
(manualPairingData.trainees || []).forEach(t => {
  if (t.volPaired) {
      const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
      if (vols.includes(name.toLowerCase())) pairedNames.push(t.name);
  }
});
} else {
pairedNames = item.volPaired ? item.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v) : [];
}

const safeName = item.name.replace(/'/g, "\\'");
const cardSelector = `.dnd-dropzone[data-name="${safeName}"][data-role="${role}"]`;
const existingCard = document.querySelector(cardSelector);

if (existingCard) {
const newHtml = generatePairingCardHtml(item, pairedNames);
const temp = document.createElement('div');
temp.innerHTML = newHtml;
const newCardNode = temp.firstElementChild;

existingCard.replaceWith(newCardNode);

uiBindLongPress(newCardNode, () => {
  const p = (manualPairingData[role === 'VOLUNTEER' ? 'volunteers' : 'trainees'] || []).find(x => x.name === item.name);
  if (p) showPersonInfo(p);
});
}
}

function renderManualPairings() {
const sourcePool = document.getElementById('dnd-source-pool');
const targetList = document.getElementById('dnd-target-list');

const sourceScrollPos = sourcePool ? sourcePool.scrollTop : 0;
const targetScrollPos = targetList ? targetList.scrollTop : 0;

let trainees = (manualPairingData.trainees || []).filter(t => {
const att = t.attending ? String(t.attending).toLowerCase().trim() : "";
return att === 'y';
});

updateGlobalUnpairedCount();

let vols = [...(manualPairingData.volunteers || [])]; 

const volSearchQuery = document.getElementById('pairingVolSearch')?.value.toLowerCase().trim() || "";
const traSearchQuery = document.getElementById('pairingTraineeSearch')?.value.toLowerCase().trim() || "";

if (volSearchQuery) {
vols = vols.filter(v => 
v.name.toLowerCase().includes(volSearchQuery) || 
(v.project && v.project.toLowerCase().includes(volSearchQuery))
);
}
if (traSearchQuery) {
trainees = trainees.filter(t => 
t.name.toLowerCase().includes(traSearchQuery) || 
(t.project && t.project.toLowerCase().includes(traSearchQuery)) ||
(t.group && String(t.group).toLowerCase().includes(traSearchQuery))
);
}

const sortFn = (a, b) => {
const projA = a.project ? a.project.toString().toLowerCase().trim() : "zzzz";
const projB = b.project ? b.project.toString().toLowerCase().trim() : "zzzz";
const projCmp = projA.localeCompare(projB);
if (projCmp !== 0) return projCmp;

const nameA = a.name ? a.name.toString().toLowerCase().trim() : "";
const nameB = b.name ? b.name.toString().toLowerCase().trim() : "";
return nameA.localeCompare(nameB);
};

vols.sort(sortFn);
trainees.sort(sortFn);

const volPairingsMap = new Map();
(manualPairingData.trainees || []).forEach(t => {
if (t.volPaired) {
const pairedVols = t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
pairedVols.forEach(v => {
const cleanVol = v.toLowerCase();
if (!volPairingsMap.has(cleanVol)) volPairingsMap.set(cleanVol, []);
volPairingsMap.get(cleanVol).push(t.name);
});
}
});

if (isFilteredManualPairingMode) {
trainees = trainees.filter(t => !t.isGoneHome && (!t.volPaired || t.volPaired.trim() === ''));
}

let sourceHtml = '';
vols.forEach(item => { 
const myTrainees = volPairingsMap.get(item.name.toLowerCase()) || [];
sourceHtml += generatePairingCardHtml(item, myTrainees); 
});

if (sourcePool) {
sourcePool.innerHTML = sourceHtml || '<p class="text-[10px] text-gray-500 font-bold p-2 text-center mt-2">No active volunteers matching search.</p>';
}

let targetHtml = '';
trainees.forEach(item => { 
const myVols = item.volPaired ? item.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v) : [];
targetHtml += generatePairingCardHtml(item, myVols); 
});

if (targetList) {
if (isFilteredManualPairingMode && targetHtml === '') {
targetList.innerHTML = '<p class="text-[10px] text-green-500 font-bold p-2 text-center mt-2">All trainees are paired!</p>';
} else {
targetList.innerHTML = targetHtml || '<p class="text-[10px] text-gray-500 font-bold p-2 text-center mt-2">No active trainees matching search.</p>';
}
}

if (sourcePool) sourcePool.scrollTop = sourceScrollPos;
if (targetList) targetList.scrollTop = targetScrollPos;

document.querySelectorAll('.dnd-draggable').forEach(el => {
uiBindLongPress(el, () => {
const name = el.getAttribute('data-name');
const arr = el.getAttribute('data-source-array');
const p = (manualPairingData[arr] || []).find(x => x.name.replace(/'/g, "\\'") === name);
if (p) showPersonInfo(p);
});
});
}

function handleManualPairingDrop(sourceName, sourceRole, targetName) {
let volName = sourceRole === 'VOLUNTEER' ? sourceName : targetName;
let traineeName = sourceRole === 'TRAINEE' ? sourceName : targetName;

lastPairingLocalChange = Date.now();

let trainee = manualPairingData.trainees.find(t => t.name === traineeName);
if (!trainee || trainee.isGoneHome) return;

const tGroup = String(trainee.group || "").trim();
const cleanVolName = volName.toLowerCase();
let blockingTraineeName = null;

manualPairingData.trainees.forEach(otherT => {
if (otherT.name === traineeName || !otherT.volPaired) return;
const vols = otherT.volPaired.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
if (vols.includes(cleanVolName)) {
const otherTGroup = String(otherT.group || "").trim();
if (tGroup !== "" && otherTGroup !== "" && tGroup !== otherTGroup) {
blockingTraineeName = otherT.name;
}
}
});

if (blockingTraineeName) {
showFlashMessage('pairingGlobalStatus', `Cannot pair! ${volName} is already paired with ${blockingTraineeName} in a different group.`, 'error');
return;
}

const currentVols = trainee.volPaired ? trainee.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v) : [];
const exists = currentVols.some(v => v.toLowerCase() === cleanVolName);

if (!exists) {
currentVols.push(volName);
trainee.volPaired = currentVols.join(', ');

const updateIndex = pendingPairingUpdates.findIndex(u => u.traineeName === traineeName);
if (updateIndex > -1) {
pendingPairingUpdates[updateIndex].volPaired = trainee.volPaired;
} else {
pendingPairingUpdates.push({ traineeName: traineeName, volPaired: trainee.volPaired });
}

updatePairingCardDOM(volName, 'VOLUNTEER');
updatePairingCardDOM(traineeName, 'TRAINEE');
updateGlobalUnpairedCount();

triggerManualPairingPulse(sourceName, targetName, true);
triggerManualPairingSync();
} else {
showFlashMessage('pairingGlobalStatus', "Already paired!", 'error');
}
}

function unpairTrainee(traineeName, volName) {
lastPairingLocalChange = Date.now();

let trainee = manualPairingData.trainees.find(t => t.name === traineeName);
if (!trainee || trainee.isGoneHome) return;

let currentVols = trainee.volPaired ? trainee.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v) : [];
const cleanVolToRemove = volName.toLowerCase();

currentVols = currentVols.filter(v => v.toLowerCase() !== cleanVolToRemove);
trainee.volPaired = currentVols.join(', ');

const updateIndex = pendingPairingUpdates.findIndex(u => u.traineeName === traineeName);
if (updateIndex > -1) {
pendingPairingUpdates[updateIndex].volPaired = trainee.volPaired;
} else {
pendingPairingUpdates.push({ traineeName: traineeName, volPaired: trainee.volPaired });
}

updatePairingCardDOM(volName, 'VOLUNTEER');
updatePairingCardDOM(traineeName, 'TRAINEE');
updateGlobalUnpairedCount();

triggerManualPairingPulse(traineeName, volName, false);
triggerManualPairingSync();
}

function setManualPairingSyncButtonState(state) {
const btn = document.getElementById('btn-sync-manual-pairing');
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
if (pendingPairingUpdates.length === 0) {
btn.className = "text-[10px] md:text-xs px-1.5 py-1 rounded font-bold transition flex items-center border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 shadow-sm focus:outline-none shrink-0";
textSpan.textContent = "Saved";
}
}, 2000);
} else if (state === 'error') { 
btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200', 'dark:bg-red-900/30', 'dark:text-red-400', 'dark:border-red-800'); 
textSpan.textContent = "Save Failed"; 
}
}

function triggerManualPairingSync() {
setManualPairingSyncButtonState('saving');
if (manualPairingSyncTimeout) clearTimeout(manualPairingSyncTimeout);
manualPairingSyncTimeout = setTimeout(() => {
executeManualPairingSync();
}, 800); 
}

async function executeManualPairingSync() {
if (isManualPairingSyncing) return; 
if (pendingPairingUpdates.length === 0) return;

isManualPairingSyncing = true;
setManualPairingSyncButtonState('saving');

const updatesToSync = [...pendingPairingUpdates];
pendingPairingUpdates = [];

try {
const res = await apiCall('syncManualPairingUpdates', { sheetUrl: currentManualPairingSheetUrl, updates: updatesToSync });

if (res.success) {
setManualPairingSyncButtonState('saved');
} else {
throw new Error(res.message);
}
} catch(e) {
console.error(e);
setManualPairingSyncButtonState('error');
updatesToSync.forEach(u => {
const idx = pendingPairingUpdates.findIndex(p => p.traineeName === u.traineeName);
if (idx === -1) pendingPairingUpdates.push(u);
});
} finally {
isManualPairingSyncing = false;
if (pendingPairingUpdates.length > 0) {
triggerManualPairingSync();
}
}
}

function startManualPairingPolling() {
if (manualPairingPollInterval) clearInterval(manualPairingPollInterval);

manualPairingPollInterval = setInterval(async () => {
if (isManualPairingSyncing || (window.dndState && (window.dndState.el || window.dndState.isDragging))) return;
if (pendingPairingUpdates.length > 0) return;

const fetchStartTime = Date.now();

try {
const res = await apiCall('fetchManualPairingData', { sheetUrl: currentManualPairingSheetUrl });
if(res.success && !isManualPairingSyncing && pendingPairingUpdates.length === 0) {
if (lastPairingLocalChange > fetchStartTime) return;

const newDataStr = JSON.stringify(res.data);
const oldDataStr = JSON.stringify(manualPairingData);

if (newDataStr !== oldDataStr) {
  manualPairingData = res.data;
  renderManualPairings();
}
}
} catch(e) { }
}, 10000); 
}

async function manualSyncManualPairing() {
if (isManualPairingSyncing) return; 

if (pendingPairingUpdates.length > 0) {
await executeManualPairingSync();
}

setManualPairingSyncButtonState('loading');
const overlay = document.getElementById('manualPairingLoadingOverlay');
if(overlay) overlay.classList.remove('hidden');

const fetchStartTime = Date.now();

try {
const res = await apiCall('fetchManualPairingData', { sheetUrl: currentManualPairingSheetUrl });
if(overlay) overlay.classList.add('hidden');
if (res.success) {
if (lastPairingLocalChange > fetchStartTime) return;

manualPairingData = res.data;
renderManualPairings();
setManualPairingSyncButtonState('saved');
} else {
setManualPairingSyncButtonState('error');
}
} catch (e) {
if(overlay) overlay.classList.add('hidden');
setManualPairingSyncButtonState('error');
}
}

// ==========================================
// QUICK PAIR MODAL LOGIC
// ==========================================
let quickPairContext = { sourceName: '', sourceRole: '', targetList: [] };

function openQuickPairModal(sourceName, sourceRole) {
quickPairContext.sourceName = sourceName;
quickPairContext.sourceRole = sourceRole;

const modal = document.getElementById('quickPairModal');
const title = document.getElementById('quickPairModalTitle');
const input = document.getElementById('quickPairSearch');

if(!modal || !title || !input) return;

title.innerHTML = `Pairing with <span class="text-primary">${sourceName}</span>`;
input.value = '';

const sortFn = (a, b) => {
const projA = a.project ? a.project.toString().toLowerCase().trim() : "zzzz";
const projB = b.project ? b.project.toString().toLowerCase().trim() : "zzzz";
const projCmp = projA.localeCompare(projB);
if (projCmp !== 0) return projCmp;

const nameA = a.name ? a.name.toString().toLowerCase().trim() : "";
const nameB = b.name ? b.name.toString().toLowerCase().trim() : "";
return nameA.localeCompare(nameB);
};

if (sourceRole === 'VOLUNTEER') {
quickPairContext.targetList = (manualPairingData.trainees || [])
.filter(t => {
const att = t.attending ? String(t.attending).toLowerCase().trim() : "";
return att === 'y' && !t.isGoneHome;
})
.sort(sortFn)
.map(t => t.name);
} else {
quickPairContext.targetList = (manualPairingData.volunteers || [])
.sort(sortFn)
.map(v => v.name);
}

filterQuickPairList();
modal.classList.remove('hidden');
setTimeout(() => input.focus(), 100);
}

function closeQuickPairModal() {
const modal = document.getElementById('quickPairModal');
if(modal) modal.classList.add('hidden');
}

function filterQuickPairList() {
const input = document.getElementById('quickPairSearch').value.toLowerCase().trim();
const listEl = document.getElementById('quickPairList');
listEl.innerHTML = '';

const matches = quickPairContext.targetList.filter(name => name.toLowerCase().includes(input));

if (matches.length === 0) {
listEl.innerHTML = '<li class="text-xs text-gray-500 p-2 text-center">No matches found</li>';
return;
}

matches.forEach(name => {
let isPaired = false;
const traineeName = quickPairContext.sourceRole === 'TRAINEE' ? quickPairContext.sourceName : name;
const volName = quickPairContext.sourceRole === 'VOLUNTEER' ? quickPairContext.sourceName : name;

const trainee = manualPairingData.trainees.find(t => t.name === traineeName);
if (trainee && trainee.volPaired) {
const vols = trainee.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
isPaired = vols.some(v => v.toLowerCase() === volName.toLowerCase());
}

const li = document.createElement('li');
li.className = `p-3 rounded border text-sm font-bold flex justify-between items-center transition-colors ${isPaired ? 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 opacity-60 cursor-not-allowed' : 'bg-white dark:bg-black border-gray-200 dark:border-zinc-700 hover:border-primary cursor-pointer'}`;

li.innerHTML = `<span>${name}</span> ${isPaired ? '<i class="fa-solid fa-check text-green-500"></i>' : ''}`;

if (!isPaired) {
li.onclick = () => {
handleManualPairingDrop(quickPairContext.sourceName, quickPairContext.sourceRole, name);
closeQuickPairModal();
};
}
listEl.appendChild(li);
});
}