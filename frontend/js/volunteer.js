let currentActiveVols = [];
let currentVolPairedValue = [];
let originalVolData = {};

// MPA Specific Loader for Volunteer App to prevent pulling the massive comm.js bundle
function loadVolunteerEvents() {
   const selector = document.getElementById('volSheetSelector');
   const spinner = document.getElementById('volSheetSpinner');

   const renderData = (data) => {
       currentSheetList = data;
       if (selector) {
           selector.innerHTML = '';
           selector.disabled = false;
           data.forEach(item => {
               let opt = document.createElement('option');
               opt.value = item.sheetUrl;
               opt.text = item.displayName;
               selector.appendChild(opt);
           });
           
           const params = new URLSearchParams(window.location.search);
           const urlParam = params.get('url');
           
           if (urlParam && data.find(x => x.sheetUrl === urlParam)) {
               selector.value = urlParam;
           } else if (data.length > 0) {
               const closest = window.getClosestEventUrl ? window.getClosestEventUrl(data) : data[0].sheetUrl;
               if (closest) selector.value = closest;
               else selector.selectedIndex = 0;
           }
       }
       if (typeof resetVolForm === 'function') resetVolForm();
   };

   const localDataStr = localStorage.getItem('myg_sheetList');

   if (localDataStr) {
       try {
           const parsed = JSON.parse(localDataStr);
           if (parsed && parsed.length > 0) {
               renderData(parsed);
               if(spinner) spinner.classList.remove('hidden');
               apiCall('getRecentOutingSheets', null).then(res => {
                   if(spinner) spinner.classList.add('hidden');
                   if (res.success && JSON.stringify(res.data) !== localDataStr) {
                       localStorage.setItem('myg_sheetList', JSON.stringify(res.data));
                       renderData(res.data);
                   }
               });
               return;
           }
       } catch(e) {}
   }

   if (selector) {
       selector.innerHTML = '<option disabled selected>↻ Loading events...</option>';
       selector.disabled = true;
   }
   if(spinner) spinner.classList.remove('hidden');

   apiCall('getRecentOutingSheets', null).then(res => {
       if(spinner) spinner.classList.add('hidden');

       if (res.success) {
           localStorage.setItem('myg_sheetList', JSON.stringify(res.data));
           if(res.data.length > 0) {
               renderData(res.data);
           } else {
               if (selector) {
                   selector.disabled = false;
                   selector.innerHTML = '<option disabled selected>No upcoming events</option>';
               }
           }
       } else {
           if (selector) {
               selector.disabled = false;
               selector.innerHTML = `<option disabled selected>Error: ${res.message}</option>`;
           }
       }
   });
}

function autoScrollAndFocus(input) { toggleSearchList(true); setTimeout(() => { input.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300); }

function setVolType(type, btn) { 
selectedVolType = type; 
currentVolTypeRequest = type; 
allNames = []; 
document.getElementById('volNameList').innerHTML = ""; 
resetSearch(); 
document.querySelectorAll('.vol-type-btn').forEach(b => { 
 b.classList.remove('bg-green-600', 'text-white', 'border-transparent'); 
 b.classList.add('bg-gray-50', 'dark:bg-black', 'text-gray-700', 'dark:text-gray-300', 'border-gray-300', 'dark:border-zinc-700'); 
}); 
btn.classList.remove('bg-gray-50', 'dark:bg-black', 'text-gray-700', 'dark:text-gray-300', 'border-gray-300', 'dark:border-zinc-700'); 
btn.classList.add('bg-green-600', 'text-white', 'border-transparent'); 
document.getElementById('volNameSection').classList.remove('hidden'); 
document.getElementById('volFormContainer').classList.add('hidden'); 
if (type === 'volunteer') { 
 document.getElementById('addNewVolContainer').classList.remove('hidden'); 
} else { 
 document.getElementById('addNewVolContainer').classList.add('hidden'); 
} 
loadVolNames(type); 
}

function resetVolForm() { 
const volNameSection = document.getElementById('volNameSection');
if (!volNameSection) return;
volNameSection.classList.add('hidden'); 
document.getElementById('volFormContainer').classList.add('hidden'); 
document.getElementById('volSubmitBtn').innerText = "Update Attendance"; 
selectedVolType = null; 
currentVolTypeRequest = null; 
allNames = []; 
originalVolData = {};
document.querySelectorAll('.vol-type-btn').forEach(b => { 
 b.classList.remove('bg-green-600', 'text-white', 'border-transparent'); 
 b.classList.add('bg-gray-50', 'dark:bg-black', 'text-gray-700', 'dark:text-gray-300', 'border-gray-300', 'dark:border-zinc-700'); 
}); 
resetSearch(); 
}

function resetSearch() { 
const input = document.getElementById('volNameSearch'); 
if(!input) return;
input.value = ""; 
toggleSearchList(false); 
toggleClearBtn('volNameSearch');
}

function loadVolNames(requestedType) { 
const url = document.getElementById('volSheetSelector').value; 
const input = document.getElementById('volNameSearch'); 
const list = document.getElementById('volNameList');
if(!url || !requestedType || url === "Select an Event") return; 

input.placeholder = "Loading names..."; 
input.disabled = true; 

list.innerHTML = Array(5).fill('<li class="px-4 py-3 border-b border-gray-200 dark:border-zinc-700"><div class="animate-pulse h-4 bg-gray-200 dark:bg-zinc-700 rounded w-2/3"></div></li>').join('');
list.classList.remove('hidden');

apiCall('getNamesList', { url: url, type: requestedType }).then(res => { 
 if (currentVolTypeRequest !== requestedType) return; 
 input.disabled = false; 
 input.placeholder = "Type to search..."; 
 
 list.innerHTML = ""; 
 list.classList.add('hidden'); 
 
 if(res.success) allNames = res.names; 
}); 
}

function toggleSearchList(show) { 
const list = document.getElementById('volNameList'); 
if(!list) return;
if(show) { 
 list.classList.remove('hidden'); 
 if(document.getElementById('volNameSearch').value.length > 0) filterNames(); 
} else { 
 setTimeout(() => list.classList.add('hidden'), 200); 
} 
}

function clearSearch() { 
const searchEl = document.getElementById('volNameSearch');
if(searchEl) searchEl.value = ""; 
filterNames(); 
toggleClearBtn('volNameSearch');
const formEl = document.getElementById('volFormContainer');
if(formEl) formEl.classList.add('hidden'); 
}

function filterNames() { 
const input = document.getElementById('volNameSearch'); 
const filter = input.value.toLowerCase(); 
const list = document.getElementById('volNameList'); 
if(filter.length > 0) { 
 list.classList.remove('hidden'); 
} else { 
 list.classList.add('hidden'); 
 return; 
} 
list.innerHTML = ""; 
const matches = allNames.filter(n => n.toLowerCase().includes(filter)); 
matches.forEach(name => { 
 const li = document.createElement('li'); 
 li.className = "px-4 py-3 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-zinc-700 hover:bg-cyan-600 hover:text-white cursor-pointer text-sm transition-colors last:border-0"; 
 li.innerText = name; 
 li.onmousedown = () => selectName(name); 
 list.appendChild(li); 
}); 
if(matches.length === 0) { 
 const li = document.createElement('li'); 
 li.className = "px-4 py-3 text-sm text-gray-500 dark:text-gray-400 italic bg-white dark:bg-zinc-800"; 
 li.innerText = "No matches found."; 
 list.appendChild(li); 
} 
}

function selectName(name) { 
document.getElementById('volNameSearch').value = name; 
document.getElementById('volNameList').classList.add('hidden');
toggleClearBtn('volNameSearch'); 
loadVolData(name, false); 
}

function showAddNewForm() { 
const input = document.getElementById('volNameSearch'); 
input.value = "";
toggleClearBtn('volNameSearch'); 
document.getElementById('volNameList').classList.add('hidden'); 
loadVolData(null, true); 
}

function getValueFuzzy(dataObj, lookupKey) { 
if (!dataObj) return ""; 
if (dataObj[lookupKey] !== undefined) return dataObj[lookupKey]; 
const cleanLookup = lookupKey.toLowerCase().replace(/[^a-z0-9]/g, ""); 
for (let key in dataObj) { 
 const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, ""); 
 if (cleanKey === cleanLookup) return dataObj[key]; 
 if (cleanLookup.includes("caregiver") && cleanKey.includes("caregiver")) return dataObj[key]; 
} 
return ""; 
}

function toggleDependentFields(el) { 
const val = el.value; 
const deps = document.querySelectorAll('.attendance-dependent'); 
deps.forEach(d => { 
 if(val === 'N') d.classList.add('hidden'); 
 else d.classList.remove('hidden'); 
}); 
}

function toggleProjectList(show) { 
const list = document.getElementById('projectList'); 
if(show) { 
 list.classList.remove('hidden'); 
 filterProjects(); 
} else { 
 setTimeout(() => list.classList.add('hidden'), 200); 
} 
}

function filterProjects() { 
const input = document.getElementById('newVolProjectSearch'); 
const filter = input.value.toLowerCase(); 
const list = document.getElementById('projectList'); 
list.innerHTML = ""; 
const matches = allProjects.filter(p => p.toLowerCase().includes(filter)); 
matches.forEach(proj => { 
 const li = document.createElement('li'); 
 li.className = "px-4 py-3 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-zinc-700 hover:bg-cyan-600 hover:text-white cursor-pointer text-sm transition-colors last:border-0"; 
 li.innerText = proj; 
 li.onmousedown = () => selectProject(proj); 
 list.appendChild(li); 
}); 
if(matches.length === 0) { 
 const li = document.createElement('li'); 
 li.className = "px-4 py-3 text-sm text-gray-500 dark:text-gray-400 italic bg-white dark:bg-zinc-800"; 
 li.innerText = "No matches found."; 
 list.appendChild(li); 
} 
}

function selectProject(proj) { 
document.getElementById('newVolProjectSearch').value = proj; 
document.getElementById('projectList').classList.add('hidden'); 
toggleClearBtn('newVolProjectSearch');
}

function filterActiveVols() {
const input = document.getElementById('volPairedInput');
const list = document.getElementById('activeVolsList');
if(!input || !list) return;

const filter = input.value.toLowerCase().trim();
list.innerHTML = "";

if (filter.length === 0) {
  list.classList.add('hidden');
  return;
}

const matches = (currentActiveVols || []).filter(v => 
  v.toLowerCase().includes(filter) && !currentVolPairedValue.includes(v)
);

list.classList.remove('hidden');

matches.forEach(match => {
  const li = document.createElement('li');
  li.className = "px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-zinc-700 hover:bg-teal-600 hover:text-white cursor-pointer text-xs transition-colors last:border-0";
  li.innerText = match;
  li.onmousedown = (e) => { e.preventDefault(); addVolPaired(match); };
  list.appendChild(li);
});

if (matches.length === 0) {
  const li = document.createElement('li');
  li.className = "px-3 py-2 text-xs text-gray-500 dark:text-gray-400 italic bg-white dark:bg-zinc-800";
  li.innerText = `Press Enter to add "${input.value.trim()}"`;
  li.onmousedown = (e) => { e.preventDefault(); addVolPaired(input.value.trim()); };
  list.appendChild(li);
}
}

function addVolPaired(name) {
if (!name) return;
if (!currentVolPairedValue.includes(name)) {
  currentVolPairedValue.push(name);
  updateVolPairedUI();
}
const input = document.getElementById('volPairedInput');
input.value = "";
input.focus();
filterActiveVols(); 
}

function removeVolPaired(name) {
currentVolPairedValue = currentVolPairedValue.filter(v => v !== name);
updateVolPairedUI();
filterActiveVols();
}

function updateVolPairedUI() {
const tagsContainer = document.getElementById('volPairedTags');
const hiddenInput = document.getElementById('volPairedHidden');

if(!tagsContainer || !hiddenInput) return;

tagsContainer.innerHTML = currentVolPairedValue.map(v => 
  `<span class="bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/50 dark:text-teal-300 dark:border-teal-700/50 px-2 py-0.5 rounded text-xs flex items-center gap-1">${v} <i class="fa-solid fa-xmark cursor-pointer hover:text-red-500 ml-1" onclick="removeVolPaired('${v.replace(/'/g, "\\'")}')"></i></span>`
).join('');

if (currentVolPairedValue.length > 0) {
  tagsContainer.classList.add('mb-1');
} else {
  tagsContainer.classList.remove('mb-1');
}

hiddenInput.value = currentVolPairedValue.join(', ');
}

document.addEventListener('keydown', function(e) {
if (e.target && e.target.id === 'volPairedInput') {
  if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (e.target.value.trim()) {
          addVolPaired(e.target.value.trim());
      }
  }
}
});

document.addEventListener('click', function(e) {
const list = document.getElementById('activeVolsList');
const input = document.getElementById('volPairedInput');
if(list && !list.classList.contains('hidden') && e.target !== input && !list.contains(e.target)) {
  list.classList.add('hidden');
}
});

function loadVolData(name, isManualNew) { 
const url = document.getElementById('volSheetSelector').value; 
const container = document.getElementById('volFormContainer'); 
const fieldsDiv = document.getElementById('dynamicFields'); 
const title = document.getElementById('formTitle'); 
const submitBtn = document.getElementById('volSubmitBtn'); 
const projectContainer = document.getElementById('newVolProjectContainer'); 

container.classList.remove('hidden'); 

fieldsDiv.innerHTML = Array(4).fill('<div class="mb-2"><div class="animate-pulse h-3 bg-gray-200 dark:bg-zinc-700 rounded w-1/4 mb-1.5"></div><div class="animate-pulse h-10 bg-gray-100 dark:bg-zinc-800 rounded w-full"></div></div>').join(''); 

if (isManualNew) { 
 title.innerText = "Add New Volunteer"; 
 submitBtn.innerText = "Add New Volunteer & Update Attendance"; 
 projectContainer.classList.remove('hidden'); 
 document.getElementById('newVolProjectSearch').value = ""; 
 document.getElementById('newVolProjectSearch').required = true; 
 toggleClearBtn('newVolProjectSearch');
} else { 
 title.innerText = "Loading details..."; 
 submitBtn.innerText = "Update Attendance"; 
 projectContainer.classList.add('hidden'); 
 document.getElementById('newVolProjectSearch').required = false; 
} 

apiCall('getPersonData', { url: url, type: selectedVolType, name: name }).then(res => { 
 fieldsDiv.innerHTML = ''; 
 if(res.success) { 
     const data = res.data; 
     originalVolData = JSON.parse(JSON.stringify(data || {}));
     
     const config = res.config; 
     const meetingOpts = res.meetingOpts || []; 
     const dismissalOpts = res.dismissalOpts || []; 
     const isNew = res.isNew || isManualNew; 
     allProjects = res.projectOpts || []; 
     
     title.innerHTML = isNew ? `Add New: <span class="text-green-500">Volunteer</span>` : `Update: <span class="text-blue-500">${name}</span>`; 
     if(isNew) submitBtn.innerText = "Add New Volunteer & Update Attendance"; 
     else submitBtn.innerText = "Update Attendance"; 
     
     let fieldsToShow = (config && config.length > 0) ? config : res.headers.map(h => h.replace(/\[.*?\]/g,"").trim()); 
     if (isNew) { 
         const nameFieldExists = fieldsToShow.some(f => f.toLowerCase().includes("name")); 
         if (!nameFieldExists) { 
             const rawNameHeader = res.headers.find(h => h.toLowerCase().includes("name")) || "Volunteer Name"; 
             fieldsToShow.unshift(rawNameHeader.replace(/\[.*?\]/g,"").trim()); 
         } 
     } 
     
     fieldsToShow.forEach(header => { 
         let val = isNew ? "" : (getValueFuzzy(data, header)); 
         let cleanH = header.toLowerCase().replace(/[^a-z0-9]/g, ""); 
         let isNameField = cleanH.includes("name"); 
         if(isNew && cleanH.includes("project")) return; 
         let isReadOnly = isNameField && !isNew; 
         if(isNew && isNameField) val = ""; 
         if(!isNew && isNameField) val = name; 
         let inputHtml = ""; 
         let wrapperClass = "mb-1"; 
         if (!isNameField && !cleanH.includes("attending")) { wrapperClass += " attendance-dependent"; } 
         
         if (cleanH.includes("attending")) { 
             inputHtml = ` <select name="${header}" onchange="toggleDependentFields(this)" class="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded p-2 text-sm focus:border-green-500 shadow-sm"> <option value="" ${val===""?"selected":""}>Select...</option> <option value="Y" ${val.toLowerCase()==="y"?"selected":""}>Y (Yes)</option> <option value="N" ${val.toLowerCase()==="n"?"selected":""}>N (No)</option> </select>`; 
         } else if (cleanH.includes("meetinglocation") || cleanH.includes("dismissallocation")) { 
             const isDismissal = cleanH.includes("dismissal"); 
             const optionsList = isDismissal ? dismissalOpts : meetingOpts; 
             const placeholder = isDismissal ? "Select Dismissal..." : "Select Meeting..."; 
             let optionsHtml = optionsList.map(opt => { 
                 const isSelected = val.toString().trim().toLowerCase() === opt.toString().trim().toLowerCase(); 
                 return `<option value="${opt}" ${isSelected ? "selected" : ""}>${opt}</option>`; 
             }).join(""); 
             const valTrimmed = val.toString().trim(); 
             if (valTrimmed !== "") { 
                 const listHasValue = optionsList.some(opt => opt.toString().trim().toLowerCase() === valTrimmed.toLowerCase()); 
                 if (!listHasValue) { 
                     optionsHtml += `<option value="${val}" selected>${val} (Current)</option>`; 
                 } 
             } 
             inputHtml = ` <select name="${header}" class="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded p-2 text-sm focus:border-green-500 shadow-sm"> <option value="">${placeholder}</option> ${optionsHtml} </select>`; 
         } else if (cleanH.includes("vol") && cleanH.includes("paired")) {
             currentActiveVols = res.activeVolunteers || [];
             currentVolPairedValue = val.toString().split(/[,|\n]+/).map(s=>s.trim()).filter(s=>s);
             
             inputHtml = `
             <div class="w-full bg-gray-50 dark:bg-black border ${isReadOnly ? 'border-gray-200 dark:border-zinc-800 text-gray-500' : 'border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white focus-within:border-green-500'} rounded p-2 text-sm shadow-sm">
                 <div id="volPairedTags" class="flex flex-wrap gap-1 ${currentVolPairedValue.length > 0 ? 'mb-1' : ''}">
                     ${currentVolPairedValue.map(v => `<span class="bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/50 dark:text-teal-300 dark:border-teal-700/50 px-2 py-0.5 rounded text-xs flex items-center gap-1">${v} <i class="fa-solid fa-xmark cursor-pointer hover:text-red-500 ml-1" onclick="removeVolPaired('${v.replace(/'/g, "\\'")}')"></i></span>`).join('')}
                 </div>
                 <input type="hidden" name="${header}" id="volPairedHidden" value="${currentVolPairedValue.join(', ')}">
                 <div class="relative">
                     <input type="text" id="volPairedInput" ${isReadOnly ? 'readonly' : ''} class="w-full bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-500 text-sm" placeholder="Search volunteer..." autocomplete="off" oninput="filterActiveVols()" onfocus="filterActiveVols()">
                     <ul id="activeVolsList" class="absolute z-50 w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg mt-1 shadow-xl hidden max-h-40 overflow-y-auto pb-6"></ul>
                 </div>
             </div>
             `;
         } else if (cleanH.includes("remark")) { 
             inputHtml = `<textarea name="${header}" rows="8" ${isReadOnly ? 'readonly' : ''} class="w-full bg-gray-50 dark:bg-black border ${isReadOnly ? 'border-gray-200 dark:border-zinc-800 text-gray-500' : 'border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white focus:border-green-500'} rounded p-2 text-sm resize-y [color-scheme:light] dark:[color-scheme:dark] shadow-sm">${val}</textarea>`; 
         } else { 
             let type = "text"; 
             if(cleanH.includes("date")) type = "date"; 
             if(cleanH.includes("time")) type = "time"; 
             inputHtml = `<input name="${header}" type="${type}" value="${val}" ${isReadOnly ? 'readonly' : ''} class="w-full bg-gray-50 dark:bg-black border ${isReadOnly ? 'border-gray-200 dark:border-zinc-800 text-gray-500' : 'border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white focus:border-green-500'} rounded p-2 text-sm [color-scheme:light] dark:[color-scheme:dark] shadow-sm">`; 
         } 
         fieldsDiv.innerHTML += `<div class="${wrapperClass}"><label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">${header}</label>${inputHtml}</div>`; 
     }); 
     
     const attSelect = document.querySelector('select[name*="Attending"], select[name*="attending"]'); 
     if(attSelect) toggleDependentFields(attSelect); 
 } else { 
     fieldsDiv.innerHTML = '<div class="text-red-500 dark:text-red-400 font-bold">Error: ' + res.message + '</div>'; 
 } 
}); 
}

function submitAttendance(e) { 
e.preventDefault(); 

const volInput = document.getElementById('volPairedInput');
if (volInput && volInput.value.trim()) {
 addVolPaired(volInput.value.trim());
}

let dataObj = {}; 
const formData = new FormData(document.getElementById('attendanceForm')); 
formData.forEach((value, key) => dataObj[key] = value); 

let target = document.getElementById('volNameSearch').value; 
if (!target || target === "") { 
 for (let k in dataObj) { 
     if (k.toLowerCase().includes("name")) { 
         target = dataObj[k]; 
         break; 
     } 
 } 
}

// Compute Delta payload to prevent redundant writes
let deltaObj = {};
let isChanged = false;
for (let key in dataObj) {
 if (dataObj[key] !== originalVolData[key]) {
     deltaObj[key] = dataObj[key];
     isChanged = true;
 }
}

// If completely identical to original data, bypass API
if (!isChanged) {
 showOverlay('success', 'No changes detected.');
 setTimeout(() => { closeOverlay(); }, 1500);
 return;
}

// Ensure critical identifiers are passed in the delta for processing
for (let k in dataObj) {
 if (k.toLowerCase().includes("name") || k.toLowerCase().includes("project")) {
     deltaObj[k] = dataObj[k];
 }
}

showOverlay('loading', 'Saving Attendance...');

const payload = { sheetUrl: document.getElementById('volSheetSelector').value, type: selectedVolType, data: deltaObj, targetName: target }; 

apiCall('submitAttendanceData', payload).then(res => { 
 if(res.success) {
     showOverlay('success', res.message);
     if(selectedVolType === 'volunteer') { 
         if(res.message.includes("added")) { 
             resetVolForm(); 
             document.getElementById('volNameSearch').value = ""; 
         } 
         const url = document.getElementById('volSheetSelector').value; 
         setTimeout(() => {
             apiCall('getNamesList', { url: url, type: 'volunteer' }).then(r => { if(r.success) allNames = r.names; }); 
         }, 500);
     } 
 } else {
     showOverlay('error', res.message);
 }
}); 
}