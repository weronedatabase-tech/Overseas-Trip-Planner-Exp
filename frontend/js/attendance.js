let attendanceState = {};
let attSearchMode = "single";
let pendingAttendanceUpdates = new Set();
let attSyncTimeout = null;
let isAttendanceSyncing = false;
let attendancePollInterval = null;

let savedAttJuncture = null;
let savedAttAssignment = "ALL";

// Adhoc Bus Tracker State
let adhocBusState = {
  juncture: "",
  assignment: "ALL",
  busFilter: "ALL",
  data: {}, // { [nric]: { bus: "Bus 1", ts: 123456 } }
  busOptions: ["Bus 1"],
  busOptionsTs: {}, // { ["Bus 1"]: 123456 }
};
let pendingAdhocBusUpdates = new Map(); // key -> { nric, status, ts }
let adhocBusSyncTimeout = null;
let isAdhocBusSyncing = false;

function getRegularJunctures() {
  return (appSettings.junctures || []).filter(
    (j) => !String(j).startsWith("__BUS__"),
  );
}

function getBusJunctures() {
  return (appSettings.junctures || [])
    .filter((j) => String(j).startsWith("__BUS__"))
    .map((j) => String(j).replace("__BUS__", ""));
}

function normalizeBusLabel(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = s.match(/^bus\s*(.+)$/i);
  if (m) return `Bus ${m[1].trim()}`;
  return s;
}

function buildAttendanceUI() {
  const el_tab_attendance = document.getElementById("tab-attendance");
  if (el_tab_attendance)
    el_tab_attendance.innerHTML = `
<div class="admin-only flex flex-col h-full min-h-0 w-full relative">

<div class="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700 p-1.5 md:p-2 shrink-0 flex flex-col gap-1.5 shadow-md rounded-t-xl md:rounded-none">
  <div class="flex justify-between items-center gap-1.5 w-full flex-wrap">
     <div class="flex items-center gap-2 shrink-0">
       <h3 class="text-xs md:text-sm font-black text-gray-900 dark:text-white tracking-tight shrink-0">Live Attendance</h3>
       <button id="liveBusBtn" onclick="openBusTrackerModal()" class="text-[10px] md:text-xs font-extrabold text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-700 px-2 py-0.5 rounded-md shadow-sm flex items-center hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition cursor-pointer shrink-0" title="Adhoc Bus Attendance Tracker">
         <i class="fa-solid fa-bus mr-1"></i> ADHOC BUS
       </button>
     </div>
     
     <div class="flex items-center gap-1.5 ml-auto shrink-0">
       <div class="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded border border-gray-300 dark:border-gray-600 shrink-0">
           <button id="btn-mode-single" onclick="setAttSearchMode('single')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider">Indiv</button>
           <button id="btn-mode-multi" onclick="setAttSearchMode('multi')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider">Family</button>
       </div>

       <button id="btn-sync-attendance" onclick="manualSyncAttendance()" class="text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-md bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
          <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
       </button>
     </div>
  </div>
  
  <div class="grid grid-cols-2 md:grid-cols-4 gap-1.5">
     <div class="flex gap-1">
         <select id="attJunctureSelect" onchange="changeAttendanceContext()" class="w-full p-1 border-2 border-gray-300 dark:border-gray-700 rounded-md font-bold text-[11px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm appearance-none truncate"></select>
         <button onclick="promptNewJuncture()" class="p-1 bg-green-50 text-green-600 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 rounded-md shadow-sm hover:bg-green-100 transition focus:outline-none shrink-0" title="Add Juncture">
             <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
         </button>
         <button onclick="promptDeleteJuncture()" class="p-1 bg-red-50 text-red-600 border-2 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 rounded-md shadow-sm hover:bg-red-100 transition focus:outline-none shrink-0" title="Delete Juncture">
             <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
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
</div>

<div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative bg-gray-50 dark:bg-gray-950 rounded-b-xl md:rounded-none border-x border-b-2 border-gray-200 dark:border-gray-700">
  
  <div id="attLoadingOverlay" class="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-10 hidden-force flex flex-col justify-center items-center">
      <div class="loader !w-8 !h-8 border-primary mb-2"></div>
      <span class="text-primary dark:text-green-400 font-bold text-xs tracking-wide shadow-md bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading...</span>
  </div>
  
  <div class="flex-1 min-w-0 flex flex-col border-r-2 border-gray-200 dark:border-gray-700 bg-red-50/30 dark:bg-red-900/10">
     <div class="bg-red-100 dark:bg-red-900/50 border-b-2 border-red-200 dark:border-red-800 py-1 px-2 shrink-0 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
       <h4 class="font-black text-[11px] md:text-xs uppercase tracking-widest text-red-800 dark:text-red-300 truncate">Not Checked (<span id="attNotCheckedCount">0</span>)</h4>
       <div class="flex items-center gap-1 shrink-0">
         <button onclick="copyAttColumnData('notChecked')" class="p-1 text-red-700 hover:bg-red-200/70 dark:text-red-300 dark:hover:bg-red-800/60 rounded transition focus:outline-none" title="Copy List">
           <i class="fa-regular fa-copy text-[11px]"></i>
         </button>
         <button onclick="shareAttColumnData('notChecked')" class="p-1 text-red-700 hover:bg-red-200/70 dark:text-red-300 dark:hover:bg-red-800/60 rounded transition focus:outline-none" title="Share List">
           <i class="fa-solid fa-share-nodes text-[11px]"></i>
         </button>
       </div>
     </div>
     <div id="attNotCheckedList" class="flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6 space-y-1.5"></div>
  </div>
  
  <div class="flex-1 min-w-0 flex flex-col bg-green-50/30 dark:bg-green-900/10">
     <div class="bg-green-100 dark:bg-green-900/50 border-b-2 border-green-200 dark:border-green-800 py-1 px-2 shrink-0 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
       <h4 class="font-black text-[11px] md:text-xs uppercase tracking-widest text-green-800 dark:text-green-300 truncate">Checked (<span id="attCheckedCount">0</span>)</h4>
       <div class="flex items-center gap-1 shrink-0">
         <button onclick="copyAttColumnData('checked')" class="p-1 text-green-700 hover:bg-green-200/70 dark:text-green-300 dark:hover:bg-green-800/60 rounded transition focus:outline-none" title="Copy List">
           <i class="fa-regular fa-copy text-[11px]"></i>
         </button>
         <button onclick="shareAttColumnData('checked')" class="p-1 text-green-700 hover:bg-green-200/70 dark:text-green-300 dark:hover:bg-green-800/60 rounded transition focus:outline-none" title="Share List">
           <i class="fa-solid fa-share-nodes text-[11px]"></i>
         </button>
       </div>
     </div>
     <div id="attCheckedList" class="flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6 space-y-1.5"></div>
  </div>
  
</div>

<!-- ADHOC BUS TRACKER MODAL -->
<div id="busTrackerModal" class="fixed inset-0 bg-black/75 z-[110] hidden-force flex justify-center items-center p-0 md:p-4 backdrop-blur-sm">
  <div class="bg-white dark:bg-gray-900 w-full h-full md:max-w-5xl md:h-[90vh] md:rounded-2xl shadow-2xl border-0 md:border-2 border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden relative">
    <!-- Modal Header -->
    <div class="bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700 p-2 md:p-3 shrink-0 flex flex-col gap-1.5 shadow-sm z-20">
      <div class="flex justify-between items-center gap-2 w-full">
        <div class="flex items-center gap-2 min-w-0">
          <h3 class="text-sm md:text-base font-black text-gray-900 dark:text-white tracking-tight flex items-center truncate">
            <i class="fa-solid fa-bus mr-2 text-yellow-500"></i>Bus Tracker
          </h3>
          <span class="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700">Adhoc Bus Attendance</span>
        </div>

        <div class="flex items-center gap-1.5 ml-auto shrink-0">
          <div class="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded border border-gray-300 dark:border-gray-600 shrink-0">
            <button id="btn-bus-mode-single" onclick="setAttSearchMode('single')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider">Indiv</button>
            <button id="btn-bus-mode-multi" onclick="setAttSearchMode('multi')" class="px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider">Family</button>
          </div>

          <button id="btn-sync-bus" onclick="manualSyncBusAttendance()" class="text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-sm bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 focus:outline-none shrink-0">
            <span class="btn-text">Saved</span><div class="btn-spinner ml-1 !w-3 !h-3 hidden-force"></div>
          </button>

          <button onclick="closeBusTrackerModal()" class="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition focus:outline-none" title="Close Bus Tracker">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>

      <div id="busGlobalStatus" class="hidden-force text-[11px] font-bold px-2.5 py-1 rounded border text-center transition-all"></div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-1.5">
        <div class="flex gap-1">
          <select id="busJunctureSelect" onchange="changeBusContext()" class="w-full p-1 border-2 border-gray-300 dark:border-gray-700 rounded-md font-bold text-[11px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 shadow-sm appearance-none truncate"></select>
          <button onclick="promptNewBusJuncture()" class="p-1 bg-green-50 text-green-600 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 rounded-md shadow-sm hover:bg-green-100 transition focus:outline-none shrink-0" title="Add Bus Juncture">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
          </button>
          <button onclick="promptDeleteBusJuncture()" class="p-1 bg-red-50 text-red-600 border-2 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 rounded-md shadow-sm hover:bg-red-100 transition focus:outline-none shrink-0" title="Delete Bus Juncture">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>

        <select id="busAssignmentSelect" onchange="renderBusLists()" class="w-full p-1 border-2 border-gray-300 dark:border-gray-700 rounded-md font-bold text-[11px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 shadow-sm appearance-none truncate">
          <option value="ALL">All Participants</option>
        </select>

        <div class="relative col-span-2">
          <input type="text" id="busSearchInput" oninput="handleBusSearch()" placeholder="Search participant to board..." class="w-full p-1 pl-7 pr-7 border-2 border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 font-bold text-[11px] focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 text-gray-900 dark:text-white shadow-sm transition">
          <svg class="w-3 h-3 absolute left-2.5 top-[7px] text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <button onclick="clearSearch('busSearchInput', 'handleBusSearch')" class="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
      </div>
    </div>

    <!-- Modal Body: Two Columns -->
    <div class="flex flex-row flex-1 min-h-0 w-full overflow-hidden relative bg-gray-50 dark:bg-gray-950">
      <div id="busLoadingOverlay" class="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-30 hidden-force flex flex-col justify-center items-center">
        <div class="loader !w-8 !h-8 border-yellow-500 mb-2"></div>
        <span class="text-yellow-600 dark:text-yellow-400 font-bold text-xs tracking-wide shadow-md bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading Bus Data...</span>
      </div>

      <!-- Left Column: Not Boarded -->
      <div class="flex-1 min-w-0 flex flex-col border-r-2 border-gray-200 dark:border-gray-700 bg-red-50/30 dark:bg-red-900/10">
        <div class="bg-red-100 dark:bg-red-900/50 border-b-2 border-red-200 dark:border-red-800 py-1.5 px-2 shrink-0 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <h4 class="font-black text-[11px] md:text-xs uppercase tracking-widest text-red-800 dark:text-red-300 truncate">
            Not Boarded (<span id="busNotBoardedCount">0</span>)
          </h4>
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="copyBusColumnData('notBoarded')" class="p-1 text-red-700 hover:bg-red-200/70 dark:text-red-300 dark:hover:bg-red-800/60 rounded transition focus:outline-none" title="Copy Not Boarded List">
              <i class="fa-regular fa-copy text-xs"></i>
            </button>
            <button onclick="shareBusColumnData('notBoarded')" class="p-1 text-red-700 hover:bg-red-200/70 dark:text-red-300 dark:hover:bg-red-800/60 rounded transition focus:outline-none" title="Share Not Boarded List">
              <i class="fa-solid fa-share-nodes text-xs"></i>
            </button>
          </div>
        </div>
        <div id="busNotBoardedList" class="flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6 space-y-1.5"></div>
      </div>

      <!-- Right Column: Boarded -->
      <div class="flex-1 min-w-0 flex flex-col bg-green-50/30 dark:bg-green-900/10">
        <div class="bg-green-100 dark:bg-green-900/50 border-b-2 border-green-200 dark:border-green-800 py-1 px-2 shrink-0 flex flex-col gap-1 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div class="flex items-center justify-between w-full">
            <h4 class="font-black text-[11px] md:text-xs uppercase tracking-widest text-green-800 dark:text-green-300 truncate">
              Boarded (<span id="busBoardedCount">0</span>)
            </h4>
            <div class="flex items-center gap-1 shrink-0">
              <button onclick="copyBusColumnData('boarded')" class="p-1 text-green-700 hover:bg-green-200/70 dark:text-green-300 dark:hover:bg-green-800/60 rounded transition focus:outline-none" title="Copy Boarded List">
                <i class="fa-regular fa-copy text-xs"></i>
              </button>
              <button onclick="shareBusColumnData('boarded')" class="p-1 text-green-700 hover:bg-green-200/70 dark:text-green-300 dark:hover:bg-green-800/60 rounded transition focus:outline-none" title="Share Boarded List">
                <i class="fa-solid fa-share-nodes text-xs"></i>
              </button>
            </div>
          </div>
          <div class="flex items-center gap-1 w-full">
            <select id="busFilterSelect" onchange="adhocBusState.busFilter = this.value; renderBusLists();" class="flex-1 min-w-0 py-0.5 px-1.5 text-[11px] font-extrabold rounded border border-green-300 dark:border-green-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500">
              <option value="ALL">All Buses</option>
              <option value="Bus 1">Bus 1</option>
            </select>
            <button onclick="addBusOption()" class="px-1.5 py-0.5 bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 rounded hover:bg-green-50 dark:hover:bg-gray-700 text-[10px] font-black shadow-2xs shrink-0" title="Add Next Bus">
              <i class="fa-solid fa-plus"></i>
            </button>
            <button onclick="renameBusOption()" class="px-1.5 py-0.5 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-50 dark:hover:bg-gray-700 text-[10px] font-black shadow-2xs shrink-0" title="Rename Selected Bus">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button onclick="removeBusOption()" class="px-1.5 py-0.5 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-gray-700 text-[10px] font-black shadow-2xs shrink-0" title="Remove Selected Bus">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div id="busBoardedList" class="flex-grow overflow-y-auto p-1.5 custom-scrollbar pb-6 space-y-1.5"></div>
      </div>
    </div>
  </div>
</div>

</div>`;
}

async function promptNewJuncture() {
  const name = await appPrompt(
    "Enter new juncture name (e.g. Day 2: Morning):",
    "",
    "New Juncture",
    "Juncture Name",
  );
  if (!name || !name.trim()) return;

  const overlay = document.getElementById("attLoadingOverlay");
  if (overlay) overlay.classList.remove("hidden-force");
  setAttSyncButtonState("loading");

  try {
    const res = await apiCall("modifyJunctures", {
      actionType: "add",
      newName: name.trim(),
    });
    appSettings.junctures = res.junctures;

    const regJunctures = getRegularJunctures();
    const juncSel = document.getElementById("attJunctureSelect");
    if (juncSel) {
      juncSel.innerHTML = "";
      regJunctures.forEach(
        (j) => (juncSel.innerHTML += `<option value="${j}">${j}</option>`),
      );
      juncSel.value = name.trim();
    }
    savedAttJuncture = name.trim();

    showToast("Juncture added.");
    await changeAttendanceContext();
  } catch (e) {
    showToast(e.message, true);
    setAttSyncButtonState("error");
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
}

async function promptDeleteJuncture() {
  const juncSel = document.getElementById("attJunctureSelect");
  if (!juncSel || !juncSel.value) {
    showToast("No juncture selected.", true);
    return;
  }
  const jName = juncSel.value;
  if (
    !(await appConfirm(
      `Are you sure you want to delete juncture "${jName}"?`,
      "Delete Juncture",
      "Delete",
      "Cancel",
      true,
    ))
  )
    return;

  const overlay = document.getElementById("attLoadingOverlay");
  if (overlay) overlay.classList.remove("hidden-force");
  setAttSyncButtonState("loading");

  try {
    const res = await apiCall("modifyJunctures", {
      actionType: "remove",
      oldName: jName,
    });
    appSettings.junctures = res.junctures;
    const regJunctures = getRegularJunctures();
    juncSel.innerHTML = "";
    if (regJunctures.length > 0) {
      regJunctures.forEach(
        (j) => (juncSel.innerHTML += `<option value="${j}">${j}</option>`),
      );
      juncSel.value = regJunctures[0];
      savedAttJuncture = regJunctures[0];
    } else {
      juncSel.innerHTML = `<option value="">No Junctures Defined</option>`;
      savedAttJuncture = "";
    }
    showToast("Juncture deleted.");
    await changeAttendanceContext();
  } catch (e) {
    showToast(e.message, true);
    setAttSyncButtonState("error");
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
}

async function renderAttendanceChecklist() {
  if (!document.getElementById("attJunctureSelect")) return;

  const juncSel = document.getElementById("attJunctureSelect");
  if (juncSel) juncSel.innerHTML = "";
  const regJunctures = getRegularJunctures();
  if (regJunctures.length > 0) {
    regJunctures.forEach(
      (j) => (juncSel.innerHTML += `<option value="${j}">${j}</option>`),
    );
  } else {
    if (juncSel)
      juncSel.innerHTML = `<option value="">No Junctures Defined</option>`;
  }

  if (savedAttJuncture && regJunctures.includes(savedAttJuncture)) {
    juncSel.value = savedAttJuncture;
  }

  // Pre-fetch global logistics if null
  if (!globalLogistics) {
    try {
      const res = await apiCall("fetchLogistics");
      globalLogistics = res;
      if (typeof processDisplayNames === "function")
        processDisplayNames(globalLogistics.participants);
      if (typeof applyGlobalSorting === "function")
        globalLogistics.participants = applyGlobalSorting(
          globalLogistics.participants,
        );
    } catch (e) {}
  }

  const asgnSel = document.getElementById("attAssignmentSelect");
  if (asgnSel)
    asgnSel.innerHTML = `<option value="ALL">All Participants</option>`;

  // Populate Projects
  if (appSettings.activeProjects && appSettings.activeProjects.length > 0) {
    const projGroup = document.createElement("optgroup");
    projGroup.label = "Projects";
    appSettings.activeProjects.forEach((g) => {
      projGroup.innerHTML += `<option value="PROJ::${g}">${g}</option>`;
    });
    if (asgnSel) asgnSel.appendChild(projGroup);
  }

  // Populate Logistics Groups and Buses
  if (globalLogistics && globalLogistics.participants) {
    const groups = new Set();
    const buses = new Set();
    globalLogistics.participants.forEach((p) => {
      if (p.logisticsGroup && p.logisticsGroup.trim())
        groups.add(p.logisticsGroup.trim());
      if (p.bus && p.bus.trim()) buses.add(p.bus.trim());
    });

    if (groups.size > 0) {
      const grpGroup = document.createElement("optgroup");
      grpGroup.label = "Groups";
      Array.from(groups)
        .sort()
        .forEach((g) => {
          grpGroup.innerHTML += `<option value="GRP::${g}">${g}</option>`;
        });
      if (asgnSel) asgnSel.appendChild(grpGroup);
    }

    if (buses.size > 0) {
      const busGroup = document.createElement("optgroup");
      busGroup.label = "Pre-Assigned Buses";
      Array.from(buses)
        .sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
        )
        .forEach((b) => {
          const trimmed = b.trim();
          const busLabel = /^bus\s*/i.test(trimmed)
            ? trimmed
            : `Bus ${trimmed}`;
          busGroup.innerHTML += `<option value="BUS::${b}">${busLabel}</option>`;
        });
      if (asgnSel) asgnSel.appendChild(busGroup);
    }
  }

  if (savedAttAssignment) {
    let finalValue = savedAttAssignment;
    if (savedAttAssignment !== "ALL" && !savedAttAssignment.includes("::")) {
      finalValue = "PROJ::" + savedAttAssignment;
    }

    if (asgnSel && asgnSel.querySelector(`option[value="${finalValue}"]`)) {
      asgnSel.value = finalValue;
    }
  }

  await changeAttendanceContext();
}

async function changeAttendanceContext() {
  const juncEl = document.getElementById("attJunctureSelect");
  const juncture = juncEl ? juncEl.value : "";
  savedAttJuncture = juncture;

  if (!juncture) {
    attendanceState = {};
    renderAttendanceLists();
    return;
  }

  const overlay = document.getElementById("attLoadingOverlay");
  if (overlay) overlay.classList.remove("hidden-force");
  setAttSyncButtonState("loading");

  try {
    const res = await apiCall("fetchAttendanceData", { juncture });
    attendanceState = res.data || {};
    renderAttendanceLists();
    setAttSyncButtonState("saved");
    startAttendancePolling();
  } catch (e) {
    showToast("Failed to load attendance", true);
    setAttSyncButtonState("error");
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
}

function getFilteredRegularParticipants() {
  if (!globalLogistics || !globalLogistics.participants) return [];
  const assignment = savedAttAssignment || "ALL";
  const searchInput = document.getElementById("attSearchInput");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  const filtered = globalLogistics.participants.filter((p) => {
    let matchAssignment = false;
    if (assignment === "ALL") matchAssignment = true;
    else if (assignment.startsWith("PROJ::"))
      matchAssignment = p.group === assignment.split("::")[1];
    else if (assignment.startsWith("GRP::"))
      matchAssignment = p.logisticsGroup === assignment.split("::")[1];
    else if (assignment.startsWith("BUS::"))
      matchAssignment = p.bus === assignment.split("::")[1];
    else matchAssignment = p.group === assignment;

    if (!matchAssignment) return false;

    if (query) {
      const dName = p.displayName || p.name || "";
      const fullName = p.name || "";
      let tName = "";
      if (p.role === "CAREGIVER") {
        const myPoc = p.pocNric || p.nric;
        const trainee = globalLogistics.participants.find(
          (x) => x.role === "TRAINEE" && (x.pocNric || x.nric) === myPoc,
        );
        if (trainee) {
          tName = trainee.shortName || trainee.name || "";
        } else if (p.relatedTrainee) {
          tName = p.relatedTrainee;
        }
      }
      if (
        !dName.toLowerCase().includes(query) &&
        !fullName.toLowerCase().includes(query) &&
        !tName.toLowerCase().includes(query)
      )
        return false;
    }
    return true;
  });

  if (query && window.sortBySearchRelevance) {
    window.sortBySearchRelevance(filtered, query, (p) => {
      let tName = p.relatedTrainee || "";
      if (p.role === "CAREGIVER" && globalLogistics && globalLogistics.participants) {
        const myPoc = p.pocNric || p.nric;
        const trainee = globalLogistics.participants.find(
          (x) => x.role === "TRAINEE" && (x.pocNric || x.nric) === myPoc,
        );
        if (trainee) tName = trainee.shortName || trainee.name || tName;
      }
      return {
        primary: [p.displayName, p.shortName, p.name],
        secondary: [tName, p.nric, p.group, p.logisticsGroup],
      };
    });
  }

  return filtered;
}

function renderAttendanceLists() {
  const assignmentEl = document.getElementById("attAssignmentSelect");
  if (assignmentEl) {
    savedAttAssignment = assignmentEl.value;
  }

  const notCheckedList = document.getElementById("attNotCheckedList");
  const checkedList = document.getElementById("attCheckedList");

  if (!notCheckedList || !checkedList) return;

  if (!globalLogistics) {
    notCheckedList.innerHTML =
      '<div class="flex justify-center p-6"><div class="loader !w-6 !h-6 border-gray-400"></div></div>';
    checkedList.innerHTML =
      '<div class="flex justify-center p-6"><div class="loader !w-6 !h-6 border-gray-400"></div></div>';
    document.getElementById("attNotCheckedCount").textContent = "0";
    document.getElementById("attCheckedCount").textContent = "0";
    return;
  }

  let notCheckedHtml = "";
  let checkedHtml = "";
  let notCheckedCount = 0;
  let checkedCount = 0;

  const participants = getFilteredRegularParticipants();

  participants.forEach((p) => {
    const stateObj = attendanceState[p.nric];
    const isChecked = stateObj ? stateObj.status : false;
    const cardHtml = generateAttCard(p, isChecked);

    if (isChecked) {
      checkedHtml += cardHtml;
      checkedCount++;
    } else {
      notCheckedHtml += cardHtml;
      notCheckedCount++;
    }
  });

  notCheckedList.innerHTML =
    notCheckedHtml ||
    '<p class="text-xs text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';
  checkedList.innerHTML =
    checkedHtml ||
    '<p class="text-xs text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';

  document.getElementById("attNotCheckedCount").textContent = notCheckedCount;
  document.getElementById("attCheckedCount").textContent = checkedCount;
}

function formatAttExportText(type) {
  const juncture = document.getElementById("attJunctureSelect")?.value || "Attendance";
  const assignmentEl = document.getElementById("attAssignmentSelect");
  const filterText =
    assignmentEl && assignmentEl.selectedIndex >= 0
      ? assignmentEl.options[assignmentEl.selectedIndex].text
      : "All Participants";

  const participants = getFilteredRegularParticipants();
  const list = participants.filter((p) => {
    const isChecked = attendanceState[p.nric]?.status || false;
    return type === "checked" ? isChecked : !isChecked;
  });

  const title = type === "checked" ? "Checked" : "Not Checked";
  let text = `*${juncture} - ${title} (${list.length})*\nFilter: ${filterText}\n\n`;
  if (list.length === 0) {
    text += "None";
  } else {
    list.forEach((p, idx) => {
      const dName = p.displayName || p.shortName || p.name;
      const roleShort = (p.role || "").substring(0, 3).toUpperCase();
      text += `${idx + 1}. ${dName} (${roleShort})\n`;
    });
  }
  return text.trim();
}

window.copyAttColumnData = function (type) {
  const text = formatAttExportText(type);
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("List copied to clipboard!"))
    .catch(() => showToast("Failed to copy list.", true));
};

window.shareAttColumnData = async function (type) {
  const text = formatAttExportText(type);
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch (e) {}
  } else {
    window.copyAttColumnData(type);
  }
};

let attLongPressTimer = null;
let attLongPressFired = false;

window.startAttLongPress = function (nric, event) {
  attLongPressFired = false;
  if (event.type === "mousedown" && event.button !== 0) return;

  attLongPressTimer = setTimeout(() => {
    attLongPressFired = true;
    if (typeof showParticipantSummaryModal === "function") {
      showParticipantSummaryModal(nric);
    }
  }, 600);
};

window.cancelAttLongPress = function (event) {
  if (attLongPressTimer) {
    clearTimeout(attLongPressTimer);
    attLongPressTimer = null;
  }
};

window.handleAttClick = function (nric, isChecked, event) {
  if (attLongPressFired) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  toggleAttendanceStatus(nric, !isChecked);
};

function generateAttCard(p, isChecked) {
  const dynColor = getProjectColor(p.group);
  const roleColor =
    p.role === "TRAINEE"
      ? "text-green-600 dark:text-green-400"
      : p.role === "CAREGIVER"
        ? "text-purple-600 dark:text-purple-400"
        : "text-orange-600 dark:text-orange-400";
  const roleShort = p.role.substring(0, 3).toUpperCase();
  const dName = p.displayName || p.name;

  let relatedTraineeHtml = "";
  if (p.role === "CAREGIVER") {
    let tName = "";
    if (globalLogistics && globalLogistics.participants) {
      const myPoc = p.pocNric || p.nric;
      const trainee = globalLogistics.participants.find(
        (x) => x.role === "TRAINEE" && (x.pocNric || x.nric) === myPoc,
      );
      if (trainee) {
        tName = trainee.shortName || trainee.name;
      } else if (p.relatedTrainee) {
        tName = p.relatedTrainee;
      }
    }
    if (tName) {
      relatedTraineeHtml = `<div class="mt-1 font-bold text-purple-600 dark:text-purple-400 text-xs leading-tight max-w-full break-words whitespace-normal" style="overflow-wrap: break-word;">[${tName.toUpperCase()}]</div>`;
    }
  }

  return `
<div id="att-card-${p.nric}" class="relative bg-white dark:bg-gray-800 p-1.5 md:p-2 rounded border-2 border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-300 flex items-center justify-between gap-1 select-none active:scale-95 cursor-pointer hover:border-primary dark:hover:border-primary" 
  onpointerdown="startAttLongPress('${p.nric}', event)" 
  onpointerup="cancelAttLongPress(event)" 
  onpointerleave="cancelAttLongPress(event)" 
  onpointercancel="cancelAttLongPress(event)"
  oncontextmenu="if(attLongPressFired) { event.preventDefault(); return false; }"
  onclick="handleAttClick('${p.nric}', ${isChecked}, event)">
  <div class="flex items-start min-w-0 flex-1">
      <div class="flex flex-col min-w-0 flex-1 gap-1">
          <span class="font-extrabold text-sm md:text-[12px] px-1.5 py-0.5 rounded shadow-md border ${dynColor} max-w-full break-words whitespace-normal leading-[1.1] text-left inline-block self-start" style="overflow-wrap: break-word;">${dName}</span>
          ${relatedTraineeHtml}
          <span class="text-[10px] font-black ${roleColor} w-max bg-gray-50 dark:bg-gray-700 px-1 py-0.5 rounded uppercase tracking-wider border-2 border-gray-100 dark:border-gray-600 mt-0.5">${roleShort}</span>
      </div>
  </div>
  <div class="shrink-0 flex items-center justify-center pl-1">
     <div class="w-5 h-5 rounded flex items-center justify-center border transition-colors ${isChecked ? "bg-green-500 border-green-600 text-white shadow-inner" : "bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-transparent"}">
         <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
     </div>
  </div>
</div>`;
}

function handleAttendanceSearch() {
  renderAttendanceLists();
}

function toggleAttendanceStatus(nric, forceState) {
  attendanceState[nric] = { status: forceState, ts: Date.now() };
  pendingAttendanceUpdates.add(nric);

  const searchInput = document.getElementById("attSearchInput");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  if (query) {
    if (attSearchMode === "single") {
      searchInput.value = "";
    } else {
      const matchedParticipants = getFilteredRegularParticipants();
      if (matchedParticipants.length > 0) {
        const firstState =
          attendanceState[matchedParticipants[0].nric]?.status || false;
        const allSame = matchedParticipants.every((p) => {
          const state = attendanceState[p.nric]?.status || false;
          return state === firstState;
        });

        if (allSame) {
          searchInput.value = "";
        }
      }
    }
  }

  renderAttendanceLists();

  if (attSyncTimeout) clearTimeout(attSyncTimeout);
  attSyncTimeout = setTimeout(() => {
    executeAttendanceSync();
  }, 800);

  triggerPulseFeedback(nric, forceState);
}

function triggerPulseFeedback(nric, isChecked, cardPrefix = "att-card-") {
  setTimeout(() => {
    const card = document.getElementById(`${cardPrefix}${nric}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      const ringColor = isChecked ? "ring-green-400" : "ring-red-400";
      const bgColor = isChecked ? "bg-green-50" : "bg-red-50";
      const darkBgColor = isChecked
        ? "dark:bg-green-900/50"
        : "dark:bg-red-900/50";

      card.classList.add(
        "ring-2",
        ringColor,
        "scale-[1.02]",
        bgColor,
        darkBgColor,
        "z-10",
      );
      setTimeout(() => {
        card.classList.remove(
          "ring-2",
          ringColor,
          "scale-[1.02]",
          bgColor,
          darkBgColor,
          "z-10",
        );
      }, 800);
    }
  }, 50);
}

async function executeAttendanceSync() {
  if (pendingAttendanceUpdates.size === 0) return;

  const juncture = document.getElementById("attJunctureSelect").value;
  if (!juncture) return;

  isAttendanceSyncing = true;
  setAttSyncButtonState("saving");

  const batch = new Set(pendingAttendanceUpdates);
  pendingAttendanceUpdates.clear();

  const updates = Array.from(batch).map((nric) => ({
    nric: nric,
    status: attendanceState[nric]?.status || false,
    ts: attendanceState[nric]?.ts || Date.now(),
  }));

  try {
    await apiCall("syncAttendanceUpdate", {
      juncture: juncture,
      updates: updates,
      takenBy: currentUser.name,
    });
    setAttSyncButtonState("saved");
  } catch (e) {
    showToast("Sync failed. Retrying...", true);
    setAttSyncButtonState("error");
    batch.forEach((nric) => pendingAttendanceUpdates.add(nric));
  } finally {
    isAttendanceSyncing = false;
  }
}

async function manualSyncAttendance() {
  if (pendingAttendanceUpdates.size > 0) {
    await executeAttendanceSync();
  }
  setAttSyncButtonState("loading");
  try {
    const juncture = document.getElementById("attJunctureSelect").value;
    if (juncture) {
      const res = await apiCall("fetchAttendanceData", { juncture });
      const remoteData = res.data || {};

      globalLogistics.participants.forEach((p) => {
        const rEntry = remoteData[p.nric] || { status: false, ts: 0 };
        const lEntry = attendanceState[p.nric] || { status: false, ts: 0 };
        if (rEntry.ts > lEntry.ts && !pendingAttendanceUpdates.has(p.nric)) {
          attendanceState[p.nric] = { status: rEntry.status, ts: rEntry.ts };
        }
      });
      renderAttendanceLists();
    }
    setAttSyncButtonState("saved");
    showToast("Refreshed from server!");
  } catch (e) {
    setAttSyncButtonState("error");
    showToast("Sync failed.", true);
  }
}

window.pollAttendanceNow = async function () {
  // If Bus Tracker Modal is open, also poll bus attendance
  const busModal = document.getElementById("busTrackerModal");
  if (busModal && !busModal.classList.contains("hidden-force")) {
    await pollBusAttendanceNow();
  }

  const attTab = document.getElementById("tab-attendance");
  if (
    !attTab ||
    attTab.classList.contains("hidden-force") ||
    isAttendanceSyncing ||
    pendingAttendanceUpdates.size > 0
  )
    return;

  const juncEl = document.getElementById("attJunctureSelect");
  const juncture = juncEl ? juncEl.value : "";
  if (!juncture) return;

  const fetchStartTime = Date.now();

  try {
    const res = await apiCall("fetchAttendanceData", { juncture });
    if (lastLocalChange > fetchStartTime) return;

    const remoteData = res.data || {};
    let hasChanges = false;

    if (globalLogistics && globalLogistics.participants) {
      globalLogistics.participants.forEach((p) => {
        const rEntry = remoteData[p.nric] || { status: false, ts: 0 };
        const lEntry = attendanceState[p.nric] || { status: false, ts: 0 };

        if (rEntry.ts > lEntry.ts && !pendingAttendanceUpdates.has(p.nric)) {
          attendanceState[p.nric] = { status: rEntry.status, ts: rEntry.ts };
          hasChanges = true;
        }
      });
    }

    if (hasChanges) {
      renderAttendanceLists();
    }
  } catch (e) {}
};

function startAttendancePolling() {
  if (attendancePollInterval) clearInterval(attendancePollInterval);
  attendancePollInterval = setInterval(window.pollAttendanceNow, 8000);
}

function setAttSyncButtonState(state, btnId = "btn-sync-attendance") {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  const textSpan = btn.querySelector(".btn-text");
  const spinner = btn.querySelector(".btn-spinner");

  btn.className =
    "text-[10px] md:text-xs px-2 py-1 rounded-md font-bold transition flex items-center justify-center border shadow-md focus:outline-none shrink-0";
  spinner.className = "btn-spinner ml-1 !w-3 !h-3 hidden-force";

  if (state === "loading") {
    btn.classList.add(
      "bg-gray-100",
      "text-gray-500",
      "border-gray-200",
      "dark:bg-gray-800",
      "dark:text-gray-400",
      "dark:border-gray-700",
    );
    textSpan.textContent = "Loading...";
    spinner.classList.remove("hidden-force");
    spinner.classList.add("spinner-primary");
  } else if (state === "saving") {
    btn.classList.add(
      "bg-yellow-50",
      "text-yellow-700",
      "border-yellow-200",
      "dark:bg-yellow-900/30",
      "dark:text-yellow-300",
      "dark:border-yellow-800",
    );
    textSpan.textContent = "Saving...";
    spinner.classList.remove("hidden-force");
    spinner.classList.add("spinner-yellow");
  } else if (state === "saved") {
    btn.classList.add(
      "bg-green-50",
      "text-green-700",
      "border-green-200",
      "dark:bg-green-900/30",
      "dark:text-green-300",
      "dark:border-green-800",
    );
    textSpan.textContent = "Saved";
  } else if (state === "error") {
    btn.classList.add(
      "bg-red-50",
      "text-red-700",
      "border-red-200",
      "dark:bg-red-900/30",
      "dark:text-red-300",
      "dark:border-red-800",
    );
    textSpan.textContent = "Error";
  }
}

function setAttSearchMode(mode) {
  attSearchMode = mode;
  const pairs = [
    ["btn-mode-single", "btn-mode-multi"],
    ["btn-bus-mode-single", "btn-bus-mode-multi"],
  ];
  pairs.forEach(([singleId, multiId]) => {
    const btnSingle = document.getElementById(singleId);
    const btnMulti = document.getElementById(multiId);
    if (btnSingle && btnMulti) {
      if (mode === "single") {
        btnSingle.className =
          "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider";
        btnMulti.className =
          "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider";
      } else {
        btnMulti.className =
          "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider";
        btnSingle.className =
          "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider";
      }
    }
  });
}

// ==========================================
// ADHOC BUS ATTENDANCE ("BUS TRACKER") LOGIC
// ==========================================

let busFlashTimeout = null;
function showBusFlashMessage(msg, isError = false) {
  const el = document.getElementById("busGlobalStatus");
  if (!el) {
    showToast(msg, isError);
    return;
  }
  el.textContent = msg;
  el.className = isError
    ? "text-[11px] font-bold px-2.5 py-1 rounded border text-center transition-all bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800"
    : "text-[11px] font-bold px-2.5 py-1 rounded border text-center transition-all bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800";
  el.classList.remove("hidden-force");
  if (busFlashTimeout) clearTimeout(busFlashTimeout);
  busFlashTimeout = setTimeout(() => {
    el.classList.add("hidden-force");
  }, 3000);
}

window.openBusTrackerModal = async function () {
  const modal = document.getElementById("busTrackerModal");
  if (!modal) return;
  modal.classList.remove("hidden-force");

  setAttSearchMode(attSearchMode);

  // Populate assignment filter inside Bus Tracker modal
  const asgnSel = document.getElementById("busAssignmentSelect");
  if (asgnSel) {
    asgnSel.innerHTML = `<option value="ALL">All Participants</option>`;
    if (appSettings.activeProjects && appSettings.activeProjects.length > 0) {
      const projGroup = document.createElement("optgroup");
      projGroup.label = "Projects";
      appSettings.activeProjects.forEach((g) => {
        projGroup.innerHTML += `<option value="PROJ::${g}">${g}</option>`;
      });
      asgnSel.appendChild(projGroup);
    }
    if (globalLogistics && globalLogistics.participants) {
      const groups = new Set();
      globalLogistics.participants.forEach((p) => {
        if (p.logisticsGroup && p.logisticsGroup.trim())
          groups.add(p.logisticsGroup.trim());
      });
      if (groups.size > 0) {
        const grpGroup = document.createElement("optgroup");
        grpGroup.label = "Groups";
        Array.from(groups)
          .sort()
          .forEach((g) => {
            grpGroup.innerHTML += `<option value="GRP::${g}">${g}</option>`;
          });
        asgnSel.appendChild(grpGroup);
      }
    }
    if (
      adhocBusState.assignment &&
      asgnSel.querySelector(`option[value="${adhocBusState.assignment}"]`)
    ) {
      asgnSel.value = adhocBusState.assignment;
    }
  }

  renderBusJunctures();
  await changeBusContext();
  startAttendancePolling();
};

window.closeBusTrackerModal = function () {
  const modal = document.getElementById("busTrackerModal");
  if (modal) modal.classList.add("hidden-force");
};

function renderBusJunctures() {
  const juncSel = document.getElementById("busJunctureSelect");
  if (!juncSel) return;
  const busJunctures = getBusJunctures();
  juncSel.innerHTML = "";
  if (busJunctures.length > 0) {
    busJunctures.forEach((j) => {
      juncSel.innerHTML += `<option value="${j}">${j}</option>`;
    });
    if (adhocBusState.juncture && busJunctures.includes(adhocBusState.juncture)) {
      juncSel.value = adhocBusState.juncture;
    } else {
      adhocBusState.juncture = busJunctures[0];
      juncSel.value = adhocBusState.juncture;
    }
  } else {
    juncSel.innerHTML = `<option value="">No Bus Junctures</option>`;
    adhocBusState.juncture = "";
  }
}

function parseRemoteBusAttendanceData(remoteData) {
  const participantBusMap = {}; // nric -> { bus: "Bus 1" | "", ts: number }
  const busOptionStatusMap = {}; // busName -> { status: boolean, ts: number }

  Object.keys(remoteData || {}).forEach((rawKey) => {
    const entry = remoteData[rawKey];
    if (!entry || typeof entry !== "object") return;
    const status = Boolean(entry.status);
    const ts = Number(entry.ts) || 0;

    if (rawKey.startsWith("__BUSOPT__::")) {
      const rawBus = rawKey.substring("__BUSOPT__::".length);
      const busName = normalizeBusLabel(rawBus);
      if (!busName) return;
      const existing = busOptionStatusMap[busName];
      if (!existing || ts > existing.ts || (ts === existing.ts && status)) {
        busOptionStatusMap[busName] = { status, ts };
      }
      return;
    }

    const sepIdx = rawKey.indexOf("::");
    if (sepIdx !== -1) {
      const nric = rawKey.substring(0, sepIdx).trim().toUpperCase();
      const rawBus = rawKey.substring(sepIdx + 2);
      const busName = normalizeBusLabel(rawBus);
      if (!nric || !busName) return;

      const existing = participantBusMap[nric];
      if (
        !existing ||
        ts > existing.ts ||
        (ts === existing.ts && status && !existing.bus)
      ) {
        participantBusMap[nric] = {
          bus: status ? busName : "",
          ts,
        };
      }
    }
  });

  const activeBuses = new Set();
  Object.keys(busOptionStatusMap).forEach((busName) => {
    if (busOptionStatusMap[busName].status) {
      activeBuses.add(busName);
    }
  });
  Object.values(participantBusMap).forEach((info) => {
    if (info.bus) activeBuses.add(info.bus);
  });

  if (activeBuses.size === 0) {
    activeBuses.add("Bus 1");
  }

  const sortedBusOptions = Array.from(activeBuses).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );

  return {
    participantBusMap,
    busOptions: sortedBusOptions,
    busOptionStatusMap,
  };
}

window.changeBusContext = async function () {
  const juncSel = document.getElementById("busJunctureSelect");
  const juncture = juncSel ? juncSel.value : "";
  adhocBusState.juncture = juncture;

  if (!juncture) {
    adhocBusState.data = {};
    adhocBusState.busOptions = ["Bus 1"];
    renderBusFilterOptions();
    renderBusLists();
    return;
  }

  const overlay = document.getElementById("busLoadingOverlay");
  if (overlay) overlay.classList.remove("hidden-force");
  setAttSyncButtonState("loading", "btn-sync-bus");

  try {
    const res = await apiCall("fetchAttendanceData", {
      juncture: "__BUS__" + juncture,
    });
    const parsed = parseRemoteBusAttendanceData(res.data || {});
    adhocBusState.data = parsed.participantBusMap;
    adhocBusState.busOptions = parsed.busOptions;
    adhocBusState.busOptionsTs = {};
    Object.keys(parsed.busOptionStatusMap).forEach((b) => {
      adhocBusState.busOptionsTs[b] = parsed.busOptionStatusMap[b].ts;
    });

    renderBusFilterOptions();
    renderBusLists();
    setAttSyncButtonState("saved", "btn-sync-bus");
  } catch (e) {
    showBusFlashMessage("Failed to load bus attendance data.", true);
    setAttSyncButtonState("error", "btn-sync-bus");
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
};

function renderBusFilterOptions() {
  const sel = document.getElementById("busFilterSelect");
  if (!sel) return;

  if (!adhocBusState.busOptions || adhocBusState.busOptions.length === 0) {
    adhocBusState.busOptions = ["Bus 1"];
  }

  const prev = adhocBusState.busFilter || sel.value || "ALL";
  let html = `<option value="ALL">All Buses</option>`;
  adhocBusState.busOptions.forEach((b) => {
    html += `<option value="${b}">${b}</option>`;
  });
  sel.innerHTML = html;

  if (prev === "ALL" || adhocBusState.busOptions.includes(prev)) {
    sel.value = prev;
    adhocBusState.busFilter = prev;
  } else {
    sel.value = adhocBusState.busOptions[0] || "ALL";
    adhocBusState.busFilter = sel.value;
  }
}

window.addBusOption = function () {
  if (!adhocBusState.juncture) {
    showBusFlashMessage("Please create or select a bus juncture first.", true);
    return;
  }
  let maxNum = 0;
  adhocBusState.busOptions.forEach((b) => {
    const m = b.match(/^Bus\s+(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  const nextBus = `Bus ${maxNum + 1}`;
  if (!adhocBusState.busOptions.includes(nextBus)) {
    adhocBusState.busOptions.push(nextBus);
    adhocBusState.busOptions.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  }
  adhocBusState.busFilter = nextBus;
  renderBusFilterOptions();
  renderBusLists();

  const ts = Date.now();
  adhocBusState.busOptionsTs[nextBus] = ts;
  const optKey = `__BUSOPT__::${nextBus}`;
  pendingAdhocBusUpdates.set(optKey, { nric: optKey, status: true, ts });
  scheduleBusAttendanceSync();
  showBusFlashMessage(`${nextBus} added and selected.`);
};

window.renameBusOption = async function () {
  if (!adhocBusState.juncture) {
    showBusFlashMessage("Please create or select a bus juncture first.", true);
    return;
  }
  const sel = document.getElementById("busFilterSelect");
  const oldBus = sel ? sel.value : "ALL";

  if (!oldBus || oldBus === "ALL") {
    showBusFlashMessage("Please select a specific bus to rename.", true);
    if (sel) {
      sel.classList.add("ring-2", "ring-red-500");
      setTimeout(() => sel.classList.remove("ring-2", "ring-red-500"), 1200);
    }
    return;
  }

  const rawName = await appPrompt(
    `Enter new name for "${oldBus}":`,
    oldBus,
    "Rename Bus",
    "Bus Name",
  );
  if (!rawName || !rawName.trim()) return;

  const newBus = normalizeBusLabel(rawName.trim());
  if (!newBus || newBus === oldBus) return;

  const duplicate = adhocBusState.busOptions.find(
    (b) => b !== oldBus && b.toLowerCase() === newBus.toLowerCase(),
  );
  if (duplicate) {
    showBusFlashMessage(`A bus named "${duplicate}" already exists.`, true);
    return;
  }

  const ts = Date.now();
  const assignedNrics = Object.keys(adhocBusState.data).filter(
    (nric) => adhocBusState.data[nric]?.bus === oldBus,
  );

  assignedNrics.forEach((nric) => {
    const upperNric = nric.toUpperCase();
    const oldCompKey = `${upperNric}::${oldBus}`;
    const newCompKey = `${upperNric}::${newBus}`;
    pendingAdhocBusUpdates.set(oldCompKey, {
      nric: oldCompKey,
      status: false,
      ts,
    });
    pendingAdhocBusUpdates.set(newCompKey, {
      nric: newCompKey,
      status: true,
      ts: ts + 1,
    });
    adhocBusState.data[nric] = { bus: newBus, ts: ts + 1 };
  });

  const oldOptKey = `__BUSOPT__::${oldBus}`;
  const newOptKey = `__BUSOPT__::${newBus}`;
  adhocBusState.busOptionsTs[oldBus] = ts;
  adhocBusState.busOptionsTs[newBus] = ts + 1;
  pendingAdhocBusUpdates.set(oldOptKey, {
    nric: oldOptKey,
    status: false,
    ts,
  });
  pendingAdhocBusUpdates.set(newOptKey, {
    nric: newOptKey,
    status: true,
    ts: ts + 1,
  });

  adhocBusState.busOptions = adhocBusState.busOptions.map((b) =>
    b === oldBus ? newBus : b,
  );
  adhocBusState.busOptions.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
  adhocBusState.busFilter = newBus;

  renderBusFilterOptions();
  renderBusLists();
  scheduleBusAttendanceSync();
  showBusFlashMessage(`Renamed "${oldBus}" to "${newBus}".`);
};

window.removeBusOption = async function () {
  if (!adhocBusState.juncture) return;
  const sel = document.getElementById("busFilterSelect");
  const targetBus = sel ? sel.value : "ALL";

  if (!targetBus || targetBus === "ALL") {
    showBusFlashMessage("Please select a specific bus to remove.", true);
    return;
  }

  if (adhocBusState.busOptions.length <= 1) {
    showBusFlashMessage("At least one bus must remain.", true);
    return;
  }

  // Count participants currently on targetBus
  const assignedNrics = Object.keys(adhocBusState.data).filter(
    (nric) => adhocBusState.data[nric]?.bus === targetBus,
  );

  if (assignedNrics.length > 0) {
    const confirmed = await appConfirm(
      `Remove ${targetBus}? ${assignedNrics.length} participant(s) currently on ${targetBus} will be moved back to Not Boarded.`,
      "Remove Bus",
      "Remove Bus",
      "Cancel",
      true,
    );
    if (!confirmed) return;
  }

  const ts = Date.now();
  assignedNrics.forEach((nric) => {
    adhocBusState.data[nric] = { bus: "", ts };
    const compKey = `${nric}::${targetBus}`;
    pendingAdhocBusUpdates.set(compKey, { nric: compKey, status: false, ts });
  });

  adhocBusState.busOptions = adhocBusState.busOptions.filter((b) => b !== targetBus);
  if (adhocBusState.busOptions.length === 0) adhocBusState.busOptions = ["Bus 1"];
  adhocBusState.busFilter = "ALL";

  const optKey = `__BUSOPT__::${targetBus}`;
  adhocBusState.busOptionsTs[targetBus] = ts;
  pendingAdhocBusUpdates.set(optKey, { nric: optKey, status: false, ts });

  renderBusFilterOptions();
  renderBusLists();
  scheduleBusAttendanceSync();
  showBusFlashMessage(`${targetBus} removed.`);
};

window.promptNewBusJuncture = async function () {
  const name = await appPrompt(
    "Enter new bus juncture name (e.g. Day 1: Airport Transfer):",
    "",
    "New Bus Juncture",
    "Bus Juncture Name",
  );
  if (!name || !name.trim()) return;
  const cleanName = name.trim();
  const internalName = "__BUS__" + cleanName;

  const overlay = document.getElementById("busLoadingOverlay");
  if (overlay) overlay.classList.remove("hidden-force");
  setAttSyncButtonState("loading", "btn-sync-bus");

  try {
    const res = await apiCall("modifyJunctures", {
      actionType: "add",
      newName: internalName,
    });
    appSettings.junctures = res.junctures;
    adhocBusState.juncture = cleanName;
    renderBusJunctures();
    showBusFlashMessage(`Bus juncture "${cleanName}" created.`);
    await changeBusContext();
  } catch (e) {
    showBusFlashMessage(e.message || "Failed to add bus juncture.", true);
    setAttSyncButtonState("error", "btn-sync-bus");
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
};

window.promptDeleteBusJuncture = async function () {
  const juncSel = document.getElementById("busJunctureSelect");
  const cleanName = juncSel ? juncSel.value : "";
  if (!cleanName) {
    showBusFlashMessage("No bus juncture selected.", true);
    return;
  }

  if (
    !(await appConfirm(
      `Are you sure you want to delete bus juncture "${cleanName}"?`,
      "Delete Bus Juncture",
      "Delete",
      "Cancel",
      true,
    ))
  )
    return;

  const overlay = document.getElementById("busLoadingOverlay");
  if (overlay) overlay.classList.remove("hidden-force");
  setAttSyncButtonState("loading", "btn-sync-bus");

  try {
    const res = await apiCall("modifyJunctures", {
      actionType: "remove",
      oldName: "__BUS__" + cleanName,
    });
    appSettings.junctures = res.junctures;
    adhocBusState.juncture = "";
    renderBusJunctures();
    showBusFlashMessage(`Bus juncture "${cleanName}" deleted.`);
    await changeBusContext();
  } catch (e) {
    showBusFlashMessage(e.message || "Failed to delete bus juncture.", true);
    setAttSyncButtonState("error", "btn-sync-bus");
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
};

function getFilteredBusParticipants() {
  if (!globalLogistics || !globalLogistics.participants) return [];
  const assignmentEl = document.getElementById("busAssignmentSelect");
  const assignment = assignmentEl ? assignmentEl.value : "ALL";
  adhocBusState.assignment = assignment;

  const searchInput = document.getElementById("busSearchInput");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  return globalLogistics.participants.filter((p) => {
    let matchAssignment = false;
    if (assignment === "ALL") matchAssignment = true;
    else if (assignment.startsWith("PROJ::"))
      matchAssignment = p.group === assignment.split("::")[1];
    else if (assignment.startsWith("GRP::"))
      matchAssignment = p.logisticsGroup === assignment.split("::")[1];
    else matchAssignment = p.group === assignment;

    if (!matchAssignment) return false;

    if (query) {
      const dName = p.displayName || p.name || "";
      const fullName = p.name || "";
      let tName = "";
      if (p.role === "CAREGIVER") {
        const myPoc = p.pocNric || p.nric;
        const trainee = globalLogistics.participants.find(
          (x) => x.role === "TRAINEE" && (x.pocNric || x.nric) === myPoc,
        );
        if (trainee) {
          tName = trainee.shortName || trainee.name || "";
        } else if (p.relatedTrainee) {
          tName = p.relatedTrainee;
        }
      }
      if (
        !dName.toLowerCase().includes(query) &&
        !fullName.toLowerCase().includes(query) &&
        !tName.toLowerCase().includes(query)
      )
        return false;
    }
    return true;
  });
}

function sortBusParticipants(list, sortByBusFirst = false) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const allParticipants =
    globalLogistics && Array.isArray(globalLogistics.participants)
      ? globalLogistics.participants
      : list;

  const sorted = [...list];
  if (typeof window.sortParticipantsSpecial === "function") {
    window.sortParticipantsSpecial(sorted, allParticipants);
  } else if (typeof applyGlobalSorting === "function") {
    applyGlobalSorting(sorted);
  }

  if (sortByBusFirst) {
    // Stable sort by assigned bus (natural numeric order: Bus 1, Bus 2, ..., Bus 10),
    // preserving the special sort order within each bus
    sorted.sort((a, b) => {
      const busA =
        (
          adhocBusState.data[a.nric.toUpperCase()] ||
          adhocBusState.data[a.nric] ||
          {}
        ).bus || "";
      const busB =
        (
          adhocBusState.data[b.nric.toUpperCase()] ||
          adhocBusState.data[b.nric] ||
          {}
        ).bus || "";
      return busA.localeCompare(busB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }

  return sorted;
}

window.renderBusLists = function () {
  const notBoardedList = document.getElementById("busNotBoardedList");
  const boardedList = document.getElementById("busBoardedList");
  if (!notBoardedList || !boardedList) return;

  if (!adhocBusState.juncture) {
    notBoardedList.innerHTML =
      '<p class="text-xs text-gray-400 dark:text-gray-500 font-bold p-4 text-center mt-2">Create or select a Bus Juncture (+) above to start tracking.</p>';
    boardedList.innerHTML =
      '<p class="text-xs text-gray-400 dark:text-gray-500 font-bold p-4 text-center mt-2">No Bus Juncture Selected</p>';
    document.getElementById("busNotBoardedCount").textContent = "0";
    document.getElementById("busBoardedCount").textContent = "0";
    return;
  }

  const busFilterEl = document.getElementById("busFilterSelect");
  const busFilter = busFilterEl ? busFilterEl.value : adhocBusState.busFilter || "ALL";
  adhocBusState.busFilter = busFilter;

  const participants = getFilteredBusParticipants();
  const notBoardedArr = [];
  const boardedArr = [];

  participants.forEach((p) => {
    const entry = adhocBusState.data[p.nric.toUpperCase()] || adhocBusState.data[p.nric];
    const assignedBus = entry && entry.bus ? entry.bus : "";
    const isBoarded = Boolean(assignedBus);

    if (!isBoarded) {
      notBoardedArr.push(p);
    } else if (busFilter === "ALL" || assignedBus === busFilter) {
      boardedArr.push(p);
    }
  });

  const searchInput = document.getElementById("busSearchInput");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  let sortedNotBoarded;
  let sortedBoarded;
  if (query && window.sortBySearchRelevance) {
    const getBusSearchFields = (p) => {
      let tName = p.relatedTrainee || "";
      if (p.role === "CAREGIVER" && globalLogistics && globalLogistics.participants) {
        const myPoc = p.pocNric || p.nric;
        const trainee = globalLogistics.participants.find(
          (x) => x.role === "TRAINEE" && (x.pocNric || x.nric) === myPoc,
        );
        if (trainee) tName = trainee.shortName || trainee.name || tName;
      }
      return {
        primary: [p.displayName, p.shortName, p.name],
        secondary: [tName, p.nric, p.group, p.logisticsGroup],
      };
    };
    sortedNotBoarded = window.sortBySearchRelevance(
      [...notBoardedArr],
      query,
      getBusSearchFields,
    );
    sortedBoarded = window.sortBySearchRelevance(
      [...boardedArr],
      query,
      getBusSearchFields,
    );
  } else {
    sortedNotBoarded = sortBusParticipants(notBoardedArr, false);
    sortedBoarded = sortBusParticipants(boardedArr, busFilter === "ALL");
  }

  const notBoardedHtml = sortedNotBoarded
    .map((p) => generateBusCard(p, ""))
    .join("");
  const boardedHtml = sortedBoarded
    .map((p) => {
      const entry = adhocBusState.data[p.nric.toUpperCase()] || adhocBusState.data[p.nric];
      const assignedBus = entry && entry.bus ? entry.bus : "";
      return generateBusCard(p, assignedBus);
    })
    .join("");

  notBoardedList.innerHTML =
    notBoardedHtml ||
    '<p class="text-xs text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';
  boardedList.innerHTML =
    boardedHtml ||
    '<p class="text-xs text-gray-400 dark:text-gray-500 font-bold p-2 text-center mt-2">Empty</p>';

  document.getElementById("busNotBoardedCount").textContent =
    sortedNotBoarded.length;
  document.getElementById("busBoardedCount").textContent = sortedBoarded.length;
};

function generateBusCard(p, assignedBus) {
  const isBoarded = Boolean(assignedBus);
  const dynColor = getProjectColor(p.group);
  const roleColor =
    p.role === "TRAINEE"
      ? "text-green-600 dark:text-green-400"
      : p.role === "CAREGIVER"
        ? "text-purple-600 dark:text-purple-400"
        : "text-orange-600 dark:text-orange-400";
  const roleShort = p.role.substring(0, 3).toUpperCase();
  const dName = p.displayName || p.name;

  let relatedTraineeHtml = "";
  if (p.role === "CAREGIVER") {
    let tName = "";
    if (globalLogistics && globalLogistics.participants) {
      const myPoc = p.pocNric || p.nric;
      const trainee = globalLogistics.participants.find(
        (x) => x.role === "TRAINEE" && (x.pocNric || x.nric) === myPoc,
      );
      if (trainee) {
        tName = trainee.shortName || trainee.name;
      } else if (p.relatedTrainee) {
        tName = p.relatedTrainee;
      }
    }
    if (tName) {
      relatedTraineeHtml = `<div class="mt-1 font-bold text-purple-600 dark:text-purple-400 text-xs leading-tight max-w-full break-words whitespace-normal" style="overflow-wrap: break-word;">[${tName.toUpperCase()}]</div>`;
    }
  }

  const busBadgeHtml = isBoarded
    ? `<span class="text-[10px] font-black text-yellow-800 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/40 px-1.5 py-0.5 rounded uppercase tracking-wider border border-yellow-300 dark:border-yellow-700 mt-0.5"><i class="fa-solid fa-bus mr-1 text-[9px]"></i>${assignedBus}</span>`
    : "";

  return `
<div id="bus-card-${p.nric}" class="relative bg-white dark:bg-gray-800 p-1.5 md:p-2 rounded border-2 border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-300 flex items-center justify-between gap-1 select-none active:scale-95 cursor-pointer hover:border-yellow-500 dark:hover:border-yellow-500"
  onpointerdown="startAttLongPress('${p.nric}', event)"
  onpointerup="cancelAttLongPress(event)"
  onpointerleave="cancelAttLongPress(event)"
  onpointercancel="cancelAttLongPress(event)"
  oncontextmenu="if(attLongPressFired) { event.preventDefault(); return false; }"
  onclick="handleBusCardClick('${p.nric}', ${isBoarded}, event)">
  <div class="flex items-start min-w-0 flex-1">
    <div class="flex flex-col min-w-0 flex-1 gap-1">
      <span class="font-extrabold text-sm md:text-[12px] px-1.5 py-0.5 rounded shadow-md border ${dynColor} max-w-full break-words whitespace-normal leading-[1.1] text-left inline-block self-start" style="overflow-wrap: break-word;">${dName}</span>
      ${relatedTraineeHtml}
      <div class="flex flex-wrap items-center gap-1">
        <span class="text-[10px] font-black ${roleColor} w-max bg-gray-50 dark:bg-gray-700 px-1 py-0.5 rounded uppercase tracking-wider border-2 border-gray-100 dark:border-gray-600 mt-0.5">${roleShort}</span>
        ${busBadgeHtml}
      </div>
    </div>
  </div>
  <div class="shrink-0 flex items-center justify-center pl-1">
    <div class="w-5 h-5 rounded flex items-center justify-center border transition-colors ${isBoarded ? "bg-green-500 border-green-600 text-white shadow-inner" : "bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-transparent"}">
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
    </div>
  </div>
</div>`;
}

window.handleBusCardClick = function (nric, isBoarded, event) {
  if (attLongPressFired) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  toggleBusStatus(nric, !isBoarded);
};

function toggleBusStatus(nric, shouldBoard) {
  if (!adhocBusState.juncture) {
    showBusFlashMessage("Please create or select a bus juncture first.", true);
    return;
  }

  const upperNric = nric.toUpperCase();
  const busFilterEl = document.getElementById("busFilterSelect");
  const currentFilter = busFilterEl ? busFilterEl.value : adhocBusState.busFilter;
  const ts = Date.now();

  if (shouldBoard) {
    if (!currentFilter || currentFilter === "ALL") {
      showBusFlashMessage(
        "Please select a specific bus (e.g. Bus 1) under Boarded first.",
        true,
      );
      if (busFilterEl) {
        busFilterEl.classList.add("ring-2", "ring-red-500");
        setTimeout(
          () => busFilterEl.classList.remove("ring-2", "ring-red-500"),
          1200,
        );
      }
      return;
    }

    const prevBus = adhocBusState.data[upperNric]?.bus;
    if (prevBus && prevBus !== currentFilter) {
      const prevKey = `${upperNric}::${prevBus}`;
      pendingAdhocBusUpdates.set(prevKey, {
        nric: prevKey,
        status: false,
        ts: ts - 1,
      });
    }

    adhocBusState.data[upperNric] = { bus: currentFilter, ts };
    const newKey = `${upperNric}::${currentFilter}`;
    pendingAdhocBusUpdates.set(newKey, { nric: newKey, status: true, ts });
  } else {
    const prevBus = adhocBusState.data[upperNric]?.bus || currentFilter;
    adhocBusState.data[upperNric] = { bus: "", ts };
    if (prevBus && prevBus !== "ALL") {
      const compKey = `${upperNric}::${prevBus}`;
      pendingAdhocBusUpdates.set(compKey, { nric: compKey, status: false, ts });
    }
  }

  const searchInput = document.getElementById("busSearchInput");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  if (query) {
    if (attSearchMode === "single") {
      searchInput.value = "";
    } else {
      const matched = getFilteredBusParticipants();
      if (matched.length > 0) {
        const firstBoarded = Boolean(
          adhocBusState.data[matched[0].nric.toUpperCase()]?.bus,
        );
        const allSame = matched.every(
          (p) =>
            Boolean(adhocBusState.data[p.nric.toUpperCase()]?.bus) === firstBoarded,
        );
        if (allSame) {
          searchInput.value = "";
        }
      }
    }
  }

  renderBusLists();
  scheduleBusAttendanceSync();
  triggerPulseFeedback(nric, shouldBoard, "bus-card-");
}

window.handleBusSearch = function () {
  renderBusLists();
};

function scheduleBusAttendanceSync() {
  if (adhocBusSyncTimeout) clearTimeout(adhocBusSyncTimeout);
  adhocBusSyncTimeout = setTimeout(() => {
    executeBusAttendanceSync();
  }, 800);
}

async function executeBusAttendanceSync() {
  if (pendingAdhocBusUpdates.size === 0 || !adhocBusState.juncture) return;

  isAdhocBusSyncing = true;
  setAttSyncButtonState("saving", "btn-sync-bus");

  const batchMap = new Map(pendingAdhocBusUpdates);
  pendingAdhocBusUpdates.clear();

  const updates = Array.from(batchMap.values());

  try {
    await apiCall("syncAttendanceUpdate", {
      juncture: "__BUS__" + adhocBusState.juncture,
      updates,
      takenBy: currentUser?.name || currentUser?.nric || "ADMIN",
    });
    setAttSyncButtonState("saved", "btn-sync-bus");
  } catch (e) {
    showBusFlashMessage("Bus sync failed. Retrying...", true);
    setAttSyncButtonState("error", "btn-sync-bus");
    batchMap.forEach((val, key) => {
      if (!pendingAdhocBusUpdates.has(key)) pendingAdhocBusUpdates.set(key, val);
    });
  } finally {
    isAdhocBusSyncing = false;
  }
}

window.manualSyncBusAttendance = async function () {
  if (pendingAdhocBusUpdates.size > 0) {
    await executeBusAttendanceSync();
  }
  await changeBusContext();
  showBusFlashMessage("Refreshed from server!");
};

async function pollBusAttendanceNow() {
  if (
    !adhocBusState.juncture ||
    isAdhocBusSyncing ||
    pendingAdhocBusUpdates.size > 0
  )
    return;

  const fetchStartTime = Date.now();
  try {
    const res = await apiCall("fetchAttendanceData", {
      juncture: "__BUS__" + adhocBusState.juncture,
    });
    if (lastLocalChange > fetchStartTime || pendingAdhocBusUpdates.size > 0) return;

    const parsed = parseRemoteBusAttendanceData(res.data || {});
    let hasChanges = false;

    if (
      JSON.stringify(parsed.busOptions) !== JSON.stringify(adhocBusState.busOptions)
    ) {
      adhocBusState.busOptions = parsed.busOptions;
      renderBusFilterOptions();
      hasChanges = true;
    }

    Object.keys(parsed.participantBusMap).forEach((nric) => {
      const rEntry = parsed.participantBusMap[nric];
      const lEntry = adhocBusState.data[nric] || { bus: "", ts: 0 };
      if (rEntry.ts > lEntry.ts) {
        adhocBusState.data[nric] = rEntry;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      renderBusLists();
    }
  } catch (e) {}
}

function formatBusExportText(type) {
  const juncture = adhocBusState.juncture || "Bus Attendance";
  const busFilter = adhocBusState.busFilter || "ALL";
  const participants = getFilteredBusParticipants();

  const filteredList = participants.filter((p) => {
    const assignedBus = adhocBusState.data[p.nric.toUpperCase()]?.bus || "";
    if (type === "notBoarded") return !assignedBus;
    if (busFilter === "ALL") return Boolean(assignedBus);
    return assignedBus === busFilter;
  });

  const list = sortBusParticipants(
    filteredList,
    type === "boarded" && busFilter === "ALL",
  );

  const headerLabel =
    type === "notBoarded"
      ? `Not Boarded (${list.length})`
      : `Boarded - ${busFilter === "ALL" ? "All Buses" : busFilter} (${list.length})`;

  let text = `*${juncture} - ${headerLabel}*\n\n`;
  if (list.length === 0) {
    text += "None";
  } else {
    list.forEach((p, idx) => {
      const dName = p.displayName || p.shortName || p.name;
      const roleShort = (p.role || "").substring(0, 3).toUpperCase();
      const assignedBus = adhocBusState.data[p.nric.toUpperCase()]?.bus || "";
      const busSuffix =
        type === "boarded" && busFilter === "ALL" && assignedBus
          ? ` [${assignedBus}]`
          : "";
      text += `${idx + 1}. ${dName} (${roleShort})${busSuffix}\n`;
    });
  }
  return text.trim();
}

window.copyBusColumnData = function (type) {
  const text = formatBusExportText(type);
  navigator.clipboard
    .writeText(text)
    .then(() => showBusFlashMessage("List copied to clipboard!"))
    .catch(() => showBusFlashMessage("Failed to copy list.", true));
};

window.shareBusColumnData = async function (type) {
  const text = formatBusExportText(type);
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch (e) {}
  } else {
    window.copyBusColumnData(type);
  }
};

