// ==========================================
// settings.js - Admin Settings Panel
// ==========================================
// [CONSIDERATION - SPA to MPA Migration]: Utilizes AppCore for backend calls.

function applyAdminVisuals() {
    const rBtn = document.getElementById('toggleRegBtn'); 
    if(rBtn) { 
        if(AppCore.appSettings?.registrationOpen) { 
            rBtn.innerHTML = `<span class="btn-text">OPEN (Click to Close)</span><div class="btn-spinner spinner-white hidden-force ml-2 !w-3 !h-3 border-2"></div>`; 
            rBtn.className = "w-full px-3 py-2 text-xs md:text-sm bg-green-600 text-white font-bold rounded-lg shadow-sm border border-green-700 transition flex justify-center items-center transform active:scale-95"; 
        } else { 
            rBtn.innerHTML = `<span class="btn-text">CLOSED (Click to Open)</span><div class="btn-spinner spinner-white hidden-force ml-2 !w-3 !h-3 border-2"></div>`; 
            rBtn.className = "w-full px-3 py-2 text-xs md:text-sm bg-red-500 text-white font-bold rounded-lg shadow-sm border border-red-600 transition flex justify-center items-center transform active:scale-95"; 
        } 
    }
    
    const sliderBtn = document.getElementById('editSliderToggle'); 
    const sliderKnob = document.getElementById('editSliderKnob'); 
    const statusText = document.getElementById('editStatusText');
    if (sliderBtn && sliderKnob && statusText) { 
        if(AppCore.appSettings?.allowEdits) { 
            sliderBtn.className = "relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-300 focus:outline-none bg-green-500 shadow-inner shrink-0"; 
            sliderKnob.className = "inline-flex w-4 h-4 transform translate-x-6 bg-white rounded-full transition-transform duration-300 shadow items-center justify-center"; 
            statusText.textContent = "Yes"; 
            statusText.className = "font-black text-xs text-green-600 dark:text-green-400 transition-colors"; 
        } else { 
            sliderBtn.className = "relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-300 focus:outline-none bg-zinc-300 dark:bg-zinc-600 shadow-inner shrink-0"; 
            sliderKnob.className = "inline-flex w-4 h-4 transform translate-x-1 bg-white rounded-full transition-transform duration-300 shadow items-center justify-center"; 
            statusText.textContent = "No"; 
            statusText.className = "font-black text-xs text-zinc-500 dark:text-zinc-400 transition-colors"; 
        } 
    }
}

function buildSettingsUI() {
    const isMainAdmin = AppCore.currentUser?.nric === 'ADMIN';
    const sRules = AppCore.appSettings?.sortingRules || ['project', 'family', 'role', 'name'];
    
    document.getElementById('tab-settings').innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
     <div class="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 lg:col-span-1">
      <h3 class="text-sm font-black text-zinc-900 dark:text-white mb-0.5 tracking-tight">Registration Form</h3>
      <p class="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-3">Allow new participants to sign up.</p>
      <button id="toggleRegBtn" onclick="initiateRegistrationToggle(this)" class="w-full px-3 py-2 text-xs bg-green-600 text-white font-bold rounded-lg shadow-sm border border-green-700 flex justify-center items-center"><span class="btn-text">Loading...</span><div class="btn-spinner spinner-white hidden-force ml-2 !w-3 !h-3 border-2"></div></button>
     </div>

     <div class="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 lg:col-span-1">
      <h3 class="text-sm font-black text-zinc-900 dark:text-white mb-0.5 tracking-tight">Participant Editing</h3>
      <p class="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-3">Can users edit their details?</p>
      <div class="flex items-center space-x-2.5 mt-1 border border-zinc-100 dark:border-zinc-800 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
        <button id="editSliderToggle" onclick="toggleEditSlider(this)" class="relative inline-flex items-center h-6 w-11 rounded-full bg-zinc-300 shadow-inner focus:outline-none shrink-0">
          <span id="editSliderKnob" class="inline-flex w-4 h-4 transform translate-x-1 bg-white rounded-full shadow items-center justify-center"><div id="editSliderLoader" class="loader hidden-force !border-[2px] !w-2.5 !h-2.5 border-t-primary"></div></span>
        </button>
        <span id="editStatusText" class="font-black text-xs text-zinc-500 dark:text-zinc-400">No</span>
      </div>
     </div>

     <div class="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 lg:col-span-1">
      <h3 class="text-sm font-black text-zinc-900 dark:text-white mb-0.5 tracking-tight">Trip Dates Configuration</h3>
      <p class="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-2">Used for passport validity checks.</p>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label class="block text-[9px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider mb-1">Start Date</label>
          <input type="date" id="tripStartDate" value="${AppCore.appSettings?.tripStartDate || ''}" class="w-full p-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md text-[11px] font-semibold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]">
        </div>
        <div>
          <label class="block text-[9px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider mb-1">End Date</label>
          <input type="date" id="tripEndDate" value="${AppCore.appSettings?.tripEndDate || ''}" class="w-full p-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md text-[11px] font-semibold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]">
        </div>
      </div>
      <button onclick="saveTripConfiguration(this)" class="w-full px-2 py-1.5 text-[11px] bg-primary text-white font-bold rounded-md shadow-sm transition flex justify-center items-center hover:bg-blue-600 focus:outline-none"><span class="btn-text">Save Dates</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
     </div>
    </div>

    <div class="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <h3 class="text-sm font-black text-zinc-900 dark:text-white mb-0.5 tracking-tight">Global Sorting Priorities</h3>
        <p class="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-3">Stacking rules applied to all lists across the App.</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
         ${[1,2,3,4].map((i) => `
         <div>
           <label class="block text-[9px] uppercase font-bold mb-1 text-zinc-500 dark:text-zinc-400 tracking-wider">Priority ${i}</label>
           <select id="sortRule${i}" class="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-[11px] md:text-xs font-bold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
             <option value="none" ${sRules[i-1]==='none'?'selected':''}>None</option>
             <option value="project" ${sRules[i-1]==='project'?'selected':''}>Project</option>
             <option value="family" ${sRules[i-1]==='family'?'selected':''}>Family / Indep</option>
             <option value="role" ${sRules[i-1]==='role'?'selected':''}>Role (Trainee/Vol)</option>
             <option value="name" ${sRules[i-1]==='name'?'selected':''}>Name (A-Z)</option>
           </select>
         </div>`).join('')}
        </div>
        <button onclick="saveSortingSettings(this)" class="w-full md:w-auto bg-primary text-white px-4 py-2 text-xs rounded-lg font-bold flex items-center justify-center shadow-sm transform active:scale-95"><span class="btn-text">Save Sort Order</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
    </div>

    <div class="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <h3 class="text-sm font-black text-zinc-900 dark:text-white mb-1 tracking-tight">Attendance Junctures</h3>
        <div class="flex space-x-2 mb-3 mt-2">
            <input type="text" id="newJunctureName" placeholder="e.g. Day 1: Dinner" class="flex-grow p-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
            <button onclick="addJuncture(this)" class="bg-primary text-white px-3 py-2 text-xs rounded-md font-bold flex items-center shadow-sm shrink-0 transform active:scale-95"><span class="btn-text">Add</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
        </div>
        <ul id="junctureList" class="space-y-1.5"></ul>
    </div>

    <div class="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 ${isMainAdmin ? '' : 'hidden-force'}">
        <h3 class="text-sm font-black text-zinc-900 dark:text-white mb-1 tracking-tight">Projects</h3>
        <div class="flex space-x-2 mb-3 mt-2">
            <input type="text" id="newGroupName" placeholder="e.g. Project A" class="flex-grow p-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
            <button onclick="openColorPickerForNewProject()" class="w-8 h-8 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600 shadow-sm transition hover:scale-105 bg-white dark:bg-zinc-800 self-center" id="newGroupColorBtn" title="Pick a color"></button>
            <button onclick="addProjectGroup(this)" class="bg-primary text-white px-3 py-2 text-xs rounded-md font-bold flex items-center shadow-sm shrink-0 transform active:scale-95"><span class="btn-text">Add</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
        </div>
        <ul id="groupList" class="space-y-1.5"></ul>
    </div>

    <div class="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <h3 class="text-sm font-black text-zinc-900 dark:text-white mb-1 tracking-tight">Committee Members</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 mt-2">
            <input type="text" id="newCommName" placeholder="Full Name" class="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
            <input type="text" id="newCommNric" placeholder="NRIC/FIN" class="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded-md uppercase text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
            <div class="flex space-x-2">
              <input type="tel" id="newCommPhone" placeholder="Phone" pattern="[0-9]{8}" class="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">
              <button onclick="addCommittee(this)" class="bg-primary text-white px-3 py-2 text-xs rounded-md font-bold flex items-center shadow-sm shrink-0 transform active:scale-95"><span class="btn-text">Add</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
            </div>
        </div>
        <ul id="commList" class="space-y-1.5"></ul>
    </div>

    <div class="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 ${isMainAdmin ? '' : 'hidden-force'}">
        <div class="flex justify-between items-center mb-0.5">
            <h3 class="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Drive Access Management</h3>
            <button onclick="massRemoveDriveAccessBtn(this)" class="text-[10px] md:text-xs text-red-600 dark:text-red-400 font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 shadow-sm hover:bg-red-50 dark:hover:bg-zinc-700 transition flex items-center focus:outline-none shrink-0 transform active:scale-95"><span class="btn-text">Remove All</span><div class="btn-spinner spinner-red hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
        </div>
        <p class="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 mb-3 leading-tight">Grant specific users access to the underlying Google Drive trip folder. You can paste multiple emails separated by commas or newlines.</p>

        <div class="flex flex-col space-y-2 mb-3 mt-2">
            <textarea id="newDriveEmails" rows="2" placeholder="Google Account Emails (comma or newline separated)" class="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm resize-y"></textarea>
            <div class="flex flex-col md:flex-row gap-3 justify-between items-center w-full mt-1">
                <div class="flex items-center gap-2 w-full md:w-auto flex-1">
                    <label class="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider whitespace-nowrap">Access Role:</label>
                    <select id="newDriveRole" class="p-2 w-full md:w-48 border-2 border-primary/60 dark:border-primary/50 rounded-md text-xs font-extrabold bg-blue-50/50 dark:bg-blue-900/30 text-primary dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm cursor-pointer transition">
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                    </select>
                </div>
                <button onclick="massAddDriveAccessBtn(this)" class="bg-primary text-white px-6 py-2.5 text-xs rounded-md font-bold flex items-center justify-center shadow-sm w-full md:w-auto shrink-0 hover:bg-blue-600 transition transform active:scale-95"><span class="btn-text">Add</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
            </div>
        </div>
        <ul id="driveAccessList" class="space-y-1.5"></ul>
    </div>

    <div class="bg-red-50/50 dark:bg-red-900/10 p-3 md:p-4 rounded-xl shadow-sm border border-red-200 dark:border-red-900 ${isMainAdmin ? '' : 'hidden-force'}">
        <h3 class="text-sm font-black mb-0.5 text-red-700 dark:text-red-400 tracking-tight">Danger Zone</h3>
        <p class="text-[10px] font-bold text-red-600/80 dark:text-red-400 mb-3">Archive current trip to Google Drive and wipe system for a fresh start.</p>
        <button onclick="archiveSystem(this)" class="w-full sm:w-auto bg-red-600 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm hover:bg-red-700 focus:outline-none flex items-center justify-center transform active:scale-95"><span class="btn-text">Archive & Reset</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
    </div>
    `;

    applyAdminVisuals();
    renderJunctureList(AppCore.appSettings?.junctures);
    if(isMainAdmin) {
        renderGroupList(AppCore.appSettings?.projectGroups);
        renderDriveAccessList(AppCore.appSettings?.driveAccessList);
    }
    renderCommList(AppCore.appSettings?.committee);
}

function setBtnLoadingSet(btn, isLoading) {
    if (!btn) return; 
    const spinner = btn.querySelector('.btn-spinner');
    const text = btn.querySelector('.btn-text');
    if (isLoading) { 
        btn.disabled = true; btn.classList.add('opacity-80', 'cursor-not-allowed'); 
        if (spinner) spinner.classList.remove('hidden-force'); 
        if (text) text.classList.add('opacity-0'); 
    } else { 
        btn.disabled = false; btn.classList.remove('opacity-80', 'cursor-not-allowed'); 
        if (spinner) spinner.classList.add('hidden-force'); 
        if (text) text.classList.remove('opacity-0');
    }
}

async function saveTripConfiguration(btn) {
    setBtnLoadingSet(btn, true);
    const sDate = document.getElementById('tripStartDate').value;
    const eDate = document.getElementById('tripEndDate').value;
    try {
        const res = await AppCore.apiFetch('saveTripSettings', { title: AppCore.appSettings.tripTitle, year: AppCore.appSettings.tripYear, start: sDate, end: eDate });
        AppCore.appSettings.tripStartDate = res.start;
        AppCore.appSettings.tripEndDate = res.end;
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        AppCore.showToast("Trip dates saved successfully.");
    } catch(e) {
        AppCore.showToast(e.message, true);
    } finally {
        setBtnLoadingSet(btn, false);
    }
}

async function saveSortingSettings(btn) {
    setBtnLoadingSet(btn, true);
    const rules = [
        document.getElementById('sortRule1').value, document.getElementById('sortRule2').value,
        document.getElementById('sortRule3').value, document.getElementById('sortRule4').value
    ];
    try {
        const res = await AppCore.apiFetch('saveSortingRules', { rules: rules, callerNric: AppCore.currentUser.nric });
        AppCore.appSettings.sortingRules = res.sortingRules;
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        AppCore.showToast("Sorting Rules updated.");
    } catch(e) { AppCore.showToast(e.message, true); } 
    finally { setBtnLoadingSet(btn, false); }
}

function initiateRegistrationToggle(btn) { 
    if(!AppCore.appSettings?.registrationOpen) { 
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
    const mainBtn = document.getElementById('toggleRegBtn'); 
    setBtnLoadingSet(mainBtn, true); 
    if(sourceBtn && sourceBtn !== mainBtn) setBtnLoadingSet(sourceBtn, true);
    try { 
        const res = await AppCore.apiFetch('toggleRegistration', { status: newState, tripTitle: title, tripYear: year, tripStart: start, tripEnd: end }); 
        AppCore.appSettings.registrationOpen = newState; 
        if(start) AppCore.appSettings.tripStartDate = start;
        if(end) AppCore.appSettings.tripEndDate = end;
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        applyAdminVisuals(); 
        AppCore.showToast(newState ? "Registration Opened" : "Registration Closed"); 
    } catch(e) { AppCore.showToast("Failed.", true); applyAdminVisuals(); } 
    finally { setBtnLoadingSet(mainBtn, false); if(sourceBtn && sourceBtn !== mainBtn) setBtnLoadingSet(sourceBtn, false); }
}

async function toggleEditSlider(btn) {
    if(btn.disabled) return; 
    const sliderLoader = document.getElementById('editSliderLoader'); 
    const newState = !AppCore.appSettings.allowEdits; 
    btn.disabled = true; sliderLoader.classList.remove('hidden-force');
    try { 
        await AppCore.apiFetch('toggleEdits', { status: newState }); 
        AppCore.appSettings.allowEdits = newState; 
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        applyAdminVisuals(); 
        AppCore.showToast(newState ? "Edits Enabled" : "Edits Locked"); 
    } catch(e) { AppCore.showToast("Failed to update.", true); applyAdminVisuals(); } 
    finally { btn.disabled = false; sliderLoader.classList.add('hidden-force'); }
}

async function addProjectGroup(btn) {
    const name = document.getElementById('newGroupName').value.trim(); 
    if(!name) return AppCore.showToast("Project name required", true); 
    setBtnLoadingSet(btn, true);
    try { 
        if(!window.newProjectSelectedColor) window.newProjectSelectedColor = typeof getUnusedColor === 'function' ? getUnusedColor() : 'bg-zinc-100'; 
        const res = await AppCore.apiFetch('addProjectGroup', { groupName: name, callerNric: AppCore.currentUser.nric, colorClass: window.newProjectSelectedColor }); 
        document.getElementById('newGroupName').value = ''; 
        window.newProjectSelectedColor = null; 
        document.getElementById('newGroupColorBtn').className = "w-8 h-8 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600 shadow-sm transition hover:scale-105 bg-white dark:bg-zinc-800 self-center"; 
        AppCore.appSettings.projectGroups = res.groups; 
        AppCore.appSettings.projectColors = res.projectColors; 
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        renderGroupList(res.groups); 
        AppCore.showToast("Project Added"); 
    } catch(e) { AppCore.showToast(e.message, true); } 
    finally { setBtnLoadingSet(btn, false); }
}
async function removeProjectGroup(name, btn) { 
    setBtnLoadingSet(btn, true); 
    try { 
        const res = await AppCore.apiFetch('removeProjectGroup', { groupName: name, callerNric: AppCore.currentUser.nric }); 
        AppCore.appSettings.projectGroups = res.groups; 
        AppCore.appSettings.projectColors = res.projectColors; 
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        renderGroupList(res.groups); 
        AppCore.showToast("Project Removed"); 
    } catch(e) { AppCore.showToast(e.message, true); } 
    finally { setBtnLoadingSet(btn, false); } 
}
function renderGroupList(list) {
    const ul = document.getElementById('groupList'); if(!ul) return; 
    ul.innerHTML = (!list || list.length === 0) ? '<li class="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 px-1">No projects defined yet.</li>' : '';
    if(list) list.forEach(g => { 
        const safeGroup = g.replace(/'/g, "\\'"); 
        const dynColor = typeof getProjectColor === 'function' ? getProjectColor(g) : 'bg-zinc-100'; 
        ul.innerHTML += `<li class="flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50 p-2 md:p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm"><div class="flex items-center space-x-2.5"><button onclick="openColorPicker('${safeGroup}')" class="w-5 h-5 rounded-full border cursor-pointer shadow-sm ${dynColor}" title="Change Color"></button><span class="font-bold text-xs text-zinc-900 dark:text-white">${g}</span></div><button onclick="removeProjectGroup('${safeGroup}', this)" class="text-red-600 dark:text-red-400 text-[10px] md:text-xs font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded flex items-center hover:bg-red-50 dark:hover:bg-zinc-700 transition focus:outline-none shadow-sm shrink-0 transform active:scale-95"><span class="btn-text">Remove</span><div class="btn-spinner spinner-red hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button></li>`; 
    });
}

function parseEmails(rawString) {
    if(!rawString) return [];
    return rawString.split(/[\n,]+/).map(e => e.trim()).filter(e => e.length > 0);
}
async function massAddDriveAccessBtn(btn) {
    const rawEmails = document.getElementById('newDriveEmails').value;
    const emails = parseEmails(rawEmails);
    const role = document.getElementById('newDriveRole').value;
    if(emails.length === 0) return AppCore.showToast("Enter at least one email", true);
    setBtnLoadingSet(btn, true);
    try {
        const res = await AppCore.apiFetch('massDriveAccess', { actionType: 'add', emails: emails, role: role });
        AppCore.appSettings.driveAccessList = res.driveAccessList;
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        document.getElementById('newDriveEmails').value = '';
        renderDriveAccessList(res.driveAccessList);
        if(res.results.failed.length > 0) AppCore.showToast(`Added ${res.results.success.length}. Failed: ${res.results.failed.length}.`, true);
        else AppCore.showToast(`Granted ${role} access to ${emails.length} user(s)`);
    } catch(e) { AppCore.showToast(e.message, true); } 
    finally { setBtnLoadingSet(btn, false); }
}
async function massRemoveDriveAccessBtn(btn) {
    const emails = Object.keys(AppCore.appSettings.driveAccessList || {});
    if(emails.length === 0) return AppCore.showToast("No users to remove.", true);
    if(!confirm(`Are you sure you want to revoke access for ALL ${emails.length} users?`)) return;
    setBtnLoadingSet(btn, true);
    try {
        const res = await AppCore.apiFetch('massDriveAccess', { actionType: 'remove', emails: emails });
        AppCore.appSettings.driveAccessList = res.driveAccessList;
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        renderDriveAccessList(res.driveAccessList);
        AppCore.showToast(`Removed access for all users.`);
    } catch(e) { AppCore.showToast(e.message, true); } 
    finally { setBtnLoadingSet(btn, false); }
}
async function removeDriveAccessBtn(email, btn) {
    setBtnLoadingSet(btn, true);
    try {
        const res = await AppCore.apiFetch('removeDriveAccess', { email });
        AppCore.appSettings.driveAccessList = res.driveAccessList;
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        renderDriveAccessList(res.driveAccessList);
        AppCore.showToast(`Removed access for ${email}`);
    } catch(e) { AppCore.showToast(e.message, true); } 
    finally { setBtnLoadingSet(btn, false); }
}
function renderDriveAccessList(listObj) {
    const ul = document.getElementById('driveAccessList'); if(!ul) return;
    const emails = Object.keys(listObj || {});
    ul.innerHTML = (emails.length === 0) ? '<li class="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 px-1">No external access granted via app yet.</li>' : '';
    emails.forEach(email => {
        const role = listObj[email];
        const badgeClass = role === 'editor' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
        ul.innerHTML += `<li class="flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50 p-2 md:p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden gap-2"><div class="flex items-center min-w-0"><span class="font-bold text-xs text-zinc-900 dark:text-white truncate" title="${email}">${email}</span><span class="ml-2 text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${badgeClass} shrink-0">${role}</span></div><button onclick="removeDriveAccessBtn('${email}', this)" class="text-red-600 dark:text-red-400 text-[10px] md:text-xs font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded flex items-center hover:bg-red-50 dark:hover:bg-zinc-700 transition focus:outline-none shadow-sm shrink-0 transform active:scale-95"><span class="btn-text">Remove</span><div class="btn-spinner spinner-red hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button></li>`;
    });
}

async function addJuncture(btn) { 
    const name = document.getElementById('newJunctureName').value.trim(); 
    if(!name) return AppCore.showToast("Required", true); 
    setBtnLoadingSet(btn, true); 
    try { 
        const res = await AppCore.apiFetch('modifyJunctures', { actionType: 'add', newName: name }); 
        document.getElementById('newJunctureName').value = ''; 
        AppCore.appSettings.junctures = res.junctures; 
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        renderJunctureList(res.junctures); 
        AppCore.showToast("Added"); 
    } catch(e) { AppCore.showToast(e.message, true); } 
    finally { setBtnLoadingSet(btn, false); } 
}
async function removeJuncture(name, btn) { 
    setBtnLoadingSet(btn, true); 
    try { 
        const res = await AppCore.apiFetch('modifyJunctures', { actionType: 'remove', oldName: name }); 
        AppCore.appSettings.junctures = res.junctures; 
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        renderJunctureList(res.junctures); 
        AppCore.showToast("Removed"); 
    } catch(e) { AppCore.showToast(e.message, true); } 
    finally { setBtnLoadingSet(btn, false); } 
}
async function editJuncture(oldName) { 
    const newName = prompt(`Edit Juncture Name:`, oldName); 
    if(!newName || newName.trim() === '' || newName.trim() === oldName) return; 
    try { 
        const res = await AppCore.apiFetch('modifyJunctures', { actionType: 'edit', oldName: oldName, newName: newName.trim() }); 
        AppCore.appSettings.junctures = res.junctures; 
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        renderJunctureList(res.junctures); 
        AppCore.showToast("Updated"); 
    } catch(e) { AppCore.showToast(e.message, true); } 
}
function renderJunctureList(list) { 
    const ul = document.getElementById('junctureList'); if(!ul) return; 
    ul.innerHTML = (!list || list.length === 0) ? '<li class="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 px-1">No junctures defined yet.</li>' : ''; 
    if(list) list.forEach(j => { 
        const safeName = j.replace(/'/g, "\\'"); 
        ul.innerHTML += `<li class="flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50 p-2 md:p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm"><span class="font-bold text-xs text-zinc-900 dark:text-white truncate mr-2">${j}</span><div class="flex space-x-1.5 shrink-0"><button onclick="editJuncture('${safeName}')" class="text-blue-600 dark:text-blue-400 text-[10px] md:text-xs font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded shadow-sm focus:outline-none hover:bg-blue-50 dark:hover:bg-zinc-700 transform active:scale-95">Edit</button><button onclick="removeJuncture('${safeName}', this)" class="text-red-600 dark:text-red-400 text-[10px] md:text-xs font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded shadow-sm flex items-center hover:bg-red-50 dark:hover:bg-zinc-700 transition focus:outline-none transform active:scale-95"><span class="btn-text">Remove</span><div class="btn-spinner spinner-red hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button></div></li>`; 
    }); 
}

async function addCommittee(btn) { 
    const name = document.getElementById('newCommName').value.trim(); 
    const nric = document.getElementById('newCommNric').value.trim(); 
    const phone = document.getElementById('newCommPhone').value.trim(); 
    if(!nric || !name || !phone) return AppCore.showToast("Name, NRIC, Phone required", true); 
    setBtnLoadingSet(btn, true); 
    try { 
        const res = await AppCore.apiFetch('addCommittee', { nric, name, phone }); 
        document.getElementById('newCommName').value = ''; document.getElementById('newCommNric').value = ''; document.getElementById('newCommPhone').value = ''; 
        AppCore.appSettings.committee = res.list; 
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        renderCommList(res.list); 
        AppCore.showToast("Added"); 
    } catch(e) { AppCore.showToast(e.message, true); } 
    finally { setBtnLoadingSet(btn, false); } 
}
async function removeCommittee(nric, btn) { 
    setBtnLoadingSet(btn, true); 
    try { 
        const res = await AppCore.apiFetch('removeCommittee', { nric }); 
        AppCore.appSettings.committee = res.list; 
        localStorage.setItem('appSettings', JSON.stringify(AppCore.appSettings));
        renderCommList(res.list); 
        AppCore.showToast("Removed"); 
    } catch(e) { AppCore.showToast(e.message, true); } 
    finally { setBtnLoadingSet(btn, false); } 
}
function renderCommList(list) { 
    const ul = document.getElementById('commList'); if(!ul) return; 
    ul.innerHTML = (!list || list.length === 0) ? '<li class="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 px-1">No committee members assigned yet.</li>' : ''; 
    if(list) list.forEach(m => { 
        ul.innerHTML += `<li class="flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50 p-2 md:p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm"><div class="min-w-0 pr-2"><p class="font-bold text-xs text-zinc-900 dark:text-white truncate">${m.name}</p><p class="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono font-bold mt-0.5">${m.nric} | ${m.phone}</p></div><button onclick="removeCommittee('${m.nric}', this)" class="text-red-600 dark:text-red-400 text-[10px] md:text-xs font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded flex items-center hover:bg-red-50 dark:hover:bg-zinc-700 transition focus:outline-none shadow-sm shrink-0 transform active:scale-95"><span class="btn-text">Remove</span><div class="btn-spinner spinner-red hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button></li>`; 
    }); 
}

async function archiveSystem(btn) { 
    if(!confirm("⚠️ ARE YOU SURE?\n\nThis archives the database and completely resets the system.")) return; 
    AppCore.showToast("Archiving...", false); 
    setBtnLoadingSet(btn, true); 
    try { 
        await AppCore.apiFetch('archiveAndReset'); 
        AppCore.showToast("Reset successful!"); 
        localStorage.clear();
        setTimeout(() => { window.location.href = './index.html'; }, 2000); 
    } catch (e) { 
        AppCore.showToast(e.message, true); 
        setBtnLoadingSet(btn, false); 
    } 
}