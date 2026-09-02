let regMemberCount = 0;
let publicTrainees = [];
let lastAddedTraineeName = "";
let currentCaregiverIdx = null;

async function fetchPublicTrainees() {
let attempts = 0;
let success = false;
while(attempts < 3 && !success) {
   try {
       const res = await apiCall('getPublicTrainees');
       if (res.status === 'success' && res.trainees) {
           publicTrainees = res.trainees;
           success = true;
       }
   } catch (e) {
       attempts++;
       console.warn(`Failed to fetch public trainees (Attempt ${attempts})`);
       if(attempts < 3) await new Promise(r => setTimeout(r, 1500));
   }
}
}

function getFirstTraineeName() {
   const allBlocks = Array.from(document.getElementsByClassName('member-block'));
   for (let b of allBlocks) {
       const role = b.querySelector('.reg-f-role').value;
       if (role === 'TRAINEE') {
           return b.querySelector('.reg-f-name').value;
       }
   }
   return "";
}

function syncTraineeName() {
   const allBlocks = Array.from(document.getElementsByClassName('member-block'));
   for (let i = 0; i < allBlocks.length; i++) {
       const b = allBlocks[i];
       const role = b.querySelector('.reg-f-role').value;
       if (role === 'CAREGIVER') {
           const relatedInput = b.querySelector('.reg-f-related');
           if (relatedInput && relatedInput.dataset.manual !== 'true') {
               const traineesBefore = [];
               for (let j = 0; j < i; j++) {
                   const prevB = allBlocks[j];
                   if (prevB.querySelector('.reg-f-role').value === 'TRAINEE') {
                       const tName = prevB.querySelector('.reg-f-name').value.trim();
                       if (tName) traineesBefore.push(tName);
                   }
               }
               relatedInput.value = traineesBefore.join(' | ');
           }
       }
   }
}

function addRegMember() {
const idx = regMemberCount++;
let groupOpts = `<option value="">Select...</option>`;

if (appSettings.projectGroups) {
 appSettings.projectGroups.forEach(g => {
   groupOpts += `<option value="${g}">${g}</option>`;
 });
}

const headerBtn = `<button type="button" onclick="this.closest('.member-block').remove(); syncTraineeName();" class="absolute top-4 right-4 text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 dark:bg-gray-700 dark:text-red-400 px-2 py-1 rounded transition focus:outline-none">Remove</button>`;

const headerHtml = `
 ${headerBtn}
 <h4 class="font-bold text-lg mb-4 border-b border-gray-200 dark:border-gray-700 pb-2 text-primary dark:text-green-400">Person ${idx + 1}</h4>
`;

const personalInfoHtml = `
 <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
   <div class="md:col-span-2">
       <label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Role <span class="text-red-500">*</span></label>
       <select required class="reg-f-role w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" onchange="syncTraineeName(); toggleTraineeFields(this, ${idx});">
           <option value="" disabled selected>Select Role...</option>
           <option value="TRAINEE">Trainee</option>
           <option value="CAREGIVER">Caregiver</option>
           <option value="VOLUNTEER">Volunteer</option>
       </select>
   </div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Full Name (As in Passport) <span class="text-red-500">*</span></label><input required type="text" class="reg-f-name w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" oninput="syncTraineeName()"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Short Name / Nickname <span class="text-red-500">*</span></label><input required type="text" class="reg-f-shortname w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Preferred name"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Email <span class="text-red-500">*</span></label><input required type="email" class="reg-f-email w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Gender <span class="text-red-500">*</span></label><select required class="reg-f-gender w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"><option>Male</option><option>Female</option></select></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Contact Number (8-digit) <span class="text-red-500">*</span></label><input required type="tel" pattern="[0-9]{8}" class="reg-f-contact w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Date of Birth <span class="text-red-500">*</span></label><input required type="text" id="dob_${idx}" readonly placeholder="DD Mmm YYYY" onclick="openDatePicker('dob_${idx}', 'dob')" class="reg-f-dob w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium text-center cursor-pointer bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Project <span class="text-red-500">*</span></label><select required class="reg-f-group w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary">${groupOpts}</select></div>
   <div class="md:col-span-2"><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Home Address <span class="text-red-500">*</span></label><textarea required class="reg-f-address w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" rows="2"></textarea></div>
 </div>
`;

const caregiverHtml = `
 <div class="trainee-div hidden-force bg-green-50/50 dark:bg-gray-800 p-4 rounded-xl mb-4 border border-green-100 dark:border-gray-700">
   <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
     <div class="relative">
         <label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Related Trainees' Name(s) <span class="text-red-500">*</span></label>
         <input required disabled type="text" id="reg-f-related-${idx}" class="reg-f-related w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" autocomplete="off" placeholder="Comma-separated for multiple">
     </div>
     <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Relationship to Trainee(s) <span class="text-red-500">*</span></label><input required disabled type="text" class="reg-f-relation w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. Father, Sibling"></div>
   </div>
 </div>
`;

const identityHtml = `
 <h4 class="font-bold text-lg mb-3 border-b border-gray-200 dark:border-gray-700 pb-1 text-primary dark:text-green-400">Identification</h4>
 <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Full NRIC / FIN <span class="text-red-500">*</span></label><div class="dup-warn hidden-force text-xs text-red-500 font-bold mb-1"></div><input required type="text" onblur="checkDuplicateField(this, 'nric')" oninput="handleFieldInput(this, 'nric')" class="reg-f-nric w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg uppercase bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Nationality <span class="text-red-500">*</span></label><input required type="text" id="reg-f-nat_${idx}" class="reg-f-nat w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Passport No. <span class="text-red-500">*</span></label><div class="dup-warn hidden-force text-xs text-red-500 font-bold mb-1"></div><input required type="text" onblur="checkDuplicateField(this, 'passport')" oninput="handleFieldInput(this, 'passport')" class="reg-f-pass w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg uppercase bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Passport Expiry <span class="text-red-500">*</span></label><input required type="text" id="exp_${idx}" readonly placeholder="DD Mmm YYYY" onclick="openDatePicker('exp_${idx}', 'exp')" class="reg-f-exp w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium text-center cursor-pointer bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
 </div>
`;

const medicalHtml = `
 <h4 class="font-bold text-lg mb-3 border-b border-gray-200 dark:border-gray-700 pb-1 text-primary dark:text-green-400">Dietary</h4>
 <div class="mb-4">
   <label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Dietary Restrictions <span class="text-red-500">*</span></label>
   <input required type="text" class="reg-f-diet w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Nil if none">
 </div>
 
 <div class="medical-div hidden-force">
   <h4 class="font-bold text-lg mb-3 border-b border-gray-200 dark:border-gray-700 pb-1 text-primary dark:text-green-400">Medical</h4>
   <div class="mb-4">
     <label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Medical Conditions and Medications to take note of <span class="text-red-500">*</span></label>
     <textarea required class="reg-f-medical w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary" rows="2" placeholder="Nil if none"></textarea>
   </div>
 </div>

 <h4 class="font-bold text-lg mb-3 border-b border-gray-200 dark:border-gray-700 pb-1 text-primary dark:text-green-400">Emergency Contact</h4>
 <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Emergency Contact Name <span class="text-red-500">*</span></label><input required type="text" class="reg-f-emname w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Emergency Contact Number (8-digit) <span class="text-red-500">*</span></label><input required type="tel" pattern="[0-9]{8}" class="reg-f-emcontact w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Relationship to Emerg. Contact <span class="text-red-500">*</span></label><input required type="text" class="reg-f-emrelation w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
 </div>
`;

const remarksHtml = `
 <h4 class="font-bold text-lg mb-3 border-b border-gray-200 dark:border-gray-700 pb-1 text-primary dark:text-green-400">Remarks</h4>
 <div class="space-y-4">
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Sleeping Arrangement Request</label><textarea class="reg-f-sleep w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" rows="2"></textarea></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Other Points to Note</label><textarea class="reg-f-other w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" rows="2"></textarea></div>
 </div>
`;

const finalHtml = `
 <div class="member-block bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm relative" data-idx="${idx}">
   ${headerHtml}
   ${personalInfoHtml}
   ${caregiverHtml}
   ${identityHtml}
   ${medicalHtml}
   ${remarksHtml}
 </div>
`;

document.getElementById('membersContainer').insertAdjacentHTML('beforeend', finalHtml);

  // Apply token input
  setTimeout(() => {
      if (typeof setupNationalityDropdown === 'function') setupNationalityDropdown(`reg-f-nat_${idx}`);
      if (typeof setupTokenInput === 'function') {
          setupTokenInput(`reg-f-related-${idx}`, function(query) {
              let localTrainees = [];
              const allBlocks = Array.from(document.getElementsByClassName('member-block'));
              for (let b of allBlocks) {
                 const role = b.querySelector('.reg-f-role').value;
                 if (role === 'TRAINEE') {
                     const tName = b.querySelector('.reg-f-name').value.trim();
                     const tShort = b.querySelector('.reg-f-shortname').value.trim();
                     if (tName) {
                         localTrainees.push({name: tName, shortName: tShort});
                     }
                 }
              }
              let allTrainees = [...publicTrainees, ...localTrainees];
              const seen = new Set();
              allTrainees = allTrainees.filter(t => {
                 const k = t.name.toLowerCase();
                 if(seen.has(k)) return false;
                 seen.add(k);
                 return true;
              });
              let matches = allTrainees;
              if (query) {
                matches = allTrainees.filter(t => 
                     t.name.toLowerCase().includes(query) || 
                     (t.shortName && t.shortName.toLowerCase().includes(query))
                );
              }
              return matches.map(t => {
                  const formatted = `${t.name}${t.shortName ? ' (' + t.shortName + ')' : ''}`;
                  return { label: formatted, value: formatted };
              });
          });
      }
  }, 50);
}

function toggleTraineeFields(selectEl, idx) {
const block = selectEl.closest('.member-block');
const caregiverDiv = block.querySelector('.trainee-div');
const medicalDiv = block.querySelector('.medical-div');

if (selectEl.value === 'CAREGIVER') {
 caregiverDiv.classList.remove('hidden-force');
 const cgInputs = caregiverDiv.querySelectorAll('input');
 cgInputs.forEach(i => i.disabled = false);
 openCaregiverPopup(idx);
} else {
 caregiverDiv.classList.add('hidden-force');
 const cgInputs = caregiverDiv.querySelectorAll('input');
 cgInputs.forEach(i => i.disabled = true);
 
 if (selectEl.value === 'TRAINEE') {
     const nameInput = block.querySelector('.reg-f-name');
     if(nameInput) {
         nameInput.addEventListener('change', (e) => {
             if(selectEl.value === 'TRAINEE') lastAddedTraineeName = e.target.value.trim();
         });
         nameInput.addEventListener('blur', (e) => {
             if(selectEl.value === 'TRAINEE') lastAddedTraineeName = e.target.value.trim();
         });
     }
 }
}

const medInputs = medicalDiv.querySelectorAll('input, textarea');
if (selectEl.value === 'TRAINEE') {
 medicalDiv.classList.remove('hidden-force');
 medInputs.forEach(i => i.disabled = false);
} else {
 medicalDiv.classList.add('hidden-force');
 medInputs.forEach(i => i.disabled = true);
}
}

function openCaregiverPopup(idx) {
currentCaregiverIdx = idx;
const inlineName = document.getElementById(`reg-f-related-${idx}`).value;
const block = document.querySelector(`.member-block[data-idx="${idx}"]`);
const inlineRel = block.querySelector('.reg-f-relation').value;

const defaultName = inlineName || getFirstTraineeName();
const popupName = document.getElementById('cgPopupTraineeName');
const popupRel = document.getElementById('cgPopupRelation');

popupName.value = defaultName;
popupName.dataset.manual = inlineName ? document.getElementById(`reg-f-related-${idx}`).dataset.manual : 'false';
popupRel.value = inlineRel || '';

if (typeof setupTokenInput === 'function') {
    setupTokenInput('cgPopupTraineeName', function(query) {
        let localTrainees = [];
        const allBlocks = Array.from(document.getElementsByClassName('member-block'));
        for (let b of allBlocks) {
            const role = b.querySelector('.reg-f-role').value;
            if (role === 'TRAINEE') {
                const tName = b.querySelector('.reg-f-name').value.trim();
                const tShort = b.querySelector('.reg-f-shortname').value.trim();
                if (tName) {
                    localTrainees.push({name: tName, shortName: tShort});
                }
            }
        }
        let allTrainees = [...publicTrainees, ...localTrainees];
        const seen = new Set();
        allTrainees = allTrainees.filter(t => {
            const k = t.name.toLowerCase();
            if(seen.has(k)) return false;
            seen.add(k);
            return true;
        });
        let matches = allTrainees;
        if (query) {
            matches = allTrainees.filter(t => 
                t.name.toLowerCase().includes(query) || 
                (t.shortName && t.shortName.toLowerCase().includes(query))
            );
        }
        return matches.map(t => {
            const formatted = `${t.name}${t.shortName ? ' (' + t.shortName + ')' : ''}`;
            return { label: formatted, value: formatted };
        });
    });
}

if (window._tokenInputs && window._tokenInputs['cgPopupTraineeName']) {
    window._tokenInputs['cgPopupTraineeName'].tokens = defaultName.split(/[\|,]/).map(s => s.trim()).filter(Boolean);
    window._tokenInputs['cgPopupTraineeName'].render();
}

document.getElementById('caregiverPopupModal').classList.remove('hidden-force');
}

function closeCaregiverPopup() {
document.getElementById('caregiverPopupModal').classList.add('hidden-force');
currentCaregiverIdx = null;
}

function cancelCaregiverPopup() {
if (currentCaregiverIdx !== null) {
   const block = document.querySelector(`.member-block[data-idx="${currentCaregiverIdx}"]`);
   if (block) {
       const roleSel = block.querySelector('.reg-f-role');
       roleSel.value = "";
       toggleTraineeFields(roleSel, currentCaregiverIdx);
   }
}
closeCaregiverPopup();
}

function confirmCaregiverPopup() {
const cgInput = window._tokenInputs && window._tokenInputs['cgPopupTraineeName'] ? window._tokenInputs['cgPopupTraineeName'].getInputField() : null;
if (cgInput && cgInput.value.trim().length > 0) {
   alert("Incorrect Names");
   return;
}

const nameVal = document.getElementById('cgPopupTraineeName').value.trim();
const relVal = document.getElementById('cgPopupRelation').value.trim();

if (!nameVal || !relVal) {
   alert("Please fill in both fields.");
   return;
}

if (currentCaregiverIdx !== null) {
   const inlineName = document.getElementById(`reg-f-related-${currentCaregiverIdx}`);
   const block = document.querySelector(`.member-block[data-idx="${currentCaregiverIdx}"]`);
   const inlineRel = block.querySelector('.reg-f-relation');
   
   if (inlineName) {
       inlineName.value = nameVal;
       inlineName.dataset.manual = 'true';
       if (window._tokenInputs && window._tokenInputs[`reg-f-related-${currentCaregiverIdx}`]) {
           window._tokenInputs[`reg-f-related-${currentCaregiverIdx}`].tokens = nameVal.split(/[\|,]/).map(s => s.trim()).filter(Boolean);
           window._tokenInputs[`reg-f-related-${currentCaregiverIdx}`].render();
       }
   }
   if (inlineRel) inlineRel.value = relVal;
}
closeCaregiverPopup();
}

function isValidTraineeName(val) {
if (!val) return false;
val = val.toLowerCase();
const inPublic = publicTrainees.some(t => t.name.toLowerCase() === val || (t.shortName && t.shortName.toLowerCase() === val));

let inForm = false;
const allBlocks = Array.from(document.getElementsByClassName('member-block'));
for (let b of allBlocks) {
   const role = b.querySelector('.reg-f-role').value;
   if (role === 'TRAINEE') {
       const tName = b.querySelector('.reg-f-name').value.trim().toLowerCase();
       const tShort = b.querySelector('.reg-f-shortname').value.trim().toLowerCase();
       if (tName === val || (tShort && tShort === val)) {
           inForm = true;
           break;
       }
   }
}
return inPublic || inForm;
}


function showTraineeDropdown(idx) {
filterTraineeDropdown(idx);
}

function hideTraineeDropdown(idx) {
setTimeout(() => {
  const input = document.getElementById(`reg-f-related-${idx}`);
  if(input && document.activeElement === input) return;
  const dd = document.getElementById(`trainee-dropdown-${idx}`);
  if(dd) dd.classList.add('hidden-force');
}, 250);
}

function filterTraineeDropdown(idx) {
const input = document.getElementById(`reg-f-related-${idx}`);
const dd = document.getElementById(`trainee-dropdown-${idx}`);
if(!input || !dd) return;
const parts = input.value.split('|');
const query = parts[parts.length - 1].toLowerCase().trim();

let localTrainees = [];
const allBlocks = Array.from(document.getElementsByClassName('member-block'));
for (let b of allBlocks) {
   const role = b.querySelector('.reg-f-role').value;
   if (role === 'TRAINEE') {
       const tName = b.querySelector('.reg-f-name').value.trim();
       const tShort = b.querySelector('.reg-f-shortname').value.trim();
       if (tName) {
           localTrainees.push({name: tName, shortName: tShort});
       }
   }
}

let allTrainees = [...publicTrainees, ...localTrainees];
const seen = new Set();
allTrainees = allTrainees.filter(t => {
   const k = t.name.toLowerCase();
   if(seen.has(k)) return false;
   seen.add(k);
   return true;
});

let matches = allTrainees;

if (query) {
  matches = allTrainees.filter(t => 
      t.name.toLowerCase().includes(query) || 
      (t.shortName && t.shortName.toLowerCase().includes(query))
  );
}

let html = '';
matches.forEach(t => {
  html += `<li class="px-3 py-2 text-sm font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700 last:border-0" onmousedown="selectTraineeDropdown(${idx}, '${t.name.replace(/'/g, "\\'")}')">${t.name} ${t.shortName ? `(${t.shortName})` : ''}</li>`;
});

if(html === '') {
   if (query === '') {
       html = `<li class="px-3 py-2 text-sm text-gray-500 italic text-center pointer-events-none">No trainees available. Please add a Trainee first.</li>`;
   } else {
       html = `<li class="px-3 py-2 text-sm text-gray-500 italic text-center pointer-events-none">No matches found</li>`;
   }
}

dd.innerHTML = html;
dd.classList.remove('hidden-force');
}

function selectTraineeDropdown(idx, name) {
const input = document.getElementById(`reg-f-related-${idx}`);
if(input) {
  let parts = input.value.split('|');
  parts.pop();
  parts.push(name);
  input.value = parts.join(' | ') + ' | ';
  input.dataset.manual = 'true';
  const dd = document.getElementById(`trainee-dropdown-${idx}`);
  if(dd) dd.classList.add('hidden-force');
  setTimeout(() => input.focus(), 10);
}
}

async function submitRegistration(btn) {
    if (document.querySelector('[data-invalid="true"]')) {
        showToast("Please resolve all errors before submitting.", true);
        return;
    }
let finalData = [];
let blocks = document.getElementsByClassName('member-block');

if (blocks.length === 0) {
 showToast("Please add at least one person.", true);
 return;
}

for (let i = 0; i < blocks.length; i++) {
 let b = blocks[i];
 finalData.push({
   fullName: b.querySelector('.reg-f-name').value,
   shortName: b.querySelector('.reg-f-shortname').value,
   email: b.querySelector('.reg-f-email').value, 
   role: b.querySelector('.reg-f-role').value, 
   gender: b.querySelector('.reg-f-gender').value,
   contact: b.querySelector('.reg-f-contact').value, 
   dob: b.querySelector('.reg-f-dob').value, 
   group: b.querySelector('.reg-f-group').value, 
   address: b.querySelector('.reg-f-address').value,
   relatedTrainee: b.querySelector('.reg-f-related') ? b.querySelector('.reg-f-related').value : '', 
   relationship: b.querySelector('.reg-f-relation') ? b.querySelector('.reg-f-relation').value : '', 
   nric: b.querySelector('.reg-f-nric').value.toUpperCase(), 
   nationality: b.querySelector('.reg-f-nat').value,
   passportNo: b.querySelector('.reg-f-pass').value.toUpperCase(), 
   passportExpiry: b.querySelector('.reg-f-exp').value, 
   diet: b.querySelector('.reg-f-diet').value, 
   emergencyName: b.querySelector('.reg-f-emname').value,
   emergencyContact: b.querySelector('.reg-f-emcontact').value, 
   emergencyRelation: b.querySelector('.reg-f-emrelation').value, 
   sleeping: b.querySelector('.reg-f-sleep').value, 
   otherPoints: b.querySelector('.reg-f-other').value,
   medical: b.querySelector('.reg-f-medical') ? b.querySelector('.reg-f-medical').value : ''
 });
}

setBtnLoading(btn, true); const viewLoading = document.getElementById('viewLoading'); if (viewLoading) viewLoading.classList.remove('hidden-force');
try {
 await apiCall('submitRegistration', { payload: finalData });
 showToast("Registration Successful! Please login.");
 setTimeout(() => { window.location.href = 'index.html'; }, 1500);
} catch (e) {
 showToast(e.message, true);
} finally {
 setBtnLoading(btn, false); if (viewLoading) viewLoading.classList.add('hidden-force');
}
}
async function checkDuplicateField(inputEl, fieldType) {
    const val = inputEl.value.trim().toUpperCase();
    if (!val) {
        inputEl.classList.remove('border-red-500', 'ring-red-500');
        inputEl.removeAttribute('data-invalid');
        inputEl.previousElementSibling.classList.add('hidden-force');
        return;
    }
    
    if (fieldType === 'nric' && typeof isValidNRIC === 'function' && !isValidNRIC(val)) {
        const warnEl = inputEl.previousElementSibling;
        warnEl.innerHTML = "Invalid NRIC/FIN.";
        warnEl.classList.remove('hidden-force');
        inputEl.classList.add('border-red-500', 'ring-red-500');
        inputEl.setAttribute('data-invalid', 'true');
        return;
    }
    
    const warnEl = inputEl.previousElementSibling;
    
    // Check locally among currently filled blocks (to prevent same NRIC typed twice in the form)
    let localDup = false;
    const allInputs = document.querySelectorAll(fieldType === 'nric' ? '.reg-f-nric' : '.reg-f-pass');
    let count = 0;
    allInputs.forEach(inp => {
        if (inp.value.trim().toUpperCase() === val) count++;
    });
    if (count > 1) {
        warnEl.innerHTML = fieldType === "nric" ? "This NRIC/FIN is already entered in another participant block within this unsubmitted form." : "This Passport No. is already entered in another participant block within this unsubmitted form.";
        warnEl.classList.remove('hidden-force');
        inputEl.classList.add('border-red-500', 'ring-red-500');
        inputEl.setAttribute('data-invalid', 'true');
        return;
    }

    try {
        const payload = {};
        if (fieldType === 'nric') payload.nric = val;
        else payload.passport = val;
        
        const res = await apiCall('checkDuplicateParticipant', payload);
        if (res.status === 'error' && res.conflictType) {
            warnEl.innerHTML = `${res.conflictType} already exists. If you have already registered before, <a href="index.html" class="underline text-blue-600 hover:text-blue-800">login here</a> to make the necessary changes. Login format: NRIC/FIN + Year of Birth (e.g. S1234567A1989).`;
            warnEl.classList.remove('hidden-force');
            inputEl.classList.add('border-red-500', 'ring-red-500');
            inputEl.setAttribute('data-invalid', 'true');
        } else {
            warnEl.classList.add('hidden-force');
            inputEl.classList.remove('border-red-500', 'ring-red-500');
            inputEl.removeAttribute('data-invalid');
        }
    } catch (e) {
        console.error("Duplicate check failed:", e);
    }
}

window.handleFieldInput = function(inputEl, fieldType) {
    const val = inputEl.value.trim().toUpperCase();
    const warnEl = inputEl.previousElementSibling;
    
    // Auto-clear invalid format errors if it becomes valid
    if (fieldType === 'nric' && typeof isValidNRIC === 'function') {
        if (isValidNRIC(val)) {
            if (warnEl.innerHTML === "Invalid NRIC/FIN.") {
                warnEl.classList.add('hidden-force');
                inputEl.classList.remove('border-red-500', 'ring-red-500');
                inputEl.removeAttribute('data-invalid');
                // Re-check duplicate now that it's valid
                checkDuplicateField(inputEl, 'nric');
            }
        }
    }
    
    // Auto-clear local duplicate errors if the user modifies the text, wait for blur to re-check
    if (warnEl && warnEl.innerHTML.includes("unsubmitted form")) {
        warnEl.classList.add('hidden-force');
        inputEl.classList.remove('border-red-500', 'ring-red-500');
        inputEl.removeAttribute('data-invalid');
    }
};
