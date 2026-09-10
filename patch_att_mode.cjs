const fs = require('fs');
const path = './frontend/js/attendance.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add the state variable for mode
if (!content.includes("let attSearchMode")) {
    content = content.replace("let attendanceState = {};", "let attendanceState = {};\nlet attSearchMode = 'single';");
}

// 2. Add the UI toggle inside buildAttendanceUI
const searchUI = `<div class="relative">
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
  </div>`;

const oldSearchUI = `<div class="relative">
     <input type="text" id="attSearchInput" oninput="handleAttendanceSearch()" placeholder="Search to mark present..." class="w-full p-1.5 pl-8 pr-8 border-2 border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 font-bold text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 dark:text-white shadow-md transition">
     <svg class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
     <button onclick="clearSearch('attSearchInput', 'handleAttendanceSearch')" class="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
     
  </div>`;

if (content.includes(oldSearchUI)) {
    content = content.replace(oldSearchUI, searchUI);
} else {
    console.log("Could not find oldSearchUI");
}

// 3. Add setAttSearchMode function
const modeFn = `
function setAttSearchMode(mode) {
    attSearchMode = mode;
    const btnSingle = document.getElementById('btn-mode-single');
    const btnMulti = document.getElementById('btn-mode-multi');
    if(btnSingle && btnMulti) {
        if(mode === 'single') {
            btnSingle.className = "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider";
            btnMulti.className = "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider";
        } else {
            btnMulti.className = "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-wider";
            btnSingle.className = "px-2 py-0.5 rounded-sm text-[10px] font-black transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider";
        }
    }
}
`;
if(!content.includes("function setAttSearchMode")) {
    content += modeFn;
}


// 4. Update toggleAttendanceStatus
const toggleOld = `function toggleAttendanceStatus(nric, forceState) {
attendanceState[nric] = { status: forceState, ts: Date.now() }; 
pendingAttendanceUpdates.add(nric);

const searchInput = document.getElementById('attSearchInput');
if (searchInput && searchInput.value) {
    searchInput.value = '';
}

renderAttendanceLists();`;

const toggleNew = `function toggleAttendanceStatus(nric, forceState) {
attendanceState[nric] = { status: forceState, ts: Date.now() }; 
pendingAttendanceUpdates.add(nric);

const searchInput = document.getElementById('attSearchInput');
const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

if (query) {
    if (attSearchMode === 'single') {
        searchInput.value = '';
    } else {
        // Multi (Family) mode
        const assignment = document.getElementById('attAssignmentSelect').value;
        const matchedParticipants = globalLogistics.participants.filter(p => {
            let matchAssignment = false;
            if (assignment === 'ALL') matchAssignment = true;
            else if (assignment.startsWith('PROJ::')) matchAssignment = (p.group === assignment.split('::')[1]);
            else if (assignment.startsWith('GRP::')) matchAssignment = (p.logisticsGroup === assignment.split('::')[1]);
            else if (assignment.startsWith('BUS::')) matchAssignment = (p.bus === assignment.split('::')[1]);
            else matchAssignment = (p.group === assignment);
            
            if (!matchAssignment) return false;
            
            const dName = p.displayName || p.name || '';
            const fullName = p.name || '';
            let tName = '';
            if (p.role === 'CAREGIVER') {
                const myPoc = p.pocNric || p.nric;
                const trainee = globalLogistics.participants.find(x => x.role === 'TRAINEE' && (x.pocNric || x.nric) === myPoc);
                if (trainee) tName = trainee.shortName || trainee.name || '';
                else if (p.relatedTrainee) tName = p.relatedTrainee;
            }
            
            return dName.toLowerCase().includes(query) || fullName.toLowerCase().includes(query) || tName.toLowerCase().includes(query);
        });

        if (matchedParticipants.length > 0) {
            const firstState = attendanceState[matchedParticipants[0].nric]?.status || false;
            const allSame = matchedParticipants.every(p => {
                const state = attendanceState[p.nric]?.status || false;
                return state === firstState;
            });
            
            if (allSame) {
                searchInput.value = '';
            }
        }
    }
}

renderAttendanceLists();`;

if (content.includes(toggleOld)) {
    content = content.replace(toggleOld, toggleNew);
} else {
    console.log("Could not find toggleOld");
}

fs.writeFileSync(path, content, 'utf8');
console.log("Patched mode successfully.");
