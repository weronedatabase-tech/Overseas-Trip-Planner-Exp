let medicalRosterData = [];
let expiredSearchQuery = '';

let medSortRules = JSON.parse(localStorage.getItem('expiredSortRules')) || [{ col: 'fullName', asc: true }];
let medCols = JSON.parse(localStorage.getItem('expiredCols')) || [
{ id: 'passportNo', label: 'Passport No.', width: 150, visible: true },
{ id: 'passportExpiry', label: 'Expiry Date', width: 150, visible: true },
{ id: 'nationality', label: 'Nationality', width: 120, visible: true }
];


let traineeShortNames = {};

function buildExpiredUI() {
document.getElementById('tab-expired').innerHTML = `
<div class="flex flex-col h-full w-full relative bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
   <div class="py-1.5 px-2 md:px-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center gap-2 shrink-0">
       <div class="flex items-center gap-2">
           <h3 class="font-black text-gray-900 dark:text-white text-base md:text-lg flex items-center gap-2">
               <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-3.75a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm3-.75a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
               Expired Passports
           </h3>
       </div>
       <div class="flex items-center gap-2">
           <select onchange="if(this.value) window.location.href=this.value" class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs md:text-xs font-bold px-2.5 py-1.5 rounded-md hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer shrink-0">
               <option value="" disabled>Custom Views</option>
               <option value="medical.html">Medical</option>
               <option value="diet.html">Dietary</option>
               <option value="expired.html" selected>Expired Passports</option>
               <option value="other.html">Other Notes</option>
           </select>
           <button onclick="loadExpiredData()" class="p-1.5 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition focus:outline-none shadow-sm" title="Refresh">
               <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
           </button>
       </div>
   </div>
   
   <div class="py-1 px-2 md:px-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shrink-0 flex items-center gap-2">
       <div class="relative w-full flex-1">
           <input type="text" id="expiredSearch" oninput="handleExpiredSearch()" placeholder="Search by name, diet, or medical notes..." class="w-full p-2 pl-9 pr-8 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition">
           <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
           <button onclick="clearSearch('expiredSearch', 'handleExpiredSearch')" class="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
       </div>
   </div>
   
   <div class="flex-1 min-h-0 overflow-auto custom-scrollbar relative" id="expiredTableContainer">
       <table class="w-full table-fixed text-left border-collapse border-b border-gray-200 dark:border-gray-700">
           <thead id="medicalTableHead" class="sticky top-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase font-black tracking-wider z-10 shadow-sm border-b border-gray-200 dark:border-gray-700">
           </thead>
           <tbody id="medicalTableBody" class="text-sm divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
           </tbody>
       </table>
       
       <div id="medicalLoading" class="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex flex-col justify-center items-center z-20">
           <div class="loader !w-8 !h-8 border-primary mb-2"></div>
           <span class="text-primary dark:text-green-400 font-bold text-xs tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading Data...</span>
       </div>
   </div>
</div>
`;
loadExpiredData();
}

async function loadExpiredData() {
const loader = document.getElementById('medicalLoading');
if(loader) loader.classList.remove('hidden-force');

try {
   const res = await apiCall('fetchAdminRoster');
   medicalRosterData = res.roster || [];
   if (typeof applyCaregiverLabels === "function") applyCaregiverLabels(medicalRosterData);

   traineeShortNames = {};
   medicalRosterData.forEach(p => {
       if(p.role === 'TRAINEE' && p.fullName) {
           traineeShortNames[String(p.fullName || '').trim().toUpperCase()] = String(p.shortName || p.fullName || '').trim().toUpperCase();
       }
   });

   renderExpiredTable();
} catch(e) {
   showToast("Failed to load medical data.", true);
} finally {
   if(loader) loader.classList.add('hidden-force');
}
}

function handleExpiredSearch() {
expiredSearchQuery = document.getElementById('expiredSearch').value.toLowerCase().trim();
renderExpiredTable();
}

let mResizingCol = null;
let mStartX = 0;
let mStartWidth = 0;

function initMedResize(e, colId) {
e.stopPropagation();
mResizingCol = colId;
mStartX = e.clientX;
const colDef = colId === 'fullName' ? {width: 250} : medCols.find(c => c.id === colId);
mStartWidth = colDef.width || 150;
document.addEventListener('mousemove', onMedMouseMove);
document.addEventListener('mouseup', onMedMouseUp);
}

function onMedMouseMove(e) {
if (!mResizingCol) return;
const diff = e.clientX - mStartX;
let newWidth = Math.max(50, mStartWidth + diff);

if (mResizingCol === 'fullName') {
   const cells = document.querySelectorAll(`.med-col-fullName`);
   cells.forEach(c => { c.style.width = newWidth + 'px'; c.style.minWidth = newWidth + 'px'; c.style.maxWidth = newWidth + 'px'; });
} else {
   const cDef = medCols.find(c => c.id === mResizingCol);
   if (cDef) {
       cDef.width = newWidth;
       const cells = document.querySelectorAll(`.med-col-${mResizingCol}`);
       cells.forEach(c => { c.style.width = newWidth + 'px'; c.style.minWidth = newWidth + 'px'; c.style.maxWidth = newWidth + 'px'; });
   }
}
}

function onMedMouseUp() {
if (mResizingCol && mResizingCol !== 'fullName') {
   localStorage.setItem('expiredCols', JSON.stringify(medCols));
}
mResizingCol = null;
document.removeEventListener('mousemove', onMedMouseMove);
document.removeEventListener('mouseup', onMedMouseUp);
}

let medDraggedColId = null;
window.onMedColDragStart = function(e, colId) {
medDraggedColId = colId;
e.dataTransfer.effectAllowed = "move";
e.target.classList.add('opacity-50');
}
window.onMedColDragEnd = function(e) {
e.target.classList.remove('opacity-50');
document.querySelectorAll('th').forEach(th => th.classList.remove('bg-gray-200', 'dark:bg-gray-700'));
}
window.onMedColDragOver = function(e) {
e.preventDefault();
e.dataTransfer.dropEffect = "move";
const th = e.target.closest('th');
if(th && th.dataset.colId !== medDraggedColId && th.dataset.colId !== 'fullName') {
   th.classList.add('bg-gray-200', 'dark:bg-gray-700');
}
}
window.onMedColDragLeave = function(e) {
const th = e.target.closest('th');
if(th) th.classList.remove('bg-gray-200', 'dark:bg-gray-700');
}
window.onMedColDrop = function(e, targetColId) {
e.preventDefault();
const th = e.target.closest('th');
if(th) th.classList.remove('bg-gray-200', 'dark:bg-gray-700');

if (!medDraggedColId || medDraggedColId === targetColId || targetColId === 'fullName' || medDraggedColId === 'fullName') return;

const fromIdx = medCols.findIndex(c => c.id === medDraggedColId);
const toIdx = medCols.findIndex(c => c.id === targetColId);
if(fromIdx > -1 && toIdx > -1) {
   const [moved] = medCols.splice(fromIdx, 1);
   medCols.splice(toIdx, 0, moved);
   localStorage.setItem('expiredCols', JSON.stringify(medCols));
   renderExpiredTable();
}
}

function renderExpiredTable() {


let tripEnd = appSettings.tripEndDate ? new Date(appSettings.tripEndDate) : null;
let minExpiry = null;
if (tripEnd && !isNaN(tripEnd.getTime())) {
   minExpiry = new Date(tripEnd);
   minExpiry.setMonth(minExpiry.getMonth() + 6);
}

let data = medicalRosterData.filter(p => {
    if (!p.passportExpiry) return false; // If they don't have an expiry date, exclude them from expired
    const expD = new Date(p.passportExpiry);
    // Include if valid date AND expires before minExpiry (6 months after trip)
    if (!isNaN(expD.getTime()) && minExpiry && expD < minExpiry) {
        return true;
    }
    // If no trip date is set, just show everything with an expiry for now, or fallback to current date + 6m
    if (!minExpiry) {
        const fallback = new Date();
        fallback.setMonth(fallback.getMonth() + 6);
        if (!isNaN(expD.getTime()) && expD < fallback) return true;
    }
    return false;
});
if (expiredSearchQuery) {
   data = data.filter(p => {
       return (p.fullName && p.fullName.toLowerCase().includes(expiredSearchQuery)) ||
              (p.shortName && p.shortName.toLowerCase().includes(expiredSearchQuery)) ||
              (p.passportNo && p.passportNo.toLowerCase().includes(expiredSearchQuery)) ||
              (p.nationality && p.nationality.toLowerCase().includes(expiredSearchQuery));
   });
}
data.sort((a, b) => {
   let valA = (a.fullName || '').toString().toLowerCase();
   let valB = (b.fullName || '').toString().toLowerCase();
   if (valA < valB) return -1;
   if (valA > valB) return 1;
   return 0;
});

const thead = document.getElementById('medicalTableHead');
let headHtml = `<tr>
   <th class="py-1.5 px-2 bg-gray-100 dark:bg-gray-800 align-top sticky top-0 left-0 z-20 border-r border-gray-200 dark:border-gray-700 shadow-sm w-[35%] text-left">
       <div class="font-bold text-gray-700 dark:text-gray-300">Participant</div>
   </th>
   <th class="py-1.5 px-2 bg-gray-100 dark:bg-gray-800 align-top sticky top-0 z-10 w-[65%] text-left">
       <div class="font-bold text-gray-700 dark:text-gray-300">Passport Details</div>
   </th>
</tr>`;
thead.innerHTML = headHtml;

const tbody = document.getElementById('medicalTableBody');
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
           <div class="flex flex-col gap-2">`;

   html += `<div class="grid grid-cols-2 gap-4">
       <div>
           <span class="font-bold text-gray-500 uppercase text-xs block mb-0.5">Passport Number</span>
           <div class="font-mono font-bold text-gray-800 dark:text-gray-200">${(p.passportNo || '-').toUpperCase()}</div>
       </div>
       <div>
           <span class="font-bold text-gray-500 uppercase text-xs block mb-0.5">Nationality</span>
           <div class="font-bold text-gray-800 dark:text-gray-200">${(p.nationality || '-').toUpperCase()}</div>
       </div>
   </div>`;

   let isExpired = false;
   if (minExpiry && p.passportExpiry) {
       const expD = new Date(p.passportExpiry);
       if (!isNaN(expD.getTime()) && expD < minExpiry) isExpired = true;
   }
   const expiryDisplay = p.passportExpiry ? (typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(p.passportExpiry) : new Date(p.passportExpiry).toLocaleDateString('en-GB')) : '-';
   
   html += `<div class="mt-2 p-2 rounded border ${isExpired ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}">
       <span class="font-bold ${isExpired ? 'text-red-500' : 'text-gray-500'} uppercase text-xs block mb-0.5">Expiry Date</span>
       <div class="font-bold ${isExpired ? 'text-red-700 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}">${expiryDisplay} ${isExpired ? '<span class="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[11px] uppercase tracking-wider">Expires within 6 months of trip</span>' : ''}</div>
   </div>`;

   html += `</div></td></tr>`;
});

tbody.innerHTML = html || `<tr><td colspan="2" class="p-6 text-center text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold">No records found matching the criteria.</td></tr>`;
}
