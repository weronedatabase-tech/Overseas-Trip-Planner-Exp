let otherRosterData = [];
let otherSearchQuery = '';

let otherSortRules = JSON.parse(localStorage.getItem('otherSortRules_v2')) || [{ col: 'fullName', asc: true }];
let otherCols = JSON.parse(localStorage.getItem('otherCols_v2')) || [
{ id: 'diet', label: 'Other Notes', width: 300, visible: true },
{ id: 'otherPoints', label: 'Other Notes', width: 220, visible: true }
];


let traineeShortNames = {};

function buildOtherUI() {
document.getElementById('tab-other').innerHTML = `
<div class="flex flex-col h-full w-full relative bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
   <div class="py-1.5 px-2 md:px-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center gap-2 shrink-0">
       <div class="flex items-center gap-2">
           <h3 class="font-black text-gray-900 dark:text-white text-base md:text-lg flex items-center gap-2">
               <svg class="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
               Other Notes
           </h3>
       </div>
       <div class="flex items-center gap-2">
           <select onchange="if(this.value) window.location.href=this.value" class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs md:text-xs font-bold px-2.5 py-1.5 rounded-md hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer shrink-0">
               <option value="" disabled>Custom Views</option>
               <option value="medical.html">Medical</option>
               <option value="diet.html">Dietary</option>
               <option value="expired.html">Expired Passports</option>
               <option value="other.html" selected>Other Notes</option>
           </select>
           <button onclick="loadOtherData()" class="p-1.5 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition focus:outline-none shadow-sm" title="Refresh">
               <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
           </button>
       </div>
   </div>
   
   <div class="py-1 px-2 md:px-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shrink-0 flex items-center gap-2">
       <div class="relative w-full flex-1">
           <input type="text" id="otherSearch" oninput="handleOtherSearch()" placeholder="Search by name or other notes..." class="w-full p-2 pl-9 pr-8 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition">
           <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
           <button onclick="clearSearch(\'otherSearch\', 'handleOtherSearch')" class="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
       </div>
   </div>
   
   <div class="flex-1 min-h-0 overflow-auto custom-scrollbar relative" id="otherTableContainer">
       <table class="w-full table-fixed text-left border-collapse border-b border-gray-200 dark:border-gray-700">
           <thead id="otherTableHead" class="sticky top-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase font-black tracking-wider z-10 shadow-sm border-b border-gray-200 dark:border-gray-700">
           </thead>
           <tbody id="otherTableBody" class="text-sm divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
           </tbody>
       </table>
       
       <div id="otherLoading" class="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex flex-col justify-center items-center z-20">
           <div class="loader !w-8 !h-8 border-primary mb-2"></div>
           <span class="text-primary dark:text-green-400 font-bold text-xs tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading Data...</span>
       </div>
   </div>
</div>
`;
loadOtherData();
}

async function loadOtherData() {
const loader = document.getElementById('otherLoading');
if(loader) loader.classList.remove('hidden-force');

try {
   const res = await apiCall('fetchAdminRoster');
   otherRosterData = res.roster || [];
   if (typeof applyCaregiverLabels === "function") applyCaregiverLabels(otherRosterData);

   traineeShortNames = {};
   otherRosterData.forEach(p => {
       if(p.role === 'TRAINEE' && p.fullName) {
           traineeShortNames[String(p.fullName || '').trim().toUpperCase()] = String(p.shortName || p.fullName || '').trim().toUpperCase();
       }
   });

   renderOtherTable();
} catch(e) {
   showToast("Failed to load medical data.", true);
} finally {
   if(loader) loader.classList.add('hidden-force');
}
}

function handleOtherSearch() {
otherSearchQuery = document.getElementById('otherSearch').value.toLowerCase().trim();
renderOtherTable();
}

let mResizingCol = null;
let mStartX = 0;
let mStartWidth = 0;

function initOtherResize(e, colId) {
e.stopPropagation();
mResizingCol = colId;
mStartX = e.clientX;
const colDef = colId === 'fullName' ? {width: 250} : otherCols.find(c => c.id === colId);
mStartWidth = colDef.width || 150;
document.addEventListener('mousemove', onOtherMouseMove);
document.addEventListener('mouseup', onOtherMouseUp);
}

function onOtherMouseMove(e) {
if (!mResizingCol) return;
const diff = e.clientX - mStartX;
let newWidth = Math.max(50, mStartWidth + diff);

if (mResizingCol === 'fullName') {
   const cells = document.querySelectorAll(`.med-col-fullName`);
   cells.forEach(c => { c.style.width = newWidth + 'px'; c.style.minWidth = newWidth + 'px'; c.style.maxWidth = newWidth + 'px'; });
} else {
   const cDef = otherCols.find(c => c.id === mResizingCol);
   if (cDef) {
       cDef.width = newWidth;
       const cells = document.querySelectorAll(`.med-col-${mResizingCol}`);
       cells.forEach(c => { c.style.width = newWidth + 'px'; c.style.minWidth = newWidth + 'px'; c.style.maxWidth = newWidth + 'px'; });
   }
}
}

function onOtherMouseUp() {
if (mResizingCol && mResizingCol !== 'fullName') {
   localStorage.setItem('otherCols_v2', JSON.stringify(otherCols));
}
mResizingCol = null;
document.removeEventListener('mousemove', onOtherMouseMove);
document.removeEventListener('mouseup', onOtherMouseUp);
}

let otherDraggedColId = null;
window.onOtherColDragStart = function(e, colId) {
otherDraggedColId = colId;
e.dataTransfer.effectAllowed = "move";
e.target.classList.add('opacity-50');
}
window.onOtherColDragEnd = function(e) {
e.target.classList.remove('opacity-50');
document.querySelectorAll('th').forEach(th => th.classList.remove('bg-gray-200', 'dark:bg-gray-700'));
}
window.onOtherColDragOver = function(e) {
e.preventDefault();
e.dataTransfer.dropEffect = "move";
const th = e.target.closest('th');
if(th && th.dataset.colId !== otherDraggedColId && th.dataset.colId !== 'fullName') {
   th.classList.add('bg-gray-200', 'dark:bg-gray-700');
}
}
window.onOtherColDragLeave = function(e) {
const th = e.target.closest('th');
if(th) th.classList.remove('bg-gray-200', 'dark:bg-gray-700');
}
window.onOtherColDrop = function(e, targetColId) {
e.preventDefault();
const th = e.target.closest('th');
if(th) th.classList.remove('bg-gray-200', 'dark:bg-gray-700');

if (!otherDraggedColId || otherDraggedColId === targetColId || targetColId === 'fullName' || otherDraggedColId === 'fullName') return;

const fromIdx = otherCols.findIndex(c => c.id === otherDraggedColId);
const toIdx = otherCols.findIndex(c => c.id === targetColId);
if(fromIdx > -1 && toIdx > -1) {
   const [moved] = otherCols.splice(fromIdx, 1);
   otherCols.splice(toIdx, 0, moved);
   localStorage.setItem('otherCols_v2', JSON.stringify(otherCols));
   renderOtherTable();
}
}

function renderOtherTable() {
let data = otherRosterData.filter(p => {
    if (!p.otherPoints) return false;
    const notes = p.otherPoints.trim().toLowerCase();
    if (notes === '' || notes === '-' || notes === 'nil' || notes === 'na' || notes === 'n/a' || notes === 'none' || notes === 'no') return false;
    return true;
});
if (otherSearchQuery) {
   data = data.filter(p => {
       return (p.fullName && p.fullName.toLowerCase().includes(otherSearchQuery)) ||
              (p.shortName && p.shortName.toLowerCase().includes(otherSearchQuery)) ||
              (p.diet && p.diet.toLowerCase().includes(otherSearchQuery)) ||
              (p.otherPoints && p.otherPoints.toLowerCase().includes(otherSearchQuery));
   });
}
data.sort((a, b) => {
   let valA = (a.fullName || '').toString().toLowerCase();
   let valB = (b.fullName || '').toString().toLowerCase();
   if (valA < valB) return -1;
   if (valA > valB) return 1;
   return 0;
});

const thead = document.getElementById('otherTableHead');
let headHtml = `<tr>
   <th class="py-1.5 px-2 bg-gray-100 dark:bg-gray-800 align-top sticky top-0 left-0 z-20 border-r border-gray-200 dark:border-gray-700 shadow-sm w-[35%] text-left">
       <div class="font-bold text-gray-700 dark:text-gray-300">Participant</div>
   </th>
   <th class="py-1.5 px-2 bg-gray-100 dark:bg-gray-800 align-top sticky top-0 z-10 w-[65%] text-left">
       <div class="font-bold text-gray-700 dark:text-gray-300">Other Notes</div>
   </th>
</tr>`;
thead.innerHTML = headHtml;

const tbody = document.getElementById('otherTableBody');
let html = '';
data.forEach(p => {
   const roleStr = p.role.substring(0, 3).toUpperCase();
   const roleColor = p.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (p.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
   const fullNameUpper = (p.fullName || '').toUpperCase();
   const shortNameUpper = (p.shortName || '').toUpperCase();
   const nameClass = 'font-bold text-gray-900 dark:text-gray-100';
   
   html += `<tr class="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer" data-nric="${p.nric}">
       <td class="py-1.5 px-2 align-top sticky left-0 z-10 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-sm w-[35%]">
           <div class="${nameClass} text-xs md:text-sm leading-tight whitespace-normal break-words">${fullNameUpper}</div>
           ${shortNameUpper && shortNameUpper !== fullNameUpper ? `<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium whitespace-normal break-words">${shortNameUpper}</div>` : ''}
           <div class="flex items-center gap-1 mt-1 flex-wrap">
               <span class="text-[11px] font-black ${roleColor} bg-gray-50 dark:bg-gray-800 px-1 py-[1px] leading-tight rounded-sm border border-gray-200 dark:border-gray-700 uppercase tracking-wide">${roleStr}</span>
               <span class="px-1 py-[1px] leading-tight rounded-sm border shadow-sm text-[11px] font-bold ${getProjectColor(p.group)} whitespace-normal break-words inline-block" title="${(p.group || 'None').toUpperCase()}">${getProjectAbbreviation(p.group || 'None')}</span>
           </div>
           ${p.caregiverFor ? `<div class="mt-1 font-bold text-purple-600 dark:text-purple-400 text-xs">[${p.caregiverFor.toUpperCase()}]</div>` : ''}
       </td>
       <td class="py-1.5 px-2 align-top w-[65%] text-xs leading-relaxed whitespace-normal break-words border-l border-gray-100 dark:border-gray-700/50">
           <div class="flex flex-col gap-3">`;

   const hasNotes = p.otherPoints && p.otherPoints.trim() && p.otherPoints.trim().toLowerCase() !== 'nil' && p.otherPoints.trim().toLowerCase() !== 'none';
   if (hasNotes) {
       html += `<div><span class="text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded inline-block whitespace-pre-wrap">${p.otherPoints}</span></div>`;
   }
   
   
   
   html += `</div></td></tr>`;
});

tbody.innerHTML = html || `<tr><td colspan="2" class="p-6 text-center text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold">No records found matching the criteria.</td></tr>`;
}
