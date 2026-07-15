function addRegMember() {
const idx = regMemberCount++; 
let groupOpts = `<option value="">Select...</option>`;

if (appSettings.projectGroups) {
 appSettings.projectGroups.forEach(g => { 
   groupOpts += `<option value="${g}">${g}</option>`; 
 });
}

const isMain = idx === 0;
const req = isMain ? 'required' : '';

const headerBtn = isMain 
 ? `<div class="absolute top-4 right-4 bg-primary text-white font-bold px-2 py-0.5 text-[10px] rounded border border-blue-800 tracking-wider">MAIN POC</div>` 
 : `<button type="button" onclick="this.closest('.member-block').remove()" class="absolute top-4 right-4 text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 dark:bg-gray-700 dark:text-red-400 px-2 py-1 rounded transition focus:outline-none">Remove</button>`;

const headerHtml = `
 ${headerBtn}
 <h4 class="font-bold text-lg mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 text-gray-900 dark:text-white">Person ${idx + 1}</h4>
`;

const personalInfoHtml = `
 <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Full Name (As in Passport)</label><input required type="text" class="reg-f-name w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Short Name / Nickname</label><input type="text" class="reg-f-shortname w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Preferred name"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Email</label><input ${req} type="email" class="reg-f-email w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Role</label><select class="reg-f-role w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" onchange="toggleTraineeFields(this)"><option value="TRAINEE">Trainee</option><option value="CAREGIVER">Caregiver</option><option value="VOLUNTEER">Volunteer</option></select></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Gender</label><select class="reg-f-gender w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"><option>Male</option><option>Female</option></select></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Contact Number (8-digit)</label><input ${req} type="tel" pattern="[0-9]{8}" class="reg-f-contact w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Date of Birth</label><input required type="text" id="dob_${idx}" readonly placeholder="DD Mmm YYYY" onclick="openDatePicker('dob_${idx}', 'dob')" class="reg-f-dob w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium text-center cursor-pointer bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Project</label><select class="reg-f-group w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary">${groupOpts}</select></div>
   <div class="md:col-span-2"><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Home Address</label><textarea required class="reg-f-address w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" rows="2"></textarea></div>
 </div>
`;

const caregiverHtml = `
 <div class="trainee-div hidden-force bg-blue-50/50 dark:bg-gray-800 p-4 rounded-xl mb-4 border border-blue-100 dark:border-gray-700">
   <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
     <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Related Trainee's Name</label><input type="text" class="reg-f-related w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
     <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Relationship to Trainee</label><input type="text" class="reg-f-relation w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. Father, Sibling"></div>
   </div>
 </div>
`;

const identityHtml = `
 <h4 class="font-bold text-sm mb-3 border-b border-gray-100 dark:border-gray-700 pb-1 text-gray-600 dark:text-gray-300">Identification</h4>
 <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Full NRIC / FIN</label><input required type="text" class="reg-f-nric w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg uppercase bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Nationality</label><input required type="text" class="reg-f-nat w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Passport No.</label><input required type="text" class="reg-f-pass w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg uppercase bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Passport Expiry</label><input required type="text" id="exp_${idx}" readonly placeholder="DD Mmm YYYY" onclick="openDatePicker('exp_${idx}', 'exp')" class="reg-f-exp w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium text-center cursor-pointer bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
 </div>
`;

const medicalHtml = `
 <h4 class="font-bold text-sm mb-3 border-b border-gray-100 dark:border-gray-700 pb-1 text-gray-600 dark:text-gray-300">Medical & Emergency</h4>
 <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
   <div class="md:col-span-2"><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Dietary Restrictions</label><input type="text" class="reg-f-diet w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Nil if none"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Emergency Contact Name</label><input required type="text" class="reg-f-emname w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Emergency Contact Number (8-digit)</label><input required type="tel" pattern="[0-9]{8}" class="reg-f-emcontact w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
   <div><label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Relationship to Emerg. Contact</label><input required type="text" class="reg-f-emrelation w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"></div>
 </div>
`;

const remarksHtml = `
 <h4 class="font-bold text-sm mb-3 border-b border-gray-100 dark:border-gray-700 pb-1 text-gray-600 dark:text-gray-300">Remarks</h4>
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
}

function toggleTraineeFields(selectEl) { 
const div = selectEl.closest('.member-block').querySelector('.trainee-div'); 
if(selectEl.value === 'CAREGIVER') {
 div.classList.remove('hidden-force'); 
} else {
 div.classList.add('hidden-force'); 
}
}

async function submitRegistration(btn) {
let finalData = new Array();
let blocks = document.getElementsByClassName('member-block');

for (let i = 0; i < blocks.length; i++) {
 let b = blocks[i];
 finalData.push({
   fullName: b.querySelector('.reg-f-name').value, 
   shortName: b.querySelector('.reg-f-shortname').value,
   email: b.querySelector('.reg-f-email').value, role: b.querySelector('.reg-f-role').value, gender: b.querySelector('.reg-f-gender').value,
   contact: b.querySelector('.reg-f-contact').value, dob: b.querySelector('.reg-f-dob').value, group: b.querySelector('.reg-f-group').value, address: b.querySelector('.reg-f-address').value,
   relatedTrainee: b.querySelector('.reg-f-related').value, relationship: b.querySelector('.reg-f-relation').value, nric: b.querySelector('.reg-f-nric').value.toUpperCase(), nationality: b.querySelector('.reg-f-nat').value,
   passportNo: b.querySelector('.reg-f-pass').value.toUpperCase(), passportExpiry: b.querySelector('.reg-f-exp').value, diet: b.querySelector('.reg-f-diet').value, emergencyName: b.querySelector('.reg-f-emname').value,
   emergencyContact: b.querySelector('.reg-f-emcontact').value, emergencyRelation: b.querySelector('.reg-f-emrelation').value, sleeping: b.querySelector('.reg-f-sleep').value, otherPoints: b.querySelector('.reg-f-other').value
 });
}

setBtnLoading(btn, true);
try { await callBackend('submitRegistration', { payload: finalData }); showToast("Registration Successful! Please login."); setTimeout(() => navTo('login'), 1500); } 
catch (e) { showToast(e.message, true); } 
finally { setBtnLoading(btn, false); }
}