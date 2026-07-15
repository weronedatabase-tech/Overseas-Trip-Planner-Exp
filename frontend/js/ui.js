const projectColorPalette =[
'bg-slate-100 border-slate-400 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100',
'bg-gray-100 border-gray-400 text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-slate-100',
'bg-zinc-100 border-zinc-400 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-600 dark:text-zinc-100',
'bg-neutral-100 border-neutral-400 text-neutral-900 dark:bg-neutral-900 dark:border-neutral-600 dark:text-neutral-100',
'bg-stone-100 border-stone-400 text-stone-900 dark:bg-stone-900 dark:border-stone-600 dark:text-stone-100',
'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-900 dark:border-amber-600 dark:text-amber-100',
'bg-yellow-100 border-yellow-400 text-yellow-900 dark:bg-yellow-900 dark:border-yellow-600 dark:text-yellow-100',
'bg-lime-100 border-lime-400 text-lime-900 dark:bg-lime-900 dark:border-lime-600 dark:text-lime-100',
'bg-green-100 border-green-400 text-green-900 dark:bg-green-900 dark:border-green-600 dark:text-green-100',
'bg-emerald-100 border-emerald-400 text-emerald-900 dark:bg-emerald-900 dark:border-emerald-600 dark:text-emerald-100',
'bg-teal-100 border-teal-400 text-teal-900 dark:bg-teal-900 dark:border-teal-600 dark:text-teal-100',
'bg-cyan-100 border-cyan-400 text-cyan-900 dark:bg-cyan-900 dark:border-cyan-600 dark:text-cyan-100',
'bg-sky-100 border-sky-400 text-sky-900 dark:bg-sky-900 dark:border-sky-600 dark:text-sky-100',
'bg-blue-100 border-blue-400 text-blue-900 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-100',
'bg-indigo-100 border-indigo-400 text-indigo-900 dark:bg-indigo-900 dark:border-indigo-600 dark:text-indigo-100',
'bg-violet-100 border-violet-400 text-violet-900 dark:bg-violet-900 dark:border-violet-600 dark:text-violet-100',
'bg-purple-100 border-purple-400 text-purple-900 dark:bg-purple-900 dark:border-purple-600 dark:text-purple-100',
'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-900 dark:bg-fuchsia-900 dark:border-fuchsia-600 dark:text-fuchsia-100'
];

function getProjectColor(groupName) {
if (!groupName || groupName === 'None') return 'bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'; 
if (appSettings.projectColors && appSettings.projectColors[groupName]) return appSettings.projectColors[groupName];
return 'bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'; 
}

function getProjectAbbreviation(name) {
const match = name.match(/\((.*?)\)/); if (match && match[1]) return match[1].substring(0,3).toUpperCase();
const words = name.split(' ').filter(w => w.length > 0);
if (words.length > 1) return words.slice(0,3).map(w => w[0]).join('').toUpperCase();
return name.substring(0,3).toUpperCase();
}

function renderHeaderLegend() {
const deskCont = document.getElementById('headerLegend');
const mobCont = document.getElementById('mobHeaderLegend');
if (!appSettings.activeProjects || appSettings.activeProjects.length === 0) { 
if(deskCont) deskCont.innerHTML = ''; 
if(mobCont) mobCont.innerHTML = ''; 
return; 
}
let html = '';
appSettings.activeProjects.forEach(proj => {
if(!proj) return;
const colorCls = getProjectColor(proj); const shortName = getProjectAbbreviation(proj);
html += `<span class="px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold border shadow-sm cursor-help ${colorCls}" title="${proj}">${shortName}</span>`;
});
if(deskCont) deskCont.innerHTML = html;
if(mobCont) mobCont.innerHTML = html;
}

function setBtnLoading(btn, isLoading) {
if (!btn) return; 
const spinner = btn.querySelector('.btn-spinner');
const icon = btn.querySelector('.btn-icon');
const text = btn.querySelector('.btn-text');

if (isLoading) { 
btn.disabled = true; btn.classList.add('opacity-80', 'cursor-not-allowed'); 
if (spinner) spinner.classList.remove('hidden-force'); 
if (icon) icon.classList.add('opacity-0'); 
if (text) text.classList.add('opacity-0'); 
} else { 
btn.disabled = false; btn.classList.remove('opacity-80', 'cursor-not-allowed'); 
if (spinner) spinner.classList.add('hidden-force'); 
if (icon) icon.classList.remove('opacity-0');
if (text) text.classList.remove('opacity-0');
}
}

function showToast(msg, isError = false) {
const t = document.getElementById('toast'); t.textContent = msg;
t.className = `fixed top-12 left-1/2 transform -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-2xl z-[100] transition-opacity duration-300 text-sm font-bold border ${isError ? 'bg-red-600 text-white border-red-700' : 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-700 dark:border-gray-200'}`;
t.classList.remove('opacity-0'); setTimeout(() => t.classList.add('opacity-0'), 4000);
}

function toggleTheme() { document.documentElement.classList.toggle('dark'); localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); }

function goHome() { 
if(currentUser) return renderDashboard(); 
document.getElementById('authLayout').classList.add('hidden-force');
document.getElementById('unauthLayout').classList.remove('hidden-force');
document.querySelectorAll('#unauthMain > div').forEach(el => el.classList.add('hidden-force')); 
document.getElementById('viewLanding').classList.remove('hidden-force'); 
}

function navTo(view) {
document.querySelectorAll('#unauthMain > div').forEach(el => el.classList.add('hidden-force'));
if (view === 'register') { document.getElementById('viewRegister').classList.remove('hidden-force'); document.getElementById('membersContainer').innerHTML = ''; regMemberCount = 0; addRegMember(); }
if (view === 'login') { document.getElementById('viewLogin').classList.remove('hidden-force'); document.getElementById('loginPass').value = ''; }
}

function switchTab(tabId) {
document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden-force'));

document.querySelectorAll('.nav-item').forEach(el => { 
el.classList.remove('text-primary', 'dark:text-blue-400', 'font-bold', 'border-primary', 'md:bg-blue-50', 'md:dark:bg-gray-800'); 
el.classList.add('text-gray-500', 'dark:text-gray-400', 'font-medium', 'border-transparent', 'hover:bg-gray-50', 'dark:hover:bg-gray-800'); 
});

document.getElementById(`tab-${tabId}`).classList.remove('hidden-force');
const activeBtn = document.getElementById(`nav-${tabId}`);
if(activeBtn) { 
activeBtn.classList.remove('text-gray-500', 'dark:text-gray-400', 'font-medium', 'border-transparent', 'hover:bg-gray-50', 'dark:hover:bg-gray-800'); 
activeBtn.classList.add('text-primary', 'dark:text-blue-400', 'font-bold', 'border-primary', 'md:bg-blue-50', 'md:dark:bg-gray-800'); 
}

if(tabId === 'profile') loadProfileData();
if(tabId === 'participants') { if(typeof buildParticipantsUI === 'function') buildParticipantsUI(); }
if(tabId === 'logistics') { buildLogisticsUI(); switchLogisticsSubTab('pairings'); renderPairings(); }
if(tabId === 'attendance') { buildAttendanceUI(); renderAttendanceChecklist(); }
if(tabId === 'finance') { if(typeof buildFinanceUI === 'function') buildFinanceUI(); }
if(tabId === 'minutes') { if(typeof buildMinutesUI === 'function') buildMinutesUI(); }
if(tabId === 'settings') buildSettingsUI();
if(tabId === 'files') {
if (!document.getElementById('driveContentsList')) {
buildFilesUI();
currentDrivePath = [];
loadDriveFolder('root', 'Trip Folder');
}
}
}

function injectGlobalModals() {
document.getElementById('modalContainer').innerHTML = `
<div id="tripSetupModal" class="fixed inset-0 bg-black/60 z-[95] hidden-force flex justify-center items-center p-4 backdrop-blur-sm transition-opacity overflow-y-auto">
<div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm p-6 shadow-2xl border border-gray-200 dark:border-gray-700 m-auto">
<h3 class="text-xl font-bold mb-2 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Initialize Trip Setup</h3>
<div class="space-y-3 mb-6 mt-4">
<div><label class="block text-[10px] uppercase font-bold mb-1 text-gray-500 dark:text-gray-400 tracking-wider">Trip Title</label><input type="text" id="tripTitleInput" value="MYG Overseas Trip" class="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
<div><label class="block text-[10px] uppercase font-bold mb-1 text-gray-500 dark:text-gray-400 tracking-wider">Trip Year</label><input type="number" id="tripYearInput" class="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
<div class="grid grid-cols-2 gap-2 mt-2">
  <div><label class="block text-[10px] uppercase font-bold mb-1 text-gray-500 dark:text-gray-400 tracking-wider">Start Date</label><input type="date" id="tripStartInput" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:light] dark:[color-scheme:dark]"></div>
  <div><label class="block text-[10px] uppercase font-bold mb-1 text-gray-500 dark:text-gray-400 tracking-wider">End Date</label><input type="date" id="tripEndInput" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:light] dark:[color-scheme:dark]"></div>
</div>
<p class="text-[9px] text-gray-400 dark:text-gray-500 mt-1 leading-tight">End date is used to flag participants with passports expiring within 6 months.</p>
</div>
<div class="flex space-x-3">
<button onclick="cancelTripSetup()" class="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition focus:outline-none">Cancel</button>
<button onclick="confirmTripSetup(this)" class="flex-1 bg-primary text-white py-2.5 rounded-lg font-bold shadow-sm flex justify-center items-center hover:bg-blue-600 transition focus:outline-none"><span class="btn-text">Open Reg</span><div class="btn-spinner spinner-white hidden-force ml-2"></div></button>
</div>
</div>
</div>

<div id="selectionBottomSheet" class="fixed inset-0 bg-black/60 z-[95] hidden-force flex flex-col justify-end">
<div class="bg-white dark:bg-gray-900 rounded-t-3xl w-full max-w-md mx-auto overflow-hidden shadow-2xl animate-slide-up border-t border-gray-200 dark:border-gray-800 h-[80vh] flex flex-col">
<div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
<span id="sheetTitle" class="font-bold text-base md:text-lg text-gray-800 dark:text-gray-100 truncate pr-2">Select</span><button type="button" onclick="closeSelectionSheet()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold px-2 focus:outline-none shrink-0">&times;</button>
</div>
<div class="p-3 border-b border-gray-200 dark:border-gray-800 shrink-0 bg-gray-50 dark:bg-gray-900">
<input type="text" id="sheetSearchInput" oninput="filterBottomSheet()" placeholder="Search by name..." class="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-950 font-medium text-sm focus:outline-none focus:border-primary text-gray-900 dark:text-white shadow-sm">
</div>
<div class="flex-grow overflow-y-auto p-3 space-y-2 bg-gray-50/50 dark:bg-gray-900/50" id="sheetListContainer"></div>
</div>
</div>

<div id="colorPickerModal" class="fixed inset-0 bg-black/60 z-[96] hidden-force flex justify-center items-center p-4 backdrop-blur-sm">
<div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
<div class="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
<h3 class="text-lg font-bold text-gray-900 dark:text-white">Select Color</h3>
<button type="button" onclick="closeColorPicker()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold px-2 focus:outline-none">&times;</button>
</div>
<div class="grid grid-cols-6 gap-3 mb-2" id="colorPaletteGrid"></div>
</div>
</div>

<div id="datePickerSheet" class="fixed inset-0 bg-black/60 z-[90] hidden-force flex flex-col justify-end">
<div class="bg-white dark:bg-gray-900 rounded-t-3xl w-full max-w-md mx-auto overflow-hidden shadow-2xl animate-slide-up border-t border-gray-200 dark:border-gray-800">
<div class="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-800"><span class="font-bold text-lg text-gray-800 dark:text-gray-100">Select Date</span><button type="button" onclick="closePicker()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold px-2 focus:outline-none">&times;</button></div>
<div class="relative flex h-[200px] text-lg font-bold bg-white dark:bg-gray-950"><div class="picker-highlight"></div><div class="flex-1 picker-col" id="colDay"></div><div class="flex-1 picker-col" id="colMonth"></div><div class="flex-1 picker-col" id="colYear"></div></div>
<div class="p-5 border-t border-gray-200 dark:border-gray-800"><button type="button" onclick="confirmPicker()" class="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-lg shadow-md focus:outline-none hover:bg-blue-600 transition">Done</button></div>
</div>
</div>

<!-- Sleeping Request Info Modal -->
<div id="sleepingInfoModal" class="fixed inset-0 bg-black/60 z-[96] hidden-force flex justify-center items-center p-4 backdrop-blur-sm transition-opacity overflow-y-auto">
  <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm p-5 shadow-2xl border border-gray-200 dark:border-gray-700 m-auto animate-slide-up">
    <div class="flex justify-between items-center mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
      <h3 class="text-base font-black text-gray-900 dark:text-white flex items-center gap-2 min-w-0 pr-2">
        <svg class="w-5 h-5 text-indigo-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>
        <span id="sleepingModalTitle" class="truncate leading-tight">Sleeping Request</span>
      </h3>
      <button type="button" onclick="closeSleepingModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold px-1 focus:outline-none shrink-0">&times;</button>
    </div>
    <div class="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-100 dark:border-gray-700 whitespace-pre-wrap max-h-[40vh] overflow-y-auto custom-scrollbar leading-snug" id="sleepingModalContent"></div>
    <div class="mt-4 flex justify-end">
      <button onclick="closeSleepingModal()" class="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white py-2 px-5 rounded-lg font-bold shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition focus:outline-none border border-gray-200 dark:border-gray-600">Close</button>
    </div>
  </div>
</div>
`;
}

function getUnusedColor() {
const used = Object.values(appSettings.projectColors || {});
const unused = projectColorPalette.filter(c => !used.includes(c));
return unused.length > 0 ? unused[0] : projectColorPalette[0];
}

function openColorPickerForNewProject() {
pendingColorGroupTarget = 'NEW';
if(!newProjectSelectedColor) newProjectSelectedColor = getUnusedColor();
renderColorPickerGrid(); document.getElementById('colorPickerModal').classList.remove('hidden-force');
}
function openColorPicker(groupName) {
pendingColorGroupTarget = groupName; renderColorPickerGrid(); document.getElementById('colorPickerModal').classList.remove('hidden-force');
}
function closeColorPicker() { document.getElementById('colorPickerModal').classList.add('hidden-force'); }

function renderColorPickerGrid() {
const grid = document.getElementById('colorPaletteGrid');
const usedColors = Object.values(appSettings.projectColors || {});
let html = '';
projectColorPalette.forEach(colorCls => {
let isUsed = usedColors.includes(colorCls);
let isCurrent = false;
if (pendingColorGroupTarget === 'NEW') { isCurrent = (colorCls === newProjectSelectedColor); } 
else { isCurrent = (colorCls === appSettings.projectColors[pendingColorGroupTarget]); if(isCurrent) isUsed = false; }

const opacity = isUsed ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:scale-110';
const ring = isCurrent ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-800' : '';
const onclick = isUsed ? '' : `onclick="selectColor('${colorCls}')"`;
const bgMatch = colorCls.match(/bg-[a-z]+-[0-9]+/); const bgClass = bgMatch ? bgMatch[0] : 'bg-gray-200';

html += `<div ${onclick} class="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600 shadow-sm transition-all ${bgClass} ${opacity} ${ring}"></div>`;
});
grid.innerHTML = html;
}

async function selectColor(colorClass) {
closeColorPicker();
if (pendingColorGroupTarget === 'NEW') {
newProjectSelectedColor = colorClass;
const bgMatch = colorClass.match(/bg-[a-z]+-[0-9]+/);
document.getElementById('newGroupColorBtn').className = `w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600 shadow-sm transition hover:scale-105 ${bgMatch ? bgMatch[0] : 'bg-gray-200'}`;
} else {
showToast("Updating color...", false);
try {
const res = await callBackend('addProjectGroup', { groupName: pendingColorGroupTarget, callerNric: currentUser.nric, colorClass: colorClass });
appSettings.projectGroups = res.groups; appSettings.projectColors = res.projectColors;
if (typeof renderGroupList === "function") renderGroupList(res.groups); 
renderHeaderLegend(); showToast("Color Updated!");
} catch(e) { showToast(e.message, true); }
}
}