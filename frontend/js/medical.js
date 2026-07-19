let medicalRosterData = [];
let medicalSearchQuery = '';

function buildMedicalUI() {
 document.getElementById('tab-medical').innerHTML = `
 <div class="flex flex-col h-full w-full relative bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
     <div class="p-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center gap-2 shrink-0">
         <h3 class="font-black text-gray-900 dark:text-white text-base md:text-lg flex items-center gap-2">
             <svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zM12 9v6m-3-3h6" /></svg>
             Medication & Dietary Requirements
         </h3>
         <button onclick="loadMedicalData()" class="p-1.5 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition focus:outline-none shadow-sm" title="Refresh">
             <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
         </button>
     </div>
     
     <div class="p-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shrink-0 flex items-center gap-2">
         <div class="relative w-full">
             <input type="text" id="medicalSearch" oninput="handleMedicalSearch()" placeholder="Search by name, diet, or medical notes..." class="w-full p-2 pl-9 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition">
             <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
         </div>
     </div>
     
     <div class="flex-1 overflow-auto custom-scrollbar relative" id="medicalTableContainer">
         <table class="w-full text-left border-collapse min-w-[900px]">
             <thead class="sticky top-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] uppercase font-black tracking-wider z-10 shadow-sm border-b border-gray-200 dark:border-gray-700">
                 <tr>
                     <th class="p-3 w-[20%]">Participant</th>
                     <th class="p-3 w-[25%]">Dietary Restrictions</th>
                     <th class="p-3 w-[30%]">Medical / Other Notes</th>
                     <th class="p-3 w-[25%]">Emergency Contact</th>
                 </tr>
             </thead>
             <tbody id="medicalTableBody" class="text-sm divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                 <!-- Rows will populate here -->
             </tbody>
         </table>
         
         <div id="medicalLoading" class="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex flex-col justify-center items-center z-20">
             <div class="loader !w-8 !h-8 border-primary mb-2"></div>
             <span class="text-primary dark:text-blue-400 font-bold text-[10px] tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading Data...</span>
         </div>
     </div>
 </div>
 `;
 loadMedicalData();
}

async function loadMedicalData() {
 const loader = document.getElementById('medicalLoading');
 if(loader) loader.classList.remove('hidden-force');
 
 try {
     const res = await apiCall('fetchAdminRoster');
     medicalRosterData = res.roster || [];
     renderMedicalTable();
 } catch(e) {
     showToast("Failed to load medical data.", true);
 } finally {
     if(loader) loader.classList.add('hidden-force');
 }
}

function handleMedicalSearch() {
 medicalSearchQuery = document.getElementById('medicalSearch').value.toLowerCase().trim();
 renderMedicalTable();
}

function renderMedicalTable() {
 let data = [...medicalRosterData];
 
 if (medicalSearchQuery) {
     data = data.filter(p => {
         return (p.fullName && p.fullName.toLowerCase().includes(medicalSearchQuery)) ||
                (p.shortName && p.shortName.toLowerCase().includes(medicalSearchQuery)) ||
                (p.diet && p.diet.toLowerCase().includes(medicalSearchQuery)) ||
                (p.otherPoints && p.otherPoints.toLowerCase().includes(medicalSearchQuery));
     });
 }
 
 data.sort((a, b) => {
     let valA = (a.fullName || '').toString().toLowerCase();
     let valB = (b.fullName || '').toString().toLowerCase();
     if (valA < valB) return -1;
     if (valA > valB) return 1;
     return 0;
 });

 const tbody = document.getElementById('medicalTableBody');
 let html = '';

 data.forEach(p => {
     const roleStr = p.role.substring(0, 3).toUpperCase();
     const roleColor = p.role === 'TRAINEE' ? 'text-blue-600 dark:text-blue-400' : (p.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400');
     
     const hasDiet = p.diet && p.diet.trim() && p.diet.trim().toLowerCase() !== 'nil' && p.diet.trim().toLowerCase() !== 'none';
     const hasNotes = p.otherPoints && p.otherPoints.trim() && p.otherPoints.trim().toLowerCase() !== 'nil' && p.otherPoints.trim().toLowerCase() !== 'none';
     
     const dietHtml = hasDiet ? `<span class="text-red-700 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded inline-block whitespace-pre-wrap">${p.diet}</span>` : `<span class="text-gray-400 dark:text-gray-600 italic">None</span>`;
     const notesHtml = hasNotes ? `<span class="text-orange-700 dark:text-orange-400 font-medium whitespace-pre-wrap">${p.otherPoints}</span>` : `<span class="text-gray-400 dark:text-gray-600 italic">None</span>`;

     html += `
     <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
         <td class="p-3 align-top">
             <div class="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight">${p.fullName}</div>
             <div class="flex items-center gap-1 mt-1 flex-wrap">
                 <span class="text-[9px] font-black ${roleColor} bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 uppercase tracking-wider">${roleStr}</span>
                 <span class="px-1.5 py-0.5 rounded border shadow-sm text-[9px] font-bold ${getProjectColor(p.group)} whitespace-nowrap">${p.group || 'None'}</span>
             </div>
         </td>
         <td class="p-3 align-top text-xs leading-relaxed">
             ${dietHtml}
         </td>
         <td class="p-3 align-top text-xs leading-relaxed border-l border-gray-100 dark:border-gray-800/50">
             ${notesHtml}
         </td>
         <td class="p-3 align-top text-xs border-l border-gray-100 dark:border-gray-800/50">
             <div class="font-bold text-gray-800 dark:text-gray-200">${p.emergencyName || '-'}</div>
             <div class="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">${p.emergencyRelation || '-'}</div>
             <div class="font-mono text-blue-600 dark:text-blue-400 font-bold">${p.emergencyContact || '-'}</div>
         </td>
     </tr>
     `;
 });
 
 tbody.innerHTML = html || '<tr><td colspan="4" class="p-6 text-center text-[11px] uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold">No records found matching the criteria.</td></tr>';
}