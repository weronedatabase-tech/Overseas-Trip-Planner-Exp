let adminRosterData = [];
let rosterSortCol = 'fullName';
let rosterSortAsc = true;
let rosterSearchQuery = '';

let activeColumns = ['role', 'group', 'nric', 'passportNo', 'passportExpiry', 'dob'];
const availableColumns = [
 { id: 'role', label: 'Role' },
 { id: 'group', label: 'Project' },
 { id: 'gender', label: 'Gender' },
 { id: 'nationality', label: 'Nationality' },
 { id: 'nric', label: 'NRIC' },
 { id: 'passportNo', label: 'Passport No' },
 { id: 'passportExpiry', label: 'Expiry' },
 { id: 'dob', label: 'DOB' },
 { id: 'contact', label: 'Contact' },
 { id: 'address', label: 'Address' },
 { id: 'emergencyName', label: 'Emerg. Name' },
 { id: 'emergencyContact', label: 'Emerg. Contact' }
];

function buildParticipantsUI() {
 document.getElementById('tab-participants').innerHTML = `
 <div class="flex flex-col h-full w-full relative bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
     <div class="p-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center gap-2 shrink-0">
         <h3 class="font-black text-gray-900 dark:text-white text-base md:text-lg">Participant Roster</h3>
         <div class="flex items-center gap-2">
             <button onclick="window.location.href='medical.html'" class="bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 text-[10px] md:text-xs font-bold px-2.5 py-1.5 rounded-md hover:bg-red-100 transition shadow-sm focus:outline-none shrink-0 flex items-center gap-1">
                 <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zM12 9v6m-3-3h6" /></svg>
                 Medical & Diet
             </button>
             <button onclick="loadParticipantsData()" class="p-1.5 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition focus:outline-none shadow-sm" title="Refresh Roster">
                 <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
             </button>
         </div>
     </div>
     
     <div class="p-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shrink-0 flex items-center gap-2">
         <div class="relative w-full flex-1">
             <input type="text" id="rosterSearch" oninput="handleRosterSearch()" placeholder="Fuzzy search across all fields..." class="w-full p-2 pl-9 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition">
             <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
         </div>
         <div class="relative">
             <button onclick="toggleColumnSelector()" class="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition focus:outline-none flex items-center gap-1">
                 Columns <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
             </button>
             <div id="columnSelector" class="hidden-force absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-30 p-2 grid grid-cols-1 gap-1">
                ${availableColumns.map(c => `
                  <label class="flex items-center gap-2 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition">
                    <input type="checkbox" value="${c.id}" ${activeColumns.includes(c.id) ? 'checked' : ''} onchange="toggleRosterColumn('${c.id}', this.checked)" class="w-4 h-4 text-primary rounded border-gray-300">
                    <span class="text-xs font-bold text-gray-700 dark:text-gray-200">${c.label}</span>
                  </label>
                `).join('')}
             </div>
         </div>
     </div>
     
     <div class="flex-1 overflow-auto custom-scrollbar relative" id="rosterTableContainer">
         <table class="w-full text-left border-collapse min-w-[900px]">
             <thead id="rosterTableHead" class="sticky top-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] uppercase font-black tracking-wider z-10 shadow-sm border-b border-gray-200 dark:border-gray-700">
             </thead>
             <tbody id="rosterTableBody" class="text-sm divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                 <!-- Rows will populate here -->
             </tbody>
         </table>
         
         <div id="rosterLoading" class="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex flex-col justify-center items-center z-20">
             <div class="loader !w-8 !h-8 border-primary mb-2"></div>
             <span class="text-primary dark:text-blue-400 font-bold text-[10px] tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Fetching Directory...</span>
         </div>
     </div>
 </div>
 `;
 
 document.addEventListener('click', (e) => {
     const selector = document.getElementById('columnSelector');
     if(selector && !selector.classList.contains('hidden-force') && !e.target.closest('#columnSelector') && !e.target.closest('button[onclick="toggleColumnSelector()"]')) {
         selector.classList.add('hidden-force');
     }
 });

 loadParticipantsData();
}

function toggleColumnSelector() {
 document.getElementById('columnSelector').classList.toggle('hidden-force');
}

function toggleRosterColumn(colId, isChecked) {
 if (isChecked) {
     if (!activeColumns.includes(colId)) activeColumns.push(colId);
 } else {
     activeColumns = activeColumns.filter(c => c !== colId);
 }
 renderRosterTable();
}

async function loadParticipantsData() {
 const loader = document.getElementById('rosterLoading');
 if(loader) loader.classList.remove('hidden-force');
 
 try {
     const res = await apiCall('fetchAdminRoster');
     adminRosterData = res.roster || [];
     renderRosterTable();
 } catch(e) {
     showToast("Failed to load roster.", true);
 } finally {
     if(loader) loader.classList.add('hidden-force');
 }
}

function handleRosterSearch() {
 rosterSearchQuery = document.getElementById('rosterSearch').value.toLowerCase().trim();
 renderRosterTable();
}

function sortRoster(col) {
 if (rosterSortCol === col) {
     rosterSortAsc = !rosterSortAsc;
 } else {
     rosterSortCol = col;
     rosterSortAsc = true;
 }
 renderRosterTable();
}

function renderRosterTable() {
 let data = [...adminRosterData];
 
 if (rosterSearchQuery) {
     data = data.filter(p => {
         return Object.values(p).some(val => 
             val && val.toString().toLowerCase().includes(rosterSearchQuery)
         );
     });
 }
 
 data.sort((a, b) => {
     let valA = a[rosterSortCol] || '';
     let valB = b[rosterSortCol] || '';
     
     if (rosterSortCol === 'passportExpiry' || rosterSortCol === 'dob') {
         valA = new Date(valA).getTime() || 0;
         valB = new Date(valB).getTime() || 0;
     } else {
         valA = valA.toString().toLowerCase();
         valB = valB.toString().toLowerCase();
     }
     
     if (valA < valB) return rosterSortAsc ? -1 : 1;
     if (valA > valB) return rosterSortAsc ? 1 : -1;
     return 0;
 });

 const thead = document.getElementById('rosterTableHead');
 let headHtml = `<tr><th class="p-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition" onclick="sortRoster('fullName')">Full Name <span class="text-gray-400 ml-1">↕</span></th>`;
 
 availableColumns.forEach(c => {
     if (activeColumns.includes(c.id)) {
         headHtml += `<th class="p-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition" onclick="sortRoster('${c.id}')">${c.label} <span class="text-gray-400 ml-1">↕</span></th>`;
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
             formattedExpiry = `${expD.getFullYear()}-${String(expD.getMonth()+1).padStart(2,'0')}-${String(expD.getDate()).padStart(2,'0')}`;
             if (minExpiry && expD < minExpiry) {
                 expiryHighlight = true;
             }
         }
     }

     let formattedDob = p.dob;
     if (p.dob) {
         const dD = new Date(p.dob);
         if (!isNaN(dD.getTime())) {
             formattedDob = `${dD.getFullYear()}-${String(dD.getMonth()+1).padStart(2,'0')}-${String(dD.getDate()).padStart(2,'0')}`;
         }
     }

     const nameClass = expiryHighlight ? 'text-red-600 dark:text-red-400 font-extrabold' : 'font-bold text-gray-900 dark:text-gray-100';
     const expClass = expiryHighlight 
         ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded font-black border border-red-200 dark:border-red-800 shadow-sm whitespace-nowrap text-[11px] uppercase tracking-wider' 
         : 'text-gray-800 dark:text-gray-200 whitespace-nowrap text-xs font-medium';
     
     const roleStr = p.role.substring(0, 3).toUpperCase();
     const roleColor = p.role === 'TRAINEE' ? 'text-blue-600 dark:text-blue-400' : (p.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400');
     
     html += `<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
         <td class="p-3">
             <div class="${nameClass} text-xs md:text-sm leading-tight">${p.fullName}</div>
             <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">${p.shortName || ''}</div>
         </td>`;
         
     availableColumns.forEach(c => {
         if (activeColumns.includes(c.id)) {
             if (c.id === 'role') {
                 html += `<td class="p-3"><span class="text-[9px] font-black ${roleColor} bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 uppercase tracking-wider">${roleStr}</span></td>`;
             } else if (c.id === 'group') {
                 html += `<td class="p-3"><span class="px-2 py-0.5 rounded border shadow-sm text-[10px] font-bold ${getProjectColor(p.group)} whitespace-nowrap">${p.group || 'None'}</span></td>`;
             } else if (c.id === 'nric') {
                 html += `<td class="p-3 text-xs font-mono font-bold text-gray-700 dark:text-gray-300">${p.nric}</td>`;
             } else if (c.id === 'passportNo') {
                 html += `<td class="p-3 text-xs font-mono uppercase text-gray-700 dark:text-gray-300">${p.passportNo || '-'}</td>`;
             } else if (c.id === 'passportExpiry') {
                 html += `<td class="p-3"><span class="${expClass}">${formattedExpiry || '-'}</span></td>`;
             } else if (c.id === 'dob') {
                 html += `<td class="p-3 text-xs font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">${formattedDob || '-'}</td>`;
             } else {
                 html += `<td class="p-3 text-xs font-medium text-gray-800 dark:text-gray-200 max-w-[200px] truncate" title="${p[c.id] || '-'}">${p[c.id] || '-'}</td>`;
             }
         }
     });
     
     html += `</tr>`;
 });
 
 tbody.innerHTML = html || `<tr><td colspan="${activeColumns.length + 1}" class="p-6 text-center text-[11px] uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold">No participants found matching the criteria.</td></tr>`;
}