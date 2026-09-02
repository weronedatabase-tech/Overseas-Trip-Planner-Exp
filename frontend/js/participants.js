let adminRosterData = [];
let rosterSearchQuery = '';

let rosterSortRules = JSON.parse(localStorage.getItem('rosterSortRules')) || [{ col: 'specialSort', asc: true }];

let rosterCols = JSON.parse(localStorage.getItem('rosterCols')) || [
{ id: 'role', label: 'Role', width: 90, visible: false },
{ id: 'group', label: 'Project', width: 100, visible: false },
{ id: 'room', label: 'Room', width: 120, visible: true },
{ id: 'pairings', label: 'Pairing(s)', width: 150, visible: true },
{ id: 'bus', label: 'Bus', width: 90, visible: true },
{ id: 'gender', label: 'Gender', width: 80, visible: true },
{ id: 'nationality', label: 'Nationality', width: 110, visible: true },
{ id: 'nric', label: 'NRIC', width: 100, visible: true },
{ id: 'passportNo', label: 'Passport No', width: 110, visible: true },
{ id: 'passportExpiry', label: 'Expiry', width: 100, visible: true },
{ id: 'dob', label: 'DOB', width: 100, visible: true },
{ id: 'contact', label: 'Contact', width: 100, visible: true },
{ id: 'address', label: 'Address', width: 220, visible: true },
{ id: 'emergencyName', label: 'Emerg. Name', width: 140, visible: true },
{ id: 'emergencyContact', label: 'Emerg. Contact', width: 120, visible: true },
{ id: 'diet', label: 'Dietary', width: 180, visible: true },
{ id: 'medical', label: 'Medical & Medications', width: 220, visible: true },
{ id: 'otherPoints', label: 'Other Notes', width: 220, visible: true }
];

// Ensure backwards compatibility with older stored column states
if (!rosterCols.find(c => c.id === 'bus')) {
    const pairIdx = rosterCols.findIndex(c => c.id === 'pairings');
    rosterCols.splice(pairIdx > -1 ? pairIdx + 1 : rosterCols.length, 0, { id: 'bus', label: 'Bus', width: 90, visible: true });
}
if (!rosterCols.find(c => c.id === 'medical')) {
    const otherIdx = rosterCols.findIndex(c => c.id === 'otherPoints');
    rosterCols.splice(otherIdx > -1 ? otherIdx : rosterCols.length, 0, { id: 'medical', label: 'Medical & Medications', width: 220, visible: true });
    const oldOther = rosterCols.find(c => c.id === 'otherPoints');
    if (oldOther) oldOther.label = 'Other Notes';
    localStorage.setItem('rosterCols', JSON.stringify(rosterCols));
}


// Force hide role and group in existing localStorage rosterCols if they are still visible
const savedCols = JSON.parse(localStorage.getItem('rosterCols'));
if (savedCols) {
    let changed = false;
    savedCols.forEach(c => {
        if ((c.id === 'role' || c.id === 'group') && c.visible) {
            c.visible = false;
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem('rosterCols', JSON.stringify(savedCols));
        rosterCols = savedCols;
    }
}

let traineeShortNames = {};

function buildParticipantsUI() {
document.getElementById('tab-participants').innerHTML = `
<div class="flex flex-col h-full w-full relative bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
   <div class="py-1.5 px-2 md:px-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center gap-2 shrink-0">
       <div class="flex items-center gap-1.5 shrink-0 whitespace-nowrap min-w-0">
           <h3 class="font-black text-gray-900 dark:text-white text-base md:text-lg truncate shrink-0"><span class="hidden md:inline">Participant </span>Roster</h3>
           <span id="rosterTotalCount" class="text-gray-500 font-black text-sm md:text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 shrink-0">(0)</span>
           <button onclick="showRosterBreakdownModal()" class="flex items-center justify-center bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/60 focus:outline-none transition rounded-lg px-2 py-1 md:px-2.5 md:py-1.5 shadow-sm border border-green-200 dark:border-green-800 shrink-0 ml-1" title="View Roster Breakdown">
               <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               <span class="text-xs md:text-xs font-black ml-1.5 uppercase tracking-wider hidden md:inline">Breakdown</span>
           </button>
       </div>
       <div class="flex items-center gap-2">
           <select onchange="if(this.value) window.location.href=this.value" class="bg-primary text-white border border-transparent text-xs md:text-sm font-black px-3 py-1.5 rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:focus:ring-offset-gray-900 shadow-md cursor-pointer shrink-0 transition">
               <option value="" disabled selected class="bg-white dark:bg-gray-800 text-gray-400">Custom Views</option>
               <option value="medical.html" class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Medical</option>
               <option value="diet.html" class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Dietary</option>
               <option value="expired.html" class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Expired Passports</option>
               <option value="other.html" class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Other Notes</option>
           </select>
           <button onclick="loadParticipantsData()" class="p-1.5 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition focus:outline-none shadow-sm" title="Refresh Roster">
               <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
           </button>
       </div>
   </div>
   
   <div class="py-1 px-2 md:px-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shrink-0 flex items-center gap-2">
       <div class="relative w-full flex-1">
           <input type="text" id="rosterSearch" oninput="handleRosterSearch()" placeholder="Fuzzy search across all fields..." class="w-full p-2 pl-9 pr-8 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition">
           <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
           <button onclick="clearSearch('rosterSearch', 'handleRosterSearch')" class="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
       </div>
       <div class="relative">
           <button onclick="toggleSortSelector()" class="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition focus:outline-none flex items-center gap-1">
               <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg> Sort
           </button>
           <div id="sortSelector" class="hidden-force fixed left-4 right-4 top-24 md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[60] p-4 max-h-[80vh] overflow-y-auto">
              <h4 class="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">Advanced Sort</h4>
              <div id="sortRulesContainer" class="space-y-2 mb-3"></div>
              <button onclick="addSortRule()" class="w-full text-xs font-bold text-green-600 dark:text-green-400 border border-dashed border-green-300 dark:border-green-700 rounded py-1 mb-2 hover:bg-green-50 dark:hover:bg-green-900/20 transition">+ Add Level</button>
              <button onclick="applySortRules(); toggleSortSelector();" class="w-full bg-primary text-white text-xs font-bold py-2 rounded-lg shadow-sm hover:bg-green-600 transition">Apply Sort</button>
           </div>
       </div>
       <div class="relative">
           <button onclick="toggleColumnSelector()" class="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition focus:outline-none flex items-center gap-1">
               Columns <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
           </button>
           <div id="columnSelector" class="hidden-force absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-30 p-2 flex flex-col gap-1 max-h-96 overflow-y-auto custom-scrollbar">
              ${rosterCols.map(c => `
                <label class="flex items-center gap-2 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition">
                  <input type="checkbox" value="${c.id}" ${c.visible ? 'checked' : ''} onchange="toggleRosterColumn('${c.id}', this.checked)" class="w-4 h-4 text-primary rounded border-gray-300">
                  <span class="text-xs font-bold text-gray-700 dark:text-gray-200">${c.label}</span>
                </label>
              `).join('')}
           </div>
       </div>
   </div>
   
   <div class="flex-1 min-h-0 overflow-auto custom-scrollbar relative" id="rosterTableContainer">
       <table class="w-full table-auto text-left border-collapse border-b border-gray-200 dark:border-gray-700">
           <thead id="rosterTableHead" class="sticky top-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase font-black tracking-wider z-20 shadow-sm border-b border-gray-200 dark:border-gray-700">
           </thead>
           <tbody id="rosterTableBody" class="text-sm divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
           </tbody>
       </table>
       
       <div id="rosterLoading" class="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex flex-col justify-center items-center z-30">
           <div class="loader !w-8 !h-8 border-primary mb-2"></div>
           <span class="text-primary dark:text-green-400 font-bold text-xs tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Fetching Directory...</span>
       </div>
   </div>
</div>
`;

document.addEventListener('click', (e) => {
   const colSel = document.getElementById('columnSelector');
   if(colSel && !colSel.classList.contains('hidden-force') && !e.target.closest('#columnSelector') && !e.target.closest('button[onclick="toggleColumnSelector()"]')) {
       colSel.classList.add('hidden-force');
   }
   const sortSel = document.getElementById('sortSelector');
   if(sortSel && !sortSel.classList.contains('hidden-force') && !e.target.closest('#sortSelector') && !e.target.closest('button[onclick="toggleSortSelector()"]')) {
       sortSel.classList.add('hidden-force');
   }
});

renderSortRulesUI();
loadParticipantsData();
}

function toggleColumnSelector() { document.getElementById('columnSelector').classList.toggle('hidden-force'); }
function toggleSortSelector() { document.getElementById('sortSelector').classList.toggle('hidden-force'); }

function toggleRosterColumn(colId, isVisible) {
const c = rosterCols.find(x => x.id === colId);
if(c) c.visible = isVisible;
localStorage.setItem('rosterCols', JSON.stringify(rosterCols));
renderRosterTable();

   

}

window.showRosterBreakdownModal = function() {
    let breakdown = {};
    let totalTrainee = 0;
    let totalVolunteer = 0;
    let totalCaregiver = 0;
    let grandTotal = 0;

    adminRosterData.forEach(p => {
        const role = p.role || 'UNKNOWN';
        const project = (p.group || 'None').toUpperCase();
        if(!breakdown[project]) breakdown[project] = { TRAINEE: 0, VOLUNTEER: 0, CAREGIVER: 0, total: 0 };
        if(breakdown[project][role] !== undefined) breakdown[project][role]++;
        else breakdown[project][role] = 1;
        breakdown[project].total++;
        
        if (role === 'TRAINEE') totalTrainee++;
        else if (role === 'VOLUNTEER') totalVolunteer++;
        else if (role === 'CAREGIVER') totalCaregiver++;
        grandTotal++;
    });

    let totalsHtml = `
    <div class="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg mb-4">
        <h4 class="font-black text-sm text-gray-900 dark:text-white mb-2 flex items-center justify-between">Total Participants <span class="bg-primary text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm">${grandTotal}</span></h4>
        <div class="grid grid-cols-3 gap-2 text-center text-xs">
            <div class="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 p-1.5 rounded font-bold border border-green-200 dark:border-green-800 shadow-sm">TRN: ${totalTrainee}</div>
            <div class="bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 p-1.5 rounded font-bold border border-orange-200 dark:border-orange-800 shadow-sm">VOL: ${totalVolunteer}</div>
            <div class="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 p-1.5 rounded font-bold border border-purple-200 dark:border-purple-800 shadow-sm">CGV: ${totalCaregiver}</div>
        </div>
    </div>`;

    
    let html = '<div class="space-y-4">';
    const projKeys = Object.keys(breakdown).sort((a,b) => a.localeCompare(b));
    projKeys.forEach(proj => {
        const bd = breakdown[proj];
        html += `<div class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 class="font-black text-sm text-gray-900 dark:text-white mb-2">${proj} <span class="text-gray-500 font-medium">(${bd.total})</span></h4>
            <div class="grid grid-cols-3 gap-2 text-center text-xs">
                <div class="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 p-1.5 rounded font-bold border border-green-200 dark:border-green-800">TRN: ${bd.TRAINEE}</div>
                <div class="bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 p-1.5 rounded font-bold border border-orange-200 dark:border-orange-800">VOL: ${bd.VOLUNTEER}</div>
                <div class="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 p-1.5 rounded font-bold border border-purple-200 dark:border-purple-800">CGV: ${bd.CAREGIVER}</div>
            </div>
        </div>`;
    });
    html += '</div>';
    
    const existing = document.getElementById('rosterBreakdownModal');
    if(existing) existing.remove();
    
    const modalHtml = `
    <div id="rosterBreakdownModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 animate-slide-up">
            <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                <h3 class="font-black text-lg text-gray-900 dark:text-white tracking-tight">Participant Breakdown</h3>
                <button type="button" onclick="document.getElementById('rosterBreakdownModal').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold px-1 focus:outline-none">&times;</button>
            </div>
            <div class="p-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                ${totalsHtml}
                ${html}
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

async function loadParticipantsData() {
const loader = document.getElementById('rosterLoading');
if(loader) loader.classList.remove('hidden-force');

try {
   const [rostRes, logRes] = await Promise.all([
        apiCall('fetchAdminRoster').catch(e => { console.warn("fetchAdminRoster failed", e); return { roster: [] }; }),
        apiCall('fetchLogistics').catch(e => { console.warn("fetchLogistics failed", e); return null; })
    ]);
   
   adminRosterData = rostRes.roster || []; applyCaregiverLabels(adminRosterData);
   const logisticsData = logRes || { rooms: [], pairings: [] };
   
   traineeShortNames = {};
   adminRosterData.forEach(p => {
       if(p.role === 'TRAINEE') {
           traineeShortNames[(p.fullName || '').toLowerCase()] = (p.shortName || p.fullName || '').toUpperCase();
       }
   });

   const roomsMap = {};
   if (logisticsData.rooms) {
       logisticsData.rooms.filter(r => !r.isDeleted).forEach(r => {
           r.occupants.forEach(n => roomsMap[n] = r.name.toUpperCase());
       });
   }
   
   const pairingsMap = {};
   if (logisticsData.pairings) {
       logisticsData.pairings.filter(p => p.status === 'ACTIVE').forEach(pair => {
           if(!pairingsMap[pair.traineeNric]) pairingsMap[pair.traineeNric] = [];
           if(!pairingsMap[pair.volNric]) pairingsMap[pair.volNric] = [];
           
           const v = adminRosterData.find(x => x.nric === pair.volNric);
           const t = adminRosterData.find(x => x.nric === pair.traineeNric);
           
           if(v) pairingsMap[pair.traineeNric].push(((v.shortName || v.fullName) || '').toUpperCase());
           if(t) pairingsMap[pair.volNric].push(((t.shortName || t.fullName) || '').toUpperCase());
       });
   }

   adminRosterData.forEach(p => {
       p.room = roomsMap[p.nric] || 'UNASSIGNED';
       let myPairings = pairingsMap[p.nric] ? [...pairingsMap[p.nric]] : [];
       if (p.role === 'CAREGIVER' && p.relatedTrainee) {
           const rNames = p.relatedTrainee.split(',').map(n => n.trim().toLowerCase());
           const relatedList = adminRosterData.filter(x => rNames.includes((x.fullName||'').toLowerCase()) && x.role === 'TRAINEE');
           relatedList.forEach(related => {
               if (related && pairingsMap[related.nric]) {
                   myPairings.push(...pairingsMap[related.nric]);
               }
           });
       }
       p.pairings = myPairings.length > 0 ? Array.from(new Set(myPairings)).join(', ') : 'NONE';
   });

   renderRosterTable();
} catch(e) {
   console.error(e); showToast("Error: " + e.message, true);
} finally {
   if(loader) loader.classList.add('hidden-force');
}
}

function handleRosterSearch() {
rosterSearchQuery = document.getElementById('rosterSearch').value.toLowerCase().trim();
renderRosterTable();
}

// ==========================================
// ADVANCED SORTING
// ==========================================
const sortableFields = [
{ id: 'specialSort', label: 'Special (Project>Family>Single>Vol)' },
{ id: 'fullName', label: 'Full Name' },
{ id: 'role', label: 'Role' },
{ id: 'group', label: 'Project' },
{ id: 'room', label: 'Room' },
{ id: 'gender', label: 'Gender' },
{ id: 'nationality', label: 'Nationality' }
];

function renderSortRulesUI() {
const container = document.getElementById('sortRulesContainer');
if(!container) return;

let html = '';
rosterSortRules.forEach((rule, idx) => {
   let opts = sortableFields.map(f => `<option value="${f.id}" ${rule.col === f.id ? 'selected' : ''}>${f.label}</option>`).join('');
   html += `
   <div class="flex items-center gap-1">
       <select onchange="updateSortRule(${idx}, 'col', this.value)" class="flex-1 text-xs font-bold p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none">
           ${opts}
       </select>
       <select onchange="updateSortRule(${idx}, 'asc', this.value === 'true')" class="w-16 text-xs font-bold p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none">
           <option value="true" ${rule.asc ? 'selected' : ''}>ASC</option>
           <option value="false" ${!rule.asc ? 'selected' : ''}>DESC</option>
       </select>
       <button onclick="removeSortRule(${idx})" class="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded transition"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
   </div>
   `;
});
container.innerHTML = html;
}

function updateSortRule(idx, field, val) {
if(rosterSortRules[idx]) rosterSortRules[idx][field] = val;
}

function addSortRule() {
rosterSortRules.push({ col: 'fullName', asc: true });
renderSortRulesUI();
}

function removeSortRule(idx) {
rosterSortRules.splice(idx, 1);
if(rosterSortRules.length === 0) rosterSortRules.push({ col: 'fullName', asc: true });
renderSortRulesUI();
}

function applySortRules() {
localStorage.setItem('rosterSortRules', JSON.stringify(rosterSortRules));
renderRosterTable();
}

function quickSort(colId) {
rosterSortRules = [{ col: colId, asc: true }];
localStorage.setItem('rosterSortRules', JSON.stringify(rosterSortRules));
renderSortRulesUI();
renderRosterTable();
}

// ==========================================
// RESIZING & REORDERING
// ==========================================



let draggedColId = null;
window.onColDragStart = function(e, colId) {

draggedColId = colId;
e.dataTransfer.effectAllowed = 'move';
e.dataTransfer.setData('text/plain', colId);
e.target.classList.add('opacity-50');
}
window.onColDragEnd = function(e) {
e.target.classList.remove('opacity-50');
document.querySelectorAll('th').forEach(th => th.classList.remove('bg-gray-200', 'dark:bg-gray-700'));
}
window.onColDragOver = function(e) {
e.preventDefault();
e.dataTransfer.dropEffect = "move";
const th = e.target.closest('th');
if(th && th.dataset.colId !== draggedColId && th.dataset.colId !== 'fullName') {
   th.classList.add('bg-gray-200', 'dark:bg-gray-700');
}
}
window.onColDragLeave = function(e) {
const th = e.target.closest('th');
if(th) th.classList.remove('bg-gray-200', 'dark:bg-gray-700');
}
window.onColDrop = function(e, targetColId) {
e.preventDefault();
const th = e.target.closest('th');
if(th) th.classList.remove('bg-gray-200', 'dark:bg-gray-700');

if (!draggedColId || draggedColId === targetColId || targetColId === 'fullName' || draggedColId === 'fullName') return;

const fromIdx = rosterCols.findIndex(c => c.id === draggedColId);
const toIdx = rosterCols.findIndex(c => c.id === targetColId);
if(fromIdx > -1 && toIdx > -1) {
   const [moved] = rosterCols.splice(fromIdx, 1);
   rosterCols.splice(toIdx, 0, moved);
   localStorage.setItem('rosterCols', JSON.stringify(rosterCols));
   renderRosterTable();
}
}


// ==========================================
// RENDER TABLE
// ==========================================
function renderRosterTable() {
let data = [...adminRosterData];


if (rosterSearchQuery) {
   data = data.filter(p => {
       return Object.values(p).some(val => 
           val && val.toString().toLowerCase().includes(rosterSearchQuery)
       );
   });
}

const specialSortMap = new Map();
if (rosterSortRules.some(r => r.col === 'specialSort')) {
   const famMap = {};
   adminRosterData.forEach(x => {
       const poc = x.pocNric;
       if(!famMap[poc]) famMap[poc] = { count: 0, hasCaregiver: false };
       famMap[poc].count++;
       
   });
   data.forEach(p => {
       const poc = p.pocNric;
       const info = famMap[poc];
       const isFamily = info ? info.count > 1 : false;
       let catScore = 4;
       if (isFamily) catScore = 1;
       else if (p.role === 'TRAINEE') catScore = 2;
       else if (p.role === 'VOLUNTEER') catScore = 3;
       let roleScore = p.role === 'TRAINEE' ? 1 : (p.role === 'CAREGIVER' ? 2 : 3);
       specialSortMap.set(p.nric, {
           group: (p.group || '').toLowerCase(),
           catScore,
           poc: poc.toLowerCase(),
           roleScore,
           name: (p.fullName || '').toLowerCase()
       });
   });
}


    const countEl = document.getElementById('rosterTotalCount');
    if (countEl) countEl.innerText = `(${data.length})`;
data.sort((a, b) => {
   for (let rule of rosterSortRules) {
       if (rule.col === 'specialSort') {
           let keyA = specialSortMap.get(a.nric);
           let keyB = specialSortMap.get(b.nric);
           
           if (keyA.group < keyB.group) return rule.asc ? -1 : 1;
           if (keyA.group > keyB.group) return rule.asc ? 1 : -1;
           
           if (keyA.catScore < keyB.catScore) return rule.asc ? -1 : 1;
           if (keyA.catScore > keyB.catScore) return rule.asc ? 1 : -1;
           
           if (keyA.catScore === 1) {
               if (keyA.poc < keyB.poc) return rule.asc ? -1 : 1;
               if (keyA.poc > keyB.poc) return rule.asc ? 1 : -1;
           }
           
           if (keyA.roleScore < keyB.roleScore) return rule.asc ? -1 : 1;
           if (keyA.roleScore > keyB.roleScore) return rule.asc ? 1 : -1;
           
           if (keyA.name < keyB.name) return rule.asc ? -1 : 1;
           if (keyA.name > keyB.name) return rule.asc ? 1 : -1;
           continue;
       }

       let valA = a[rule.col] || '';
       let valB = b[rule.col] || '';
       
       if (rule.col === 'passportExpiry' || rule.col === 'dob') {
           valA = new Date(valA).getTime() || 0;
           valB = new Date(valB).getTime() || 0;
       } else {
           valA = valA.toString().toLowerCase();
           valB = valB.toString().toLowerCase();
       }
       
       if (valA < valB) return rule.asc ? -1 : 1;
       if (valA > valB) return rule.asc ? 1 : -1;
   }
   return 0;
});

const thead = document.getElementById('rosterTableHead');
let headHtml = `<tr>
   <th class="py-1.5 px-2 relative bg-gray-100 dark:bg-gray-800 roster-col-fullName align-top sticky left-0 z-20 border-r border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style="min-width: 150px; max-width: 300px;" data-col-id="fullName">
       <div class="flex items-center gap-1 cursor-pointer hover:text-primary transition" onclick="quickSort('fullName')">Full Name <span class="text-[10px]">↕</span></div>
       
   </th>`;

rosterCols.forEach(c => {
   if (c.visible) {
       headHtml += `
       <th class="py-1.5 px-2 relative bg-gray-100 dark:bg-gray-800 roster-col-${c.id} align-top" 
           style="white-space: nowrap; padding-left: 12px; padding-right: 12px;" 
           data-col-id="${c.id}" draggable="true" 
           ondragstart="onColDragStart(event, '${c.id}')" ondragend="onColDragEnd(event)"
           ondragover="onColDragOver(event)" ondragleave="onColDragLeave(event)" ondrop="onColDrop(event, '${c.id}')">
           <div class="flex items-center gap-1 cursor-pointer hover:text-primary transition" onclick="quickSort('${c.id}')">${c.label} <span class="text-[10px]">↕</span></div>
           
       </th>`;
   }
});
headHtml += `</tr>`;
thead.innerHTML = headHtml;

const tbody = document.getElementById('rosterTableBody');
let html = '';

let tripEnd = appSettings.tripEndDate ? new Date(appSettings.tripEndDate) : null;
let minExpiry = null;
if (tripEnd && !isNaN(tripEnd.getTime())) {
   minExpiry = new Date(tripEnd);
   minExpiry.setMonth(minExpiry.getMonth() + 6);
}

data.forEach(p => {
   let expiryHighlight = false;
   let formattedExpiry = p.passportExpiry;
   
   if (p.passportExpiry) {
       const expD = new Date(p.passportExpiry);
       if (!isNaN(expD.getTime())) {
           formattedExpiry = typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(p.passportExpiry) : p.passportExpiry;
           if (minExpiry && expD < minExpiry) {
               expiryHighlight = true;
           }
       }
   }

   let formattedDob = p.dob;
   if (p.dob) {
       const dD = new Date(p.dob);
       if (!isNaN(dD.getTime())) {
           formattedDob = typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(p.dob) : p.dob;
       }
   }

   const fullNameUpper = (p.fullName || '').toUpperCase();
   const shortNameUpper = (p.shortName || '').toUpperCase();

   const nameClass = expiryHighlight ? 'text-red-600 dark:text-red-400 font-extrabold' : 'font-bold text-gray-900 dark:text-gray-100';
   const expClass = expiryHighlight 
       ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1 py-0.5 rounded font-bold border border-red-200 dark:border-red-800 shadow-sm text-[11px] md:text-xs inline-block whitespace-nowrap' 
       : 'text-gray-800 dark:text-gray-200 whitespace-nowrap text-xs font-medium';
   
   const roleStr = p.role.substring(0, 3).toUpperCase();
   const roleColor = p.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (p.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
    
    html += `<tr class="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer" data-nric="${p.nric}">
       <td class="py-1.5 px-2 align-top roster-col-fullName sticky left-0 z-10 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-gray-50 dark:group-hover:bg-gray-800/50" style="min-width: 150px; max-width: 300px;">
           <div class="${nameClass} text-xs md:text-sm leading-tight whitespace-normal break-words">${fullNameUpper}</div>
           ${shortNameUpper && shortNameUpper !== fullNameUpper ? `<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium whitespace-normal break-words">${shortNameUpper}</div>` : ''}
           <div class="flex items-center gap-1 mt-1 flex-wrap">
               <span class="text-[11px] font-black ${roleColor} bg-gray-50 dark:bg-gray-800 px-1 py-[1px] leading-tight rounded-sm border border-gray-200 dark:border-gray-700 uppercase tracking-wide">${roleStr}</span>
               <span class="px-1 py-[1px] leading-tight rounded-sm border shadow-sm text-[11px] font-bold ${getProjectColor(p.group)} whitespace-normal break-words inline-block" title="${(p.group || 'None').toUpperCase()}">${getProjectAbbreviation(p.group || 'None')}</span>
           </div>
           ${p.caregiverFor ? `<div class="mt-1 font-bold text-purple-600 dark:text-purple-400 text-xs">[${p.caregiverFor.toUpperCase()}]</div>` : ''}
       </td>`;
       
   rosterCols.forEach(c => {
       if (c.visible) {
           const styleStr = ``;
           const baseClass = `px-3 py-2 align-top roster-col-${c.id} text-xs font-medium text-gray-800 dark:text-gray-200 ${['address', 'medical', 'diet', 'otherPoints', 'pairings'].includes(c.id) ? 'whitespace-normal break-words min-w-[150px] max-w-[300px]' : 'whitespace-nowrap'}`;
           
           if (c.id === 'role') {
               html += `<td class="${baseClass}" ${styleStr}><span class="text-[11px] font-black ${roleColor} bg-gray-50 dark:bg-gray-800 px-1 py-[1px] leading-tight rounded-sm border border-gray-200 dark:border-gray-700 uppercase tracking-wide">${roleStr}</span></td>`;
           } else if (c.id === 'group') {
               html += `<td class="${baseClass}" ${styleStr}><span class="px-2 py-0.5 rounded border shadow-sm text-xs font-bold ${getProjectColor(p.group)} whitespace-normal break-words inline-block">${(p.group || 'None').toUpperCase()}</span></td>`;
           } else if (c.id === 'nric') {
               html += `<td class="${baseClass} font-mono font-bold text-gray-700 dark:text-gray-300" ${styleStr}>${(p.nric||'').toUpperCase()}</td>`;
           } else if (c.id === 'passportNo') {
               html += `<td class="${baseClass} font-mono uppercase text-gray-700 dark:text-gray-300" ${styleStr}>${(p.passportNo || '-').toUpperCase()}</td>`;
           } else if (c.id === 'passportExpiry') {
               html += `<td class="${baseClass}" ${styleStr}><span class="${expClass}">${formattedExpiry || '-'}</span></td>`;
           } else if (c.id === 'dob') {
               html += `<td class="${baseClass}" ${styleStr}>${formattedDob || '-'}</td>`;
           } else if (c.id === 'diet') {
               const hasDiet = p.diet && p.diet.trim() && p.diet.trim().toLowerCase() !== 'nil' && p.diet.trim().toLowerCase() !== 'none';
               html += `<td class="${baseClass}" ${styleStr}>${hasDiet ? `<span class="text-red-700 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded inline-block whitespace-pre-wrap leading-tight">${p.diet}</span>` : `<span class="text-gray-400 italic">NONE</span>`}</td>`;
           } else if (c.id === 'medical') {
               const hasMedical = p.medical && p.medical.trim() && p.medical.trim().toLowerCase() !== 'nil' && p.medical.trim().toLowerCase() !== 'none';
               html += `<td class="${baseClass}" ${styleStr}>${hasMedical ? `<span class="text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded inline-block whitespace-pre-wrap leading-tight">${p.medical}</span>` : `<span class="text-gray-400 italic">NONE</span>`}</td>`;
           } else if (c.id === 'otherPoints') {
               const hasNotes = p.otherPoints && p.otherPoints.trim() && p.otherPoints.trim().toLowerCase() !== 'nil' && p.otherPoints.trim().toLowerCase() !== 'none';
               html += `<td class="${baseClass}" ${styleStr}>${hasNotes ? `<span class="text-orange-700 dark:text-orange-400 font-medium whitespace-pre-wrap leading-tight">${p.otherPoints}</span>` : `<span class="text-gray-400 italic">NONE</span>`}</td>`;
           } else if (c.id === 'room') {
               html += `<td class="${baseClass} font-bold" ${styleStr}>${(p.room || 'UNASSIGNED').toUpperCase()}</td>`;
           } else if (c.id === 'bus') {
               html += `<td class="${baseClass} font-bold" ${styleStr}>${(p.bus || 'UNASSIGNED').toUpperCase()}</td>`;
           } else if (c.id === 'pairings') {
               html += `<td class="${baseClass}" ${styleStr}>${(p.pairings || 'NONE').toUpperCase()}</td>`;
           } else if (c.id === 'emergencyName') {
               html += `<td class="${baseClass}" ${styleStr}>${(p.emergencyName || '-').toUpperCase()}</td>`;
           } else if (c.id === 'contact' || c.id === 'emergencyContact' || c.id === 'phone') {
               html += `<td class="${baseClass} font-mono font-bold" ${styleStr}>${renderPhoneLink(p[c.id])}</td>`;
           } else {
               html += `<td class="${baseClass}" ${styleStr}>${(p[c.id] || '-').toString().toUpperCase()}</td>`;
           }
       }
   });
   
   html += `</tr>`;
});

const colCount = rosterCols.filter(c => c.visible).length + 1;
tbody.innerHTML = html || `<tr><td colspan="${colCount}" class="p-6 text-center text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold">No participants found matching the criteria.</td></tr>`;
}