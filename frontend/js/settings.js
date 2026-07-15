function applyAdminVisuals() {
const rBtn = document.getElementById('toggleRegBtn'); 
if(rBtn) { if(appSettings.registrationOpen) { rBtn.innerHTML = `<span class="btn-text">OPEN (Click to Close)</span><div class="btn-spinner spinner-white hidden-force ml-2"></div>`; rBtn.className = "w-full px-3 py-2 text-xs md:text-sm bg-green-600 text-white font-bold rounded-lg shadow-sm border border-green-700 transition flex justify-center items-center"; } else { rBtn.innerHTML = `<span class="btn-text">CLOSED (Click to Open)</span><div class="btn-spinner spinner-white hidden-force ml-2"></div>`; rBtn.className = "w-full px-3 py-2 text-xs md:text-sm bg-red-500 text-white font-bold rounded-lg shadow-sm border border-red-600 transition flex justify-center items-center"; } }
const sliderBtn = document.getElementById('editSliderToggle'); const sliderKnob = document.getElementById('editSliderKnob'); const statusText = document.getElementById('editStatusText');
if (sliderBtn && sliderKnob && statusText) { if(appSettings.allowEdits) { sliderBtn.className = "relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-300 focus:outline-none bg-green-500 shadow-inner shrink-0"; sliderKnob.className = "inline-flex w-4 h-4 transform translate-x-6 bg-white rounded-full transition-transform duration-300 shadow items-center justify-center"; statusText.textContent = "Yes"; statusText.className = "font-black text-xs text-green-600 dark:text-green-400 transition-colors"; } else { sliderBtn.className = "relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-300 focus:outline-none bg-gray-300 dark:bg-gray-600 shadow-inner shrink-0"; sliderKnob.className = "inline-flex w-4 h-4 transform translate-x-1 bg-white rounded-full transition-transform duration-300 shadow items-center justify-center"; statusText.textContent = "No"; statusText.className = "font-black text-xs text-gray-500 dark:text-gray-400 transition-colors"; } }
}

function buildSettingsUI() {
document.getElementById('tab-settings').innerHTML = `
<div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
  
  <div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 lg:col-span-1">
   <h3 class="text-sm font-black text-gray-900 dark:text-white mb-0.5 tracking-tight">Registration Form</h3>
   <p class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-3">Allow new participants to sign up.</p>
   <button id="toggleRegBtn" onclick="initiateRegistrationToggle(this)" class="w-full px-3 py-2 text-xs bg-green-600 text-white font-bold rounded-lg shadow-sm border border-green-700 flex justify-center items-center"><span class="btn-text">Loading...</span><div class="btn-spinner spinner-white hidden-force ml-2 !w-3 !h-3 border-2"></div></button>
  </div>

  <div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 lg:col-span-1">
   <h3 class="text-sm font-black text-gray-900 dark:text-white mb-0.5 tracking-tight">Participant Editing</h3>
   <p class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-3">Can users edit their details?</p>
   <div class="flex items-center space-x-2.5 mt-1 border border-gray-100 dark:border-gray-800 p-2 rounded-lg bg-gray-50 dark:bg-gray-950/50">
     <button id="editSliderToggle" onclick="toggleEditSlider(this)" class="relative inline-flex items-center h-6 w-11 rounded-full bg-gray-300 shadow-inner focus:outline-none shrink-0">
       <span id="editSliderKnob" class="inline-flex w-4 h-4 transform translate-x-1 bg-white rounded-full shadow items-center justify-center"><div id="editSliderLoader" class="loader hidden-force" style="width: 10px; height: 10px; border-width: 2px;"></div></span>
     </button>
     <span id="editStatusText" class="font-black text-xs text-gray-500 dark:text-gray-400">No</span>
   </div>
  </div>

  <div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 lg:col-span-1">
   <h3 class="text-sm font-black text-gray-900 dark:text-white mb-0.5 tracking-tight">Trip Dates Configuration</h3>
   <p class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-2">Used for passport validity checks.</p>
   <div class="grid grid-cols-2 gap-2 mb-2">
     <div>
       <label class="block text-[9px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider mb-1">Start Date</label>
       <input type="date" id="tripStartDate" value="${appSettings.tripStartDate || ''}" class="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-md text-[11px] font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]">
     </div>
     <div>
       <label class="block text-[9px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider mb-1">End Date</label>
       <input type="date" id="tripEndDate" value="${appSettings.tripEndDate || ''}" class="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-md text-[11px] font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]">
     </div>
   </div>
   <button onclick="saveTripConfiguration(this)" class="w-full px-2 py-1.5 text-[11px] bg-primary text-white font-bold rounded-md shadow-sm transition flex justify-center items-center hover:bg-blue-600 focus:outline-none"><span class="btn-text">Save Dates</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
  </div>

</div>

<div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 admin-only">
<h3 class="text-sm font-black text-gray-900 dark:text-white mb-0.5 tracking-tight">Global Sorting Priorities</h3>
<p class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-3">Stacking rules applied to all lists across the App.</p>
<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
  ${[1,2,3,4].map((i) => `
  <div>
    <label class="block text-[9px] uppercase font-bold mb-1 text-gray-500 dark:text-gray-400 tracking-wider">Priority ${i}</label>
    <select id="sortRule${i}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md text-[11px] md:text-xs font-bold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
      <option value="none">None</option>
      <option value="project">Project</option>
      <option value="family">Family / Indep</option>
      <option value="role">Role (Trainee/Vol)</option>
      <option value="name">Name (A-Z)</option>
    </select>
  </div>`).join('')}
</div>
<button onclick="saveSortingSettings(this)" class="w-full md:w-auto bg-primary text-white px-4 py-2 text-xs rounded-lg font-bold flex items-center justify-center shadow-sm"><span class="btn-text">Save Sort Order</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
</div>

<div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 admin-only">
<h3 class="text-sm font-black text-gray-900 dark:text-white mb-1 tracking-tight">Attendance Junctures</h3>
<div class="flex space-x-2 mb-3 mt-2">
 <input type="text" id="newJunctureName" placeholder="e.g. Day 1: Dinner" class="flex-grow p-2 border border-gray-300 dark:border-gray-700 rounded-md text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
 <button onclick="addJuncture(this)" class="bg-primary text-white px-3 py-2 text-xs rounded-md font-bold flex items-center shadow-sm shrink-0"><span class="btn-text">Add</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
</div>
<ul id="junctureList" class="space-y-1.5"></ul>
</div>

<div id="projectsSettingsBlock" class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 main-admin-only ${currentUser && currentUser.nric === 'ADMIN' ? '' : 'hidden-force'}">
<h3 class="text-sm font-black text-gray-900 dark:text-white mb-1 tracking-tight">Projects</h3>
<div class="flex space-x-2 mb-3 mt-2">
 <input type="text" id="newGroupName" placeholder="e.g. Project A" class="flex-grow p-2 border border-gray-300 dark:border-gray-700 rounded-md text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
 <button onclick="openColorPickerForNewProject()" class="w-8 h-8 shrink-0 rounded-full border border-gray-300 dark:border-gray-600 shadow-sm transition hover:scale-105 bg-white dark:bg-gray-800 self-center" id="newGroupColorBtn" title="Pick a color"></button>
 <button onclick="addProjectGroup(this)" class="bg-primary text-white px-3 py-2 text-xs rounded-md font-bold flex items-center shadow-sm shrink-0"><span class="btn-text">Add</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
</div>
<ul id="groupList" class="space-y-1.5"></ul>
</div>

<div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
<h3 class="text-sm font-black text-gray-900 dark:text-white mb-1 tracking-tight">Committee Members</h3>
<div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 mt-2">
 <input type="text" id="newCommName" placeholder="Full Name" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
 <input type="text" id="newCommNric" placeholder="NRIC/FIN" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md uppercase text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
 <div class="flex space-x-2">
   <input type="tel" id="newCommPhone" placeholder="Phone" pattern="[0-9]{8}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
   <button onclick="addCommittee(this)" class="bg-primary text-white px-3 py-2 text-xs rounded-md font-bold flex items-center shadow-sm shrink-0"><span class="btn-text">Add</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
 </div>
</div>
<ul id="commList" class="space-y-1.5"></ul>
</div>

<div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 main-admin-only ${currentUser && currentUser.nric === 'ADMIN' ? '' : 'hidden-force'}">
<div class="flex justify-between items-center mb-0.5">
<h3 class="text-sm font-black text-gray-900 dark:text-white tracking-tight">Drive Access Management</h3>
<button onclick="massRemoveDriveAccessBtn(this)" class="text-[10px] md:text-xs text-red-600 dark:text-red-400 font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 shadow-sm hover:bg-red-50 dark:hover:bg-gray-700 transition flex items-center focus:outline-none shrink-0"><span class="btn-text">Remove All</span><div class="btn-spinner spinner-red hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
</div>
<p class="text-[9px] font-semibold text-gray-500 dark:text-gray-400 mb-3 leading-tight">Grant specific users access to the underlying Google Drive trip folder. You can paste multiple emails separated by commas or newlines.</p>

<div class="flex flex-col space-y-2 mb-3 mt-2">
 <textarea id="newDriveEmails" rows="2" placeholder="Google Account Emails (comma or newline separated)" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm resize-y"></textarea>
 
 <div class="flex flex-col md:flex-row gap-3 justify-between items-center w-full mt-1">
   <div class="flex items-center gap-2 w-full md:w-auto flex-1">
     <label class="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider whitespace-nowrap">Access Role:</label>
     <select id="newDriveRole" class="p-2 w-full md:w-48 border-2 border-primary/60 dark:border-primary/50 rounded-md text-xs font-extrabold bg-blue-50/50 dark:bg-blue-900/30 text-primary dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm cursor-pointer transition">
       <option value="viewer">Viewer</option>
       <option value="editor">Editor</option>
     </select>
   </div>
   <button onclick="massAddDriveAccessBtn(this)" class="bg-primary text-white px-6 py-2.5 text-xs rounded-md font-bold flex items-center justify-center shadow-sm w-full md:w-auto shrink-0 hover:bg-blue-600 transition"><span class="btn-text">Add</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
 </div>
</div>
<ul id="driveAccessList" class="space-y-1.5"></ul>
</div>

<div class="bg-red-50/50 dark:bg-red-900/10 p-3 md:p-4 rounded-xl shadow-sm border border-red-200 dark:border-red-900 main-admin-only ${currentUser && currentUser.nric === 'ADMIN' ? '' : 'hidden-force'}">
<h3 class="text-sm font-black mb-0.5 text-red-700 dark:text-red-400 tracking-tight">Danger Zone</h3>
<p class="text-[10px] font-bold text-red-600/80 dark:text-red-400 mb-3">Archive current trip to Google Drive and wipe system for a fresh start.</p>
<button onclick="archiveSystem(this)" class="w-full sm:w-auto bg-red-600 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm hover:bg-red-700 focus:outline-none flex items-center justify-center"><span class="btn-text">Archive & Reset</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
</div>
`;
applyAdminVisuals();

const sRules = appSettings.sortingRules || ['project', 'family', 'role', 'name'];
for(let i=0; i<4; i++) {
const sel = document.getElementById(`sortRule${i+1}`);
if(sel) sel.value = sRules[i] || 'none';
}

renderJunctureList(appSettings.junctures);
if(currentUser && currentUser.nric === 'ADMIN') {
renderGroupList(appSettings.projectGroups);
renderDriveAccessList(appSettings.driveAccessList);
}
renderCommList(appSettings.committee);
}

async function saveTripConfiguration(btn) {
setBtnLoading(btn, true);
const sDate = document.getElementById('tripStartDate').value;
const eDate = document.getElementById('tripEndDate').value;
try {
  const res = await callBackend('saveTripSettings', { title: appSettings.tripTitle, year: appSettings.tripYear, start: sDate, end: eDate });
  appSettings.tripStartDate = res.start;
  appSettings.tripEndDate = res.end;
  showToast("Trip dates saved successfully.");
} catch(e) {
  showToast(e.message, true);
} finally {
  setBtnLoading(btn, false);
}
}

async function saveSortingSettings(btn) {
setBtnLoading(btn, true);
const r1 = document.getElementById('sortRule1').value;
const r2 = document.getElementById('sortRule2').value;
const r3 = document.getElementById('sortRule3').value;
const r4 = document.getElementById('sortRule4').value;
const rules = [r1, r2, r3, r4];

try {
  const res = await callBackend('saveSortingRules', { rules: rules, callerNric: currentUser.nric });
  appSettings.sortingRules = res.sortingRules;
  showToast("Sorting Rules updated. Reloading data...");
  if(globalLogistics) await loadLogisticsData();
} catch(e) {
  showToast(e.message, true);
} finally {
  setBtnLoading(btn, false);
}
}

function initiateRegistrationToggle(btn) { 
if(!appSettings.registrationOpen) { 
  document.getElementById('tripYearInput').value = new Date().getFullYear(); 
  document.getElementById('tripSetupModal').classList.remove('hidden-force'); 
} else { 
  executeToggleRegistration(false, '', '', '', '', btn); 
} 
}

function cancelTripSetup() { document.getElementById('tripSetupModal').classList.add('hidden-force'); }

async function confirmTripSetup(btn) { 
document.getElementById('tripSetupModal').classList.add('hidden-force'); 
await executeToggleRegistration(
  true, 
  document.getElementById('tripTitleInput').value.trim() || 'MYG Overseas Trip', 
  document.getElementById('tripYearInput').value.trim() || new Date().getFullYear(), 
  document.getElementById('tripStartInput').value,
  document.getElementById('tripEndInput').value,
  btn
); 
}

async function executeToggleRegistration(newState, title = '', year = '', start = '', end = '', sourceBtn = null) {
const mainBtn = document.getElementById('toggleRegBtn'); setBtnLoading(mainBtn, true); if(sourceBtn && sourceBtn !== mainBtn) setBtnLoading(sourceBtn, true);
try { 
  const res = await callBackend('toggleRegistration', { status: newState, tripTitle: title, tripYear: year, tripStart: start, tripEnd: end }); 
  appSettings.registrationOpen = newState; 
  if(start) appSettings.tripStartDate = start;
  if(end) appSettings.tripEndDate = end;
  
  const headerTripName = document.getElementById('headerTripName'); 
  if(newState && res.tripTitle && res.tripYear) { 
      if(headerTripName) {
          headerTripName.textContent = `${res.tripTitle} ${res.tripYear}`; 
          headerTripName.classList.remove('hidden-force'); 
      }
  } else { 
      if(headerTripName) headerTripName.classList.add('hidden-force'); 
  } 
  
  applyAdminVisuals(); 
  showToast(newState ? "Registration Opened" : "Registration Closed"); 
} catch(e) { 
  showToast("Failed.", true); 
  applyAdminVisuals(); 
} finally { 
  setBtnLoading(mainBtn, false); 
  if(sourceBtn && sourceBtn !== mainBtn) setBtnLoading(sourceBtn, false); 
}
}

async function toggleEditSlider(btn) {
if(btn.disabled) return; const sliderLoader = document.getElementById('editSliderLoader'); const newState = !appSettings.allowEdits; btn.disabled = true; sliderLoader.classList.remove('hidden-force');
try { await callBackend('toggleEdits', { status: newState }); appSettings.allowEdits = newState; applyAdminVisuals(); showToast(newState ? "Edits Enabled" : "Edits Locked"); } catch(e) { showToast("Failed to update.", true); applyAdminVisuals(); } finally { btn.disabled = false; sliderLoader.classList.add('hidden-force'); }
}

async function addProjectGroup(btn) {
const name = document.getElementById('newGroupName').value.trim(); if(!name) return showToast("Project name required", true); setBtnLoading(btn, true);
try { if(!newProjectSelectedColor) newProjectSelectedColor = getUnusedColor(); const res = await callBackend('addProjectGroup', { groupName: name, callerNric: currentUser.nric, colorClass: newProjectSelectedColor }); document.getElementById('newGroupName').value = ''; newProjectSelectedColor = null; document.getElementById('newGroupColorBtn').className = "w-8 h-8 shrink-0 rounded-full border border-gray-300 dark:border-gray-600 shadow-sm transition hover:scale-105 bg-white dark:bg-gray-800 self-center"; appSettings.projectGroups = res.groups; appSettings.projectColors = res.projectColors; renderGroupList(res.groups); renderHeaderLegend(); showToast("Project Added"); } catch(e) { showToast(e.message, true); } finally { setBtnLoading(btn, false); }
}
async function removeProjectGroup(name, btn) { setBtnLoading(btn, true); try { const res = await callBackend('removeProjectGroup', { groupName: name, callerNric: currentUser.nric }); appSettings.projectGroups = res.groups; appSettings.projectColors = res.projectColors; renderGroupList(res.groups); renderHeaderLegend(); showToast("Project Removed"); } catch(e) { showToast(e.message, true); } finally { setBtnLoading(btn, false); } }
function renderGroupList(list) {
const ul = document.getElementById('groupList'); if(!ul) return; ul.innerHTML = (!list || list.length === 0) ? '<li class="text-[10px] font-bold text-gray-500 dark:text-gray-400 px-1">No projects defined yet.</li>' : '';
if(list) list.forEach(g => { const safeGroup = g.replace(/'/g, "\\'"); const dynColor = getProjectColor(g); ul.innerHTML += `<li class="flex justify-between items-center bg-gray-50/50 dark:bg-gray-950/50 p-2 md:p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm"><div class="flex items-center space-x-2.5"><button onclick="openColorPicker('${safeGroup}')" class="w-5 h-5 rounded-full border cursor-pointer shadow-sm ${dynColor}" title="Change Color"></button><span class="font-bold text-xs text-gray-900 dark:text-white">${g}</span></div><button onclick="removeProjectGroup('${safeGroup}', this)" class="text-red-600 dark:text-red-400 text-[10px] md:text-xs font-bold px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded flex items-center hover:bg-red-50 dark:hover:bg-gray-700 transition focus:outline-none shadow-sm shrink-0"><span class="btn-text">Remove</span><div class="btn-spinner spinner-red hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button></li>`; });
}

// Drive Access Management functions
function parseEmails(rawString) {
if(!rawString) return [];
// Split by comma or newline, then trim and filter empty
return rawString.split(/[\n,]+/).map(e => e.trim()).filter(e => e.length > 0);
}

async function massAddDriveAccessBtn(btn) {
const rawEmails = document.getElementById('newDriveEmails').value;
const emails = parseEmails(rawEmails);
const role = document.getElementById('newDriveRole').value;

if(emails.length === 0) return showToast("Enter at least one email", true);

setBtnLoading(btn, true);
try {
  const res = await callBackend('massDriveAccess', { actionType: 'add', emails: emails, role: role });
  appSettings.driveAccessList = res.driveAccessList;
  document.getElementById('newDriveEmails').value = '';
  renderDriveAccessList(res.driveAccessList);
  
  if(res.results.failed.length > 0) {
    showToast(`Added ${res.results.success.length}. Failed: ${res.results.failed.length}. Check console.`, true);
    console.error("Drive Access Add Failures:", res.results.failed);
  } else {
    showToast(`Granted ${role} access to ${emails.length} user(s)`);
  }
} catch(e) {
  showToast(e.message, true);
} finally {
  setBtnLoading(btn, false);
}
}

async function massRemoveDriveAccessBtn(btn) {
const emails = Object.keys(appSettings.driveAccessList || {});
if(emails.length === 0) return showToast("No users to remove.", true);

if(!confirm(`Are you sure you want to revoke access for ALL ${emails.length} users?`)) return;

setBtnLoading(btn, true);
try {
  const res = await callBackend('massDriveAccess', { actionType: 'remove', emails: emails });
  appSettings.driveAccessList = res.driveAccessList;
  renderDriveAccessList(res.driveAccessList);
  
  if(res.results.failed.length > 0) {
    showToast(`Removed ${res.results.success.length}. Failed: ${res.results.failed.length}.`, true);
  } else {
    showToast(`Removed access for all users.`);
  }
} catch(e) {
  showToast(e.message, true);
} finally {
  setBtnLoading(btn, false);
}
}

async function removeDriveAccessBtn(email, btn) {
setBtnLoading(btn, true);
try {
 const res = await callBackend('removeDriveAccess', { email });
 appSettings.driveAccessList = res.driveAccessList;
 renderDriveAccessList(res.driveAccessList);
 showToast(`Removed access for ${email}`);
} catch(e) {
 showToast(e.message, true);
} finally {
 setBtnLoading(btn, false);
}
}

function renderDriveAccessList(listObj) {
const ul = document.getElementById('driveAccessList');
if(!ul) return;
const emails = Object.keys(listObj || {});
ul.innerHTML = (emails.length === 0) ? '<li class="text-[10px] font-bold text-gray-500 dark:text-gray-400 px-1">No external access granted via app yet.</li>' : '';

emails.forEach(email => {
const role = listObj[email];
const badgeClass = role === 'editor' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
ul.innerHTML += `<li class="flex justify-between items-center bg-gray-50/50 dark:bg-gray-950/50 p-2 md:p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden gap-2">
 <div class="flex items-center min-w-0">
   <span class="font-bold text-xs text-gray-900 dark:text-white truncate" title="${email}">${email}</span>
   <span class="ml-2 text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${badgeClass} shrink-0">${role}</span>
 </div>
 <button onclick="removeDriveAccessBtn('${email}', this)" class="text-red-600 dark:text-red-400 text-[10px] md:text-xs font-bold px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded flex items-center hover:bg-red-50 dark:hover:bg-gray-700 transition focus:outline-none shadow-sm shrink-0"><span class="btn-text">Remove</span><div class="btn-spinner spinner-red hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
</li>`;
});
}

async function addJuncture(btn) { const name = document.getElementById('newJunctureName').value.trim(); if(!name) return showToast("Required", true); setBtnLoading(btn, true); try { const res = await callBackend('modifyJunctures', { actionType: 'add', newName: name }); document.getElementById('newJunctureName').value = ''; appSettings.junctures = res.junctures; renderJunctureList(res.junctures); showToast("Added"); } catch(e) { showToast(e.message, true); } finally { setBtnLoading(btn, false); } }
async function removeJuncture(name, btn) { setBtnLoading(btn, true); try { const res = await callBackend('modifyJunctures', { actionType: 'remove', oldName: name }); appSettings.junctures = res.junctures; renderJunctureList(res.junctures); showToast("Removed"); } catch(e) { showToast(e.message, true); } finally { setBtnLoading(btn, false); } }
async function editJuncture(oldName) { const newName = prompt(`Edit Juncture Name:`, oldName); if(!newName || newName.trim() === '' || newName.trim() === oldName) return; try { const res = await callBackend('modifyJunctures', { actionType: 'edit', oldName: oldName, newName: newName.trim() }); appSettings.junctures = res.junctures; renderJunctureList(res.junctures); showToast("Updated"); } catch(e) { showToast(e.message, true); } }
function renderJunctureList(list) { const ul = document.getElementById('junctureList'); if(!ul) return; ul.innerHTML = (!list || list.length === 0) ? '<li class="text-[10px] font-bold text-gray-500 dark:text-gray-400 px-1">No junctures defined yet.</li>' : ''; if(list) list.forEach(j => { const safeName = j.replace(/'/g, "\\'"); ul.innerHTML += `<li class="flex justify-between items-center bg-gray-50/50 dark:bg-gray-950/50 p-2 md:p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm"><span class="font-bold text-xs text-gray-900 dark:text-white truncate mr-2">${j}</span><div class="flex space-x-1.5 shrink-0"><button onclick="editJuncture('${safeName}')" class="text-blue-600 dark:text-blue-400 text-[10px] md:text-xs font-bold px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm focus:outline-none hover:bg-blue-50 dark:hover:bg-gray-700">Edit</button><button onclick="removeJuncture('${safeName}', this)" class="text-red-600 dark:text-red-400 text-[10px] md:text-xs font-bold px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm flex items-center hover:bg-red-50 dark:hover:bg-gray-700 transition focus:outline-none"><span class="btn-text">Remove</span><div class="btn-spinner spinner-red hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button></div></li>`; }); const attSel = document.getElementById('attendanceJunctureSelect'); if(attSel) { attSel.innerHTML = ''; if(list) list.forEach(j => attSel.innerHTML += `<option value="${j}">${j}</option>`); } }

async function addCommittee(btn) { const name = document.getElementById('newCommName').value.trim(); const nric = document.getElementById('newCommNric').value.trim(); const phone = document.getElementById('newCommPhone').value.trim(); if(!nric || !name || !phone) return showToast("Name, NRIC, Phone required", true); setBtnLoading(btn, true); try { const res = await callBackend('addCommittee', { nric, name, phone }); document.getElementById('newCommName').value = ''; document.getElementById('newCommNric').value = ''; document.getElementById('newCommPhone').value = ''; appSettings.committee = res.list; renderCommList(res.list); showToast("Added"); } catch(e) { showToast(e.message, true); } finally { setBtnLoading(btn, false); } }
async function removeCommittee(nric, btn) { setBtnLoading(btn, true); try { const res = await callBackend('removeCommittee', { nric }); appSettings.committee = res.list; renderCommList(res.list); showToast("Removed"); } catch(e) { showToast(e.message, true); } finally { setBtnLoading(btn, false); } }
function renderCommList(list) { const ul = document.getElementById('commList'); if(!ul) return; ul.innerHTML = (!list || list.length === 0) ? '<li class="text-[10px] font-bold text-gray-500 dark:text-gray-400 px-1">No committee members assigned yet.</li>' : ''; if(list) list.forEach(m => { ul.innerHTML += `<li class="flex justify-between items-center bg-gray-50/50 dark:bg-gray-950/50 p-2 md:p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm"><div class="min-w-0 pr-2"><p class="font-bold text-xs text-gray-900 dark:text-white truncate">${m.name}</p><p class="text-[9px] text-gray-500 dark:text-gray-400 font-mono font-bold mt-0.5">${m.nric} | ${m.phone}</p></div><button onclick="removeCommittee('${m.nric}', this)" class="text-red-600 dark:text-red-400 text-[10px] md:text-xs font-bold px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded flex items-center hover:bg-red-50 dark:hover:bg-gray-700 transition focus:outline-none shadow-sm shrink-0"><span class="btn-text">Remove</span><div class="btn-spinner spinner-red hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button></li>`; }); }

async function archiveSystem(btn) { if(!confirm("⚠️ ARE YOU SURE?\n\nThis archives the database and completely resets the system.")) return; showToast("Archiving...", false); setBtnLoading(btn, true); try { await callBackend('archiveAndReset'); showToast("Reset successful!"); setTimeout(() => { window.location.reload(); }, 2000); } catch (e) { showToast(e.message, true); setBtnLoading(btn, false); } }