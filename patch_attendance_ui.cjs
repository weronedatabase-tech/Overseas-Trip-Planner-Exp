const fs = require('fs');
const path = './frontend/js/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const targetOld = `<div class="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700 p-2 md:p-3 shrink-0 flex flex-col gap-2 shadow-md rounded-t-xl md:rounded-none">
  <div class="flex justify-between items-center">
     <h3 class="text-sm md:text-base font-black text-gray-900 dark:text-white tracking-tight">Live Attendance</h3>
     <button id="btn-sync-attendance" onclick="manualSyncAttendance()" class="text-xs md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-md bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
        <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
     </button>
  </div>
  
  <div class="grid grid-cols-2 gap-2">
     <div class="flex gap-1">
         <select id="attJunctureSelect" onchange="changeAttendanceContext()" class="w-full p-1.5 border-2 border-gray-300 dark:border-gray-700 rounded-md font-bold text-xs bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-md appearance-none truncate"></select>
         <button onclick="promptNewJuncture()" class="p-1.5 bg-green-50 text-green-600 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 rounded-md shadow-md hover:bg-green-100 transition focus:outline-none shrink-0" title="Add Juncture">
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
         </button>
     </div>
     <select id="attAssignmentSelect" onchange="renderAttendanceLists()" class="w-full p-1.5 border-2 border-gray-300 dark:border-gray-700 rounded-md font-bold text-xs bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-md appearance-none truncate">
        <option value="ALL">All Participants</option>
     </select>
  </div>
  
  <div class="relative">
     <input type="text" id="attSearchInput" oninput="handleAttendanceSearch()" placeholder="Search to mark present..." class="w-full p-1.5 pl-8 pr-8 border-2 border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 font-bold text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 dark:text-white shadow-md transition">
     <svg class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
     <button onclick="clearSearch('attSearchInput', 'handleAttendanceSearch')" class="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
     
  </div>
  
  <div class="flex items-center justify-between mt-1.5 px-0.5">
      <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Search Mode</span>
      <div class="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded border border-gray-300 dark:border-gray-600">
         <button id="btn-mode-single" onclick="setAttSearchMode('single')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider">Individual</button>
         <button id="btn-mode-multi" onclick="setAttSearchMode('multi')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider">Family</button>
      </div>
  </div>
</div>`;

const targetNew = `<div class="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700 p-1.5 md:p-2 shrink-0 flex flex-col gap-1.5 shadow-md rounded-t-xl md:rounded-none">
  <div class="flex justify-between items-center gap-1">
     <h3 class="text-xs md:text-sm font-black text-gray-900 dark:text-white tracking-tight hidden md:block">Live Attendance</h3>
     
     <div class="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded border border-gray-300 dark:border-gray-600 shrink-0 mx-auto md:mx-0">
         <button id="btn-mode-single" onclick="setAttSearchMode('single')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider">Indiv</button>
         <button id="btn-mode-multi" onclick="setAttSearchMode('multi')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider">Family</button>
     </div>

     <button id="btn-sync-attendance" onclick="manualSyncAttendance()" class="text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-md bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
        <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
     </button>
  </div>
  
  <div class="grid grid-cols-2 md:grid-cols-4 gap-1.5">
     <div class="flex gap-1">
         <select id="attJunctureSelect" onchange="changeAttendanceContext()" class="w-full p-1 border-2 border-gray-300 dark:border-gray-700 rounded-md font-bold text-[11px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm appearance-none truncate"></select>
         <button onclick="promptNewJuncture()" class="p-1 bg-green-50 text-green-600 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 rounded-md shadow-sm hover:bg-green-100 transition focus:outline-none shrink-0" title="Add Juncture">
             <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
         </button>
     </div>
     <select id="attAssignmentSelect" onchange="renderAttendanceLists()" class="w-full p-1 border-2 border-gray-300 dark:border-gray-700 rounded-md font-bold text-[11px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm appearance-none truncate">
        <option value="ALL">All Participants</option>
     </select>
     
     <div class="relative col-span-2">
         <input type="text" id="attSearchInput" oninput="handleAttendanceSearch()" placeholder="Search to mark present..." class="w-full p-1 pl-7 pr-7 border-2 border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 font-bold text-[11px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 dark:text-white shadow-sm transition">
         <svg class="w-3 h-3 absolute left-2.5 top-[7px] text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
         <button onclick="clearSearch('attSearchInput', 'handleAttendanceSearch')" class="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
     </div>
  </div>
</div>`;

if(content.includes(targetOld)) {
    content = content.replace(targetOld, targetNew);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Patched successfully");
} else {
    console.log("Could not find targetOld");
}
